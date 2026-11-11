/**
 * @module render/Lighting
 * Low-resolution light buffer: warm player light, occluded headlamp cone (DDA ray-march over
 * the tile grid), ore/fungi/magma emissives, beacons, explosion flashes and the radar wave.
 * Composited with `multiply`; emissives also go to a bloom buffer composited with `lighter`.
 */
import { LIGHTING, WORLD, FLAG, ORES, TILE } from '../config.js';
import { createCanvas, get2D, makeRadialSprite, rgbStr } from './canvas.js';
import { hash2 } from '../core/RNG.js';
import { P_GLOW } from './Particles.js';

const MAX_FLASHES = 8;
const MAX_RAYS = 256;

export class Lighting {
  constructor() {
    this.scale = 0.5;
    this.bloom = true;
    this.rays = 96;
    this.reducedFlashing = false;
    this.lw = 1; this.lh = 1;
    this.canvas = createCanvas(1, 1);
    this.ctx = get2D(this.canvas);
    this.emCanvas = createCanvas(1, 1);
    this.emCtx = get2D(this.emCanvas);
    this.bloomCanvas = createCanvas(1, 1);
    this.bloomCtx = get2D(this.bloomCanvas);
    /** @type {Map<string, any>} */
    this.sprites = new Map();
    this.coneSprite = makeRadialSprite(LIGHTING.CONE_COLOR, LIGHTING.SPRITE_SIZE * 2, 0.15);
    this.playerSprite = this.sprite(LIGHTING.PLAYER_COLOR);
    this.ambient = [];
    for (let k = 0; k < LIGHTING.AMBIENT_STEPS; k++) {
      const t = k / (LIGHTING.AMBIENT_STEPS - 1);
      const a = LIGHTING.AMBIENT_SURFACE; const b = LIGHTING.AMBIENT_DEEP;
      this.ambient.push(rgbStr(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t));
    }
    this.pts = new Float32Array((MAX_RAYS + 1) * 2);
    this.rayDist = new Float32Array(MAX_RAYS);
    this.coneStart = 0; this.coneStep = 0; this.coneCount = 0;
    this.coneOX = 0; this.coneOY = 0;
    this.flashX = new Float32Array(MAX_FLASHES); this.flashY = new Float32Array(MAX_FLASHES); this.flashT = new Float32Array(MAX_FLASHES);
    this.radarX = 0; this.radarY = 0; this.radarR = 0; this.radarMax = 0; this.radarActive = false;
    this.drawCalls = 0;
  }

  /** Cached radial sprite per colour. */
  sprite(color) {
    let s = this.sprites.get(color);
    if (!s) { s = makeRadialSprite(color, LIGHTING.SPRITE_SIZE); this.sprites.set(color, s); }
    return s;
  }

  /** @param {{lightScale:number, bloom:boolean, rays:number}} q */
  setQuality(q) {
    this.scale = q.lightScale; this.bloom = q.bloom; this.rays = Math.min(MAX_RAYS, q.rays);
    this.resize(this.viewW || 960, this.viewH || 540);
  }

  /** @param {number} viewW @param {number} viewH world px */
  resize(viewW, viewH) {
    this.viewW = viewW; this.viewH = viewH;
    this.lw = Math.max(1, Math.ceil(viewW * this.scale));
    this.lh = Math.max(1, Math.ceil(viewH * this.scale));
    for (const c of [this.canvas, this.emCanvas]) { c.width = this.lw; c.height = this.lh; }
    this.bloomCanvas.width = Math.max(1, Math.ceil(this.lw / LIGHTING.BLOOM_DOWNSCALE));
    this.bloomCanvas.height = Math.max(1, Math.ceil(this.lh / LIGHTING.BLOOM_DOWNSCALE));
    this.ctx.imageSmoothingEnabled = true;
    this.emCtx.imageSmoothingEnabled = true;
    this.bloomCtx.imageSmoothingEnabled = true;
  }

  flash(x, y) {
    let k = 0; let oldest = Infinity;
    for (let i = 0; i < MAX_FLASHES; i++) if (this.flashT[i] < oldest) { oldest = this.flashT[i]; k = i; }
    this.flashX[k] = x; this.flashY[k] = y; this.flashT[k] = LIGHTING.EXPLOSION_TIME;
  }

  radarStart(x, y, maxR) { this.radarX = x; this.radarY = y; this.radarR = 0; this.radarMax = maxR; this.radarActive = true; }

  update(dt, ringSpeed) {
    for (let i = 0; i < MAX_FLASHES; i++) if (this.flashT[i] > 0) this.flashT[i] -= dt;
    if (this.radarActive) { this.radarR += ringSpeed * dt; if (this.radarR > this.radarMax) this.radarActive = false; }
  }

