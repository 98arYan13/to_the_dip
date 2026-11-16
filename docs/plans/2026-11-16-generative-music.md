# Generative Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web game's one-loop-per-layer score with a generative composer that writes 2–3 minute pieces matched to planet and depth, with silence between them and story hooks.

**Architecture:** Pure data (`musicThemes.js`) → pure composer (`Composer.js`, seeded rng, returns note events) → pure director (`Director.js`, decides what plays when, returns commands) → Web Audio playback (`Music.js`). Only `Music.js` touches the AudioContext, so everything musical is unit-tested.

**Tech Stack:** Vanilla JS ES modules, Web Audio API, Vitest. No new dependencies, no audio files.

**Spec:** `docs/superpowers/specs/2026-11-16-generative-music-design.md` (read it first; this plan argues from it).

## Global Constraints

- All work is in `web/`. Run tests with `npm test` from `web/`. Dev server only on port **5273**.
- Never run `git commit` without the user's explicit permission. Checkpoint steps say "commit only if permitted".
- Do not edit `web/TODO.md` or any TODO.
- Code, identifiers, comments in English. JSDoc style as in the existing files.
- No `Math.random` in `Composer.js` or `Director.js`; they take an `rng: () => number` (use `mulberry32` from `core/RNG.js` in tests).
- This plan is independent of the story/worldgen/planets plans. Where their APIs are missing, the hook stays inert (stated per task).
- Spec numbers, verbatim: piece 120–180 s; gap 30–60 s (camp 20–40 s); zones shallow `< 0.35`, mid `< 0.78`; lead silent ≥ 40% of bars; colour notes ≤ 8%; ranges bass 28–48, lead 55–84, sparkle 72–91; `MAX_VOICES` 20; `SWITCH_HOLD` 6 s; fade-out 4 s; switch gap 8 s; `RUIN_RADIUS` 12; signal at most every 20 s; pulse fade 1 s, return after 4 s over 6 s; finale tempo 84; music bus low-pass 5 kHz.

## Review Focus

1. **Tab hidden then shown** — the scheduler must not burst-play missed notes; it drops past events and resumes. (Task 5, test on the pure `dueEvents` helper.)
2. **Quick camp hop / noisy zone edge** — context flapping faster than 6 s must produce no command. (Task 4 test.)
3. **Unknown planet id or bad depth** (`undefined`, `NaN`, `> 1`) — falls back to Earth / clamps to 0–1, never throws. (Task 1 and Task 2 tests.)
4. **Music toggled off and on mid-piece** — the piece keeps running at zero volume; no restart, no double scheduling. (Task 7 manual check.)
5. **Voice count in the final sequence at level 3** — still ≤ 20 simultaneous notes. (Task 6 test.)

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `web/src/audio/musicThemes.js` | Create | `MUSIC` constants, `SCALES`, `THEMES`, `SIGNAL_MOTIF`, `zoneOf`, `themeFor`, `signalLength` |
| `web/src/audio/Composer.js` | Create | `depthParams`, `composePiece`, `signalPhrase`, `composeFinale`, `composeEnding`, `peakPolyphony` |
| `web/src/audio/Director.js` | Create | `MusicDirector` — context → commands |
| `web/src/audio/Music.js` | Rewrite | Scheduler, instruments, fades, pulse mute; keeps `degreeToSemis` export |
| `web/src/config.js` | Modify | Remove `AUDIO.MUSIC` (lines ~703–731) |
| `web/src/main.js` | Modify | `:576` `setLayer` → `setContext`; pulse event wiring |
| `web/tests/music.test.js` | Rewrite | Data + composer tests |
| `web/tests/musicDirector.test.js` | Create | Director tests |

---

### Task 1: Theme data

**Files:** Create `web/src/audio/musicThemes.js`; rewrite `web/tests/music.test.js`.

**Interfaces — Produces:**

