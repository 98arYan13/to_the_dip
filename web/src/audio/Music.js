/**
 * @module audio/Music
 * Generative score with one theme per layer (AUDIO.MUSIC.THEMES): a looping melody (lightly varied each pass)
 * through a stereo ping-pong delay, scheduled on the AudioContext clock with a look-ahead scheduler.
 */
import { AUDIO } from '../config.js';
import { midiToHz } from './DSP.js';
import { degreeToSemis } from './Composer.js';

const M = AUDIO.MUSIC;

export { degreeToSemis };

export class Music {
  /** @param {import('./AudioEngine.js').AudioEngine} engine */
  constructor(engine) {
    this.e = engine;
    this.started = false;
    this.nextTime = 0;
    this.timer = 0;
    this.step = 0;
    this.themeId = 0;
    this.theme = M.THEMES[0];
    this.pendingId = 0;
    this.pendingSince = 0;
  }

  start() {
    const e = this.e; if (!e.ready || this.started) return;
    const ctx = /** @type {AudioContext} */ (e.ctx);
    this.started = true;
    const out = e.buses.music;
    // Lead bus with stereo ping-pong delay
    this.lead = ctx.createGain(); this.lead.gain.value = 1;
    const dl = ctx.createDelay(2); const dr = ctx.createDelay(2);
    dl.delayTime.value = M.DELAY_TIME; dr.delayTime.value = M.DELAY_TIME;
    const fb = ctx.createGain(); fb.gain.value = M.DELAY_FB;
    const pl = ctx.createStereoPanner(); pl.pan.value = -0.8;
    const pr = ctx.createStereoPanner(); pr.pan.value = 0.8;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    this.lead.connect(out); this.lead.connect(dl);
    dl.connect(pl); pl.connect(wet); dl.connect(dr); dr.connect(pr); pr.connect(wet); dr.connect(fb); fb.connect(dl);
    wet.connect(out);

    this.nextTime = ctx.currentTime + 1;
    this.timer = window.setInterval(() => this._schedule(), M.TICK_MS);
  }

  /** Call every frame with the current layer (band material id, 0 = surface); switches theme once it has held. @param {number} id */
  setLayer(id) {
    const e = this.e; if (!this.started || !e.ctx || !M.THEMES[id]) return;
    const now = e.ctx.currentTime;
    if (id !== this.pendingId) { this.pendingId = id; this.pendingSince = now; }
    if (id === this.themeId || now - this.pendingSince < M.SWITCH_HOLD) return;
    this.themeId = id; this.theme = M.THEMES[id]; this.step = 0;
    // Fade the old melody's tail out, then bring the lead back for the new phrase.
    this.lead.gain.setTargetAtTime(0, now, 0.3);
    this.lead.gain.setTargetAtTime(1, now + 1.2, 0.3);
    this.nextTime = Math.max(this.nextTime, now + 1.2);
  }

  _schedule() {
    const e = this.e; const ctx = e.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.nextTime < ctx.currentTime + M.LOOKAHEAD) {
      const th = this.theme;
      const ch = th.melody[this.step % th.melody.length];
      if (ch !== '.') this._note(th, Number(ch), this.nextTime);
      this.step++;
      this.nextTime += th.beat;
    }
  }

  /** @param {any} th @param {number} deg @param {number} t */
  _note(th, deg, t) {
    const ctx = /** @type {AudioContext} */ (this.e.ctx);
    const r = Math.random();
    if (r < M.VARY / 2) return; // occasional rest so loops don't feel mechanical
    if (r < M.VARY) deg = Math.max(0, deg + (Math.random() < 0.5 ? -1 : 1));
    let semis = degreeToSemis(th.scale, deg);
    if (th.dissonant && Math.random() < 0.15) semis += M.DISSONANT[Math.floor(Math.random() * M.DISSONANT.length)];
    const f = midiToHz(th.root + th.oct + semis);
    const piano = th.wave === 'piano';
    const o = ctx.createOscillator(); o.frequency.value = f;
    // Piano-ish: a few decaying harmonics, no bright octave layer, near-instant hammer attack.
    if (piano) o.setPeriodicWave(this.pianoWave ||= ctx.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, 0.45, 0.2, 0.1, 0.05, 0.02])));
    else o.type = th.wave;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const g = ctx.createGain();
    const g2 = ctx.createGain(); g2.gain.value = piano ? 0 : 0.25;
    const peak = M.LEAD_GAIN * (th.gain ?? 1) * (0.75 + Math.random() * 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (piano ? 0.006 : 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + th.decay);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.lead);
    o.start(t); o2.start(t); o.stop(t + th.decay + 0.1); o2.stop(t + th.decay + 0.1);
    o.onended = () => { o.disconnect(); o2.disconnect(); g.disconnect(); g2.disconnect(); };
  }

  stop() { clearInterval(this.timer); }
}
