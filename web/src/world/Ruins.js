/**
 * @module world/Ruins
 * One alien ruin per depth layer, each holding a relic (blueprint). Own RNG stream so zone layout is untouched.
 * Pure and deterministic like Zones.
 */
import { WORLD, TILE, FLAG, ZONES, SET_PIECES, PLANETS, GAS, HAZARD, RELICS } from '../config.js';
import { RNG } from '../core/RNG.js';
import { planZones, blockedAreas, overlaps, gridSet, protectRect } from './Zones.js';

const under = (H) => H - 1 - WORLD.SURFACE_ROWS;

/** @returns {{layer:number, x:number, y:number, w:number, h:number, fill?:string}[]} other worlds: layer = stratum index, fill = what the ruin holds */
export function planRuins(seed, W, H, planet = PLANETS.earth) {
  const rng = new RNG((seed ^ 0x7a11) >>> 0);
  const SR = WORLD.SURFACE_ROWS; const U = under(H);
  const [w, h] = ZONES.RUIN.SIZE;
  const blocked = blockedAreas(W, H, planet);
  const zones = planZones(seed, W, H, planet);
  const ruins = [];
  if (planet.id !== 'earth') { // one ruin: inside the piece that hosts it, else free in its stratum
    const host = zones.find((z) => SET_PIECES[z.kind].hostsRuin);
    const base = { layer: planet.ruinStratum, fill: planet.ruinFill, w, h };
    if (host) {
      const y = host.y + host.h - 1 - h + (host.kind === 'data_vault' ? 1 : 0);
      if (host.kind === 'data_vault') return [{ ...base, x: host.x, y }];
      let x = host.x + 1 + rng.int(0, host.w - 2 - w);
      for (let n = 0; n < 50 && overlaps({ x, y, w, h }, blocked[0], 3); n++) x = host.x + 1 + rng.int(0, host.w - 2 - w); // keep the hull off the shaft column when the hall allows
      return [{ ...base, x, y }];
    }
    const st = planet.strata[planet.ruinStratum];
    for (let attempt = 0; attempt < 400; attempt++) {
      const r = { ...base, x: rng.int(5, W - w - 5), y: rng.int(SR + Math.ceil(U * st.from) + 6, SR + Math.floor(U * st.to) - h - 6) };
      if (!blocked.some((b) => overlaps(r, b, 3)) && !zones.some((o) => overlaps(r, o, 3))) return [r];
    }
    return [];
  }
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
  const fill = r.fill ?? ['sand', 'water', 'gas', 'air', 'magma'][r.layer]; // Earth: by layer
  const fillAt = (x, y) => {
    switch (fill) {
      case 'sand': return set(x, y, TILE.SAND);
      case 'water': return set(x, y, TILE.WATER, 0, HAZARD.FLUID.MAX);
      case 'gas': return set(x, y, TILE.AIR, 0, 0, GAS.MAX);
      case 'magma': return y >= r.y + 2 ? set(x, y, TILE.MAGMA, 0, HAZARD.FLUID.MAX) : set(x, y, TILE.AIR);
      default: return set(x, y, TILE.AIR);
    }
  };
  for (let y = r.y + 1; y < bottom; y++) for (let x = r.x + 1; x < right; x++) fillAt(x, y);
  set(r.x + (r.w >> 1), bottom - 1, TILE.RELIC);
  // breach rock is the layer's own stratum rock, so the layer's pickaxe tier opens it even where bands drift
  const strata = PLANETS[d.planet].strata;
  const own = strata[Math.min(r.layer, strata.length - 1)].tile;
  const sealed = r.fill === undefined && r.layer === 3; // Earth's layer 3 ruin has no breach: it needs a bomb
  if (!sealed) { set(r.x, bottom - 1, own); set(r.x, bottom - 2, own); } // the breach: two host-rock tiles in the left wall
  if (fill === 'gas' || fill === 'magma') { // a safe two-tile tunnel to stand in before breaking in
    for (let k = 1; k <= 2; k++) { set(r.x - k, bottom - 1, TILE.AIR); rock(r.x - k, bottom); }
    protectRect(d, r.x - 2, bottom - 1, 2, 2);
  }
  protectRect(d, r.x, r.y, r.w, r.h);
  // fleck: one hull tile detached by a tile of rock or cave, above (else below) the ruin, hints at it from outside
  outer: for (const y of [r.y - 2, r.y + r.h + 1]) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const i = y * W + x;
      if (!d.protect[i]) { set(x, y, TILE.ALIEN_HULL); break outer; }
    }
  }
}

/** Relic id at row `y`: Earth by layer, other worlds hold one relic. */
export function relicIdAt(planetId, y, H) {
  if (planetId !== 'earth') return PLANETS[planetId].relic;
  const SR = WORLD.SURFACE_ROWS; const U = under(H);
  let k = 0;
  ZONES.LAYERS.forEach(([l0], i) => { if (y >= SR + Math.ceil(U * l0)) k = i; });
  return RELICS.find((rl) => rl.layer === k)?.id ?? null;
}

/** Turn the RELIC tiles of owned relics into air (a new map after the player already holds them). */
export function clearOwnedRelics(world, relics) {
  const planetId = world.planet ?? 'earth';
  const { tileType, oreType, tileHP, flags, W, H } = world;
  for (let i = 0; i < tileType.length; i++) {
    if (tileType[i] !== TILE.RELIC || !relics.includes(relicIdAt(planetId, (i / W) | 0, H))) continue;
    tileType[i] = TILE.AIR; oreType[i] = 0; tileHP[i] = 0; flags[i] &= ~FLAG.SOLID;
  }
}

export const hasRuins = (world) => world.tileType.includes(TILE.ALIEN_HULL);

/** Centre of the nearest ruin whose relic is not owned, or null. */
export function nearestRuin(seed, W, H, relics, tx, ty, planetId = 'earth') {
  let best = null; let bd = Infinity;
  for (const r of planRuins(seed, W, H, PLANETS[planetId])) {
    if (relics.includes(relicIdAt(planetId, r.y, H))) continue;
    const x = r.x + (r.w >> 1); const y = r.y + (r.h >> 1);
    const dd = (x - tx) ** 2 + (y - ty) ** 2;
    if (dd < bd) { bd = dd; best = { x, y }; }
  }
  return best;
}
