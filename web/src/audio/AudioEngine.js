/**
 * @module audio/AudioEngine
 * AudioContext, bus graph (music/sfx/ui/ambience → master → compressor → soft-clip → out),
 * depth-crossfaded convolution reverb, voice manager with steal-oldest, and spatialisation.
 */
import { AUDIO } from '../config.js';
import { makeNoiseBuffer, makeImpulse, softClipCurve, dbToGain } from './DSP.js';

/**
 * @typedef {Object} Voice
 * @property {string} cat
 * @property {GainNode} out
 * @property {StereoPannerNode} pan
 * @property {AudioNode[]} nodes
 * @property {AudioScheduledSourceNode[]} sources
 * @property {number} start
 * @property {boolean} done
 */

export class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {Record<string, GainNode>} */
    this.buses = {};
    /** @type {Record<string, Voice[]>} */
    this.voices = { sfx: [], ui: [], ambience: [] };
    /** @type {Record<string, AudioBuffer>} */
    this.noise = {};
    this.listenerX = 0; this.listenerY = 0;
    this.sp = { pan: 0, gain: 1 };
    this.volumes = { master: AUDIO.MASTER, music: AUDIO.MUSIC, sfx: AUDIO.SFX, ui: AUDIO.UI, ambience: AUDIO.AMBIENCE };
    this.muted = false;
    this.depth = -1;
  }

  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    const c = AUDIO.COMPRESSOR;
    comp.threshold.value = c.threshold; comp.knee.value = c.knee; comp.ratio.value = c.ratio;
    comp.attack.value = c.attack; comp.release.value = c.release;
    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve(AUDIO.SOFTCLIP);
    clip.oversample = '2x';
    this.master.connect(comp); comp.connect(clip); clip.connect(ctx.destination);

    for (const name of ['music', 'sfx', 'ui', 'ambience']) this.buses[name] = ctx.createGain();
    this.duckNode = ctx.createGain();
    this.buses.music.connect(this.duckNode); this.duckNode.connect(this.master);
    this.buses.sfx.connect(this.master); this.buses.ui.connect(this.master); this.buses.ambience.connect(this.master);

    // Reverb: one send, two convolvers crossfaded by depth
    const r = AUDIO.REVERB;
    this.send = ctx.createGain(); this.send.gain.value = r.SEND;
    this.tunnel = ctx.createConvolver(); this.tunnel.buffer = makeImpulse(ctx, r.TUNNEL_SEC, r.TUNNEL_DECAY, 11);
    this.open = ctx.createConvolver(); this.open.buffer = makeImpulse(ctx, r.OPEN_SEC, r.OPEN_DECAY, 13);
    this.wetTunnel = ctx.createGain(); this.wetOpen = ctx.createGain();
    this.wetTunnel.gain.value = 0; this.wetOpen.gain.value = 1;
    this.send.connect(this.tunnel); this.tunnel.connect(this.wetTunnel); this.wetTunnel.connect(this.master);
    this.send.connect(this.open); this.open.connect(this.wetOpen); this.wetOpen.connect(this.master);
    this.buses.sfx.connect(this.send); this.buses.ambience.connect(this.send); this.buses.music.connect(this.send);

    this.noise.white = makeNoiseBuffer(ctx, 'white', AUDIO.NOISE_SECONDS, 3);
    this.noise.pink = makeNoiseBuffer(ctx, 'pink', AUDIO.NOISE_SECONDS, 5);
    this.noise.brown = makeNoiseBuffer(ctx, 'brown', AUDIO.NOISE_SECONDS, 9);

    this.applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  /** @param {Partial<typeof this.volumes>} v */
  setVolumes(v) { Object.assign(this.volumes, v); this.applyVolumes(); }

  setMuted(m) { this.muted = m; this.applyVolumes(); }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, t, 0.02);
    for (const name of ['music', 'sfx', 'ui', 'ambience']) this.buses[name].gain.setTargetAtTime(/** @type {any} */ (this.volumes)[name], t, 0.02);
  }

  /** Crossfade open-air ↔ tunnel reverb. @param {number} d 0 = surface, >0 underground */
  setDepth(d) {
    if (!this.ctx) return;
    const under = d > 0.01 ? 1 : 0;
    if (under === this.depth) return;
    this.depth = under;
    const t = this.ctx.currentTime;
    this.wetTunnel.gain.setTargetAtTime(under, t, AUDIO.REVERB.FADE);
    this.wetOpen.gain.setTargetAtTime(1 - under, t, AUDIO.REVERB.FADE);
  }

  /** Duck the music bus under loud events. */
  duck(db = AUDIO.DUCK_DB, time = AUDIO.DUCK_TIME) {
    if (!this.ctx) return;
    const g = this.duckNode.gain; const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(dbToGain(-db), t + 0.03);
    g.setTargetAtTime(1, t + time * 0.4, time * 0.3);
  }

  /** Pan/gain for a world position relative to the listener (reused object). */
  spatial(x, y) {
    const dx = x - this.listenerX; const dy = y - this.listenerY;
    const d = Math.sqrt(dx * dx + dy * dy);
    this.sp.pan = Math.max(-1, Math.min(1, dx / AUDIO.PAN_RANGE));
    this.sp.gain = Math.max(0, 1 - d / AUDIO.HEAR_RADIUS);
    return this.sp;
  }

  /** ±jitter multiplier for pitch. */
  jp() { return 1 + (Math.random() * 2 - 1) * AUDIO.PITCH_JITTER; }
  /** ±jitter multiplier for gain. */
  jg() { return 1 + (Math.random() * 2 - 1) * AUDIO.GAIN_JITTER; }

  /**
   * Start a voice in a category; steals the oldest if over the limit.
   * @param {'sfx'|'ui'|'ambience'} cat
   * @param {number} [x] @param {number} [y] world position (omit for non-spatial)
   * @returns {Voice|null}
   */
  voice(cat, x, y) {
    const ctx = this.ctx;
    if (!ctx) return null;
    let gain = 1; let pan = 0;
    if (x !== undefined && y !== undefined) {
      const s = this.spatial(x, y);
      if (s.gain <= 0.01) return null;
      gain = s.gain; pan = s.pan;
    }
    const list = this.voices[cat];
    if (list.length >= AUDIO.MAX_VOICES[cat]) {
      const old = list.shift();
      if (old) this._kill(old);
    }
    const out = ctx.createGain();
    out.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    out.connect(p); p.connect(this.buses[cat]);
    /** @type {Voice} */
    const v = { cat, out, pan: p, nodes: [out, p], sources: [], start: ctx.currentTime, done: false };
    list.push(v);
    return v;
  }

  /** Arm cleanup once all sources of the voice have ended. @param {Voice|null} v */
  commit(v) {
    if (!v) return;
    let remaining = v.sources.length;
    if (remaining === 0) { this._cleanup(v); return; }
    for (const s of v.sources) {
      s.onended = () => { if (--remaining === 0) this._cleanup(v); };
    }
  }

  /** @param {Voice} v */
  _kill(v) {
    if (!this.ctx || v.done) return;
    const t = this.ctx.currentTime;
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(v.out.gain.value, t);
    v.out.gain.linearRampToValueAtTime(0, t + 0.03);
    for (const s of v.sources) { try { s.stop(t + 0.04); } catch { /* already stopped */ } }
  }

  /** @param {Voice} v */
  _cleanup(v) {
    if (v.done) return;
    v.done = true;
    for (const n of v.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    v.nodes.length = 0; v.sources.length = 0;
    const list = this.voices[v.cat];
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
  }

  /** Active voice count (debug). */
  get voiceCount() { return this.voices.sfx.length + this.voices.ui.length + this.voices.ambience.length; }

  // ---------- building blocks used by SFX/Music ----------

  /**
   * Oscillator with exponential envelope routed into `dest`.
   * @param {Voice} v
   */
  osc(v, type, f0, f1, t0, dur, peak, dest = v.out, attack = 0.002) {
    const ctx = /** @type {AudioContext} */ (this.ctx);
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
    v.nodes.push(o, g); v.sources.push(o);
    return o;
  }

  /**
   * Filtered noise burst routed into `dest`.
   * @param {Voice} v @param {'white'|'pink'|'brown'} kind @param {BiquadFilterType} ftype
   */
  noiseBurst(v, kind, ftype, f0, f1, q, t0, dur, peak, dest = v.out, attack = 0.002) {
    const ctx = /** @type {AudioContext} */ (this.ctx);
    const src = ctx.createBufferSource();
    src.buffer = this.noise[kind]; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(10, f0), t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0, Math.random() * (AUDIO.NOISE_SECONDS - 0.1)); src.stop(t0 + dur + 0.05);
    v.nodes.push(src, f, g); v.sources.push(src);
    return src;
  }
}
