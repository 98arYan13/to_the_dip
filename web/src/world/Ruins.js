/**
 * @module world/Ruins
 * One alien ruin per depth layer, each holding a relic (blueprint). Own RNG stream so zone layout is untouched.
 * Pure and deterministic like Zones.
 */
import { WORLD, TILE, FLAG, ZONES, GAS, HAZARD, RELICS } from '../config.js';
import { RNG } from '../core/RNG.js';
import { planZones, blockedAreas, overlaps, gridSet } from './Zones.js';

const under = (H) => H - 1 - WORLD.SURFACE_ROWS;

/** @returns {{layer:number, x:number, y:number, w:number, h:number}[]} */
export function planRuins(seed, W, H) {
  const rng = new RNG((seed ^ 0x7a11) >>> 0);
  const SR = WORLD.SURFACE_ROWS; const U = under(H);
  const [w, h] = ZONES.RUIN.SIZE;
  const blocked = blockedAreas(W, H);
  const zones = planZones(seed, W, H);
  const ruins = [];
  ZONES.LAYERS.forEach(([l0, l1], layer) => {
    const yMin = SR + Math.ceil(U * l0); const yMax = SR + Math.floor(U * l1) - h;
    for (let attempt = 0; attempt < 200; attempt++) {
      const r = { layer, x: rng.int(5, W - w - 5), y: rng.int(yMin, yMax), w, h };
      if (blocked.some((b) => overlaps(r, b, 3)) || zones.some((o) => overlaps(r, o, 3)) || ruins.some((o) => overlaps(r, o, 3))) continue;
      ruins.push(r);
      break; // shortcut: a layer silently gets no ruin after 200 failed attempts, upgrade if a seed ever hits it (tests cover 50 seeds)
    }
  });
  return ruins;
}

/** Write the ruin into the grid arrays (same `d` shape as stampZone). */
export function stampRuin(d, r) {
  const W = d.W;
  const set = gridSet(d);
  const rock = (x, y) => set(x, y, d.band[y * W + x] || TILE.SOIL);
  const right = r.x + r.w - 1; const bottom = r.y + r.h - 1;
  for (let y = r.y; y <= bottom; y++) for (let x = r.x; x <= right; x++) {
    if (x === r.x || x === right || y === r.y || y === bottom) set(x, y, TILE.ALIEN_HULL);
  }
  const fillAt = (x, y) => {
    switch (r.layer) {
      case 0: return set(x, y, TILE.SAND);
      case 1: return set(x, y, TILE.WATER, 0, HAZARD.FLUID.MAX);
      case 2: return set(x, y, TILE.AIR, 0, 0, GAS.MAX);
      case 4: return y >= r.y + 2 ? set(x, y, TILE.MAGMA, 0, HAZARD.FLUID.MAX) : set(x, y, TILE.AIR);
      default: return set(x, y, TILE.AIR);
    }
  };
  for (let y = r.y + 1; y < bottom; y++) for (let x = r.x + 1; x < right; x++) fillAt(x, y);
  set(r.x + (r.w >> 1), bottom - 1, TILE.RELIC);
  if (r.layer !== 3) { rock(r.x, bottom - 1); rock(r.x, bottom - 2); } // the breach: two host-rock tiles in the left wall
  if (r.layer === 2 || r.layer === 4) { // a safe two-tile tunnel to stand in before breaking in
    for (let k = 1; k <= 2; k++) { set(r.x - k, bottom - 1, TILE.AIR); rock(r.x - k, bottom); }
  }
}

/** Relic id for the layer containing row `y`. */
export function relicIdAt(y, H) {
  const SR = WORLD.SURFACE_ROWS; const U = under(H);
  let k = 0;
  ZONES.LAYERS.forEach(([l0], i) => { if (y >= SR + Math.ceil(U * l0)) k = i; });
  return RELICS.find((rl) => rl.layer === k)?.id ?? null;
}

/** Turn the RELIC tiles of owned relics into air (a new map after the player already holds them). */
export function clearOwnedRelics(world, relics) {
  const { tileType, oreType, tileHP, flags, W, H } = world;
  for (let i = 0; i < tileType.length; i++) {
    if (tileType[i] !== TILE.RELIC || !relics.includes(relicIdAt((i / W) | 0, H))) continue;
    tileType[i] = TILE.AIR; oreType[i] = 0; tileHP[i] = 0; flags[i] &= ~FLAG.SOLID;
  }
}

export const hasRuins = (world) => world.tileType.includes(TILE.ALIEN_HULL);

/** Centre of the nearest ruin whose relic is not owned, or null. */
export function nearestRuin(seed, W, H, relics, tx, ty) {
  let best = null; let bd = Infinity;
  for (const r of planRuins(seed, W, H)) {
    if (relics.includes(relicIdAt(r.y, H))) continue;
    const x = r.x + (r.w >> 1); const y = r.y + (r.h >> 1);
    const dd = (x - tx) ** 2 + (y - ty) ** 2;
    if (dd < bd) { bd = dd; best = { x, y }; }
  }
  return best;
}
