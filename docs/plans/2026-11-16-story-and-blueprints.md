# Story, Challenges and Alien Blueprints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the web game a story ("The Deep Signal"), a mission line, alien ruins whose relics gate late techs, and a pulse-storm hazard.

**Architecture:** Everything is data-driven from `config.js` and a new `story.js`. Story progress is *derived from economy state* (owned techs, relics, flags), so a small `Story` system only has to re-check predicates after events. Ruins are one more deterministic zone pass in world generation; the pulse storm is a scheduler modelled on `Quake`.

**Tech Stack:** Vanilla JS (ES modules), Canvas, Vite, Vitest 2.1 (`npm test` inside `web/`).

**Spec:** `docs/superpowers/specs/2026-11-16-story-and-blueprints-design.md` — read it first; section numbers below refer to it.

## Global Constraints

- Work only in `web/`. Do not touch Godot files.
- All in-game text and identifiers are English.
- No new art files, no Gemini. New tiles use procedural colours (as Tungsten does).
- Static config objects stay `Object.freeze`d; pure rule functions are exported and unit-tested; classes wrap them with state and events (existing pattern in `Economy.js`, `Mining.js`).
- Never soft-lock: `rocketry` and every `key` tech must stay unlockable with zero relics.
- Existing zone positions for a given seed must not change.
- Do not `git commit` unless the user has explicitly allowed commits for this run. Each task ends with a "Checkpoint" step: run the full suite; commit only with that permission.
- Do not edit `web/TODO.md`.
- Dev server for manual checks: port 5273 (`.claude/launch.json`; add a config if the existing one uses another port).

## Review Focus

