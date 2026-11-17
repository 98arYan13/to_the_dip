/**
 * @module world/Zones
 * Designed zones planned per depth layer from the seed (so levels read as places, not noise), then stamped into
 * the generated grid. Pure and deterministic; uses its own RNG streams so base worldgen output is unchanged.
 */
import { WORLD, TILE, ORE, FLAG, MATERIALS, ORES, ZONES, SET_PIECES, PLANETS, GAS, HAZARD } from '../config.js';
import { RNG } from '../core/RNG.js';
import { expectedTripIncome } from '../systems/Economy.js';
import { planRuins } from './Ruins.js';

const KINDS = Object.keys(SET_PIECES);
/** Pieces with a gas/magma interior get a safe two-tile tunnel to the left of the wall. */
const WITH_APPROACH = ['gas_cavern', 'lava_lake', 'magma_chamber'];

/** Underground rows (excludes surface and the bedrock floor). */
const under = (H) => H - 1 - WORLD.SURFACE_ROWS;

/** The final chamber at the bottom centre (carved out of core rock). */
export function coreChamber(W, H) {
  const { W: w, H: h } = ZONES.CORE_CHAMBER;
  return { x: Math.floor((W - w) / 2), y: H - 3 - h, w, h };
}

export const overlaps = (a, b, pad) => a.x - pad < b.x + b.w && b.x - pad < a.x + a.w && a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;

/** Areas no designed zone or ruin may touch: the shaft, the camp pad and the core chamber. */
export function blockedAreas(W, H) {
  const bc = WORLD.BASE_CAMP;
  return [
    { x: bc.SHAFT_X - 3, y: 0, w: 7, h: H },
    { x: bc.PAD_X0 - 3, y: 0, w: bc.PAD_X1 - bc.PAD_X0 + 7, h: WORLD.SURFACE_ROWS + bc.PAD_DEPTH + 4 },
    (({ x, y, w, h }) => ({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 }))(coreChamber(W, H)),
  ];
}

/** Tile writer shared by every stamper: sets type/ore/fluid/gas and the SOLID flag together. */
export function gridSet(d) {
  return (x, y, type, ore = 0, fluid = 0, gas = 0) => {
    const i = y * d.W + x;
    d.tileType[i] = type; d.oreType[i] = ore; d.fluid[i] = fluid; d.gas[i] = gas;
    d.flags[i] = (d.flags[i] & ~(FLAG.SOLID | FLAG.FUNGI | FLAG.MOSS)) | (MATERIALS[type].solid ? FLAG.SOLID : 0);
  };
}

/** Mark a rect as set-piece ground that later passes (ore repair) must not touch. */
export function protectRect(d, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) d.protect[y * d.W + x] = 1;
}

/**
 * Per stratum: its landmark (guaranteed), then up to PER_LAYER-1 distinct pieces from its pool. Ruins are planned separately (planRuins).
 * @param {number} seed @param {number} W @param {number} H
 * @returns {{kind:string, x:number, y:number, w:number, h:number}[]}
 */
export function planZones(seed, W, H, planet = PLANETS.earth) {
  const rng = new RNG((seed ^ 0x2d9b) >>> 0);
  const SR = WORLD.SURFACE_ROWS; const U = under(H);
  const blocked = blockedAreas(W, H);
  /** @type {{kind:string, x:number, y:number, w:number, h:number}[]} */
  const zones = [];
  /** Landmarks retry with a shrinking gap to other pieces rather than vanish; optional pieces are simply skipped. */
  const place = (kind, st, gaps) => {
    const [bw, bh] = SET_PIECES[kind].size;
    const nz = WORLD.BAND_NOISE_AMP * 2; // keep clear of the noisy stratum boundaries so the host rock is the stratum's own
    const yMin = SR + Math.ceil(U * st.from) + nz; const yMax = SR + Math.floor(U * st.to) - bh - nz;
    if (yMax < yMin || W - bw - 3 < 3) return;
    for (const gap of gaps) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const z = { kind, x: rng.int(3, W - bw - 3), y: rng.int(yMin, yMax), w: bw, h: bh };
        if (blocked.some((b) => overlaps(z, b, 0)) || zones.some((o) => overlaps(z, o, gap))) continue;
        zones.push(z);
        return;
      }
    }
  };
  planet.strata.forEach((st, k) => {
    const landmark = KINDS.find((kd) => SET_PIECES[kd].landmarkOf === k);
    const pool = KINDS.filter((kd) => SET_PIECES[kd].strata.includes(k) && kd !== landmark);
    const picks = [];
    while (picks.length < ZONES.PER_LAYER - 1 && pool.length) picks.push(...pool.splice(rng.int(0, pool.length - 1), 1));
    if (landmark) place(landmark, st, [ZONES.SPACING, 1, 0]);
    picks.sort((a, b) => SET_PIECES[b].size[0] - SET_PIECES[a].size[0]).forEach((kd) => place(kd, st, [ZONES.SPACING])); // widest first: lava_tube is 26 of 64
  });
  return zones;
}