```js
export const MUSIC = Object.freeze({
  PIECE_SEC: [120, 180], GAP_SEC: [30, 60], CAMP_GAP_SEC: [20, 40],
  SWITCH_HOLD: 6, FADE_OUT: 4, SWITCH_GAP_SEC: 8, FIRST_DELAY: 2,
  ZONE_MID: 0.35, ZONE_DEEP: 0.78,
  FORM: [['intro', 0.10], ['A', 0.25], ['B', 0.30], ['A2', 0.25], ['outro', 0.10]],
  BEATS_PER_BAR: 4, CHORD_BARS: 2,
  LEAD_REST_MIN: 0.4, COLOUR_MAX: 0.08, MAX_VOICES: 20,
  RANGE: { pad: [43, 72], bass: [28, 48], lead: [55, 84], sparkle: [72, 91] },
  GAIN: { pad: 0.5, bass: 0.7, lead: 1, sparkle: 0.4 },
  RUIN_RADIUS: 12, SIGNAL_GAP_SEC: 20,
  PULSE_FADE: 1, PULSE_RETURN_DELAY: 4, PULSE_RETURN_FADE: 6,
  FINALE_BPM: 84, FINALE_BARS: 8, ENDING_TAIL_SEC: 20,
  BUS_LOWPASS_HZ: 5000, LOOKAHEAD: 0.25, TICK_MS: 25, LEAD_GAIN: 0.07, DELAY_TIME: 0.43,
});
export const SCALES;      // name → semitone array: majorPent, dorian, phrygian, lydian, aeolian, phrygianDominant, augmented [0,3,4,7,8,11]
export const THEMES;      // THEMES[planet][zone], planets earth|moon|mars|tessera, zones camp|shallow|mid|deep
export const SIGNAL_MOTIF; // 7 × [degree, beats]
export function zoneOf(depth01, onSurface);   // → 'camp'|'shallow'|'mid'|'deep'
export function themeFor(planet, zone);       // unknown planet → THEMES.earth
export function signalLength(relics);         // min(7, 2 + relics), relics clamped ≥ 0
```

Theme shape: `{ id: 'earth.shallow', name, root /* tonic MIDI, 36–59 */, scale /* from SCALES */, lead: 'piano'|'glass'|'reed'|'bell', bpm, padCutoff /* Hz ≤ 1200 */, padChance /* 0–1, default 1; 0.5 for moon.deep */, colour /* bool: true only for deep zones */, motifs /* ≥ 4; each 2–5 × [degree|null, beats], total ≤ 8 beats */, progressions /* ≥ 2; each 2–4 chord-root degrees */ }`.

Key, scale, lead and bpm of each of the 16 themes: spec section 6 table, exactly. Motif and progression notes are yours to write within that character.

- [ ] **Step 1: Write the failing tests** in `web/tests/music.test.js` (replace the file; keep the existing `degreeToSemis` test):

```js
const PLANETS = ['earth', 'moon', 'mars', 'tessera'], ZONES = ['camp', 'shallow', 'mid', 'deep'];
it('every planet × zone has a valid theme', () => {
  for (const p of PLANETS) for (const z of ZONES) {
    const th = THEMES[p][z];
    expect(th.id).toBe(`${p}.${z}`);
    expect(th.motifs.length).toBeGreaterThanOrEqual(4);
    expect(th.progressions.length).toBeGreaterThanOrEqual(2);
    expect(th.padCutoff).toBeLessThanOrEqual(1200);
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
});
it('themeFor falls back to Earth', () => { expect(themeFor('nope', 'mid')).toBe(THEMES.earth.mid); expect(themeFor(undefined, 'camp')).toBe(THEMES.earth.camp); });
it('signal motif', () => {
  expect(SIGNAL_MOTIF.length).toBe(7);
  expect(signalLength(0)).toBe(2); expect(signalLength(3)).toBe(5); expect(signalLength(99)).toBe(7); expect(signalLength(-1)).toBe(2);
});
```

- [ ] **Step 2:** Run `npm test -- music` → FAIL (module not found).
- [ ] **Step 3:** Write `musicThemes.js` (all objects frozen).
- [ ] **Step 4:** Run `npm test -- music` → PASS. (The old "every layer has a valid theme" test is gone; `AUDIO.MUSIC` is removed in Task 5.)
- [ ] **Step 5:** Checkpoint — commit only if permitted: `feat(web): music theme data for generative score`.

---

### Task 2: Composer — form, harmony, pad and bass

**Files:** Create `web/src/audio/Composer.js`; add to `web/tests/music.test.js`.

**Interfaces — Consumes:** Task 1 exports, `degreeToSemis` (move it into `Composer.js`; `Music.js` re-exports it).

**Produces:**

