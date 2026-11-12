import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadRig, createPose, solveWorld, boneTip } from '../src/anim/Rig.js';

const chain = (over = {}) => ({ canvas: 96, angleStep: 10, bones: [
  { name: 'a', parent: null, x: 5, y: 5, rest: 90, length: 10, width: 2, layer: 2, color: '#000000' },
  { name: 'b', parent: 'a', x: 10, y: 0, rest: 0, length: 5, width: 2, layer: 0, color: '#000000' },
  { name: 'c', parent: 'b', x: 5, y: 0, rest: 0, length: 5, width: 2, layer: 1, color: '#000000' },
], ...over });
export const realRig = () => loadRig(JSON.parse(readFileSync(new URL('../public/rig/rig.json', import.meta.url), 'utf8')));

describe('Rig', () => {
  it('builds index and drawOrder sorted by layer', () => {
    const r = loadRig(chain());
    expect(r.index.get('c')).toBe(2);
    expect(r.drawOrder).toEqual([1, 2, 0]);
  });
  it('throws on missing parent or child before parent', () => {
    const d = chain(); d.bones[1].parent = 'zzz';
    expect(() => loadRig(d)).toThrow();
    const e = chain(); e.bones.reverse();
    expect(() => loadRig(e)).toThrow();
  });
  it('rest pose: child lands below a root rotated 90deg', () => {
    const r = loadRig(chain()); const w = solveWorld(r, createPose(r));
    expect(w.x[1]).toBeCloseTo(5, 5); expect(w.y[1]).toBeCloseTo(15, 5);
  });
  it('rotating root by +90deg moves child and adds to its angle', () => {
    const r = loadRig(chain()); const p = createPose(r); p.angle[0] = Math.PI / 2;
    const w = solveWorld(r, p);
    expect(w.x[1]).toBeCloseTo(-5, 4); expect(w.y[1]).toBeCloseTo(5, 4);
    expect(w.a[1]).toBeCloseTo(Math.PI, 5);
    expect(boneTip(r, w, 1)[0]).toBeCloseTo(-10, 4);
  });
  it('real rig has the 15 bones and feet on row 93', () => {
    const r = realRig();
    expect([...r.index.keys()].sort()).toEqual('hips torso head armB_upper armB_lower handB armF_upper armF_lower handF legB_thigh legB_shin footB legF_thigh legF_shin footF'.split(' ').sort());
    const w = solveWorld(r, createPose(r));
    for (const n of ['footB', 'footF']) expect(Math.abs(boneTip(r, w, r.index.get(n))[1] - 93)).toBeLessThanOrEqual(1.5);
  });
});
