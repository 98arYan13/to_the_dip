/**
 * @module audio/Composer
 * Pure, seeded composition of one piece (form, harmony, pad, bass). No Web Audio, no Math.random: pass an rng.
 */
import { MUSIC } from './musicThemes.js';

/** Semitone offset of scale degree `deg` (>= 0), wrapping into higher octaves. @param {number[]} scale @param {number} deg */
export function degreeToSemis(scale, deg) {
  return scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
}

/** Depth-driven tempo, scale shift, lead density and delay feedback. d is clamped to 0..1 (NaN -> 0).
 * @returns {{ bpm:number, shift:number, leadChance:number, delayFb:number }} */
export function depthParams(theme, depth01) {
  const d = Number.isFinite(depth01) ? Math.min(1, Math.max(0, depth01)) : 0;
  return { bpm: theme.bpm * (1 - 0.25 * d), shift: Math.round(3 * d), leadChance: 0.6 - 0.3 * d, delayFb: 0.35 + 0.2 * d };
}

/** Fold a midi note by octaves into its voice's range. */
function fold(midi, voice) {
  const [lo, hi] = MUSIC.RANGE[voice];
  while (midi < lo) midi += 12;
  while (midi > hi) midi -= 12;
  return midi;
}

/** @param {() => number} rng @param {number} n @param {number} [avoid] index to skip */
function pickIndex(rng, n, avoid) {
  const i = Math.floor(rng() * (n - (avoid >= 0 && avoid < n ? 1 : 0)));
  return avoid >= 0 && i >= avoid ? i + 1 : i;
}

/**
 * @param {any} theme
 * @param {{ depth01?:number, targetSec?:number, avoid?:{ motif?:number, progression?:number } }} opts
 * @param {() => number} rng
 */
export function composePiece(theme, opts = {}, rng) {
  const { bpm, shift, delayFb } = depthParams(theme, opts.depth01);
  const [minSec, maxSec] = MUSIC.PIECE_SEC;
  const barSec = (MUSIC.BEATS_PER_BAR * 60) / bpm, beat = 60 / bpm;
  const targetSec = opts.targetSec ?? minSec + rng() * (maxSec - minSec);
  const even = (x) => Math.round(x / 2) * 2;
  const bars = Math.min(Math.max(even(targetSec / barSec), Math.ceil(minSec / barSec / 2) * 2), Math.floor(maxSec / barSec / 2) * 2);
  const duration = bars * barSec;

  // Section boundaries from cumulative shares, even and at least 2 bars apart.
  const sections = [];
  let cum = 0, start = 0;
  MUSIC.FORM.forEach(([name, share], i) => {
    cum += share;
    const end = i === MUSIC.FORM.length - 1 ? bars : Math.max(start + 2, even(cum * bars));
    sections.push({ name, startBar: start, bars: end - start, t0: start * barSec, t1: end * barSec });
    start = end;
  });

  const firstProgression = pickIndex(rng, theme.progressions.length, opts.avoid?.progression);
  const firstMotif = pickIndex(rng, theme.motifs.length, opts.avoid?.motif);
  const len = theme.scale.length;
  const note = (deg, voice, oct = 0) => fold(theme.root + degreeToSemis(theme.scale, deg - shift + len) - 12 + oct, voice);
  const events = [];
  const add = (t, dur, midi, voice, bar) => events.push({ t, dur, midi, voice, gain: MUSIC.GAIN[voice], bar });

  sections.forEach((sec, si) => {
    const prog = theme.progressions[si === 0 ? firstProgression : pickIndex(rng, theme.progressions.length)];
    const bass = sec.name === 'B' || sec.name === 'A2';
    for (let c = 0; c * MUSIC.CHORD_BARS < sec.bars; c++) {
      const deg = prog[c % prog.length], cBars = Math.min(MUSIC.CHORD_BARS, sec.bars - c * MUSIC.CHORD_BARS);
      const bar0 = sec.startBar + c * MUSIC.CHORD_BARS, t = bar0 * barSec;
      if (rng() < theme.padChance) for (const k of [0, 2, 4]) add(t, cBars * barSec, note(deg + k, 'pad'), 'pad', bar0);
      if (bass) for (let b = 0; b < cBars; b++) {
        const tb = t + b * barSec;
        add(tb, 2 * beat, note(deg, 'bass'), 'bass', bar0 + b);
        add(tb + 2 * beat, 2 * beat, note(rng() < 0.3 ? deg + 4 : deg, 'bass'), 'bass', bar0 + b);
      }
    }
  });
  events.sort((a, b) => a.t - b.t);
  return { themeId: theme.id, bpm, barSec, bars, duration, delayFb, firstMotif, firstProgression, sections, events };
}

/** Max notes sounding at once. @param {{t:number, dur:number}[]} events */
export function peakPolyphony(events) {
  const edges = events.flatMap((e) => [[e.t, 1], [e.t + e.dur, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let n = 0, peak = 0;
  for (const [, d] of edges) peak = Math.max(peak, (n += d));
  return peak;
}
