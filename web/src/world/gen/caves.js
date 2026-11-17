/** @module world/gen/caves Cave styles per stratum, carved under an open-space budget (spec 6). */
import { WORLD, TILE, PLANETS } from '../../config.js';
import { RNG } from '../../core/RNG.js';
import { createNoise2D, fbm } from '../../core/Noise.js';
import { stratumIndexAt } from './strata.js';

const isOpen = (t) => t === TILE.AIR || t === TILE.WATER || t === TILE.MAGMA;
const eachTile = (d, starts, k, fn) => {
  const { W, H } = d;
  const planet = PLANETS[d.planet];
  for (let y = WORLD.SURFACE_ROWS; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) if (stratumIndexAt(starts, x, y, W, planet) === k) fn(y * W + x, x, y);
  }
};

/** Fraction of stratum k's tiles (bedrock border excluded) that are air or fluid. */
export function openFraction(d, starts, k) {
  let n = 0, open = 0;
  eachTile(d, starts, k, (i) => { n++; if (isOpen(d.tileType[i])) open++; });
  return n ? open / n : 0;
}

const STYLES = {
  karst: (c, noise, x, y) => fbm(noise, x * c.fx, y * c.fy, 4),
  fissure: (c, noise, x, y) => {
    const a = (c.angleDeg * Math.PI) / 180;
    const u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
    return -Math.abs(fbm(noise, u * c.freq, v * c.freq, 2));
  },
  pocket: (c, noise, x, y) => fbm(noise, x * c.freq, y * c.freq, 3),
};

/** Vertical random-walk shafts (karst). Writes +Infinity into score. */
function carveShafts(d, starts, c, k, rng, score, ok) {
  const { W } = d;
  const count = Math.max(1, Math.round((c.shaftsPer64 * W) / 64));
  const cells = [];
  eachTile(d, starts, k, (i, x, y) => cells.push([x, y]));
  if (!cells.length) return;
  for (let s = 0; s < count; s++) {
    let [x, y] = rng.pick(cells);
    const len = rng.int(c.shaftLen[0], c.shaftLen[1]);
    for (let t = 0; t < len; t++, y++) {
      if (rng.chance(0.25)) x += rng.chance(0.5) ? 1 : -1;
      const i = y * W + x;
      if (x > 0 && x < W - 1 && y < d.H - 1 && ok(i, x, y)) score[i] = Infinity;
    }
  }
}

/** Horizontal worms; score = -(worm index + progress) so lowering the threshold adds worm length. */
function carveTubes(d, starts, c, k, rng, score, ok) {
  const { W } = d;
  const planet = PLANETS[d.planet];
  const sx = WORLD.BASE_CAMP.SHAFT_X;
  const cells = [];
  eachTile(d, starts, k, (i, x, y) => { if (Math.abs(x - sx) > 3 && x > 4 && x < W - 5) cells.push([x, y]); });
  if (!cells.length) return;
  for (let w = 0; w < c.count[1] * 6; w++) {
    let [x, y] = rng.pick(cells);
    let yf = y;
    const len = rng.int(c.len[0], c.len[1]);
    let dir = rng.chance(0.5) ? 1 : -1;
    for (let t = 0; t < len; t++) {
      x += dir; yf += (rng.next() - 0.5) * 2 * c.slope;
      y = Math.round(yf);
      if (x < 1 || x > W - 2 || Math.abs(x - sx) <= 3 || stratumIndexAt(starts, x, y, W, planet) !== k) break;
      for (let dy = -c.radius; dy <= c.radius; dy++) {
        for (let dx = -c.radius; dx <= c.radius; dx++) {
          if (dx * dx + dy * dy > c.radius * c.radius) continue;
          const px = x + dx, py = y + dy, i = py * W + px;
          if (px > 0 && px < W - 1 && py < d.H - 1 && ok(i, px, py) && stratumIndexAt(starts, px, py, W, planet) === k) {
            score[i] = Math.max(score[i], -(w + t / len));
          }
        }
      }
    }
  }
}

