/**
 * @module core/RNG
 * Seeded deterministic PRNG (mulberry32) plus integer hashing helpers.
 */

/** @param {number} seed @returns {() => number} float in [0,1) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless 2D integer hash. @returns {number} uint32 */
export function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Non-deterministic seed (only used when rolling a new world). */
export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

export class RNG {
  /** @param {number} seed */
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }
  float() { return this.next(); }
  /** @param {number} a @param {number} b */
  range(a, b) { return a + (b - a) * this.next(); }
  /** Inclusive integer range. */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  /** @param {number} p */
  chance(p) { return this.next() < p; }
  /** @template T @param {T[]} arr @returns {T} */
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}
