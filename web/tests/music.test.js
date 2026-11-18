import { describe, it, expect } from 'vitest';
import { degreeToSemis, dueEvents } from '../src/audio/Music.js';
import { composePiece, depthParams, peakPolyphony } from '../src/audio/Composer.js';
import { mulberry32 } from '../src/core/RNG.js';
import { MUSIC, THEMES, SCALES, SIGNAL_MOTIF, zoneOf, themeFor, signalLength } from '../src/audio/musicThemes.js';

const PLANETS = ['earth', 'moon', 'mars', 'tessera'], ZONES = ['camp', 'shallow', 'mid', 'deep'];

describe('music themes', () => {
  it('degreeToSemis wraps into higher octaves', () => {
    expect(degreeToSemis([0, 2, 4, 7, 9], 5)).toBe(12);
    expect(degreeToSemis([0, 2, 4, 7, 9], 7)).toBe(16);
  });
  it('every planet x zone has a valid theme', () => {
    for (const p of PLANETS) for (const z of ZONES) {
      const th = THEMES[p][z];
      expect(th.id).toBe(`${p}.${z}`);
      expect(th.motifs.length).toBeGreaterThanOrEqual(4);
      expect(th.progressions.length).toBeGreaterThanOrEqual(2);
      expect(th.padCutoff).toBeLessThanOrEqual(1200);
      expect(th.root).toBeGreaterThanOrEqual(36); expect(th.root).toBeLessThanOrEqual(59);
      for (const m of th.motifs) {
        expect(m.length).toBeGreaterThanOrEqual(2); expect(m.length).toBeLessThanOrEqual(5);
        expect(m.reduce((s, n) => s + n[1], 0)).toBeLessThanOrEqual(8);
      }
    }
  });
  it('spec table values', () => {
    const rows = { // key pitch class, scale, lead, bpm
      'earth.camp': [0, 'majorPent', 'piano', 66], 'earth.shallow': [7, 'majorPent', 'piano', 76], 'earth.mid': [9, 'dorian', 'glass', 68], 'earth.deep': [4, 'phrygian', 'glass', 54],
      'moon.camp': [2, 'lydian', 'glass', 52], 'moon.shallow': [2, 'lydian', 'glass', 56], 'moon.mid': [11, 'aeolian', 'glass', 52], 'moon.deep': [11, 'aeolian', 'glass', 46],
      'mars.camp': [6, 'dorian', 'reed', 60], 'mars.shallow': [6, 'dorian', 'reed', 66], 'mars.mid': [1, 'phrygianDominant', 'reed', 60], 'mars.deep': [1, 'phrygian', 'reed', 52],
      'tessera.camp': [0, 'augmented', 'bell', 58], 'tessera.shallow': [0, 'augmented', 'bell', 62], 'tessera.mid': [5, 'augmented', 'bell', 58], 'tessera.deep': [8, 'augmented', 'bell', 50],
    };
    for (const [id, [pc, sc, lead, bpm]] of Object.entries(rows)) {
      const [p, z] = id.split('.'), th = THEMES[p][z];
      expect(th.root % 12).toBe(pc); expect(th.scale).toEqual(SCALES[sc]); expect(th.lead).toBe(lead); expect(th.bpm).toBe(bpm);
    }
    expect(THEMES.moon.deep.padChance).toBe(0.5);
    expect(THEMES.tessera.shallow.scale).toEqual([0, 3, 4, 7, 8, 11]);
  });
  it('motifs are integer degrees or rests; motif and progression lists are unique per theme', () => {
    const seenM = new Set(), seenP = new Set();
    for (const p of PLANETS) for (const z of ZONES) {
      const th = THEMES[p][z];
      expect(th.motifs.length).toBeLessThanOrEqual(6); expect(th.progressions.length).toBeGreaterThanOrEqual(3);
      for (const m of th.motifs) for (const [d] of m) expect(d === null || Number.isInteger(d)).toBe(true);
      for (const pr of th.progressions) { expect(pr.length).toBeGreaterThanOrEqual(2); expect(pr.length).toBeLessThanOrEqual(4); }
      const km = JSON.stringify(th.motifs), kp = JSON.stringify(th.progressions);
      expect(seenM.has(km)).toBe(false); expect(seenP.has(kp)).toBe(false);
      seenM.add(km); seenP.add(kp);
    }
  });
  it('zoneOf', () => {
    expect(zoneOf(0.5, true)).toBe('camp');
    expect(zoneOf(0.34, false)).toBe('shallow'); expect(zoneOf(0.35, false)).toBe('mid');
    expect(zoneOf(0.78, false)).toBe('deep'); expect(zoneOf(NaN, false)).toBe('shallow');
    expect(zoneOf(undefined, false)).toBe('shallow'); expect(zoneOf(5, false)).toBe('deep');
  });
  it('themeFor falls back to Earth', () => {
    expect(themeFor('nope', 'mid')).toBe(THEMES.earth.mid); expect(themeFor(undefined, 'camp')).toBe(THEMES.earth.camp);
  });
  it('signal motif', () => {
    expect(SIGNAL_MOTIF.length).toBe(7);
    expect(signalLength(0)).toBe(2); expect(signalLength(3)).toBe(5); expect(signalLength(99)).toBe(7); expect(signalLength(-1)).toBe(2);
  });
});