/** Grid of horizontal runs and vertical links; score = -(segment roll) so `keep` is the threshold. */
function carveCorridors(d, starts, c, k, rng, score, ok) {
  const { W } = d;
  const planet = PLANETS[d.planet];
  const mark = (x0, y0, x1, y1) => {
    const roll = -rng.next();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (x > 0 && x < W - 1 && y < d.H - 1 && ok(i, x, y) && stratumIndexAt(starts, x, y, W, planet) === k) score[i] = Math.max(score[i], roll);
    }
  };
  const ys = [];
  for (let y = WORLD.SURFACE_ROWS + WORLD.CAVE_MIN_DEPTH; y < d.H - 1; y += rng.int(c.rowGap[0], c.rowGap[1])) ys.push(y);
  const xs = [];
  for (let x = 2; x < W - 1; x += rng.int(c.colGap[0], c.colGap[1])) xs.push(x);
  for (const y of ys) for (let x = 1; x < W - 1; x += 6) mark(x, y, Math.min(W - 2, x + 5), y);
  for (const x of xs) for (let j = 0; j + 1 < ys.length; j++) mark(x, ys[j], x, ys[j + 1]);
}

/** Carve every stratum by its style, then bisect each style's free parameter into its open-space budget. */
export function carveCaves(d, starts, seed) {
  const { W, H } = d;
  const planet = PLANETS[d.planet];
  const sx = WORLD.BASE_CAMP.SHAFT_X;
  const U = H - 1 - WORLD.SURFACE_ROWS;
  // Rules for all caves: not in the top rows, and the first descent beside the shaft stays dug.
  const ok = (i, x, y) => y >= WORLD.SURFACE_ROWS + WORLD.CAVE_MIN_DEPTH && !(Math.abs(x - sx) <= 2 && y < WORLD.SURFACE_ROWS + 0.15 * U);
  planet.strata.forEach((st, k) => {
    const c = st.cave;
    const mantleMagma = st.magma;
    if (c.style === 'none' && !mantleMagma) return;
    const rng = new RNG(((seed ^ 0x0cae) + k * 7919) >>> 0);
    const noise = createNoise2D((seed + 1013 + k * 131) | 0);
    const magmaNoise = createNoise2D((seed + 3049) | 0);
    const score = new Float32Array(W * H).fill(-Infinity);
    const magma = new Uint8Array(W * H);
    const idx = [], channel = [];
    eachTile(d, starts, k, (i, x, y) => {
      idx.push(i);
      if (!ok(i, x, y)) return;
      if (STYLES[c.style]) score[i] = STYLES[c.style](c, noise, x, y);
      if (mantleMagma) {
        const m = Math.abs(fbm(magmaNoise, x * WORLD.MAGMA_FREQ_X, y * WORLD.MAGMA_FREQ_Y, 3));
        if (m < WORLD.MAGMA_WIDTH) channel.push([m, i]);
      }
    });
    // Magma counts as open: cap channels at 40% of the budget so air pockets keep a share.
    channel.sort((p, q) => p[0] - q[0]).splice(Math.floor(0.4 * c.open[1] * idx.length));
    for (const [, i] of channel) { score[i] = Infinity; magma[i] = 1; }
    if (c.style === 'karst') carveShafts(d, starts, c, k, rng, score, ok);
    else if (c.style === 'tube') carveTubes(d, starts, c, k, rng, score, ok);
    else if (c.style === 'corridor') carveCorridors(d, starts, c, k, rng, score, ok);
    let lo = Infinity, hi = -Infinity;
    for (const i of idx) { const v = score[i]; if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    const apply = (thr) => {
      let open = 0;
      for (const i of idx) { const o = score[i] > thr; d.tileType[i] = o ? (magma[i] ? TILE.MAGMA : TILE.AIR) : st.tile; if (o) open++; }
      return open / idx.length;
    };
    if (!idx.length || lo > hi) { apply(Infinity); return; }
    const [omin, omax] = c.open;
    let best = Infinity, bestThr = hi;
    let a = lo - 1e-6, b = hi; // open iff score > thr: a opens all, b opens least
    for (let step = 0; step < 8; step++) {
      const thr = (a + b) / 2;
      const f = apply(thr);
      const miss = f < omin ? omin - f : f > omax ? f - omax : 0;
      if (miss < best) { best = miss; bestThr = thr; }
      if (miss === 0) return;
      if (f > omax) a = thr; else b = thr;
    }
    apply(bestThr);
  });
}

const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/** Spec 6.3: air deeper than 2 rows into stratum k that is reachable from a higher stratum is filled with host rock. */
export function applyCaveRules(d, starts) {
  const { W, H } = d;
  const planet = PLANETS[d.planet];
  const sIdx = (x, y) => stratumIndexAt(starts, x, y, W, planet);
  const inRange = (x, y) => x > 0 && x < W - 1 && y >= WORLD.SURFACE_ROWS && y < H - 1;
  for (let k = 1; k < planet.strata.length; k++) {
    const seen = new Uint8Array(W * H), stack = [];
    eachTile(d, starts, k, (i, x, y) => {
      if (!isOpen(d.tileType[i])) return;
      for (const [dx, dy] of NB) {
        if (inRange(x + dx, y + dy) && isOpen(d.tileType[i + dy * W + dx]) && sIdx(x + dx, y + dy) < k) { seen[i] = 1; stack.push(i); break; }
      }
    });
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      if (sIdx(x, y) === k && y > starts[k * W + x] + 2) { d.tileType[i] = planet.strata[k].tile; continue; }
      for (const [dx, dy] of NB) {
        const j = i + dy * W + dx;
        if (inRange(x + dx, y + dy) && !seen[j] && isOpen(d.tileType[j]) && sIdx(x + dx, y + dy) >= k) { seen[j] = 1; stack.push(j); }
      }
    }
  }
}

