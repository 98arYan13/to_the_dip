/**
 * @module audio/SFX
 * Material-aware synthesized sound effects (transient + body + tail per hit), equipment and UI
 * sounds, the jetpack loop and the depth-adaptive ambience bed.
 */
import { AUDIO, ORE, MATERIALS, ORES, DYNAMITE } from '../config.js';
import { EV } from '../core/EventBus.js';
import { distortionCurve } from './DSP.js';

export class SFX {
  /** @param {import('./AudioEngine.js').AudioEngine} engine */
  constructor(engine) {
    this.e = engine;
    this.jet = null;
    this.boomCurve = null;
  }

  get ctx() { return /** @type {AudioContext} */ (this.e.ctx); }

  /**
   * Subscribe to game events.
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {() => import('../world/World.js').World} getWorld
   */
  bind(bus, getWorld) {
    const T = 32;
    const pos = (h) => [h.x * T + T / 2, h.y * T + T / 2];
    bus.on(EV.MINE_HIT, (h) => { const [x, y] = pos(h); this.mineHit(h.type, h.ore, x, y); });
    bus.on(EV.MINE_BLOCKED, (h) => { const [x, y] = pos(h); this.clink(x, y); });
    bus.on(EV.BLOCK_BROKEN, (h) => { const [x, y] = pos(h); this.mineHit(h.type, h.ore, x, y); this.blockBreak(h.type, x, y); });
    bus.on(EV.RADAR_PULSE, () => this.radar());
    bus.on(EV.DYNAMITE_THROWN, (p) => this.fuse(p.x, p.y));
    bus.on(EV.EXPLOSION, (p) => this.explosion(p.x, p.y));
    bus.on(EV.TELEPORT_START, () => this.teleport());
    bus.on(EV.LOW_ENERGY, () => this.lowEnergy());
    bus.on(EV.FOOTSTEP, (m) => this.footstep(m));
    bus.on(EV.SOLD, () => this.shopChime());
    bus.on(EV.PURCHASE_FAILED, () => this.shopError());
    bus.on(EV.UPGRADE_BOUGHT, (u) => (u.kind === 'pickaxe' ? this.fanfare() : this.shopChime()));
    bus.on(EV.ORE_COLLECTED, () => this.pickup());
    bus.on(EV.CONSUMABLE_USED, (k) => { if (k === 'cell') this.cell(); });
    bus.on(EV.CARGO_FULL, () => this.shopError());
    void getWorld;
  }

  // ---------- Mining ----------

  /** Material-aware hit: brightness/resonance rise with hardness. */
  mineHit(type, ore, x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const t = e.now; const p = e.jp(); const g = e.jg();
    const key = MATERIALS[type] ? MATERIALS[type].sfx : 'soil';
    const M = AUDIO.MATERIAL;
    switch (key) {
      case 'soil': {
        const m = M.soil;
        e.noiseBurst(v, 'pink', 'bandpass', m.noiseLo * p, m.noiseHi * p, 1.2, t, m.dur, 0.6 * m.gain * g);
        e.osc(v, 'sine', m.thump * p, m.thumpEnd, t, m.dur * 0.9, 0.8 * m.gain * g);
        break;
      }
      case 'limestone': {
        const m = M.limestone;
        e.osc(v, 'triangle', m.tri * p, m.triEnd, t, 0.05, 0.5 * m.gain * g);
        e.noiseBurst(v, 'white', 'bandpass', m.noiseLo * p, m.noiseHi * p, 3, t, m.dur, 0.5 * m.gain * g);
        for (let k = 0; k < m.pebbles; k++) e.noiseBurst(v, 'white', 'highpass', m.pebbleHz, m.pebbleHz, 1, t + 0.02 + Math.random() * 0.12, 0.02, 0.25 * m.gain);
        break;
      }
      case 'granite':
      case 'basalt': {
        const m = key === 'granite' ? M.granite : M.basalt;
        this._fm(v, m.carrier * p, m.ratio, m.index, t, m.dur, 0.45 * m.gain * g);
        e.noiseBurst(v, 'white', 'bandpass', m.bp * p, m.bp * 0.7, m.q, t, m.dur * 0.7, 0.5 * m.gain * g);
        e.osc(v, 'sine', m.carrier * 0.5 * p, m.carrier * 0.3, t, 0.08, 0.4 * m.gain);
        break;
      }
      case 'mantle': {
        const m = M.mantle;
        for (const f of m.glass) e.osc(v, 'sine', f * p, f * p * 0.97, t, 0.12 + Math.random() * 0.1, 0.18 * m.gain * g);
        e.noiseBurst(v, 'white', 'highpass', 3000, 3000, 0.7, t, 0.05, 0.4 * m.gain);
        e.noiseBurst(v, 'white', 'highpass', m.hiss, m.hiss * 1.3, 0.5, t + 0.03, m.dur, 0.18 * m.gain, v.out, 0.05);
        break;
      }
      default: break;
    }
    if (ore) this._orePing(v, ore, t, p);
    e.commit(v);
  }

