/**
 * @module audio/Composer
 * Pure, seeded composition of one piece (form, harmony, pad, bass). No Web Audio, no Math.random: pass an rng.
 */
import { MUSIC, THEMES, SIGNAL_MOTIF, signalLength } from './musicThemes.js';

/** Semitone offset of scale degree `deg` (>= 0), wrapping into higher octaves. @param {number[]} scale @param {number} deg */
export function degreeToSemis(scale, deg) {
  return scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
}

/** Depth-driven tempo, scale shift, lead density and delay feedback. d is clamped to 0..1 (NaN -> 0).
 * @returns {{ bpm:number, shift:number, leadChance:number, delayFb:number }} */
export function depthParams(theme, depth01) {
  const d = Math.min(1, Math.max(0, depth01 || 0)); // NaN -> 0, +-Infinity clamps
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
  const skip = n > 1 && avoid >= 0 && avoid < n;
  const i = Math.floor(rng() * (n - (skip ? 1 : 0)));
  return skip && i >= avoid ? i + 1 : i;
}

/**
 * @param {any} theme
 * @param {{ depth01?:number, targetSec?:number, avoid?:{ motif?:number, progression?:number } }} opts
 * @param {() => number} rng
 */
export function composePiece(theme, opts = {}, rng) {
  const { bpm, shift, delayFb, leadChance } = depthParams(theme, opts.depth01);
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
  const events = [], progs = [];
  const add = (t, dur, midi, voice, bar) => { const e = { t, dur, midi, voice, gain: MUSIC.GAIN[voice], bar }; events.push(e); return e; };

  sections.forEach((sec, si) => {
    const prog = theme.progressions[si === 0 ? firstProgression : pickIndex(rng, theme.progressions.length)];
    progs.push(prog);
    const bass = sec.name === 'B' || sec.name === 'A2';
    for (let c = 0; c * MUSIC.CHORD_BARS < sec.bars; c++) {
      const deg = prog[c % prog.length], cBars = Math.min(MUSIC.CHORD_BARS, sec.bars - c * MUSIC.CHORD_BARS);
      const bar0 = sec.startBar + c * MUSIC.CHORD_BARS, t = bar0 * barSec;
      const last = si === sections.length - 1 && (c + 1) * MUSIC.CHORD_BARS >= sec.bars; // outro must end on a pad
      if (rng() < theme.padChance || last) for (const k of [0, 2, 4]) add(t, cBars * barSec, note(deg + k, 'pad'), 'pad', bar0);
      if (bass) for (let b = 0; b < cBars; b++) {
        const tb = t + b * barSec;
        add(tb, 2 * beat, note(deg, 'bass'), 'bass', bar0 + b);
        add(tb + 2 * beat, 2 * beat, note(rng() < 0.3 ? deg + 4 : deg, 'bass'), 'bass', bar0 + b);
      }
    }
  });
  // Lead: one motif per chord (chance-gated), sparkle in B, then comfort rules.
  const chordBeats = MUSIC.CHORD_BARS * MUSIC.BEATS_PER_BAR, nMotifs = theme.motifs.length;
  const placed = [], seqA = []; // placed: { idx, evs }
  sections.forEach((sec, si) => {
    if (!['A', 'B', 'A2'].includes(sec.name)) return;
    const chance = Math.min(0.9, leadChance * (sec.name === 'B' ? 1.3 : 1));
    for (let c = 0; c * MUSIC.CHORD_BARS < sec.bars; c++) {
      let idx = sec.name === 'A2' ? seqA[c] : undefined; // A2 reuses A's sequence (null = rest)
      if (idx === undefined) idx = !placed.length ? firstMotif : rng() < chance ? pickIndex(rng, nMotifs) : null;
      if (idx !== null && placed.length > 1 && placed.at(-1).idx === idx && placed.at(-2).idx === idx) idx = pickIndex(rng, nMotifs, idx);
      if (sec.name === 'A') seqA.push(idx);
      if (idx === null) continue;
      const bar0 = sec.startBar + c * MUSIC.CHORD_BARS, t0 = bar0 * barSec, tr = Math.floor(rng() * 5);
      const m = theme.motifs[idx], firstDeg = m.find(([d]) => d !== null)[0], evs = [];
      let off = 0;
      for (const [d, b] of m) {
        if (d !== null && off < chordBeats) {
          const deg = tr === 1 ? d + 2 : tr === 2 ? 2 * firstDeg - d : d, bt = tr === 3 ? 2 * b : b;
          const e = add(t0 + off * beat, Math.min(bt, chordBeats - off) * beat, note(deg + len, 'lead', 12), 'lead', bar0 + Math.floor(off / MUSIC.BEATS_PER_BAR));
          Object.assign(e, { motif: idx, motifStart: t0, colour: false, off });
          evs.push(e);
        }
        off += tr === 3 ? 2 * b : b;
      }
      if (tr === 4) evs.at(-1).dur = (chordBeats - evs.at(-1).off) * beat;
      placed.push({ idx, evs });
    }
    if (sec.name === 'B') for (let w = 0; w * 4 < Math.ceil(sec.bars / MUSIC.CHORD_BARS); w++) {
      if (rng() >= 0.5) continue;
      const bar = sec.startBar + (w * 4 + Math.floor(rng() * 4)) * MUSIC.CHORD_BARS;
      if (bar + 1 >= sec.startBar + sec.bars) continue;
      const pr = progs[si], deg = pr[((bar - sec.startBar) / MUSIC.CHORD_BARS) % pr.length], n = 2 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) add((bar + 1) * barSec + k * beat, beat, note(deg + 2 * k, 'sparkle', 24), 'sparkle', bar + 1);
    }
  });
  // Comfort: lead must rest in >= LEAD_REST_MIN of bars; drop whole motifs, latest first, never the first.
  const leadBars = () => { const s = new Set(); for (const { evs } of placed) for (const e of evs) for (let b = e.bar; b * barSec < e.t + e.dur; b++) s.add(b); return s.size; };
  while (placed.length > 1 && leadBars() / bars > 1 - MUSIC.LEAD_REST_MIN) placed.pop();
  const lead = placed.flatMap((p) => p.evs);
  if (theme.colour) {
    let budget = Math.floor(MUSIC.COLOUR_MAX * lead.length);
    const inScale = (m) => theme.scale.includes((((m - theme.root) % 12) + 12) % 12);
    for (let i = 0; budget > 0 && i < lead.length - 1; i++) {
      const e = lead[i], nx = lead[i + 1];
      if (nx.motifStart !== e.motifStart || rng() >= 0.3) continue;
      const c = [e.midi - 1, e.midi + 1].find((x) => !inScale(x) && Math.abs(nx.midi - x) <= 2 && x >= MUSIC.RANGE.lead[0] && x <= MUSIC.RANGE.lead[1]);
      if (c !== undefined) { e.midi = c; e.colour = true; budget--; i++; }
    }
  }
  const keep = new Set(lead);
  for (let i = events.length - 1; i >= 0; i--) if (events[i].voice === 'lead' && !keep.has(events[i])) events.splice(i, 1);
  for (let pk = peakPolyphony(events); pk > MUSIC.MAX_VOICES; pk = peakPolyphony(events)) {
    const at = events.map((e) => e.t).find((t) => events.filter((e) => e.t <= t && t < e.t + e.dur).length === pk);
    const top = events.filter((e) => e.voice === 'pad' && e.t <= at && at < e.t + e.dur).sort((a, b) => b.midi - a.midi)[0];
    if (!top) break;
    events.splice(events.indexOf(top), 1);
  }
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