/** Every piece of the map: set pieces per stratum, then the ruins (kind 'ruin', with its layer). */
export function planSetPieces(seed, W, H, planet = PLANETS.earth) {
  return [...planZones(seed, W, H, planet), ...planRuins(seed, W, H, planet).map((r) => ({ kind: 'ruin', ...r }))];
}

/** Best non-fossil ore hosted by rock `mat`. */
function bestOre(mat) {
  let best = 0;
  for (let o = 1; o < ORES.length; o++) {
    const ore = /** @type {any} */ (ORES[o]);
    if (o !== ORE.FOSSIL && ore.hosts.includes(mat) && (!best || ore.price > /** @type {any} */ (ORES[best]).price)) best = o;
  }
  return best;
}

/**
 * Spread `ore` over `cells` (earlier cells first when topping up): each cell takes it with `chance`, then the count is
 * clamped so the piece is worth 0.55-0.95 trips of the era that reaches it (tier capped at 4: a mantle piece cannot hold more than a trip of diamonds).
 */
function seedOre(d, cells, ore, chance, mat, rng, z) {
  if (!ore) return; // host rock with no ore of its own
  for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) d.oreType[y * d.W + x] = 0; // vein ore must not add to the reward
  const T = expectedTripIncome(Math.min(MATERIALS[mat].tier, 4)); const price = /** @type {any} */ (ORES[ore]).price; // tier cap accepted: a tier-5 trip cannot fit in a mantle piece
  const hit = cells.filter(() => rng.chance(chance)); const order = [...hit, ...cells.filter((c) => !hit.includes(c))];
  const n = Math.min(cells.length, Math.floor(T / price), Math.max(Math.ceil(0.5 * T / price), hit.length));
  for (const [x, y] of order.slice(0, n)) d.oreType[y * d.W + x] = ore;
}

/** Sell value of the ore inside the piece's rectangle. */
export function rewardValue(d, z) {
  let v = 0;
  for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) v += /** @type {any} */ (ORES[d.oreType[y * d.W + x]])?.price || 0;
  return v;
}

/**
 * Write the set piece into the grid arrays, mark it in `d.protect`, and add its signpost tiles.
 * @param {{W:number,H:number,tileType:Uint8Array,oreType:Uint8Array,flags:Uint8Array,fluid:Uint8Array,gas:Uint8Array,band:Uint8Array,protect:Uint8Array}} d
 * @param {{kind:string,x:number,y:number,w:number,h:number}} z @param {RNG} rng
 */
