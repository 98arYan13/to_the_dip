import { describe, it, expect } from 'vitest';
import { ITEM } from '../src/config.js';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { destinations, canTravel, travelState } from '../src/systems/Travel.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { clearOwnedRelics } from '../src/world/Ruins.js';
import { TILE } from '../src/config.js';

const mk = (tech = [], planet = 'earth') => new Economy(new EventBus(), { ...createEconomyState(), tech, planet });
const ready = ['orbital_station', 'lunar_landing', 'mars_mission', 'interstellar'];

describe('travel', () => {
  it('Earth is always a free destination', () => {
    const d = destinations(mk()).find((x) => x.id === 'earth');
    expect(d).toMatchObject({ known: true, cost: {}, affordable: true, current: true });
    expect(canTravel(mk(['orbital_station'], 'moon'), 'earth').ok).toBe(true);
  });
  it('unknown, unaffordable and current destinations are refused with the right reason', () => {
    expect(canTravel(mk(), 'moon').reason).toBe('Launch pad not built');
    expect(canTravel(mk(['orbital_station']), 'moon').reason).toBe('Unknown destination');
    expect(canTravel(mk(['orbital_station', 'lunar_landing']), 'moon').reason).toBe('Not enough Propellant');
    expect(canTravel(mk(ready), 'tessera').reason).toBe('Not enough Warp Charges');
    expect(canTravel(mk(ready), 'earth').reason).toBe('Already here');
  });
  it('travel pays once and keeps stash, tech, gear, relics, cargo materials', () => {
    const ec = mk(ready); ec.stash[ITEM.PROPELLANT] = 15; ec.cargo[ITEM.PROPELLANT] = 2; ec.relics.push('relay_alpha'); ec.levels.jetpack = 2; ec.credits = 500;
    const s = travelState(ec, 'moon');
    expect(s.planet).toBe('moon');
    expect(s.stash[ITEM.PROPELLANT] + s.cargo[ITEM.PROPELLANT]).toBe(7);
    expect(s.tech).toEqual(ready); expect(s.relics).toEqual(['relay_alpha']); expect(s.levels.jetpack).toBe(2); expect(s.credits).toBe(500);
  });
  it('travel clears contracts, stations, field camps, elevator stops and resets completed, not finished', () => {
    const ec = mk(ready); ec.stash[ITEM.PROPELLANT] = 10;
    ec.contracts.active.push({ id: 'a', ore: 1, qty: 1, rewardCash: 1 }); ec.stations.push({ x: 1, y: 1 }); ec.fieldCamps.push({ x: 1, y: 1 }); ec.elevatorStops.push({ x: 1, y: 1 });
    ec.completed = true; ec.finished = true;
    const s = travelState(ec, 'moon');
    expect(s.contracts.active).toEqual([]); expect(s.stations).toEqual([]); expect(s.fieldCamps).toEqual([]); expect(s.elevatorStops).toEqual([]);
    expect(s.completed).toBe(false); expect(s.finished).toBe(true);
  });
  it('from the Moon with zero Propellant, Earth is still reachable', () => {
    const ec = mk(ready, 'moon');
    expect(canTravel(ec, 'earth').ok).toBe(true);
    expect(travelState(ec, 'earth').planet).toBe('earth');
  });
  it('a world whose relic is owned spawns its ruin empty', () => {
    const w = generateWorld(900, 'moon');
    const count = (x) => { let n = 0; for (let i = 0; i < x.tileType.length; i++) if (x.tileType[i] === TILE.RELIC) n++; return n; };
    expect(count(w)).toBe(1);
    const w2 = generateWorld(900, 'moon'); clearOwnedRelics(w2, ['relay_alpha']);
    expect(count(w2)).toBe(0);
  });
});
