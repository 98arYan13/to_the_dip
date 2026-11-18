import { describe, it, expect } from 'vitest';
import { ORE, ITEM, TECH, MATERIAL_INPUTS } from '../src/config.js';
import { oreNeed } from '../src/world/gen/need.js';

describe('oreNeed', () => {
  it('need matches the hand count for meteorite and diamond on Earth', () => {
    const n = oreNeed('earth');
    // meteorite: exotic_materials 4 + core_interface 4 EXOTIC_ALLOY x2 + jetpack IV 2 EXOTIC_ALLOY x2 = 16 (costs rechecked after the cost change)
    expect(n[ORE.METEORITE]).toBe(16);
    // diamond: diamond_tooling 4 + diamond drill 4 INDUSTRIAL_DIAMOND + radar III 2 = 10
    expect(n[ORE.DIAMOND]).toBe(10);
    expect(n[ORE.LAPIS]).toBeUndefined();
  });
  it('era-7 megaprojects are not counted on Earth', () => {
    const n = oreNeed('earth');
    // warp_drive + interstellar + rig 5 alone would need 10+20+4 alloy = 68 meteorite
    expect(n[ORE.METEORITE]).toBeLessThan(68);
    expect(TECH.find((t) => t.id === 'warp_drive').era).toBe(7);
    expect(MATERIAL_INPUTS[ITEM.EXOTIC_ALLOY][ORE.METEORITE]).toBe(2);
  });
});
