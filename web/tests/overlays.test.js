import { describe, it, expect } from 'vitest';
import { createPose, solveWorld, boneTip } from '../src/anim/Rig.js';
import { toRigSpace, solveTwoBone, headLook, gripTarget, applyOverlays, squashOffset } from '../src/anim/Overlays.js';
import { realRig } from './rig.test.js';

const rig = realRig();
const tip = (l1, l2, { a1, a2 }) => [l1 * Math.cos(a1) + l2 * Math.cos(a1 + a2), l1 * Math.sin(a1) + l2 * Math.sin(a1 + a2)];

describe('Overlays', () => {
  it('two-bone reaches', () => {
    const s = solveTwoBone(10, 10, 12, 5, 1);
    const t = tip(10, 10, s);
    expect(Math.hypot(t[0] - 12, t[1] - 5)).toBeLessThan(1); expect(s.reached).toBe(true);
  });
  it('unreachable points straight', () => {
    const s = solveTwoBone(10, 10, 50, 0, 1);
    expect(s.reached).toBe(false); expect(s.a1).toBeCloseTo(0, 5); expect(s.a2).toBeCloseTo(0, 5);
  });
  it('zero distance is finite', () => {
    const s = solveTwoBone(10, 10, 0, 0, -1);
    expect(Number.isFinite(s.a1) && Number.isFinite(s.a2)).toBe(true);
  });
  it('headLook clamps upward to -30deg; target on neck is finite', () => {
    const p = createPose(rig); const w = solveWorld(rig, p); const h = rig.index.get('head');
    headLook(rig, p, w, w.x[h], w.y[h] - 100);
    expect(p.angle[h]).toBeCloseTo(-Math.PI / 6, 5);
    headLook(rig, p, w, w.x[h], w.y[h]);
    expect(Number.isFinite(p.angle[h])).toBe(true);
  });
  it('toRigSpace mirrors when facing left', () => {
    expect(toRigSpace(10, 20, 16, 0, -1)[0]).toBeGreaterThan(48);
    expect(toRigSpace(20, 20, 16, 0, 1)[0]).toBe(12);
  });
  it('mining puts the hand on the grip', () => {
    const p = createPose(rig);
    const w = applyOverlays(rig, p, { look: [90, 40], mining: true, pickAngle: 0.4, landVY: 0, squashT: 1 });
    const [gx, gy] = gripTarget(rig, w, 0.4); const h = rig.index.get('handF');
    expect(Math.hypot(w.x[h] - gx, w.y[h] - gy)).toBeLessThan(1);
    expect(boneTip(rig, w, h)).toBeDefined();
  });
  it('squash', () => { expect(squashOffset(300, 0)).toBe(5); expect(squashOffset(300, 0.2)).toBe(0); });
});
