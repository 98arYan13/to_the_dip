import { describe, it, expect } from 'vitest';
import { WORLD, TILE, ZONES, RELICS, PLANETS } from '../src/config.js';
import { requiredTier } from '../src/systems/Mining.js';
import { planZones, blockedAreas } from '../src/world/Zones.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { planRuins, relicIdAt, clearOwnedRelics, hasRuins, nearestRuin } from '../src/world/Ruins.js';

const rectsOverlap = (a, b, pad) => a.x - pad < b.x + b.w && b.x - pad < a.x + a.w && a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;
const seeds = Array.from({ length: 50 }, (_, k) => 1000 + k * 7919);
const relicIds = (w) => { const ids = []; for (let i = 0; i < w.tileType.length; i++) if (w.tileType[i] === TILE.RELIC) ids.push(relicIdAt(w.planet ?? 'earth', (i / w.W) | 0, w.H)); return ids; };

describe('ruins', () => {
  it('one ruin per layer, inside its layer band, clear of zones and the core', () => {
    for (const s of seeds) {
      const rs = planRuins(s, WORLD.W, WORLD.H); const zs = planZones(s, WORLD.W, WORLD.H);
      expect(rs.map((r) => r.layer)).toEqual([0, 1, 2, 3, 4]);
      const bl = blockedAreas(WORLD.W, WORLD.H); const U = WORLD.H - 1 - WORLD.SURFACE_ROWS;
      for (const r of rs) {
        const [l0, l1] = ZONES.LAYERS[r.layer];
        expect(r.y).toBeGreaterThanOrEqual(WORLD.SURFACE_ROWS + Math.ceil(U * l0));
        expect(r.y + r.h).toBeLessThanOrEqual(WORLD.SURFACE_ROWS + Math.floor(U * l1));
        expect(relicIdAt('earth', r.y + r.h - 2, WORLD.H)).toBe(RELICS.find((x) => x.layer === r.layer).id);
        for (const b of bl) expect(rectsOverlap(r, b, 3), `seed ${s} blocked`).toBe(false);
      }
      for (const r of rs) for (const z of zs) expect(rectsOverlap(r, z, 3), `seed ${s}`).toBe(false);
    }
  });
  it('planRuins rects match the stamped ruins: that layer relic and a hull ring', () => {
    for (const s of seeds) {
      const w = generateWorld(s);
      for (const r of planRuins(s, w.W, w.H)) {
        let relics = 0; let hull = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const t = w.tileType[y * w.W + x];
          if (t === TILE.RELIC) { relics++; expect(relicIdAt('earth', y, w.H)).toBe(RELICS.find((q) => q.layer === r.layer).id); }
          if (t === TILE.ALIEN_HULL && (x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1)) hull++;
        }
        expect(relics, `seed ${s}`).toBe(1);
        expect(hull, `seed ${s}`).toBe(r.layer === 3 ? 26 : 24);
      }
    }
  });
  it('each ruin has one detached hull tile outside its wall', () => {
    for (const s of seeds) {
      const w = generateWorld(s);
      for (const r of planRuins(s, w.W, w.H)) {
        let n = 0;
        for (let y = r.y - 3; y < r.y + r.h + 3; y++) for (let x = r.x - 3; x < r.x + r.w + 3; x++) {
          if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue;
          if (w.tileType[y * w.W + x] === TILE.ALIEN_HULL) n++;
        }
        expect(n, `seed ${s}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('each generated world has exactly five relic tiles, one per layer', () => {
    expect(relicIds(generateWorld(4242)).sort()).toEqual(['control_key', 'hull_shard', 'matter_loom', 'shield_lattice', 'thermal_siphon']);
  });
  it('layer 3 ruin has a full hull ring; the others have a 2-tile rock breach', () => {
    const w = generateWorld(4242);
    planRuins(4242, w.W, w.H).forEach((r) => {
      let n = 0;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        if ((x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1) && w.tileType[y * w.W + x] === TILE.ALIEN_HULL) n++;
      }
      expect(n).toBe(r.layer === 3 ? 26 : 24);
    });
  });
  it('owned relics are removed on a new map', () => {
    const w = generateWorld(4242); clearOwnedRelics(w, ['hull_shard']);
    const ids = relicIds(w);
    expect(ids.length).toBe(4);
    expect(ids).not.toContain('hull_shard');
  });
  it('hasRuins is false for a world generated without the ruin pass', () => {
    const w = generateWorld(4242);
    expect(hasRuins(w)).toBe(true);
    for (let i = 0; i < w.tileType.length; i++) if (w.tileType[i] === TILE.ALIEN_HULL) w.tileType[i] = TILE.AIR;
    expect(hasRuins(w)).toBe(false);
  });
  it('nearestRuin skips ruins whose relic is owned', () => {
    const rs = planRuins(4242, WORLD.W, WORLD.H);
    const near = nearestRuin(4242, WORLD.W, WORLD.H, [], rs[0].x, rs[0].y);
    expect(near.y).toBeGreaterThanOrEqual(rs[0].y);
    expect(near.y).toBeLessThan(rs[0].y + rs[0].h);
    expect(nearestRuin(4242, WORLD.W, WORLD.H, ['hull_shard'], rs[0].x, rs[0].y).y).not.toBe(near.y);
    expect(nearestRuin(4242, WORLD.W, WORLD.H, ['hull_shard', 'shield_lattice', 'thermal_siphon', 'matter_loom', 'control_key'], 0, 0)).toBeNull();
  });
});

describe('ruin breach tier', () => {
  it('every breach tile needs no more than its layer stratum tier (60 seeds)', () => {
    for (let k = 0; k < 60; k++) {
      const w = generateWorld(500 + k * 104729);
      for (const r of planRuins(w.genSeed, w.W, w.H)) {
        if (r.layer === 3) continue; // sealed in hull
        for (const y of [r.y + r.h - 2, r.y + r.h - 3]) {
          const i = y * w.W + r.x;
          expect(requiredTier(w.tileType[i], w.oreType[i]), `seed ${k} layer ${r.layer}`).toBeLessThanOrEqual(PLANETS.earth.strata[r.layer].tier);
        }
      }
    }
  });
});

describe('ruins on other worlds', () => {
  const ids = { moon: 'relay_alpha', mars: 'relay_beta', tessera: 'origin_core' };
  const fills = { moon: (t, g) => t === TILE.AIR && !g, mars: (t, g) => t === TILE.AIR && g > 0, tessera: (t) => t === TILE.WATER };
  const worlds = {}; for (const p of Object.keys(ids)) worlds[p] = Array.from({ length: 12 }, (_, k) => generateWorld(900 + k * 7919, p));

  it('exactly one ruin in the profile stratum, one relic tile with the profile relic id, relicIdAt is planet-wide', () => {
    for (const [p, ws] of Object.entries(worlds)) for (const w of ws) {
      const rs = planRuins(w.genSeed, w.W, w.H, PLANETS[p]);
      expect(rs.length, `${p} ${w.seed}`).toBe(1);
      const [r] = rs; const st = PLANETS[p].strata[PLANETS[p].ruinStratum]; const U = w.H - 1 - WORLD.SURFACE_ROWS;
      expect(r.y).toBeGreaterThanOrEqual(WORLD.SURFACE_ROWS + Math.floor(U * st.from));
      expect(r.y + r.h).toBeLessThanOrEqual(WORLD.SURFACE_ROWS + Math.ceil(U * st.to) + 1);
      expect(relicIdAt(p, r.y, w.H)).toBe(ids[p]);
      const found = []; for (let i = 0; i < w.tileType.length; i++) if (w.tileType[i] === TILE.RELIC) found.push(relicIdAt(p, (i / w.W) | 0, w.H));
      expect(found).toEqual([ids[p]]);
    }
  });
  it('the ruin holds vacuum on the Moon, methane on Mars and coolant on Tessera', () => {
    for (const [p, ws] of Object.entries(worlds)) for (const w of ws) {
      const [r] = planRuins(w.genSeed, w.W, w.H, PLANETS[p]);
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        const i = y * w.W + x; if (w.tileType[i] === TILE.RELIC) continue;
        expect(fills[p](w.tileType[i], w.gas[i]), `${p} ${w.seed} ${x},${y}`).toBe(true);
      }
    }
  });
  it('the Moon relay ruin sits inside the tube cathedral, Tessera origin core in the data vault', () => {
    for (const w of worlds.moon) {
      const [r] = planRuins(w.genSeed, w.W, w.H, PLANETS.moon);
      const c = planZones(w.genSeed, w.W, w.H, PLANETS.moon).find((z) => z.kind === 'tube_cathedral');
      expect([c.w, c.h]).toEqual([30, 9]);
      expect(r.x > c.x && r.x + r.w <= c.x + c.w && r.y >= c.y && r.y + r.h <= c.y + c.h).toBe(true);
    }
    for (const w of worlds.tessera) {
      const [r] = planRuins(w.genSeed, w.W, w.H, PLANETS.tessera);
      const v = planZones(w.genSeed, w.W, w.H, PLANETS.tessera).find((z) => z.kind === 'data_vault');
      expect([v.x, v.y]).toEqual([r.x, r.y]);
    }
  });
  it('the breach needs no more than the ruin stratum tier; owned relics are removed on a new map', () => {
    for (const [p, ws] of Object.entries(worlds)) for (const w of ws) {
      const [r] = planRuins(w.genSeed, w.W, w.H, PLANETS[p]);
      for (const y of [r.y + r.h - 2, r.y + r.h - 3]) { const i = y * w.W + r.x; expect(requiredTier(w.tileType[i], w.oreType[i]), `${p} ${w.seed}`).toBeLessThanOrEqual(PLANETS[p].strata[PLANETS[p].ruinStratum].tier); }
      clearOwnedRelics(w, [ids[p]]);
      expect(w.tileType.includes(TILE.RELIC)).toBe(false);
    }
  });
  it('nearestRuin respects the planet', () => {
    const w = worlds.mars[0]; const [r] = planRuins(w.genSeed, w.W, w.H, PLANETS.mars);
    expect(nearestRuin(w.genSeed, w.W, w.H, [], 0, 0, 'mars').y).toBe(r.y + (r.h >> 1));
    expect(nearestRuin(w.genSeed, w.W, w.H, ['relay_beta'], 0, 0, 'mars')).toBeNull();
  });
});
