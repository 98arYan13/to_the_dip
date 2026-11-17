import { describe, it, expect } from 'vitest';
import { WORLD, TILE, FLAG, ORES, SET_PIECES, PLANETS, MATERIALS } from '../src/config.js';
import { planSetPieces, planZones, blockedAreas, coreChamber, rewardValue } from '../src/world/Zones.js';
import { planRuins } from '../src/world/Ruins.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { expectedTripIncome } from '../src/systems/Economy.js';

const { W, H } = WORLD;
const seeds = Array.from({ length: 50 }, (_, k) => 1000 + k * 7919);
const apart = (a, b, pad) => a.x - pad >= b.x + b.w || b.x - pad >= a.x + a.w || a.y - pad >= b.y + b.h || b.y - pad >= a.y + a.h;
const strata = PLANETS.earth.strata;
const hostK = (w, z) => strata.findIndex((st) => st.tile === w.band[(z.y + (z.h >> 1)) * w.W + z.x + (z.w >> 1)]);

describe('set pieces', () => {
  it('each stratum has its landmark, at most one piece per kind, and its ruin', () => {
    for (const s of seeds) {
      const ps = planSetPieces(s, W, H, PLANETS.earth);
      strata.forEach((st, k) => {
        const lm = Object.keys(SET_PIECES).find((kd) => SET_PIECES[kd].landmarkOf === k);
        const here = ps.filter((p) => p.kind !== 'ruin' && p.y >= WORLD.SURFACE_ROWS + Math.ceil((H - 1 - WORLD.SURFACE_ROWS) * st.from) && p.y < WORLD.SURFACE_ROWS + Math.floor((H - 1 - WORLD.SURFACE_ROWS) * st.to));
        if (lm) expect(here.some((p) => p.kind === lm), `seed ${s} stratum ${k}`).toBe(true);
        const kinds = here.map((p) => p.kind);
        expect(new Set(kinds).size, `seed ${s} stratum ${k}`).toBe(kinds.length);
      });
      expect(ps.filter((p) => p.kind === 'ruin').map((r) => r.layer)).toEqual([0, 1, 2, 3, 4]);
      expect(planRuins(s, W, H)).toEqual(ps.filter((p) => p.kind === 'ruin').map(({ kind, ...r }) => r));
    }
  });
  it('pieces keep 3 tiles apart and stay off the shaft, pad and core chamber', () => {
    const bl = blockedAreas(W, H);
    for (const s of seeds) {
      const ps = planSetPieces(s, W, H);
      ps.forEach((a, i) => {
        for (const b of ps.slice(i + 1)) expect(apart(a, b, 3), `seed ${s} ${a.kind}/${b.kind}`).toBe(true);
        for (const b of bl) expect(apart(a, b, 0), `seed ${s} ${a.kind} blocked`).toBe(true);
      });
    }
  });
  it('ore rewards are worth 0.5-1.0 trips of the era that reaches them', () => {
    let seen = 0;
    for (const s of seeds) {
      const w = generateWorld(s);
      for (const z of planZones(s, W, H)) {
        if (SET_PIECES[z.kind].reward !== 'ore') continue;
        seen++;
        // tier capped at 4: a mantle piece cannot hold half a tier-5 trip of diamonds
        const r = rewardValue(w, z) / expectedTripIncome(Math.min(strata[hostK(w, z)].tier, 4));
        expect(r, `seed ${s} ${z.kind}`).toBeGreaterThanOrEqual(0.5);
        expect(r, `seed ${s} ${z.kind}`).toBeLessThanOrEqual(1.0);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
  it('gas and magma pieces keep their safe approach tunnel', () => {
    for (const s of seeds) {
      const w = generateWorld(s);
      for (const z of planZones(s, W, H)) {
        if (!['gas_cavern', 'lava_lake', 'magma_chamber'].includes(z.kind)) continue;
        const ay = z.y + z.h - 2;
        for (const x of [z.x - 1, z.x - 2]) {
          const i = ay * w.W + x;
          expect(w.tileType[i]).toBe(TILE.AIR); expect(w.gas[i]).toBe(0); expect(w.fluid[i]).toBe(0);
          expect(w.flags[i + w.W] & FLAG.SOLID).toBeTruthy();
        }
      }
    }
  });
  it('every signed piece has a sign tile within 3 tiles outside its wall', () => {
    for (const s of seeds) {
      const d = generateWorld(s);
      for (const z of planZones(s, W, H)) {
        const sign = SET_PIECES[z.kind].sign;
        if (sign === 'none') continue;
        let found = false;
        for (let y = z.y - 3; y < z.y + z.h + 3; y++) for (let x = z.x - 3; x < z.x + z.w + 3; x++) {
          if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) continue;
          const i = y * d.W + x;
          if ((sign === 'moss' && d.flags[i] & FLAG.MOSS) || (sign === 'glint' && d.oreType[i] && ORES[d.oreType[i]].price > 20) || (sign === 'glow' && d.tileType[i] === TILE.MAGMA)) found = true;
        }
        expect(found, `seed ${s} ${z.kind}`).toBe(true);
      }
    }
  });
  it('a lava tube that cannot be placed is skipped without losing the landmark', () => {
    // a map only 40 wide has no room for the 26-wide tube beside the shaft; the stratum landmarks must survive
    const ps = planZones(7, 40, H);
    expect(ps.some((p) => p.kind === 'lava_tube')).toBe(false);
    for (const lm of ['sand_pocket', 'fossil_chamber', 'gas_cavern', 'vault', 'lava_lake']) expect(ps.some((p) => p.kind === lm), lm).toBe(true);
  });
  it('generates 50 seeds without throwing', () => { for (const s of seeds) expect(() => generateWorld(s)).not.toThrow(); });
  it('generates seed 341517 (a host with no ore of its own)', () => { expect(() => generateWorld(341517)).not.toThrow(); });
});
