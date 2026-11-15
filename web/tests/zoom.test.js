import { describe, it, expect } from 'vitest';
import { viewScale } from '../src/render/Camera.js';
import { CAMERA, KEYBINDS, UI } from '../src/config.js';

describe('Zoom', () => {
  it('default zoom keeps the old integer pixel scale', () => {
    const z = CAMERA.ZOOM_LEVELS[CAMERA.ZOOM_DEFAULT];
    expect(z).toBe(1);
    expect(viewScale(1080, z)).toBe(2);
    expect(viewScale(844, z)).toBe(2);
  });
  it('zooming in shows fewer world px, zooming out more', () => {
    const h = 1080; const L = CAMERA.ZOOM_LEVELS;
    const viewH = (z) => h / viewScale(h, z);
    expect(viewH(L[L.length - 1])).toBeLessThan(viewH(1));
    expect(viewH(L[0])).toBeGreaterThan(viewH(1));
  });
  it('scale never drops below 0.5 on tiny screens', () => {
    expect(viewScale(200, CAMERA.ZOOM_LEVELS[0])).toBeGreaterThanOrEqual(0.5);
  });
  it('zoom has Input Map actions', () => {
    expect(KEYBINDS.zoomIn.length).toBeGreaterThan(0);
    expect(KEYBINDS.zoomOut.length).toBeGreaterThan(0);
  });
  it('enlarged minimap is bigger than the corner one', () => {
    expect(UI.MINIMAP_BIG_W).toBeGreaterThan(UI.MINIMAP_W);
    expect(UI.MINIMAP_BIG_H).toBeGreaterThan(UI.MINIMAP_H);
  });
});
