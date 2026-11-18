/**
 * @module systems/Tech
 * Era-based tech graph (config TECH). Owned ids live in economy.tech; stats are derived on read.
 */
import { EV } from '../core/EventBus.js';
import { TECH, RECIPES, CAMP_BUILDINGS, PICKAXES, UPGRADES, CONSUMABLES, ERAS, RELICS } from '../config.js';

const byId = (id) => TECH.find((t) => t.id === id);

/** Apply every owned stat effect: (base + Σadd) × Πmul. @param {string[]} owned */
export function techStat(owned, name, base) {
  let add = 0; let mul = 1;
  for (const id of owned) {
    const e = /** @type {any} */ (byId(id))?.effect;
    if (e?.stat !== name) continue;
    add += e.add || 0; mul *= e.mul ?? 1;
  }
  return (base + add) * mul;
}

export const hasTech = (economy, id) => economy.tech.includes(id);

/** True if no tech is required or it is owned. @param {{tech:string[]}} ec @param {string} [techId] */
export const isUnlocked = (ec, techId) => !techId || ec.tech.includes(techId);

/** @param {{tech:string[], canAfford:Function}} economy */
export function canUnlock(economy, id) {
  const t = byId(id);
  if (!t) return { ok: false, reason: 'Unknown tech' };
  if (economy.tech.includes(id)) return { ok: false, reason: 'Already owned' };
  const missing = t.requires.find((r) => !economy.tech.includes(r));
  if (missing) return { ok: false, reason: `Requires ${byId(missing).name}` };
  if (t.relic && !economy.relics?.includes(t.relic)) return { ok: false, reason: `Requires relic: ${RELICS.find((r) => r.id === t.relic).name}` };
  if (!economy.canAfford(t.cost)) return { ok: false, reason: 'Not enough cash or ore' };
  return { ok: true };
}

/** Pay and own the tech. @returns {{ok:boolean, reason?:string}} */
export function unlockTech(economy, id) {
  const c = canUnlock(economy, id);
  if (!c.ok) return c;
  economy.pay(byId(id).cost);
  economy.tech.push(id);
  economy.bus.emit(EV.TECH_UNLOCKED, id);
  return c;
}

/** Everything that names `techId` as its `tech` (reverse lookup). Equipment levels use economy.levels indices. */
export function unlocksOf(techId) {
  /** @type {{kind:string, id:string, level?:number}[]} */ const out = [];
  for (const r of RECIPES) if (r.tech === techId) out.push({ kind: 'recipe', id: r.id });
  for (const [id, b] of Object.entries(CAMP_BUILDINGS)) b.levels.forEach((l, i) => { if (/** @type {any} */ (l).tech === techId) out.push({ kind: 'building', id, level: i + 1 }); });
  const equip = { pickaxe: PICKAXES, ...Object.fromEntries(Object.entries(UPGRADES).map(([k, u]) => [k, u.levels])) };
  for (const [id, levels] of Object.entries(equip)) /** @type {any[]} */ (levels).forEach((l, i) => { if (l.tech === techId) out.push({ kind: 'equipment', id, level: i }); });
  for (const [id, c] of Object.entries(CONSUMABLES)) if (/** @type {any} */ (c).tech === techId) out.push({ kind: 'consumable', id });
  return out;
}

/** Highest era the player has reached: 1 + owned key techs. @param {{tech:string[]}} ec */
export const eraReached = (ec) => Math.min(ERAS.length, 1 + TECH.filter((t) => t.key && ec.tech.includes(t.id)).length);

/** Best pickaxe tier a player can own by an era (balance and data tests). */
export const eraPickTier = (era) => [1, 2, 3, 4, 6, 7, 8, 8][Math.max(1, Math.min(8, era)) - 1];
