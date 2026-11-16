# World Generator Refactor (Earth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild map generation as a data-driven pipeline (planet profile → strata → caves → fluids → ores → set pieces → audit → repair) so every Earth seed is fair, with geology-driven cave styles and three new special caves.

**Architecture:** `generateWorld(seed, planetId)` stays the single pure entry point and becomes an orchestrator of small pure passes in `web/src/world/gen/`. All tunables live in a `PLANETS.earth` profile in `config.js`. After generation, three audits (ore, reachability, safety) measure the map against the tech tree and repair it; if repair fails the generator retries with a derived seed.

**Tech Stack:** Vanilla JS (ES modules), Vitest 2.1 (`npm test` in `web/`), Vite.

**Spec:** `docs/superpowers/specs/2026-11-16-planets-and-worldgen-design.md` (sections 4–7, 10–12). Read it first.

**Order:** Execute after Task 3 (ruins) of `docs/plans/2026-11-16-story-and-blueprints.md`. This plan moves ruins into the set-piece pass and retires that plan's "existing zones are unchanged" snapshot test.

## Global Constraints

- Work only in `web/`. English identifiers and text. No new art files; procedural colours.
- `generateWorld` stays pure and deterministic: same `(seed, planetId)` → identical arrays.
- Existing saves keep their stored world; nothing regenerates a loaded map.
- Map size on Earth stays 64 × 256. Do not hard-code `WORLD.H` in new code: take `W`, `H` from the data object.
- Spec numbers to use verbatim: ore floor `1.5 × need` (of which `1.0 × need` outside set pieces), ceiling `6 × need`; give-up after 8 attempts; open-space budgets soil 0–1%, limestone 8–12%, granite 3–5%, basalt 7–10%, mantle 4–6%; bisection max 8 steps; set-piece spacing 3 tiles; reward target 0.5–1.0 × `expectedTripIncome`.
- Do not `git commit` unless the user has allowed commits for this run. Each task ends with "Checkpoint": full `npm test`; commit only with that permission.
- Do not edit `web/TODO.md`.

## Review Focus

