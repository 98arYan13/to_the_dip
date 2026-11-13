/**
 * @module systems/Camp
 * Upgradeable camp buildings and field charging stations. State lives in the economy (so it survives death).
 */
import { CAMP, WORLD, TILE } from '../config.js';

export { upgradeBuilding } from './Crafting.js';

/** Why a station can't go at tile (x, y), or null if it can. */
export function stationBlocker(economy, world, x, y) {
  if (!economy.tech.includes('charge_station')) return 'Needs the Field Charging Station tech';
  if (economy.stations.length >= CAMP.MAX_STATIONS) return 'Station limit reached';
  if (!world.inBounds(x, y) || y <= WORLD.SURFACE_ROWS + 1 || world.tileType[y * world.W + x] !== TILE.AIR) return 'Needs open air underground';
  if (!world.isSolid(x, y + 1)) return 'Needs solid floor';
  if (economy.stations.some((s) => Math.hypot(s.x - x, s.y - y) < CAMP.STATION_MIN_GAP)) return 'Too close to another station';
  if (!economy.canAfford(CAMP.STATION_COST)) return 'Not enough cash or ore';
  return null;
}

/** @returns {{ok:boolean, reason?:string}} */
export function placeChargeStation(economy, world, x, y) {
  const reason = stationBlocker(economy, world, x, y);
  if (reason) return { ok: false, reason };
  economy.pay(CAMP.STATION_COST);
  economy.stations.push({ x, y });
  return { ok: true };
}

/** Is the player (px) within range of any station? */
export function nearStation(economy, px, py) {
  const T = WORLD.TILE_PX;
  return economy.stations.some((s) => Math.hypot((s.x + 0.5) * T - px, (s.y + 0.5) * T - py) < CAMP.STATION_RANGE * T);
}

/** Why a field camp can't go with its bottom-left at tile (x, y), or null if it can. */
export function fieldCampBlocker(economy, world, x, y) {
  const F = CAMP.FIELD_CAMP;
  if (!(economy.consumables.campKit > 0)) return 'No camp kit';
  if (economy.fieldCamps.length >= F.MAX) return 'Camp limit reached';
  for (let dy = 0; dy < F.H; dy++) for (let dx = 0; dx < F.W; dx++) {
    const tx = x + dx; const ty = y - dy;
    if (!world.inBounds(tx, ty) || ty <= WORLD.SURFACE_ROWS + 1 || world.tileType[ty * world.W + tx] !== TILE.AIR) return 'Needs a 4×4 open space';
  }
  for (let dx = 0; dx < F.W; dx++) if (!world.isSolid(x + dx, y + 1)) return 'Needs solid floor';
  if (economy.fieldCamps.some((c) => Math.hypot(c.x - x, c.y - y) < CAMP.STATION_MIN_GAP)) return 'Too close to another camp';
  return null;
}

/** Spend a kit and pitch the camp. @returns {{ok:boolean, reason?:string}} */
export function placeFieldCamp(economy, world, x, y) {
  const reason = fieldCampBlocker(economy, world, x, y);
  if (reason) return { ok: false, reason };
  economy.useConsumable('campKit');
  economy.fieldCamps.push({ x, y });
  return { ok: true };
}

/** Is the player (px, py world px) within resting range of a field camp's centre? */
export function nearFieldCamp(economy, px, py) {
  const T = WORLD.TILE_PX; const F = CAMP.FIELD_CAMP;
  return economy.fieldCamps.some((c) => Math.hypot((c.x + F.W / 2) * T - px, (c.y + 1 - F.H / 2) * T - py) < F.RANGE * T);
}
