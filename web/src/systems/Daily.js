/**
 * @module systems/Daily
 * Daily challenge: one shared seed per UTC day, played in its own save slot with base equipment.
 */
import { hash2 } from '../core/RNG.js';
import { DAILY } from '../config.js';

/** "YYYY-MM-DD" in UTC. @param {Date} [date] */
export const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);

/** Stable for the whole UTC day. @param {Date} [date] */
export function dailySeed(date = new Date()) {
  const [y, m, d] = dateKey(date).split('-').map(Number);
  return hash2(y * 10000 + m * 100 + d, DAILY.SALT, 1) >>> 0;
}

/** Score = deepest meters + cash/10. */
export const dailyScore = (economy) => Math.floor(economy.collect.maxDepth + economy.credits / 10);
