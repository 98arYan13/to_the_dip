/**
 * @module world/WorldGen
 * Pure, deterministic world generation: depth bands with noise-perturbed boundaries,
 * fBm caves, water pockets, decorative magma channels, fungi/moss, and ore veins via random walks.
 */
import { WORLD, TILE, FLAG, MATERIALS, ORE_HP_MUL, MINING, PLANETS, AUDIT } from '../config.js';
import { RNG, hash2 } from '../core/RNG.js';
import { planSetPieces, stampSetPiece, stampCore } from './Zones.js';
import { stampRuin } from './Ruins.js';
import { createNoise2D, fbm } from '../core/Noise.js';
import { computeBandStarts, bandMaterialAt } from './gen/strata.js';
import { placeVeins } from './gen/ores.js';
import { repairOres, auditOres, auditReach, repairReach, auditSafety, repairSafety } from './gen/audit.js';
import { carveCaves, applyCaveRules, placeFluids } from './gen/caves.js';

/**
 * @typedef {Object} WorldData
 * @property {number} W @property {number} H @property {number} seed
 * @property {Uint8Array} tileType @property {Uint16Array} tileHP
 * @property {Uint8Array} oreType @property {Uint8Array} flags
 * @property {Uint8Array} band band material id per tile (0 above ground)
 */

/** Max HP of a tile with the given type and ore. */
export function maxHPFor(type, ore, hpMul = 1) {
  const m = MATERIALS[type];
  if (!m || !m.solid) return 0;
  if (m.hp >= 65535) return m.hp; // bedrock and alien hull: unbreakable, must not scale past Uint16
  return Math.round(m.hp * MINING.HP_MULT * (ore ? ORE_HP_MUL : 1) * hpMul);
}

/** planet.hpMul x the hpMul of the stratum whose rock is `bandTile`. */
export function hpMulAt(planet, bandTile) {
  return planet.hpMul * (planet.strata.find((s) => s.tile === bandTile)?.hpMul ?? 1);
}

export { computeBandStarts, bandMaterialAt };

/** Number of underground rows (excludes surface air rows and the bedrock floor). */
export function undergroundRows(H = WORLD.H) {
  return H - 1 - WORLD.SURFACE_ROWS;
}

/**
 * Generate a full world from a seed. Pure: same seed -> identical arrays, retries included.
 * Audit failures retry with genSeed = hash2(seed, attempt, 0x9e11), at most AUDIT.MAX_ATTEMPTS times; the attempt with the fewest problems wins.
 * `forceRetry` (test hook) makes that many leading attempts count as failed.
 * @param {number} seed
 * @returns {WorldData & {genSeed:number, problems:string[]}}
 */
export function generateWorld(seed, planetId = 'earth', W = WORLD.W, H = PLANETS[planetId].H, { forceRetry = 0 } = {}) {
  seed >>>= 0;
  let best = null;
  for (let attempt = 0; attempt <= AUDIT.MAX_ATTEMPTS; attempt++) {
    const genSeed = attempt ? hash2(seed, attempt, 0x9e11) : seed;
    const r = buildWorld(genSeed, planetId, W, H);
    if (attempt < forceRetry) r.problems.push('forced retry');
    if (!best || r.problems.length < best.problems.length) best = { ...r, seed, genSeed };
    if (!best.problems.length) break;
  }
  return best;
}

function buildWorld(seed, planetId, W, H) {
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
  const starts = computeBandStarts(seed, W, H, planet);
  const SR = WORLD.SURFACE_ROWS;

  // 1. Bands, then caves per stratum style (budgeted), then water in basalt caves
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = bandMaterialAt(starts, x, y, W, planet);
      band[i] = b;
      if (y < SR) { tileType[i] = TILE.AIR; flags[i] = FLAG.DISCOVERED; continue; }
      tileType[i] = (x === 0 || x === W - 1 || y === H - 1) ? TILE.BEDROCK : b;
      if (y === SR) flags[i] |= FLAG.DISCOVERED;
    }
  }
  const d = { W, H, seed, planet: planetId, tileType, oreType, flags, fluid, gas, band, protect: new Uint8Array(n) };
  carveCaves(d, starts, seed);
  applyCaveRules(d, starts);
  placeFluids(d, starts, seed);

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
  placeVeins(d, rng);

  // 3b. Designed zones (own RNG streams, applied after ores so the base layout is unchanged)
  {
    const zrng = new RNG((seed ^ 0x5a17) >>> 0);
    for (const z of planSetPieces(seed, W, H, planet)) (z.kind === 'ruin' ? stampRuin(d, z) : stampSetPiece(d, z, zrng));
    stampCore(d);
  }

  // 3c. Audit and repair: ores, reachability, safety; whatever still fails is reported for the caller's retry rule
  const orng = new RNG((seed ^ 0xabc) >>> 0);
  const oresOk = () => auditOres(d).every((r) => r.bulk || (r.have >= r.floor && r.haveOpen >= r.floor / AUDIT.FLOOR * AUDIT.FLOOR_OPEN));
  repairOres(d, orng);
  repairReach(d, starts); repairSafety(d, starts);
  repairOres(d, orng); // reach/safety repairs may have cut ore tiles
  const problems = [...auditReach(d, starts), ...auditSafety(d, starts)];
  if (!oresOk()) problems.push('ore floor not met');

  // 4. HP
  for (let i = 0; i < n; i++) tileHP[i] = maxHPFor(tileType[i], oreType[i], hpMulAt(planet, band[i]));

  return { W, H, seed, planet: planetId, tileType, tileHP, oreType, flags, band, fluid, gas, protect: d.protect, problems };
}
