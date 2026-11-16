# Generative Music Redesign — Design

Web game (`web/`). Replaces the current one-loop-per-layer score with a generative composer that writes whole pieces, matched to planet and depth, built for long play sessions.

## 1. Intent

The user asked for the game's music to be redesigned: fitted to the map (planet) and depth, with balanced track lengths because the game can be long, and not annoying.

Why the current score annoys (`web/src/audio/Music.js`, `AUDIO.MUSIC` in `config.js`): each layer has one 16-step melody that repeats every 5–14 s, there is a single voice, it never stops, and it only knows Earth's layers.

### Goals
- Music that can run for hours without a recognisable loop.
- Each planet sounds like itself; going deeper changes the music gradually.
- Pieces of 2–3 minutes separated by real silence.
- Story moments (ruins, pulse storm, final sequence, ending) have a musical voice.
- No audio files, no external services, no new dependencies.

### Non-goals
- Recorded or sampled instruments. Orchestral realism.
- A music settings screen beyond the existing on/off toggle and volume slider.
- Changing SFX or ambience (`audio/SFX.js`), except that ambience carries the gaps between pieces as it already plays.

### Anti-goals (it has failed if…)
- A melody can be hummed back after ten minutes because it repeats verbatim.
- The music is ever the loudest or sharpest thing in the mix, or masks gameplay sounds (low-energy beep, pulse warning, quake rumble).
- Music changes abruptly every time the player crosses a layer edge or hops in and out of camp.

## 2. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Generative composer on the existing Web Audio engine | No files, never repeats, adapts to depth/planet; timbre stays synthetic |
| B | Recorded tracks per planet/layer | Better timbre; needs external generation, large download, fixed loops go stale in a long game |
| C | Recorded pads + generative melody | Richer; pays both costs |

The user picked A.

## 3. Architecture

Three units, split so the musical logic is pure and testable without Web Audio:

| File | Responsibility |
|---|---|
| `web/src/audio/musicThemes.js` | Frozen data: scales, instruments, the theme of every planet × zone, special themes, tuning constants (`MUSIC`). Replaces `AUDIO.MUSIC` in `config.js`. |
| `web/src/audio/Composer.js` | Pure functions. `composePiece(theme, ctxParams, rng)` returns a piece: `{ duration, events: [{ t, dur, midi, voice, gain }] }`. No Web Audio, no `Math.random` (takes an `rng`). |
| `web/src/audio/Music.js` | Playback: picks the theme from the game context, asks the Composer for a piece, schedules its events on the AudioContext clock with the existing look-ahead scheduler, renders voices, handles gaps, fades and story hooks. |

`main.js` replaces `music.setLayer(...)` with one call per frame:

```js
music.setContext({ planet, depth01, onSurface, nearRuin, relics, finaleLevel });
```

- `planet`: planet id; `'earth'` when the planets plan has not landed.
- `depth01`: existing `g.depth01`.
- `nearRuin`: true within `MUSIC.RUIN_RADIUS` (12) tiles of a ruin; `false` until the story plan's `nearestRuin` exists.
- `relics`: number of relics owned (0 until the story plan lands).
- `finaleLevel`: 0 = not in the final sequence, 1–3 = siphon nodes active (planets plan `MindGoal`), 4 = ending.

Pulse hooks use events (`EV.PULSE_WARN`, `EV.PULSE`) when they exist. Every hook degrades to "absent" so this work can ship before or after the other three plans.

## 4. What a piece is

