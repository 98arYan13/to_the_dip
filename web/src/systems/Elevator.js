/**
 * @module systems/Elevator
 * Cargo elevator: permanent stops underground, linked to the camp (stop 0). Riding costs camp power.
 */
import { ELEVATOR, WORLD, TILE } from '../config.js';
import { has } from './Travel.js';
import { drawPower, availablePower } from './Power.js';

const camp = () => ({ x: WORLD.BASE_CAMP.SHAFT_X, y: WORLD.SURFACE_ROWS - 1, label: 'Camp' });

/** @returns {{ok:boolean, reason?:string}} */
export function canPlaceStop(economy, world, tx, ty) {
  if (!has(economy, 'elevator')) return { ok: false, reason: 'Needs the Space Elevator tech' };
  if (economy.elevatorStops.length >= ELEVATOR.MAX[economy.planet ?? 'earth']) return { ok: false, reason: 'Elevator stop limit reached' };
  const air = (y) => world.inBounds(tx, y) && world.tileType[y * world.W + tx] === TILE.AIR;
  if (!air(ty) || !air(ty - 1) || !world.isSolid(tx, ty + 1)) return { ok: false, reason: 'Needs solid floor and 2 tiles of headroom' };
  if (ty - camp().y < ELEVATOR.MIN_GAP || economy.elevatorStops.some((s) => Math.abs(s.y - ty) < ELEVATOR.MIN_GAP)) return { ok: false, reason: 'Too close to another stop' };
  if (!economy.canAfford(ELEVATOR.STOP_COST)) return { ok: false, reason: 'Not enough steel or carbon fiber' };
  return { ok: true };
}

/** @returns {{ok:boolean, reason?:string}} */
export function placeStop(economy, world, tx, ty) {
  const r = canPlaceStop(economy, world, tx, ty);
  if (!r.ok) return r;
  economy.pay(ELEVATOR.STOP_COST);
  economy.elevatorStops.push({ x: tx, y: ty });
  return { ok: true };
}

/** Camp first, then placed stops top to bottom, labelled by depth in metres. */
export function stops(economy) {
  const c = camp();
  return [c, ...[...economy.elevatorStops].sort((a, b) => a.y - b.y).map((s) => ({ ...s, label: `${s.y - c.y} m` }))];
}

/** Pay power and report the trip. The caller moves the player. */
export function ride(economy, from, to) {
  const rows = Math.abs(to.y - from.y);
  const power = Math.ceil(rows / 10) * ELEVATOR.POWER_PER_10_TILES;
  if (availablePower(economy) < power || drawPower(economy, power) < power) return { ok: false, seconds: 0, power: 0, reason: 'Not enough camp power' };
  return { ok: true, seconds: rows / ELEVATOR.SPEED_TILES_S, power };
}
