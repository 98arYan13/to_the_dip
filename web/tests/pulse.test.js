import { describe, it, expect } from 'vitest';
import { EventBus, EV } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { Pulse, pulseEffect } from '../src/systems/Hazards/Pulse.js';

const eco = (tech = [], resist = 0) => ({ tech, stat: (n, b) => (n === 'pulseResist' ? resist : b) });
function setup(economy = eco()) {
  const bus = new EventBus(); const ev = [];
  bus.on(EV.PULSE_WARN, (p) => ev.push(['warn', p])); bus.on(EV.PULSE, (p) => ev.push(['pulse', p]));
  const p = new Pulse(bus, new RNG(1), economy); p.drains = [];
  p.onDrain = (f) => p.drains.push(f);
  return { p, ev };
}
const run = (p, depth, sheltered, s = 2000) => { for (let i = 0; i < s * 10; i++) p.update(0.1, depth, sheltered); };

describe('Pulse', () => {
  it('effect scales with resistance', () => {
    expect(pulseEffect(0)).toEqual({ drainFrac: 0.25, stunS: 6 });
    expect(pulseEffect(0.5)).toEqual({ drainFrac: 0.125, stunS: 3 });
    expect(pulseEffect(1)).toEqual({ drainFrac: 0, stunS: 0 });
  });
  it('never fires above the safe depth', () => {
    const { p, ev } = setup(); run(p, 100, false, 10000); expect(ev).toEqual([]);
  });
  it('warns, then fires, drains and stuns when unsheltered', () => {
    const { p, ev } = setup();
    for (let i = 0; i < 100000 && !ev.some((e) => e[0] === 'pulse'); i++) p.update(0.1, 400, false);
    expect(ev[0]).toEqual(['warn', { seconds: 5 }]); expect(ev[1]).toEqual(['pulse', { sheltered: false }]);
    expect(p.drains).toEqual([0.25]); expect(p.stun).toBe(6);
    p.update(1, 400, false); expect(p.stun).toBe(5);
  });
  it('does nothing when sheltered', () => {
    const { p, ev } = setup();
    for (let i = 0; i < 100000 && !ev.some((e) => e[0] === 'pulse'); i++) p.update(0.1, 400, true);
    expect(ev[1]).toEqual(['pulse', { sheltered: true }]); expect(p.drains).toEqual([]); expect(p.stun).toBe(0);
  });
  it('detector doubles the warning', () => {
    const { p, ev } = setup(eco(['pulse_detector'])); run(p, 400, false);
    expect(ev[0]).toEqual(['warn', { seconds: 10 }]);
  });
  it('reset clears stun and a pending warning', () => {
    const { p, ev } = setup();
    for (let i = 0; i < 100000 && !ev.some((e) => e[0] === 'pulse'); i++) p.update(0.1, 400, false);
    p.reset(); expect(p.stun).toBe(0);
    ev.length = 0;
    p.warn = 3; p.reset();
    expect(p.warn).toBeLessThan(0); expect(p.stun).toBe(0);
    run(p, 400, false, 10); // shorter than the minimum gap, so any event means the warning survived
    expect(ev).toEqual([]);
  });
});
