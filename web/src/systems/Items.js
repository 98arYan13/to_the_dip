/**
 * @module systems/Items
 * Placeable items: ladders (climbable; dropped in open air they fall to the first support below).
 */
import { TILE, FLAG, WORLD } from '../config.js';
import { EV } from '../core/EventBus.js';
import { isCampGround } from './Mining.js';

/** Row where a ladder dropped at (x, y) comes to rest (on solid ground, water or another ladder), or -1 if it can't go there. */
export function ladderRestY(w, x, y) {
  if (!w.inBounds(x, y) || w.tileType[y * w.W + x] !== TILE.AIR || isCampGround(x, y)) return -1;
  while (w.inBounds(x, y + 1) && w.tileType[(y + 1) * w.W + x] === TILE.AIR && !isCampGround(x, y + 1)) y++;
  return y;
}

export const canPlaceLadder = (w, x, y) => ladderRestY(w, x, y) >= 0;

/** Ladders fall to the first support below. @returns {boolean} placed */
export function placeLadder(w, bus, x, y) {
  const ry = ladderRestY(w, x, y);
  if (ry < 0) return false;
  const i = ry * w.W + x;
  w.tileType[i] = TILE.LADDER; w.flags[i] |= FLAG.DIRTY;
  bus.emit(EV.TILE_CHANGED, i);
  return true;
}

/** Takes a placed ladder back down. @returns {boolean} removed */
export function pickUpLadder(w, bus, x, y) {
  if (!w.inBounds(x, y) || w.tileType[y * w.W + x] !== TILE.LADDER) return false;
  const i = y * w.W + x;
  w.tileType[i] = TILE.AIR; w.flags[i] |= FLAG.DIRTY;
  bus.emit(EV.TILE_CHANGED, i);
  return true;
}

/** Ladders in flight: dropped in open air, they fall with the player's gravity and become a tile on landing. */
export class FallingLadders {
  /** @param {import('../world/World.js').World} w @param {import('../core/EventBus.js').EventBus} bus */
  constructor(w, bus) { this.w = w; this.bus = bus; /** @type {{x:number, y:number, vy:number}[]} */ this.active = []; }

  /** The tile at (x, y) was cleared: the ladder column hanging right above it loses its support and falls. */
  release(x, y) {
    const w = this.w;
    for (let yy = y - 1; yy >= 0 && w.tileType[yy * w.W + x] === TILE.LADDER; yy--) {
      pickUpLadder(w, this.bus, x, yy);
      if (!this.drop(x, yy)) this.onLost?.();
    }
  }

  /** @returns {boolean} started (false if (x, y) isn't open air) */
  drop(x, y) {
    if (ladderRestY(this.w, x, y) < 0) return false;
    this.active.push({ x, y: y * WORLD.TILE_PX, vy: 0 });
    return true;
  }

  /** @param {number} dt @param {number} gravity px/s² @param {number} maxFall px/s */
  update(dt, gravity, maxFall) {
    const T = WORLD.TILE_PX;
    for (let k = this.active.length - 1; k >= 0; k--) {
      const f = this.active[k];
      f.vy = Math.min(maxFall, f.vy + gravity * dt);
      f.y += f.vy * dt;
      const row = Math.floor(f.y / T);
      if (canPlaceLadder(this.w, f.x, row + 1)) continue; // still open air below
      // shortcut: a ladder still in flight when the game is saved is lost; fine for a <1 s fall
      // simultaneous ladders pile up: land on the first free cell above
      let r = row;
      while (r >= 0 && !placeLadder(this.w, this.bus, f.x, r)) r--;
      if (r < 0) this.onLost?.();
      this.active.splice(k, 1);
    }
  }
}