  /** Metallic ping pitched by ore; diamond adds a crystalline chime. */
  _orePing(v, ore, t, p) {
    const e = this.e;
    const o = /** @type {any} */ (ORES[ore]);
    if (!o.pitch) return;
    if (ore === ORE.DIAMOND) {
      for (let h = 1; h <= 4; h++) e.osc(v, 'sine', o.pitch * h * p, o.pitch * h * p, t + 0.01, 0.9 / h + 0.3, 0.12 / h);
    } else {
      e.osc(v, 'sine', o.pitch * p, o.pitch * p, t, 0.25, 0.14);
      e.osc(v, 'sine', o.pitch * 2.76 * p, o.pitch * 2.76 * p, t, 0.12, 0.06);
    }
  }

  /** Simple 2-op FM strike. */
  _fm(v, carrier, ratio, index, t, dur, peak) {
    const ctx = this.ctx; const e = this.e;
    const mod = ctx.createOscillator(); mod.frequency.value = carrier * ratio;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(index, t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.6);
    mod.connect(mg);
    const car = e.osc(v, 'sine', carrier * 1.6, carrier, t, dur, peak, v.out, 0.001);
    mg.connect(car.frequency);
    mod.start(t); mod.stop(t + dur + 0.05);
    v.nodes.push(mod, mg); v.sources.push(mod);
  }

  /** Unbreakable: inharmonic ringing clink, no debris. */
  clink(x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const t = e.now; const p = e.jp(); const m = AUDIO.MATERIAL.clink;
    m.partials.forEach((f, k) => e.osc(v, 'sine', f * p, f * p, t, m.decay, m.gain / (k + 1) * e.jg(), v.out, 0.001));
    e.noiseBurst(v, 'white', 'highpass', 6000, 6000, 1, t, 0.015, 0.2);
    e.commit(v);
  }

  /** Crumble + sub thud + debris clicks. */
  blockBreak(type, x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const t = e.now; const p = e.jp();
    const hard = MATERIALS[type] ? Math.min(5, MATERIALS[type].tier) : 1;
    e.noiseBurst(v, 'brown', 'lowpass', 900 * p + hard * 150, 150, 0.8, t, 0.45, 0.9 * e.jg());
    e.osc(v, 'sine', 60 * p, 35, t, 0.3, 0.7);
    const clicks = 4 + hard;
    for (let k = 0; k < clicks; k++) e.noiseBurst(v, 'white', 'bandpass', 2000 + hard * 500 + Math.random() * 1500, 2000, 4, t + 0.05 + Math.random() * 0.4, 0.025, 0.25);
    e.commit(v);
  }

  // ---------- Equipment ----------

