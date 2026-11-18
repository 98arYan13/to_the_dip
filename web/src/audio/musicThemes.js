/** Theme data for the generative score: constants, scales, 16 planet x zone themes, Signal motif. */

const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o); };

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

export const SCALES = deepFreeze({
  majorPent: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  augmented: [0, 3, 4, 7, 8, 11],
});

// Motif sets by character: [degree|null, beats], 2-5 notes, <= 8 beats. Degrees are scale steps.
const M = {
  warm: [[[0, 2], [2, 1], [4, 1]], [[4, 2], [2, 1], [0, 1], [1, 2]], [[0, 1], [1, 1], [2, 2]], [[2, 1], [null, 1], [4, 2], [3, 2]]],
  light: [[[2, 1], [3, 1], [4, 2]], [[0, 1], [2, 1], [4, 1], [3, 1]], [[4, 1], [3, 1], [2, 1], [0, 1]], [[1, 2], [null, 1], [2, 1], [0, 2]]],
  cool: [[[0, 2], [2, 2], [4, 2]], [[4, 3], [2, 1], [1, 2]], [[0, 1], [3, 1], [2, 2], [null, 2]], [[6, 2], [4, 2], [2, 2]]],
  heavy: [[[0, 3], [1, 1], [0, 3]], [[4, 2], [3, 2], [1, 3]], [[0, 2], [null, 2], [2, 2]], [[1, 3], [0, 3]]],
  still: [[[0, 4], [2, 3]], [[4, 3], [2, 3], [0, 2]], [[2, 4], [null, 2], [4, 2]], [[0, 3], [1, 2], [0, 3]]],
  lonely: [[[4, 3], [2, 3]], [[0, 2], [2, 2], [1, 4]], [[2, 4], [0, 4]], [[4, 2], [null, 2], [3, 3]]],
  dry: [[[0, 1], [2, 1], [4, 2]], [[4, 1], [3, 1], [2, 2], [0, 2]], [[0, 2], [null, 1], [1, 1], [0, 2]], [[2, 2], [4, 2], [3, 2]]],
  arid: [[[0, 1], [1, 1], [2, 1], [1, 1]], [[4, 2], [2, 1], [1, 1], [0, 2]], [[0, 2], [2, 2], [1, 3]], [[3, 1], [2, 1], [1, 1], [0, 3]]],
  press: [[[0, 4], [1, 2]], [[2, 3], [1, 3], [0, 2]], [[0, 2], [null, 2], [1, 4]], [[3, 2], [2, 2], [0, 4]]],
  machine: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[3, 1], [2, 1], [1, 1], [0, 1], [2, 2]], [[0, 2], [2, 2], [4, 2]], [[5, 1], [3, 1], [1, 1], [null, 1], [0, 2]]],
};
const P = { // chord-root degree progressions
  sweet: [[0, 3, 4, 3], [0, 4], [0, 2, 3, 4]],
  curious: [[0, 2, 4, 2], [0, 3, 0, 4], [2, 4, 0]],
  modal: [[0, 3, 5, 3], [0, 5, 3, 4], [0, 2, 3]],
  dark: [[0, 1, 0, 5], [0, 5, 4], [0, 1, 4, 0]],
  wide: [[0, 4], [0, 3, 4], [0, 2, 4, 3]],
  odd: [[0, 2, 1, 4], [0, 3, 2], [0, 1, 3, 5]],
};

// shortcut: themes of one planet share motif/progression sets by character; give a theme its own set if it needs to differ.
const mk = (id, name, root, scale, lead, bpm, padCutoff, motifs, progressions, extra = {}) =>
  ({ id, name, root, scale: SCALES[scale], lead, bpm, padCutoff, padChance: 1, colour: false, motifs: M[motifs], progressions: P[progressions], ...extra });

export const THEMES = deepFreeze({
  earth: {
    camp: mk('earth.camp', 'Home', 48, 'majorPent', 'piano', 66, 900, 'warm', 'sweet'),
    shallow: mk('earth.shallow', 'Curious', 43, 'majorPent', 'piano', 76, 1000, 'light', 'curious'),
    mid: mk('earth.mid', 'Patient', 45, 'dorian', 'glass', 68, 800, 'cool', 'modal'),
    deep: mk('earth.deep', 'Heavy', 40, 'phrygian', 'glass', 54, 600, 'heavy', 'dark', { colour: true }),
  },
  moon: {
    camp: mk('moon.camp', 'Still', 50, 'lydian', 'glass', 52, 800, 'still', 'wide'),
    shallow: mk('moon.shallow', 'Held', 50, 'lydian', 'glass', 56, 800, 'still', 'wide'),
    mid: mk('moon.mid', 'Lonely', 47, 'aeolian', 'glass', 52, 700, 'lonely', 'modal'),
    deep: mk('moon.deep', 'Almost Silence', 47, 'aeolian', 'glass', 46, 500, 'lonely', 'dark', { padChance: 0.5, colour: true }),
  },
  mars: {
    camp: mk('mars.camp', 'Windy', 42, 'dorian', 'reed', 60, 900, 'dry', 'modal'),
    shallow: mk('mars.shallow', 'Dusty', 42, 'dorian', 'reed', 66, 1000, 'dry', 'curious'),
    mid: mk('mars.mid', 'Ancient', 49, 'phrygianDominant', 'reed', 60, 800, 'arid', 'odd'),
    deep: mk('mars.deep', 'Pressure', 37, 'phrygian', 'reed', 52, 600, 'press', 'dark', { colour: true }),
  },
  tessera: {
    camp: mk('tessera.camp', 'Cold', 48, 'augmented', 'bell', 58, 900, 'machine', 'odd'),
    shallow: mk('tessera.shallow', 'Mechanical', 48, 'augmented', 'bell', 62, 1000, 'machine', 'odd'),
    mid: mk('tessera.mid', 'Ordered', 41, 'augmented', 'bell', 58, 800, 'machine', 'wide'),
    deep: mk('tessera.deep', 'Vast Machine', 44, 'augmented', 'bell', 50, 600, 'machine', 'dark', { colour: true }),
  },
});

/** The 7-note Signal phrase: [degree, beats]. */
export const SIGNAL_MOTIF = deepFreeze([[0, 1], [2, 1], [4, 1], [2, 1], [3, 1], [1, 1], [0, 2]]);

/** @param {number} depth01 @param {boolean} onSurface @returns {'camp'|'shallow'|'mid'|'deep'} */
export function zoneOf(depth01, onSurface) {
  if (onSurface) return 'camp';
  const d = Number.isFinite(depth01) ? depth01 : 0;
  return d < MUSIC.ZONE_MID ? 'shallow' : d < MUSIC.ZONE_DEEP ? 'mid' : 'deep';
}

/** Unknown planet falls back to Earth. */
export function themeFor(planet, zone) {
  return (THEMES[planet] ?? THEMES.earth)[zone] ?? THEMES.earth.shallow;
}

/** Signal notes audible with this many relics: min(7, 2 + relics), relics >= 0. */
export function signalLength(relics) {
  return Math.min(7, 2 + Math.max(0, Math.floor(relics) || 0));
}
