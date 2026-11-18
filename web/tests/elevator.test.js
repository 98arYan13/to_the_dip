import { describe, it, expect } from 'vitest';
import { ITEM, ELEVATOR, CAMP, WORLD, TILE } from '../src/config.js';
import { Economy, createEconomyState } from '../src/systems/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { canPlaceStop, placeStop, stops, ride } from '../src/systems/Elevator.js';
import { stationBlocker, fieldCampBlocker } from '../src/systems/Camp.js';
import { travelState } from '../src/systems/Travel.js';

const S = WORLD.SURFACE_ROWS;
const mk = (planet = 'earth', tech = ['elevator']) => {
  const ec = new Economy(new EventBus(), { ...createEconomyState(), tech, planet });
  ec.stash[ITEM.STEEL] = 100; ec.stash[ITEM.CARBON_FIBER] = 100; return ec;
};
// open column at x=5 with floor under y=floorY
const mkWorld = () => {
  const W = 10, H = 400; const tileType = new Uint8Array(W * H).fill(TILE.AIR);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((y >= 100 && y % 50 === 0) || y === S + 6) tileType[y * W + x] = TILE.GRANITE;
  return { W, H, tileType, inBounds: (x, y) => x >= 0 && y >= 0 && x < W && y < H, isSolid: (x, y) => y >= H || tileType[y * W + x] !== TILE.AIR };
};

describe('elevator', () => {
  it('placement refusals', () => {
    const w = mkWorld();
    expect(canPlaceStop(mk('earth', []), w, 5, 99).reason).toMatch(/tech/);
    expect(canPlaceStop(mk(), w, 5, 120).reason).toMatch(/floor/); // not on a floor
    expect(canPlaceStop(mk(), w, 5, S + 5).reason).toMatch(/Too close/); // near surface
    const ec = mk(); expect(placeStop(ec, w, 5, 99).ok).toBe(true);
    expect(canPlaceStop(ec, w, 5, 99).reason).toMatch(/Too close/);
    ec.stash[ITEM.STEEL] = 0; expect(canPlaceStop(ec, w, 5, 199).reason).toMatch(/Not enough/);
  });
  it('pays once and caps per planet', () => {
    const w = mkWorld(); const ec = mk();
    placeStop(ec, w, 5, 99);
    expect(ec.stash[ITEM.STEEL]).toBe(90); expect(ec.stash[ITEM.CARBON_FIBER]).toBe(96);
    for (const [pl, n] of Object.entries(ELEVATOR.MAX)) {
      const e = mk(pl); for (let i = 0; i < n; i++) e.elevatorStops.push({ x: 5, y: 100 + i * 20 });
      expect(canPlaceStop(e, w, 5, 349).reason).toMatch(/limit/);
    }
  });
  it('stops lists camp first, labelled by depth', () => {
    const ec = mk(); ec.elevatorStops.push({ x: 5, y: 300 }, { x: 5, y: 99 });
    const s = stops(ec); expect(s[0].label).toBe('Camp'); expect(s[1].y).toBe(99); expect(s[2].label).toBe(`${300 - (S - 1)} m`);
  });
  it('ride time and power', () => {
    const ec = mk(); ec.power = 100;
    const r = ride(ec, mkWorld(), { y: -1 }, { x: 5, y: 299, label: '9 m' });
    expect(r).toEqual({ ok: true, seconds: 10, power: 30 }); expect(ec.power).toBe(70);
    const e2 = mk(); e2.power = 0; e2.stash.fill(0);
    expect(ride(e2, mkWorld(), { y: -1 }, { x: 5, y: 299, label: '9 m' })).toMatchObject({ ok: false, reason: 'Not enough camp power' });
  });
  it('ride refuses a blocked stop without drawing power', () => {
    const w = mkWorld(); const ec = mk(); ec.power = 100;
    const to = { x: 5, y: 99, label: '1 m' };
    w.tileType[99 * w.W + 5] = TILE.SAND; // filled stop tile
    expect(ride(ec, w, { y: 0 }, to)).toMatchObject({ ok: false, reason: 'Stop blocked' }); expect(ec.power).toBe(100);
    w.tileType[99 * w.W + 5] = TILE.AIR; w.tileType[98 * w.W + 5] = TILE.SAND; // headroom only
    expect(ride(ec, w, { y: 0 }, to).reason).toBe('Stop blocked');
  });
  it('gap boundary is 20 rows', () => {
    const w = mkWorld(); const ec = mk(); ec.elevatorStops.push({ x: 5, y: 99 });
    w.tileType[120 * w.W + 5] = TILE.GRANITE;
    w.tileType[119 * w.W + 5] = TILE.GRANITE;
    expect(canPlaceStop(ec, w, 5, 118).reason).toMatch(/Too close/); // 19 rows
    w.tileType[119 * w.W + 5] = TILE.AIR;
    expect(canPlaceStop(ec, w, 5, 119).ok).toBe(true); // 20 rows
  });
  it('refused ride leaves a partial pool untouched', () => {
    const ec = mk(); ec.power = 5; ec.stash.fill(0);
    expect(ride(ec, mkWorld(), { y: 0 }, { x: 5, y: 300, label: 'Camp' }).ok).toBe(false); expect(ec.power).toBe(5);
  });
  it('travel clears stops; camp and station caps per planet', () => {
    const ec = mk(); ec.elevatorStops.push({ x: 1, y: 100 });
    ec.consumables.campKit = 1; expect(travelState(ec, 'earth').elevatorStops).toEqual([]);
    for (const [pl, n] of Object.entries(CAMP.MAX_STATIONS)) {
      const e = mk(pl, ['charge_station']); for (let i = 0; i < n; i++) e.stations.push({ x: 0, y: 0 });
      expect(stationBlocker(e, mkWorld(), 5, 99)).toBe('Station limit reached');
    }
    for (const [pl, n] of Object.entries(CAMP.FIELD_CAMP.MAX)) {
      const e = mk(pl); e.consumables.campKit = 1; for (let i = 0; i < n; i++) e.fieldCamps.push({ x: 0, y: 0 });
      expect(fieldCampBlocker(e, mkWorld(), 5, 99)).toBe('Camp limit reached');
    }
  });
});
