/**
 * @module render/Renderer
 * Frame orchestration. Layer order:
 * background → tiles (chunks) → crack overlays → ore glints → entities → particles →
 * lighting composite → bloom → fog of war → radar markers → PostFX → (DOM HUD).
 */
import { MATERIALS, WORLD, CAMERA, RENDER, ORES, FLAG, TILE, DYNAMITE, ENERGY, PICKUPS, MINING, HAZARD } from '../config.js';
import { hash2 } from '../core/RNG.js';
import { requiredTier } from '../systems/Mining.js';
import { hexToRgb } from './canvas.js';
import { viewScale } from './Camera.js';
import { loadRigAssets } from '../anim/loadRigAssets.js';
import { Animator } from '../anim/Animator.js';
import { RigRenderer, PAD as RIG_PAD } from '../anim/RigRenderer.js';
import { sanitizeOutfit } from '../anim/Outfit.js';
import { applyOverlays, toRigSpace, idleGripAngle } from '../anim/Overlays.js';
import { solveWorld } from '../anim/Rig.js';

const T = WORLD.TILE_PX;
const MAX_SHOCKWAVES = 8;

/** Pick angle offset (rad) from aim over one swing. Phase 0 and 1 are both the impact, so the loop is seamless:
 * slow ease-out lift to the wind-up at 0.6, then an accelerating chop back into the block. */
