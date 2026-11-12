import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/world/WorldGen.js';
import { WORLD, TILE, ORES, FLAG } from '../src/config.js';

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

describe('WorldGen', () => {
  const a = generateWorld(424242);

  it('same seed produces an identical world', () => {
    const b = generateWorld(424242);
    for (const k of ['tileType', 'tileHP', 'oreType', 'flags', 'band']) expect(same(a[k], b[k])).toBe(true);
  });

  it('different seeds produce different worlds', () => {
    const c = generateWorld(1);
    let diff = 0;
    for (let i = 0; i < a.tileType.length; i++) if (a.tileType[i] !== c.tileType[i] || a.oreType[i] !== c.oreType[i]) diff++;
    expect(diff).toBeGreaterThan(500);
  });

  it('has open sky, bedrock bounds and a solid surface row', () => {
    const { W, H } = a;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < WORLD.SURFACE_ROWS; y++) expect(a.tileType[y * W + x]).toBe(TILE.AIR);
      expect(a.tileType[(H - 1) * W + x]).toBe(TILE.BEDROCK);
    }
    for (let y = WORLD.SURFACE_ROWS; y < H; y++) {
      expect(a.tileType[y * W]).toBe(TILE.BEDROCK);
      expect(a.tileType[y * W + W - 1]).toBe(TILE.BEDROCK);
    }
    for (let x = 1; x < W - 1; x++) expect(a.tileType[WORLD.SURFACE_ROWS * W + x]).toBe(TILE.SOIL);
  });

  it('places ores only in their host rock, and every ore exists', () => {
    const counts = new Array(ORES.length).fill(0);
    for (let i = 0; i < a.oreType.length; i++) {
      const o = a.oreType[i];
      if (!o) continue;
      counts[o]++;
      expect(ORES[o].hosts).toContain(a.tileType[i]);
    }
    for (let o = 1; o < ORES.length; o++) expect(counts[o]).toBeGreaterThan(0);
  });

  it('orders bands by depth and sets solid flags', () => {
    const depthOf = (t) => {
      let s = 0; let n = 0;
      for (let i = 0; i < a.tileType.length; i++) if (a.tileType[i] === t) { s += (i / a.W) | 0; n++; }
      return s / n;
    };
    const d = [TILE.SOIL, TILE.LIMESTONE, TILE.GRANITE, TILE.BASALT, TILE.MANTLE, TILE.CORE].map(depthOf);
    for (let k = 1; k < d.length; k++) expect(d[k]).toBeGreaterThan(d[k - 1]);
    for (let i = 0; i < a.tileType.length; i++) {
      const solid = a.tileType[i] >= TILE.SOIL && a.tileType[i] <= TILE.BEDROCK || a.tileType[i] === TILE.CORE || a.tileType[i] === TILE.SAND;
      expect((a.flags[i] & FLAG.SOLID) !== 0).toBe(solid);
    }
  });
});