  /** Is world point inside the last computed (occluded) headlamp cone? */
  inCone(x, y) {
    if (this.coneCount === 0) return false;
    const dx = x - this.coneOX; const dy = y - this.coneOY;
    let a = Math.atan2(dy, dx) - this.coneStart;
    while (a < -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    const k = Math.round(a / this.coneStep);
    if (k < 0 || k >= this.coneCount) return false;
    return dx * dx + dy * dy <= this.rayDist[k] * this.rayDist[k];
  }

  _glow(spr, x, y, r, alpha, toEmissive) {
    const l = this.ctx;
    l.globalAlpha = alpha;
    l.drawImage(spr, x - r, y - r, r * 2, r * 2);
    this.drawCalls++;
    if (toEmissive) {
      const e = this.emCtx;
      e.globalAlpha = alpha;
      e.drawImage(spr, x - r, y - r, r * 2, r * 2);
      this.drawCalls++;
    }
  }

  /**
   * Render the light buffer and composite it onto the main canvas.
   * @param {CanvasRenderingContext2D} main
   * @param {any} s frame state
   */
  render(main, s) {
    this.drawCalls = 0;
    const l = this.ctx; const e = this.emCtx;
    const ls = this.scale;
    const T = WORLD.TILE_PX;
    const w = s.world;
    // Ambient
    const rowsBelow = s.playerY / T - WORLD.SURFACE_ROWS;
    const at = Math.max(0, Math.min(1, rowsBelow / LIGHTING.AMBIENT_FADE_ROWS));
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.globalAlpha = 1;
    l.fillStyle = this.ambient[Math.round(at * (LIGHTING.AMBIENT_STEPS - 1))];
    l.fillRect(0, 0, this.lw, this.lh);
    e.setTransform(1, 0, 0, 1, 0, 0);
    e.globalCompositeOperation = 'source-over';
    e.clearRect(0, 0, this.lw, this.lh);
    l.setTransform(ls, 0, 0, ls, -s.camL * ls, -s.camT * ls);
    e.setTransform(ls, 0, 0, ls, -s.camL * ls, -s.camT * ls);
    l.globalCompositeOperation = 'lighter';
    e.globalCompositeOperation = 'lighter';

    const flicker = 1 - LIGHTING.FLICKER * (0.5 + 0.5 * Math.sin(s.time * LIGHTING.FLICKER_FREQ) * Math.sin(s.time * 7.3));
    // Player radial
    this._glow(this.playerSprite, s.playerX, s.playerY, LIGHTING.PLAYER_RADIUS, LIGHTING.PLAYER_INTENSITY * flicker, false);

    // Headlamp cone with occlusion
    const range = s.headlamp;
    const half = LIGHTING.CONE_HALF_ANGLE;
    const n = this.rays;
    const start = s.aimAngle - half;
    const step = (half * 2) / (n - 1);
    const ox = s.playerX; const oy = s.playerY;
    this.coneStart = start; this.coneStep = step; this.coneCount = n; this.coneOX = ox; this.coneOY = oy;
    const pts = this.pts;
    for (let k = 0; k < n; k++) {
      const a = start + k * step;
      const dx = Math.cos(a); const dy = Math.sin(a);
      const d = Math.min(range, w.raycast(ox, oy, dx, dy, range) + LIGHTING.CONE_WALL_BLEED);
      this.rayDist[k] = d;
      pts[k * 2] = ox + dx * d; pts[k * 2 + 1] = oy + dy * d;
    }
    const innerFrom = Math.floor(n * (1 - LIGHTING.CONE_INNER_FRAC) / 2);
    const innerTo = n - 1 - innerFrom;
    for (let pass = 0; pass < 2; pass++) {
      const k0 = pass === 0 ? 0 : innerFrom;
      const k1 = pass === 0 ? n - 1 : innerTo;
      l.save();
      l.beginPath();
      l.moveTo(ox, oy);
      for (let k = k0; k <= k1; k++) l.lineTo(pts[k * 2], pts[k * 2 + 1]);
      l.closePath();
      l.clip();
      l.globalAlpha = (pass === 0 ? LIGHTING.CONE_OUTER_ALPHA : 1 - LIGHTING.CONE_OUTER_ALPHA) * flicker;
      l.drawImage(this.coneSprite, ox - range, oy - range, range * 2, range * 2);
      l.restore();
      this.drawCalls++;
    }

    // Tile emissives
    const pulse = s.time;
    for (let ty = s.ty0; ty <= s.ty1; ty++) {
      if (ty < 0 || ty >= w.H) continue;
      for (let tx = s.tx0; tx <= s.tx1; tx++) {
        if (tx < 0 || tx >= w.W) continue;
        const i = ty * w.W + tx;
        const f = w.flags[i];
        const lit = (f & FLAG.DISCOVERED) !== 0;
        const radar = (f & FLAG.RADAR_LIT) !== 0;
        if (!lit && !radar) continue;
        const cx = tx * T + T / 2; const cy = ty * T + T / 2;
        const o = w.oreType[i];
        if (o) {
          const ore = /** @type {any} */ (ORES[o]);
          if (ore.glow) {
            const h = (hash2(tx, ty, 1) & 255) / 40;
            const a = (0.2 + 0.6 * ore.glint) * (0.6 + 0.4 * Math.sin(pulse * 2 + h)) * (radar && !lit ? 1.2 : 1);
            this._glow(this.sprite(ore.glow), cx, cy, LIGHTING.ORE_GLOW_RADIUS * (0.8 + ore.glint * 0.5), a, true);
          }
        }
        if (f & FLAG.FUNGI) this._glow(this.sprite(LIGHTING.FUNGI_COLOR), cx, cy - 8, LIGHTING.FUNGI_RADIUS, 0.55 + 0.15 * Math.sin(pulse * 1.5 + tx), true);
        if (w.tileType[i] === TILE.MAGMA) {
          const a = 0.55 + 0.25 * Math.sin(pulse * LIGHTING.MAGMA_PULSE + tx * 0.7 + ty * 0.3);
          this._glow(this.sprite(LIGHTING.MAGMA_COLOR), cx, cy, LIGHTING.MAGMA_RADIUS, a, true);
        }
      }
    }

    // Beacons
    if (s.beacons) for (const b of s.beacons) this._glow(this.sprite(b.color), b.x, b.y, LIGHTING.BEACON_RADIUS, 0.8 * b.on, true);

    // Glow particles
    const p = s.particles;
    let glowN = 0;
    for (let i = 0; i < p.count && glowN < LIGHTING.MAX_GLOW_PARTICLES; i++) {
      if (!(p.flags[i] & P_GLOW)) continue;
      const x = p.x[i]; const y = p.y[i];
      if (x < s.camL || x > s.camL + s.viewW || y < s.camT || y > s.camT + s.viewH) continue;
      glowN++;
      this._glow(this.sprite(p.colors[p.color[i]]), x, y, LIGHTING.GLOW_PARTICLE_RADIUS, 0.45 * (p.life[i] / p.maxLife[i]), true);
    }

    // Explosion flashes
    const flashMul = this.reducedFlashing ? 0.3 : 1;
    for (let k = 0; k < MAX_FLASHES; k++) {
      if (this.flashT[k] <= 0) continue;
      const t = this.flashT[k] / LIGHTING.EXPLOSION_TIME;
      this._glow(this.sprite(LIGHTING.EXPLOSION_COLOR), this.flashX[k], this.flashY[k], LIGHTING.EXPLOSION_RADIUS * (1.2 - t * 0.4), t * flashMul, true);
    }

    // Radar wave
    if (this.radarActive) {
      const t = 1 - this.radarR / this.radarMax;
      l.globalAlpha = 0.6 * t;
      l.strokeStyle = LIGHTING.RADAR_COLOR;
      l.lineWidth = 10;
      l.beginPath();
      l.arc(this.radarX, this.radarY, this.radarR, 0, Math.PI * 2);
      l.stroke();
      this.drawCalls++;
    }

    l.globalAlpha = 1; e.globalAlpha = 1;
    l.globalCompositeOperation = 'source-over'; e.globalCompositeOperation = 'source-over';

    // Composite onto main
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.imageSmoothingEnabled = true;
    main.globalCompositeOperation = 'multiply';
    main.drawImage(/** @type {any} */ (this.canvas), 0, 0, this.lw, this.lh, 0, 0, s.canvasW, s.canvasH);
    this.drawCalls++;
    main.globalCompositeOperation = 'lighter';
    if (this.bloom) {
      const b = this.bloomCtx;
      b.globalCompositeOperation = 'copy';
      b.drawImage(/** @type {any} */ (this.emCanvas), 0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
      main.globalAlpha = LIGHTING.BLOOM_ALPHA;
      main.drawImage(/** @type {any} */ (this.bloomCanvas), 0, 0, this.bloomCanvas.width, this.bloomCanvas.height, 0, 0, s.canvasW, s.canvasH);
      this.drawCalls += 2;
    } else {
      main.globalAlpha = 0.35;
      main.drawImage(/** @type {any} */ (this.emCanvas), 0, 0, this.lw, this.lh, 0, 0, s.canvasW, s.canvasH);
      this.drawCalls++;
    }
    main.globalAlpha = 1;
    main.globalCompositeOperation = 'source-over';
    main.imageSmoothingEnabled = false;
  }
}

