/**
 * @module systems/Contracts
 * Daily deterministic "bring N of ore X" offers from the camp terminal. Active/done lists live in the economy.
 */
import { ORES, CONTRACTS, isOre } from '../config.js';
import { RNG, hash2 } from '../core/RNG.js';
import { EV } from '../core/EventBus.js';

/** UTC day number. */
export const dayNumber = (date = new Date()) => Math.floor(date.getTime() / 86400000);

/**
 * Same (seed, day, tier) → same offers. Ores are never above the player's pickaxe tier.
 * @returns {{id:string, ore:number, qty:number, rewardCash:number}[]}
 */
export function rollContracts(seed, day, pickTier) {
  const rng = new RNG(hash2(seed >>> 0, day, 0xc0de) >>> 0);
  const pool = [];
  for (let o = 1; o < ORES.length; o++) if (isOre(o) && /** @type {any} */ (ORES[o]).tier <= pickTier) pool.push(o);
  const out = [];
  for (let n = 0; n < CONTRACTS.OFFERS; n++) {
    const ore = pool[rng.int(0, pool.length - 1)];
    const info = /** @type {any} */ (ORES[ore]);
    const qty = rng.int(2, Math.max(3, 12 - 2 * info.tier));
    const rewardCash = Math.ceil(qty * info.price * (1 + CONTRACTS.PREMIUM + rng.float() * 0.15));
    out.push({ id: `${day}:${n}`, ore, qty, rewardCash });
  }
  return out;
}

export function acceptContract(economy, c) {
  const k = economy.contracts;
  if (k.active.length >= CONTRACTS.MAX_ACTIVE) return { ok: false, reason: 'Too many active contracts' };
  if (k.active.some((a) => a.id === c.id) || k.done.includes(c.id)) return { ok: false, reason: 'Already taken' };
  k.active.push({ ...c });
  return { ok: true };
}

/** Hand in ore (stash first, then cargo) for the reward. Changes nothing on failure. */
export function turnIn(economy, id) {
  const k = economy.contracts;
  const c = k.active.find((a) => a.id === id);
  if (!c) return { ok: false, reason: 'No such active contract' };
  if (!economy.pay({ ores: { [c.ore]: c.qty } })) return { ok: false, reason: 'Not enough ore' };
  k.active = k.active.filter((a) => a.id !== id);
  k.done = [...k.done.slice(-49), id];
  economy.credits = Math.round((economy.credits + c.rewardCash) * 100) / 100;
  economy.bus.emit(EV.CREDITS_CHANGED, economy.credits);
  return { ok: true };
}
