/** @module world/gen/need Raw-ore need of a planet's eras, from the tech tree and gear recipes. */
import { PLANETS, TECH, CAMP_BUILDINGS, PICKAXES, UPGRADES, MATERIAL_INPUTS } from '../../config.js';

/** Add `n` of item `id` to `out`, expanding materials down to raw ores. */
function add(out, id, n) {
  const inputs = /** @type {any} */ (MATERIAL_INPUTS)[id];
  if (!inputs) { out[id] = (out[id] || 0) + n; return; }
  for (const [o, k] of Object.entries(inputs)) add(out, +o, n * k);
}

/**
 * Raw-ore need of a planet: its eras' items, minus ores the planet does not host (Earth and earlier worlds supply those).
 * A world without eras of its own (Tessera) can name `needFrom` eras and `needOres`: it feeds only those leftovers.
 * @param {string} planetId @returns {Record<number, number>} raw ore id -> amount
 */
export function oreNeed(planetId) {
  const p = /** @type {any} */ (PLANETS[planetId]);
  const out = eraNeed(p.needFrom ?? p.eras);
  for (const o of Object.keys(out)) if ((p.ores && !p.ores[o]) || (p.needOres && !p.needOres.includes(+o))) delete out[o];
  return out;
}

function eraNeed(eras) {
  const eraOf = new Map(TECH.map((t) => [t.id, t.era]));
  const ok = (tech) => !tech || eras.includes(eraOf.get(tech));
  /** @type {Record<number, number>} */
  const out = {};
  const sum = (ores) => { for (const [o, n] of Object.entries(ores || {})) add(out, +o, n); };
  for (const t of TECH) if (eras.includes(t.era)) sum(t.cost.ores);
  for (const b of Object.values(CAMP_BUILDINGS)) for (const l of b.levels) if (ok(/** @type {any} */ (l).tech)) sum(l.cost.ores);
  for (const p of PICKAXES) if (/** @type {any} */ (p).recipe && ok(/** @type {any} */ (p).tech)) sum(/** @type {any} */ (p).recipe);
  for (const u of Object.values(UPGRADES)) for (const l of u.levels) if (/** @type {any} */ (l).recipe && ok(/** @type {any} */ (l).tech)) sum(/** @type {any} */ (l).recipe);
  return out;
}
