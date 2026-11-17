/** @module world/gen/audit Ore audit and repair: every needed ore within [floor, ceiling]. */
import { AUDIT, ORES, PLANETS, WORLD } from '../../config.js';
import { oreNeed } from './need.js';
import { veinTargets, addVein, removeOre } from './ores.js';

/** Tiles the balance model targets for each ore id (summed over host bands, on the current host counts). */
function modelShare(d) {
  const share = new Float64Array(ORES.length);
  for (const s of PLANETS[d.planet].strata) {
    const host = s.tile;
    let hostCount = 0;
    for (let i = 0; i < d.band.length; i++) if (d.band[i] === host) hostCount++;
    for (const { ore, target } of veinTargets(host, hostCount)) share[ore.id] += target;
  }
  return share;
}

/** @returns {{ore:number,have:number,haveOpen:number,floor:number,ceil:number,bulk:boolean}[]} one row per needed ore; bulk = floor above AUDIT.BULK_TILES, exempt from top-up */
export function auditOres(d) {
  const need = oreNeed(d.planet);
  const share = modelShare(d);
  const have = new Int32Array(ORES.length);
  const open = new Int32Array(ORES.length);
  for (let i = 0; i < d.oreType.length; i++) if (d.oreType[i]) { have[d.oreType[i]]++; if (!d.protect[i]) open[d.oreType[i]]++; }
  return Object.entries(need).map(([o, n]) => ({
    ore: +o, have: have[+o], haveOpen: open[+o], floor: AUDIT.FLOOR * n, ceil: Math.max(AUDIT.CEIL * n, share[+o]), bulk: AUDIT.FLOOR * n > AUDIT.BULK_TILES,
  }));
}

const met = (r, need) => r.bulk || (r.have >= AUDIT.FLOOR * need && r.haveOpen >= AUDIT.FLOOR_OPEN * need);

/** Lower half of the ore's deepest host stratum, as a row range of the host's band tiles. */
function topUpRegion(d, ore) {
  const host = Math.max(...ore.hosts.filter((h) => PLANETS[d.planet].strata.some((s) => s.tile === h)));
  let y0 = d.H; let y1 = 0;
  for (let i = 0; i < d.band.length; i++) if (d.band[i] === host) { const y = (i / d.W) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { host, y0: (y0 + y1) >> 1, y1 };
}

/**
 * Top up ores under their floor with new veins and trim ores over their ceiling (farthest from the camp shaft first).
 * @returns {boolean} whether every floor is met afterwards
 */
export function repairOres(d, rng) {
  const need = oreNeed(d.planet);
  const sx = WORLD.BASE_CAMP.SHAFT_X;
  const sy = WORLD.SURFACE_ROWS;
  for (const r of auditOres(d)) {
    const ore = /** @type {any} */ (ORES[r.ore]);
    if (r.have > r.ceil) {
      const idx = [];
      for (let i = 0; i < d.oreType.length; i++) if (d.oreType[i] === r.ore && !d.protect[i]) idx.push(i);
      const dist = (i) => Math.abs((i % d.W) - sx) + Math.abs(((i / d.W) | 0) - sy);
      idx.sort((a, b) => dist(b) - dist(a));
      for (let k = 0; k < r.have - Math.floor(r.ceil) && k < idx.length; k++) removeOre(d, idx[k]);
      continue;
    }
    if (r.bulk) continue;
    const region = topUpRegion(d, ore);
    const cur = { ...r };
    // shortcut: gives up after FAIL_STREAK barren attempts in a row (host stratum nearly full); the caller's retry rule handles it.
    for (let fails = 0; !met(cur, need[r.ore]) && fails < 200;) {
      const n = addVein(d, ore, rng, region);
      cur.have += n; cur.haveOpen += n; // addVein never writes into protect
      fails = n > 0 ? 0 : fails + 1;
    }
  }
  return auditOres(d).every((r) => met(r, need[r.ore]));
}
