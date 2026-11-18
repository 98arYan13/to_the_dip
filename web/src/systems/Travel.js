/**
 * @module systems/Travel
 * Launch pad travel: which worlds are reachable, what they cost, and the carry state for the new map.
 */
import { TRAVEL, PLANETS, TECH, ITEM } from '../config.js';

/** True if an owned tech has effect {unlock: name}. */
export const has = (ec, name) => ec.tech.some((id) => TECH.find((t) => t.id === id)?.effect?.unlock === name);
const asCost = (c) => ({ ores: c });
const SHORT = { [ITEM.PROPELLANT]: 'Propellant', [ITEM.WARP_CHARGE]: 'Warp Charges' };

/** @param {any} ec @param {string} dest */
export function canTravel(ec, dest) {
  if (!has(ec, 'launch_pad')) return { ok: false, reason: 'Launch pad not built' };
  const cost = TRAVEL.COST[dest];
  if (!cost || (dest !== 'earth' && !has(ec, TRAVEL.FLAG[dest]))) return { ok: false, reason: 'Unknown destination' };
  if (dest === ec.planet) return { ok: false, reason: 'Already here' };
  if (!ec.canAfford(asCost(cost))) return { ok: false, reason: `Not enough ${SHORT[+Object.keys(cost)[0]]}` };
  return { ok: true };
}

/** @param {any} ec */
export function destinations(ec) {
  return Object.keys(TRAVEL.COST).map((id) => {
    const cost = TRAVEL.COST[id];
    return { id, name: PLANETS[id].name, known: id === 'earth' || has(ec, TRAVEL.FLAG[id]), cost, affordable: ec.canAfford(asCost(cost)), current: id === ec.planet };
  });
}

/** Pays the cost and returns the carry state of the new map. Caller must have checked canTravel. @param {any} ec @param {string} dest */
export function travelState(ec, dest) {
  ec.pay(asCost(TRAVEL.COST[dest]));
  const s = ec.newMapState();
  s.cargo = Array.from(ec.cargo); // the whole cargo travels (after paying)
  return { ...s, planet: dest, elevatorStops: [] };
}

let launched = false;
/** Guarded launch: returns the carry state once, null for a repeat call or a refused trip (a double click must not pay twice). */
export function launch(ec, dest) {
  if (launched || !canTravel(ec, dest).ok) return null;
  launched = true;
  return travelState(ec, dest);
}
export const resetLaunch = () => { launched = false; }; // tests only
