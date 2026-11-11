import { describe, it, expect } from 'vitest';
import { hardLandingDamage } from '../src/entities/Player.js';

describe('Hard landing', () => {
  it('is harmless up to the threshold', () => {
    expect(hardLandingDamage(3, 3, 1)).toBe(0);
  });
  it('deals at least 5 just past the threshold', () => {
    expect(hardLandingDamage(3.1, 3, 1)).toBe(5);
  });
  it('scales 18 per tile with sqrt(fall speed)', () => {
    expect(hardLandingDamage(5, 3, 1)).toBe(36);
    expect(hardLandingDamage(5, 3, 2)).toBe(Math.round(36 * Math.SQRT2));
  });
});
