import { describe, it, expect } from 'vitest';
import {
  canMine, hitDamage, requiredTier, dynamiteOutcome, DYN_KEEP, DYN_DESTROY, DYN_COLLECT, requirementHint, crackStage,
} from '../src/systems/Mining.js';
import { TILE, ORE, MATERIALS, ORES, PICKAXES } from '../src/config.js';

const ROCKS = [TILE.SOIL, TILE.LIMESTONE, TILE.GRANITE, TILE.BASALT, TILE.MANTLE];

describe('Mining tier gating', () => {
  it('every host rock refuses damage below its tier and accepts at/above', () => {
    for (const t of ROCKS) {
      const req = MATERIALS[t].tier;
      for (let tier = 1; tier <= PICKAXES.length; tier++) {
        expect(canMine(t, 0, tier)).toBe(tier >= req);
        expect(hitDamage(t, 0, tier) > 0).toBe(tier >= req);
      }
    }
  });

  it('every ore uses max(host tier, ore tier)', () => {
    for (let o = 1; o < ORES.length; o++) {
      for (const host of ORES[o].hosts) {
        const req = Math.max(MATERIALS[host].tier, ORES[o].tier);
        expect(requiredTier(host, o)).toBe(req);
        for (let tier = 1; tier <= PICKAXES.length; tier++) {
          expect(canMine(host, o, tier)).toBe(tier >= req);
          expect(hitDamage(host, o, tier)).toBe(tier >= req ? PICKAXES[tier - 1].damage : 0);
        }
      }
    }
  });

  it('bedrock and open air are never mineable', () => {
    for (let tier = 1; tier <= PICKAXES.length; tier++) expect(canMine(TILE.BEDROCK, 0, tier)).toBe(false);
    expect(canMine(TILE.AIR, 0, 6)).toBe(false);
  });

  it('diamond needs the Tungsten Carbide Drill (tier 5), so Diamond Tooling is payable before its own drill', () => {
    for (let tier = 1; tier <= 4; tier++) expect(canMine(TILE.MANTLE, ORE.DIAMOND, tier)).toBe(false);
    expect(canMine(TILE.MANTLE, ORE.DIAMOND, 5)).toBe(true);
    expect(requirementHint(TILE.MANTLE, ORE.DIAMOND)).toMatch(/Tungsten Carbide/);
  });

  it('hint names the required pickaxe', () => {
    expect(requirementHint(TILE.GRANITE, 0)).toBe('Requires Steel Pickaxe');
    expect(requirementHint(TILE.LIMESTONE, ORE.SILVER)).toBe('Requires Steel Pickaxe');
  });

  it('crack stages follow 25/50/75/90%', () => {
    expect(crackStage(100, 100)).toBe(0);
    expect(crackStage(74, 100)).toBe(1);
    expect(crackStage(49, 100)).toBe(2);
    expect(crackStage(24, 100)).toBe(3);
    expect(crackStage(9, 100)).toBe(4);
  });
});

describe('Dynamite gating', () => {
  it('destroys host rock only up to pickTier + 1', () => {
    for (const t of ROCKS) {
      for (let tier = 1; tier <= 6; tier++) {
        expect(dynamiteOutcome(t, 0, tier)).toBe(MATERIALS[t].tier <= tier + 1 ? DYN_DESTROY : DYN_KEEP);
      }
    }
  });

  it('collects ore only when the pickaxe meets the ore tier, otherwise leaves it exposed', () => {
    for (let o = 1; o < ORES.length; o++) {
      for (const host of ORES[o].hosts) {
        for (let tier = 1; tier <= 6; tier++) {
          const out = dynamiteOutcome(host, o, tier);
          if (MATERIALS[host].tier > tier + 1 || tier < ORES[o].tier) expect(out).toBe(DYN_KEEP);
          else expect(out).toBe(DYN_COLLECT);
        }
      }
    }
  });

  it('never bypasses the diamond gate or bedrock', () => {
    for (let tier = 1; tier <= 4; tier++) expect(dynamiteOutcome(TILE.MANTLE, ORE.DIAMOND, tier)).toBe(DYN_KEEP);
    for (let tier = 1; tier <= 6; tier++) expect(dynamiteOutcome(TILE.BEDROCK, 0, tier)).toBe(DYN_KEEP);
  });
});

import { dynamiteOutcome, DYN_KEEP, DYN_DESTROY } from '../src/systems/Mining.js';
import { TILE as T_ } from '../src/config.js';
describe('core vs dynamite', () => {
  it('only the tier-6 drill lets dynamite break core rock', () => {
    expect(dynamiteOutcome(T_.CORE, 0, 5)).toBe(DYN_KEEP);
    expect(dynamiteOutcome(T_.CORE, 0, 6)).toBe(DYN_DESTROY);
  });
});

import { Mining } from '../src/systems/Mining.js';
import { EventBus, EV } from '../src/core/EventBus.js';
import { World } from '../src/world/World.js';
import { generateWorld } from '../src/world/WorldGen.js';
describe('alien ruins vs mining', () => {
  it('hull resists everything but a big bomb; the relic resists every bomb', () => {
    expect(canMine(TILE.ALIEN_HULL, 0, 6)).toBe(false);
    expect(dynamiteOutcome(TILE.ALIEN_HULL, 0, 6)).toBe(DYN_KEEP);
    expect(dynamiteOutcome(TILE.ALIEN_HULL, 0, 1, true)).toBe(DYN_DESTROY);
    expect(dynamiteOutcome(TILE.RELIC, 0, 6, true)).toBe(DYN_KEEP);
    expect(canMine(TILE.RELIC, 0, 1)).toBe(true);
  });
  it('breaking a relic tile records it once and emits RELIC_FOUND', () => {
    const w = new World(generateWorld(4242));
    const i = w.tileType.indexOf(TILE.RELIC);
    const bus = new EventBus(); const found = [];
    bus.on(EV.RELIC_FOUND, (e) => found.push(e.id));
    const economy = { relics: [], pickTier: 1 };
    const m = new Mining(w, bus, economy, { revealAround() {} }, { spawn() {} });
    m.breakTile(i, true);
    expect(economy.relics).toEqual(found);
    expect(found.length).toBe(1);
    m.breakTile(i, true); // already air: the type check stops a second record
    expect(economy.relics.length).toBe(1);
  });
  it('breaking a second relic tile of an owned relic emits nothing', () => {
    const w = new World(generateWorld(4242));
    const i = w.tileType.indexOf(TILE.RELIC);
    const bus = new EventBus(); let n = 0;
    bus.on(EV.RELIC_FOUND, () => { n++; });
    const m = new Mining(w, bus, { relics: [], pickTier: 1 }, { revealAround() {} }, { spawn() {} });
    m.breakTile(i, true);
    w.tileType[i] = TILE.RELIC; // a second tile of the same layer
    m.breakTile(i, true);
    expect(n).toBe(1);
  });
});
