/**
 * @module systems/Tech
 * Flat tech table (config TECH). Owned ids live in economy.tech; stats are derived on read.
 */
import { TECH } from '../config.js';

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

/** @param {{tech:string[], canAfford:Function}} economy */
export function canUnlock(economy, id) {
  const t = byId(id);
  if (!t) return { ok: false, reason: 'Unknown tech' };
  if (economy.tech.includes(id)) return { ok: false, reason: 'Already owned' };
  const missing = t.requires.find((r) => !economy.tech.includes(r));
  if (missing) return { ok: false, reason: `Requires ${byId(missing).name}` };
  if (!economy.canAfford(t.cost)) return { ok: false, reason: 'Not enough cash or ore' };
  return { ok: true };
}

/** Pay and own the tech. @returns {{ok:boolean, reason?:string}} */
export function unlockTech(economy, id) {
  const c = canUnlock(economy, id);
  if (!c.ok) return c;
  economy.pay(byId(id).cost);
  economy.tech.push(id);
  return c;
}
