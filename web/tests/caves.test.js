import { describe, it, expect } from 'vitest';
import { PLANETS, TILE, WORLD } from '../src/config.js';
import { computeBandStarts, bandMaterialAt, stratumIndexAt } from '../src/world/gen/strata.js';
import { carveCaves, openFraction, applyCaveRules, placeFluids } from '../src/world/gen/caves.js';

const W = WORLD.W, H = PLANETS.earth.H;
function caveOnly(seed) {
  const planet = PLANETS.earth;
  const starts = computeBandStarts(seed, W, H, planet);
  const tileType = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    tileType[y * W + x] = y < WORLD.SURFACE_ROWS ? TILE.AIR : (x === 0 || x === W - 1 || y === H - 1) ? TILE.BEDROCK : bandMaterialAt(starts, x, y, W, planet);
  }
  const d = { W, H, seed, planet: 'earth', tileType, starts, gas: new Uint8Array(W * H) };
  carveCaves(d, starts, seed);
  applyCaveRules(d, starts);
  placeFluids(d, starts, seed);
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
      const air = b < B && (isAir(d, x, y) || d.tileType[y * W + x] === TILE.WATER) && d.band?.[y * W + x] !== -1 && bandMaterialAt(d.starts, x, y, W, PLANETS.earth) === tile;
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
  const open = (d, x, y) => [TILE.AIR, TILE.WATER, TILE.MAGMA].includes(d.tileType[y * W + x]);
  it('nothing is carved in the first CAVE_MIN_DEPTH rows or under the camp pad', () => {
    for (const s of seeds) for (let y = WORLD.SURFACE_ROWS; y < WORLD.SURFACE_ROWS + WORLD.CAVE_MIN_DEPTH; y++) for (let x = 1; x < W - 1; x++) expect(open(world(s), x, y), `seed ${s} ${x},${y}`).toBe(false);
  });
  it('no cave within 2 columns of the camp shaft for the first 15% of depth', () => {
    const sx = WORLD.BASE_CAMP.SHAFT_X, lim = WORLD.SURFACE_ROWS + 0.15 * (H - 1 - WORLD.SURFACE_ROWS);
    for (const s of seeds) for (let y = WORLD.SURFACE_ROWS; y < lim; y++) for (let x = sx - 2; x <= sx + 2; x++) expect(open(world(s), x, y), `seed ${s}`).toBe(false);
  });
  it('no fluid or gas touches the shaft column in the first stratum', () => {
    const sx = WORLD.BASE_CAMP.SHAFT_X;
    for (const s of seeds) {
      const d = world(s);
      for (let y = WORLD.SURFACE_ROWS; y < H - 1; y++) {
        if (stratumIndexAt(d.starts, sx, y, W, PLANETS.earth) !== 0) continue;
        const t = d.tileType[y * W + sx];
        expect(t === TILE.WATER || t === TILE.MAGMA || d.gas[y * W + sx] > 0, `seed ${s} row ${y}`).toBe(false);
      }
    }
  });
  it('a cave never reaches more than 2 rows into a harder stratum from above', () => {
    const planet = PLANETS.earth;
    for (const s of seeds) {
      const d = world(s), seen = new Uint8Array(W * H);
      const k = (x, y) => stratumIndexAt(d.starts, x, y, W, planet);
      const inb = (x, y) => x >= 1 && x < W - 1 && y >= WORLD.SURFACE_ROWS && y < H - 1;
      const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (let kk = 1; kk < planet.strata.length; kk++) {
        seen.fill(0);
        const stack = [];
        for (let y = WORLD.SURFACE_ROWS; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          if (k(x, y) !== kk || !isAir(d, x, y)) continue;
          if (nb.some(([dx, dy]) => inb(x + dx, y + dy) && isAir(d, x + dx, y + dy) && k(x + dx, y + dy) < kk)) { seen[y * W + x] = 1; stack.push(y * W + x); }
        }
        while (stack.length) {
          const i = stack.pop(), x = i % W, y = (i / W) | 0;
          if (k(x, y) === kk) expect(y, `seed ${s} stratum ${kk} ${x},${y}`).toBeLessThanOrEqual(d.starts[kk * W + x] + 2);
          for (const [dx, dy] of nb) {
            const nx = x + dx, ny = y + dy;
            if (inb(nx, ny) && !seen[ny * W + nx] && isAir(d, nx, ny) && k(nx, ny) >= kk) { seen[ny * W + nx] = 1; stack.push(ny * W + nx); }
          }
        }
      }
    }
  });
  it('wide karst floors sometimes hold one tile of water, never more', () => {
    let wet = 0;
    for (const s of seeds) {
      const d = world(s);
      for (let y = WORLD.SURFACE_ROWS; y < H - 2; y++) for (let x = 1; x < W - 1; x++) {
        if (d.tileType[y * W + x] !== TILE.WATER || stratumIndexAt(d.starts, x, y, W, PLANETS.earth) !== 1) continue;
        wet++;
        expect(d.tileType[(y - 1) * W + x], `seed ${s} ${x},${y}`).not.toBe(TILE.WATER);
        expect(d.tileType[(y + 1) * W + x], `seed ${s} ${x},${y}`).not.toBe(TILE.WATER);
        expect(open(d, x, y + 1) && d.tileType[(y + 1) * W + x] !== TILE.AIR, `seed ${s} ${x},${y} floor`).toBe(false);
      }
    }
    expect(wet).toBeGreaterThan(0);
  });
});