const all = () => ['earth','moon','mars','tessera'].flatMap(p => ['camp','shallow','mid','deep'].map(z => THEMES[p][z]));
describe('composer', () => {
  it('pieces are 120-180 s with the five sections in order', () => {
    for (const th of all()) for (let s = 1; s <= 20; s++) {
      const p = composePiece(th, { depth01: 0.5 }, mulberry32(s));
      expect(p.duration).toBeGreaterThanOrEqual(120); expect(p.duration).toBeLessThanOrEqual(180);
      expect(p.sections.map(x => x.name)).toEqual(['intro', 'A', 'B', 'A2', 'outro']);
      expect(p.sections.every(x => x.bars >= 2 && x.bars % 2 === 0)).toBe(true);
      expect(p.sections.at(-1).t1).toBeCloseTo(p.duration, 5);
    }
  });
  it('intro and outro have no bass; every voice stays in range', () => {
    const p = composePiece(THEMES.earth.mid, {}, mulberry32(7));
    const [intro, , , , outro] = p.sections;
    expect(p.events.some(e => e.voice === 'bass')).toBe(true);
    expect(p.events.some(e => e.voice === 'bass' && (e.t < intro.t1 || e.t >= outro.t0))).toBe(false);
    for (const e of p.events) { const [lo, hi] = MUSIC.RANGE[e.voice]; expect(e.midi).toBeGreaterThanOrEqual(lo); expect(e.midi).toBeLessThanOrEqual(hi); }
    expect(p.events.every((e, i) => i === 0 || p.events[i - 1].t <= e.t)).toBe(true);
    expect(Math.max(...p.events.filter(e => e.voice === 'pad').map(e => e.t + e.dur))).toBeCloseTo(p.duration, 5);
    expect(peakPolyphony(p.events)).toBeLessThanOrEqual(MUSIC.MAX_VOICES);
  });
  it('same seed same piece, different seed different piece', () => {
    const a = composePiece(THEMES.mars.shallow, {}, mulberry32(3)), b = composePiece(THEMES.mars.shallow, {}, mulberry32(3)), c = composePiece(THEMES.mars.shallow, {}, mulberry32(4));
    expect(a).toEqual(b); expect(a.events).not.toEqual(c.events);
  });
  it('depth slows the piece and bad depth is clamped', () => {
    const th = THEMES.earth.deep;
    expect(depthParams(th, 1).bpm).toBeLessThan(depthParams(th, 0.8).bpm);
    expect(depthParams(th, NaN)).toEqual(depthParams(th, 0)); expect(depthParams(th, 5)).toEqual(depthParams(th, 1));
    expect(() => composePiece(th, { depth01: NaN }, mulberry32(1))).not.toThrow();
  });
  it('avoid.progression is honoured', () => {
    for (let s = 1; s <= 20; s++) expect(composePiece(THEMES.earth.camp, { avoid: { progression: 0 } }, mulberry32(s)).firstProgression).not.toBe(0);
  });
  it('the last pad always ends at duration, even with padChance < 1', () => {
    for (const th of all()) for (let s = 1; s <= 8; s++) {
      const p = composePiece(th, {}, mulberry32(s));
      expect(Math.max(...p.events.filter(e => e.voice === 'pad').map(e => e.t + e.dur))).toBeCloseTo(p.duration, 5);
    }
  });
  it('avoid.motif is honoured and Infinity depth clamps', () => {
    for (let s = 1; s <= 20; s++) expect(composePiece(THEMES.earth.camp, { avoid: { motif: 0 } }, mulberry32(s)).firstMotif).not.toBe(0);
    expect(depthParams(THEMES.earth.deep, Infinity)).toEqual(depthParams(THEMES.earth.deep, 1));
  });
});

