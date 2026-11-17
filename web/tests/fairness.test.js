import { describe, it, expect } from 'vitest';
import { AUDIT, PLANETS, SET_PIECES, WORLD } from '../src/config.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { computeBandStarts } from '../src/world/gen/strata.js';
import { auditOres, auditReach, auditSafety } from '../src/world/gen/audit.js';
import { openFraction } from '../src/world/gen/caves.js';
import { planSetPieces } from '../src/world/Zones.js';

const N = 200;
// Caves hit the budget within 0.01 (caves.test.js); set pieces, fluids and repairs then move the final map up to ~0.055 (measured over these seeds).
const SLACK = 0.06;
const earth = PLANETS.earth;
const seeds = Array.from({ length: N }, (_, k) => 5000 + k * 104729);

describe('fairness (spec 11)', () => {
  it(`${N} Earth seeds: ores, reach, safety, open budget, landmarks and ruins; under 2% retries`, () => {
    let retries = 0;
    for (const s of seeds) {
      const w = generateWorld(s);
      if (w.genSeed !== s) retries++;
      const starts = computeBandStarts(w.genSeed, w.W, w.H, earth);
      const tag = `seed ${s}`;
      for (const r of auditOres(w)) {
        expect(r.have, `${tag} ore ${r.ore} ceiling`).toBeLessThanOrEqual(r.ceil);
        if (r.bulk) continue; // bulk ores are ceiling-only (AUDIT.BULK_TILES)
        expect(r.have, `${tag} ore ${r.ore} floor`).toBeGreaterThanOrEqual(r.floor);
        expect(r.haveOpen, `${tag} ore ${r.ore} open floor`).toBeGreaterThanOrEqual(r.floor / AUDIT.FLOOR * AUDIT.FLOOR_OPEN);
      }
      expect(auditReach(w, starts), tag).toEqual([]);
      expect(auditSafety(w, starts), tag).toEqual([]);
      earth.strata.forEach((st, k) => {
        const f = openFraction(w, starts, k);
        expect(f, `${tag} stratum ${k}`).toBeGreaterThanOrEqual(st.cave.open[0] - SLACK);
        expect(f, `${tag} stratum ${k}`).toBeLessThanOrEqual(st.cave.open[1] + SLACK);
      });
      const U = w.H - 1 - WORLD.SURFACE_ROWS; const y0 = (f) => WORLD.SURFACE_ROWS + U * f; // a landmark kind may also appear as an optional piece in another stratum
      const pieces = planSetPieces(w.genSeed, w.W, w.H, earth);
      earth.strata.forEach((st, k) => {
        const lm = Object.keys(SET_PIECES).find((kd) => SET_PIECES[kd].landmarkOf === k);
        if (lm) expect(pieces.filter((p) => p.kind === lm && p.y >= y0(st.from) && p.y < y0(st.to)).length, `${tag} landmark ${lm}`).toBe(1);
      });
      expect(pieces.filter((p) => p.kind === 'ruin').map((p) => p.layer), tag).toEqual([0, 1, 2, 3, 4]);
    }
    expect(retries / N).toBeLessThan(0.02);
  });
});
