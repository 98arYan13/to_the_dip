# Tech Tree Redesign (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat tech list with an era-based tech graph, ore → material processing in levelled camp buildings, material-crafted equipment, a camp power pool, and New Map carry-over.

**Architecture:** Ores and materials share the `ORES` id space (materials have `kind: 'material'`, `hosts: []`), so the existing cargo/stash/`pay`/`canAfford` code handles them unchanged. New data tables (`RECIPES`, extended `CAMP_BUILDINGS`, new `TECH`, equipment `recipe` fields) live in `config.js`; rules are pure functions in `systems/Crafting.js`, `systems/Power.js` and `systems/Tech.js`, tested with vitest. UI is HTML in the existing terminal modal.

**Tech Stack:** Vanilla JS (ES modules, JSDoc types), Canvas, Vite 5.4.10, Vitest 2.1.4. Run tests from `web/` with `npx vitest run`.

**Spec:** `docs/superpowers/specs/2026-11-12-tech-tree-redesign-design.md` — read it; all tables (ids, recipes, costs, tree) are copied from there, not repeated here.

## Global Constraints

- All in-game text, identifiers and commit messages are English.
- Saved `oreType` ids 1–21 must not change; new ores are 22–24, materials 25–42 (spec §3).
- Material `kg` = 0.5 × total input kg; material `price` = 1.3 × total input price (spec §3.2) — compute these with a helper at module load, do not hand-type them.
- Equipment is crafted from materials only (no cash). Tech unlock costs cash + materials.
- Crafting is instant. Power: Coal 10, Fuel 40, Enriched Uranium 500 power; capacity 200/1,000/10,000 by Generator level; 1 power per 10 battery energy; new game starts with 100 power and 20 coal in the stash.
- Emergency rescue is unchanged and never draws power (`ENERGY.RESCUE_ENERGY_FRAC` 0.3).
- Dev server runs on port **5273** (`npm run dev` in `web/`), never 5173.
- **No `git commit` unless the user approved commits for this execution** (user's hard rule). Commit steps below are conditional on that approval.
- Do not edit `web/TODO.md`.

## Review Focus

1. **Old saves:** a v4 save with jetpack level 3, `ladder_kit`, Workshop level 2 and 5 teleporters must load, keep its jetpack (level 4), refund cash, and show 5 Warp Charges — test in Task 9.
2. **Soft-lock at start:** a fresh game with power spent and no coal must still be playable (Bronze pickaxe mines coal; rescue still works; Kiln/Bloomery need no power beyond what 20 coal gives) — test in Task 3 (`fresh economy can reach bloomery`).
3. **Materials leaking into ore-only code:** contracts, world-gen, tile art and depth/ore tooltips must never pick a material id — tests in Task 1.
4. **Jetpack level 0:** pressing jet with no jetpack must not drain energy or brake falls (fall damage still applies) — test in Task 5.
5. **Paying from cargo:** recipes and techs pay from stash first, then cargo (existing `pay`); crafting output always goes to the stash even when the stash cap is reached — output ignores the cap (test in Task 2) so crafted items are never lost.

---

### Task 1: Ore and material item data

**Files:**
- Modify: `web/src/config.js` (`ORE`, `ORES`)
- Modify: `web/src/systems/Contracts.js:19`, `web/src/render/TileArt.js:67,125`
- Test: `web/tests/items.test.js` (create)

**Interfaces:**
- Produces: `ORE.BAUXITE=22, ORE.ILMENITE=23, ORE.OIL_SHALE=24`; `ITEM` frozen map of material keys → ids 25–42 (`ITEM.STEEL === 29`, etc., spec §3.2); every `ORES[i]` has `kind: 'ore' | 'material'`; materials have `hosts: []`, `tier: 0`, `colors` (base/light/dark), `glow: null`, `tile: null`, `kg`, `price`.
- Produces: `isOre(id: number): boolean` exported from `config.js`.

- [ ] **Step 1: Write failing tests** in `web/tests/items.test.js`:
  - `new ores keep old ids stable`: `ORE.TUNGSTEN === 21`, `ORE.BAUXITE === 22`, `ORE.OIL_SHALE === 24`, `ORES.length === 43`.
  - `materials follow kg and price rules`: for each material with a recipe in `MATERIAL_INPUTS` (the config table used to derive values), `kg` ≈ 0.5 × Σ input kg and `price` ≈ 1.3 × Σ input price (`toBeCloseTo(…, 2)`).
  - `materials are never generated`: generate a world with seed 1 (as `worldgen.test.js` does) and assert every `oreType` value is `isOre`.
  - `contracts only ask for ores`: `rollContracts(1, 1, 6)` → every `ore` satisfies `isOre`.
  - `rare ores are rarer`: `ORES[ORE.DIAMOND].weight === 0.35`, `ORES[ORE.RUBY].weight === 0.7`, `ORES[ORE.RHODIUM].weight === 1.4`, `ORES[ORE.METEORITE].weight === 1.4`.
- [ ] **Step 2: Run** `npx vitest run tests/items.test.js` — expect FAIL (missing exports).
- [ ] **Step 3: Implement in `config.js`:** add the 3 ores (spec §3.1; pick kg/hard/price in the band of neighbours: Bauxite ≈ Iron, Oil Shale ≈ Lead, Ilmenite ≈ Cobalt; `tile: null`, procedural colors) and the material entries. Define material values from a `MATERIAL_INPUTS` table `{ [materialId]: { [inputId]: n } }` (the "in" column of spec §3.2, one output each) via a helper that sums input kg/price; materials whose input is another material (Stainless, Carbon Fiber, Circuit, Warp Charge) must be derived after their inputs. Add `kind` to every entry. Cut the four weights as in the test.
- [ ] **Step 4: Fix ore-only loops:** `Contracts.js:19` add `isOre(o) &&`; `TileArt.js` allocate/paint ore cells only for `isOre(o)` (keep array indexed by id). WorldGen/Zones already filter by `hosts` — leave them.
- [ ] **Step 5: Run** `npx vitest run` — all pass (fix any existing test that hard-codes `ORES.length`).
- [ ] **Step 6: Commit** (if approved): `git add web/src web/tests && git commit -m "Web: add bauxite, ilmenite, oil shale and processed materials"`

### Task 2: Recipes, buildings and crafting rules

**Files:**
- Modify: `web/src/config.js` (`RECIPES`, `CAMP_BUILDINGS`)
- Create: `web/src/systems/Crafting.js`
- Modify: `web/src/systems/Camp.js` (remove `upgradeBuilding`, re-export from Crafting), `web/src/systems/Economy.js` (`buildings` defaults, drop `upgradeDiscount`)
- Test: `web/tests/crafting.test.js` (create); update `web/tests/progression.test.js` "buildings upgrade…" test

**Interfaces:**
- Consumes: `ITEM`, `isOre` (Task 1); `economy.pay`, `economy.canAfford`, `economy.stash`.
- Produces:
  - `RECIPES`: array of `{ id: string, building: 'generator'|'furnace'|'refinery'|'lab'|'workshop', level: number, in: Record<number,number>, out: Record<number,number>, power: number, tech?: string }` — one per spec §3.2 row (id = lower-case material key, e.g. `'steel'`; `in` is taken from Task 1's `MATERIAL_INPUTS[id]`, never retyped), `power` per spec §5 (Steel 5, Aluminium 30; others: 1 per input unit).
  - `CAMP_BUILDINGS[id].levels[i] = { name, cost: {ores}, tech?, needs?: {building, level} }` for generator/furnace/refinery/lab/workshop (spec §4); `shop` unchanged.
  - `START_BUILDINGS = { generator: 1, furnace: 1, workshop: 1 }`.
  - `canCraft(ec, recipeId: string, times = 1): {ok: boolean, reason?: string}`; `craft(ec, recipeId, times = 1): {ok, reason?}`.
  - `canUpgradeBuilding(ec, id: string): {ok, reason?}`; `upgradeBuilding(ec, id): {ok, reason?}`.
  - `isUnlockedFor(ec, techId?: string): boolean` — true if no tech or owned (used until Task 4 adds the full Tech helpers; Task 4 replaces it with `isUnlocked`).

- [ ] **Step 1: Write failing tests** in `crafting.test.js`:
  - `crafting pays inputs and power and puts output in the stash`: economy with `buildings.furnace = 3`, tech `['blast_furnace']`, stash iron 4 coal 4, `power = 100` → `craft(ec,'steel',2).ok`; stash iron 0, coal 0, steel 2; `power === 90`.
  - `refuses and changes nothing`: missing building level → reason `/Furnace level 3/`; missing tech → reason names the tech; missing inputs → `/Not enough/`; no power → `/power/i`; state deep-equals before.
  - `output ignores the stash cap`: stash steel at `ECONOMY.STASH_CAP` → craft still adds.
  - `buildings need tech, previous level and materials`: furnace 1→2 refused without `bloomery`; with tech and 15 iron + 10 coal → ok, level 2; arc furnace (level 4) refused while generator < 2 with reason `/Generator level 2/`.
  - `fresh economy starts with generator, furnace and workshop at level 1`.
- [ ] **Step 2: Run** `npx vitest run tests/crafting.test.js` — FAIL.
- [ ] **Step 3: Implement** the data and `Crafting.js`. `craft` checks everything first (using a summed cost `{ores: in×times}`), then `ec.pay`, subtracts `power×times` from `ec.power`, adds outputs to `ec.stash` directly, emits `EV.CARGO_CHANGED`. Add `power: number` (default 0 here; Task 3 sets start value) and `START_BUILDINGS` defaults to `createEconomyState`/`load` (merge `{...START_BUILDINGS, ...s.buildings}`). Remove `upgradeDiscount` and its use in `upgradeCost`.
- [ ] **Step 4: Run** `npx vitest run` — pass; update the old "buildings upgrade one level at a time and change prices" test to the new Workshop behaviour (no discount).
- [ ] **Step 5: Commit** (if approved): `"Web: recipes, levelled processing buildings and crafting rules"`

### Task 3: Power pool and battery charging

**Files:**
- Create: `web/src/systems/Power.js`
- Modify: `web/src/config.js` (`POWER`), `web/src/systems/Energy.js:50-56`, `web/src/systems/Economy.js` (start power and coal)
- Test: `web/tests/power.test.js` (create)

**Interfaces:**
- Produces: `POWER = { CAP: [200, 1000, 10000], FUELS: [{id: ORE.COAL, power: 10, gen: 1}, {id: ITEM.FUEL, power: 40, gen: 2}, {id: ITEM.ENRICHED_URANIUM, power: 500, gen: 3}], PER_ENERGY: 0.1, START: 100, START_COAL: 20 }`.
- Produces: `powerCap(ec): number`; `refuel(ec): number` (burns stash fuel, cheapest `price/power` first, only while `power + fuelPower <= cap`, returns units burned); `drawPower(ec, amount: number): number` (calls `refuel` when short, returns amount actually granted, never negative pool).
- Consumes: Crafting's `ec.power`; Task 2's `craft` must call `drawPower` instead of subtracting directly (change it here, keep the Task 2 test green).

- [ ] **Step 1: Write failing tests:**
  - `fresh economy has 100 power and 20 coal in the stash`.
  - `draw auto-burns the cheapest allowed fuel`: generator 2, stash coal 5 + fuel 5, power 0 → `drawPower(ec, 30)` returns 30 and burns coal before fuel; at generator 1, fuel is never burned.
  - `never exceeds the cap`: generator 1, power 195, coal 10 → `refuel` burns 0.
  - `empty pool with no fuel grants 0 and station charging stops`: `Energy.update(1, {atStation: true})` with `power 0`, no coal → `energy.value` unchanged.
  - `charging costs 1 power per 10 energy`: battery 0/100, power 100 → after enough station time, value 100 and power 90.
  - `fresh economy can reach bloomery` (Review Focus 2): fresh economy + 15 iron + $300 → unlock `bloomery` (after Task 4; mark `it.todo` here and fill in Task 4).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `Power.js`; in `Energy.update` station branch, compute wanted energy, `const got = drawPower(economy, want * POWER.PER_ENERGY) / POWER.PER_ENERGY`, add `got`. Rescue path untouched. Start values in `createEconomyState`.
- [ ] **Step 4: Run** `npx vitest run` — pass.
- [ ] **Step 5: Commit** (if approved): `"Web: camp power pool, generator fuel and paid battery charging"`

### Task 4: Tech graph data and helpers

**Files:**
- Modify: `web/src/config.js` (`TECH`, `ERAS`), `web/src/systems/Tech.js`
- Modify: callers of `isUnlockedFor` (Task 2) → `isUnlocked`
- Test: rewrite `web/tests/tech.test.js`; create `web/tests/techdata.test.js`

**Interfaces:**
- Produces: `ERAS = [{n: 1, name: 'Bronze Age'}, {n: 2, name: 'Iron Age'}, {n: 3, name: 'Industrial'}, {n: 4, name: 'Electric'}, {n: 5, name: 'Atomic'}, {n: 6, name: 'Space'}]`.
- Produces: `TECH` entries `{ id, era, name, desc, key?: true, parent?, requires: string[], cost: {cash, ores}, effect? }` exactly per spec §6.2 (all ids and costs from there). `heat_suit` effect `{stat: 'heatResist', add: 0.5}`, `heat_suit_2` `{stat: 'heatResist', add: 0.3}`. Space nodes except `warp_drive` and `exotic_materials`: `effect: {unlock: 'coming_soon'}`.
- Produces in `Tech.js`: `isUnlocked(ec, techId?: string): boolean`; `unlocksOf(techId): {kind: 'recipe'|'building'|'equipment'|'consumable', id: string, level?: number}[]` (reverse lookup over RECIPES, CAMP_BUILDINGS, PICKAXES/UPGRADES, CONSUMABLES); `eraReached(ec): number` (1 + number of owned `key` techs, max 6); existing `techStat`, `canUnlock`, `unlockTech` keep their signatures. `canUnlock` reason for a locked era: `Requires <key tech name>` via `requires`.

- [ ] **Step 1: Write failing tests** (`techdata.test.js`):
  - `every reference exists`: each `requires`, `parent`, `tech` (in RECIPES, building levels, equipment levels, consumables) is a TECH id; each item id in any cost/recipe is a valid `ORES` index.
  - `graph has no cycles and every tech is reachable` (topological sort from techs with `requires: []`).
  - `each era has exactly one key tech, except era 6` and key techs chain eras 1→5.
  - `materials used in era N are producible by era N`: for each tech, each material in its cost has a recipe whose `tech` (and building level's tech) is in an era ≤ tech.era.
  - `ores needed in era N are mineable with that era's pickaxe`: ore `tier` ≤ pickaxe tier available by that era (map: era1→1, 2→2, 3→3, 4→4, 5→6, 6→6).
  - `tech.test.js`: keep "locked while prerequisite missing, names it" (use `blast_furnace`/`bloomery`), "unlock pays, raises stat, not repeatable" (use `battery_1`), "persists through save and death"; add `unlocksOf('blast_furnace')` contains `{kind:'building', id:'furnace', level:3}` and `{kind:'recipe', id:'steel'}`; `eraReached` = 3 with `['bloomery','blast_furnace']`. Fill the `it.todo` from Task 3.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** data and helpers. Update `Player.js:226` to use `economy.stat('heatResist', 0)` instead of the `heat_suit` flag and `GEAR.HEAT_SUIT_RESIST`; update `HUD.js:112` ♨ check to `stat > 0`. `gas_mask`, `magma_boots`, `charge_station`, `contracts_terminal`, `big_bomb` keep their ids, so their callers stay unchanged. Also in this task: delete `ladder_kit` from TECH and the `tech` field from `CONSUMABLES.ladder` (so the reference test passes), and change `CAMP.STATION_COST` to `{ ores: { [ITEM.STEEL]: 4, [ITEM.COPPER_WIRE]: 2 } }` (spec §6.2).
- [ ] **Step 4: Run** `npx vitest run` — pass (fix `hazards`/`heat`/`progression` tests that pushed `'heat_suit'` and expected 0.8: push `'heat_suit','heat_suit_2'`).
- [ ] **Step 5: Commit** (if approved): `"Web: era-based tech graph with reverse-lookup unlocks"`

### Task 5: Crafted equipment, no default jetpack

**Files:**
- Modify: `web/src/config.js` (`PICKAXES`, `UPGRADES`), `web/src/systems/Economy.js` (replace `canBuyUpgrade`/`buyUpgrade`/`upgradeCost`/`nextUpgradeCost`), `web/src/entities/Player.js:117-125`
- Modify: `web/tests/economy.test.js` (drop cash-cost tests), `web/tests/progression.test.js` (jet tech test)
- Test: `web/tests/equipment.test.js` (create)

**Interfaces:**
- Produces: each equipment level (except level 0, and pickaxe tier 1) has `recipe: Record<number,number>`, `tech: string`, `workshop: number` per spec §7; `cost` fields removed. `UPGRADES.jetpack.levels[0] = { name: 'None', thrust: 0, maxUp: 0, drain: 0 }` followed by the four existing stat levels.
- Produces on `Economy`: `canCraftUpgrade(kind: string): {ok, reason?}`; `craftUpgrade(kind): {ok, reason?}` (pays recipe with `pay`, increments `levels[kind]`, emits `EV.UPGRADE_BOUGHT` as before); `get hasJetpack(): boolean` (`levels.jetpack > 0`).
- Consumes: `isUnlocked` (Task 4), `buildings.workshop` (Task 2).

- [ ] **Step 1: Write failing tests:**
  - `fresh game has no jetpack`: `levels.jetpack === 0`, `hasJetpack === false`.
  - `crafting the iron pickaxe needs ironworking, workshop 1 and 4 wrought iron`, then `pickTier === 2`; refuses with exact reasons otherwise; nothing changes on refusal.
  - `levels craft in order only` (cannot craft pickaxe 3 while at 1).
  - `no jetpack means no flight and no drain` (Review Focus 4): Player with jet held, `levels.jetpack 0` → `jetting === false`, energy unchanged.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** In `Player.update`, `this.jetting = economy.hasJetpack && !onLadder && …`. Remove the "3 to 5 trips afford the next pickaxe" test from `economy.test.js` (replaced by Task 6) and other tests that read `PICKAXES[i].cost`.
- [ ] **Step 4: Run** `npx vitest run` — pass.
- [ ] **Step 5: Commit** (if approved): `"Web: equipment crafted from materials; jetpack is no longer default gear"`

### Task 6: Balance test and cost tuning

**Files:**
- Create: `web/tests/balance.test.js`
- Modify: `web/src/config.js` (`TECH` costs, recipe counts only — no structural changes), `BALANCE` if a new constant is needed

**Interfaces:**
- Consumes: `expectedTripIncome(tier)` (`Economy.js`), `ERAS`, `TECH`, `RECIPES`.
- Produces: `techTrips(techId): number` exported from `Economy.js` = (cash + Σ material market value, where a material's value is its `price`) ÷ `expectedTripIncome(eraPickTier(era))`; `eraPickTier(era)` = map from Task 4.

- [ ] **Step 1: Write failing tests:** key techs cost 4–6 trips; other techs 1–3 trips (space era: only check key-chain monotonic); per-era total trips strictly increase.
- [ ] **Step 2: Run** — expect FAIL on some spec starting costs.
- [ ] **Step 3: Tune** cash amounts first, then material counts, in `TECH` until green. Keep every number's order of magnitude from the spec; record any tech whose cost moved by more than 2× in the task report.
- [ ] **Step 4: Run** `npx vitest run` — pass.
- [ ] **Step 5: Commit** (if approved): `"Web: balance test for tech costs per era"`

### Task 7: Shop items — ladder, warp charges

**Files:**
- Modify: `web/src/config.js` (`CONSUMABLES`), `web/src/systems/Economy.js` (`canBuyConsumable`, `useConsumable` for teleporter), `web/src/main.js:410-420`, `web/src/ui/HUD.js:43`
- Test: add to `web/tests/equipment.test.js`

**Interfaces:**
- Produces: (`CONSUMABLES.ladder` already lost its `tech` in Task 4) `CONSUMABLES.teleporter` is removed; `Economy.warpCharges: number` getter = stash + cargo of `ITEM.WARP_CHARGE`; `Economy.useWarpCharge(): boolean` (takes from cargo first, then stash).
- HUD slot 2 label `Warp` shows `warpCharges`; toast on zero: `'No warp charges — craft them in the Isotope Lab'`.

- [ ] **Step 1: Write failing tests:** ladder buyable on a fresh economy with $6; `warpCharges` counts stash + cargo; `useWarpCharge` decrements cargo first; returns false at 0.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; remove teleporter shop text in `Shop.js:222`.
- [ ] **Step 4: Run** `npx vitest run` — pass.
- [ ] **Step 5: Commit** (if approved): `"Web: ladders need no tech; warp uses crafted warp charges"`

### Task 8: Field Camp Kit

**Files:**
- Modify: `web/src/config.js` (`CONSUMABLES.campKit`, `CAMP.FIELD_CAMP`), `web/src/systems/Camp.js`, `web/src/systems/Economy.js` (`fieldCamps` state), `web/src/main.js` (place + interact), `web/src/render/Renderer.js` (draw placed camp as a placeholder tent box)
- Test: add to `web/tests/progression.test.js` `describe('camp')`

**Interfaces:**
- Produces: `CONSUMABLES.campKit = { name: 'Field Camp Kit', short: 'Camp', price: 120, slot: 6, start: 0 }`; `CAMP.FIELD_CAMP = { W: 4, H: 4, MAX: 3, RANGE: 2 }`.
- Produces: `fieldCampBlocker(ec, world, x, y): string|null` (needs a 4×4 all-AIR area with `(x,y)` as bottom-left, solid floor under all 4 columns, underground, not within `STATION_MIN_GAP` of another camp, under `MAX`, owns a kit); `placeFieldCamp(ec, world, x, y): {ok, reason?}`; `nearFieldCamp(ec, px, py): boolean`. State `economy.fieldCamps: {x,y}[]`, saved, kept on death.
- In `main.js`: slot-6 key places a camp at the player's feet; near a camp the prompt is `'camp'`, `E` opens the terminal limited to Stash tab and restores HP to `PHYSICS.SUIT_HP` (not energy).

- [ ] **Step 1: Write failing tests:** blocker reasons (`'Needs a 4×4 open space'`, `'Needs solid floor'`, `'Camp limit reached'`, `'No camp kit'`); placing spends one kit and persists through `toJSON`/`load` and `applyDeath`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Shop needs an option `show({only: 'stash'})` that hides other tabs; resting sets HP only.
- [ ] **Step 4: Run** `npx vitest run` — pass; manual check in Task 13.
- [ ] **Step 5: Commit** (if approved): `"Web: buyable field camp kit with rest and stash access"`

### Task 9: Save migration v4 → v5

**Files:**
- Modify: `web/src/config.js` (`SAVE.VERSION: 5`), `web/src/save/SaveSystem.js` (`migrate`)
- Test: `web/tests/save.test.js`

**Interfaces:**
- Produces: `migrate` step `from === 4` → version 5, applying spec §11: jetpack level +1 when the old save had the jetpack field (all v4 saves did, level ≥ 0 → +1); drop `ladder_kit` and refund its old cash $1,200; refund old Workshop building levels (sum of old cash costs $3,000/$25,000/$120,000 for owned levels) and set `workshop: 1`; add start buildings; `power: 100` if absent; move `consumables.teleporter` count into `stash[ITEM.WARP_CHARGE]`; grant `requires` ancestors of every kept tech.

- [ ] **Step 1: Write failing test** `v4 save migrates to the new economy` (Review Focus 1): build a v4 save object with `levels.jetpack 3`, `tech ['ladder_kit','heat_suit']`, `buildings {workshop: 2}`, `consumables {teleporter: 5}`, `credits 0` → after `deserialize`: `levels.jetpack 4`; `tech` excludes `ladder_kit`, includes `heat_suit` and its ancestors; `credits === 1200 + 3000 + 25000`; `buildings.workshop === 1`; `stash[ITEM.WARP_CHARGE] === 5`; `power === 100`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the migration step.
- [ ] **Step 4: Run** `npx vitest run` — pass (existing "v3 save still loads" test must pass through both steps).
- [ ] **Step 5: Commit** (if approved): `"Web: save v5 migration for the tech redesign"`

### Task 10: New Map carry-over

**Files:**
- Modify: `web/src/systems/Economy.js` (`newMapState`), `web/src/save/SaveSystem.js` (carry key helpers), `web/src/ui/SaveMenu.js:63`, `web/src/main.js:91-94,178`
- Test: add to `web/tests/save.test.js`

**Interfaces:**
- Produces: `Economy.newMapState(): ReturnType<typeof createEconomyState>` — `toJSON()` with `cargo` zeroed, `stations: []`, `fieldCamps: []`, `contracts.active: []`, `completed: false`; everything else kept (spec §10).
- Produces on `SaveSystem`: `setCarry(economyState)`, `takeCarry(): any|null` using key `${SAVE.KEY}.carry.<slot>` (removed when taken).
- SaveMenu: on the **active** slot, an extra button `New map (keep progress)` → hook `onNewMap(n)`; `main.js` handler: `saves.setCarry(economy.newMapState()); saves.clear(); restart();`. At boot: `new Economy(bus, loaded.ok ? loaded.data.economy : saves.takeCarry() || createEconomyState())`, with a new random seed.

- [ ] **Step 1: Write failing tests:** `newMapState` keeps credits/stash/tech/buildings/levels/power and clears cargo/stations/fieldCamps/active contracts/completed; `setCarry` then `takeCarry` round-trips once and returns null the second time.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run` — pass.
- [ ] **Step 5: Commit** (if approved): `"Web: New map keeps tech, cash, stash and gear"`

### Task 11: Tech tab UI (era tabs, graph, side panel)

**Files:**
- Modify: `web/src/ui/TechScreen.js` (rewrite), `web/src/ui/Shop.js` (tech tab state + keys), `web/src/style.css` (or the stylesheet Shop uses — find with grep `up-row`)

**Interfaces:**
- Consumes: `ERAS`, `TECH`, `canUnlock`, `unlocksOf`, `eraReached`.
- Produces: `renderTech(ec, view: {era: number, selected: string|null}): string`; Shop keeps `this.techView`, defaulting to the player's `eraReached` era and its first unlockable tech.

- [ ] **Step 1: Implement** layout C (spec §9.1): era tab row (`1 Bronze Age ✓`, locked eras with 🔒 but clickable for viewing); graph = columns by depth within the era (depth = longest `requires` chain inside the era), nodes as buttons `data-key="techsel:<id>"`, SVG lines from in-era prerequisites; node classes `owned` / `can` / `locked`; side panel with `desc`, cash and each material `have/need` (stash + cargo), "Unlocks:" list from `unlocksOf`, `Unlock` button `data-key="tech:<id>"`, disabled reason. Keys: arrows move selection, `[`/`]` switch era, Enter unlocks.
- [ ] **Step 2: Run** `npx vitest run` — still green.
- [ ] **Step 3: Verify in browser** (`npm run dev` in `web/`, port 5273): open terminal → Tech; screenshot era 1 and era 3; check `[`/`]`, arrows, Enter, and that `E` still closes.
- [ ] **Step 4: Commit** (if approved): `"Web: era-tab tech tree screen"`

### Task 12: Craft tab, shop tab reshuffle

**Files:**
- Create: `web/src/ui/CraftScreen.js`
- Modify: `web/src/ui/Shop.js` (tabs, actions), `web/src/ui/HUD.js` (if consumable slots changed)

**Interfaces:**
- Consumes: `RECIPES`, `CAMP_BUILDINGS`, `canCraft/craft`, `canUpgradeBuilding/upgradeBuilding`, `canCraftUpgrade/craftUpgrade`, `powerCap`, `isUnlocked`.
- Produces: `renderCraft(ec, building: string): string`; Shop `TABS = ['sell','stash','craft','tech','shop','camp','contracts','awards']` (spec §9.3; `upgrades` removed, `consumables` renamed `shop`); Shop `show(opts?: {tab?: string, building?: string, only?: 'stash'})`.
- Action keys: `craft:<recipeId>:<times>`, `bupg:<buildingId>`, `eq:<kind>`.

- [ ] **Step 1: Implement** spec §9.2: building sub-tabs; header with level, next-level cost/tech/needs and `Upgrade`; recipe rows `Steel ← 2 Iron Ore (have) + 2 Coal (have) · ⚡5` with `×1` / `×10`; locked rows show missing tech/level; Generator shows `power / cap` and burnable fuel counts; Workshop lists next level of pickaxe/rig/jetpack/radar with recipe and `Craft`. The old Camp tab keeps only the Trading Post and charging-station info.
- [ ] **Step 2: Run** `npx vitest run` — green.
- [ ] **Step 3: Verify in browser** (port 5273): with the dev panel give materials, craft steel ×10, upgrade a building, craft a pickaxe; screenshot.
- [ ] **Step 4: Commit** (if approved): `"Web: craft tab with building sub-tabs; upgrades move to the workshop"`

### Task 13: Camp buildings in the world

**Files:**
- Modify: `web/src/config.js` (`WORLD.BASE_CAMP.BUILDING_SLOTS`, widen `PAD_X0/PAD_X1` if needed), `web/src/render/Background.js` (~line 193), `web/src/main.js:522-530,372-376`

**Interfaces:**
- Produces: `BUILDING_SLOTS: Record<'generator'|'furnace'|'refinery'|'lab'|'workshop', number>` (tile x of each building's centre; no overlap with `SHOP_X`, `STATION_X`, `SHAFT_X`, all on the pad).
- `g.prompt` becomes `'bld:<id>'` near a slot; `E` opens `shop.show({tab: 'craft', building: id})`.

- [ ] **Step 1: Implement** placeholder drawing: solid box per built building (height grows with level, label text), dashed outline when unbuilt, dimmed when its level-1 tech is not owned.
- [ ] **Step 2: Verify in browser** (port 5273): walk past each slot, prompt shows, `E` opens the right sub-tab; shaft and shop still reachable; screenshot.
- [ ] **Step 3: Full manual pass:** fresh save — no jetpack, ladder in Shop, 20 coal + 100 power, mine iron+coal, unlock Bloomery, upgrade furnace, craft wrought iron, unlock Iron Age tech, craft iron pickaxe; then Settings → New Game → `New map (keep progress)` keeps all of it on a new seed. Also load a v4 save from before the change.
- [ ] **Step 4: Run** `npx vitest run` — green.
- [ ] **Step 5: Commit** (if approved): `"Web: processing buildings drawn at camp with interact prompts"`
