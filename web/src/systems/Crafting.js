/**
 * @module systems/Crafting
 * Instant recipes in camp buildings, and building upgrades. Pure rules over the economy;
 * inputs pay from stash then cargo (economy.pay), outputs always land in the stash (ignoring its cap).
 */
import { RECIPES, CAMP_BUILDINGS, TECH } from '../config.js';
import { EV } from '../core/EventBus.js';
import { isUnlocked } from './Tech.js';
import { drawPower, availablePower } from './Power.js';

const techName = (id) => TECH.find((t) => t.id === id)?.name || id;
const bName = (id) => /** @type {any} */ (CAMP_BUILDINGS)[id]?.name || id;

/** @param {string} id */
export const recipeById = (id) => RECIPES.find((r) => r.id === id);

/** Inputs of `times` crafts as a pay() cost. */
function recipeCost(r, times) {
  /** @type {Record<number, number>} */ const ores = {};
  for (const [o, n] of Object.entries(r.in)) ores[+o] = n * times;
  return { ores };
}

/** @returns {{ok:boolean, reason?:string}} */
export function canCraft(ec, recipeId, times = 1) {
  const r = recipeById(recipeId);
  if (!r) return { ok: false, reason: 'Unknown recipe' };
  if ((ec.buildings[r.building] || 0) < r.level) return { ok: false, reason: `Needs ${bName(r.building)} level ${r.level}` };
  if (!isUnlocked(ec, r.tech)) return { ok: false, reason: `Requires ${techName(r.tech)}` };
  const cost = recipeCost(r, times);
  if (!ec.canAfford(cost)) return { ok: false, reason: 'Not enough materials' };
  // Inputs leave the stash first, so a coal input can't also be burned for power.
  /** @type {Record<number, number>} */ const reserved = {};
  for (const [o, n] of Object.entries(cost.ores)) reserved[+o] = Math.min(n, ec.stash[+o]);
  if (availablePower(ec, reserved) < r.power * times) return { ok: false, reason: 'Not enough power' };
  return { ok: true };
}

/** @returns {{ok:boolean, reason?:string}} */
export function craft(ec, recipeId, times = 1) {
  const c = canCraft(ec, recipeId, times);
  if (!c.ok) return c;
  const r = /** @type {any} */ (recipeById(recipeId));
  ec.pay(recipeCost(r, times));
  drawPower(ec, r.power * times);
  for (const [o, n] of Object.entries(r.out)) ec.stash[+o] += n * times;
  ec.bus.emit(EV.CARGO_CHANGED);
  return c;
}

/** @returns {{ok:boolean, reason?:string}} */
export function canUpgradeBuilding(ec, id) {
  const b = /** @type {any} */ (CAMP_BUILDINGS)[id];
  if (!b) return { ok: false, reason: 'Unknown building' };
  const next = b.levels[ec.buildings[id] || 0];
  if (!next) return { ok: false, reason: 'Maxed out' };
  if (!isUnlocked(ec, next.tech)) return { ok: false, reason: `Requires ${techName(next.tech)}` };
  if (next.needs && (ec.buildings[next.needs.building] || 0) < next.needs.level) return { ok: false, reason: `Needs ${bName(next.needs.building)} level ${next.needs.level}` };
  if (!ec.canAfford(next.cost)) return { ok: false, reason: 'Not enough cash or materials' };
  return { ok: true };
}

/** Build the next level (levels are strictly sequential). @returns {{ok:boolean, reason?:string}} */
export function upgradeBuilding(ec, id) {
  const c = canUpgradeBuilding(ec, id);
  if (!c.ok) return c;
  ec.pay(/** @type {any} */ (CAMP_BUILDINGS)[id].levels[ec.buildings[id] || 0].cost);
  ec.buildings[id] = (ec.buildings[id] || 0) + 1;
  return c;
}