const deepTheme = THEMES.tessera.deep;
const noteOf = (th, deg, voice, oct = 0) => fold(th.root + degreeToSemis(th.scale, deg + th.scale.length) - 12 + oct, voice);

/** First signalLength(relics) notes of SIGNAL_MOTIF in the piece's key; t relative to 0; voice 'sparkle'. */
export function signalPhrase(theme, relics, piece) {
  const beat = piece.barSec / MUSIC.BEATS_PER_BAR, n = signalLength(relics);
  let t = 0;
  return SIGNAL_MOTIF.slice(0, n).map(([deg, b]) => {
    const e = { t, dur: b * beat, midi: noteOf(theme, deg, 'sparkle', 24), voice: 'sparkle', gain: MUSIC.GAIN.sparkle };
    t += b * beat;
    return e;
  });
}

/** One FINALE_BARS piece at FINALE_BPM in Vast Machine's key. 1: pad + bass; 2: + Signal-fragment lead; 3: + sparkle, brighter pad. */
export function composeFinale(level, rng) {
  const th = deepTheme, beat = 60 / MUSIC.FINALE_BPM, barSec = MUSIC.BEATS_PER_BAR * beat, bars = MUSIC.FINALE_BARS, duration = bars * barSec;
  const prog = th.progressions[Math.floor(rng() * th.progressions.length)], events = [];
  const add = (t, dur, midi, voice, bar) => events.push({ t, dur, midi, voice, gain: MUSIC.GAIN[voice], bar });
  for (let c = 0; c * MUSIC.CHORD_BARS < bars; c++) {
    const deg = prog[c % prog.length], t = c * MUSIC.CHORD_BARS * barSec;
    for (const k of [0, 2, 4]) add(t, MUSIC.CHORD_BARS * barSec, noteOf(th, deg + k, 'pad'), 'pad', c * MUSIC.CHORD_BARS);
    for (let b = 0; b < MUSIC.CHORD_BARS * MUSIC.BEATS_PER_BAR; b++) add(t + b * beat, beat, noteOf(th, deg, 'bass'), 'bass', c * MUSIC.CHORD_BARS + (b >> 2));
    if (level >= 2) { // a 2-4 note fragment of the Signal, one per chord
      const len = 2 + Math.floor(rng() * 3), from = Math.floor(rng() * (SIGNAL_MOTIF.length - len + 1));
      SIGNAL_MOTIF.slice(from, from + len).forEach(([d], i) => add(t + i * beat, beat, noteOf(th, d, 'lead', 12), 'lead', c * MUSIC.CHORD_BARS));
    }
    if (level >= 3) for (let b = 0; b < MUSIC.CHORD_BARS; b++) add(t + (b * MUSIC.BEATS_PER_BAR + 2) * beat, beat, noteOf(th, deg + 2 * (b + 1), 'sparkle', 24), 'sparkle', c * MUSIC.CHORD_BARS + b);
  }
  events.sort((a, b) => a.t - b.t);
  return { themeId: 'finale.' + level, bpm: MUSIC.FINALE_BPM, barSec, bars, duration, delayFb: 0.5, padCutoffMul: level >= 3 ? 1.5 : 1, sections: [{ name: 'finale', t0: 0, t1: duration }], events };
}

