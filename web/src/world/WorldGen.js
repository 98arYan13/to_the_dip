/**
 * @module world/WorldGen
 * Pure, deterministic world generation: depth bands with noise-perturbed boundaries,
 * fBm caves, water pockets, decorative magma channels, fungi/moss, and ore veins via random walks.
 */
import { WORLD, TILE, ORE, FLAG, MATERIALS, ORES, ORE_HP_MUL } from '../config.js';
import { RNG } from '../core/RNG.js';
import { createNoise2D, fbm } from '../core/Noise.js';

/** Band material ids, top to bottom. */
export const BAND_MATERIALS = Object.freeze([TILE.SOIL, TILE.LIMESTONE, TILE.GRANITE, TILE.BASALT, TILE.MANTLE]);

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
  if (type === TILE.BEDROCK) return m.hp;
  return Math.round(m.hp * (ore ? ORE_HP_MUL : 1));
}

/** Number of underground rows (excludes surface air rows and the bedrock floor). */
export function undergroundRows(H = WORLD.H) {
  return H - 1 - WORLD.SURFACE_ROWS;
}

/**
 * Start row of each band per column.
 * @param {number} seed
 * @returns {Int16Array} starts[k * W + x]
 */
export function computeBandStarts(seed, W = WORLD.W, H = WORLD.H) {
  const noise = createNoise2D((seed ^ 0x51ed270b) | 0);
  const U = undergroundRows(H);
  const starts = new Int16Array(BAND_MATERIALS.length * W);
  for (let k = 0; k < BAND_MATERIALS.length; k++) {
    const frac = MATERIALS[BAND_MATERIALS[k]].band[0];
    for (let x = 0; x < W; x++) {
      if (k === 0) { starts[x] = WORLD.SURFACE_ROWS; continue; }
      const n = fbm(noise, x * WORLD.BAND_NOISE_FREQ, k * 7.13, 2);
      starts[k * W + x] = WORLD.SURFACE_ROWS + Math.round(frac * U + n * WORLD.BAND_NOISE_AMP * 2);
    }
  }
  return starts;
}

/** Band material id at (x, y). */
export function bandMaterialAt(starts, x, y, W = WORLD.W) {
  if (y < WORLD.SURFACE_ROWS) return TILE.AIR;
  let k = BAND_MATERIALS.length - 1;
  while (k > 0 && y < starts[k * W + x]) k--;
  return BAND_MATERIALS[k];
}

/**
 * Generate a full world from a seed. Pure: same seed → identical arrays.
 * @param {number} seed
 * @returns {WorldData}
 */
export function generateWorld(seed, W = WORLD.W, H = WORLD.H) {
  seed >>>= 0;
  const n = W * H;
  const tileType = new Uint8Array(n);
  const tileHP = new Uint16Array(n);
  const oreType = new Uint8Array(n);
  const flags = new Uint8Array(n);
  const band = new Uint8Array(n);
  const rng = new RNG(seed);
  const caveNoise = createNoise2D((seed + 1013) | 0);
  const waterNoise = createNoise2D((seed + 2027) | 0);
  const magmaNoise = createNoise2D((seed + 3049) | 0);
  const starts = computeBandStarts(seed, W, H);
  const SR = WORLD.SURFACE_ROWS;
  const U = undergroundRows(H);

  // 1. Bands, caves, water, magma
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = bandMaterialAt(starts, x, y, W);
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
  for (const hostBand of BAND_MATERIALS) {
    const hostIdx = [];
    for (let i = 0; i < n; i++) if (tileType[i] === hostBand) hostIdx.push(i);
    if (hostIdx.length === 0) continue;
    const hosted = [];
    let weightSum = 0;
    for (let o = 1; o < ORES.length; o++) {
      const ore = /** @type {any} */ (ORES[o]);
      if (ore.hosts.includes(hostBand)) { hosted.push(ore); weightSum += ore.weight; }
    }
    const frac = WORLD.BAND_ORE_FRACTION[hostBand] || 0;
    for (const ore of hosted) {
      const target = Math.round(frac * hostIdx.length * ore.weight / weightSum);
      let placed = 0;
      let attempts = 0;
      const maxAttempts = Math.max(1, target) * WORLD.ORE_ATTEMPT_MULT;
      const biasExp = 1 / (1 + (ore.id - 1) * WORLD.ORE_DEPTH_BIAS);
      while (placed < target && attempts < maxAttempts) {
        attempts++;
        const u = Math.pow(rng.float(), biasExp);
        let i = hostIdx[Math.min(hostIdx.length - 1, Math.floor(u * hostIdx.length))];
        if (oreType[i] !== ORE.NONE || tileType[i] !== hostBand) continue;
        const len = rng.int(ore.vein[0], ore.vein[1]);
        let cx = i % W;
        let cy = (i / W) | 0;
        for (let s = 0; s < len && placed < target; s++) {
          i = cy * W + cx;
          if (oreType[i] === ORE.NONE && ore.hosts.includes(tileType[i])) { oreType[i] = ore.id; placed++; }
          const dir = rng.int(0, 3);
          if (dir === 0) cx++; else if (dir === 1) cx--; else if (dir === 2) cy++; else cy--;
          if (cx < 1) cx = 1; else if (cx > W - 2) cx = W - 2;
          if (cy < SR + 1) cy = SR + 1; else if (cy > H - 2) cy = H - 2;
        }
      }
    }
  }

  // 4. HP
  for (let i = 0; i < n; i++) tileHP[i] = maxHPFor(tileType[i], oreType[i]);

  return { W, H, seed, tileType, tileHP, oreType, flags, band };
}
