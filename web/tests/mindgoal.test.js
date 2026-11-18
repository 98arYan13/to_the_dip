import { describe, it, expect } from 'vitest';
import { EventBus, EV } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { MIND_GOAL, WORLD, TILE, HAZARD } from '../src/config.js';
import { MindGoal } from '../src/systems/MindGoal.js';
import { mindChamber, mindNodes } from '../src/world/Zones.js';
import { Pulse } from '../src/systems/Hazards/Pulse.js';
import { Quake } from '../src/systems/Hazards/Quake.js';
import { Fluids } from '../src/systems/Hazards/Fluids.js';
import { Economy } from '../src/systems/Economy.js';

const T = WORLD.TILE_PX;
const world = { W: 64, H: 1000, planet: 'tessera' };
const N = mindNodes(64, 1000);
const at = (i) => [(N[i].x + (i === 1 ? 0 : 1)) * T, (N[i].y + 0.5) * T]; // one tile inside the chamber, next to the node
const mk = (over = {}) => {
  const bus = new EventBus(); const ev = [];
  for (const k of ['MIND_GREETING', 'FINISHED', 'HINT']) bus.on(EV[k], (p) => ev.push([k, p]));
  const economy = { relics: ['origin_core'], tech: ['heat_suit_3'], finished: false, mind: { nodes: [], coolant: 0, greeted: false }, story: { flags: [] }, ...over };
  const g = new MindGoal(world, bus, economy);
  g.pulses = 0; g.rows = []; g.onPulse = () => g.pulses++; g.onRaiseCoolant = (r) => g.rows.push(r);
  return { g, bus, ev, economy };
};
const hold = (g, [x, y], s, dt = 0.5) => { for (let t = 0; t < s; t += dt) g.update(dt, x, y); };
const greet = (g, i = 0) => g.update(0.1, ...at(i));

describe('MindGoal', () => {
  it('nothing happens without the Origin Core', () => {
    const { g, ev, economy } = mk({ relics: [] });
    greet(g); greet(g); hold(g, at(0), 30);
    expect(ev.filter((e) => e[0] === 'HINT')).toHaveLength(1); // once per entry
    expect(economy.mind).toEqual({ nodes: [], coolant: 0, greeted: false });
    expect(g.progress).toBe(0);
  });
  it('greeting fires once, then nodes can be held', () => {
    const { g, ev, economy } = mk();
    greet(g); expect(ev.filter((e) => e[0] === 'MIND_GREETING')).toHaveLength(1);
    expect(economy.mind.greeted).toBe(true); expect(economy.story.flags).toContain('mind_greeted');
    hold(g, at(0), 5); expect(g.progress).toBeCloseTo(0.25); expect(g.activeNode).toBe(0);
    greet(g); expect(ev.filter((e) => e[0] === 'MIND_GREETING')).toHaveLength(1);
  });
  it('holding a node for 20 s completes it and raises the coolant 2 rows', () => {
    const { g, economy } = mk(); greet(g);
    hold(g, at(1), MIND_GOAL.NODE_S);
    expect(economy.mind.nodes).toEqual([1]); expect(economy.mind.coolant).toBe(2); expect(g.rows).toEqual([2]);
    hold(g, at(1), 5); expect(g.progress).toBe(0); // a finished node does not count again
  });
  it('leaving or dying resets only the node in progress', () => {
    const { g, bus, economy } = mk(); greet(g);
    hold(g, at(0), 20); hold(g, at(1), 15); expect(g.progress).toBeCloseTo(0.75);
    bus.emit(EV.PLAYER_DEAD, 'x');
    expect(economy.mind.nodes).toEqual([0]); expect(economy.mind.coolant).toBe(2); expect(g.progress).toBe(0);
    hold(g, at(1), 10); g.update(0.5, 0, 0); expect(g.progress).toBe(0);
  });
  it('pulses fire every 8 s during the sequence', () => {
    const { g } = mk(); greet(g);
    hold(g, [(N[0].x + 4) * T, (N[0].y + 0.5) * T], 25, 0.1); // inside the chamber, away from nodes
    expect(g.pulses).toBe(3);
  });
  it('without heat_suit_3 the hold does not advance', () => {
    const { g } = mk({ tech: [] }); greet(g); hold(g, at(0), 10); expect(g.progress).toBe(0);
  });
  it('nodes complete in any order; the third sets finished and emits FINISHED once', () => {
    const { g, ev, economy } = mk(); greet(g);
    for (const i of [2, 0, 1]) hold(g, at(i), 20);
    expect(economy.mind.nodes.sort()).toEqual([0, 1, 2]); expect(economy.finished).toBe(true);
    hold(g, at(1), 30); expect(ev.filter((e) => e[0] === 'FINISHED')).toHaveLength(1);
  });
  it('mid-sequence state survives a save round-trip', () => {
    const { g, economy } = mk(); greet(g); hold(g, at(0), 20); hold(g, at(1), 10);
    const saved = JSON.parse(JSON.stringify(economy.mind));
    const r = mk({ mind: saved });
    r.g.reapply(); expect(r.g.rows).toEqual([2]);
    hold(r.g, at(1), 20); hold(r.g, at(2), 20);
    expect(r.economy.mind.nodes).toEqual([0, 1, 2]); expect(r.economy.finished).toBe(true);
    expect(r.economy.mind.coolant).toBe(6);
  });
  it('the Mind chamber coolant helper fills the lowest rows, idempotently', () => {
    const c = mindChamber(64, 1000); const W = 64; const n = W * 1000;
    const w = { W, H: 1000, tileType: new Uint8Array(n), fluid: new Uint8Array(n), flags: new Uint8Array(n), gas: new Uint8Array(n) };
    const f = new Fluids(w, new EventBus());
    f.raiseRows(c, 2); f.raiseRows(c, 2);
    const below = (y) => w.tileType[y * W + c.x + 3];
    expect(below(c.y + c.h - 1)).toBe(TILE.WATER); expect(below(c.y + c.h - 2)).toBe(TILE.WATER); expect(below(c.y + c.h - 3)).toBe(TILE.AIR);
    expect(w.fluid[(c.y + c.h - 1) * W + c.x + 3]).toBe(HAZARD.FLUID.MAX);
  });
});

describe('after the game is finished', () => {
  it('Pulse and Quake never fire, also on a new Earth map', () => {
    const ev = []; const bus = new EventBus(); bus.on(EV.PULSE_WARN, () => ev.push('warn')); bus.on(EV.QUAKE_WARN, () => ev.push('quake'));
    const ec = new Economy(); ec.finished = true; ec.planet = 'earth';
    const p = new Pulse(bus, new RNG(1), ec); const q = new Quake({ H: 256 }, bus, {}, new RNG(1), ec);
    p.trigger(); expect(p.warn).toBe(-1);
    for (let i = 0; i < 100000; i++) { p.update(0.1, 400, false); q.update(0.1, 0.8); }
    expect(ev).toEqual([]);
  });
});