/** Water in `water` strata (noise), one-tile puddles on wide karst floors, gas in `gas` strata. Magma is carved in carveCaves. */
export function placeFluids(d, starts, seed) {
  const { W, H } = d;
  const planet = PLANETS[d.planet];
  const sx = WORLD.BASE_CAMP.SHAFT_X;
  const waterNoise = createNoise2D((seed + 2027) | 0);
  const gasNoise = createNoise2D((seed + 4091) | 0);
  const rng = new RNG((seed ^ 0x3a7e) >>> 0);
  const sIdx = (x, y) => stratumIndexAt(starts, x, y, W, planet);
  const nearShaft = (x, y) => Math.abs(x - sx) <= 1 && sIdx(x, y) === 0;
  for (let y = WORLD.SURFACE_ROWS; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, st = planet.strata[sIdx(x, y)];
      if (d.tileType[i] !== TILE.AIR || nearShaft(x, y)) continue;
      if (st.water && fbm(waterNoise, x * WORLD.WATER_FREQ, y * WORLD.WATER_FREQ, 2) > WORLD.WATER_THRESHOLD) d.tileType[i] = TILE.WATER;
      else if (st.gas && d.gas && fbm(gasNoise, x * 0.2, y * 0.2, 2) > 0.2) d.gas[i] = 8;
    }
  }
  // Karst floors wider than 6: 30% chance the one-tile floor row floods.
  const floor = (x, y) => d.tileType[y * W + x] === TILE.AIR && planet.strata[sIdx(x, y)].cave.style === 'karst'
    && !isOpen(d.tileType[(y + 1) * W + x]);
  for (let y = WORLD.SURFACE_ROWS; y < H - 2; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!floor(x, y)) continue;
      let e = x;
      while (e < W - 1 && floor(e, y)) e++;
      if (e - x > 6 && rng.chance(0.3)) for (let xx = x; xx < e; xx++) d.tileType[y * W + xx] = TILE.WATER;
      x = e;
    }
  }
}
