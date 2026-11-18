import { describe, it, expect } from 'vitest';
import { MusicDirector } from '../src/audio/Director.js';
import { mulberry32 } from '../src/core/RNG.js';

const fake = (theme, opts) => ({ themeId: theme.id, duration: 150, barSec: 3, bars: 50, firstMotif: 0, firstProgression: 0, opts, sections: [{ name: 'intro', t0: 0, t1: 15 }, { name: 'A', t0: 15, t1: 52.5 }, { name: 'B', t0: 52.5, t1: 97.5 }, { name: 'A2', t0: 97.5, t1: 135 }, { name: 'outro', t0: 135, t1: 150 }], events: [] });
const run = (d, from, to, ctx) => { const out = []; for (let t = from; t < to; t += 0.1) out.push(...d.update(Math.round(t * 10) / 10, ctx)); return out; };

describe('MusicDirector', () => {
  it('starts a piece for the current context', () => {
    const d = new MusicDirector(mulberry32(1), { composePiece: fake });
    const [c] = d.update(0, { depth01: 0.5 });
    expect(c.type).toBe('play'); expect(c.at).toBe(2); expect(c.piece.themeId).toBe('earth.mid');
  });
  it('leaves a 30-60 s gap, 20-40 s at camp, and avoids the previous opening', () => {
    const d = new MusicDirector(mulberry32(1), { composePiece: fake });
    const cmds = run(d, 0, 400, { depth01: 0.5 }).filter(c => c.type === 'play');
    const gap = cmds[1].at - (cmds[0].at + 150);
    expect(gap).toBeGreaterThanOrEqual(30); expect(gap).toBeLessThanOrEqual(60);
    expect(cmds[1].piece.opts.avoid).toEqual({ motif: 0, progression: 0 });
    const d2 = new MusicDirector(mulberry32(1), { composePiece: fake });
    const c2 = run(d2, 0, 400, { onSurface: true }).filter(c => c.type === 'play');
    const g2 = c2[1].at - (c2[0].at + 150);
    expect(g2).toBeGreaterThanOrEqual(20); expect(g2).toBeLessThanOrEqual(40);
  });
  it('a zone change fades at the section end, then plays the new theme after 8 s', () => {
    const d = new MusicDirector(mulberry32(1), { composePiece: fake });
    run(d, 0, 20, { depth01: 0.2 });
    const cmds = run(d, 20, 120, { depth01: 0.5 });
    const fade = cmds.find(c => c.type === 'fade'), play = cmds.find(c => c.type === 'play');
    expect(fade.at).toBeCloseTo(54.5, 1); expect(fade.sec).toBe(4);
    expect(play.at).toBeCloseTo(54.5 + 4 + 8, 1); expect(play.piece.themeId).toBe('earth.mid');
    expect(cmds.filter(c => c.type === 'fade').length).toBe(1);
  });
  it('a hop shorter than 6 s changes nothing', () => {
    const d = new MusicDirector(mulberry32(1), { composePiece: fake });
    run(d, 0, 20, { depth01: 0.2 });
    const a = run(d, 20, 25, { onSurface: true }), b = run(d, 25, 60, { depth01: 0.2 });
    expect([...a, ...b]).toEqual([]);
  });
  it('signal phrases near a ruin, at most every 20 s, never without the function', () => {
    const sig = () => [{ t: 0, dur: 1, midi: 80, voice: 'sparkle', gain: 0.4 }];
    const d = new MusicDirector(mulberry32(1), { composePiece: fake, signalPhrase: sig });
    const ph = run(d, 0, 100, { depth01: 0.5, nearRuin: true, relics: 1 }).filter(c => c.type === 'phrase');
    expect(ph.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < ph.length; i++) expect(ph[i].at - ph[i - 1].at).toBeGreaterThanOrEqual(20);
    const d2 = new MusicDirector(mulberry32(1), { composePiece: fake });
    expect(run(d2, 0, 100, { depth01: 0.5, nearRuin: true }).some(c => c.type === 'phrase')).toBe(false);
  });
  it('finale plays back to back; ending plays once then silence', () => {
    const fin = level => ({ themeId: 'finale.' + level, duration: 20, barSec: 3, sections: [{ t0: 0, t1: 20 }], events: [] });
    const end = () => ({ themeId: 'ending', duration: 40, barSec: 3, sections: [{ t0: 0, t1: 40 }], events: [] });
    const d = new MusicDirector(mulberry32(1), { composePiece: fake, composeFinale: fin, composeEnding: end });
    run(d, 0, 10, { depth01: 0.95 });
    const f = run(d, 10, 80, { depth01: 0.95, finaleLevel: 2 }).filter(c => c.type === 'play');
    expect(f.length).toBeGreaterThanOrEqual(3); expect(f[1].at - f[0].at).toBeCloseTo(20, 1); expect(f[0].piece.themeId).toBe('finale.2');
    const e = run(d, 80, 400, { finaleLevel: 4 }).filter(c => c.type === 'play');
    expect(e.length).toBe(1); expect(e[0].piece.themeId).toBe('ending');
  });
});