- **Length:** 120–180 s, chosen per piece. **Gap** after it: 30–60 s of silence (ambience only). At camp/surface the gap is 20–40 s.
- **Metre:** 4 beats per bar. Tempo comes from the theme and depth (section 6).
- **Form** (in bars, scaled to hit the target length): `intro` (pad alone) → `A` (pad + sparse lead) → `B` (bass enters, lead fuller, optional sparkle) → `A'` (A's material varied, bass stays) → `outro` (lead drops, pad fades over the last 2 bars). Shares: 10% / 25% / 30% / 25% / 10%.
- **Harmony:** each theme has 2–3 chord progressions as scale-degree roots (e.g. `[0, 3, 4, 0]`); one is chosen per section, each chord lasts 2 bars. Chords are stacked thirds in the theme's scale (degree, +2, +4).

### Voices

| Voice | Role | Rules |
|---|---|---|
| `pad` | The chord, 2–3 notes | Attack 1.5 s, release 2 s, low-passed (≤ 1.2 kHz), two slightly detuned oscillators per note |
| `bass` | Chord root, sometimes the fifth | One or two notes per bar, sine, MIDI 28–48 |
| `lead` | Melody in the planet's instrument | Built from motifs (below), MIDI 55–84 |
| `sparkle` | Rare high colour; also carries the Signal motif | At most one phrase per 8 bars, MIDI 72–91, gain ≤ 40% of lead |

### Melody from motifs

Each theme has 4–6 motifs. A motif is a short list of `[degreeOffset, beats]` pairs relative to the current chord root, 2–5 notes, with rests allowed. Per bar-pair the composer either rests the lead or places a motif transformed by one of: as written, transposed by one chord tone, inverted, rhythm stretched ×2, last note held. This is what removes the loop: material is recognisable as belonging to the place without ever repeating as a block.

### Listening-comfort rules (enforced by the composer, covered by tests)

1. The lead is silent in at least 40% of bars of every piece.
2. The same motif (ignoring transformation) never plays more than twice in a row.
3. Consecutive pieces never start with the same motif or the same progression.
4. No lead note above MIDI 84, no sparkle above 91, no bass below 28.
5. Every note is in the theme's scale, except "colour" notes in deep zones: at most 8% of lead notes, always followed by a step back into the scale.
6. No raw square or sawtooth: every voice goes through a low-pass; the whole music bus gets one extra low-pass at 5 kHz.
7. At most `MUSIC.MAX_VOICES` (20) oscillators sounding; the composer thins pad notes first if a piece would exceed it.

## 5. Instruments

Synth recipes in `Music.js`, named in theme data:

| Name | Recipe | Used for |
|---|---|---|
| `piano` | Existing periodic wave (decaying harmonics), fast attack | Earth |
| `glass` | Sine + quiet octave, 30 ms attack, long decay | Earth mid, Moon |
| `reed` | Triangle through a 900 Hz low-pass, 5 Hz vibrato fading in | Mars |
| `bell` | Two-operator FM, ratio 3.5, short modulator decay | Tessera, Signal motif |
| `sub` | Sine, slow attack | Bass everywhere |
| `warm` | Two detuned triangles, low-passed | Pad everywhere (cutoff varies by theme) |

The existing ping-pong delay stays on `lead` and `sparkle` only.

## 6. Themes: planet × depth

Depth is read as three zones per planet by `depth01`, so the music does not depend on stratum ids: **shallow** `< 0.35`, **mid** `< 0.78`, **deep** otherwise, plus **camp** on the surface. Within a zone, depth still bends the piece continuously (`d` = `depth01`):

- tempo × `(1 − 0.25·d)`
- lead and pad moved down by `round(3·d)` scale steps (register sinks; still inside each voice's MIDI range)
- chance that a bar-pair has a lead motif: `0.6 − 0.3·d` (it thins out)
- delay feedback `0.35 + 0.2·d` (more echo, bigger space)

| Planet | Zone | Key / scale | Lead | Base tempo | Character |
|---|---|---|---|---|---|
| Earth | camp | C major pentatonic | piano | 66 | Warm, safe, home |
| Earth | shallow | G major pentatonic | piano | 76 | Light, curious |
| Earth | mid | A dorian | glass | 68 | Cooler, patient |
| Earth | deep | E phrygian | glass, low | 54 | Heavy, hot, sparse |
| Moon | camp | D lydian | glass | 52 | Still, wide |
| Moon | shallow | D lydian | glass | 56 | Long held notes, lots of space |
| Moon | mid | B aeolian | glass | 52 | Lonely |
| Moon | deep | B aeolian, pad only half the time | glass | 46 | Almost silence |
| Mars | camp | F♯ dorian | reed | 60 | Dry, windy |
| Mars | shallow | F♯ dorian | reed | 66 | Open, dusty |
| Mars | mid | C♯ phrygian dominant | reed | 60 | Ancient, arid |
| Mars | deep | C♯ phrygian | reed, low | 52 | Pressure |
| Tessera | camp | C augmented hexatonic `[0,3,4,7,8,11]` | bell | 58 | Cold, artificial |
| Tessera | shallow | same | bell | 62 | Mechanical calm |
| Tessera | mid | same, root F | bell | 58 | Strange but ordered |
| Tessera | deep | same, root A♭ | bell + sub | 50 | Vast machine |

Tessera's scale is symmetrical: every chord in it is consonant on its own but the key never settles, which reads as "built, not grown" without being harsh.

Exact motifs and progressions per theme are the builder's to write within these rows; each theme needs at least 4 motifs and 2 progressions.

## 7. Transitions

- **Zone or planet change while a piece plays:** the piece continues to the end of its current section, then fades out over 4 s. The next piece (after a short 8 s gap) uses the new context. A layer edge never cuts the music.
- **Camp ↔ underground:** the new context must hold for `MUSIC.SWITCH_HOLD` (6 s) before anything happens, then the same "finish the section, fade" rule applies. Quick trips to the surface change nothing.
- **Continuous depth parameters** (tempo, register, density) are sampled once, when a piece is composed. They do not drift mid-piece.

## 8. Story hooks

- **The Signal motif.** One fixed 7-note phrase in `bell`, defined once in `musicThemes.js`. Near a ruin the sparkle voice plays its first `min(7, 2 + relics)` notes, at most once every 20 s, in the current piece's key. The player hears the phrase grow as relics are collected. It is never complete before the ending.
- **Pulse storm.** On `PULSE_WARN` the music bus fades to silence in 1 s (the suit's electronics are about to fail; the warning sound owns the moment). It returns with a 6 s fade-in 4 s after `PULSE`. The piece clock keeps running underneath.
- **Final sequence** (`finaleLevel` 1–3). One continuous piece with no gaps and no fade rule, in Tessera deep's key, tempo fixed at 84. Level 1: pad + bass pulse on every beat. Level 2: adds a lead built only from Signal-motif fragments. Level 3: adds sparkle and raises pad cutoff. Comfort rules 4, 6 and 7 still apply; rule 1 does not.
- **Ending** (`finaleLevel` 4). The full Signal motif, once, harmonised and resolving to a major chord for the first time in the game, then a 20 s pad tail. After it, silence until the player leaves the ending screen.

## 9. Robustness

- If the scheduler falls behind (tab hidden, timers throttled), it does not burst-play the backlog: events whose time has already passed are dropped and the clock resumes from now.
- `music.start()` keeps its current contract (called after the first user gesture; no-op until the engine is ready).
- Music off (`musicOn: false`) keeps composing and scheduling at zero volume, as now, so turning it back on needs no special case.
- All oscillators and gains are disconnected on `ended` as today.

## 10. Testing (`web/tests/music.test.js`, replaces the current file)

Composer tests with a seeded rng, run over every theme and 20 seeds:
- piece duration is 120–180 s (camp pieces included);
- all pitches are in range per voice (rule 4) and in scale, colour notes ≤ 8% and each resolved by step (rule 5);
- lead silent in ≥ 40% of bars (rule 1); no motif more than twice in a row (rule 2);
- two pieces from different seeds differ; the same seed gives the same piece;
- peak simultaneous notes ≤ `MAX_VOICES`;
- deeper `depth01` gives a slower tempo and a lower mean lead pitch for the same theme and seed.

Data tests: every planet has `camp`, `shallow`, `mid`, `deep`; every theme has ≥ 4 motifs and ≥ 2 progressions; the Signal motif has 7 notes; `signalLength(relics)` is 2 at 0 relics and never exceeds 7.

Playback is checked by ear in the running game (port 5273): Earth camp, one descent through all three zones, a quick surface hop (no change), music toggle, and tab hide/return.

## 11. Compatibility

- `AUDIO.MUSIC` leaves `config.js`; nothing else reads it (`Music.js` and `tests/music.test.js` only).
- No save changes. Settings unchanged.
- `Music.setLayer` is removed; `main.js` is its only caller.

## 12. Left to the builder

- The actual motifs, progressions and the Signal motif's notes (within section 6 and 8).
- Exact synth numbers (envelopes, FM index, detune) — tune by ear; the comfort rules are the limits.
- Tempo, gap and density constants are starting values.
