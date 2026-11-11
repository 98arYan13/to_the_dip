/**
 * @module systems/Energy
 * Rig battery: depth/load-scaled idle drain, per-block mining drain, jetpack drain,
 * station recharge, low-energy warning and emergency rescue trigger.
 */
import { ENERGY, MATERIALS, ORES } from '../config.js';

/** E_block = E_base * H_mat * (1 + D/500) / eta_rig */
export function blockEnergy(hard, depthM, eff) {
  return ENERGY.BLOCK_BASE * hard * (1 + depthM / ENERGY.BLOCK_DEPTH) / eff;
}

/** E_idle/sec = 0.2 * (1 + D/300) * (1 + 0.5 * W/C) */
export function idleDrain(depthM, loadFrac) {
  return ENERGY.IDLE_BASE * (1 + depthM / ENERGY.IDLE_DEPTH) * (1 + ENERGY.IDLE_LOAD * loadFrac);
}

/** H_mat of a tile: the ore's hardness if it holds one, else the host rock's. */
export function tileHardness(type, ore) {
  return ore ? /** @type {any} */ (ORES[ore]).hard : MATERIALS[type].hard || 1;
}
import { EV } from '../core/EventBus.js';

export class Energy {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('./Economy.js').Economy} economy
   */
  constructor(bus, economy) {
    this.bus = bus;
    this.economy = economy;
    this.value = economy.rig.maxEnergy;
    /** Current depth in meters (set by the game loop). */
    this.depthM = 0;
    this.lowTimer = 0;
    /** Index into ENERGY.WARN_AT of the next warning still to fire. */
    this.warnIdx = 0;
    this.lastReported = -1;
    this.rescuePending = false;
    this.payload = { value: 0, max: 0 };
  }

  get max() { return this.economy.rig.maxEnergy; }
  get frac() { return this.value / this.max; }

  /**
   * @param {number} dt
   * @param {{jetting:boolean, atStation:boolean, onSurface?:boolean}} s
   */
  update(dt, s) {
    if (s.atStation) {
      if (this.value < this.max) {
        this.value = Math.min(this.max, this.value + ENERGY.STATION_RATE * this.max * dt);
        if (this.value >= this.max) this.bus.emit(EV.STATION_FULL);
      }
    } else {
      // Depth heat/pressure only drains underground; the surface is free.
      // Only the jetpack drains over time; hand tools are free, drills pay per block (drainBlock).
      if (s.jetting) this.value -= this.economy.jetpack.drain * dt;
    }
    this._clampAndReport();
    if (this.frac < ENERGY.LOW_THRESHOLD && this.value > 0) {
      this.lowTimer -= dt;
      if (this.lowTimer <= 0) { this.lowTimer = ENERGY.LOW_BEEP_INTERVAL; this.bus.emit(EV.LOW_ENERGY); }
    } else this.lowTimer = 0;
    this._warn();
  }

  /** Toast once per threshold on the way down; re-arms when energy climbs back above it. */
  _warn() {
    const W = ENERGY.WARN_AT;
    while (this.warnIdx > 0 && this.frac > W[this.warnIdx - 1]) this.warnIdx--;
    if (this.warnIdx < W.length && this.frac <= W[this.warnIdx] && this.value > 0) {
      this.bus.emit(EV.HINT, `Battery ${Math.round(W[this.warnIdx] * 100)}% — head back to the surface!`);
      while (this.warnIdx < W.length && this.frac <= W[this.warnIdx]) this.warnIdx++;
    }
  }

  /** Energy for breaking one block at the current depth. */
  /** A drill can run the battery flat but never triggers the rescue warp — only the jetpack can strand you. */
  drainBlock(type, ore) { this._drainWarn(Math.min(this.value - 0.001, blockEnergy(tileHardness(type, ore), this.depthM, this.economy.rig.eff))); }

  /** One-off drain (mining hit, radar). @param {number} amount */
  drain(amount) { this._drainWarn(amount); }

  _drainWarn(amount) { this.value -= amount; this._clampAndReport(); this._warn(); }

  /** @param {number} amount */
  add(amount) { this.value = Math.min(this.max, this.value + amount); this._clampAndReport(); }

  refill() { this.value = this.max; this._clampAndReport(); }

  setFrac(f) { this.value = this.max * f; this._clampAndReport(); }

  _clampAndReport() {
    if (this.value > this.max) this.value = this.max;
    if (this.value <= 0) {
      this.value = 0;
      if (!this.rescuePending) { this.rescuePending = true; this.bus.emit(EV.RESCUE); }
    }
    const pct = Math.round(this.value / this.max * 1000);
    if (pct !== this.lastReported) {
      this.lastReported = pct;
      this.payload.value = this.value; this.payload.max = this.max;
      this.bus.emit(EV.ENERGY_CHANGED, this.payload);
    }
  }

  /** Force a HUD refresh (after suit upgrade / load). */
  report() { this.lastReported = -1; this._clampAndReport(); }
}
