/**
 * @module render/Particles
 * Struct-of-arrays particle system in Float32Arrays with a hard cap and swap-remove.
 * Drawn in two passes grouped by blend mode (normal, then additive).
 */
import { PARTICLES, MATERIALS, ORES, TILE, ORE, WORLD } from '../config.js';

export const P_BOUNCE = 1;
export const P_GLOW = 2;     // additive + feeds the light buffer
export const P_FADE = 4;
export const P_SHRINK = 8;
export const P_ROT = 16;
export const P_NOGRAV = 32;

/** Sprite kinds (rows of fx/particles.png, 6 cells of 16px each). 0 = plain square. */
export const S_DUST = 1;   // animated puff, frame from life, tinted
export const S_SPARK = 2;  // pre-coloured glint, random variant
export const S_CHIP = 3;   // rock chip, random variant, tinted
const FX_CELL = 16;
const FX_DRAW = [0, 2.4, 4.5, 3.4]; // drawn size = particle size * this

export class Particles {
  /** @param {number} [cap] */
  constructor(cap = PARTICLES.DEFAULT_CAP) {
    this.max = PARTICLES.DEFAULT_CAP;
    this.cap = Math.min(cap, this.max);
    const n = this.max;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.life = new Float32Array(n); this.maxLife = new Float32Array(n);
    this.size = new Float32Array(n); this.rot = new Float32Array(n); this.vr = new Float32Array(n);
    this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    this.flags = new Uint8Array(n);
    this.color = new Uint16Array(n);
    this.spr = new Uint8Array(n); this.sv = new Uint8Array(n);
    /** @type {HTMLImageElement|null} */
    this.sheet = null;
    /** @type {Map<number, HTMLCanvasElement>} tinted copies of the sheet per colour index */
    this.tinted = new Map();
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => { this.sheet = img; };
      img.src = 'fx/particles.png';
    }
    this.count = 0;
    /** @type {string[]} */
    this.colors = [];
    /** @type {Map<string, number>} */
    this.colorIdx = new Map();
    /** @type {import('../world/World.js').World|null} */
    this.world = null;
    this.rng = Math.random;
  }

  /** Register (or look up) a CSS colour; returns its index. Call at init, not per frame. */
  color_(css) {
    let i = this.colorIdx.get(css);
    if (i === undefined) { i = this.colors.length; this.colors.push(css); this.colorIdx.set(css, i); }
    return i;
  }

  /** Pre-register palette colours so hot paths never allocate. */
  init() {
    for (const m of MATERIALS) if (m.colors) { this.color_(m.colors.base); this.color_(m.colors.dark); this.color_(m.colors.light); this.color_(m.colors.accent); this.color_(m.colors.extra); }
    for (const o of ORES) if (o) { this.color_(o.colors.base); this.color_(o.colors.light); this.color_(o.colors.spec); }
    this.cWhite = this.color_('#ffffff');
    this.cSpark = this.color_('#ffd27a');
    this.cSparkHot = this.color_('#fff3c4');
    this.cEmber = this.color_('#ff6a1f');
    this.cEmberHot = this.color_('#ffb340');
    this.cDust = this.color_('#d8c8b0');
    this.cWater = this.color_('#7fc8ff');
    this.cCyan = this.color_('#3ff0ff');
    this.cBlue = this.color_('#5aa8ff');
    this.cSmoke = this.color_('#3a3530');
    this.cFlame = this.color_('#ff9a3a');
    this.cPollen = this.color_('#f3e2a0');
    this.matColor = MATERIALS.map((m) => (m.colors ? [this.color_(m.colors.base), this.color_(m.colors.dark), this.color_(m.colors.light)] : [this.cDust, this.cDust, this.cDust]));
    this.oreColor = ORES.map((o) => (o ? [this.color_(o.colors.base), this.color_(o.colors.light)] : [this.cWhite, this.cWhite]));
  }

  setCap(cap) { this.cap = Math.min(this.max, cap); if (this.count > this.cap) this.count = this.cap; }

  /**
   * Spawn one particle. Silently dropped when at cap.
   * @returns {number} index or -1
   */
  emit(x, y, vx, vy, life, size, color, flags, grav = PARTICLES.GRAVITY, drag = 0) {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
    this.rot[i] = 0; this.vr[i] = (flags & P_ROT) ? (this.rng() - 0.5) * 14 : 0;
    this.grav[i] = (flags & P_NOGRAV) ? 0 : grav; this.drag[i] = drag;
    this.flags[i] = flags; this.color[i] = color; this.spr[i] = 0;
    return i;
  }

  /** Give particle i a sprite (no-op for -1). */
  _s(i, kind) { if (i >= 0) { this.spr[i] = kind; this.sv[i] = (this.rng() * 6) | 0; } }

  /** Sheet tinted by colour c (multiply), cached. */
  _tint(c) {
    let t = this.tinted.get(c);
    if (t) return t;
    const sh = /** @type {HTMLImageElement} */ (this.sheet);
    t = document.createElement('canvas'); t.width = sh.width; t.height = sh.height;
    const x = /** @type {CanvasRenderingContext2D} */ (t.getContext('2d'));
    x.drawImage(sh, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = this.colors[c]; x.fillRect(0, 0, t.width, t.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(sh, 0, 0);
    this.tinted.set(c, t);
    return t;
  }

  /** @param {number} dt */
  update(dt) {
    const w = this.world;
    const T = WORLD.TILE_PX;
    for (let i = this.count - 1; i >= 0; i--) {
      const l = this.life[i] - dt;
      if (l <= 0) { this._kill(i); continue; }
      this.life[i] = l;
      let vx = this.vx[i]; let vy = this.vy[i] + this.grav[i] * dt;
      const dr = this.drag[i];
      if (dr > 0) { const k = Math.max(0, 1 - dr * dt); vx *= k; vy *= k; }
      let nx = this.x[i] + vx * dt;
      let ny = this.y[i] + vy * dt;
      if ((this.flags[i] & P_BOUNCE) && w) {
        if (w.isSolid(Math.floor(nx / T), Math.floor(this.y[i] / T))) { vx = -vx * 0.4; nx = this.x[i]; }
        if (w.isSolid(Math.floor(nx / T), Math.floor(ny / T))) {
          vy = -vy * 0.35; vx *= 0.7; ny = this.y[i];
          this.vr[i] *= 0.6;
          if (Math.abs(vy) < 25) vy = 0;
        }
      }
      this.x[i] = nx; this.y[i] = ny; this.vx[i] = vx; this.vy[i] = vy;
      this.rot[i] += this.vr[i] * dt;
    }
  }

  _kill(i) {
    const j = --this.count;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.size[i] = this.size[j];
    this.rot[i] = this.rot[j]; this.vr[i] = this.vr[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
    this.flags[i] = this.flags[j]; this.color[i] = this.color[j]; this.spr[i] = this.spr[j]; this.sv[i] = this.sv[j];
  }

  /**
   * Draw both blend groups (ctx in world transform). View rect culls off-screen particles.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} scale device px per world px (for rotated quads)
   * @returns {number} draw calls
   */
  draw(ctx, vx0, vy0, vx1, vy1, scale, camL, camT) {
    let calls = 0;
    for (let pass = 0; pass < 2; pass++) {
      const additive = pass === 1;
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      let lastColor = -1;
      for (let i = 0; i < this.count; i++) {
        const f = this.flags[i];
        if (((f & P_GLOW) !== 0) !== additive) continue;
        const x = this.x[i]; const y = this.y[i];
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        const t = this.life[i] / this.maxLife[i];
        let s = this.size[i];
        if (f & P_SHRINK) s *= t;
        if (s < 0.4) continue;
        ctx.globalAlpha = (f & P_FADE) ? (this.spr[i] === S_DUST ? Math.min(1, t * 1.8) : t) : 1;
        const c = this.color[i];
        const k = this.spr[i];
        if (k && this.sheet) {
          const src = k === S_SPARK ? this.sheet : this._tint(c);
          const col = k === S_DUST ? Math.min(5, ((1 - t) * 6) | 0) : this.sv[i];
          const d = this.size[i] * FX_DRAW[k] * (k === S_DUST ? 1 : (f & P_SHRINK ? t : 1));
          const sx = col * FX_CELL; const sy = (k - 1) * FX_CELL;
          if (f & P_ROT) {
            const r = this.rot[i]; const co = Math.cos(r) * scale; const si = Math.sin(r) * scale;
            ctx.setTransform(co, si, -si, co, (x - camL) * scale, (y - camT) * scale);
            ctx.drawImage(src, sx, sy, FX_CELL, FX_CELL, -d / 2, -d / 2, d, d);
            ctx.setTransform(scale, 0, 0, scale, -camL * scale, -camT * scale);
          } else {
            ctx.drawImage(src, sx, sy, FX_CELL, FX_CELL, Math.round(x - d / 2), Math.round(y - d / 2), d, d);
          }
          calls++;
          continue;
        }
        if (c !== lastColor) { ctx.fillStyle = this.colors[c]; lastColor = c; }
        if (f & P_ROT) {
          const r = this.rot[i]; const co = Math.cos(r) * scale; const si = Math.sin(r) * scale;
          ctx.setTransform(co, si, -si, co, (x - camL) * scale, (y - camT) * scale);
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.setTransform(scale, 0, 0, scale, -camL * scale, -camT * scale);
        } else {
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
        calls++;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return calls;
  }

  // ---------- Presets ----------

  /** Directional sparks or dust at an impact. */
  impact(x, y, nx, ny, type, gated) {
    const r = this.rng;
    const base = Math.atan2(ny, nx);
    const cols = this.matColor[type];
    const rock = gated || type !== TILE.SOIL;
    // Dust cloud: slow, drifting puff in the material's colours (soil gets a thick one, rock a thin one).
    const puffs = rock ? 4 : 12;
    for (let k = 0; k < puffs; k++) {
      const a = base + (r() - 0.5) * 2.2; const sp = 15 + r() * 45;
      this._s(this.emit(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, Math.cos(a) * sp, Math.sin(a) * sp - 10, 0.6 + r() * 0.6, 3 + r() * 4, r() < 0.5 ? this.cDust : cols[2], P_FADE, -20, 3), S_DUST);
    }
    if (!rock) {
      // Clods flung out and falling.
      for (let k = 0; k < 6; k++) {
        const a = base + (r() - 0.5) * 1.4; const sp = 50 + r() * 90;
        this._s(this.emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 0.4 + r() * 0.3, 2 + r() * 2, cols[(r() * 2) | 0], P_FADE | P_ROT, 600, 1), S_CHIP);
      }
      return;
    }
    // Rock: bright glowing sparks shooting off the strike point, hot ones fastest.
    const sparks = gated ? 14 : 10;
    for (let k = 0; k < sparks; k++) {
      const a = base + (r() - 0.5) * 1.8; const sp = 120 + r() * 220; const hot = r() < 0.4;
      this._s(this.emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.15 + r() * 0.25, hot ? 1.5 : 1, hot ? this.cSparkHot : this.cSpark, P_GLOW | P_FADE, 700), S_SPARK);
    }
    // Rock chips.
    for (let k = 0; k < 3; k++) {
      const a = base + (r() - 0.5) * 1.2; const sp = 60 + r() * 80;
      this._s(this.emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 30, 0.5, 2, cols[(r() * 3) | 0], P_BOUNCE | P_ROT | P_FADE, 700), S_CHIP);
    }
  }

  /** Block-break debris with material physics. */
  debris(cx, cy, type, ore, count) {
    const r = this.rng;
    const cols = this.matColor[type];
    const soft = type === TILE.SOIL;
    for (let k = 0; k < count; k++) {
      const x = cx + (r() - 0.5) * 24; const y = cy + (r() - 0.5) * 24;
      const vx = (r() - 0.5) * (soft ? 120 : 260);
      const vy = -r() * (soft ? 140 : 260);
      if (soft) this.emit(x, y, vx, vy, 0.5 + r() * 0.5, 2 + r() * 3, cols[(r() * 3) | 0], P_FADE, 500, 1.5);
      else this._s(this.emit(x, y, vx, vy, 1 + r() * 0.8, 2 + r() * 3, cols[(r() * 3) | 0], P_BOUNCE | P_ROT | P_FADE, PARTICLES.GRAVITY), S_CHIP);
    }
    // Dust cloud rolling out of the broken block (also what a collapse kicks up).
    for (let k = 0; k < Math.min(6, 2 + (count >> 2)); k++) {
      this._s(this.emit(cx + (r() - 0.5) * 20, cy + (r() - 0.5) * 20, (r() - 0.5) * 50, -10 - r() * 25, 0.7 + r() * 0.6, 4 + r() * 3, r() < 0.5 ? this.cDust : cols[2], P_FADE, -15, 2.5), S_DUST);
    }
    if (ore) {
      const oc = this.oreColor[ore];
      const glow = ore === ORE.DIAMOND;
      for (let k = 0; k < (glow ? 10 : 4); k++) {
        this.emit(cx + (r() - 0.5) * 16, cy + (r() - 0.5) * 16, (r() - 0.5) * 220, -r() * 240, 0.8 + r() * 0.6, 2 + r() * 1.5,
          oc[(r() * 2) | 0], (glow ? P_GLOW : 0) | P_BOUNCE | P_ROT | P_FADE);
      }
    }
    if (type === TILE.MANTLE) this.embers(cx, cy, 10);
  }

  embers(cx, cy, n) {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      this.emit(cx + (r() - 0.5) * 24, cy + (r() - 0.5) * 24, (r() - 0.5) * 40, -30 - r() * 60, 0.6 + r() * 0.9, 1.5 + r(), r() < 0.5 ? this.cEmber : this.cEmberHot, P_GLOW | P_FADE | P_SHRINK, -40, 0.5);
    }
  }

  explosion(cx, cy) {
    const r = this.rng;
    for (let k = 0; k < 60; k++) {
      const a = r() * Math.PI * 2; const sp = 120 + r() * 380;
      this.emit(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + r() * 0.4, 2 + r() * 3, r() < 0.5 ? this.cFlame : this.cSparkHot, P_GLOW | P_FADE | P_SHRINK, 200, 2);
    }
    for (let k = 0; k < 30; k++) {
      const a = r() * Math.PI * 2; const sp = 40 + r() * 120;
      this._s(this.emit(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp - 40, 1 + r(), 5 + r() * 6, this.cSmoke, P_FADE, -30, 1.5), S_DUST);
    }
  }

  vortex(cx, cy) {
    const r = this.rng;
    const a = r() * Math.PI * 2; const d = 30 + r() * 20;
    const x = cx + Math.cos(a) * d; const y = cy + Math.sin(a) * d;
    this.emit(x, y, -Math.sin(a) * 120 - Math.cos(a) * 60, Math.cos(a) * 120 - Math.sin(a) * 60, 0.45, 2, r() < 0.5 ? this.cCyan : this.cWhite, P_GLOW | P_FADE | P_NOGRAV);
  }

  electric(cx, cy) {
    const r = this.rng;
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2; const sp = 80 + r() * 200;
      this.emit(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + r() * 0.3, 1.5 + r(), r() < 0.6 ? this.cBlue : this.cWhite, P_GLOW | P_FADE | P_NOGRAV, 0, 3);
    }
  }

  jet(x, y) {
    const r = this.rng;
    this.emit(x + (r() - 0.5) * 4, y, (r() - 0.5) * 30, 120 + r() * 80, 0.18 + r() * 0.12, 2 + r() * 2, r() < 0.5 ? this.cFlame : this.cSparkHot, P_GLOW | P_FADE | P_SHRINK, 0);
  }

  drip(x, y) { this.emit(x, y, 0, 10, 1.5, 1.5, this.cWater, P_FADE, PARTICLES.GRAVITY * 0.7); }

  beamDust(x, y) {
    const r = this.rng;
    this.emit(x, y, (r() - 0.5) * 8, (r() - 0.5) * 8, 2 + r() * 2, 1, this.cDust, P_FADE | P_NOGRAV, 0);
  }

  pollen(x, y) {
    const r = this.rng;
    this.emit(x, y, 6 + r() * 10, (r() - 0.5) * 6, 4 + r() * 3, 1, this.cPollen, P_FADE | P_NOGRAV | P_GLOW, 0);
  }

  pickupSparkle(x, y, ore) {
    const c = this.oreColor[ore][1];
    for (let k = 0; k < 6; k++) this.emit(x, y, (this.rng() - 0.5) * 80, -this.rng() * 80, 0.4, 1.5, c, P_GLOW | P_FADE | P_NOGRAV);
  }
}
