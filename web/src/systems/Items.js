/**
 * @module systems/Items
 * Placeable items: ladders (walkable/climbable, need a wall or another ladder to hang from).
 */
import { TILE, FLAG } from '../config.js';
import { EV } from '../core/EventBus.js';
import { isCampGround } from './Mining.js';

/** @param {import('../world/World.js').World} w */
export function canPlaceLadder(w, x, y) {
  if (!w.inBounds(x, y) || w.tileType[y * w.W + x] !== TILE.AIR || isCampGround(x, y)) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.isSolid(x + dx, y + dy) || (w.inBounds(x + dx, y + dy) && w.tileType[(y + dy) * w.W + x + dx] === TILE.LADDER));
}

/** @returns {boolean} placed */
export function placeLadder(w, bus, x, y) {
  if (!canPlaceLadder(w, x, y)) return false;
  const i = y * w.W + x;
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