1. **A seed where repair cannot reach a floor** (host stratum nearly all cave) — must fall through to the retry rule and still return a valid world, never loop forever (Task 6 test).
2. **Daily seed** — two boots on the same day must produce the same map, including after retries (Task 6 determinism test with a seed known to retry).
3. **Loaded old world** — `decodeWorld` recomputes the band map from the seed; an old save has no `genSeed` and must still decode (Task 6 test).
4. **Balance model drift** — `expectedTripIncome` assumes ore weights; after repair the real mix must stay within ±25% of the model for tiers 1–5 (Task 5 test).
5. **Set piece on top of the shaft or pad** after adding larger pieces (`lava_tube` is 30 wide on a 64-wide map) — placement may fail; a missing optional piece is fine, a missing landmark or ruin is not (Task 4 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/config.js` | `PLANETS.earth`, `SET_PIECES`, `AUDIT` constants |
| `web/src/world/gen/strata.js` (new) | band starts + band map from a profile (moved from `WorldGen.js`) |
| `web/src/world/gen/caves.js` (new) | cave styles, open-space budget, cave rules |
| `web/src/world/gen/ores.js` (new) | vein placement (moved), top-up and trim helpers |
| `web/src/world/gen/need.js` (new) | `oreNeed(planetId)` from the tech tree |
| `web/src/world/gen/audit.js` (new) | ore, reachability and safety audits + repairs |
| `web/src/world/Zones.js` | set-piece planning/stamping driven by `SET_PIECES`; new kinds; signposts |
| `web/src/world/Ruins.js` | called from the set-piece pass (no logic change) |
| `web/src/world/WorldGen.js` | orchestrator; re-exports `computeBandStarts`, `bandMaterialAt`, `maxHPFor` for existing callers |
| `web/src/save/SaveSystem.js`, `web/src/world/World.js`, `web/src/main.js` | `genSeed` |

Shared data shape used by every pass (already the shape `stampZone` takes), called `d`:
`{ W, H, seed, planet, tileType, oreType, flags, fluid, gas, band, protect }` where `protect: Uint8Array` marks tiles no later pass may change (set pieces, core chamber).

---

### Task 1: Earth profile and pipeline skeleton

**Files:** Modify `config.js`, `world/WorldGen.js`; Create `world/gen/strata.js`, `world/gen/ores.js`; Test `tests/worldgen.test.js`, new `tests/planetdata.test.js`

**Interfaces — produces:**
- `PLANETS = { earth: { id, name, H: 256, gravity: 1, air: 'breathable', pulse: {mul: 1}, quake: {mul: 1}, hpMul: 1, strata: Stratum[], setPieces: {...}, relic: 'per-layer', goal: 'core' } }`.
- `Stratum = { tile, from, to, tier, hpMul?: number, cave: { style: 'none'|'karst'|'fissure'|'tube'|'pocket'|'corridor', open: [min, max], ...styleParams }, water: boolean, magma: boolean, gas: boolean }`. Earth strata copy `MATERIALS[*].band` and tiers exactly (spec 5.2); cave styles: soil `none`, limestone `karst`, granite `fissure`, basalt `tube`, mantle `pocket` (magma counts as open), core `none`.
- `strata.js`: `computeBandStarts(seed, W, H, planet = PLANETS.earth): Int16Array`, `bandMaterialAt(starts, x, y, W, planet = PLANETS.earth)`, `stratumIndexAt(starts, x, y, W, planet): number`.
- `ores.js`: `placeVeins(d, rng): void` (current step 3 moved verbatim), `countOres(d): Int32Array` (index = ore id).
- `generateWorld(seed, planetId = 'earth', W = WORLD.W, H = PLANETS[planetId].H)` — note the new second parameter; update the three callers that pass `W, H` positionally (tests, `World.generate`).

- [ ] **Step 1: Failing tests** (`planetdata.test.js`, runs for every entry of `PLANETS`)
```js
it('strata cover 0..1 without gaps and tiers rise by at most one', () => {
  for (const p of Object.values(PLANETS)) {
    expect(p.strata[0].from).toBe(0); expect(p.strata.at(-1).to).toBe(1);
    p.strata.forEach((s, k) => { if (k) { expect(s.from).toBe(p.strata[k - 1].to); expect(s.tier - p.strata[k - 1].tier).toBeLessThanOrEqual(1); expect(s.tier).toBeGreaterThanOrEqual(p.strata[k - 1].tier); } });
  }
});
it('every ore sits in at most two neighbouring strata and is at most one tier above its host', () => {
  // for each planet: strata indices hosting ore o are consecutive and ≤ 2; ORES[o].tier ≤ stratum.tier + 1
});
it('magma only in the two deepest strata; a stratum without water has no aquifer set piece', () => {});
```
`worldgen.test.js`: `generateWorld(s)` deep-equals `generateWorld(s, 'earth')`; result has `planet: 'earth'`.
- [ ] **Step 2:** run → fail. **Step 3:** add the profile, move code into `strata.js`/`ores.js`, keep behaviour identical for now (this task is a refactor: the pre-existing worldgen tests must still pass unchanged). If the ore-host rule test fails for an existing ore, fix the *test's* reading of hosts (hosts are band material ids), not the ore data.
- [ ] **Step 4:** `npm test` passes. **Step 5: Checkpoint.**

---

### Task 2: Cave styles and the open-space budget

**Files:** Create `world/gen/caves.js`; Modify `world/WorldGen.js` (step 1 no longer carves), `config.js` (cave params in the profile; remove now-unused `WORLD.CAVE_*` only if nothing else reads them); Test new `tests/caves.test.js`

**Interfaces — produces:**
- `carveCaves(d, starts, seed): void` — for each stratum, carve by its style, then enforce the budget.
- `openFraction(d, starts, k): number` — air + fluid tiles ÷ all tiles of stratum `k` (excluding bedrock border).
- Style fields (Earth starting values): `karst { fx: 0.05, fy: 0.16, shaftsPer64: 2, shaftLen: [8, 16] }`; `fissure { freq: 0.09, angleDeg: 30, width: 0.03 }`; `tube { count: [2, 4], len: [18, 34], radius: 1, slope: 0.15 }`; `pocket { freq: 0.22 }`; `corridor { rowGap: [6, 9], colGap: [8, 14], keep: 0.6 }` (unused on Earth, implemented here so plan 2 is data only).
- Budget: the style's threshold (or `width` / `keep` / tube `count`) is the one free parameter; bisect it up to 8 steps until `openFraction` is inside `open`; if still outside, take the closest step.

Algorithms the tests do not pin: `karst` = `fbm(noise, x*fx, y*fy, 4) > thr` plus vertical random-walk shafts 1 tile wide; `fissure` = `|fbm(noise, u*freq, v*freq, 2)| < width` with `(u, v)` rotated by `angleDeg`; `tube` = worms that step +x/−x with slope bias, carving a disc of `radius`, stopping at stratum edges and 3 columns from the camp shaft; `pocket` = high-frequency fbm above threshold; `corridor` = grid runs as spec 6.1.

- [ ] **Step 1: Failing tests**
```js
const seeds = Array.from({ length: 40 }, (_, k) => 77 + k * 104729);
it('every stratum lands inside its open-space budget', () => {
  for (const s of seeds) { const d = caveOnly(s); PLANETS.earth.strata.forEach((st, k) => {
    const f = openFraction(d, d.starts, k); expect(f, `seed ${s} stratum ${k}`).toBeGreaterThanOrEqual(st.cave.open[0] - 0.01); expect(f).toBeLessThanOrEqual(st.cave.open[1] + 0.01); }); }
});
it('karst caves are wider than tall; fissures are thin', () => {
  // mean horizontal run length of air in limestone ≥ 2 × mean vertical run length; in granite ≥ 80% of air tiles have a solid neighbour on both sides along the fissure normal
});
it('tubes are long: limestone-free basalt has at least one horizontal air run ≥ 12 tiles', () => {});
it('same seed → same caves', () => {});
```
(`caveOnly(seed)` = strata + `carveCaves` on a fresh `d`; build the helper in the test file.)
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 3: Cave rules and fluids

**Files:** Modify `world/gen/caves.js`, `world/WorldGen.js`; Test `tests/caves.test.js`

**Interfaces — produces:** `placeFluids(d, starts, seed): void` (water in strata with `water: true`, magma with `magma: true`, gas pockets with `gas: true` — moves and replaces the inline water/magma noise from `WorldGen.js`), and `applyCaveRules(d, starts): void` implementing spec 6.3.

- [ ] **Step 1: Failing tests** (40 seeds each)
```js
it('nothing is carved in the first CAVE_MIN_DEPTH rows or under the camp pad', () => {});
it('no cave within 2 columns of the camp shaft for the first 15% of depth', () => {});
it('no fluid or gas touches the shaft column in the first stratum', () => {});
it('a cave never reaches more than 2 rows into a harder stratum from above', () => {
  // for every air tile in stratum k that is connected (4-neighbour, through air only) to air in stratum k-1: its row ≤ starts[k] + 2
});
it('wide karst floors sometimes hold one tile of water, never more', () => {});
```
- [ ] **Step 2–4:** fail → implement (the fourth rule: after carving, fill with host rock any air tile deeper than 2 rows into stratum `k` whose only air connection is from above) → pass. **Step 5: Checkpoint.**

---

### Task 4: Set pieces

**Files:** Modify `config.js` (`SET_PIECES`, replaces `ZONES.BANDS/SIZE/LANDMARKS`; keep `ZONES.CORE_CHAMBER`), `world/Zones.js`, `world/Ruins.js` (called from here), `world/WorldGen.js`, `render/TileArt.js` (signpost decor flag if needed); Test `tests/zones.test.js` (new or existing zone tests), `tests/ruins.test.js`

**Interfaces — produces:**
- `SET_PIECES = { <kind>: { size: [w, h], strata: number[] /* stratum indices */, hazard: string, reward: 'ore'|'fossil'|'travel'|'none', landmarkOf?: number /* stratum index */, sign: 'moss'|'glint'|'glow'|'fleck'|'none' } }` for the seven existing kinds (sizes and bands as today, expressed as stratum indices) plus:
  - `karst_shaft` `{ size: [5, 16], strata: [1], hazard: 'fall', reward: 'ore', sign: 'moss' }` — 3-wide vertical void, bottom 2 rows water, walls 50% best ore of the host.
  - `lava_tube` `{ size: [26, 5], strata: [3], hazard: 'rockfall', reward: 'travel', sign: 'glint' }` — 3-high tunnel, floor 30% best ore, roof tiles flagged `FLAG.UNSTABLE` candidates (weak roof).
  - `magma_chamber` `{ size: [9, 7], strata: [4], hazard: 'magma', reward: 'ore', sign: 'glow' }` — magma on left, right and floor, air pocket in the middle, roof 70% best ore, approach tunnel.
- `planSetPieces(seed, W, H, planet): {kind, x, y, w, h}[]` — per stratum: its landmark (guaranteed: up to 200 attempts, then shrink search padding), 2 from its pool without repeating a kind in that stratum, then ruins via `planRuins`. Spacing 3; blocked areas as today. `planZones` stays as a thin alias so existing imports work.
- `stampSetPiece(d, z, rng)`; every stamped tile is marked in `d.protect`.
- `rewardValue(d, z): number` — sell value of ore inside the piece (exported for the test).
- Signposts: after stamping, for `sign !== 'none'` set 2–3 host-rock tiles just outside the wall: `moss` → `FLAG.MOSS`; `glint` → one ore tile of the piece's best ore; `glow` → one `MAGMA` tile sealed in rock; `fleck` (ruins) → nothing new if the hull glow already reads from outside, else one `ALIEN_HULL` tile detached by one tile.

- [ ] **Step 1: Failing tests** (50 seeds)
```js
it('each stratum has its landmark, at most one piece per kind, and its ruin', () => {});
it('pieces keep 3 tiles apart and stay off the shaft, pad and core chamber', () => {});
it('ore rewards are worth 0.5–1.0 trips of the era that reaches them', () => {
  // for kinds with reward 'ore': 0.5 ≤ rewardValue / expectedTripIncome(stratum.tier) ≤ 1.0  (tune ore density per kind to hit this)
});
it('gas and magma pieces keep their safe approach tunnel', () => {});
it('every signed piece has a sign tile within 3 tiles outside its wall', () => {});
it('a lava tube that cannot be placed is skipped without losing the landmark', () => {});
```
Delete the story plan's `planZones` snapshot test in the same change (spec section 10).
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 5: Ore need, audit and repair

**Files:** Create `world/gen/need.js`, `world/gen/audit.js`; Modify `world/gen/ores.js`, `config.js` (`AUDIT = { FLOOR: 1.5, FLOOR_OPEN: 1.0, CEIL: 6, MAX_ATTEMPTS: 8 }`, `PLANETS.earth.eras = [1, 2, 3, 4, 5]`); Test new `tests/need.test.js`, `tests/audit.test.js`, `tests/balance.test.js`

**Interfaces — produces:**
- `oreNeed(planetId): Record<number, number>` — sums, with materials expanded to raw ores through `MATERIAL_INPUTS`: `TECH[].cost.ores` for techs whose `era` is in the planet's `eras`; every `CAMP_BUILDINGS` level cost whose `tech` is absent or in those eras; every `PICKAXES` / `UPGRADES` level `recipe` whose `tech` is in those eras. Ores never used get no entry.
- `auditOres(d): { ore, have, haveOpen, floor, ceil }[]` — `haveOpen` counts tiles not in `d.protect`; `ceil = max(6 × need, modelShare)` where `modelShare` is what `placeVeins` targets for that ore.
- `repairOres(d, rng): boolean` — top-up: add veins (same random-walk rule, lower half of the ore's deeper host stratum, never in `protect`) until `haveOpen ≥ 1.0 × need` and `have ≥ 1.5 × need`; trim: ores above `ceil` lose the tiles farthest (Manhattan) from the camp shaft top. Returns whether all floors are met afterwards.
- `ores.js`: `addVein(d, ore, rng, region): number`, `removeOre(d, i): void`.

- [ ] **Step 1: Failing tests**
```js
it('need matches the hand count for meteorite and diamond on Earth', () => {
  const n = oreNeed('earth');
  expect(n[ORE.METEORITE]).toBe(16); // exotic_materials 4 + core_interface 4 alloy×2 + jetpack IV 2 alloy×2
  expect(n[ORE.DIAMOND]).toBe(10);   // diamond_tooling 4 + diamond drill 4 + radar III 2
  expect(n[ORE.LAPIS]).toBeUndefined();
});
it('era-6 megaprojects are not counted on Earth', () => { /* need excludes warp_drive, interstellar, rig 5 */ });
it('after repair every needed ore is between floor and ceiling (60 seeds)', () => {});
it('repair never writes into a protected tile and never changes tiles that were fine', () => {});
it('real ore mix stays within 25% of the balance model for tiers 1–5 (60-seed mean)', () => {
  // value-per-kg of the generated mix per host stratum vs weightedValuePerKg(tier, band)
});
```
If the story plan changed costs, recompute the two hand counts from `config.js` before writing the assertion — the rule is the definition above, the numbers are a check.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 6: Reachability, safety, retry and `genSeed`

**Files:** Modify `world/gen/audit.js`, `world/WorldGen.js`, `world/World.js`, `save/SaveSystem.js`, `main.js`; Test `tests/audit.test.js`, `tests/save.test.js`, `tests/worldgen.test.js`

**Interfaces — produces:**
- `reachable(d, maxTier, { magma = false } = {}): Uint8Array` — BFS from the tile under the camp shaft top; passable = non-solid, or solid with `requiredTier ≤ maxTier` and not `ALIEN_HULL`/`BEDROCK`; magma tiles passable only when `magma` is true.
- `auditReach(d, starts): string[]` (empty = fine) checking spec 7.2: top row of stratum `k` reachable with `strata[k].tier`; each ruin's breach (or outer hull for the sealed one) reachable with its stratum tier; goal chamber reachable with tier 6 and `magma: true`.
- `repairReach(d, starts): void` — carve a one-tile vertical fault of host rock of the stratum's own tier (i.e. replace harder rock, never create air) through the blocker at the column nearest `SHAFT_X` that is not protected.
- `auditSafety(d, starts): string[]`, `repairSafety(d, starts): void` — spec 7.3.
- `generateWorld` loop: build → audits → repairs → re-audit; on failure retry with `genSeed = hash2(seed, attempt, 0x9e11)` for `attempt = 1..8`; keep the attempt with the fewest remaining problems. Returns `{ ..., seed, genSeed, planet, problems: string[] }`.
- Save: `serialize` stores `genSeed`; `decodeWorld` uses `genSeed ?? seed` for the band map; `World` exposes `genSeed`.

- [ ] **Step 1: Failing tests**
```js
it('200 Earth seeds: no reachability or safety problems remain', () => {});
it('fewer than 2% of 200 seeds needed a retry', () => {});
it('a world forced to retry is still deterministic', () => { /* stub the first attempt to fail via a test hook option { forceRetry: 1 } */ });
it('retry is bounded: with every attempt failing, generateWorld returns after 8 with problems listed', () => {});
it('save round-trip keeps genSeed; a save without genSeed decodes with seed', () => {});
it('repairReach makes rock softer, never opens air', () => {});
```
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 7: Fairness suite and play check

- [ ] Add `tests/fairness.test.js`: for 200 seeds on Earth assert, in one pass per seed, everything from spec section 11 "Fairness" (ore floors/ceilings, reachability, safety, budgets, one landmark + one ruin per stratum). Keep it under 20 s total; if slower, drop to 120 seeds and say so in the test name.
- [ ] `npm test` and `npm run build` succeed.
- [ ] Dev server on 5273: start three new maps; with the Dev panel visit each stratum and confirm by eye — no caves in topsoil, galleries + shafts in limestone, thin diagonal cracks in granite, long tubes in basalt, magma pockets in mantle; find one `karst_shaft`, one `lava_tube`, one `magma_chamber` and their signposts; the first descent under the camp has no open cave or fluid.
- [ ] Load a save made before this plan: world unchanged, no console errors.
- [ ] Screenshot one cave of each style for the user.
