import { describe, it, expect } from 'vitest';
import { degreeToSemis } from '../src/audio/Music.js';
import { THEMES, SCALES, SIGNAL_MOTIF, zoneOf, themeFor, signalLength } from '../src/audio/musicThemes.js';

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
