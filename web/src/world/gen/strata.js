/** @module world/gen/strata Depth strata of a planet: noise-perturbed boundaries per column. */
import { WORLD, TILE, PLANETS } from '../../config.js';
import { createNoise2D, fbm } from '../../core/Noise.js';

/** Start row of each stratum per column. @returns {Int16Array} starts[k * W + x] */
export function computeBandStarts(seed, W = WORLD.W, H = WORLD.H, planet = PLANETS.earth) {
  const noise = createNoise2D((seed ^ 0x51ed270b) | 0);
  const U = H - 1 - WORLD.SURFACE_ROWS;
  const K = planet.strata.length;
  const starts = new Int16Array(K * W);
  for (let k = 0; k < K; k++) {
    const frac = planet.strata[k].from;
    for (let x = 0; x < W; x++) {
      if (k === 0) { starts[x] = WORLD.SURFACE_ROWS; continue; }
      const n = fbm(noise, x * WORLD.BAND_NOISE_FREQ, k * 7.13, 2);
      starts[k * W + x] = WORLD.SURFACE_ROWS + Math.round(frac * U + n * WORLD.BAND_NOISE_AMP * 2);
    }
  }
  return starts;
}

/** Stratum index at (x, y), or -1 above ground. */
export function stratumIndexAt(starts, x, y, W = WORLD.W, planet = PLANETS.earth) {
  if (y < WORLD.SURFACE_ROWS) return -1;
  let k = planet.strata.length - 1;
  while (k > 0 && y < starts[k * W + x]) k--;
  return k;
}

/** Band material id at (x, y). */
export function bandMaterialAt(starts, x, y, W = WORLD.W, planet = PLANETS.earth) {
  const k = stratumIndexAt(starts, x, y, W, planet);
  return k < 0 ? TILE.AIR : planet.strata[k].tile;
}
