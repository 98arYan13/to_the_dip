import { describe, it, expect } from 'vitest';
import { validateRigSave, rigSavePlugin } from '../vite/rigSavePlugin.js';

const clips = (d) => JSON.stringify({ idle: { loop: true, duration: d, keys: {} } });

describe('rig save validation', () => {
  it('accepts valid anims', () => expect(validateRigSave('anims.json', clips(1)).ok).toBe(true));
  it('rejects bad names', () => {
    expect(validateRigSave('../index.html', clips(1)).ok).toBe(false);
    expect(validateRigSave('rig.json.bak', '{"bones":[]}').ok).toBe(false);
  });
  it('rejects bad bodies', () => {
    expect(validateRigSave('anims.json', 'not json').ok).toBe(false);
    expect(validateRigSave('anims.json', clips(0)).ok).toBe(false);
    expect(validateRigSave('rig.json', '{}').ok).toBe(false);
  });
  it('only applies to serve', () => expect(rigSavePlugin().apply).toBe('serve'));
});