  radar() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const ctx = this.ctx; const t = e.now;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.18;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
    delay.connect(fb); fb.connect(lp); lp.connect(delay); delay.connect(v.out);
    v.nodes.push(delay, fb, lp);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = 900;
    bp.connect(v.out); bp.connect(delay);
    v.nodes.push(bp);
    e.osc(v, 'sine', 1200, 600, t, 0.5, 0.5, bp);
    // silent keep-alive so the echo tail is not cut before cleanup
    e.osc(v, 'sine', 20, 20, t, 1.6, 0.0002);
    e.commit(v);
  }

  /** Hissing fuse with accelerating beeps for the whole fuse duration. */
  fuse(x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const t = e.now; const dur = DYNAMITE.FUSE;
    e.noiseBurst(v, 'white', 'highpass', 3500, 5000, 0.7, t, dur, 0.12, v.out, 0.05);
    let at = 0; let gap = 0.5;
    while (at < dur - 0.05) {
      e.osc(v, 'square', 1800, 1800, t + at, 0.05, 0.06);
      at += gap; gap = Math.max(0.06, gap * 0.78);
    }
    e.commit(v);
  }

  explosion(x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const ctx = this.ctx; const t = e.now;
    if (!this.boomCurve) this.boomCurve = distortionCurve(60);
    const ws = ctx.createWaveShaper(); ws.curve = this.boomCurve; ws.oversample = '4x';
    ws.connect(v.out); v.nodes.push(ws);
    e.osc(v, 'sine', 90, 40, t, 1.2, 0.9, ws);
    e.noiseBurst(v, 'brown', 'lowpass', 400, 80, 0.7, t, 1.2, 1.0);
    e.noiseBurst(v, 'white', 'lowpass', 3000, 300, 0.7, t, 0.3, 0.5);
    e.commit(v);
    e.duck();
  }

  teleport() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const t = e.now;
    this._fm(v, 200, 2.01, 300, t, 0.9, 0.25);
    const ctx = this.ctx;
    const last = v.sources[v.sources.length - 2];
    if (last && /** @type {any} */ (last).frequency) /** @type {OscillatorNode} */ (last).frequency.exponentialRampToValueAtTime(1600, t + 0.8);
    void ctx;
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, k) => e.osc(v, 'triangle', f, f, t + 0.08 * k, 0.5, 0.08));
    e.commit(v);
  }

  cell() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const t = e.now;
    e.osc(v, 'sawtooth', 120, 240, t, 0.35, 0.15);
    e.noiseBurst(v, 'white', 'bandpass', 800, 5000, 4, t, 0.35, 0.3);
    e.commit(v);
  }

  lowEnergy() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('ui'); if (!v) return;
    const ctx = this.ctx; const t = e.now;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    lp.connect(v.out); v.nodes.push(lp);
    e.osc(v, 'square', AUDIO.LOW_BEEP_HZ, AUDIO.LOW_BEEP_HZ, t, 0.15, 0.12, lp);
    e.osc(v, 'square', AUDIO.LOW_BEEP_HZ * 0.84, AUDIO.LOW_BEEP_HZ * 0.84, t + 0.2, 0.15, 0.12, lp);
    e.commit(v);
  }

  footstep(material) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const hz = /** @type {any} */ (AUDIO.FOOTSTEP_HZ)[material] || AUDIO.FOOTSTEP_HZ[0];
    e.noiseBurst(v, 'pink', 'bandpass', hz * e.jp(), hz * 0.7, 2, e.now, 0.07, 0.18 * e.jg());
    e.commit(v);
  }

  pickup() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('ui'); if (!v) return;
    e.osc(v, 'sine', 900 * e.jp(), 1400, e.now, 0.09, 0.08);
    e.commit(v);
  }

  shopChime() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('ui'); if (!v) return;
    const t = e.now;
    e.osc(v, 'sine', 880, 880, t, 0.4, 0.18); e.osc(v, 'sine', 1320, 1320, t + 0.08, 0.5, 0.15);
    e.commit(v);
  }

  shopError() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('ui'); if (!v) return;
    e.osc(v, 'square', 220, 180, e.now, 0.22, 0.08);
    e.commit(v);
  }

  uiClick() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('ui'); if (!v) return;
    e.osc(v, 'triangle', 1500, 1200, e.now, 0.04, 0.06);
    e.commit(v);
  }

  /** Celebratory stinger on pickaxe upgrades. */
  fanfare() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('ui'); if (!v) return;
    const t = e.now;
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, k) => { e.osc(v, 'sawtooth', f, f, t + k * 0.11, 0.35, 0.06); e.osc(v, 'triangle', f * 2, f * 2, t + k * 0.11, 0.3, 0.05); });
    [523, 659, 784, 1047].forEach((f) => e.osc(v, 'triangle', f, f, t + 0.5, 1.0, 0.07, v.out, 0.02));
    e.commit(v);
  }

  /** Jetpack thrust loop (persistent). @param {number} thrust 0..1 */
  setJet(thrust) {
    const e = this.e; if (!e.ready) return;
    const ctx = this.ctx;
    if (!this.jet) {
      const src = ctx.createBufferSource(); src.buffer = e.noise.brown; src.loop = true;
      const hp = ctx.createBufferSource(); hp.buffer = e.noise.white; hp.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = AUDIO.JET_BP; bp.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0;
      const hg = ctx.createGain(); hg.gain.value = 0.15;
      src.connect(bp); hp.connect(hg); hg.connect(bp); bp.connect(g); g.connect(e.buses.sfx);
      src.start(); hp.start();
      this.jet = { g, bp };
    }
    const t = ctx.currentTime;
    this.jet.g.gain.setTargetAtTime(thrust * AUDIO.JET_GAIN, t, 0.05);
    this.jet.bp.frequency.setTargetAtTime(AUDIO.JET_BP * (0.7 + thrust * 0.6), t, 0.1);
  }
}