export function stampSetPiece(d, z, rng) {
  const W = d.W;
  const idx = (x, y) => y * W + x;
  const set = gridSet(d);
  const host = (x, y) => d.band[idx(x, y)] || TILE.SOIL;
  const rock = (x, y, ore = 0) => set(x, y, host(x, y), ore);
  const onRing = (x, y) => x === z.x || y === z.y || x === z.x + z.w - 1 || y === z.y + z.h - 1;
  const ring = () => { for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) if (onRing(x, y)) rock(x, y); };
  const inner = (fn) => { for (let y = z.y + 1; y < z.y + z.h - 1; y++) for (let x = z.x + 1; x < z.x + z.w - 1; x++) fn(x, y); };
  const cellsWhere = (fn) => { const c = []; for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) if (fn(x, y)) c.push([x, y]); return c; };
  const mat = host(z.x + (z.w >> 1), z.y + (z.h >> 1));
  const rich = bestOre(mat);
  const ay = z.y + z.h - 2;
  const MAX = HAZARD.FLUID.MAX;

  switch (z.kind) {
    case 'sand_pocket':
      for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) {
        const dx = (x - (z.x + (z.w - 1) / 2)) / (z.w / 2); const dy = (y - (z.y + (z.h - 1) / 2)) / (z.h / 2);
        if (dx * dx + dy * dy <= 1) set(x, y, TILE.SAND);
      }
      break;
    case 'vault':
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      for (let x = z.x + 1; x < z.x + z.w - 1; x++) rock(x, ay);
      seedOre(d, [...cellsWhere((x, y) => y === ay), ...cellsWhere(onRing)], rich, 0.7, mat, rng, z);
      break;
    case 'fossil_chamber':
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      for (let n = 0; n < 6; n++) {
        const x = rng.int(z.x - 1, z.x + z.w); const y = rng.int(z.y - 1, z.y + z.h);
        const i = idx(x, y);
        if ((x < z.x || y < z.y || x >= z.x + z.w || y >= z.y + z.h || onRing(x, y)) && d.tileType[i] === host(x, y)) d.oreType[i] = ORE.FOSSIL;
      }
      break;
    case 'gas_cavern':
      ring(); inner((x, y) => set(x, y, TILE.AIR, 0, 0, GAS.MAX));
      break;
    case 'lava_lake':
      ring(); inner((x, y) => (y >= z.y + 2 ? set(x, y, TILE.MAGMA, 0, MAX) : set(x, y, TILE.AIR)));
      break;
    case 'aquifer':
      ring(); inner((x, y) => set(x, y, TILE.WATER, 0, MAX));
      break;
    case 'crystal_geode':
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      seedOre(d, cellsWhere(onRing), rich, 0.6, mat, rng, z);
      break;
    case 'karst_shaft': // 3-wide void, the bottom two rows flooded, ore in the side walls
      ring(); inner((x, y) => (y >= z.y + z.h - 3 ? set(x, y, TILE.WATER, 0, MAX) : set(x, y, TILE.AIR)));
      seedOre(d, cellsWhere((x, y) => (x === z.x || x === z.x + z.w - 1) && y > z.y && y < z.y + z.h - 1), rich, 0.5, mat, rng, z);
      break;
    case 'lava_tube': // 3-high tunnel; the cracked roof is the warning, ore on the floor
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      for (let x = z.x + 1; x < z.x + z.w - 1; x++) { d.flags[idx(x, z.y)] |= FLAG.UNSTABLE; if (rng.chance(0.3)) d.oreType[idx(x, z.y + z.h - 1)] = rich; }
      break;
    case 'magma_chamber': // magma left, right and below an air pocket; the ore is in the roof
      ring(); inner((x, y) => (x === z.x + 1 || x === z.x + z.w - 2 || y === ay ? set(x, y, TILE.MAGMA, 0, MAX) : set(x, y, TILE.AIR)));
      seedOre(d, [...cellsWhere((x, y) => y === z.y), ...cellsWhere((x, y) => onRing(x, y) && y !== z.y)], rich, 0.7, mat, rng, z);
      break;
    default: break;
  }
  if (WITH_APPROACH.includes(z.kind)) { // a short gas-free tunnel with a floor, left of the wall: somewhere safe to stand before breaking in
    for (let k = 1; k <= 2; k++) { set(z.x - k, ay, TILE.AIR); rock(z.x - k, ay + 1); }
    protectRect(d, z.x - 2, ay, 2, 2);
  }
  protectRect(d, z.x, z.y, z.w, z.h);
  signpost(d, z, rich, rng);
}

/** 2-3 host-rock tiles two tiles outside the wall that hint at the piece: moss, a glinting ore, or magma sealed in rock. */
function signpost(d, z, rich, rng) {
  const sign = SET_PIECES[z.kind].sign;
  if (sign === 'none') return;
  const solid = (x, y) => (d.flags[y * d.W + x] & FLAG.SOLID) !== 0;
  const cand = [];
  for (let y = z.y - 2; y <= z.y + z.h + 1; y++) for (let x = z.x - 2; x <= z.x + z.w + 1; x++) {
    if (x > z.x - 2 && x < z.x + z.w + 1 && y > z.y - 2 && y < z.y + z.h + 1) continue; // only the ring at distance 2
    if (x < 1 || x > d.W - 2 || y <= WORLD.SURFACE_ROWS || y > d.H - 2) continue;
    const i = y * d.W + x;
    if (d.protect[i] || d.tileType[i] !== d.band[i] || (sign === 'glow' && !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)))) continue;
    cand.push([x, y]);
  }
  for (let n = sign === 'moss' ? 3 : 2; n > 0 && cand.length; n--) {
    const [x, y] = cand.splice(rng.int(0, cand.length - 1), 1)[0];
    if (sign === 'moss') d.flags[y * d.W + x] |= FLAG.MOSS;
    else if (sign === 'glint') { if (rich) d.oreType[y * d.W + x] = rich; }
    else gridSet(d)(x, y, TILE.MAGMA, 0, HAZARD.FLUID.MAX);
  }
}

/** Carve the Core chamber (air, surrounded by core rock). */
export function stampCore(d) {
  const c = coreChamber(d.W, d.H);
  for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
    const i = y * d.W + x;
    d.tileType[i] = TILE.AIR; d.oreType[i] = 0; d.fluid[i] = 0; d.gas[i] = 0; d.flags[i] &= ~(FLAG.SOLID | FLAG.FUNGI | FLAG.MOSS);
  }
  protectRect(d, c.x, c.y, c.w, c.h);
}
