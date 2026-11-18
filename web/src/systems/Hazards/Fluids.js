/**
 * @module systems/Hazards/Fluids
 * Water and magma as per-tile levels (World.fluid, 0..MAX). A cell moves one unit down if it can, else sideways
 * toward a lower neighbour. Natural pools are static until a neighbouring tile changes (a wall is broken).
 * Magma touching water cools to basalt. Dirty-queue driven with a per-step work cap.
 */
import { TILE, FLAG, HAZARD } from '../../config.js';
import { EV } from '../../core/EventBus.js';

const F = HAZARD.FLUID;

export class Fluids {
  /** @param {import('../../world/World.js').World} world @param {import('../../core/EventBus.js').EventBus} bus */
  constructor(world, bus) {
    this.bus = bus;
    /** @type {Set<number>} */ this.dirty = new Set();
    this.acc = 0; this.step = 0; this.processed = 0; this._busy = false;
    this.setWorld(world);
    bus.on(EV.TILE_CHANGED, (i) => { if (!this._busy) this._near(i); });
  }

  setWorld(w) {
    this.world = w; this.dirty.clear();
    // Saves/worldgen without levels: natural pools start full.
    for (let i = 0; i < w.tileType.length; i++) if ((w.tileType[i] === TILE.WATER || w.tileType[i] === TILE.MAGMA) && !w.fluid[i]) w.fluid[i] = F.MAX;
  }

  /** Fill the lowest `rows` rows of rect r with water: open air only (walls stay), already-full tiles untouched. */
  raiseRows(r, rows) {
    const w = this.world;
    for (let y = r.y + r.h - Math.min(rows, r.h); y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * w.W + x;
      if (w.tileType[i] !== TILE.AIR && w.tileType[i] !== TILE.WATER) continue;
      w.tileType[i] = TILE.WATER; w.fluid[i] = F.MAX; w.gas[i] = 0; w.flags[i] |= FLAG.DIRTY;
      this._emit(i); this._near(i);
    }
  }

  _near(i) {
    const w = this.world; const x = i % w.W; const y = (i / w.W) | 0;
    this.dirty.add(i);
    if (y > 0) this.dirty.add(i - w.W);
    if (y + 1 < w.H) this.dirty.add(i + w.W);
    if (x > 0) this.dirty.add(i - 1);
    if (x + 1 < w.W) this.dirty.add(i + 1);
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < F.FLOW_S) return;
    this.acc = 0; this.step++;
    this.processed = 0;
    const cur = [...this.dirty]; this.dirty.clear();
    for (let k = 0; k < cur.length; k++) {
      if (this.processed >= F.MAX_PER_TICK) { for (let r = k; r < cur.length; r++) this.dirty.add(cur[r]); break; }
      this.processed++;
      this._process(cur[k]);
    }
  }

  _process(i) {
    const w = this.world; const t = w.tileType[i];
    if (t !== TILE.WATER && t !== TILE.MAGMA) return;
    const L = w.fluid[i];
    if (!L) return;
    const x = i % w.W; const y = (i / w.W) | 0;
    const other = t === TILE.WATER ? TILE.MAGMA : TILE.WATER;
    for (const k of this._nbrs(i, x, y)) {
      if (w.tileType[k] === other) { this._quench(t === TILE.MAGMA ? i : k, t === TILE.MAGMA ? k : i); return; }
    }
    if (t === TILE.MAGMA && this.step % F.MAGMA_EVERY) { this.dirty.add(i); return; }
    if (y + 1 < w.H) {
      const b = i + w.W; const tb = w.tileType[b];
      if (tb === TILE.AIR || (tb === t && w.fluid[b] < F.MAX)) { this._move(i, b); return; }
    }
    const order = this.step & 1 ? [-1, 1] : [1, -1];
    for (const d of order) {
      const nx = x + d; if (nx < 0 || nx >= w.W) continue;
      const k = i + d; const tk = w.tileType[k];
      const lk = tk === t ? w.fluid[k] : tk === TILE.AIR ? 0 : -1;
      if (lk >= 0 && L > lk + 1) { this._move(i, k); return; }
    }
  }

  _nbrs(i, x, y) {
    const w = this.world; const out = [];
    if (y > 0) out.push(i - w.W);
    if (y + 1 < w.H) out.push(i + w.W);
    if (x > 0) out.push(i - 1);
    if (x + 1 < w.W) out.push(i + 1);
    return out;
  }

  _emit(i) { this._busy = true; this.bus.emit(EV.TILE_CHANGED, i); this._busy = false; }

  /** Move one unit from a to b (b is AIR or the same fluid). */
  _move(a, b) {
    const w = this.world; const t = w.tileType[a];
    w.fluid[a]--;
    if (w.fluid[a] === 0) { w.tileType[a] = TILE.AIR; w.flags[a] |= FLAG.DIRTY; }
    if (w.tileType[b] === TILE.AIR) { w.tileType[b] = t; w.fluid[b] = 1; w.gas[b] = 0; w.flags[b] |= FLAG.DIRTY; } else w.fluid[b]++;
    this._emit(a); this._emit(b);
    this._near(a); this._near(b);
  }

  /** Magma cell m meets water cell q: m turns to basalt, q loses a unit. */
  _quench(m, q) {
    const w = this.world;
    w.tileType[m] = TILE.BASALT; w.fluid[m] = 0; w.oreType[m] = 0; w.tileHP[m] = w.maxHP(m);
    w.flags[m] |= FLAG.SOLID | FLAG.DIRTY;
    if (--w.fluid[q] <= 0) { w.fluid[q] = 0; w.tileType[q] = TILE.AIR; w.flags[q] |= FLAG.DIRTY; }
    this._emit(m); this._emit(q);
    this._near(q);
  }
}
