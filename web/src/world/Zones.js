/**
 * @module world/Zones
 * Designed zones planned per depth layer from the seed (so levels read as places, not noise), then stamped into
 * the generated grid. Pure and deterministic; uses its own RNG streams so base worldgen output is unchanged.
 */
import { WORLD, TILE, ORE, FLAG, MATERIALS, ORES, ZONES, GAS, HAZARD } from '../config.js';
import { RNG } from '../core/RNG.js';

const KINDS = Object.keys(ZONES.BANDS);

/** Underground rows (excludes surface and the bedrock floor). */
const under = (H) => H - 1 - WORLD.SURFACE_ROWS;

/** The final chamber at the bottom centre (carved out of core rock). */
export function coreChamber(W, H) {
  const { W: w, H: h } = ZONES.CORE_CHAMBER;
  return { x: Math.floor((W - w) / 2), y: H - 3 - h, w, h };
}

const overlaps = (a, b, pad) => a.x - pad < b.x + b.w && b.x - pad < a.x + a.w && a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;

/**
 * @param {number} seed @param {number} W @param {number} H
 * @returns {{kind:string, x:number, y:number, w:number, h:number}[]}
 */
export function planZones(seed, W, H) {
  const rng = new RNG((seed ^ 0x2d9b) >>> 0);
  const SR = WORLD.SURFACE_ROWS; const U = under(H); const bc = WORLD.BASE_CAMP;
  const blocked = [
    { x: bc.SHAFT_X - 3, y: 0, w: 7, h: H },
    { x: bc.PAD_X0 - 3, y: 0, w: bc.PAD_X1 - bc.PAD_X0 + 7, h: SR + bc.PAD_DEPTH + 4 },
    (({ x, y, w, h }) => ({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 }))(coreChamber(W, H)),
  ];
  /** @type {{kind:string, x:number, y:number, w:number, h:number}[]} */
  const zones = [];
  ZONES.LAYERS.forEach(([l0, l1], k) => {
    const mid = (l0 + l1) / 2;
    const pool = KINDS.filter((kd) => /** @type {any} */ (ZONES.BANDS)[kd][0] <= mid && /** @type {any} */ (ZONES.BANDS)[kd][1] >= mid && kd !== ZONES.LANDMARKS[k]);
    const kinds = [ZONES.LANDMARKS[k]];
    while (kinds.length < ZONES.PER_LAYER && pool.length) kinds.push(pool[rng.int(0, pool.length - 1)]);
    for (const kind of kinds) {
      const [bw, bh] = /** @type {any} */ (ZONES.SIZE)[kind];
      const [b0, b1] = /** @type {any} */ (ZONES.BANDS)[kind];
      const f0 = Math.max(b0, l0); const f1 = Math.min(b1, l1);
      const yMin = SR + Math.ceil(U * f0); const yMax = SR + Math.floor(U * f1) - bh;
      if (yMax < yMin) continue;
      for (let attempt = 0; attempt < 60; attempt++) {
        const z = { kind, x: rng.int(5, W - bw - 5), y: rng.int(yMin, yMax), w: bw, h: bh };
        if (blocked.some((b) => overlaps(z, b, 0)) || zones.some((o) => overlaps(z, o, 3))) continue;
        zones.push(z);
        break;
      }
    }
  });
  return zones;
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
 * Write the zone into the grid arrays.
 * @param {{W:number,H:number,tileType:Uint8Array,oreType:Uint8Array,flags:Uint8Array,fluid:Uint8Array,gas:Uint8Array,band:Uint8Array}} d
 * @param {{kind:string,x:number,y:number,w:number,h:number}} z @param {RNG} rng
 */
export function stampZone(d, z, rng) {
  const W = d.W;
  const idx = (x, y) => y * W + x;
  const set = (x, y, type, ore = 0, fluid = 0, gas = 0) => {
    const i = idx(x, y);
    d.tileType[i] = type; d.oreType[i] = ore; d.fluid[i] = fluid; d.gas[i] = gas;
    d.flags[i] = (d.flags[i] & ~(FLAG.SOLID | FLAG.FUNGI | FLAG.MOSS)) | (MATERIALS[type].solid ? FLAG.SOLID : 0);
  };
  const host = (x, y) => d.band[idx(x, y)] || TILE.SOIL;
  const rock = (x, y, ore = 0) => set(x, y, host(x, y), ore);
  const ring = () => { for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) if (x === z.x || y === z.y || x === z.x + z.w - 1 || y === z.y + z.h - 1) rock(x, y); };
  const inner = (fn) => { for (let y = z.y + 1; y < z.y + z.h - 1; y++) for (let x = z.x + 1; x < z.x + z.w - 1; x++) fn(x, y); };
  const mat = host(z.x + (z.w >> 1), z.y + (z.h >> 1));
  /** A short gas-free tunnel with a floor, left of the wall: somewhere safe to stand before breaking in. */
  const approach = () => {
    const ay = z.y + z.h - 2;
    for (let k = 1; k <= 2; k++) { set(z.x - k, ay, TILE.AIR); rock(z.x - k, ay + 1); }
  };

  switch (z.kind) {
    case 'sand_pocket':
      for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) {
        const dx = (x - (z.x + (z.w - 1) / 2)) / (z.w / 2); const dy = (y - (z.y + (z.h - 1) / 2)) / (z.h / 2);
        if (dx * dx + dy * dy <= 1) set(x, y, TILE.SAND);
      }
      break;
    case 'vault': {
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      const fy = z.y + z.h - 2; const rich = bestOre(mat);
      for (let x = z.x + 1; x < z.x + z.w - 1; x++) rock(x, fy, rng.chance(0.7) ? rich : 0);
      break;
    }
    case 'fossil_chamber': {
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      for (let n = 0; n < 6; n++) {
        const x = rng.int(z.x - 1, z.x + z.w); const y = rng.int(z.y - 1, z.y + z.h);
        const i = idx(x, y);
        if ((x < z.x || y < z.y || x >= z.x + z.w || y >= z.y + z.h || x === z.x || y === z.y || x === z.x + z.w - 1 || y === z.y + z.h - 1) && d.tileType[i] === host(x, y)) d.oreType[i] = ORE.FOSSIL;
      }
      break;
    }
    case 'gas_cavern':
      ring(); inner((x, y) => set(x, y, TILE.AIR, 0, 0, GAS.MAX)); approach();
      break;
    case 'lava_lake': {
      ring();
      inner((x, y) => (y >= z.y + 2 ? set(x, y, TILE.MAGMA, 0, HAZARD.FLUID.MAX) : set(x, y, TILE.AIR)));
      approach();
      break;
    }
    case 'aquifer':
      ring(); inner((x, y) => set(x, y, TILE.WATER, 0, HAZARD.FLUID.MAX));
      break;
    case 'crystal_geode': {
      const gem = bestOre(mat);
      ring(); inner((x, y) => set(x, y, TILE.AIR));
      for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) {
        if ((x === z.x || y === z.y || x === z.x + z.w - 1 || y === z.y + z.h - 1) && rng.chance(0.6)) rock(x, y, gem);
      }
      break;
    }
    default: break;
  }
}

/** Carve the Core chamber (air, surrounded by core rock). */
export function stampCore(d) {
  const c = coreChamber(d.W, d.H);
  for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
    const i = y * d.W + x;
    d.tileType[i] = TILE.AIR; d.oreType[i] = 0; d.fluid[i] = 0; d.gas[i] = 0; d.flags[i] &= ~(FLAG.SOLID | FLAG.FUNGI | FLAG.MOSS);
  }
}
