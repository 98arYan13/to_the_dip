/** @module world/gen/ores Ore placement. */
import { WORLD, ORE, ORES, WORLD_RARITY, PLANETS } from '../../config.js';

const wt = (ore) => ore.weight * (ore.price > WORLD_RARITY.RARE_PRICE ? WORLD_RARITY.RARE_WEIGHT_MUL : 1);

/** Ores hosted by `hostBand` with the tile count the balance model gives each, for `hostCount` host tiles. */
export function veinTargets(hostBand, hostCount) {
  const hosted = [];
  let weightSum = 0;
  for (let o = 1; o < ORES.length; o++) {
    const ore = /** @type {any} */ (ORES[o]);
    if (ore.hosts.includes(hostBand)) { hosted.push(ore); weightSum += wt(ore); }
  }
  const frac = WORLD.BAND_ORE_FRACTION[hostBand] || 0;
  return hosted.map((ore) => ({ ore, target: Math.round(frac * hostCount * wt(ore) / weightSum) }));
}

/**
 * Random-walk one vein of `ore` from a random candidate in `idx` (host-rock tile indices), up to `max` tiles.
 * Skips protected tiles. Returns the number of tiles placed.
 */
function walkVein(d, ore, rng, idx, max, biasExp = 1) {
  const { W, H, tileType, oreType, protect } = d;
  const SR = WORLD.SURFACE_ROWS;
  const u = Math.pow(rng.float(), biasExp);
  let i = idx[Math.min(idx.length - 1, Math.floor(u * idx.length))];
  if (oreType[i] !== ORE.NONE || !ore.hosts.includes(tileType[i]) || (protect && protect[i])) return 0;
  const len = rng.int(ore.vein[0], ore.vein[1]);
  let cx = i % W;
  let cy = (i / W) | 0;
  let placed = 0;
  for (let s = 0; s < len && placed < max; s++) {
    i = cy * W + cx;
    if (oreType[i] === ORE.NONE && ore.hosts.includes(tileType[i]) && !(protect && protect[i])) { oreType[i] = ore.id; placed++; }
    const dir = rng.int(0, 3);
    if (dir === 0) cx++; else if (dir === 1) cx--; else if (dir === 2) cy++; else cy--;
    if (cx < 1) cx = 1; else if (cx > W - 2) cx = W - 2;
    if (cy < SR + 1) cy = SR + 1; else if (cy > H - 2) cy = H - 2;
  }
  return placed;
}

/** Random-walk ore veins per host band. Mutates d.oreType. */
export function placeVeins(d, rng) {
  const { W, H, tileType } = d;
  const n = W * H;
  for (const hostBand of PLANETS[d.planet].strata.map((s) => s.tile)) {
    const hostIdx = [];
    for (let i = 0; i < n; i++) if (tileType[i] === hostBand) hostIdx.push(i);
    if (hostIdx.length === 0) continue;
    for (const { ore, target } of veinTargets(hostBand, hostIdx.length)) {
      let placed = 0;
      let attempts = 0;
      const maxAttempts = Math.max(1, target) * WORLD.ORE_ATTEMPT_MULT;
      const biasExp = 1 / (1 + (ore.id - 1) * WORLD.ORE_DEPTH_BIAS);
      while (placed < target && attempts < maxAttempts) {
        attempts++;
        placed += walkVein(d, ore, rng, hostIdx, target - placed, biasExp);
      }
    }
  }
}

/**
 * Add one vein of `ore` inside `region` = { host, y0, y1 } (host tile type, row range). Returns tiles placed (0 if the start tile was unusable).
 */
export function addVein(d, ore, rng, region) {
  const { W, tileType } = d;
  const idx = [];
  for (let y = region.y0; y <= region.y1; y++) for (let x = 1; x < W - 1; x++) if (tileType[y * W + x] === region.host) idx.push(y * W + x);
  return idx.length ? walkVein(d, ore, rng, idx, Infinity) : 0;
}

/** Turn ore tile `i` back into plain host rock. */
export function removeOre(d, i) {
  d.oreType[i] = ORE.NONE;
}

/** Ore tile count per ore id. */
export function countOres(d) {
  const c = new Int32Array(ORES.length);
  for (const o of d.oreType) c[o]++;
  return c;
}