```js
/** @returns {{ bpm:number, shift:number, leadChance:number, delayFb:number }} */
export function depthParams(theme, depth01);
// d = clamp(depth01, 0, 1), NaN → 0.  bpm = theme.bpm·(1 − 0.25d); shift = round(3d) scale steps down;
// leadChance = 0.6 − 0.3d; delayFb = 0.35 + 0.2d

/**
 * @param {{ depth01?:number, targetSec?:number, avoid?:{ motif?:number, progression?:number } }} opts
 * @returns {{ themeId, bpm, barSec, bars, duration, delayFb, firstMotif, firstProgression,
 *   sections: {name, startBar, bars, t0, t1}[],
 *   events: {t, dur, midi, voice:'pad'|'bass'|'lead'|'sparkle', gain, bar, motif?:number, colour?:boolean}[] }}
 */
export function composePiece(theme, opts, rng);
export function peakPolyphony(events);   // max notes sounding at once
```

Rules this task implements: `targetSec` defaults to a random value in `PIECE_SEC`; `bars` = even number nearest `targetSec / barSec`, kept inside 120–180 s; sections sized by `MUSIC.FORM` shares (each ≥ 2 bars, even); one progression per section, a chord every `CHORD_BARS`; pad = triad (degree, +2, +4) in every section, skipped per chord with probability `1 − padChance`, last pad of `outro` ends at `duration`; bass (root, 30% chance the fifth on beat 3) only in `B`, `A2`; `events` sorted by `t`; every `midi` folded by octaves into its voice's `RANGE`. `firstProgression` ≠ `opts.avoid.progression`.

- [ ] **Step 1: Write the failing tests:**

```js
const all = () => ['earth','moon','mars','tessera'].flatMap(p => ['camp','shallow','mid','deep'].map(z => THEMES[p][z]));
it('pieces are 120–180 s with the five sections in order', () => {
  for (const th of all()) for (let s = 1; s <= 20; s++) {
    const p = composePiece(th, { depth01: 0.5 }, mulberry32(s));
    expect(p.duration).toBeGreaterThanOrEqual(120); expect(p.duration).toBeLessThanOrEqual(180);
    expect(p.sections.map(x => x.name)).toEqual(['intro', 'A', 'B', 'A2', 'outro']);
    expect(p.sections.at(-1).t1).toBeCloseTo(p.duration, 5);
  }
});
it('intro and outro have no bass; every voice stays in range', () => {
  const p = composePiece(THEMES.earth.mid, {}, mulberry32(7));
  const [intro, , , , outro] = p.sections;
  expect(p.events.some(e => e.voice === 'bass' && (e.t < intro.t1 || e.t >= outro.t0))).toBe(false);
  for (const e of p.events) { const [lo, hi] = MUSIC.RANGE[e.voice]; expect(e.midi).toBeGreaterThanOrEqual(lo); expect(e.midi).toBeLessThanOrEqual(hi); }
});
it('same seed same piece, different seed different piece', () => {
  const a = composePiece(THEMES.mars.shallow, {}, mulberry32(3)), b = composePiece(THEMES.mars.shallow, {}, mulberry32(3)), c = composePiece(THEMES.mars.shallow, {}, mulberry32(4));
  expect(a).toEqual(b); expect(a.events).not.toEqual(c.events);
});
it('depth slows the piece and bad depth is clamped', () => {
  const th = THEMES.earth.deep;
  expect(depthParams(th, 1).bpm).toBeLessThan(depthParams(th, 0.8).bpm);
  expect(depthParams(th, NaN)).toEqual(depthParams(th, 0)); expect(depthParams(th, 5)).toEqual(depthParams(th, 1));
});
it('avoid.progression is honoured', () => {
  for (let s = 1; s <= 20; s++) expect(composePiece(THEMES.earth.camp, { avoid: { progression: 0 } }, mulberry32(s)).firstProgression).not.toBe(0);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test -- music` → PASS.
- [ ] **Step 5:** Checkpoint — commit only if permitted: `feat(web): music composer form and harmony`.

---

### Task 3: Composer — lead, sparkle, comfort rules

**Files:** Modify `web/src/audio/Composer.js`; add to `web/tests/music.test.js`.

**Produces (same `composePiece`, now complete):** lead events carry `motif` (index into `theme.motifs`) and `colour`.

