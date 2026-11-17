/** @module world/gen/ores Ore placement. */
import { WORLD, ORE, ORES, WORLD_RARITY, PLANETS } from '../../config.js';

/** Random-walk ore veins per host band. Mutates d.oreType. */
export function placeVeins(d, rng) {
  const { W, H, tileType, oreType } = d;
  const n = W * H;
  const SR = WORLD.SURFACE_ROWS;
  for (const hostBand of PLANETS[d.planet].strata.map((s) => s.tile)) {
    const hostIdx = [];
    for (let i = 0; i < n; i++) if (tileType[i] === hostBand) hostIdx.push(i);
    if (hostIdx.length === 0) continue;
    const hosted = [];
    const wt = (ore) => ore.weight * (ore.price > WORLD_RARITY.RARE_PRICE ? WORLD_RARITY.RARE_WEIGHT_MUL : 1);
    let weightSum = 0;
    for (let o = 1; o < ORES.length; o++) {
      const ore = /** @type {any} */ (ORES[o]);
      if (ore.hosts.includes(hostBand)) { hosted.push(ore); weightSum += wt(ore); }
    }
    const frac = WORLD.BAND_ORE_FRACTION[hostBand] || 0;
    for (const ore of hosted) {
      const target = Math.round(frac * hostIdx.length * wt(ore) / weightSum);
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
}

/** Ore tile count per ore id. */
export function countOres(d) {
  const c = new Int32Array(ORES.length);
  for (const o of d.oreType) c[o]++;
  return c;
}