/** The whole Signal once over pad chords, ending on a major triad on the tonic, then a pad tail. */
export function composeEnding() {
  const th = deepTheme, beat = 1, events = [];
  [0, 3, 1, 4].forEach((deg, i) => [0, 2, 4].forEach((k) => events.push({ t: i * 2, dur: 2, midi: noteOf(th, deg + k, 'pad'), voice: 'pad', gain: MUSIC.GAIN.pad })));
  const tonic = fold(th.root, 'pad'); // major triad: root, +4, +7
  for (const s of [0, 4, 7]) events.push({ t: 8, dur: MUSIC.ENDING_TAIL_SEC, midi: tonic + s, voice: 'pad', gain: MUSIC.GAIN.pad });
  let t = 0;
  for (const [deg, b] of SIGNAL_MOTIF) { events.push({ t, dur: b * beat, midi: noteOf(th, deg, 'lead', 12), voice: 'lead', gain: MUSIC.GAIN.lead }); t += b * beat; }
  events.sort((a, b) => a.t - b.t);
  const duration = 8 + MUSIC.ENDING_TAIL_SEC;
  return { themeId: 'ending', bpm: 60, barSec: 4, bars: duration / 4, duration, delayFb: 0.5, padCutoffMul: 1, sections: [{ name: 'ending', t0: 0, t1: duration }], events };
}
