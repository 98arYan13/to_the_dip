/**
 * @module systems/Energy
 * Suit energy: passive life-support drain, mining/jetpack drain, mantle heat,
 * station recharge, low-energy warning and emergency rescue trigger.
 */
import { ENERGY } from '../config.js';
import { EV } from '../core/EventBus.js';

export class Energy {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('./Economy.js').Economy} economy
   */
  constructor(bus, economy) {
    this.bus = bus;
    this.economy = economy;
    this.value = economy.suit.maxEnergy;
    this.lowTimer = 0;
    this.lastReported = -1;
    this.rescuePending = false;
    this.payload = { value: 0, max: 0 };
  }

  get max() { return this.economy.suit.maxEnergy; }
  get frac() { return this.value / this.max; }

  /**
   * @param {number} dt
   * @param {{jetting:boolean, inMantle:boolean, atStation:boolean}} s
   */
  update(dt, s) {
    if (s.atStation) {
      if (this.value < this.max) {
        this.value = Math.min(this.max, this.value + ENERGY.STATION_RATE * dt);
        if (this.value >= this.max) this.bus.emit(EV.STATION_FULL);
      }
    } else {
      const suit = this.economy.suit;
      let drain = suit.passive;
      if (s.inMantle) drain *= 1 + (ENERGY.MANTLE_HEAT_MULT - 1) * (1 - suit.heatResist);
      if (s.jetting) drain += this.economy.jetpack.drain;
      this.value -= drain * dt;
    }
    this._clampAndReport();
    if (this.frac < ENERGY.LOW_THRESHOLD && this.value > 0) {
      this.lowTimer -= dt;
      if (this.lowTimer <= 0) { this.lowTimer = ENERGY.LOW_BEEP_INTERVAL; this.bus.emit(EV.LOW_ENERGY); }
    } else this.lowTimer = 0;
  }

  /** One-off drain (mining hit, radar). @param {number} amount */
  drain(amount) { this.value -= amount; this._clampAndReport(); }

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
