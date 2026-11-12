/**
 * @module systems/Hazards/Quake
 * Seeded earthquake scheduler: rumble warning, then ceiling tiles near the player are forced to fall (rockfall).
 * Never above SAFE_DEPTH_M or at camp.
 */
import { WORLD, HAZARD } from '../../config.js';
import { EV } from '../../core/EventBus.js';
import { isCampGround } from '../Mining.js';

const Q = HAZARD.QUAKE;
const UNDER_M = (WORLD.H - 1 - WORLD.SURFACE_ROWS) * WORLD.METERS_PER_TILE;

export class Quake {
  /**
   * @param {import('../../world/World.js').World} world
   * @param {import('../../core/EventBus.js').EventBus} bus
   * @param {import('./Collapse.js').Collapse} collapse
   * @param {import('../../core/RNG.js').RNG} rng
   */
  constructor(world, bus, collapse, rng) {
    this.world = world; this.bus = bus; this.collapse = collapse; this.rng = rng;
    this.timer = Q.MAX_GAP_S * (0.5 + 0.5 * rng.float());
    this.warn = -1; this.pending = 0; this.shake = 0;
    /** Tile the rockfall centres on (set each frame to the player's tile). */
    this.focus = { x: 0, y: 0 };
  }

  _gap(depth01) { return (Q.MAX_GAP_S + (Q.MIN_GAP_S - Q.MAX_GAP_S) * depth01) * (0.7 + 0.6 * this.rng.float()); }

  update(dt, depth01) {
    this.shake = Math.max(0, this.shake - Q.SHAKE_DECAY * dt);
    if (this.warn >= 0) {
      this.warn -= dt;
      this.shake = Math.max(this.shake, 0.15 + 0.1 * this.pending);
      if (this.warn < 0) this.trigger(this.pending);
      return;
    }
    if (depth01 <= 0 || depth01 * UNDER_M < Q.SAFE_DEPTH_M) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this._gap(depth01);
    this.pending = Math.min(1, 0.3 + 0.7 * depth01 * (0.5 + 0.5 * this.rng.float()));
    this.warn = Q.WARN_S;
    this.bus.emit(EV.QUAKE_WARN, { strength: this.pending });
  }

  /** @param {number} strength 0..1 @returns {number} ceiling tiles set to fall */
  trigger(strength) {
    const w = this.world; const R = Q.RADIUS;
    this.shake = Math.max(this.shake, strength);
    this.bus.emit(EV.QUAKE, { strength });
    const cand = [];
    for (let y = this.focus.y - R; y <= this.focus.y + R; y++) for (let x = this.focus.x - R; x <= this.focus.x + R; x++) {
      if (w.inBounds(x, y) && w.isSolid(x, y) && !w.isSolid(x, y + 1) && !isCampGround(x, y)) cand.push([x, y]);
    }
    for (let k = cand.length - 1; k > 0; k--) { const j = this.rng.int(0, k); [cand[k], cand[j]] = [cand[j], cand[k]]; }
    const n = Math.round(Q.BASE_N + (Q.MAX_N - Q.BASE_N) * strength);
    let hit = 0;
    for (let k = 0; k < cand.length && hit < n; k++) if (this.collapse.forceFall(cand[k][0], cand[k][1])) hit++;
    return hit;
  }
}
