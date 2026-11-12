import { describe, it, expect } from 'vitest';
import { AUDIO } from '../src/config.js';
import { degreeToSemis } from '../src/audio/Music.js';

describe('music themes', () => {
  it('degreeToSemis wraps into higher octaves', () => {
    expect(degreeToSemis([0, 2, 4, 7, 9], 5)).toBe(12);
    expect(degreeToSemis([0, 2, 4, 7, 9], 7)).toBe(16);
  });
  it('every layer has a valid theme', () => {
    for (const id of [0, 1, 2, 3, 4, 5, 9]) {
      const th = AUDIO.MUSIC.THEMES[id];
      expect(th.melody).toMatch(/^[0-9.]{16}$/);
    }
  });
});
