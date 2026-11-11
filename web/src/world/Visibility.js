/**
 * @module world/Visibility
 * Fog of war (permanent discovery with alpha fade-in) and radar reveal timers.
 */
import { FLAG, RENDER, WORLD, LIGHTING } from '../config.js';
import { EV } from '../core/EventBus.js';

export class Visibility {
  /**
   * @param {import('./World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(world, bus) {
    this.bus = bus;
    this.setWorld(world);
  }

  /** @param {import('./World.js').World} world */
  setWorld(world) {
    this.world = world;
    const n = world.W * world.H;
    /** Reveal alpha per tile, 0 = black fog, 1 = fully visible. */
    this.alpha = new Float32Array(n);
    this.fading = new Int32Array(n);
    this.fadingCount = 0;
    this.radarTimer = new Float32Array(n);
    this.radarDelay = new Float32Array(n);
    this.radarList = new Int32Array(n);
    this.radarCount = 0;
    this.frame = 0;
    for (let i = 0; i < n; i++) if (world.flags[i] & FLAG.DISCOVERED) this.alpha[i] = 1;
  }

  isDiscovered(i) { return (this.world.flags[i] & FLAG.DISCOVERED) !== 0; }
  isRadarLit(i) { return (this.world.flags[i] & FLAG.RADAR_LIT) !== 0; }

  /** Permanently discover a tile (fades in). */
  reveal(i) {
    const f = this.world.flags;
    if (f[i] & FLAG.DISCOVERED) return;
    f[i] |= FLAG.DISCOVERED;
    if (this.alpha[i] < 1) this.fading[this.fadingCount++] = i;
    this.bus.emit(EV.TILE_DISCOVERED, i);
  }

  /** Reveal a tile and its 8 neighbours (used when a block breaks). */
  revealAround(tx, ty) {
    const w = this.world;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx; const y = ty + dy;
      if (w.inBounds(x, y)) this.reveal(y * w.W + x);
    }
  }

  /**
   * @param {number} dt
   * @param {number} px player centre x (px) @param {number} py player centre y (px)
   * @param {number} rangePx light/headlamp range in px
   * @param {number} [aimAngle] headlamp direction (radians); its beam reveals one dark tile past each wall it hits
   */
  update(dt, px, py, rangePx, aimAngle) {
    const w = this.world;
    // Line-of-sight reveal, throttled.
    if ((this.frame++ % RENDER.REVEAL_INTERVAL) === 0) {
      const T = w.T;
      const r = Math.ceil(rangePx / T);
      const ptx = Math.floor(px / T);
      const pty = Math.floor(py / T);
      const near2 = RENDER.REVEAL_NEAR * RENDER.REVEAL_NEAR;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) {
        const y = pty + dy;
        if (y < 0 || y >= w.H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const x = ptx + dx;
          if (x < 0 || x >= w.W) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const i = y * w.W + x;
          if (w.flags[i] & FLAG.DISCOVERED) continue;
          if (d2 <= near2) { this.reveal(i); continue; }
          const cx = x * T + T * 0.5 - px;
          const cy = y * T + T * 0.5 - py;
          const dist = Math.sqrt(cx * cx + cy * cy);
          w.raycast(px, py, cx / dist, cy / dist, dist);
          if (w.lastHit === -1 || w.lastHit === i) this.reveal(i);
        }
      }
      if (aimAngle !== undefined) this._beam(px, py, rangePx, aimAngle);
    }

    // Fade-in
    const fade = RENDER.REVEAL_FADE * dt;
    for (let k = this.fadingCount - 1; k >= 0; k--) {
      const i = this.fading[k];
      const a = this.alpha[i] + fade;
      if (a >= 1) {
        this.alpha[i] = 1;
        this.fading[k] = this.fading[--this.fadingCount];
      } else this.alpha[i] = a;
    }

    // Radar timers
    for (let k = this.radarCount - 1; k >= 0; k--) {
      const i = this.radarList[k];
      if (this.radarDelay[i] > 0) {
        this.radarDelay[i] -= dt;
        if (this.radarDelay[i] <= 0) { w.flags[i] |= FLAG.RADAR_LIT; this.bus.emit(EV.RADAR_TILE, i); }
        continue;
      }
      this.radarTimer[i] -= dt;
      if (this.radarTimer[i] <= 0 || w.oreType[i] === 0) {
        this.radarTimer[i] = 0;
        w.flags[i] &= ~FLAG.RADAR_LIT;
        this.radarList[k] = this.radarList[--this.radarCount];
        this.bus.emit(EV.RADAR_TILE, i);
      }
    }
  }

  /** Headlamp beam: light soaks one tile into each wall it strikes. */
  _beam(px, py, rangePx, aimAngle) {
    const w = this.world; const T = w.T;
    const half = LIGHTING.CONE_HALF_ANGLE;
    const n = Math.ceil(half * 2 / 0.04);
    for (let k = 0; k <= n; k++) {
      const a = aimAngle - half + (half * 2 * k) / n;
      const dx = Math.cos(a); const dy = Math.sin(a);
      const d = w.raycast(px, py, dx, dy, rangePx);
      if (w.lastHit < 0) continue;
      this.reveal(w.lastHit);
      const x = Math.floor((px + dx * (d + T)) / T); const y = Math.floor((py + dy * (d + T)) / T);
      if (w.inBounds(x, y)) this.reveal(y * w.W + x);
    }
  }

  /**
   * Radar sonar pulse: ores within radius light up as the ring passes them.
   * @param {number} px @param {number} py centre in px
   * @param {number} radiusTiles @param {number} duration seconds @param {number} ringSpeed px/s
   */
  radarPulse(px, py, radiusTiles, duration, ringSpeed) {
    const w = this.world;
    const T = w.T;
    const ptx = Math.floor(px / T);
    const pty = Math.floor(py / T);
    const r2 = radiusTiles * radiusTiles;
    for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
      const y = pty + dy;
      if (y < 0 || y >= w.H) continue;
      for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
        const x = ptx + dx;
        if (x < 0 || x >= w.W || dx * dx + dy * dy > r2) continue;
        const i = y * w.W + x;
        if (w.oreType[i] === 0) continue;
        const already = this.radarTimer[i] > 0 || this.radarDelay[i] > 0;
        this.radarTimer[i] = duration;
        this.radarDelay[i] = Math.sqrt(dx * dx + dy * dy) * T / ringSpeed;
        if (!already) this.radarList[this.radarCount++] = i;
      }
    }
  }

  /** Clear transient radar state (used before saving / on new world). */
  clearRadar() {
    const w = this.world;
    for (let k = 0; k < this.radarCount; k++) {
      const i = this.radarList[k];
      w.flags[i] &= ~FLAG.RADAR_LIT;
      this.radarTimer[i] = 0;
      this.radarDelay[i] = 0;
    }
    this.radarCount = 0;
  }
}

export const SURFACE_PX = WORLD.SURFACE_ROWS * WORLD.TILE_PX;
