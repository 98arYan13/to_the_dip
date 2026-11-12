import { describe, it, expect } from 'vitest';
import { createPose } from '../src/anim/Rig.js';
import { sampleClip, blendPose, clipEnded } from '../src/anim/Clip.js';
import { realRig } from './rig.test.js';

const rig = realRig();
const I = rig.index.get('torso');
const s = (clip, t) => sampleClip(clip, t, rig, createPose(rig)).angle[I];

describe('Clip', () => {
  const two = { loop: false, duration: 1, keys: { torso: [[0, 0], [1, 90]] } };
  it('interpolates', () => expect(s(two, 0.5)).toBeCloseTo(Math.PI / 4, 5));
  it('loop wraps last key toward first', () => {
    const c = { loop: true, duration: 1, keys: { torso: [[0, 0], [0.5, 90]] } };
    expect(s(c, 0.75)).toBeCloseTo(Math.PI / 4, 5);
    expect(s(c, 1.25)).toBeCloseTo(s(c, 0.25), 6);
  });
  it('one-shot clamps', () => { expect(s(two, 5)).toBeCloseTo(Math.PI / 2, 5); expect(clipEnded(two, 1)).toBe(true); });
  it('step holds', () => expect(s({ loop: false, duration: 1, keys: { torso: [[0, 10, 0, 0, 'step'], [1, 90]] } }, 0.9)).toBeCloseTo(10 * Math.PI / 180, 5));
  it('ignores unknown bones and empty keys', () => {
    const c = { loop: true, duration: 1, keys: { tail: [[0, 5]], head: [], torso: [[0, 30]] } };
    expect(s(c, 0.3)).toBeCloseTo(30 * Math.PI / 180, 5);
  });
  it('blendPose blends and clamps', () => {
    const a = createPose(rig); const b = createPose(rig); b.angle[0] = 4;
    expect(blendPose(a, b, 0.25, createPose(rig)).angle[0]).toBeCloseTo(1, 5);
    expect(blendPose(a, b, 2, createPose(rig)).angle[0]).toBe(4);
  });
});
