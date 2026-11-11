/**
 * @module audio/Music
 * Generative ambient score: detuned saw/sine drone through LFO-modulated low-pass filters,
 * a sub drone that grows with depth, and a sparse minor-pentatonic lead through a stereo
 * ping-pong delay, scheduled on the AudioContext clock with a look-ahead scheduler.
 */
import { AUDIO } from '../config.js';
import { midiToHz } from './DSP.js';

const M = AUDIO.MUSIC;

export class Music {
  /** @param {import('./AudioEngine.js').AudioEngine} engine */
  constructor(engine) {
    this.e = engine;
    this.started = false;
    this.depth = 0;
    this.nextTime = 0;
    this.timer = 0;
    this.rootMidi = M.ROOT_SURFACE_MIDI;
    this.lastNote = 0;
  }

  start() {
    const e = this.e; if (!e.ready || this.started) return;
    const ctx = /** @type {AudioContext} */ (e.ctx);
    this.started = true;
    const out = e.buses.music;

    // Drone
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = 2;
    this.filter.frequency.value = M.CUTOFF_SURFACE;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = M.DRONE_GAIN;
    this.filter.connect(this.droneGain); this.droneGain.connect(out);
    const f = midiToHz(this.rootMidi);
    this.saw1 = ctx.createOscillator(); this.saw1.type = 'sawtooth'; this.saw1.frequency.value = f;
    this.saw2 = ctx.createOscillator(); this.saw2.type = 'sawtooth'; this.saw2.frequency.value = f * M.DETUNE;
    this.sine = ctx.createOscillator(); this.sine.type = 'sine'; this.sine.frequency.value = f * 1.5;
    const sg = ctx.createGain(); sg.gain.value = 0.5;
    this.saw1.connect(this.filter); this.saw2.connect(this.filter); this.sine.connect(sg); sg.connect(this.filter);
    const lfo = ctx.createOscillator(); lfo.frequency.value = M.LFO_HZ;
    this.lfoGain = ctx.createGain(); this.lfoGain.gain.value = M.CUTOFF_SURFACE * M.LFO_DEPTH;
    lfo.connect(this.lfoGain); this.lfoGain.connect(this.filter.frequency);
    // Sub drone
    this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = f / 2;
    this.subGain = ctx.createGain(); this.subGain.gain.value = 0;
    this.sub.connect(this.subGain); this.subGain.connect(out);
    for (const o of [this.saw1, this.saw2, this.sine, lfo, this.sub]) o.start();

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

  /** @param {number} d 0 = surface … 1 = core */
  setDepth(d) {
    const e = this.e; if (!this.started || !e.ctx) return;
    if (Math.abs(d - this.depth) < 0.005) return;
    this.depth = d;
    const t = e.ctx.currentTime;
    const cutoff = M.CUTOFF_SURFACE + (M.CUTOFF_DEEP - M.CUTOFF_SURFACE) * d;
    this.filter.frequency.setTargetAtTime(cutoff, t, 1.5);
    this.lfoGain.gain.setTargetAtTime(cutoff * M.LFO_DEPTH, t, 1.5);
    this.rootMidi = Math.round(M.ROOT_SURFACE_MIDI + (M.ROOT_DEEP_MIDI - M.ROOT_SURFACE_MIDI) * d);
    const f = midiToHz(this.rootMidi);
    this.saw1.frequency.setTargetAtTime(f, t, 2);
    this.saw2.frequency.setTargetAtTime(f * M.DETUNE, t, 2);
    this.sine.frequency.setTargetAtTime(f * (d > M.DISSONANCE_START ? Math.pow(2, 6 / 12) : 1.5), t, 3);
    this.sub.frequency.setTargetAtTime(f / 2, t, 2);
    this.subGain.gain.setTargetAtTime(M.SUB_MAX * d, t, 2);
  }

  _schedule() {
    const e = this.e; const ctx = e.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.nextTime < ctx.currentTime + M.LOOKAHEAD) {
      if (Math.random() < M.LEAD_PROB) this._note(this.nextTime);
      this.nextTime += M.BEAT * (1 + Math.floor(Math.random() * 3));
    }
  }

  _note(t) {
    const ctx = /** @type {AudioContext} */ (this.e.ctx);
    let interval = M.SCALE[Math.floor(Math.random() * M.SCALE.length)];
    if (this.depth > M.DISSONANCE_START && Math.random() < 0.35) interval = M.DISSONANT[Math.floor(Math.random() * M.DISSONANT.length)];
    const octave = 24 + (Math.random() < 0.3 ? 12 : 0) - Math.round(this.depth * 7);
    const f = midiToHz(this.rootMidi + octave + interval);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const g = ctx.createGain();
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const peak = M.LEAD_GAIN * (0.7 + Math.random() * 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + M.LEAD_DECAY);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.lead);
    o.start(t); o2.start(t); o.stop(t + M.LEAD_DECAY + 0.1); o2.stop(t + M.LEAD_DECAY + 0.1);
    o.onended = () => { o.disconnect(); o2.disconnect(); g.disconnect(); g2.disconnect(); };
  }

  stop() { clearInterval(this.timer); }
}
