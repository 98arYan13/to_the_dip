import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { snapAngle, buildDrawList } from '../src/anim/RigRenderer.js';
import { defaultOutfit } from '../src/anim/Outfit.js';
import { realRig } from './rig.test.js';

const rig = realRig();
const items = JSON.parse(readFileSync(new URL('../public/rig/wearables.json', import.meta.url), 'utf8')).items;
const idx = (list, name, kind) => list.findIndex((d) => d.bone === rig.index.get(name) && (!kind || d.kind === kind));

describe('RigRenderer helpers', () => {
  it('snapAngle', () => {
    expect(snapAngle(0.2, 10)).toBeCloseTo(Math.PI / 18, 6);
    expect(snapAngle(-0.09, 10)).toBeCloseTo(-Math.PI / 18, 6);
    expect(Math.abs(snapAngle(0.05, 10))).toBeCloseTo(0, 6);
  });
  it('draw order', () => {
    const l = buildDrawList(rig, defaultOutfit(), items);
    const torso = idx(l, 'torso', 'part');
    expect(idx(l, 'armB_upper')).toBeLessThan(torso); expect(idx(l, 'handB')).toBeLessThan(torso);
    expect(idx(l, 'armF_upper', 'part')).toBeGreaterThan(torso);
    expect(l.findIndex((d) => d.kind === 'jetpack')).toBeLessThan(torso);
    const pick = l.findIndex((d) => d.kind === 'pick');
    expect(pick).toBeGreaterThan(torso); expect(pick).toBeLessThan(idx(l, 'handF', 'part'));
    expect(idx(l, 'head', 'wear')).toBe(idx(l, 'head', 'part') + 1);
    expect(idx(l, 'handF', 'wear')).toBe(-1);
  });
});
