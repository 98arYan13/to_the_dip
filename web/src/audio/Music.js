/**
 * @module audio/Music
 * Plays the generative score: MusicDirector decides, Composer writes the pieces, a look-ahead scheduler on the
 * AudioContext clock turns notes into Web Audio voices. Graph per piece:
 * voices -> pieceGain -> storyGain (pulse) -> low-pass -> music bus (lead/sparkle also via a ping-pong delay).
 */
import { MUSIC, THEMES } from './musicThemes.js';
import { midiToHz } from './DSP.js';
import { composePiece, degreeToSemis } from './Composer.js';
import { MusicDirector } from './Director.js';
import { mulberry32 } from '../core/RNG.js';

export { degreeToSemis };

/** Pure: splits a queue of absolute-time events. Past events (t < now - 0.05) are dropped, not played. */
export function dueEvents(queue, now, lookahead) {
  const play = [], rest = [];
  let dropped = 0;
  for (const ev of queue) {
    if (ev.t < now - 0.05) dropped++;
    else if (ev.t < now + lookahead) play.push(ev);
    else rest.push(ev);
  }
  return { play, rest, dropped };
}

const ADSR = (g, t, peak, atk, dur, rel) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + atk);
  g.gain.setTargetAtTime(0.0001, t + Math.max(atk, dur), rel / 3);
};

/** Instruments: (ctx, midi, t, dur, gain, dest, theme, cache) -> source nodes to stop plus all nodes to disconnect. */
const INSTRUMENTS = {
  piano(c, f, t, dur, peak, dest, th, cache) {
    const o = c.createOscillator(), g = c.createGain();
    o.setPeriodicWave(cache.piano ||= c.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, 0.45, 0.2, 0.1, 0.05, 0.02])));
    o.frequency.value = f; ADSR(g, t, peak, 0.006, 0.05, Math.max(dur, 1.5));
    o.connect(g); g.connect(dest); return { src: [o], nodes: [o, g], end: t + Math.max(dur, 1.5) + 0.6 };
  },
  glass(c, f, t, dur, peak, dest) {
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o.frequency.value = f; o2.frequency.value = f * 2; g2.gain.value = 0.25;
    ADSR(g, t, peak, 0.03, dur * 0.5, Math.max(dur, 1.2));
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    return { src: [o, o2], nodes: [o, o2, g, g2], end: t + dur * 0.5 + Math.max(dur, 1.2) + 0.6 };
  },
  reed(c, f, t, dur, peak, dest) {
    const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1800;
    ADSR(g, t, peak * 0.6, 0.05, dur, 0.4);
    o.connect(lp); lp.connect(g); g.connect(dest); return { src: [o], nodes: [o, lp, g], end: t + dur + 0.8 };
  },
  bell(c, f, t, dur, peak, dest) {
    const o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    o.frequency.value = f; m.frequency.value = f * 3.5; // 2-op FM, inharmonic ratio
    mg.gain.setValueAtTime(f * 1.5, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.2);
    m.connect(mg); mg.connect(o.frequency);
    ADSR(g, t, peak, 0.004, 0.02, Math.max(dur, 1.5));
    o.connect(g); g.connect(dest); return { src: [o, m], nodes: [o, m, mg, g], end: t + Math.max(dur, 1.5) + 0.6 };
  },
  sub(c, f, t, dur, peak, dest) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; ADSR(g, t, peak, 0.02, dur, 0.3);
    o.connect(g); g.connect(dest); return { src: [o], nodes: [o, g], end: t + dur + 0.6 };
  },
  warm(c, f, t, dur, peak, dest, th) {
    const o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 8;
    lp.type = 'lowpass'; lp.frequency.value = th.padCutoff * (th.padCutoffMul || 1);
    ADSR(g, t, peak * 0.5, 1.5, dur, 2);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
    return { src: [o, o2], nodes: [o, o2, lp, g], end: t + dur + 2.6 };
  },
};
const VOICE_INSTR = { pad: 'warm', bass: 'sub', sparkle: 'bell' };

const themeOf = (id) => { const [p, z] = id.split('.'); return THEMES[p]?.[z] ?? THEMES.tessera.deep; };

