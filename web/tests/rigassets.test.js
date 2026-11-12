import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadRigAssets } from '../src/anim/loadRigAssets.js';

const file = (n) => readFileSync(new URL(`../public/rig/${n}`, import.meta.url), 'utf8');
const ok = (n, text = file(n)) => ({ ok: true, json: async () => JSON.parse(text) });

describe('loadRigAssets', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  it('loads real files', async () => {
    const r = await loadRigAssets(async (u) => ok(u.split('/').pop()));
    expect(r.rig.bones.length).toBe(15);
  });
  it('merges parts.json', async () => {
    const parts = JSON.stringify({ torso: { sprite: 'parts/torso.png', pivot: [3, 4] }, nope: { sprite: 'x.png', pivot: [0, 0] } });
    const r = await loadRigAssets(async (u) => { const n = u.split('/').pop(); return n === 'parts.json' ? ok(n, parts) : ok(n); });
    const t = r.rig.bones[r.rig.index.get('torso')];
    expect(t.sprite).toBe('parts/torso.png');
    expect(t.pivot).toEqual([3, 4]);
    expect(r.rig.bones[r.rig.index.get('head')].sprite).toBeUndefined();
  });
  it('null without parts.json', async () => {
    expect(await loadRigAssets(async (u) => (u.endsWith('parts.json') ? { ok: false, status: 404 } : ok(u.split('/').pop())))).toBeNull();
  });
  it('null on reject', async () => expect(await loadRigAssets(async () => { throw new Error('x'); })).toBeNull());
  it('null on invalid JSON / 404', async () => {
    expect(await loadRigAssets(async (u) => ok(u.split('/').pop(), u.endsWith('anims.json') ? 'nope' : undefined))).toBeNull();
    expect(await loadRigAssets(async () => ({ ok: false, status: 404 }))).toBeNull();
  });
});