/**
 * Depth-adaptive ambience: wind + birds (surface), drips + rumbles (caves),
 * magma bubbling + tectonic groans (mantle).
 */
export class Ambience {
  /** @param {import('./AudioEngine.js').AudioEngine} engine */
  constructor(engine) {
    this.e = engine;
    this.started = false;
    this.timers = { bird: 2, drip: 1, rumble: 6, bubble: 1, groan: 8 };
    this.depth = 0;
  }

  start() {
    const e = this.e; if (!e.ready || this.started) return;
    const ctx = /** @type {AudioContext} */ (e.ctx);
    this.started = true;
    const loop = (buf, type, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(e.buses.ambience); s.start();
      return { g, fl };
    };
    this.wind = loop(e.noise.brown, 'bandpass', 420, 0.6);
    this.cave = loop(e.noise.brown, 'lowpass', 140, 0.7);
    this.magma = loop(e.noise.pink, 'lowpass', 300, 1.5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(this.wind.fl.frequency); lfo.start();
  }

  /** @param {number} dt @param {number} d depth 0..1 (0 = surface) @param {boolean} surface */
  update(dt, d, surface) {
    const e = this.e; if (!e.ready) return;
    if (!this.started) this.start();
    const ctx = /** @type {AudioContext} */ (e.ctx); const t = ctx.currentTime;
    const mantle = Math.max(0, (d - 0.75) / 0.25);
    this.wind.g.gain.setTargetAtTime(surface ? 0.5 : Math.max(0, 0.15 - d), t, 0.5);
    this.cave.g.gain.setTargetAtTime(surface ? 0 : 0.25 + d * 0.2, t, 0.8);
    this.magma.g.gain.setTargetAtTime(mantle * 0.5, t, 0.8);
    const tm = this.timers;
    for (const k of Object.keys(tm)) /** @type {any} */ (tm)[k] -= dt;
    if (surface && tm.bird <= 0) { tm.bird = 2 + Math.random() * 5; this._bird(); }
    if (!surface && tm.drip <= 0) { tm.drip = 0.6 + Math.random() * 2.4; this._drip(); }
    if (!surface && tm.rumble <= 0) { tm.rumble = 7 + Math.random() * 10; this._rumble(); }
    if (mantle > 0 && tm.bubble <= 0) { tm.bubble = 0.2 + Math.random() * 0.8; this._bubble(mantle); }
    if (mantle > 0 && tm.groan <= 0) { tm.groan = 9 + Math.random() * 12; this._groan(); }
  }

  _bird() {
    const e = this.e; const v = e.voice('ambience'); if (!v) return;
    const t = e.now; const f = 2600 + Math.random() * 1200;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) e.osc(v, 'sine', f, f * 1.3, t + k * 0.12, 0.08, 0.05);
    e.commit(v);
  }

  _drip() {
    const e = this.e; const v = e.voice('ambience'); if (!v) return;
    const f = 1400 + Math.random() * 900;
    e.osc(v, 'sine', f, f * 0.5, e.now, 0.12, 0.09);
    e.commit(v);
  }

  _rumble() {
    const e = this.e; const v = e.voice('ambience'); if (!v) return;
    e.noiseBurst(v, 'brown', 'lowpass', 120, 60, 0.7, e.now, 3, 0.5, v.out, 1.2);
    e.commit(v);
  }

  _bubble(m) {
    const e = this.e; const v = e.voice('ambience'); if (!v) return;
    const f = 60 + Math.random() * 90;
    e.osc(v, 'sine', f, f * 2.2, e.now, 0.09, 0.25 * m);
    e.commit(v);
  }

  _groan() {
    const e = this.e; const v = e.voice('ambience'); if (!v) return;
    const ctx = /** @type {AudioContext} */ (e.ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    lp.connect(v.out); v.nodes.push(lp);
    e.osc(v, 'sawtooth', 42, 31, e.now, 4, 0.25, lp, 1.5);
    e.commit(v);
  }
}

