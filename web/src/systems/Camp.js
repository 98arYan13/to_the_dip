/**
 * @module systems/Camp
 * Upgradeable camp buildings and field charging stations. State lives in the economy (so it survives death).
 */
import { CAMP, CAMP_BUILDINGS, WORLD, TILE } from '../config.js';

/** Buy the next level of a building (levels are strictly sequential). */
export function upgradeBuilding(economy, id) {
  const b = /** @type {any} */ (CAMP_BUILDINGS)[id];
  if (!b) return { ok: false, reason: 'Unknown building' };
  const lvl = economy.buildings[id] || 0;
  if (lvl >= b.levels.length) return { ok: false, reason: 'Maxed out' };
  if (!economy.pay(b.levels[lvl].cost)) return { ok: false, reason: 'Not enough cash or ore' };
  economy.buildings[id] = lvl + 1;
  return { ok: true };
}

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
