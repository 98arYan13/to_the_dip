import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultOutfit, sanitizeOutfit, WEAR_KINDS } from '../src/anim/Outfit.js';
import { realRig } from './rig.test.js';

const items = JSON.parse(readFileSync(new URL('../public/rig/wearables.json', import.meta.url), 'utf8')).items;

describe('Outfit', () => {
  it('defaults', () => expect(sanitizeOutfit(undefined, items)).toEqual(defaultOutfit()));
  it('rejects unknown id and wrong kind; keeps null', () => {
    expect(sanitizeOutfit({ hat: 'crown' }, items).hat).toBe('helmet');
    expect(sanitizeOutfit({ hat: 'shirt_basic' }, items).hat).toBe('helmet');
    expect(sanitizeOutfit({ gloves: null }, items).gloves).toBeNull();
  });
  it('validates colours', () => {
    expect(sanitizeOutfit({ colors: { hat: 'red' } }, items).colors.hat).toBe('#e8e2d0');
    expect(sanitizeOutfit({ colors: { hat: '#A1b2C3' } }, items).colors.hat).toBe('#A1b2C3');
  });
  it('wearables.json uses valid kinds and bones', () => {
    const rig = realRig();
    for (const it of items) {
      expect(WEAR_KINDS).toContain(it.kind);
      for (const b of Object.keys(it.parts)) expect(rig.index.has(b)).toBe(true);
    }
  });
});
