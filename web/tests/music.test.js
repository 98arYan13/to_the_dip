import { describe, it, expect } from 'vitest';
import { degreeToSemis } from '../src/audio/Music.js';
import { THEMES, SIGNAL_MOTIF, zoneOf, themeFor, signalLength } from '../src/audio/musicThemes.js';

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
    expect(THEMES.earth.camp.bpm).toBe(66); expect(THEMES.earth.camp.lead).toBe('piano');
    expect(THEMES.moon.deep.bpm).toBe(46); expect(THEMES.moon.deep.padChance).toBe(0.5);
    expect(THEMES.mars.mid.lead).toBe('reed');
    expect(THEMES.tessera.shallow.scale).toEqual([0, 3, 4, 7, 8, 11]);
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