export class Music {
  /** @param {import('./AudioEngine.js').AudioEngine} engine */
  constructor(engine) {
    this.e = engine;
    this.started = false;
    this.timer = 0;
    this.queue = [];
    this.last = {};
    this.cur = null;
    this.cache = {};
    this.director = new MusicDirector(mulberry32(Date.now() >>> 0), { composePiece });
  }

  start() {
    const e = this.e; if (!e.ready || this.started) return;
    const ctx = /** @type {AudioContext} */ (e.ctx);
    this.started = true;
    this.story = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = MUSIC.BUS_LOWPASS_HZ;
    this.story.connect(lp); lp.connect(e.buses.music);
    this.timer = window.setInterval(() => this._tick(), MUSIC.TICK_MS);
  }

  /** Call every frame with the game context (same shape as MusicDirector.update). */
  setContext(ctx) { this.last = ctx; }

  onPulseWarn() {
    if (!this.started) return;
    const p = this.story.gain, t = this.e.ctx.currentTime;
    p.cancelScheduledValues(t); p.setTargetAtTime(0, t, MUSIC.PULSE_FADE / 3);
  }

  onPulse() {
    if (!this.started) return;
    const p = this.story.gain, t = this.e.ctx.currentTime;
    p.cancelScheduledValues(t); p.setTargetAtTime(1, t + MUSIC.PULSE_RETURN_DELAY, MUSIC.PULSE_RETURN_FADE / 3);
  }

  /** New pieceGain + ping-pong delay for one piece, so a late fade of the old piece never silences the new one. */
  _newPiece(piece, at) {
    const ctx = /** @type {AudioContext} */ (this.e.ctx);
    const gain = ctx.createGain(), lead = ctx.createGain();
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain(), wet = ctx.createGain();
    const pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner();
    dl.delayTime.value = dr.delayTime.value = MUSIC.DELAY_TIME; fb.gain.value = piece.delayFb ?? 0.4; wet.gain.value = 0.5;
    pl.pan.value = -0.8; pr.pan.value = 0.8;
    lead.connect(gain); lead.connect(dl);
    dl.connect(pl); pl.connect(wet); dl.connect(dr); dr.connect(pr); pr.connect(wet); dr.connect(fb); fb.connect(dl);
    wet.connect(gain); gain.connect(this.story);
    const cur = { gain, lead, theme: themeOf(piece.themeId), nodes: [gain, lead, dl, dr, fb, wet, pl, pr] };
    // Free the graph once the piece and its delay tail are long gone.
    setTimeout(() => cur.nodes.forEach((n) => n.disconnect()), (at + piece.duration + 12 - ctx.currentTime) * 1000);
    return cur;
  }

  _tick() {
    const ctx = this.e.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const c of this.director.update(now, this.last)) {
      if (c.type === 'play') {
        this.cur = this._newPiece(c.piece, c.at);
        for (const ev of c.piece.events) this.queue.push({ ...ev, t: c.at + ev.t, piece: this.cur });
      } else if (c.type === 'fade' && this.cur) {
        this.cur.gain.gain.setTargetAtTime(0, c.at, c.sec / 4);
        const end = c.at + c.sec; // notes after the fade would be inaudible anyway
        this.queue = this.queue.filter((ev) => ev.piece !== this.cur || ev.t < end);
      } else if (c.type === 'phrase' && this.cur) {
        for (const ev of c.events) this.queue.push({ ...ev, voice: 'sparkle', t: c.at + ev.t, piece: this.cur });
      }
    }
    const { play, rest } = dueEvents(this.queue, now, MUSIC.LOOKAHEAD);
    this.queue = rest;
    for (const ev of play) this._note(ev);
  }

  _note(ev) {
    const ctx = /** @type {AudioContext} */ (this.e.ctx), p = ev.piece, th = p.theme;
    const name = VOICE_INSTR[ev.voice] ?? th.lead, wet = ev.voice === 'lead' || ev.voice === 'sparkle';
    const n = INSTRUMENTS[name](ctx, midiToHz(ev.midi), ev.t, ev.dur, MUSIC.LEAD_GAIN * ev.gain, wet ? p.lead : p.gain, th, this.cache);
    n.src.forEach((o) => { o.start(ev.t); o.stop(n.end); });
    n.src[0].onended = () => n.nodes.forEach((x) => x.disconnect());
  }

  stop() { clearInterval(this.timer); }
}
