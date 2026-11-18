/**
 * @module systems/Hazards/Pulse
 * Seeded electromagnetic pulse storm: a warning countdown, then unsheltered players lose energy and gear goes offline for a while.
 * Never above SAFE_DEPTH_M; the timer is frozen by the caller while a modal is open.
 */
import { PLANETS, HAZARD, underM } from '../../config.js';
import { EV } from '../../core/EventBus.js';

const P = HAZARD.PULSE;

/** @param {number} resist 0..1 */
export function pulseEffect(resist) {
  const k = 1 - Math.max(0, Math.min(1, resist));
  return { drainFrac: P.DRAIN_FRAC * k, stunS: P.STUN_S * k };
}

export class Pulse {
  /** @param {import('../../core/EventBus.js').EventBus} bus @param {import('../../core/RNG.js').RNG} rng @param {any} economy */
  constructor(bus, rng, economy) {
    this.bus = bus; this.rng = rng; this.economy = economy;
    this.timer = P.MAX_GAP_S * (0.5 + 0.5 * rng.float());
    this.warn = -1; this.stun = 0;
    /** Underground metres of the current world; main.js updates it on world change. */
    this.underM = underM(PLANETS.earth.H);
    /** Hook: called with the fraction of max energy to drain. */
    this.onDrain = (_frac) => {};
  }

  _gap(depth01) { return (P.MAX_GAP_S + (P.MIN_GAP_S - P.MAX_GAP_S) * depth01) * (0.7 + 0.6 * this.rng.float()); }

  reset() { this.stun = 0; this.warn = -1; }

  update(dt, depthM, sheltered) {
    this.stun = Math.max(0, this.stun - dt);
    if (this.warn >= 0) {
      this.warn -= dt;
      if (this.warn < 0) this._fire(sheltered);
      return;
    }
    const mul = PLANETS[this.economy.planet ?? 'earth'].pulse.mul;
    if (depthM < P.SAFE_DEPTH_M || !mul || this.economy.finished) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this._gap(Math.min(1, depthM / this.underM)) / mul;
    this.warn = P.WARN_S * (this.economy.tech.includes('pulse_detector') ? 2 : 1);
    this.bus.emit(EV.PULSE_WARN, { seconds: this.warn });
  }

  _fire(sheltered) {
    this.bus.emit(EV.PULSE, { sheltered });
    if (sheltered) return;
    const e = pulseEffect(this.economy.stat('pulseResist', 0));
    this.stun = e.stunS;
    this.onDrain(e.drainFrac);
  }
}
