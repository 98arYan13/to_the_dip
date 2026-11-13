import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectClip, Animator, CLIP_NAMES } from '../src/anim/Animator.js';
import { realRig } from './rig.test.js';

const rig = realRig();
const clips = JSON.parse(readFileSync(new URL('../public/rig/anims.json', import.meta.url), 'utf8'));
const P = (o = {}) => ({ hurtTimer: 0, onLadder: false, onGround: true, mineState: 0, vy: 0, vx: 0, jetting: false, impactVY: 0, walkPhase: 1, swingPhase: 0.5, ...o });
const C = (o = {}) => ({ aimDown: false, landing: false, ...o });

describe('selectClip', () => {
  const rows = [
    [P({ hurtTimer: 1, mineState: 1 }), C(), 'hurt'],
    [P({ onLadder: true, onGround: false, vy: -90 }), C(), 'climb'],
    [P({ onLadder: true, onGround: false }), C(), 'idle'],
    [P({ mineState: 1 }), C(), 'mine_side'],
    [P({ mineState: 1 }), C({ aimDown: true }), 'mine_down'],
    [P({ mineState: 1, onGround: false }), C(), 'mine_side'],
    [P({ onGround: false, jetting: true }), C(), 'jet'],
    [P({ onGround: false, vy: -100 }), C(), 'jump'],
    [P({ onGround: false, vy: 100 }), C(), 'fall'],
    [P(), C({ landing: true }), 'land'],
    [P({ vx: 50 }), C(), 'walk'],
    [P({ vx: 50, jetting: true }), C(), 'walk'],
    [P({ vx: 5 }), C(), 'idle'],
  ];
  it.each(rows)('%#', (p, c, want) => expect(selectClip(p, c)).toBe(want));
});

describe('Animator', () => {
  const run = (a, p, dt, n = 1) => { let o; for (let i = 0; i < n; i++) o = a.update(p, dt, { time: 0, aimDown: false }); return o; };
  it('cross-fades idle→walk over 0.1s', () => {
    const a = new Animator(rig, clips);
    run(a, P(), 0.016, 3);
    const idle = Float32Array.from(a.base.angle);
    const mid = Float32Array.from(run(a, P({ vx: 50 }), 0.05).angle);
    const end = run(a, P({ vx: 50 }), 0.05).angle;
    const i = rig.index.get('legF_thigh');
    const walk = a.sampled.angle[i];
    expect(Math.abs(mid[i] - idle[i])).toBeGreaterThan(1e-4);
    expect(Math.abs(mid[i] - walk)).toBeGreaterThan(1e-4);
    expect(end[i]).toBeCloseTo(walk, 6);
  });
  it('snaps into mine_side', () => {
    const a = new Animator(rig, clips);
    run(a, P(), 0.016, 3);
    const out = run(a, P({ mineState: 1 }), 0.001);
    expect(out.angle[rig.index.get('torso')]).toBeCloseTo(a.sampled.angle[rig.index.get('torso')], 4);
  });
  it('lands only on hard impact', () => {
    const a = new Animator(rig, clips);
    run(a, P({ onGround: false }), 0.016);
    run(a, P({ impactVY: 200 }), 0.016);
    expect(a.clip).toBe('land');
    run(a, P(), 0.3);
    expect(a.clip).toBe('idle');
    const b = new Animator(rig, clips);
    run(b, P({ onGround: false }), 0.016);
    run(b, P({ impactVY: 30 }), 0.016);
    expect(b.clip).toBe('idle');
  });
  it('anims.json data is valid', () => {
    for (const n of CLIP_NAMES) {
      expect(clips[n].duration).toBeGreaterThan(0);
      for (const b of Object.keys(clips[n].keys)) expect(rig.index.has(b)).toBe(true);
    }
  });
});

describe('climb animation', () => {
  it('only cycles while actually moving on the ladder', () => {
    const a = new Animator(rig, clips);
    const hang = P({ onLadder: true, onGround: false, vy: 0 });
    for (let i = 0; i < 60; i++) a.update(hang, 1 / 60, { time: 0, aimDown: false });
    expect(a.climbDist).toBe(0);
    for (let i = 0; i < 60; i++) a.update(P({ onLadder: true, onGround: false, vy: 90 }), 1 / 60, { time: 0, aimDown: false });
    expect(a.climbDist).toBeCloseTo(90, 0);
  });
});