describe('composer lead', () => {
it('comfort rules', () => {
  for (const th of all()) for (let s = 1; s <= 20; s++) {
    const p = composePiece(th, { depth01: th.colour ? 0.9 : 0.3 }, mulberry32(s));
    const lead = p.events.filter(e => e.voice === 'lead');
    expect(lead.length).toBeGreaterThan(0);
    const barsWithLead = new Set(lead.flatMap(e => { const out = []; for (let b = e.bar; b * p.barSec < e.t + e.dur; b++) out.push(b); return out; }));
    expect(barsWithLead.size / p.bars).toBeLessThanOrEqual(0.6);
    const starts = lead.filter((e, i) => i === 0 || lead[i - 1].motifStart !== e.motifStart).map(e => e.motif);
    for (let i = 2; i < starts.length; i++) expect(starts[i] === starts[i - 1] && starts[i] === starts[i - 2]).toBe(false);
    const inScale = m => th.scale.includes(((m - th.root) % 12 + 12) % 12);
    const colours = lead.filter(e => e.colour);
    expect(colours.length / lead.length).toBeLessThanOrEqual(0.08);
    lead.forEach((e, i) => { if (e.colour) { expect(inScale(lead[i + 1].midi)).toBe(true); expect(Math.abs(lead[i + 1].midi - e.midi)).toBeLessThanOrEqual(2); } else expect(inScale(e.midi)).toBe(true); });
    for (const e of p.events) if (e.voice !== 'lead') expect(inScale(e.midi)).toBe(true);
    if (!th.colour) expect(colours.length).toBe(0);
    expect(peakPolyphony(p.events)).toBeLessThanOrEqual(MUSIC.MAX_VOICES);
  }
});
it('avoid.motif is honoured', () => { for (let s = 1; s <= 20; s++) expect(composePiece(THEMES.moon.mid, { avoid: { motif: 1 } }, mulberry32(s)).firstMotif).not.toBe(1); });
it('deeper means lower lead for the same seed', () => {
  const mean = d => { const l = composePiece(THEMES.earth.deep, { depth01: d, targetSec: 150 }, mulberry32(9)).events.filter(e => e.voice === 'lead'); return l.reduce((s, e) => s + e.midi, 0) / l.length; };
  expect(mean(1)).toBeLessThan(mean(0));
});
});

describe('music playback', () => {
  it('dueEvents drops the backlog instead of bursting', () => {
    const q = [0, 1, 2, 9.99, 10.1, 10.4].map(t => ({ t }));
    const r = dueEvents(q, 10, 0.25);
    expect(r.play.map(e => e.t)).toEqual([9.99, 10.1]); expect(r.rest.map(e => e.t)).toEqual([10.4]); expect(r.dropped).toBe(3);
  });
});
