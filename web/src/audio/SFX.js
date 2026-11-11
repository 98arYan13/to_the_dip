/**
 * @module audio/SFX
 * Material-aware synthesized sound effects (transient + body + tail per hit), equipment and UI
 * sounds, the jetpack loop and the depth-adaptive ambience bed.
 */
import { AUDIO, TILE, ORES, DYNAMITE } from '../config.js';
import { EV } from '../core/EventBus.js';
import { distortionCurve } from './DSP.js';

/** Ores that snap like glass rather than ring like metal. */
const CRYSTAL = new Set(['LITHIUM', 'LAPIS', 'BLACK_OPAL', 'RUBY', 'DIAMOND']);
/** Ores with no resonant mode (porous / organic). */
const DULL = new Set(['COAL', 'FOSSIL']);

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
    bus.on(EV.SWING, () => this.swing());
    bus.on(EV.HARD_LANDING, (h) => this.impact(h.damage));
    bus.on(EV.SOLD, () => this.shopChime());
    bus.on(EV.PURCHASE_FAILED, () => this.shopError());
    bus.on(EV.UPGRADE_BOUGHT, (u) => (u.kind === 'pickaxe' ? this.fanfare() : this.shopChime()));
    bus.on(EV.ORE_COLLECTED, () => this.pickup());
    bus.on(EV.CONSUMABLE_USED, (k) => { if (k === 'cell') this.cell(); });
    bus.on(EV.CARGO_FULL, () => this.shopError());
    void getWorld;
  }

  // ---------- Mining ----------

  /** Pickaxe hit: soil gets a compaction thump + clods, everything else a rock crack + steel ring. */
  mineHit(type, ore, x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const t = e.now; const p = e.jp(); const g = e.jg();
    if (type === TILE.SOIL && !ore) {
      // Blade into packed earth: a noise-only dull thud (no tonal sine), a granular crunch whose
      // grains thin out over ~160 ms, then loose soil trickling off the blade.
      const r = 0.9 + Math.random() * 0.2;
      e.noiseBurst(v, 'brown', 'lowpass', 320 * p * r, 90, 0.9, t, 0.07, 0.9 * g, v.out, 0.001); // impact thud
      e.noiseBurst(v, 'pink', 'bandpass', 900 * p * r, 500, 1.2, t, 0.05, 0.35 * g); // blade bite
      const grains = 14 + Math.floor(Math.random() * 6);
      for (let k = 0; k < grains; k++) { // crunch: dense at first, sparser later
        const at = t + 0.004 + Math.pow(k / grains, 1.6) * 0.16 + Math.random() * 0.006;
        const f = 700 + Math.random() * 2600;
        e.noiseBurst(v, 'white', 'bandpass', f * p, f * p, 4 + Math.random() * 6, at, 0.008 + Math.random() * 0.012, (0.18 - 0.1 * k / grains) * g);
      }
      e.noiseBurst(v, 'pink', 'lowpass', 1800 * p, 500, 0.7, t + 0.05, 0.28, 0.16 * g, v.out, 0.04); // trickle
    } else {
      e.noiseBurst(v, 'white', 'bandpass', 2100 * p, 2100 * p, 1.4, t, 0.022, 0.7 * g); // stone-crack transient
      e.osc(v, 'triangle', 195 * p, 52, t, 0.11, 0.6 * g); // rock body thwack
      [[2480, 0.058], [3920, 0.042], [5640, 0.028]].forEach(([f, d], k) => e.osc(v, 'sine', f * p, f * p, t, d, 0.12 / (k + 1), v.out, 0.001)); // steel head
      for (let k = 0; k < 3; k++) { const f = 3000 + Math.random() * 3000; e.noiseBurst(v, 'white', 'bandpass', f, f, 8, t + 0.03 + Math.random() * 0.07, 0.012, 0.15 * g); } // grit
      if (ore) this._mineralMode(v, ore, t, p);
    }
    e.commit(v);
  }

  /** Short damped mineral density modes: metallic for ores, vitreous snap for crystals. */
  _mineralMode(v, ore, t, p) {
    const e = this.e;
    const key = /** @type {any} */ (ORES[ore]).key;
    if (CRYSTAL.has(key)) {
      for (let k = 0; k < 3; k++) { const f = 3350 + Math.random() * 1470; e.osc(v, 'sine', f * p, f * p * 0.98, t + 0.004 * k, 0.05 + 0.02 * k, 0.09, v.out, 0.001); }
    } else if (!DULL.has(key)) {
      for (let k = 0; k < 2; k++) { const f = 1420 + Math.random() * 260; e.osc(v, 'sine', f * p, f * p, t, 0.07, 0.1, v.out, 0.001); }
    }
  }

  /** Air swing: low-mid displacement whoosh, 140 -> 420 -> 110 Hz bandpass over 125 ms. */
  swing() {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const t = e.now; const p = e.jp();
    e.noiseBurst(v, 'pink', 'bandpass', 140 * p, 140 * p, 1.1, t, 0.125, 0.16 * e.jg(), v.out, 0.04);
    const f = /** @type {BiquadFilterNode} */ (v.nodes[v.nodes.length - 2]).frequency;
    f.linearRampToValueAtTime(420 * p, t + 0.05);
    f.exponentialRampToValueAtTime(110 * p, t + 0.125);
    e.commit(v);
  }

  /** Hard landing: sawtooth chassis slam + crunch + two-tone suit warning. @param {number} damage */
  impact(damage) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const ctx = this.ctx; const t = e.now;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    lp.connect(v.out); v.nodes.push(lp);
    const loud = Math.min(1, 0.5 + damage / 40);
    e.osc(v, 'sawtooth', 135, 28, t, 0.35, 0.7 * loud, lp);
    e.noiseBurst(v, 'brown', 'lowpass', 1200, 200, 0.7, t, 0.18, 0.8 * loud);
    for (let k = 0; k < 2; k++) {
      e.osc(v, 'square', 880, 880, t + 0.25 + k * 0.3, 0.12, 0.06);
      e.osc(v, 'square', 620, 620, t + 0.4 + k * 0.3, 0.12, 0.06);
    }
    e.commit(v);
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

  /**
   * Block gives way. Soil: heavy slump of earth + clods thudding + long dry trickle (~0.6 s).
   * Rock: sharp fracture crack, sub boom, then 8-12 stone chunks clacking with short resonant knocks.
   */
  blockBreak(type, x, y) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx', x, y); if (!v) return;
    const t = e.now; const p = e.jp(); const g = e.jg();
    if (type === TILE.SOIL) {
      e.noiseBurst(v, 'brown', 'lowpass', 600 * p, 110, 0.8, t, 0.35, 1.0 * g, v.out, 0.01); // earth slump
      for (let k = 0; k < 5; k++) { // clods landing
        const at = t + 0.06 + k * 0.06 + Math.random() * 0.04;
        e.noiseBurst(v, 'brown', 'lowpass', (260 + Math.random() * 200) * p, 80, 1, at, 0.06, (0.5 - k * 0.07) * g);
      }
      for (let k = 0; k < 22; k++) { // dry grains pouring
        const at = t + 0.05 + Math.pow(k / 22, 1.3) * 0.5 + Math.random() * 0.01;
        const f = 1200 + Math.random() * 3200;
        e.noiseBurst(v, 'white', 'bandpass', f, f, 6, at, 0.01, 0.1 * (1 - k / 26) * g);
      }
      e.noiseBurst(v, 'pink', 'lowpass', 2200 * p, 400, 0.6, t + 0.08, 0.55, 0.22 * g, v.out, 0.08); // sliding soil hiss
    } else {
      e.noiseBurst(v, 'white', 'highpass', 2500 * p, 1500, 0.8, t, 0.03, 0.9 * g); // fracture crack
      e.noiseBurst(v, 'white', 'bandpass', 1400 * p, 700, 2, t + 0.008, 0.05, 0.5 * g); // split
      e.osc(v, 'sine', 70 * p, 32, t, 0.4, 0.9 * g); // sub boom
      e.noiseBurst(v, 'brown', 'lowpass', 1100 * p, 150, 0.7, t + 0.02, 0.45, 0.7 * g, v.out, 0.01); // crumble roar
      const n = 8 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) { // stone chunks clacking
        const at = t + 0.05 + (k / n) * 0.42 + Math.random() * 0.03;
        const f = 500 + Math.random() * 1400; const a = (0.35 * (1 - k / n) + 0.08) * g;
        e.noiseBurst(v, 'white', 'bandpass', f * 2, f * 1.6, 5, at, 0.02, a);
        e.osc(v, 'triangle', f * p, f * 0.7 * p, at, 0.04, a * 0.5, v.out, 0.001); // knock resonance
      }
    }
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

  /** Dirt: crunchy 520 Hz bandpass burst. Rock: 900 Hz highpass tick + 140 Hz triangle thud. */
  footstep(material) {
    const e = this.e; if (!e.ready) return;
    const v = e.voice('sfx'); if (!v) return;
    const t = e.now; const p = e.jp(); const g = e.jg();
    if (material === TILE.SOIL || material === TILE.AIR) {
      e.noiseBurst(v, 'pink', 'bandpass', 520 * p, 520 * p, 1.6, t, 0.08, 0.2 * g);
    } else {
      e.noiseBurst(v, 'white', 'highpass', 900 * p, 900 * p, 0.7, t, 0.03, 0.12 * g);
      e.osc(v, 'triangle', 140 * p, 90, t, 0.06, 0.18 * g);
    }
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

  /** Jetpack loop: pink noise through a modulated 320-600 Hz bandpass + 62-94 Hz sawtooth turbine. @param {number} thrust 0..1 */
  setJet(thrust) {
    const e = this.e; if (!e.ready) return;
    const ctx = this.ctx;
    if (!this.jet) {
      const src = ctx.createBufferSource(); src.buffer = e.noise.pink; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 460; bp.Q.value = 1.2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
      const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 140; // 460 +/- 140 -> 320-600 Hz
      lfo.connect(lfoAmt); lfoAmt.connect(bp.frequency);
      const turbine = ctx.createOscillator(); turbine.type = 'sawtooth'; turbine.frequency.value = 62;
      const tlp = ctx.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 400;
      const tg = ctx.createGain(); tg.gain.value = 0.35;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(g);
      turbine.connect(tlp); tlp.connect(tg); tg.connect(g);
      g.connect(e.buses.sfx);
      src.start(); lfo.start(); turbine.start();
      this.jet = { g, turbine };
    }
    const t = ctx.currentTime;
    this.jet.g.gain.setTargetAtTime(thrust * AUDIO.JET_GAIN, t, 0.05);
    this.jet.turbine.frequency.setTargetAtTime(62 + thrust * 32, t, 0.25);
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