Rules:
- Lead only in `A`, `B`, `A2`. Per chord (2 bars) place a motif with probability `leadChance` (`B`: ×1.3, capped at 0.9), else rest.
- Transformations, picked by rng: as written; +2 degrees; inverted around its first note; rhythm ×2 (truncated to the chord); last note held to the chord end.
- `A2` reuses `A`'s motif sequence with fresh transformations.
- Never the same motif index more than twice running; `firstMotif` ≠ `opts.avoid.motif`.
- After placement, if the lead sounds in more than 60% of the piece's bars, remove whole motifs (latest first, never the first) until ≤ 60%.
- Colour notes only if `theme.colour`: a lead note that is not the motif's last may move ±1 semitone out of scale, total ≤ `COLOUR_MAX` of lead notes; the note after it is in scale and within 2 semitones.
- Sparkle: in `B` only, at most one 2–3 note phrase per 8 bars, from chord tones.
- Finally, while `peakPolyphony(events) > MAX_VOICES`: drop the top pad note of the busiest chord.

- [ ] **Step 1: Write the failing tests** (each loops all 16 themes × seeds 1–20, `depth01` 0.9 for deep themes else 0.3):

```js
it('comfort rules', () => {
  for (const th of all()) for (let s = 1; s <= 20; s++) {
    const p = composePiece(th, { depth01: th.colour ? 0.9 : 0.3 }, mulberry32(s));
    const lead = p.events.filter(e => e.voice === 'lead');
    expect(lead.length).toBeGreaterThan(0);
    // rule 1: lead silent in ≥ 40% of bars
    const barsWithLead = new Set(lead.flatMap(e => { const out = []; for (let b = e.bar; b * p.barSec < e.t + e.dur; b++) out.push(b); return out; }));
    expect(barsWithLead.size / p.bars).toBeLessThanOrEqual(0.6);
    // rule 2: no motif three times running (count motif starts, not notes)
    const starts = lead.filter((e, i) => i === 0 || lead[i - 1].motifStart !== e.motifStart).map(e => e.motif);
    for (let i = 2; i < starts.length; i++) expect(starts[i] === starts[i - 1] && starts[i] === starts[i - 2]).toBe(false);
    // rule 5: scale membership, colour ≤ 8% and resolved by step
    const inScale = m => th.scale.includes(((m - th.root) % 12 + 12) % 12);
    const colours = lead.filter(e => e.colour);
    expect(colours.length / lead.length).toBeLessThanOrEqual(0.08);
    lead.forEach((e, i) => { if (e.colour) { expect(inScale(lead[i + 1].midi)).toBe(true); expect(Math.abs(lead[i + 1].midi - e.midi)).toBeLessThanOrEqual(2); } else expect(inScale(e.midi)).toBe(true); });
    for (const e of p.events) if (e.voice !== 'lead') expect(inScale(e.midi)).toBe(true);
    if (!th.colour) expect(colours.length).toBe(0);
    // rule 7
    expect(peakPolyphony(p.events)).toBeLessThanOrEqual(MUSIC.MAX_VOICES);
  }
});
it('avoid.motif is honoured', () => { for (let s = 1; s <= 20; s++) expect(composePiece(THEMES.moon.mid, { avoid: { motif: 1 } }, mulberry32(s)).firstMotif).not.toBe(1); });
it('deeper means lower lead for the same seed', () => {
  const mean = d => { const l = composePiece(THEMES.earth.deep, { depth01: d, targetSec: 150 }, mulberry32(9)).events.filter(e => e.voice === 'lead'); return l.reduce((s, e) => s + e.midi, 0) / l.length; };
  expect(mean(1)).toBeLessThan(mean(0));
});
```

