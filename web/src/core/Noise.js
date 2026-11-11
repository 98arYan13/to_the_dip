/**
 * @module core/Noise
 * In-house seeded 2D value noise with smoothstep interpolation, and fBm.
 */
import { hash2 } from './RNG.js';

const INV_U32 = 1 / 4294967296;

/**
 * @param {number} seed
 * @returns {(x:number, y:number) => number} noise in [-1, 1]
 */
export function createNoise2D(seed) {
  const s = seed | 0;
  return function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s) * INV_U32;
    const b = hash2(xi + 1, yi, s) * INV_U32;
    const c = hash2(xi, yi + 1, s) * INV_U32;
    const d = hash2(xi + 1, yi + 1, s) * INV_U32;
    const top = a + (b - a) * u;
    const bot = c + (d - c) * u;
    return (top + (bot - top) * v) * 2 - 1;
  };
}

/**
 * Fractal Brownian motion, normalized to roughly [-1, 1].
 * @param {(x:number,y:number)=>number} noise
 * @param {number} x @param {number} y
 * @param {number} [octaves=4] @param {number} [lacunarity=2] @param {number} [gain=0.5]
 */
export function fbm(noise, x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * f + o * 17.31, y * f - o * 9.73) * amp;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}
