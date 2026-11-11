/**
 * @module render/Renderer
 * Frame orchestration. Layer order:
 * background → tiles (chunks) → crack overlays → ore glints → entities → particles →
 * lighting composite → bloom → fog of war → radar markers → PostFX → (DOM HUD).
 */
import { WORLD, CAMERA, RENDER, ORES, FLAG, TILE, DYNAMITE, ENERGY, PICKUPS, MINING } from '../config.js';
import { hash2 } from '../core/RNG.js';
import { requiredTier } from '../systems/Mining.js';

const T = WORLD.TILE_PX;
const MAX_SHOCKWAVES = 8;

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {any} d dependencies {world, art, chunks, vis, mining, particles, background, lighting, postfx, camera, player, dynamites, pickups, economy, energy}
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
    this.scale = Math.max(1, Math.round(this.canvas.height / CAMERA.VIEW_HEIGHT_TARGET));
    this.viewW = this.canvas.width / this.scale;
    this.viewH = this.canvas.height / this.scale;
    this.ctx.imageSmoothingEnabled = false;
    this.d.camera.viewW = this.viewW; this.d.camera.viewH = this.viewH;
    this.d.lighting.resize(this.viewW, this.viewH);
    this.d.postfx.resize(this.canvas.width, this.canvas.height);
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
        if (!o || !(world.flags[i] & FLAG.DISCOVERED)) continue;
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

    // Entities
    calls += this._drawPickups(ctx, alpha);
    calls += this._drawDynamites(ctx, alpha);
    calls += this._drawPlayer(ctx, alpha, st);
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
    lighting.render(ctx, fs);
    calls += lighting.drawCalls;

    // Fog of war
    ctx.setTransform(s, 0, 0, s, -camL * s, -camT * s);
    ctx.fillStyle = RENDER.FOG_COLOR;
    ctx.beginPath();
    let partial = false;
    for (let y = Math.max(0, ty0); y <= Math.min(world.H - 1, ty1); y++) {
      for (let x = Math.max(0, tx0); x <= Math.min(world.W - 1, tx1); x++) {
        const a = vis.alpha[y * world.W + x];
        if (a <= 0) ctx.rect(x * T, y * T, T, T);
        else if (a < 1) partial = true;
      }
    }
    ctx.fill();
    calls++;
    if (partial) {
      for (let y = Math.max(0, ty0); y <= Math.min(world.H - 1, ty1); y++) {
        for (let x = Math.max(0, tx0); x <= Math.min(world.W - 1, tx1); x++) {
          const a = vis.alpha[y * world.W + x];
          if (a > 0 && a < 1) { ctx.globalAlpha = 1 - a; ctx.fillRect(x * T, y * T, T, T); calls++; }
        }
      }
      ctx.globalAlpha = 1;
    }

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

  _drawPlayer(ctx, alpha, st) {
    const p = this.d.player;
    const pick = this.d.economy.pickaxe;
    const x = Math.round(p.prevX + (p.x - p.prevX) * alpha);
    const y = Math.round(p.prevY + (p.y - p.prevY) * alpha);
    const f = p.facing;
    const W = p.w;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(f > 0 ? x + dx : x + W - dx - w, y + dy, w, h); };
    const step = p.onGround && Math.abs(p.vx) > 10 ? Math.sin(p.walkPhase) : 0;
    // jetpack
    r(-3, 9, 5, 11, '#6b7280'); r(-3, 9, 5, 2, '#9aa3b0'); r(-2, 20, 3, 3, '#3a3f48');
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
    // pickaxe
    const hx = x + W / 2 + f * 5; const hy = y + 14;
    const aim = Math.atan2(st.aimY - hy, st.aimX - hx);
    const swing = p.mineState === 1 ? (-1.5 + Math.pow(p.swingPhase, 2.2) * 2.1) * f : 0;
    const idle = f > 0 ? 0.9 : Math.PI - 0.9;
    const ang = p.mineState === 1 ? aim + swing : idle;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, -1, 14, 2);
    ctx.fillStyle = pick.color; ctx.fillRect(12, -6, 3, 12);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.4; ctx.fillRect(12, -6, 1, 12); ctx.globalAlpha = 1;
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
