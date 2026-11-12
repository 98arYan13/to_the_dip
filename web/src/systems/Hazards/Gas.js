/**
 * @module systems/Hazards/Gas
 * Toxic, explosive gas as a per-tile byte (World.gas). Sealed pockets stay put; once a wall breaks the gas diffuses
 * into open air. Mining while standing in gas, or a blast reaching gas, explodes it (chain-limited per tick).
 */
import { TILE, WORLD, GAS } from '../../config.js';
import { EV } from '../../core/EventBus.js';

export class Gas {
  /**
   * @param {import('../../world/World.js').World} world
   * @param {import('../../core/EventBus.js').EventBus} bus
   * @param {{cx:number, cy:number, hp:number, setHP:Function, die:Function}|null} player
   */
  constructor(world, bus, player = null) {
    this.world = world; this.bus = bus; this.player = player;
    /** @type {Set<number>} */ this.dirty = new Set();
    /** @type {number[]} explosion centres still to resolve (tile indices) */ this.pending = [];
    this.tick = 0; this.acc = 0; this.dmgAcc = 0; this.processed = 0; this.exploding = false;
    /** Set by main: does the player own the gas mask? */ this.hasMask = () => false;
    /** Set by main: Mining, so explosions break weak tiles. */ this.mining = null;
    bus.on(EV.TILE_CHANGED, (i) => this._near(i));
  }

  setWorld(w) { this.world = w; this.dirty.clear(); this.pending.length = 0; }

  concentrationAt(x, y) { const w = this.world; return w.inBounds(x, y) ? w.gas[y * w.W + x] : 0; }

  /** Dev/zone helper: put gas into an open tile. */
  spawn(x, y, level = GAS.MAX) {
    const w = this.world; if (!w.inBounds(x, y)) return;
    const i = y * w.W + x;
    if (w.tileType[i] === TILE.AIR) { w.gas[i] = level; this.dirty.add(i); }
  }

  _near(i) {
    const w = this.world; const x = i % w.W;
    this.dirty.add(i);
    if (i >= w.W) this.dirty.add(i - w.W);
    if (i + w.W < w.tileType.length) this.dirty.add(i + w.W);
    if (x > 0) this.dirty.add(i - 1);
    if (x + 1 < w.W) this.dirty.add(i + 1);
  }

  /** The player swung the pickaxe: mining from inside a gas tile detonates it. */
  onPlayerMine() {
    const p = this.player; const T = this.world.T;
    if (!p) return;
    const x = Math.floor(p.cx / T); const y = Math.floor(p.cy / T);
    if (this.concentrationAt(x, y) > 0) { this.explodeAt(x, y); p.die('gas explosion'); }
  }

  /** Detonate at tile (x, y); chain reactions resolve over following updates if they exceed the per-tick cap. */
  explodeAt(x, y) {
    const w = this.world; if (!w.inBounds(x, y)) return;
    this.pending.push(y * w.W + x);
    this._chain();
  }

  update(dt) {
    this.acc += dt;
    if (this.acc >= GAS.STEP_S) { this.acc = 0; this._diffuse(); }
    if (this.pending.length) this._chain();
    const p = this.player;
    if (p && !this.hasMask() && this.concentrationAt(Math.floor(p.cx / this.world.T), Math.floor(p.cy / this.world.T)) > 0) {
      this.dmgAcc += GAS.DPS * dt;
      if (this.dmgAcc >= 1) { const d = Math.floor(this.dmgAcc); this.dmgAcc -= d; p.setHP(p.hp - d); }
    }
  }

  _diffuse() {
    const w = this.world; const cur = [...this.dirty]; this.dirty.clear();
    this.tick++;
    let n = 0;
    for (let k = 0; k < cur.length; k++) {
      if (n >= GAS.MAX_PER_TICK) { for (let r = k; r < cur.length; r++) this.dirty.add(cur[r]); break; }
      n++;
      const i = cur[k]; const g = w.gas[i];
      if (!g) continue;
      const x = i % w.W; const y = (i / w.W) | 0;
      if (w.tileType[i] !== TILE.AIR || y < WORLD.SURFACE_ROWS) { w.gas[i] = 0; continue; } // sky: gas escapes
      let open = false;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx; const ny = y + dy;
        if (!w.inBounds(nx, ny)) continue;
        const j = ny * w.W + nx;
        if (w.tileType[j] === TILE.AIR && w.gas[j] === 0) open = true;
        if (w.tileType[j] !== TILE.AIR || w.gas[i] < 2 || w.gas[j] > w.gas[i] - 2) continue;
        w.gas[i]--; w.gas[j]++;
        this.dirty.add(j); this.dirty.add(i);
      }
      // Thin gas in open air thins out; sealed pockets are left alone.
      if (w.gas[i] === 1 && open) { if (((Math.imul(i, 2654435761) + this.tick) >>> 0) % 3 === 0) w.gas[i] = 0; else this.dirty.add(i); }
    }
  }

  /** Resolve queued explosions (explicit stack, at most MAX_CHAIN_PER_TICK per call). */
  _chain() {
    const w = this.world; const R = GAS.EXPLODE_R; const T = w.T;
    let done = 0; let fx = 0;
    while (this.pending.length && done < GAS.MAX_CHAIN_PER_TICK) {
      const c = /** @type {number} */ (this.pending.pop());
      const cx = c % w.W; const cy = (c / w.W) | 0;
      done++;
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (w.inBounds(x, y)) w.gas[y * w.W + x] = 0;
      for (let y = cy - R - 1; y <= cy + R + 1; y++) for (let x = cx - R - 1; x <= cx + R + 1; x++) {
        if (w.inBounds(x, y) && w.gas[y * w.W + x] > 0) this.pending.push(y * w.W + x);
      }
      if (this.mining) { this.exploding = true; this.mining.blast(cx, cy); this.exploding = false; }
      const p = this.player;
      if (p && Math.abs(Math.floor(p.cx / T) - cx) <= R && Math.abs(Math.floor(p.cy / T) - cy) <= R) p.die('gas explosion');
      if (fx++ < 6) this.bus.emit(EV.EXPLOSION, { x: cx * T + T / 2, y: cy * T + T / 2 });
    }
    this.processed = done;
  }
}
