/**
 * @module world/WorldGen
 * Pure, deterministic world generation: depth bands with noise-perturbed boundaries,
 * fBm caves, water pockets, decorative magma channels, fungi/moss, and ore veins via random walks.
 */
import { WORLD, TILE, FLAG, MATERIALS, ORE_HP_MUL, MINING, PLANETS } from '../config.js';
import { RNG } from '../core/RNG.js';
import { planZones, stampZone, stampCore } from './Zones.js';
import { planRuins, stampRuin } from './Ruins.js';
import { createNoise2D, fbm } from '../core/Noise.js';
import { computeBandStarts, bandMaterialAt } from './gen/strata.js';
import { placeVeins } from './gen/ores.js';

/**
 * @typedef {Object} WorldData
 * @property {number} W @property {number} H @property {number} seed
 * @property {Uint8Array} tileType @property {Uint16Array} tileHP
 * @property {Uint8Array} oreType @property {Uint8Array} flags
 * @property {Uint8Array} band band material id per tile (0 above ground)
 */

/** Max HP of a tile with the given type and ore. */
export function maxHPFor(type, ore) {
  const m = MATERIALS[type];
  if (!m || !m.solid) return 0;
  if (m.hp >= 65535) return m.hp; // bedrock and alien hull: unbreakable, must not scale past Uint16
  return Math.round(m.hp * MINING.HP_MULT * (ore ? ORE_HP_MUL : 1));
}

export { computeBandStarts, bandMaterialAt };

/** Number of underground rows (excludes surface air rows and the bedrock floor). */
export function undergroundRows(H = WORLD.H) {
  return H - 1 - WORLD.SURFACE_ROWS;
}

/**
 * Generate a full world from a seed. Pure: same seed → identical arrays.
 * @param {number} seed
 * @returns {WorldData}
 */
export function generateWorld(seed, planetId = 'earth', W = WORLD.W, H = PLANETS[planetId].H) {
  seed >>>= 0;
  const planet = PLANETS[planetId];
  const n = W * H;
  const tileType = new Uint8Array(n);
  const tileHP = new Uint16Array(n);
  const oreType = new Uint8Array(n);
  const flags = new Uint8Array(n);
  const fluid = new Uint8Array(n);
  const gas = new Uint8Array(n);
  const band = new Uint8Array(n);
  const rng = new RNG(seed);
  const caveNoise = createNoise2D((seed + 1013) | 0);
  const waterNoise = createNoise2D((seed + 2027) | 0);
  const magmaNoise = createNoise2D((seed + 3049) | 0);
  const starts = computeBandStarts(seed, W, H, planet);
  const SR = WORLD.SURFACE_ROWS;
  const U = undergroundRows(H);

  // 1. Bands, caves, water, magma
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = bandMaterialAt(starts, x, y, W, planet);
      band[i] = b;
      if (y < SR) { tileType[i] = TILE.AIR; flags[i] = FLAG.DISCOVERED; continue; }
      if (x === 0 || x === W - 1 || y === H - 1) { tileType[i] = TILE.BEDROCK; continue; }
      let t = b;
      if (y >= SR + WORLD.CAVE_MIN_DEPTH) {
        const d = (y - SR) / U;
        const thr = WORLD.CAVE_THRESHOLD_TOP + (WORLD.CAVE_THRESHOLD_BOTTOM - WORLD.CAVE_THRESHOLD_TOP) * d;
        const c = fbm(caveNoise, x * WORLD.CAVE_FREQ_X, y * WORLD.CAVE_FREQ_Y, WORLD.CAVE_OCTAVES);
        if (c > thr) {
          t = TILE.AIR;
          if (b === TILE.BASALT && fbm(waterNoise, x * WORLD.WATER_FREQ, y * WORLD.WATER_FREQ, 2) > WORLD.WATER_THRESHOLD) {
            t = TILE.WATER;
          }
        }
        if (b === TILE.MANTLE && Math.abs(fbm(magmaNoise, x * WORLD.MAGMA_FREQ_X, y * WORLD.MAGMA_FREQ_Y, 3)) < WORLD.MAGMA_WIDTH) {
          t = TILE.MAGMA;
        }
      }
      tileType[i] = t;
      if (y === SR) flags[i] |= FLAG.DISCOVERED;
    }
  }

  // 2. Solid flags, fungi & moss
  for (let i = 0; i < n; i++) if (MATERIALS[tileType[i]].solid) flags[i] |= FLAG.SOLID;
  for (let y = SR + 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const t = tileType[i];
      if (t !== TILE.BASALT && t !== TILE.GRANITE) continue;
      const open = !(flags[i - W] & FLAG.SOLID) || !(flags[i + W] & FLAG.SOLID) || !(flags[i - 1] & FLAG.SOLID) || !(flags[i + 1] & FLAG.SOLID);
      if (!open) continue;
      if (t === TILE.BASALT && rng.chance(WORLD.FUNGI_CHANCE)) flags[i] |= FLAG.FUNGI;
      else if (rng.chance(WORLD.MOSS_CHANCE)) flags[i] |= FLAG.MOSS;
    }
  }

  // 3. Ore veins per host band
  const d = { W, H, seed, planet: planetId, tileType, oreType, flags, fluid, gas, band, protect: new Uint8Array(n) };
  placeVeins(d, rng);

  // 3b. Designed zones (own RNG streams, applied after ores so the base layout is unchanged)
  {
    const zrng = new RNG((seed ^ 0x5a17) >>> 0);
    for (const z of planZones(seed, W, H)) stampZone(d, z, zrng);
    for (const r of planRuins(seed, W, H)) stampRuin(d, r);
    stampCore(d);
  }

  // 4. HP
  for (let i = 0; i < n; i++) tileHP[i] = maxHPFor(tileType[i], oreType[i]);

  return { W, H, seed, planet: planetId, tileType, tileHP, oreType, flags, band, fluid, gas };
}
