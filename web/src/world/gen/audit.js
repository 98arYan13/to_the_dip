/** @module world/gen/audit Ore audit and repair: every needed ore within [floor, ceiling]. */
import { AUDIT, ORES, PLANETS, WORLD, TILE, MATERIALS } from '../../config.js';
import { requiredTier } from '../../systems/Mining.js';
import { planRuins } from '../Ruins.js';
import { coreChamber, gridSet } from '../Zones.js';
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

const SX = WORLD.BASE_CAMP.SHAFT_X;
const pass = (d, i, maxTier, magma) => {
  const t = d.tileType[i];
  if (t === TILE.ALIEN_HULL || t === TILE.BEDROCK) return false;
  if (t === TILE.MAGMA) return magma;
  return !MATERIALS[t].solid || requiredTier(t, d.oreType[i]) <= maxTier;
};

/** BFS from the tile under the camp shaft top. @returns {Uint8Array} 1 where the player can get with `maxTier` */
export function reachable(d, maxTier, { magma = false } = {}) {
  const seen = new Uint8Array(d.W * d.H);
  const queue = [WORLD.SURFACE_ROWS * d.W + SX];
  seen[queue[0]] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]; const x = i % d.W;
    for (const j of [i - d.W, i + d.W, x > 0 ? i - 1 : -1, x < d.W - 1 ? i + 1 : -1]) {
      if (j < 0 || j >= seen.length || seen[j] || !pass(d, j, maxTier, magma)) continue;
      seen[j] = 1; queue.push(j);
    }
  }
  return seen;
}

/** Spec 7.2 targets: [label, x, y, tier, magma, fallback host tile]. Each stratum's top row is probed at the column nearest the shaft. */
function reachTargets(d, starts) {
  const strata = PLANETS[d.planet].strata;
  const out = [];
  const cols = [...Array(d.W - 2).keys()].map((x) => x + 1).sort((a, b) => Math.abs(a - SX) - Math.abs(b - SX));
  for (let k = 1; k < strata.length; k++) out.push({ label: `stratum ${k} top`, cols: cols.map((x) => [x, starts[k * d.W + x]]), tier: strata[k].tier, magma: false, host: strata[k].tile });
  planRuins(d.seed, d.W, d.H, PLANETS[d.planet]).forEach((r) => {
    const own = strata[Math.min(r.layer, strata.length - 1)];
    const host = d.band[(r.y + r.h - 2) * d.W + r.x] || own.tile; // ruin layers and strata overlap loosely: take the rock actually at the breach
    out.push({ label: `ruin ${r.layer}`, cols: [[r.x, r.y + r.h - 2]], tier: Math.max(own.tier, MATERIALS[host].tier), magma: false, host });
  });
  const c = coreChamber(d.W, d.H);
  out.push({ label: 'core chamber', cols: [[c.x + (c.w >> 1), c.y + (c.h >> 1)]], tier: 6, magma: true, host: TILE.CORE });
  return out;
}

/** Layer 3's ruin is sealed in hull: its outer wall (any hull-adjacent tile) must be reachable instead of the breach. */
function targetOk(d, t, seen) {
  return t.cols.some(([x, y]) => {
    const i = y * d.W + x;
    if (d.tileType[i] !== TILE.ALIEN_HULL) return seen[i];
    return [i - 1, i + 1, i - d.W, i + d.W].some((j) => seen[j]);
  });
}

/** @returns {string[]} reachability problems (empty = fine) */
export function auditReach(d, starts) {
  const cache = new Map();
  return reachTargets(d, starts).filter((t) => {
    const key = `${t.tier}${t.magma}`;
    if (!cache.has(key)) cache.set(key, reachable(d, t.tier, { magma: t.magma }));
    return !targetOk(d, t, cache.get(key));
  }).map((t) => `unreachable: ${t.label}`);
}