export function swingOffset(phase) {
  const HIT = 0.35; const UP = -1.7;
  if (phase < 0.6) { const k = phase / 0.6; return HIT + (UP - HIT) * (1 - (1 - k) * (1 - k)); }
  const k = (phase - 0.6) / 0.4; return UP + (HIT - UP) * k * k * k;
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {any} d dependencies {world, art, chunks, vis, mining, particles, background, lighting, postfx, camera, player, dynamites, fallingLadders, pickups, economy, energy}
   */
  constructor(canvas, d) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false }));
    this.d = d;
    this.scale = 2;
    this.dpr = 1;
    this.viewW = 960; this.viewH = 540;
    this.camL = 0; this.camT = 0;
    this.drawCalls = 0;
    this.time = 0;
    this.shockX = new Float32Array(MAX_SHOCKWAVES); this.shockY = new Float32Array(MAX_SHOCKWAVES); this.shockT = new Float32Array(MAX_SHOCKWAVES);
    this.hoverTile = -1;
    this.hoverMineable = false;
    this.oreFill = ORES.map((o) => (o ? o.colors.base : '#fff'));
    this.oreLight = ORES.map((o) => (o ? o.colors.light : '#fff'));
    /** Reused per-frame state handed to Lighting. */
    this.fs = {
      world: d.world, camL: 0, camT: 0, viewW: 0, viewH: 0, tx0: 0, ty0: 0, tx1: 0, ty1: 0,
      playerX: 0, playerY: 0, aimAngle: 0, headlamp: 200, time: 0, particles: d.particles,
      beacons: d.background.beacons, canvasW: 0, canvasH: 0,
    };
    this.ps = { depth: 0, time: 0, scale: 2, energyFrac: 1, lowThreshold: ENERGY.LOW_THRESHOLD };
    this.resize();
    /** Skeleton assets; null until loaded (or forever if they fail → old sheet is drawn). */
    this.rigA = null; this.animator = null; this.rigR = null; this.onRigReady = null;
    /** Backpack sprites by look tier (rig level 0 → 0, 1-2 → 1, 3+ → 2). */
    this.packImgs = [1, 2, 3].map((n) => { const i = new Image(); i.src = `rig/wear/backpack/pack${n}.png`; return i; });
    /** Field camp tent and field charging station sprites (placeholder boxes until loaded). */
    this.propImgs = Object.fromEntries(['tent', 'charger'].map((n) => { const i = new Image(); i.src = `camp/${n}.png`; return [n, i]; }));
    loadRigAssets().then((a) => {
      if (!a) return;
      this.rigA = a;
      this.animator = new Animator(a.rig, a.clips);
      this.rigR = new RigRenderer(a.rig, a.items, a.images);
      d.player.outfit = sanitizeOutfit(d.player.outfit, a.items);
      this.onRigReady?.(a.items, d.player.outfit);
    });
  }

  /** Recompute backing store size for CSS size and devicePixelRatio. */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth; const cssH = window.innerHeight;
    this.dpr = dpr;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.scale = viewScale(this.canvas.height, CAMERA.ZOOM_LEVELS[this.zoomIndex ?? CAMERA.ZOOM_DEFAULT]);
    this.viewW = this.canvas.width / this.scale;
    this.viewH = this.canvas.height / this.scale;
    this.ctx.imageSmoothingEnabled = false;
    this.d.camera.viewW = this.viewW; this.d.camera.viewH = this.viewH;
    this.d.lighting.resize(this.viewW, this.viewH);
    this.d.postfx.resize(this.canvas.width, this.canvas.height);
  }

  /** Step the zoom level (+1 in, -1 out); returns the new multiplier. */
  zoomBy(step) {
    const n = CAMERA.ZOOM_LEVELS.length;
    this.zoomIndex = Math.max(0, Math.min(n - 1, (this.zoomIndex ?? CAMERA.ZOOM_DEFAULT) + step));
    this.resize();
    return CAMERA.ZOOM_LEVELS[this.zoomIndex];
  }

  /** @param {import('../world/World.js').World} world */
  setWorld(world) { this.d.world = world; this.fs.world = world; }

  /** CSS px → world px. */
  screenToWorldX(mx) { return this.camL + (mx * this.dpr) / this.scale; }
  screenToWorldY(my) { return this.camT + (my * this.dpr) / this.scale; }

  shockwave(x, y) {
    let k = 0; let m = Infinity;
    for (let i = 0; i < MAX_SHOCKWAVES; i++) if (this.shockT[i] < m) { m = this.shockT[i]; k = i; }
    this.shockX[k] = x; this.shockY[k] = y; this.shockT[k] = DYNAMITE.SHOCKWAVE_TIME;
  }

  /**
   * @param {number} alpha interpolation factor
   * @param {number} dt frame dt
   * @param {{aimX:number, aimY:number, depth:number, headlamp:number}} st
   */
  render(alpha, dt, st) {
    const { world, art, chunks, vis, mining, particles, background, lighting, postfx, camera, player } = this.d;
    const ctx = this.ctx;
    const s = this.scale;
    this.time += dt;
    for (let i = 0; i < MAX_SHOCKWAVES; i++) if (this.shockT[i] > 0) this.shockT[i] -= dt;
    art.drawCalls = 0;
    let calls = 0;

    const camL = Math.round(camera.left(alpha) * s) / s;
    const camT = Math.round(camera.top(alpha) * s) / s;
    this.camL = camL; this.camT = camT;
    const vw = this.viewW; const vh = this.viewH;
    const tx0 = Math.floor(camL / T); const ty0 = Math.floor(camT / T);
    const tx1 = Math.floor((camL + vw) / T); const ty1 = Math.floor((camT + vh) / T);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = RENDER.UNDERGROUND_BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, -camL * s, -camT * s);
    ctx.imageSmoothingEnabled = false;

    calls += background.draw(ctx, camL, camT, vw, vh);
    chunks.update(tx0, ty0, tx1, ty1);
    calls += chunks.draw(ctx, tx0, ty0, tx1, ty1);

    // Recoil redraw of the struck tile
    if (mining.recoilTile >= 0) {
      const i = mining.recoilTile;
      const x = i % world.W; const y = (i / world.W) | 0;
      const k = Math.sin((mining.recoilTimer / MINING.RECOIL_TIME) * Math.PI) * MINING.RECOIL_PX;
      const b = world.band[i] || TILE.SOIL;
      art.blit(ctx, art.back[b][0], x * T, y * T);
      art.drawSolid(ctx, world, i, x * T + Math.round(mining.recoilNX * k), y * T + Math.round(mining.recoilNY * k));
    }
    // Cracks
    for (let k = 0; k < mining.damagedCount; k++) {
      const i = mining.damaged[k];
      const x = i % world.W; const y = (i / world.W) | 0;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
      const stage = mining.stageOf(i);
      if (stage > 0) art.drawCrack(ctx, stage, x * T, y * T);
    }
    // Ore glints where the headlamp crosses valuable ore
    ctx.globalCompositeOperation = 'lighter';
    for (let y = Math.max(0, ty0); y <= Math.min(world.H - 1, ty1); y++) {
      for (let x = Math.max(0, tx0); x <= Math.min(world.W - 1, tx1); x++) {
        const i = y * world.W + x;
        const o = world.oreType[i];
        if (!o || !(this.devReveal || world.flags[i] & FLAG.DISCOVERED)) continue;
        const g = /** @type {any} */ (ORES[o]).glint;
        if (g <= 0) continue;
        const cx = x * T + T / 2; const cy = y * T + T / 2;
        if (!lighting.inCone(cx, cy)) continue;
        const h = hash2(x, y, 9);
        const a = g * Math.max(0, Math.sin(this.time * (2 + g * 4) + (h & 63)));
        if (a < 0.05) continue;
        ctx.globalAlpha = a;
        art.blit(ctx, art.sparkle, x * T + ((h >> 3) & 15) - 8, y * T + ((h >> 7) & 15) - 8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Hazards: fluid level + wavy surface, gas haze and bubbles, field charging stations
    const FM = HAZARD.FLUID.MAX;
    for (let y = Math.max(0, ty0); y <= Math.min(world.H - 1, ty1); y++) {
      for (let x = Math.max(0, tx0); x <= Math.min(world.W - 1, tx1); x++) {
        const i = y * world.W + x; const t = world.tileType[i];
        if ((t !== TILE.WATER && t !== TILE.MAGMA) || !(this.devReveal || world.flags[i] & FLAG.DISCOVERED)) continue;
        const L = world.fluid[i];
        if (y > 0 && world.tileType[i - world.W] === t) continue; // not the surface cell
        const empty = Math.round(T * (1 - Math.min(L, FM) / FM));
        if (empty > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(x * T, y * T, T, empty); ctx.clip();
          art.blit(ctx, art.back[world.band[i] || TILE.SOIL][hash2(x, y, world.seed) % art.V], x * T, y * T);
          ctx.restore();
        }
        ctx.fillStyle = t === TILE.WATER ? 'rgba(190,240,255,0.7)' : 'rgba(255,230,140,0.85)';
        for (let k = 0; k < 8; k++) ctx.fillRect(x * T + k * 4, y * T + empty + Math.round(Math.sin(this.time * 3 + k * 0.9 + x) * 1), 4, 2);
      }
    }
    for (let y = Math.max(0, ty0); y <= Math.min(world.H - 1, ty1); y++) {
      for (let x = Math.max(0, tx0); x <= Math.min(world.W - 1, tx1); x++) {
        const g = world.gas[y * world.W + x];
        if (!g || !(this.devReveal || world.flags[y * world.W + x] & FLAG.DISCOVERED)) continue;
        ctx.fillStyle = `rgba(120,230,70,${0.1 + g * 0.035 + 0.04 * Math.sin(this.time * 3 + x + y)})`;
        ctx.fillRect(x * T, y * T, T, T);
        ctx.fillStyle = 'rgba(200,255,150,0.55)';
        for (let b = 0; b < 2; b++) {
          const h = hash2(x * 3 + b, y, 5);
          ctx.fillRect(x * T + 3 + (h % (T - 6)), y * T + T - ((this.time * (10 + (h & 7)) + h) % T), 2, 2);
        }
      }
    }
    const tent = this.propImgs.tent; const charger = this.propImgs.charger;
    ctx.imageSmoothingEnabled = false;
    for (const c of this.d.economy.fieldCamps) {
      const x0 = c.x * T; const y1 = (c.y + 1) * T;
      if (tent.naturalWidth) { // 1.5 world px per art px, centred on the 4-tile camp
        const w = tent.naturalWidth * 1.5; const h = tent.naturalHeight * 1.5;
        ctx.drawImage(tent, Math.round(x0 + 2 * T - w / 2), y1 - h, w, h); continue;
      }
      ctx.fillStyle = '#5a4630'; ctx.fillRect(x0 + 6, y1 - 2 * T, 4 * T - 12, 2 * T);
      ctx.fillStyle = '#c8873a'; ctx.fillRect(x0 + 10, y1 - 2 * T - 8, 4 * T - 20, 10);
      ctx.fillStyle = `rgba(255,190,90,${0.5 + 0.2 * Math.sin(this.time * 3)})`; ctx.fillRect(x0 + 2 * T - 6, y1 - 18, 12, 12);
    }
    for (const s of this.d.economy.stations) {
      if (charger.naturalWidth) {
        const w = charger.naturalWidth * 1.5; const h = charger.naturalHeight * 1.5;
        ctx.drawImage(charger, Math.round((s.x + 0.5) * T - w / 2), (s.y + 1) * T - h, w, h); continue;
      }
      ctx.fillStyle = '#2b3a4a'; ctx.fillRect(s.x * T + 8, s.y * T + 10, T - 16, T - 10);
      ctx.fillStyle = `rgba(90,220,255,${0.6 + 0.3 * Math.sin(this.time * 4)})`; ctx.fillRect(s.x * T + 12, s.y * T + 14, T - 24, 6);
    }

    for (const s of this.d.economy.elevatorStops) { // placeholder lift marker
      ctx.fillStyle = '#3a4a5a'; ctx.fillRect(s.x * T + 2, (s.y - 1) * T, T - 4, 2 * T);
      ctx.fillStyle = `rgba(255,200,80,${0.6 + 0.3 * Math.sin(this.time * 4)})`; ctx.fillRect(s.x * T + 5, (s.y - 1) * T + 4, T - 10, 5);
    }

    // Entities
    calls += this._drawPickups(ctx, alpha);
    calls += this._drawDynamites(ctx, alpha);
    for (const f of this.d.fallingLadders.active) { this.d.art.drawLadder(ctx, f.x * T, Math.round(f.y)); calls += 2; }
    calls += this._drawPlayer(ctx, alpha, st, dt);
    calls += particles.draw(ctx, camL - 8, camT - 8, camL + vw + 8, camT + vh + 8, s, camL, camT);

    // Lighting
    const px = player.prevX + (player.x - player.prevX) * alpha + player.w / 2;
    const py = player.prevY + (player.y - player.prevY) * alpha + player.h * 0.3;
    const fs = this.fs;
    fs.camL = camL; fs.camT = camT; fs.viewW = vw; fs.viewH = vh;
    fs.tx0 = tx0; fs.ty0 = ty0; fs.tx1 = tx1; fs.ty1 = ty1;
    fs.playerX = px; fs.playerY = py; fs.aimAngle = Math.atan2(st.aimY - py, st.aimX - px);
    fs.headlamp = st.headlamp; fs.time = this.time;
    fs.canvasW = this.canvas.width; fs.canvasH = this.canvas.height;
    // Dev reveal: full-bright, no fog.
    if (!this.devReveal) { lighting.render(ctx, fs); calls += lighting.drawCalls; }

    // Animated tiles (magma core) glow: drawn after lighting so darkness never dims them.
    const core = MATERIALS[TILE.CORE].anim;
    if (!this.coreImg) { this.coreImg = new Image(); this.coreImg.src = core.src; }
    if (this.coreImg.complete && this.coreImg.naturalWidth) {
      ctx.setTransform(s, 0, 0, s, -camL * s, -camT * s);
      const fr = Math.floor(this.time * core.fps) % core.frames;
      for (let y = Math.max(0, ty0); y <= Math.min(world.H - 1, ty1); y++) {
        for (let x = Math.max(0, tx0); x <= Math.min(world.W - 1, tx1); x++) {
          if (world.tileType[y * world.W + x] !== TILE.CORE) continue;
          // Neighbouring tiles start on different frames so the field doesn't pulse in lockstep.
          const f = (fr + ((x * 7 + y * 3) % core.frames)) % core.frames;
          ctx.drawImage(this.coreImg, f * T, 0, T, T, x * T, y * T, T, T);
          calls++;
        }
      }
    }

    // Fog of war
    ctx.setTransform(s, 0, 0, s, -camL * s, -camT * s);
    // One fog texel per tile, upscaled with bilinear smoothing so darkness fades across tile edges.
    // Tiles outside the world count as fogged; a 1-tile margin keeps the screen edges correct.
    const fx0 = tx0 - 1; const fy0 = ty0 - 1; const fw = tx1 - tx0 + 3; const fh = ty1 - ty0 + 3;
    const fc = this.fogCanvas || (this.fogCanvas = document.createElement('canvas'));
    if (fc.width !== fw || fc.height !== fh) { fc.width = fw; fc.height = fh; this.fogImg = null; }
    const fctx = /** @type {CanvasRenderingContext2D} */ (fc.getContext('2d'));
    const img = this.fogImg || (this.fogImg = fctx.createImageData(fw, fh));
    const [fr, fg, fb] = hexToRgb(RENDER.FOG_COLOR);
    const px8 = img.data;
    for (let y = 0; y < fh; y++) {
      const wy = fy0 + y;
      for (let x = 0; x < fw; x++) {
        const wx = fx0 + x;
        const a = wx < 0 || wy < 0 || wx >= world.W || wy >= world.H ? 1 : this.devReveal ? 0 : 1 - vis.alpha[wy * world.W + wx];
        const o = (y * fw + x) * 4;
        px8[o] = fr; px8[o + 1] = fg; px8[o + 2] = fb; px8[o + 3] = a * 255;
      }
    }
    fctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fc, (fx0 + 0.5) * T, (fy0 + 0.5) * T, (fw - 1) * T, (fh - 1) * T);
    ctx.imageSmoothingEnabled = false;
    calls++;

    calls += this._drawRadarMarkers(ctx, tx0, ty0, tx1, ty1);
    calls += this._drawRings(ctx);
    this._drawHover(ctx);

    const ps = this.ps;
    ps.depth = st.depth; ps.time = this.time; ps.scale = s; ps.energyFrac = this.d.energy.frac;
    calls += postfx.render(ctx, this.canvas, ps);
    this.drawCalls = calls + art.drawCalls;
  }

  _drawPickups(ctx, alpha) {
    let calls = 0;
    for (const p of this.d.pickups.active) {
      const x = Math.round(p.prevX + (p.x - p.prevX) * alpha); const y = Math.round(p.prevY + (p.y - p.prevY) * alpha);
      const bob = Math.round(Math.sin(this.time * 4 + x) * 1);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1 + bob, PICKUPS.SIZE + 2, PICKUPS.SIZE + 2);
      ctx.fillStyle = this.oreFill[p.ore]; ctx.fillRect(x, y + bob, PICKUPS.SIZE, PICKUPS.SIZE);
      ctx.fillStyle = this.oreLight[p.ore]; ctx.fillRect(x + 2, y + 2 + bob, 3, 3);
      calls += 3;
    }
    return calls;
  }

  _drawDynamites(ctx, alpha) {
    let calls = 0;
    for (const d of this.d.dynamites.active) {
      const x = d.prevX + (d.x - d.prevX) * alpha + d.w / 2; const y = d.prevY + (d.y - d.prevY) * alpha + d.h / 2;
      const t = 1 - d.fuse / DYNAMITE.FUSE;
      const rate = DYNAMITE.FLASH_RATE_START + (DYNAMITE.FLASH_RATE_END - DYNAMITE.FLASH_RATE_START) * t;
      const flash = Math.sin(this.time * rate * Math.PI * 2) > 0.3;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(d.rot);
      ctx.fillStyle = flash ? '#ffffff' : '#c8281e';
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillStyle = '#7a1410'; ctx.fillRect(-5, 1, 10, 2);
      ctx.fillStyle = '#e8e2d0'; ctx.fillRect(4, -4, 2, 2);
      ctx.restore();
      calls += 3;
      if ((this.time * 30 | 0) % 2 === 0) this.d.particles.emit(x + 5, y - 4, (Math.random() - 0.5) * 30, -40, 0.25, 1.5, this.d.particles.cSparkHot, 2 | 4, 200);
    }
    return calls;
  }

  _drawPlayer(ctx, alpha, st, dt) {
    const p = this.d.player;
    const x = Math.round(p.prevX + (p.x - p.prevX) * alpha);
    const y = Math.round(p.prevY + (p.y - p.prevY) * alpha);
    const f = p.facing;
    const W = p.w;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(f > 0 ? x + dx : x + W - dx - w, y + dy, w, h); };
    const step = p.onGround && Math.abs(p.vx) > 10 ? Math.sin(p.walkPhase) : 0;
    if (this.rigR) return this._drawPlayerRig(ctx, p, x, y, W, st, dt, r);
    // jetpack
    r(-3, 9, 5, 11, '#6b7280'); r(-3, 9, 5, 2, '#9aa3b0'); r(-2, 20, 3, 3, '#3a3f48');
    const art = this._playerArt();
    if (art.ready()) {
      // 32x32 cells, feet on row 31; frame order matches assets/characters/player_base/player_base.json.
      // Body sheet has the head erased on look frames; the head is drawn separately, turned toward the mouse.
      const frame = this._playerFrame(p, st);
      const cx = Math.round(x + W / 2); const top = y + p.h - 31;
      ctx.save();
      ctx.translate(cx, top);
      if (f < 0) ctx.scale(-1, 1);
      // Sheet frames may be hi-res (e.g. 96px); they always fill a 32x32 world-px box.
      const F = art.meta.frame || 32; const u = 32 / F;
      ctx.drawImage(art.body, frame * F, 0, F, F, -16, 0, 32, 32);
      const neck = art.meta.neck[frame];
      if (neck) {
        const { cell, pivot, angles } = art.meta;
        const nx = neck[0] * u - 16; const ny = neck[1] * u;
        const dx = (st.aimX - (cx + f * nx)) * f; const dy = st.aimY - (top + ny);
        const lo = angles[0]; const hi = angles[angles.length - 1]; const step = angles[1] - lo;
        const deg = Math.max(lo, Math.min(hi, Math.atan2(dy, Math.max(dx, 4)) * 180 / Math.PI));
        const k = Math.round((deg - lo) / step);
        ctx.drawImage(art.head, k * cell, 0, cell, cell, nx - pivot[0] * u, ny - pivot[1] * u, cell * u, cell * u);
      }
      ctx.restore();
    } else this._drawPlayerBody(r, step);
    return this._drawPlayerTool(ctx, p, x, y, f, W, st, r) + 1;
  }

  /** Skeleton path: pose → overlays → offscreen 96px canvas → 32x32 world box. */
  _drawPlayerRig(ctx, p, x, y, W, st, dt, r) {
    const rig = this.rigA.rig; const f = p.facing;
    const cx = Math.round(x + W / 2); const top = y + p.h - 31;
    const aimDown = st.aimY - (p.y + p.h / 2) > Math.abs(st.aimX - (p.x + p.w / 2));
    const pose = this.animator.update(p, dt, { time: this.time, aimDown });
    const [mx, my] = toRigSpace(st.aimX, st.aimY, cx - 16, top, f);
    const w0 = solveWorld(rig, pose);
    const sh = rig.index.get('armF_upper');
    const mining = p.mineState === 1;
    const tool = this.d.economy.toolDef;
    const swing = mining ? swingOffset(p.swingPhase) * (tool ? 0.12 : 1) : 0; // power tools shake, they don't swing
    const angle = mining ? Math.atan2(my - w0.y[sh], mx - w0.x[sh]) + swing : idleGripAngle(rig, w0);
    const world = applyOverlays(rig, pose, { look: [mx, my], mining, pickAngle: angle, landVY: this.animator.landVY, squashT: this.animator.squashT });
    const color = this.d.economy.pickaxe.color;
    const rl = this.d.economy.levels.rig; const pack = this.packImgs[rl >= 3 ? 2 : rl >= 1 ? 1 : 0];
    const canvas = this.rigR.render(world, p.outfit, { sprite: this._playerArt().pickReady() && !(p.onLadder && Math.abs(p.vy) > 1 && !mining) ? this._toolSprite(color) : null, angle, color }, pack.complete && pack.naturalWidth ? pack : null);  // pick is stowed while climbing
    ctx.save();
    ctx.translate(cx, top);
    if (f < 0) ctx.scale(-1, 1);
    ctx.drawImage(canvas, -16 - RIG_PAD / 3, -RIG_PAD / 3, 32 + RIG_PAD * 2 / 3, 32 + RIG_PAD * 2 / 3);
    ctx.restore();
    if (p.jetting) r(-2, 23, 3, 2 + ((this.time * 40) | 0) % 3, '#ffb340');
    return 2;
  }

  /** Lazy-loaded player images (web/public/player, made by tools/split_head.py + tools/make_pickaxe.py). */
  _playerArt() {
    if (this.pArt) return this.pArt;
    const img = (src) => { const i = new Image(); i.src = `player/${src}`; return i; };
    const ok = (i) => i.complete && i.naturalWidth > 0;
    const a = {
      body: img('player_body.png'), head: img('player_head.png'),
      pick: img('pickaxe.png'), pickTint: img('pickaxe_tint.png'),
      meta: null, tinted: new Map(),
      ready: () => !!a.meta && ok(a.body) && ok(a.head),
      pickReady: () => ok(a.pick) && ok(a.pickTint),
    };
    fetch('player/player_head.json').then((res) => res.json()).then((m) => { a.meta = m; }).catch(() => {});
    this.pArt = a;
    return a;
  }

  /** Held sprite of the active tool: the tinted pickaxe, or the jackhammer / cone drill art. */
  _toolSprite(color) {
    const t = this.d.economy.tool;
    if (!t || t === 'pick') return this._pickSprite(color);
    const a = this._playerArt();
    if (!a[t]) { a[t] = new Image(); a[t].src = `player/${t}.png`; }
    return a[t].complete && a[t].naturalWidth ? a[t] : this._pickSprite(color);
  }

  /** Pickaxe sprite with its metal head multiplied by the material colour (cached per colour). */
  _pickSprite(color) {
    const a = this._playerArt();
    let c = a.tinted.get(color);
    if (c) return c;
    const w = a.pick.naturalWidth; const h = a.pick.naturalHeight;
    const metal = document.createElement('canvas'); metal.width = w; metal.height = h;
    const m = /** @type {CanvasRenderingContext2D} */ (metal.getContext('2d'));
    m.drawImage(a.pickTint, 0, 0);
    m.globalCompositeOperation = 'multiply'; m.fillStyle = color; m.fillRect(0, 0, w, h);
    m.globalCompositeOperation = 'destination-in'; m.drawImage(a.pickTint, 0, 0);
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.drawImage(a.pick, 0, 0); g.drawImage(metal, 0, 0);
    a.tinted.set(color, c);
    return c;
  }

  /** Sheet frame index for the player's current state. */
  _playerFrame(p, st) {
    const cyc = (from, n, t) => from + (Math.floor(t) % n + n) % n;
    if (p.hurtTimer > 0) return cyc(20, 2, (0.3 - p.hurtTimer) * 10);
    if (p.onLadder && !p.onGround) return cyc(18, 2, Math.abs(p.vy) > 1 ? this.time * 5 : 0);
    if (p.mineState === 1) {
      const down = st.aimY - (p.y + p.h / 2) > Math.abs(st.aimX - (p.x + p.w / 2));
      return (down ? 10 : 6) + Math.min(3, Math.floor(p.swingPhase * 4));
    }
    if (!p.onGround) return p.vy < -40 ? 15 : p.vy < 40 ? 16 : 17;
    if (Math.abs(p.vx) > 10) return cyc(2, 4, p.walkPhase * 2 / Math.PI);
    return cyc(0, 2, this.time * 2.5);
  }

  /** Old code-drawn body, used until the sprite sheet loads. */
  _drawPlayerBody(r, step) {
    // legs
    r(4, 20 - Math.max(0, step) * 2, 4, 8, '#2d3340'); r(10, 20 - Math.max(0, -step) * 2, 4, 8, '#2d3340');
    r(3, 26, 5, 2, '#1a1d24'); r(10, 26, 5, 2, '#1a1d24');
    // body
    r(3, 10, 12, 11, '#d0662a'); r(5, 12, 8, 1, '#f2c14e'); r(3, 18, 12, 2, '#3b2a1a'); r(13, 11, 2, 7, '#a64f1f');
    // head + helmet
    r(5, 4, 9, 7, '#e9c9a6');
    r(4, 0, 11, 5, '#e8e2d0'); r(3, 4, 13, 1, '#cfc7b0');
    r(10, 5, 5, 3, '#1f6f80'); r(11, 5, 2, 1, '#8fe3f0');
    r(13, 1, 3, 3, '#fff3a0');
  }

  _drawPlayerTool(ctx, p, x, y, f, W, st, r) {
    const pick = this.d.economy.pickaxe;
    // pickaxe
    const hx = x + W / 2 + f * 5; const hy = y + 14;
    const aim = Math.atan2(st.aimY - hy, st.aimX - hx);
    const swing = p.mineState === 1 ? swingOffset(p.swingPhase) * f : 0;
    const idle = f > 0 ? 0.9 : Math.PI - 0.9;
    const ang = p.mineState === 1 ? aim + swing : idle;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    if (this._playerArt().pickReady()) { // 3x sprite (tools/make_pickaxe.py), grip at (0, 22.5)
      const s = this._pickSprite(pick.color);
      ctx.drawImage(s, -1, -7.5, s.width / 3, s.height / 3);
    }
    else {
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, -1, 14, 2);
      ctx.fillStyle = pick.color; ctx.fillRect(12, -6, 3, 12);
    }
    ctx.fillStyle = '#e9c9a6'; ctx.fillRect(-1, -2, 3, 4);
    ctx.restore();
    // jet flame
    if (p.jetting) { r(-2, 23, 3, 2 + ((this.time * 40) | 0) % 3, '#ffb340'); }
    return 24;
  }

  _drawRadarMarkers(ctx, tx0, ty0, tx1, ty1) {
    const { vis, world, economy } = this.d;
    let calls = 0;
    const tier = economy.pickTier;
    for (let k = 0; k < vis.radarCount; k++) {
      const i = vis.radarList[k];
      if (!(world.flags[i] & FLAG.RADAR_LIT)) continue;
      const x = i % world.W; const y = (i / world.W) | 0;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
      const o = world.oreType[i];
      if (!o) continue;
      const locked = tier < requiredTier(world.tileType[i], o);
      const cx = x * T + T / 2; const cy = y * T + T / 2;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 5 + i);
      ctx.globalAlpha = (locked ? 0.45 : 0.95) * pulse;
      ctx.fillStyle = this.oreLight[o];
      ctx.fillRect(cx - 3, cy - 1, 6, 2); ctx.fillRect(cx - 1, cy - 3, 2, 6);
      calls += 2;
      if (locked) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#c9ccd4';
        ctx.fillRect(cx + 4, cy - 9, 7, 5);
        ctx.fillRect(cx + 5, cy - 12, 1, 3); ctx.fillRect(cx + 9, cy - 12, 1, 3); ctx.fillRect(cx + 5, cy - 12, 5, 1);
        ctx.fillStyle = '#20232a'; ctx.fillRect(cx + 7, cy - 8, 1, 2);
        calls += 5;
      }
    }
    ctx.globalAlpha = 1;
    return calls;
  }

  _drawRings(ctx) {
    const l = this.d.lighting;
    let calls = 0;
    if (l.radarActive) {
      ctx.globalAlpha = 0.7 * (1 - l.radarR / l.radarMax);
      ctx.strokeStyle = '#3ff0ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(l.radarX, l.radarY, l.radarR, 0, Math.PI * 2); ctx.stroke();
      calls++;
    }
    for (let k = 0; k < MAX_SHOCKWAVES; k++) {
      if (this.shockT[k] <= 0) continue;
      const t = 1 - this.shockT[k] / DYNAMITE.SHOCKWAVE_TIME;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = '#ffe2b0';
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(this.shockX[k], this.shockY[k], DYNAMITE.SHOCKWAVE_RADIUS * t, 0, Math.PI * 2); ctx.stroke();
      calls++;
    }
    ctx.globalAlpha = 1;
    return calls;
  }

  _drawHover(ctx) {
    const i = this.hoverTile;
    if (i < 0) return;
    const w = this.d.world;
    if (!(w.flags[i] & FLAG.SOLID) || !(w.flags[i] & FLAG.DISCOVERED)) return;
    const x = i % w.W; const y = (i / w.W) | 0;
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 6);
    ctx.strokeStyle = this.hoverMineable ? '#9ff4ff' : '#ff6a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
    ctx.globalAlpha = 1;
  }
}
