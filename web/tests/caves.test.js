import { describe, it, expect } from 'vitest';
import { PLANETS, TILE, WORLD } from '../src/config.js';
import { computeBandStarts, bandMaterialAt } from '../src/world/gen/strata.js';
import { carveCaves, openFraction } from '../src/world/gen/caves.js';

const W = WORLD.W, H = PLANETS.earth.H;
function caveOnly(seed) {
  const planet = PLANETS.earth;
  const starts = computeBandStarts(seed, W, H, planet);
  const tileType = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    tileType[y * W + x] = y < WORLD.SURFACE_ROWS ? TILE.AIR : (x === 0 || x === W - 1 || y === H - 1) ? TILE.BEDROCK : bandMaterialAt(starts, x, y, W, planet);
  }
  const d = { W, H, seed, planet: 'earth', tileType, starts };
  carveCaves(d, starts, seed);
  return d;
}
const seeds = Array.from({ length: 40 }, (_, k) => 77 + k * 104729);
const cache = new Map();
const world = (s) => cache.get(s) ?? (cache.set(s, caveOnly(s)), cache.get(s));
const isAir = (d, x, y) => d.tileType[y * W + x] === TILE.AIR;
const runs = (d, tile, horizontal) => {
  const out = [];
  const A = horizontal ? H : W, B = horizontal ? W : H;
  for (let a = 0; a < A; a++) {
    let r = 0;
    for (let b = 0; b <= B; b++) {
      const x = horizontal ? b : a, y = horizontal ? a : b;
      const air = b < B && isAir(d, x, y) && d.band?.[y * W + x] !== -1 && bandMaterialAt(d.starts, x, y, W, PLANETS.earth) === tile;
      if (air) r++; else if (r) { out.push(r); r = 0; }
    }
  }
  return out;
};
const mean = (a) => a.reduce((p, c) => p + c, 0) / (a.length || 1);

describe('caves', () => {
  it('every stratum lands inside its open-space budget', () => {
    for (const s of seeds) {
      const d = world(s);
      PLANETS.earth.strata.forEach((st, k) => {
        const f = openFraction(d, d.starts, k);
        expect(f, `seed ${s} stratum ${k}`).toBeGreaterThanOrEqual(st.cave.open[0] - 0.01);
        expect(f, `seed ${s} stratum ${k}`).toBeLessThanOrEqual(st.cave.open[1] + 0.01);
      });
    }
  });
  it('karst caves are wider than tall; fissures are thin', () => {
    let h = [], v = [], thin = 0, air = 0;
    for (const s of seeds.slice(0, 10)) {
      const d = world(s);
      h.push(...runs(d, TILE.LIMESTONE, true)); v.push(...runs(d, TILE.LIMESTONE, false));
      for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
        if (!isAir(d, x, y) || bandMaterialAt(d.starts, x, y, W, PLANETS.earth) !== TILE.GRANITE) continue;
        air++;
        // fissure normal is perpendicular to the 30 degree crack; thin if one axis has solid on both sides within 2 tiles
        const solid = (a, b) => !isAir(d, a, b);
        if ((solid(x - 1, y) && solid(x + 1, y)) || (solid(x, y - 1) && solid(x, y + 1))) thin++;
      }
    }
    expect(mean(h)).toBeGreaterThanOrEqual(2 * mean(v));
    expect(thin / air).toBeGreaterThanOrEqual(0.8);
  });
  it('tubes are long: basalt has a horizontal air run of 12 or more', () => {
    for (const s of seeds.slice(0, 10)) expect(Math.max(...runs(world(s), TILE.BASALT, true)), `seed ${s}`).toBeGreaterThanOrEqual(12);
  });
  it('same seed gives same caves', () => {
    expect(caveOnly(5).tileType).toEqual(caveOnly(5).tileType);
  });
});