/**
 * Carve a one-tile fault of the stratum's own rock from the surface down the column nearest the shaft, then along the target row.
 * Only tiles the tier cannot pass are replaced, by host rock the tier can mine: rock gets softer, air is never created.
 */
export function repairReach(d, starts) {
  const set = gridSet(d);
  const cache = new Map();
  for (const t of reachTargets(d, starts)) {
    const key = `${t.tier}${t.magma}`;
    if (!cache.has(key)) cache.set(key, reachable(d, t.tier, { magma: t.magma }));
    if (targetOk(d, t, cache.get(key))) continue;
    const many = t.cols.length > 1;
    const blockersFor = (xc) => { // fault path: column xc from the surface to the target row, then along that row to the target
      const [tx, ty] = many ? t.cols.find(([x]) => x === xc) : t.cols[0];
      const path = [];
      for (let y = WORLD.SURFACE_ROWS; y <= ty; y++) path.push(y * d.W + xc);
      for (let x = Math.min(xc, tx); x <= Math.max(xc, tx); x++) path.push(ty * d.W + x);
      return path.filter((i) => !pass(d, i, t.tier, t.magma));
    };
    const xc = (many ? t.cols.map(([x]) => x) : [...Array(d.W - 2).keys()].map((x) => x + 1).sort((a, b) => Math.abs(a - SX) - Math.abs(b - SX)))
      .find((x) => !blockersFor(x).some((i) => d.protect[i]));
    if (xc === undefined) continue; // unrepairable here: the audit still fails and generateWorld retries
    for (const i of blockersFor(xc)) {
      const b = d.band[i];
      set(i % d.W, (i / d.W) | 0, b && MATERIALS[b].solid && MATERIALS[b].tier <= t.tier ? b : t.host);
    }
    cache.clear();
  }
}

/** Tiles within 3 columns of the shaft in the first two strata (rows below the surface). */
function shaftZone(d, starts) {
  const out = [];
  for (let x = SX - 3; x <= SX + 3; x++) for (let y = WORLD.SURFACE_ROWS; y < starts[2 * d.W + x]; y++) out.push(y * d.W + x);
  return out;
}
const wet = (d, i) => d.tileType[i] === TILE.WATER || d.tileType[i] === TILE.MAGMA || d.fluid[i] > 0;

/** Gas tiles open to the shaft column: gas in the open-air component that touches column SHAFT_X. */
function shaftGas(d) {
  const seen = new Uint8Array(d.W * d.H); const queue = []; const gas = [];
  for (let y = WORLD.SURFACE_ROWS; y < d.H; y++) { const i = y * d.W + SX; if (!MATERIALS[d.tileType[i]].solid) { seen[i] = 1; queue.push(i); } }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]; const x = i % d.W;
    if (d.gas[i] > 0) gas.push(i);
    for (const j of [i - d.W, i + d.W, x > 0 ? i - 1 : -1, x < d.W - 1 ? i + 1 : -1]) {
      if (j < WORLD.SURFACE_ROWS * d.W || j >= seen.length || seen[j] || MATERIALS[d.tileType[j]].solid) continue;
      seen[j] = 1; queue.push(j);
    }
  }
  return gas;
}

/** Spec 7.3. @returns {string[]} */
export function auditSafety(d, starts) {
  const out = [];
  if (shaftZone(d, starts).some((i) => wet(d, i))) out.push('water or magma near the shaft');
  if (shaftGas(d).length) out.push('gas open to the shaft column');
  return out;
}

/** Drain water/magma near the shaft to air; seal gas open to the shaft with host rock (protected tiles are left alone). */
export function repairSafety(d, starts) {
  const set = gridSet(d);
  for (const i of shaftZone(d, starts)) if (wet(d, i) && !d.protect[i]) set(i % d.W, (i / d.W) | 0, TILE.AIR);
  for (const i of shaftGas(d)) if (!d.protect[i]) set(i % d.W, (i / d.W) | 0, d.band[i] || TILE.SOIL);
}