1. **Old save, already completed** — loading a pre-story save with `completed: true` must not lock owned techs or re-block the Core; migration grants relics (Task 2 test).
2. **Old save, world without ruins** — must load without errors, show the one-time "start a New Map" toast, and never spawn ruins over dug tunnels (Task 7 test for `hasRuins`).
3. **Relic destroyed or displaced** — bombs, falling sand, quakes, water and magma must leave the relic tile in place (Task 3 tests).
4. **New Map with relics already owned** — the ruin appears with no relic tile, and the tech stays unlockable (Task 3 test).
5. **Pulse while the terminal/menu is open or the player is dead** — no drain, no stun carried into the next life (Task 4 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/config.js` (modify) | `RELICS`, `TILE.ALIEN_HULL`/`TILE.RELIC` + materials, `ZONES.RUIN`, `HAZARD.PULSE`, `TECH` edits, `STORY`, achievements, `SAVE.VERSION` |
| `web/src/story.js` (create) | `LOG_ENTRIES`, `MISSIONS` (data only) |
| `web/src/systems/Story.js` (create) | predicates + `Story` class (flags, log unlocks, mission advance) |
| `web/src/systems/Hazards/Pulse.js` (create) | pulse scheduler |
| `web/src/world/Ruins.js` (create) | `planRuins`, `stampRuin`, `relicIdAt`, `clearOwnedRelics`, `hasRuins`, `nearestRuin` |
| `web/src/ui/LogScreen.js`, `web/src/ui/StoryModal.js` (create) | Log tab HTML, generic story modal |
| `systems/Tech.js`, `Economy.js`, `Mining.js`, `CoreGoal.js`, `Collectibles.js`, `Crafting.js`, `save/SaveSystem.js`, `world/WorldGen.js`, `entities/Player.js`, `entities/Dynamite.js`, `render/TileArt.js`, `ui/Shop.js`, `ui/TechScreen.js`, `ui/HUD.js`, `ui/Minimap.js`, `ui/Ending.js`, `audio/SFX.js`, `core/EventBus.js`, `main.js` (modify) | wiring |

New `EV` names (add all in Task 1): `TECH_UNLOCKED: 'tech:unlocked'` (payload id), `RELIC_FOUND: 'relic:found'` ({id}), `PULSE_WARN: 'pulse:warn'` ({seconds}), `PULSE: 'pulse'` ({sheltered}), `CORE_DENIED: 'core:denied'`, `CRAFTED: 'crafted'` (item id), `LOG_ENTRY: 'story:log'` ({id}), `MISSION_DONE: 'story:mission'` ({id}).

---

### Task 1: Relic data, tech-tree edits, relic gate

**Files:**
- Modify: `web/src/config.js` (TECH block ~391–444; add `RELICS` above it), `web/src/systems/Tech.js`, `web/src/core/EventBus.js`
- Test: `web/tests/tech.test.js`, `web/tests/techdata.test.js`, `web/tests/balance.test.js`

**Interfaces:**
- Produces: `RELICS` — frozen array of `{ id, name, layer }`, in order: `hull_shard` (layer 0), `shield_lattice` (1), `thermal_siphon` (2), `matter_loom` (3), `control_key` (4), `seed_core` (layer -1 = not in the world). `TECH[].relic?: string`. `canUnlock(economy, id)` returns `{ok:false, reason:'Requires relic: <name>'}` when `economy.relics` lacks it. `unlockTech` emits `EV.TECH_UNLOCKED` with the id on `economy.bus`. Stat name `pulseResist` (base 0).

- [ ] **Step 1: Write failing tests**

`tech.test.js`:
```js
it('a relic-gated tech needs its relic', () => {
  const ec = fakeEconomy({ tech: ['bloomery', 'solder', 'radio'], relics: [] }); // use the file's existing economy helper
  expect(canUnlock(ec, 'pulse_detector')).toEqual({ ok: false, reason: 'Requires relic: Hull Shard' });
  ec.relics.push('hull_shard');
  expect(canUnlock(ec, 'pulse_detector').ok).toBe(true);
});
it('pulse resistance stacks to 1', () => {
  expect(techStat(['faraday_shielding', 'pulse_hardening'], 'pulseResist', 0)).toBe(1);
});
```
`techdata.test.js`:
```js
it('every relic reference exists and each world relic gates a tech', () => {
  const rel = new Set(RELICS.map((r) => r.id));
  for (const t of TECH) if (t.relic) expect(rel.has(t.relic), t.id).toBe(true);
  for (const r of RELICS) expect(TECH.some((t) => t.relic === r.id), r.id).toBe(true);
});
it('key techs and rocketry never need a relic, directly or through requires', () => {
  const needsRelic = (id) => { const t = byId(id); return !!t.relic || t.requires.some(needsRelic); };
  for (const t of TECH) if (t.key) expect(needsRelic(t.id), t.id).toBe(false);
});
it('a relic is reachable by the era that needs it (spec 4.3)', () => {
  // layer host-rock tier = layer index + 1; the earliest tech needing the relic must be in an era whose pick digs that rock.
  for (const r of RELICS.filter((x) => x.layer >= 0)) {
    const era = Math.min(...TECH.filter((t) => t.relic === r.id).map((t) => t.era));
    expect(eraPickTier(era), r.id).toBeGreaterThanOrEqual(r.layer + 1);
  }
});
it('exotic materials moved to era 5', () => { expect(byId('exotic_materials').era).toBe(5); });
```
Note (spec 4.2): `electronics` has no relic dependency because `fission` (era-4 key) requires it; instead `faraday_shielding` is added to the `requires` of `charge_station`, `titanium_drill` and `precision`.

- [ ] **Step 2:** Run `npm test -- tech techdata` in `web/`. Expected: the new tests fail (unknown tech ids / `RELICS` undefined).

- [ ] **Step 3: Edit data** — add `RELICS`; add/change `TECH` entries exactly as spec 4.2 with the Step-1 correction. Starting costs (then tune cash only until `balance.test.js` passes its existing band rules):

| id | era | requires | relic | cost | effect |
|---|---|---|---|---|---|
| `pulse_detector` | 2 | `radio` | `hull_shard` | `tc(200, {COPPER_WIRE:4, SOLDER:2})` | `{unlock:'pulse_detector'}` |
| `faraday_shielding` | 3 | `blast_furnace` | `shield_lattice` | `tc(2400, {COPPER_WIRE:10, STAINLESS:4})` | `{stat:'pulseResist', add:0.5}` |
| `thermal_power` | 4 | `electronics` | `thermal_siphon` | `tc(28000, {ALUMINIUM:6, CIRCUIT:4, COPPER_WIRE:6})` | `{stat:'maxEnergy', mul:1.25}` |
| `pulse_hardening` | 5 | `faraday_shielding`, `carbon_fiber` | — | `tc(880000, {CARBON_FIBER:6, CIRCUIT:6})` | `{stat:'pulseResist', add:0.5}` |
| `exotic_materials` | 5 | `fission` | `matter_loom` | cash 880000, ores unchanged | — |
| `core_interface` | 5 | `exotic_materials` | `control_key` | `tc(900000, {EXOTIC_ALLOY:4, CIRCUIT:10, ENRICHED_URANIUM:4})` | `{unlock:'core_interface'}` |

Also: `heat_suit_2.requires += 'thermal_power'`; `warp_drive.relic = 'seed_core'`; new descriptions for the four space placeholders and `exotic_materials` (spec 4.2). Move the `exotic_materials` line into the era-5 block.

- [ ] **Step 4:** Implement the relic check in `canUnlock` (after the `requires` check, before affordability) and the `TECH_UNLOCKED` emit in `unlockTech`. Add all new `EV` names.

- [ ] **Step 5:** `npm test` — whole suite passes. If `progression.test.js` or `balance.test.js` model the unlock order, give their simulated economy all relics.

- [ ] **Step 6: Checkpoint.**

---

### Task 2: Economy state and save migration

**Files:**
- Modify: `web/src/systems/Economy.js` (`createEconomyState`, `load`, `toJSON`), `web/src/save/SaveSystem.js` (`migrate`), `web/src/config.js` (`SAVE.VERSION` +1)
- Test: `web/tests/economy.test.js`, `web/tests/save.test.js`

**Interfaces:**
- Produces: `economy.relics: string[]`; `economy.story: { seen: string[], read: string[], flags: string[], mission: number }` (fresh: all empty, `mission: 0`). Both survive `toJSON`/`load` and `newMapState()`. `migrateEconomyV6(ec)` exported from `SaveSystem.js`.

- [ ] **Step 1: Failing tests**
```js
it('relics and story round-trip and survive New Map', () => {
  const e = new Economy(bus); e.relics.push('hull_shard'); e.story.flags.push('sold'); e.story.mission = 3;
  const n = new Economy(bus, e.newMapState());
  expect(n.relics).toEqual(['hull_shard']); expect(n.story).toEqual({ seen: [], read: [], flags: ['sold'], mission: 3 });
});
it('v6 migration: fresh fields', () => {
  expect(migrateEconomyV6({ tech: ['bloomery'] })).toMatchObject({ relics: [], story: { seen: [], read: [], flags: [], mission: 0 } });
});
it('v6 migration: a completed save owns every relic and the interface', () => {
  const e = migrateEconomyV6({ completed: true, tech: ['heat_suit'] });
  expect(e.relics).toEqual(RELICS.map((r) => r.id));
  expect(e.tech).toContain('core_interface');
});
it('v6 migration: owning a relic-gated tech grants that relic', () => {
  expect(migrateEconomyV6({ tech: ['exotic_materials', 'warp_drive'] }).relics.sort()).toEqual(['matter_loom', 'seed_core']);
});
```
- [ ] **Step 2:** run, expect failures. **Step 3:** implement; add the `from === 5` branch in `migrate` (use the actual current version number). Owned techs are never removed. **Step 4:** `npm test` passes. **Step 5: Checkpoint.**

---

### Task 3: Alien ruins in the world

**Files:**
- Create: `web/src/world/Ruins.js`
- Modify: `web/src/config.js` (`TILE`, `MATERIALS`, `ZONES`), `web/src/world/WorldGen.js:167-173`, `web/src/systems/Mining.js` (`dynamiteOutcome`, `breakTile`, `blast`), `web/src/entities/Dynamite.js` (pass `big`), `web/src/render/TileArt.js`, `web/src/main.js` (after world creation)
- Test: `web/tests/ruins.test.js` (new), `web/tests/mining.test.js`, `web/tests/worldgen.test.js`

**Interfaces:**
- Consumes: `RELICS` (Task 1), `economy.relics` (Task 2), `planZones`, `coreChamber`, `overlaps`-style logic from `Zones.js` (export `overlaps` and the `blocked` list builder if needed).
- Produces (all in `Ruins.js`):
  - `planRuins(seed, W, H): {layer:number, x, y, w, h}[]` — exactly one per `ZONES.LAYERS` entry, size `ZONES.RUIN.SIZE = [9, 6]`, RNG stream `seed ^ 0x7a11`, placed after and never overlapping (pad 3) any `planZones` zone or blocked area.
  - `stampRuin(d, r)` — same `d` shape as `stampZone`.
  - `relicIdAt(y, H): string|null` — relic id for the layer containing row `y`.
  - `clearOwnedRelics(world, relics: string[]): void` — turns `TILE.RELIC` tiles of owned relics into air.
  - `hasRuins(world): boolean` — any `TILE.ALIEN_HULL` tile.
  - `nearestRuin(seed, W, H, relics, tx, ty): {x, y}|null` — centre of the nearest ruin whose relic is not owned.
- Config: `TILE.ALIEN_HULL`, `TILE.RELIC` = next two free ids. Materials: `ALIEN_HULL` `{hp: 65535, tier: 99, hard: 9, solid: true, sfx: 'clink', colors: base '#3a2a5c', dark '#1e1433', light '#6a4ea8', accent '#b08cff', extra '#120b20'}`; `RELIC` `{hp: 12, tier: 1, hard: 9, solid: true, sfx: 'clink', colors: base '#2ac0d0', dark '#156068', light '#a0f8ff', accent '#ffffff', extra '#0b3034'}`. `hard: 9` keeps both out of quake rockfall (`WEAK_MAX_HARD 1.2`).
- `dynamiteOutcome(type, ore, pickTier, big = false)`: `RELIC` → keep always; `ALIEN_HULL` → destroy only when `big`. `Mining.blast(tx, ty, r, big = false)`; the Big Bomb's blast call passes `true`.
- `Mining.breakTile`: when the broken tile was `TILE.RELIC`, push `relicIdAt(y, H)` to `economy.relics` (if absent) and emit `EV.RELIC_FOUND {id}`.

Stamp rules (spec 5.1): ring = `ALIEN_HULL`; in layers 0, 1, 2, 4 the two lowest non-corner tiles of the left wall are host rock (`d.band`); interior fill by layer: 0 `SAND`, 1 `WATER` with fluid `HAZARD.FLUID.MAX`, 2 air with gas `GAS.MAX`, 3 air, 4 like `lava_lake` (`MAGMA` + fluid max from interior row 2 down, air above); the relic tile sits at the middle of the bottom interior row and replaces the fill there. Layers 2 and 4 also get the two-tile `approach` tunnel that `stampZone` gives gas caverns.

- [ ] **Step 1: Failing tests** (`ruins.test.js`)
```js
const seeds = Array.from({ length: 50 }, (_, k) => 1000 + k * 7919);
it('one ruin per layer, inside its layer band, clear of zones and the core', () => {
  for (const s of seeds) {
    const rs = planRuins(s, WORLD.W, WORLD.H); const zs = planZones(s, WORLD.W, WORLD.H);
    expect(rs.map((r) => r.layer)).toEqual([0, 1, 2, 3, 4]);
    for (const r of rs) for (const z of zs) expect(rectsOverlap(r, z, 3), `seed ${s}`).toBe(false);
  }
});
it('existing zones are unchanged', () => { expect(planZones(12345, WORLD.W, WORLD.H)).toMatchSnapshot(); }); // record the snapshot BEFORE editing Zones.js
it('each generated world has exactly five relic tiles, one per layer', () => {
  const w = generateWorld(4242); const ids = [];
  for (let i = 0; i < w.tileType.length; i++) if (w.tileType[i] === TILE.RELIC) ids.push(relicIdAt((i / w.W) | 0, w.H));
  expect(ids.sort()).toEqual(['control_key', 'hull_shard', 'matter_loom', 'shield_lattice', 'thermal_siphon']);
});
it('layer 3 ruin has a full hull ring; the others have a 2-tile rock breach', () => { /* count ALIEN_HULL on each ring: 26 vs 24 */ });
it('owned relics are removed on a new map', () => {
  const w = generateWorld(4242); clearOwnedRelics(w, ['hull_shard']);
  /* expect 4 RELIC tiles left and none in layer 0 */
});
it('hasRuins is false for a world generated without the ruin pass', () => { /* zero out ALIEN_HULL, expect false */ });
```
`mining.test.js`:
```js
it('hull resists everything but a big bomb; the relic resists every bomb', () => {
  expect(canMine(TILE.ALIEN_HULL, 0, 6)).toBe(false);
  expect(dynamiteOutcome(TILE.ALIEN_HULL, 0, 6)).toBe(DYN_KEEP);
  expect(dynamiteOutcome(TILE.ALIEN_HULL, 0, 1, true)).toBe(DYN_DESTROY);
  expect(dynamiteOutcome(TILE.RELIC, 0, 6, true)).toBe(DYN_KEEP);
  expect(canMine(TILE.RELIC, 0, 1)).toBe(true);
});
it('breaking a relic tile records it once and emits RELIC_FOUND', () => { /* Mining with a stub world/economy/bus */ });
```
Review-focus test (relic displaced): in `collapse.test.js` add "a RELIC tile with air below is never marked unstable / never falls"; fix `Collapse` if it fails. Fluids already treat solid tiles as walls — add one assertion in `hazards.test.js` that a fluid step leaves a `RELIC` tile's type unchanged.

- [ ] **Step 2:** run, expect failures. **Step 3:** implement `Ruins.js`, config, Mining/Dynamite changes; call ruins after `stampZone` loop and before `stampCore` in `WorldGen.js`. Add procedural tile colours in `TileArt.js` following how a material without `tiles` (e.g. `MANTLE`) is drawn; give `RELIC` the same glow path Uranium/ore glints use if one exists.
- [ ] **Step 4:** in `main.js`, right after the world is created for a *new* map (not a loaded one), call `clearOwnedRelics(world, economy.relics)` and recompute HP for cleared tiles.
- [ ] **Step 5:** `npm test` passes (update `worldgen.test.js` snapshots/hashes only if they hash the whole grid; zone positions must be identical). **Step 6: Checkpoint.**

---

### Task 4: Pulse storm

**Files:**
- Create: `web/src/systems/Hazards/Pulse.js`
- Modify: `web/src/config.js` (`HAZARD.PULSE`), `web/src/main.js` (construct next to `quake` ~line 110, update next to `quake.update` ~line 555, radar use ~line 397), `web/src/entities/Player.js:131,176`, `web/src/ui/HUD.js`, `web/src/audio/SFX.js`
- Test: `web/tests/pulse.test.js` (new)

**Interfaces:**
- Config: `HAZARD.PULSE = { SAFE_DEPTH_M: 150, WARN_S: 5, MIN_GAP_S: 150, MAX_GAP_S: 360, DRAIN_FRAC: 0.25, STUN_S: 6 }`.
- Produces: `class Pulse { constructor(bus, rng, economy); update(dt, depthM, sheltered): void; stun: number /* seconds left */; reset(): void }` and pure `pulseEffect(resist): { drainFrac, stunS }` = `DRAIN_FRAC*(1-r)`, `STUN_S*(1-r)` with `r` clamped 0..1.
- Behaviour: scheduling as `Quake.update` (timer, `_gap` shortening with depth, warn countdown). Warn seconds = `WARN_S * (economy.tech.includes('pulse_detector') ? 2 : 1)`; emits `PULSE_WARN {seconds}`. On fire emits `PULSE {sheltered}`; if not sheltered sets `this.stun = pulseEffect(resist).stunS` and calls `this.onDrain(drainFrac)` (hook set by `main.js` → `energy.drain(drainFrac * maxEnergy)`). `resist = economy.stat('pulseResist', 0)`. Timer does not run above `SAFE_DEPTH_M`. `reset()` (called on `EV.PLAYER_DEAD` and `EV.NEW_GAME`) zeroes `stun` and cancels a pending warning.
- `main.js`: `sheltered = onSurface || nearShop || atCamp` (variables already computed ~line 545); `player.gearOffline = pulse.stun > 0`. Pulse is updated inside the same gated step as `quake.update`, so it is frozen while a modal is open.
- `Player.js`: `jetting` also requires `!this.gearOffline`; a powered pick strikes as if flat while `gearOffline`. Radar use in `main.js` is refused with hint "Electronics offline" while offline.
- HUD: on `PULSE_WARN` show a countdown banner "PULSE INCOMING — n s"; on `PULSE` unsheltered a brief white flash and "Electronics offline" until stun ends. SFX: rising hum on warn, crack on pulse (synthesised like the quake rumble).

- [ ] **Step 1: Failing tests**
```js
it('effect scales with resistance', () => {
  expect(pulseEffect(0)).toEqual({ drainFrac: 0.25, stunS: 6 });
  expect(pulseEffect(0.5)).toEqual({ drainFrac: 0.125, stunS: 3 });
  expect(pulseEffect(1)).toEqual({ drainFrac: 0, stunS: 0 });
});
it('never fires above the safe depth', () => { /* update 10 000 s at depth 100: no PULSE_WARN */ });
it('warns, then fires, drains and stuns when unsheltered', () => { /* depth 400, step until PULSE: onDrain called with 0.25, stun === 6 */ });
it('does nothing when sheltered', () => { /* PULSE {sheltered:true}, onDrain not called, stun 0 */ });
it('detector doubles the warning', () => { /* PULSE_WARN payload seconds 10 */ });
it('reset clears stun and a pending warning', () => {});
```
- [ ] **Step 2–4:** fail → implement → `npm test` passes. **Step 5: Checkpoint.**

---

### Task 5: Core goal gate

**Files:** Modify `web/src/systems/CoreGoal.js`; Test `web/tests/progression.test.js` (or a new `coregoal.test.js`)

**Interfaces:** `update` order: outside chamber → reset `denied`; no `core_interface` → `hold = 0`, emit `EV.CORE_DENIED` once per chamber entry, return (no death); then the existing heat-suit check. `complete()` also adds `'seed_core'` to `economy.relics`.

- [ ] **Step 1: Failing tests**
```js
it('without the interface the hold never starts and nobody dies', () => { /* 30 s in chamber: completed false, onFail not called, CORE_DENIED emitted exactly once */ });
it('with interface + heat suit the hold completes and grants the seed core', () => { /* HOLD_S seconds → completed, relics includes 'seed_core' */ });
```
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 6: Story data and system

**Files:**
- Create: `web/src/story.js`, `web/src/systems/Story.js`
- Modify: `web/src/config.js` (`STORY`), `web/src/systems/Crafting.js` (emit `EV.CRAFTED` with the output item id from `craft`), `web/src/main.js` (construct after `Collectibles`)
- Test: `web/tests/story.test.js` (new)

**Interfaces:**
- `STORY = { REWARD_BY_CHAPTER: [10, 30, 250, 3000, 80000, 0] }` (index = chapter − 1).
- `story.js`: `LOG_ENTRIES: {id, chapter, title, text, when, modal?: true}[]` and `MISSIONS: {id, chapter, text, when}[]`, where `when` is exactly one of `{start:true}`, `{tech:id}`, `{relic:id}`, `{flag:name}`, `{depthM:n}`, `{completed:true}`. Content: the 15 log rows of spec 7.2 (texts verbatim; ids as listed; `modal: true` on `intro`, the five `relic_*` entries and nothing else — the ending has its own screen) and the 19 mission rows of spec 7.3 in that order. Mapping of non-obvious triggers: "first ore sold" → `{flag:'sold'}`; "first pulse survived" → `{flag:'pulse'}`; "first Exotic Alloy crafted" → `{flag:'exotic'}`; `core_denied` → `{flag:'core_denied'}`; `ch3_quakes` → `{depthM: HAZARD.QUAKE.SAFE_DEPTH_M}`; `ch6_relays` → mission/entry `when: {tech:'rocketry'}` and listed after the `completed` one so order enforces both.
- `Story.js`:
  - `met(when, ec): boolean` — pure; `depthM` reads `ec.collect.maxDepth`; `start` is always true.
  - `currentMission(ec): mission|null` — `MISSIONS[ec.story.mission]`.
  - `class Story { constructor(bus, economy); sync(silent = false): void; markRead(id): void; pendingModals(): entry[] }`.
  - `sync`: (a) every entry with `met` and not in `story.seen` is added; unless `silent`, emit `LOG_ENTRY {id}` and a toast `New log entry: <title>` for non-modal ones; (b) while the current mission is `met`: add `REWARD_BY_CHAPTER[chapter-1]` credits, emit `CREDITS_CHANGED` and `MISSION_DONE {id}`, toast `Objective complete: <text>` (not when silent), increment `story.mission`.
  - Flag setters: `SOLD` → `sold`; `PULSE` with `sheltered:false` → `pulse`; `CRAFTED` of `ITEM.EXOTIC_ALLOY` → `exotic`; `CORE_DENIED` → `core_denied`. After setting a flag, and on `TECH_UNLOCKED`, `RELIC_FOUND`, `DEPTH_CHANGED`, `COMPLETED`: call `sync()`.
  - `pendingModals()`: seen entries with `modal` not in `story.read`, oldest first.
- `main.js`: `const story = new Story(bus, economy); story.sync(loaded.ok)` — silent for loaded saves, so an old save catches up without a toast flood but still gets its rewards.

- [ ] **Step 1: Failing tests**
```js
it('data is well-formed', () => {
  // unique ids; every tech/relic id in a `when` exists; chapters 1..6; MISSIONS.length === 19; LOG_ENTRIES.length === 15
});
it('fresh game: intro is seen and the first mission is selling ore', () => {
  const s = new Story(bus, ec); s.sync();
  expect(ec.story.seen).toEqual(['intro']); expect(currentMission(ec).id).toBe(MISSIONS[0].id);
});
it('selling advances the mission and pays the chapter-1 reward once', () => {
  bus.emit(EV.SOLD, { total: 5 }); expect(ec.story.mission).toBe(1); expect(ec.credits).toBe(10);
  bus.emit(EV.SOLD, { total: 5 }); expect(ec.credits).toBe(10);
});
it('missions advance in order even when a later one is met first', () => {
  ec.relics.push('hull_shard'); s.sync(); expect(ec.story.mission).toBe(1); // still waiting for bloomery
  ec.tech.push('bloomery'); s.sync(); expect(ec.story.mission).toBe(3);      // bloomery + shard both done
});
it('relic entries wait as modals until read', () => {
  bus.emit(EV.RELIC_FOUND, { id: 'hull_shard' });
  expect(s.pendingModals().map((e) => e.id)).toEqual(['intro', 'relic_hull_shard']);
  s.markRead('intro'); s.markRead('relic_hull_shard'); expect(s.pendingModals()).toEqual([]);
});
it('silent sync catches up without toasts', () => { /* ec with 10 techs: no TOAST emitted, mission > 0 */ });
```
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 7: Story UI

**Files:**
- Create: `web/src/ui/StoryModal.js`, `web/src/ui/LogScreen.js`
- Modify: `web/src/ui/Shop.js` (tab list ~44–52, render switch ~131–138), `web/src/ui/TechScreen.js`, `web/src/ui/HUD.js`, `web/src/ui/Ending.js`, `web/src/main.js` (pause gate ~line 488, `SHOP_OPEN` ~line 340, startup)
- Test: `web/tests/story.test.js` (render functions are pure string builders)

**Interfaces:**
- `class StoryModal { constructor(root, {onClose}); show(title, text, buttonLabel = 'Continue'): void; open: boolean }` — same markup/classes as `Ending` (`modal`, `modal-box`); paragraphs split on blank lines; closes on button, Enter or Escape. Add `storyModal.open` to the pause gate in `main.js`.
- `renderLog(economy): string` — top: "Objective" block (current mission text, or "All objectives complete"), then completed missions (ticked), then seen log entries newest first as `<article>` with chapter label, title, text; unread ones carry class `unread`. Opening the tab marks all non-modal entries read.
- Shop: new tab button `Log` (`data-tab="log"`) placed first, with a dot when anything is unread.
- Modal flow in `main.js`: on startup and on every `EV.SHOP_OPEN`, show `story.pendingModals()` one after another (relic entries titled `RELIC DECODED — <name>`, intro titled `THE DEEP SIGNAL`, button `Begin`), calling `story.markRead(id)` on close.
- `TechScreen` side panel: for a tech with `relic`, a line `Relic: <name> — found ✓` or `Relic: <name> — not found (ruin in layer <n+1>)` (`seed_core`: `— shut down the Seed`); node colour grey when missing.
- HUD: one-line objective under the depth readout, updated on `MISSION_DONE` and at start: `▸ <mission text>`.
- `Ending`: title `THE SEED IS SILENT`, body = text of log entry `ending` + the existing reward line, button unchanged.
- Old-save notice: at startup `if (loaded.ok && !hasRuins(world) && economy.relics.length < 5 && !economy.story.flags.includes('no_ruins_notice'))` → toast "Signals detected — start a New Map to find alien ruins." and set that flag.

- [ ] **Step 1: Failing tests**
```js
it('log shows the current objective and unread marks', () => {
  const html = renderLog(ecWith({ seen: ['intro', 'ch1_tools'], read: ['intro'], mission: 1 }));
  expect(html).toContain(MISSIONS[1].text); expect(html).toContain('unread');
  expect(html.indexOf('ch1_tools')).toBeLessThan(html.indexOf('"intro"')); // newest first; entries carry data-id
});
it('tech panel names a missing relic and its layer', () => {
  expect(renderTech(ecWith({}), { era: 3, selected: 'faraday_shielding' })).toContain('not found (ruin in layer 2)');
}); // adapt the second argument to renderTech's real view object
```
- [ ] **Step 2–4:** fail → implement → `npm test` passes. **Step 5: Checkpoint.**

---

### Task 8: Feats and ruin ping

**Files:** Modify `web/src/config.js` (`ACHIEVEMENTS`), `web/src/systems/Collectibles.js`, `web/src/ui/Minimap.js`, `web/src/main.js`; Test `web/tests/collectibles.test.js` (new)

**Interfaces:**
- `Collectibles` constructor gains a third argument `ctx: { ruinRect(layer): {x,y,w,h}, waterIn(rect): number }` (built in `main.js` from `planRuins(seed, …)` and `world.fluid`/`tileType`). New `handle` events and achievement test shapes:
  - `{event:'relic', count:n}` — `economy.relics` without `seed_core` has ≥ n → `relic_first` (1), `relic_all` (5).
  - `{event:'relic', id:'thermal_siphon', unlessFlag:'hall_exploded'}` → `clean_air`. The flag is set in `economy.story.flags` when `EV.EXPLOSION {x,y}` lands inside or within 2 tiles of the layer-2 ruin rect (payload is in pixels or tiles — check the emitter).
  - `{event:'relic', id:'shield_lattice', dry:true}` → `dry_feet` when `ctx.waterIn(ruinRect(1)) === 0` at pickup.
  - `{event:'pulse', count:10}` → `pulse_10`; count kept in `economy.collect.pulses` (unsheltered pulses only).
  - `{event:'tech', stat:'pulseResist', min:1}` → `immune`.
  - Existing `core` achievement: name `The Seed Is Silent`, desc `Shut down the Seed.` (id unchanged).
- Minimap: when `economy.tech.includes('pulse_detector')`, draw a violet blinking marker at `nearestRuin(...)`; clamp to the minimap edge when out of view.

- [ ] **Step 1: Failing tests** — one per feat: award fires once under the condition; `clean_air` is not awarded after an explosion in the hall; `dry_feet` is not awarded with water left; `pulse_10` needs ten unsheltered pulses; `relic_all` ignores `seed_core`.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 9: Play-through verification

No code unless a check fails (then fix under the owning task's tests).

- [ ] `npm test` and `npm run build` in `web/` both succeed.
- [ ] Start the dev server on 5273 through the preview tool. Fresh slot: intro modal appears once; HUD shows "Sell your first load of ore".
- [ ] Use the Dev panel to reach the layer-1 ruin: hull is unmineable, breach is diggable, sand pours out, mining the relic toasts and — on opening the terminal — shows the decode modal; `pulse_detector` becomes unlockable; Tech panel shows "found ✓".
- [ ] Below 150 m a pulse warns, drains 25% battery outside camp, does nothing inside a Field Camp.
- [ ] Layer-4 ruin: dynamite does nothing to the hull; a Big Bomb opens it; the relic survives the blast.
- [ ] Core chamber without `core_interface`: toast, no death, log entry `core_denied`. With it (dev-grant tech + heat suit): hold completes, new ending text, `warp_drive` shows relic found.
- [ ] Load a save made before this change: no errors in the console, the "Signals detected" toast appears once.
- [ ] Settings → New Map (keep progress) with `hull_shard` owned: layer-1 ruin has no relic tile.
- [ ] Take screenshots of the intro modal, a ruin, the Log tab and the pulse warning for the user.
