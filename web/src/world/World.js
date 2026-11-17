/**
 * @module world/World
 * Tile grid stored in flat typed arrays indexed `y * W + x`.
 */
import { WORLD, TILE, FLAG, MATERIALS } from '../config.js';
import { generateWorld, maxHPFor } from './WorldGen.js';

export class World {
  /** @param {import('./WorldGen.js').WorldData} data */
  constructor(data) {
    this.W = data.W;
    this.H = data.H;
    this.seed = data.seed;
    this.genSeed = data.genSeed ?? data.seed;
    this.planet = data.planet ?? 'earth';
    this.T = WORLD.TILE_PX;
    this.tileType = data.tileType;
    this.tileHP = data.tileHP;
    this.oreType = data.oreType;
    this.flags = data.flags;
    this.band = data.band;
    /** Fluid units per tile (0..HAZARD.FLUID.MAX) and gas concentration per tile (0..GAS.MAX). */
    this.fluid = data.fluid || new Uint8Array(data.W * data.H);
    this.gas = data.gas || new Uint8Array(data.W * data.H);
    /** Tile index of the last raycast hit (-1 if none). */
    this.lastHit = -1;
  }

  /** @param {number} seed */
  static generate(seed, planetId = 'earth') {
    return new World(generateWorld(seed, planetId));
  }

  idx(x, y) { return y * this.W + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }

  /** Out-of-bounds counts as solid except above the sky. */
  isSolid(x, y) {
    if (x < 0 || x >= this.W || y >= this.H) return true;
    if (y < 0) return false;
    return (this.flags[y * this.W + x] & FLAG.SOLID) !== 0;
  }

  isSolidAtPx(px, py) {
    return this.isSolid(Math.floor(px / this.T), Math.floor(py / this.T));
  }

  maxHP(i) { return maxHPFor(this.tileType[i], this.oreType[i]); }

  /** Remove a solid tile (mined/blasted). */
  clear(i) {
    this.tileType[i] = TILE.AIR;
    this.oreType[i] = 0;
    this.tileHP[i] = 0;
    this.fluid[i] = 0;
    this.gas[i] = 0;
    this.flags[i] = (this.flags[i] & ~(FLAG.SOLID | FLAG.FUNGI | FLAG.MOSS)) | FLAG.DIRTY;
  }

  /** Material of tile type id. */
  material(i) { return MATERIALS[this.tileType[i]]; }

  /**
   * Grid DDA raycast in world pixels. Direction must be normalized.
   * @returns {number} distance to first solid tile (or maxDist). Sets this.lastHit.
   */
  raycast(ox, oy, dx, dy, maxDist) {
    const T = this.T;
    let mx = Math.floor(ox / T);
    let my = Math.floor(oy / T);
    this.lastHit = -1;
    if (this.isSolid(mx, my)) { this.lastHit = this.inBounds(mx, my) ? my * this.W + mx : -1; return 0; }
    const stepX = dx < 0 ? -1 : 1;
    const stepY = dy < 0 ? -1 : 1;
    const deltaX = dx === 0 ? Infinity : Math.abs(T / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(T / dy);
    let sideX = dx === 0 ? Infinity : (dx < 0 ? (ox - mx * T) / -dx : ((mx + 1) * T - ox) / dx);
    let sideY = dy === 0 ? Infinity : (dy < 0 ? (oy - my * T) / -dy : ((my + 1) * T - oy) / dy);
    for (let guard = 0; guard < 512; guard++) {
      let d;
      if (sideX < sideY) { d = sideX; sideX += deltaX; mx += stepX; }
      else { d = sideY; sideY += deltaY; my += stepY; }
      if (d >= maxDist) return maxDist;
      if (this.isSolid(mx, my)) {
        this.lastHit = this.inBounds(mx, my) ? my * this.W + mx : -1;
        return d;
      }
    }
    return maxDist;
  }
}