Lead events also carry `motifStart` (the `t` of their motif's first note) so tests and the trimming rule can group notes.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test -- music` → PASS (all of Task 1–3 tests).
- [ ] **Step 5:** Checkpoint — commit only if permitted: `feat(web): generative lead with comfort rules`.

---

### Task 4: Director

**Files:** Create `web/src/audio/Director.js`, `web/tests/musicDirector.test.js`.

**Interfaces — Consumes:** `composePiece`, `composeFinale`, `composeEnding`, `signalPhrase` (the last three arrive in Task 6; inject them through the constructor so this task tests with fakes).

**Produces:**

```js
export class MusicDirector {
  /** @param {() => number} rng @param {{ composePiece, composeFinale?, composeEnding?, signalPhrase? }} fns */
  constructor(rng, fns);
  /**
   * Call once per frame. `now` in seconds (AudioContext clock).
   * @param {{ planet?:string, depth01?:number, onSurface?:boolean, nearRuin?:boolean, relics?:number, finaleLevel?:number }} ctx
   * @returns {Array<{type:'play', piece, at:number} | {type:'fade', at:number, sec:number} | {type:'phrase', events, at:number}>}
   */
  update(now, ctx);
}
```

Behaviour (states `idle → playing → gap`):
- First `update`: `play` at `now + FIRST_DELAY` for `themeFor(planet, zoneOf(depth01, onSurface))`.
- When a piece ends (`at + duration`): gap = random in `GAP_SEC` (`CAMP_GAP_SEC` if the context zone is `camp`), then `play` the theme of the **current** context, passing `avoid` = previous piece's `firstMotif`/`firstProgression` and the current `depth01`.
- While playing, if the context's theme id differs from the playing piece's `themeId` continuously for `SWITCH_HOLD`: emit one `fade` at the end of the current section (`sec: FADE_OUT`), treat the piece as ending at `fade.at + FADE_OUT`, and use `SWITCH_GAP_SEC` as the gap. If the context returns to the playing theme before the hold elapses, the timer resets and nothing is emitted.
- `nearRuin` while playing and not fading: emit `phrase` with `signalPhrase(theme, relics, piece)` at the next bar line, at most once per `SIGNAL_GAP_SEC`. No `signalPhrase` function → never.
- `finaleLevel` 1–3 (needs `composeFinale`): on entering, `fade` now over 2 s, then `play` `composeFinale(level)` pieces back to back with no gap; a level change takes effect at the next piece boundary. `finaleLevel` 4 (needs `composeEnding`): `fade` 2 s, `play` the ending once, then emit nothing ever again.

- [ ] **Step 1: Write the failing tests** with a fake `composePiece = (theme, opts) => ({ themeId: theme.id, duration: 150, barSec: 3, bars: 50, firstMotif: 0, firstProgression: 0, opts, sections: [{ name: 'intro', t0: 0, t1: 15 }, { name: 'A', t0: 15, t1: 52.5 }, { name: 'B', t0: 52.5, t1: 97.5 }, { name: 'A2', t0: 97.5, t1: 135 }, { name: 'outro', t0: 135, t1: 150 }], events: [] })` and a helper `run(d, from, to, ctx)` stepping `update` every 0.1 s and collecting commands:

```js
it('starts a piece for the current context', () => {
  const d = new MusicDirector(mulberry32(1), { composePiece: fake });
  const [c] = d.update(0, { depth01: 0.5 });
  expect(c.type).toBe('play'); expect(c.at).toBe(2); expect(c.piece.themeId).toBe('earth.mid');
});
it('leaves a 30–60 s gap, 20–40 s at camp, and avoids the previous opening', () => {
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
  run(d, 0, 20, { depth01: 0.2 });                      // piece started at t=2, now in section A (17–54.5)
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
  const fin = level => ({ themeId: 'finale.' + level, duration: 20, sections: [{ t0: 0, t1: 20 }], events: [] });
  const end = () => ({ themeId: 'ending', duration: 40, sections: [{ t0: 0, t1: 40 }], events: [] });
  const d = new MusicDirector(mulberry32(1), { composePiece: fake, composeFinale: fin, composeEnding: end });
  run(d, 0, 10, { depth01: 0.95 });
  const f = run(d, 10, 80, { depth01: 0.95, finaleLevel: 2 }).filter(c => c.type === 'play');
  expect(f.length).toBeGreaterThanOrEqual(3); expect(f[1].at - f[0].at).toBeCloseTo(20, 1); expect(f[0].piece.themeId).toBe('finale.2');
  const e = run(d, 80, 400, { finaleLevel: 4 }).filter(c => c.type === 'play');
  expect(e.length).toBe(1); expect(e[0].piece.themeId).toBe('ending');
});
```

- [ ] **Step 2:** Run `npm test -- musicDirector` → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Checkpoint — commit only if permitted: `feat(web): music director`.

---

### Task 5: Playback and wiring

**Files:** Rewrite `web/src/audio/Music.js`; modify `web/src/config.js` (delete `AUDIO.MUSIC`), `web/src/main.js:576`; add to `web/tests/music.test.js`.

**Interfaces — Consumes:** `MusicDirector`, composer functions, `MUSIC`, `AudioEngine` (`e.ready`, `e.ctx`, `e.buses.music`).

**Produces:**

```js
export { degreeToSemis } from './Composer.js';
/** Pure: splits a queue of absolute-time events. Past events (t < now − 0.05) are dropped, not played. */
export function dueEvents(queue, now, lookahead);   // → { play: event[], rest: event[], dropped: number }
export class Music {
  constructor(engine);                 // unchanged signature
  start();                             // unchanged contract
  setContext(ctx);                     // per frame; same shape as MusicDirector.update's ctx
  onPulseWarn();                       // story gain → 0 over PULSE_FADE
  onPulse();                           // after PULSE_RETURN_DELAY, back to 1 over PULSE_RETURN_FADE
  stop();
}
```

Graph: voices → `pieceGain` (fades) → `storyGain` (pulse) → low-pass `BUS_LOWPASS_HZ` → `e.buses.music`. `lead` and `sparkle` also feed the existing ping-pong delay (feedback = the piece's `delayFb`), whose output joins `pieceGain`. A `play` command creates a new `pieceGain` at 1 so a late fade of the old piece cannot silence the new one.

Instruments (spec section 5), each a function `(midi, t, dur, gain, dest)`: `piano` (existing periodic wave), `glass`, `reed`, `bell` (2-op FM, ratio 3.5), `sub` (bass), `warm` (pad, low-pass at `theme.padCutoff`, attack 1.5 s, release 2 s). Sparkle and signal phrases always use `bell`. Disconnect nodes on `ended` as today.

Scheduler: `setInterval(TICK_MS)`; each tick, if `ctx.state === 'running'`: run `director.update(ctx.currentTime, lastContext)`, turn `play`/`phrase` commands into absolute-time events appended to the queue (a `play` first clears queued events of the previous piece), apply `fade` with `setTargetAtTime` on that piece's `pieceGain`, then `dueEvents(queue, now, LOOKAHEAD)` and start the `play` list. The director's rng is `mulberry32(Date.now() >>> 0)`.

`main.js:576` becomes:

```js
music.setContext({
  planet: economy.planet ?? 'earth', depth01: g.depth01, onSurface,
  nearRuin: false, relics: 0, finaleLevel: 0,   // wired in Task 6 where the other plans' APIs exist
});
```

- [ ] **Step 1: Write the failing test:**

```js
it('dueEvents drops the backlog instead of bursting', () => {
  const q = [0, 1, 2, 9.99, 10.1, 10.4].map(t => ({ t }));
  const r = dueEvents(q, 10, 0.25);
  expect(r.play.map(e => e.t)).toEqual([9.99, 10.1]); expect(r.rest.map(e => e.t)).toEqual([10.4]); expect(r.dropped).toBe(3);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Rewrite `Music.js`; delete `AUDIO.MUSIC` and the comment block above it from `config.js`; change `main.js:576`. Confirm with Grep that `AUDIO.MUSIC` and `setLayer` have no remaining references in `web/`.
- [ ] **Step 4:** Run `npm test` (whole suite) → PASS.
- [ ] **Step 5:** Checkpoint — commit only if permitted: `feat(web): generative music playback`.

---

### Task 6: Story hooks

**Files:** Modify `web/src/audio/Composer.js`, `web/src/audio/Music.js`, `web/src/main.js`; add to `web/tests/music.test.js`.

**Produces:**

```js
/** First signalLength(relics) notes of SIGNAL_MOTIF in the piece's key; t relative to 0; voice 'sparkle'. */
export function signalPhrase(theme, relics, piece);
/** One FINALE_BARS piece at FINALE_BPM in THEMES.tessera.deep's key. 1: pad + bass on every beat. 2: + lead made only of SIGNAL_MOTIF fragments (2–4 consecutive notes). 3: + sparkle; piece.padCutoffMul = 1.5. */
export function composeFinale(level, rng);
/** Full SIGNAL_MOTIF once over pad chords, last chord a major triad on the tonic, then pad tail of ENDING_TAIL_SEC. themeId 'ending'. */
export function composeEnding();
```

`Music` passes all three to the director.

Wiring in `main.js`, each only if the named API exists in the codebase when this task runs; otherwise leave the inert value from Task 5 and say so in the task report:
- `nearRuin`: story plan Task 3 `nearestRuin` from `world/Ruins.js` — true when a ruin is within `MUSIC.RUIN_RADIUS` tiles of the player's tile. Compute it at most twice a second, not per frame.
- `relics`: count of owned relics in `economy.relics` (story plan Task 2 defines its shape).
- `finaleLevel`: planets plan `MindGoal` — nodes active 1–3, ending shown 4.
- `if (EV.PULSE_WARN) bus.on(EV.PULSE_WARN, () => music.onPulseWarn()); if (EV.PULSE) bus.on(EV.PULSE, () => music.onPulse());`

- [ ] **Step 1: Write the failing tests:**

```js
it('signal phrase grows with relics and stays in sparkle range', () => {
  const piece = composePiece(THEMES.earth.mid, {}, mulberry32(1));
  expect(signalPhrase(THEMES.earth.mid, 0, piece).length).toBe(2);
  expect(signalPhrase(THEMES.earth.mid, 4, piece).length).toBe(6);
  for (const e of signalPhrase(THEMES.earth.mid, 9, piece)) { expect(e.voice).toBe('sparkle'); expect(e.midi).toBeGreaterThanOrEqual(72); expect(e.midi).toBeLessThanOrEqual(91); }
});
it('finale levels add voices and respect the voice cap', () => {
  const voices = l => new Set(composeFinale(l, mulberry32(2)).events.map(e => e.voice));
  expect([...voices(1)].sort()).toEqual(['bass', 'pad']);
  expect(voices(2).has('lead')).toBe(true); expect(voices(2).has('sparkle')).toBe(false);
  expect(voices(3).has('sparkle')).toBe(true);
  const p = composeFinale(3, mulberry32(2));
  expect(p.bpm).toBe(84); expect(peakPolyphony(p.events)).toBeLessThanOrEqual(MUSIC.MAX_VOICES);
  for (const e of p.events) { const [lo, hi] = MUSIC.RANGE[e.voice]; expect(e.midi).toBeGreaterThanOrEqual(lo); expect(e.midi).toBeLessThanOrEqual(hi); }
});
it('ending states the whole motif once and resolves to a major chord', () => {
  const p = composeEnding();
  expect(p.events.filter(e => e.voice === 'sparkle' || e.voice === 'lead').length).toBe(7);
  const last = p.events.filter(e => e.voice === 'pad').sort((a, b) => b.t - a.t).slice(0, 3).map(e => e.midi % 12).sort((a, b) => a - b);
  const root = THEMES.tessera.deep.root % 12;
  expect(last).toEqual([root, (root + 4) % 12, (root + 7) % 12].sort((a, b) => a - b));
  expect(p.duration).toBeGreaterThanOrEqual(MUSIC.ENDING_TAIL_SEC);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement and wire. **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Checkpoint — commit only if permitted: `feat(web): music story hooks`.

---

### Task 7: Verification in the running game

No new files. Use the `preview_start` dev server on port 5273 (never Bash for the server).

- [ ] **Step 1:** `npm test` in `web/` → all pass. Read the browser console → no errors after starting a game.
- [ ] **Step 2:** For a fast listen, temporarily call from the console (do not commit anything): compose one piece per Earth zone and log `duration`, `bpm`, events per voice, `peakPolyphony`; confirm they match the spec ranges.
- [ ] **Step 3:** In game, check and report each: (a) a piece starts ~2 s after Start at camp; (b) descending past 35% depth does not cut the music, the next piece is the mid theme; (c) a 3 s hop to the surface changes nothing; (d) Music off then on mid-piece resumes the same piece; (e) hide the tab 30 s, return: no burst of notes; (f) with the dev panel, go deep: tempo is audibly slower and lower.
- [ ] **Step 4:** Tune by ear within the comfort rules (envelopes, FM index, `LEAD_GAIN`, pad cutoff). Re-run `npm test`.
- [ ] **Step 5:** Report to the user what was verified and what could not be (anything behind the other plans' APIs). Ask before committing.
