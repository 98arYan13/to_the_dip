/**
 * @module systems/Hazards/Collapse
 * Unstable soil and sand: a warning phase (crack, dust, rumble), then the tile falls one cell per step
 * and crushes the player if it lands on them. Dirty-queue driven; work per update is capped.
 */
import { TILE, FLAG, HAZARD, MATERIALS } from '../../config.js';
import { EV } from '../../core/EventBus.js';
import { isCampGround } from '../Mining.js';

const C = HAZARD.COLLAPSE;

/**
 * SAND falls whenever nothing is under it; SOIL only when it also has no solid neighbour left or right.
 * @param {import('../../world/World.js').World} w
 */
export function isUnstable(w, x, y) {
  if (!w.inBounds(x, y) || isCampGround(x, y)) return false;
  const t = w.tileType[y * w.W + x];
  const loose = MATERIALS[t].loose; // sand, regolith: falls whenever unsupported
  if (!loose && t !== TILE.SOIL) return false;
  if (w.isSolid(x, y + 1)) return false;
  return loose || (!w.isSolid(x - 1, y) && !w.isSolid(x + 1, y));
}

export class Collapse {
  /** @param {import('../../world/World.js').World} world @param {import('../../core/EventBus.js').EventBus} bus */
  constructor(world, bus) {
    this.world = world;
    this.bus = bus;
    /** @type {Set<number>} */ this.dirty = new Set();
    /** @type {Map<number,{t:number,p:number}>} tile index → warning time left, pulse timer */ this.warn = new Map();
    /** @type {Map<number,number>} falling tile index → time to next step */ this.falling = new Map();
    /** Return true if tile (x, y) overlaps the player; the player is then crushed by the caller. */
    this.crush = (/** @type {number} */ x, /** @type {number} */ y) => false;
    this.processed = 0;
    /** @type {Set<number>} tiles forced to fall (quake rockfall): not cancelled by the support check */ this.forced = new Set();
    /** @type {Set<number>} core rock whose tile below just emptied: melts into magma */ this.melt = new Set();
    bus.on(EV.TILE_CHANGED, (i) => {
      const w = this.world;
      this._near(i % w.W, (i / w.W) | 0);
      if (w.tileType[i] === TILE.AIR && i >= w.W && w.tileType[i - w.W] === TILE.CORE) this.melt.add(i - w.W);
    });
  }

  setWorld(w) { this.world = w; this.forced.clear(); this.dirty.clear(); this.warn.clear(); this.falling.clear(); this.melt.clear(); this.markAll(); }

  /** Queue every sand/soil tile once (after load, so floating sand starts moving). */
  markAll() {
    const w = this.world;
    for (let i = 0; i < w.tileType.length; i++) if (MATERIALS[w.tileType[i]].loose || w.tileType[i] === TILE.SOIL) this.dirty.add(i);
  }

  /** Make any loose solid tile fall (warning first). @returns {boolean} */
  forceFall(x, y) {
    const w = this.world; const i = y * w.W + x;
    if (!w.inBounds(x, y) || isCampGround(x, y) || !w.isSolid(x, y) || w.tileType[i] === TILE.BEDROCK || this.warn.has(i) || this.falling.has(i)) return false;
    this.forced.add(i);
    this.warn.set(i, { t: C.WARN_S * 0.6, p: 0 });
    w.flags[i] |= FLAG.UNSTABLE;
    this.bus.emit(EV.TILE_CHANGED, i);
    return true;
  }

  /** A tile changed at (x, y): re-check it and the neighbours that may have lost support. */
  markDirty(x, y) { this._near(x, y); }

  _near(x, y) {
    const w = this.world;
    for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, 0]]) if (w.inBounds(x + dx, y + dy)) this.dirty.add((y + dy) * w.W + x + dx);
  }

  update(dt) {
    const w = this.world;
    let budget = C.MAX_PER_TICK;
    this.processed = 0;

    for (const i of [...this.melt]) {
      this.melt.delete(i);
      if (w.tileType[i] !== TILE.CORE || w.tileType[i + w.W] !== TILE.AIR) continue;
      w.clear(i); w.tileType[i] = TILE.MAGMA; w.fluid[i] = HAZARD.FLUID.MAX;
      this.bus.emit(EV.TILE_CHANGED, i);
    }

    for (const i of this.dirty) {
      if (budget <= 0) break;
      budget--; this.processed++;
      this.dirty.delete(i);
      const x = i % w.W; const y = (i / w.W) | 0;
      if (this.falling.has(i)) continue;
      const bad = isUnstable(w, x, y);
      if (bad && !this.warn.has(i)) {
        this.warn.set(i, { t: C.WARN_S, p: 0 });
        w.flags[i] |= FLAG.UNSTABLE;
        this.bus.emit(EV.TILE_CHANGED, i);
      } else if (!bad && this.warn.has(i) && !this.forced.has(i)) {
        this.warn.delete(i);
        w.flags[i] &= ~FLAG.UNSTABLE;
        this.bus.emit(EV.TILE_CHANGED, i);
      }
    }

    for (const [i, s] of this.warn) {
      if (budget <= 0) break;
      s.t -= dt; s.p -= dt;
      if (s.p <= 0) { s.p = C.PULSE_S; this.bus.emit(EV.TILE_WARN, { x: i % w.W, y: (i / w.W) | 0 }); }
      if (s.t <= 0) { budget--; this.processed++; this.warn.delete(i); this.forced.delete(i); w.flags[i] &= ~FLAG.UNSTABLE; this.falling.set(i, 0); }
    }

    for (const [i, t] of [...this.falling]) {
      if (budget <= 0) break;
      if (t > 0) { this.falling.set(i, t - dt); continue; }
      budget--; this.processed++;
      this.falling.delete(i);
      const x = i % w.W; const y = (i / w.W) | 0;
      if (w.isSolid(x, y + 1)) { this._near(x, y); continue; } // landed
      const j = i + w.W;
      this._move(i, j);
      this.bus.emit(EV.TILE_FELL, { x, y: y + 1 });
      if (this.crush(x, y + 1)) this.bus.emit(EV.TILE_CRUSH, { x, y: y + 1 });
      this.falling.set(j, C.STEP_S);
      this._near(x, y);
    }
  }

  /** Move a solid tile one cell down into air. */
  _move(i, j) {
    const w = this.world;
    w.tileType[j] = w.tileType[i]; w.oreType[j] = w.oreType[i]; w.tileHP[j] = w.tileHP[i];
    w.flags[j] = (w.flags[j] & ~(FLAG.FUNGI | FLAG.MOSS)) | FLAG.SOLID | FLAG.DIRTY;
    w.fluid[j] = 0; w.gas[j] = 0;
    w.flags[i] &= ~FLAG.UNSTABLE;
    w.clear(i);
    this.bus.emit(EV.TILE_CHANGED, i);
    this.bus.emit(EV.TILE_CHANGED, j);
  }
}
