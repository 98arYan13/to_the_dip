# Web Game: Hazards, Progression & Endgame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `web/` mining game into a game with real danger (collapse, fluids, gas, quakes, heat), real loss (death wipes the run), real progression (stash, tech tree, gear, contracts) and an ending (the Core).

**Architecture:** Hazards are small simulation systems ticked at a fixed low rate (4–10 Hz) over `World` typed arrays; each owns its own warning FX. Progression is data-driven from `config.js` (tech table, camp buildings, contracts, achievements) with tiny logic modules. Persistent state (`meta`) is split from run state (`run`) in the save so death can wipe only `run`.

**Tech Stack:** Vanilla JS (ES modules), Canvas2D, Vite 5.4.10, Vitest 2.1.4. All code in `web/`.

**Spec:** the pasted checklist from the user (Persian), mirrored in `web/TODO.md` § "ایده‌های گیم‌پلی". Do NOT check off or edit TODO.md items without asking the user.

## Global Constraints

- All tunables live in `web/src/config.js` (its header: "Nothing outside this file should contain gameplay/balance/audio/render constants").
- New tile ids are **appended** to `TILE` (existing ids 0–9 and saved `tileType` stay valid); same for `ORE`, `FLAG`.
- Saves must keep loading: every schema change bumps the version and adds a step in `SaveSystem.migrate`.
- Deterministic worldgen: anything random in generation uses the seeded `RNG` (`core/RNG.js`), never `Math.random`.
- Hazards must stay out of the unbreakable camp foundation (`WORLD.BASE_CAMP`, `isCampGround`).
- Tests: `cd web && npm test`. Pure logic gets a Vitest test; rendering is verified by running `npm run dev` and looking.
- No `git commit` unless the user says so; "Commit" steps below mean "stage and ask".
- Code and commit messages in English; replies to the user in Persian.

## Pushback (ponytail ultra) — scope decisions

- **Tech tree = one flat table** with `requires: []` and `cost`. No graph UI beyond a list grouped by branch. Existing `UPGRADES` (pickaxe/rig/jetpack/radar) stay as they are; new bonuses (battery, fall damage, capacity) become tech nodes, not a second upgrade system.
- **Water, magma, sand share one falling/flowing cellular-automaton pass** (`Fluids.js` + `Collapse.js` share `World` helpers), not three engines.
- **Gas is a per-tile byte layer**, not particles.
- **Stash, terminal and charging station are camp buildings** from one `CAMP_BUILDINGS` table, not three features.
- **Daily challenge** is just "seed = today's date, separate save slot, separate best-score"; no leaderboard.
- Boss: the "final goal" is a **scripted environmental ending at the Core** (a reach-and-survive sequence), not a creature.
- Skipped: fossils art beyond reusing the existing `ORE.FOSSIL`; new music tracks (already a separate TODO item).

## Review Focus

- Player saved/loaded *during* a collapse warning, flowing magma or a gas cloud: hazard state must restore or safely reset, never soft-lock.
- Death while carrying stash-deposited items, mid-contract, or mid-quake: stash/tech/achievements/contracts survive, run loot does not.
- Old saves (pre-`meta`/`run` split, no stash, no tech) must load with sane defaults.
- Unstable tiles at the world edge, next to the camp pad, or stacked 20 high must not crash or loop forever (bounded work per tick).
- Gas explosion + bomb chain + collapse in the same tick: no double-kill, no infinite chain (explosion budget per tick).

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/config.js` (modify) | TILE/FLAG appends; `HAZARD`, `GAS`, `TECH`, `GEAR`, `CAMP_BUILDINGS`, `CONTRACTS`, `ACHIEVEMENTS`, `CORE_GOAL`, `ZONES` |
| `web/src/systems/Run.js` (create) | run vs meta state, `die()` / loot-loss rules |
| `web/src/systems/Stash.js` (create) | home stash ops |
| `web/src/systems/Tech.js` (create) | tech unlock logic + derived stats |
| `web/src/systems/Hazards/Collapse.js` (create) | unstable soil/sand, warning, fall, crush |
| `web/src/systems/Hazards/Fluids.js` (create) | water/magma flow |
| `web/src/systems/Hazards/Gas.js` (create) | gas layer, spread, explosion |
| `web/src/systems/Hazards/Quake.js` (create) | quake scheduler, rockfall |
| `web/src/world/Zones.js` (create) | designed zone/prefab planner for WorldGen |
| `web/src/systems/Contracts.js`, `Collectibles.js`, `Camp.js` (create) | contracts, collectible/achievement tracking, camp buildings |
| `web/src/ui/Stash.js`-style panels (create as needed) | Tech/Stash/Contracts/Achievements screens, modeled on `ui/Shop.js` |
| `web/tests/*.test.js` (create) | one test file per system above |

Each task ships independently testable software; do them in order (1–4 are prerequisites for the rest).

---

### Task 1: Run vs meta state and death rules

**Files:**
- Create: `web/src/systems/Run.js`, `web/tests/run.test.js`
- Modify: `web/src/save/SaveSystem.js` (`migrate`, `serialize`), `web/src/entities/Player.js`, `web/src/main.js`, `web/src/config.js` (`SAVE.VERSION`)

**Interfaces:**
- Produces: `splitState(state) -> { meta, run }`; `applyDeath(state) -> state` (empties `cargo`, `consumables` (bombs, medpacks…), resets position to camp, resets energy; keeps `upgrades`, `tech`, `stash`, `achievements`, `contracts`, `cash`); `Player.die(cause: string)` emits `bus 'player:dead'` `{cause}`.
- Consumes: existing `Economy` cargo/consumables fields (read `systems/Economy.js` for exact names), `bus` from `core/EventBus.js`.

- [ ] **Step 1: Write failing tests** in `run.test.js`: `applyDeath` on a state with cargo `{IRON:5}`, `bombs:3`, `medpacks:2`, `upgrades.pickaxe:3`, `stash:{COAL:9}` returns empty cargo/bombs/medpacks, base-equipment consumables, `upgrades.pickaxe===3`, `stash.COAL===9`. A pre-split save (no `meta`) passes through `migrate` with `stash:{}`, `tech:[]`.
- [ ] **Step 2:** Run `cd web && npx vitest run tests/run.test.js` → FAIL (module missing).
- [ ] **Step 3:** Implement `Run.js`; bump `SAVE.VERSION`, add the migration step; wire `Player.die` in `main.js` to call `applyDeath`, show a death toast and respawn at camp. Existing "rescue at 0% energy halves cargo" stays (it is a softer failure than death).
- [ ] **Step 4:** Run `npm test` → all PASS.
- [ ] **Step 5:** Stage `web/src/systems/Run.js web/tests/run.test.js web/src/**` and ask the user before committing.

### Task 2: Home stash

**Files:**
- Create: `web/src/systems/Stash.js`, `web/tests/stash.test.js`
- Modify: `web/src/systems/Economy.js`, `web/src/ui/Shop.js`, `web/src/config.js` (`CAMP_BUILDINGS.STASH`)

**Interfaces:**
- Produces: `deposit(state, oreId?: number) -> void` (moves cargo → `state.stash`; all ores if omitted); `withdraw(state, oreId, n) -> number`; `Economy.sellFromStash(oreId, n)`; `Economy.canAfford(cost: {cash?, ores?: Record<number,number>}) -> boolean` and `Economy.pay(cost)` draw ores from **stash first, then cargo**, so upgrades can use stored materials.
- Consumes: `state.stash: Record<oreId, number>` from Task 1's migration.

- [ ] **Step 1: Write failing tests**: deposit moves all cargo; sell from stash credits `cargoValue`-equivalent cash and decrements; `pay({ores:{IRON:10}})` with 6 in stash + 4 in cargo succeeds and zeroes both; with 6+3 returns false and changes nothing.
- [ ] **Step 2:** Run it → FAIL.
- [ ] **Step 3:** Implement. Shop gets a "Stash" tab (deposit-all button, per-ore sell, withdraw). Depositing is only allowed inside `INTERACT_RANGE` of the camp (reuse the shop proximity check).
- [ ] **Step 4:** `npm test` → PASS. Run `npm run dev`, deposit and sell in the shop, reload page, stash persists.
- [ ] **Step 5:** Stage and ask.

### Task 3: Tech tree and hard upgrade pricing

**Files:**
- Create: `web/src/systems/Tech.js`, `web/src/ui/TechScreen.js`, `web/tests/tech.test.js`
- Modify: `web/src/config.js` (`TECH`), `web/src/systems/Economy.js`, `web/src/main.js` (open key)

**Interfaces:**
- Produces: `TECH: [{id: string, branch: 'suit'|'jet'|'tools'|'camp', name, requires: string[], cost: {cash: number, ores: Record<number,number>}, effect: {stat: string, add?: number, mul?: number} | {unlock: string}}]`; `canUnlock(meta, id) -> {ok: boolean, reason?: string}`; `unlock(meta, id) -> void` (pays via `Economy.pay`, pushes id to `meta.tech`); `stat(meta, name, base) -> number` applies all unlocked effects.
- Initial nodes (each cost must be a milestone: cash ≥ ~1.5× `expectedTripIncome` of the matching tier plus ≥1 rare ore of that tier): `battery_1..3` (+max energy), `padded_suit_1..2` (fall damage mul), `jet_tank_1..2`, `jet_thrust_1`, `pack_1..2` (capacity), `heat_suit`, `magma_boots`, `gas_mask`, `ladder_kit`, `big_bomb`, `deep_scanner`, `charge_station`, `contracts_terminal`, `stash_2`.

- [ ] **Step 1: Write failing tests**: locked while a prerequisite is missing (`reason` names it); `unlock` consumes cost and is idempotent-guarded (second call returns `ok:false`); `stat(meta,'maxEnergy',100)` rises after `battery_1`; **every node's cash cost is strictly greater than its prerequisite's** and no node is affordable with only starting resources (balance guard).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `Tech.js`; replace direct reads of max energy / fall multiplier / cargo capacity in `Energy.js`, `Player.js` (`hardLandingDamage` fallMult), `Economy.js` with `stat(...)`. `TechScreen` is a list grouped by branch showing cost, requirement and locked/owned state (copy `Shop.js` layout).
- [ ] **Step 4:** `npm test` → PASS; in `npm run dev` unlock one node and confirm the stat changes.
- [ ] **Step 5:** Stage and ask.

### Task 4: Protective gear and depth temperature

**Files:**
- Modify: `web/src/entities/Player.js` (`tileHeat`, `burn`), `web/src/config.js` (`GEAR`), `web/src/ui/HUD.js`; extend `web/tests/heat.test.js`

**Interfaces:**
- Produces: `ambientTemp(depth01: number) -> number` (°C, monotonic in depth); `GEAR = { HEAT_SUIT_RESIST: number (0..1), BOOTS_MAGMA: true }`; `heatDps(tempC, resist: number)`; `Player.canStandOn(tileType) -> boolean` (magma only with `magma_boots`).
- Consumes: `Tech.stat`/unlock check from Task 3 (`hasTech(meta,'heat_suit')`).

- [ ] **Step 1: Write failing tests** in `heat.test.js`: `ambientTemp` increases with depth and is below the damage threshold on the surface; `heatDps(tempC, 0.8) === 0.2 * heatDps(tempC, 0)`; standing on `TILE.MAGMA` without boots deals damage, with boots deals none.
- [ ] **Step 2:** Run `npx vitest run tests/heat.test.js` → FAIL.
- [ ] **Step 3:** Implement; HUD shows a temperature readout that turns red near the damage threshold and a suit/boots icon when owned. Existing `tileHeat` stays; ambient temp is added to it.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Stage and ask.

### Task 5: Collapse — unstable soil and sand (instant crush)

**Files:**
- Create: `web/src/systems/Hazards/Collapse.js`, `web/tests/collapse.test.js`
- Modify: `web/src/config.js` (`TILE.SAND = 10`, `FLAG.UNSTABLE = 64`, `HAZARD.COLLAPSE`), `web/src/world/WorldGen.js` (place sand pockets), `web/src/render/TileArt.js` + `web/src/render/Particles.js` (warning visuals), `web/src/main.js`

**Interfaces:**
- Produces: `class Collapse { constructor(world, bus); update(dt): void; markDirty(x, y): void; }`; pure `isUnstable(world, x, y) -> boolean` (SOIL/SAND with AIR directly below, or no solid support on both sides); event `bus 'tile:fell'` `{x, y}`; calls `player.die('crushed')` when a falling tile lands on the player's tile.
- Behavior: unstable tile → `FLAG.UNSTABLE` + warning timer `HAZARD.COLLAPSE.WARN_S` (visible crack, shake, dust particles) → falls tile-by-tile; mining a supporting tile calls `markDirty` on neighbors above. Work per tick is capped at `HAZARD.COLLAPSE.MAX_PER_TICK`.

- [ ] **Step 1: Write failing tests**: sand over air starts a warning, not an immediate fall; after `WARN_S` it moves down until it rests on solid; a tile landing on the player's cell triggers `die('crushed')`; a column of 200 unstable tiles processes in ≤ `MAX_PER_TICK` per tick and terminates; the camp pad never becomes unstable.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with a dirty-queue (only re-check tiles near changes), not a full-world scan. Add sand tile art + crack overlay + dust particles; warning must also be audible (reuse an existing SFX or add one short rumble in `SFX.js`).
- [ ] **Step 4:** `npm test` → PASS; in `npm run dev` dig under sand, watch warning then fall, stand under it and die.
- [ ] **Step 5:** Stage and ask.

### Task 6: Fluids — flowing water and magma

**Files:**
- Create: `web/src/systems/Hazards/Fluids.js`, `web/tests/fluids.test.js`
- Modify: `web/src/config.js` (`HAZARD.FLUID`), `web/src/render/TileArt.js`/`Renderer.js` (flow animation; reuse `magma_anim.png`), `web/src/main.js`

**Interfaces:**
- Produces: `class Fluids { constructor(world, bus); update(dt): void; }`; `FLAG.FLUID_LEVEL` is stored in a new `World.fluid: Uint8Array` (0–`HAZARD.FLUID.MAX`), saved/restored via `encodeWorld`/`decodeWorld` (migration default zeros).
- Behavior: a fluid tile flows down first, then sideways, when the tile below/side is AIR; magma + water → `BASALT`; magma contact damages as in Task 4 (boots rule).

- [ ] **Step 1: Write failing tests**: a water source above a hole flows down and sideways and conserves total volume within a pocket; magma meeting water yields BASALT; flow never spawns outside the world or into solid; 10k ticks on a large open cavern terminates under the per-tick cap.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with a dirty queue; render with level-height fill and animated surface. Natural water/magma from worldgen become sources only when their containing wall is broken (they were static before).
- [ ] **Step 4:** `npm test` → PASS; verify visually, including save/reload mid-flow.
- [ ] **Step 5:** Stage and ask.

### Task 7: Toxic / explosive gas

**Files:**
- Create: `web/src/systems/Hazards/Gas.js`, `web/tests/gas.test.js`
- Modify: `web/src/config.js` (`GAS`), `web/src/world/World.js` (add `gas: Uint8Array`), `web/src/save/SaveSystem.js`, `web/src/world/WorldGen.js` (sealed pockets), `web/src/systems/Mining.js` (`breakTile`, `blast` hooks), `web/src/render/Lighting.js`/`Particles.js` (green haze, bubbles), HUD (mask warning)

**Interfaces:**
- Produces: `class Gas { constructor(world, bus, player); update(dt): void; explodeAt(x, y): void; }`; `Gas.concentrationAt(x, y) -> number`.
- Rules (each is a test): (a) gas is sealed inside its pocket; breaking an adjacent wall lets it diffuse into the opening; (b) if the player is standing **in a gas tile** and mines → `explodeAt` and `die('gas explosion')`; mining from a neighboring gas-free tile never explodes; (c) in gas without `gas_mask` tech → damage per second `GAS.DPS`; with mask → none; (d) `Mining.blast` reaching a gas tile calls `explodeAt`; explosion removes gas in a radius, destroys weak tiles like a bomb, and triggers neighboring gas tiles (chain) bounded by `GAS.MAX_CHAIN_PER_TICK`.

- [ ] **Step 1: Write failing tests** for (a)–(d) plus: chain of 500 gas tiles resolves in bounded ticks without recursion overflow (use an explicit stack).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; worldgen places gas pockets via Task 9's zone planner (until then, via a temporary dev-panel spawn in `ui/DevPanel.js`).
- [ ] **Step 4:** `npm test` → PASS; dev-panel spawn gas, break wall, watch spread; bomb chain.
- [ ] **Step 5:** Stage and ask.

### Task 8: Earthquakes and rockfall

**Files:**
- Create: `web/src/systems/Hazards/Quake.js`, `web/tests/quake.test.js`
- Modify: `web/src/config.js` (`HAZARD.QUAKE`), `web/src/render/Camera.js` (shake), `web/src/audio/SFX.js`, `web/src/main.js`

**Interfaces:**
- Produces: `class Quake { constructor(world, bus, collapse, fluids, rng); update(dt, depth01): void; trigger(strength: number): void; }`; event `bus 'quake'` `{strength}`; rockfall = a falling-rock entity/tile-move that crushes like Task 5.
- Behavior: scheduled by seeded RNG with rising frequency/strength with depth; warning rumble + shake ≥ `HAZARD.QUAKE.WARN_S` before the first collapse; on strike, marks a random set of ceiling tiles unstable via `collapse.markDirty` (chain follows from Task 5) and spawns rockfall from loose ceilings; never during first `HAZARD.QUAKE.SAFE_DEPTH` meters or at camp.

- [ ] **Step 1: Write failing tests**: with a fixed RNG seed the schedule is reproducible; no quake above `SAFE_DEPTH`; `trigger(1)` produces ≥1 unstable mark in a cave; shake amplitude decays to 0.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; add `trigger` to the dev panel.
- [ ] **Step 4:** `npm test` → PASS; dev-panel quake in a cave.
- [ ] **Step 5:** Stage and ask.

### Task 9: Designed zones (structured layout, not noise-only)

**Files:**
- Create: `web/src/world/Zones.js`, `web/tests/zones.test.js`
- Modify: `web/src/world/WorldGen.js`, `web/src/config.js` (`ZONES`), `web/tests/worldgen.test.js`

**Interfaces:**
- Produces: `planZones(seed: number, W: number, H: number) -> Zone[]` where `Zone = {kind: 'vault'|'gas_cavern'|'lava_lake'|'aquifer'|'fossil_chamber'|'sand_pocket'|'crystal_geode', x, y, w, h}`; `stampZone(world, zone, rng) -> void`.
- Rules (tests): same seed → same plan; zones never overlap each other, the camp pad, or the shaft column; each kind only appears in its allowed depth band (`ZONES.BANDS[kind]`); every layer gets at least one landmark zone; a vault always has a reachable (diggable) path; gas caverns and lava lakes are always adjacent to a safe approach tile.

- [ ] **Step 1: Write failing tests** for the five rules above.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement a planner that places zones band by band on a coarse grid with jitter (seeded), then `stampZone` carves/fills tiles, sets `World.gas`/`fluid`, and places guaranteed ore/fossil. `WorldGen` calls both after base terrain; existing worldgen tests must still pass for unchanged seeds' non-zone invariants (update expectations deliberately, not blindly).
- [ ] **Step 4:** `npm test` → PASS; dev: look at the minimap across 3 seeds.
- [ ] **Step 5:** Stage and ask.

### Task 10: Camp buildings and underground charging station

**Files:**
- Create: `web/src/systems/Camp.js`, `web/tests/camp.test.js`
- Modify: `web/src/config.js` (`CAMP_BUILDINGS`), `web/src/render/Renderer.js` (draw buildings), `web/src/entities/Player.js` (`placeAt` for station), `web/src/ui/Shop.js`/`TechScreen.js`

**Interfaces:**
- Produces: `CAMP_BUILDINGS: {stash, shop, terminal, workshop}` each with `levels: [{cost, effect}]`; `upgradeBuilding(meta, id) -> {ok, reason?}`; `placeChargeStation(state, x, y) -> boolean` (costs from `Economy.pay`, only on a solid-floored AIR tile, deeper than `charge_station` min depth spacing `CAMP.STATION_MIN_GAP`); `Energy.refill()` when interacting; stations persist in `run`-independent `meta.stations` list (they survive death) and are capped at `CAMP.MAX_STATIONS`.

- [ ] **Step 1: Write failing tests**: placing requires the `charge_station` tech and cost; two stations closer than `STATION_MIN_GAP` rejected; stations survive `applyDeath`; building level N+1 requires level N.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and draw; station reuses the camp "recharge" effect.
- [ ] **Step 4:** `npm test` → PASS; place a station mid-mine, drain energy, recharge.
- [ ] **Step 5:** Stage and ask.

### Task 11: Contracts from the camp terminal

**Files:**
- Create: `web/src/systems/Contracts.js`, `web/src/ui/ContractsScreen.js`, `web/tests/contracts.test.js`
- Modify: `web/src/config.js` (`CONTRACTS`), `web/src/main.js`

**Interfaces:**
- Produces: `rollContracts(seed: number, day: number, meta) -> Contract[]` where `Contract = {id, ore, qty, rewardCash, rewardTech?: string}`; `turnIn(state, contractId) -> {ok, reason?}` takes ore from stash then cargo; `meta.contracts.active` (max `CONTRACTS.MAX_ACTIVE`).
- Rules: reward > market value of the ore (`cargoValue`) by `CONTRACTS.PREMIUM`; qty scales with player's pickaxe tier so contracts are always minable; same `(seed, day)` → same offers.

- [ ] **Step 1: Write failing tests**: determinism; reward > market value; ore never above the player's reachable tier; `turnIn` with insufficient ore returns `{ok:false}` and changes nothing; completed contract cannot be turned in twice; active contracts survive `applyDeath`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and add the terminal screen (opened near the camp terminal, requires `contracts_terminal` tech).
- [ ] **Step 4:** `npm test` → PASS; play: accept, mine, deposit, turn in.
- [ ] **Step 5:** Stage and ask.

### Task 12: Collectibles, fossils and achievements

**Files:**
- Create: `web/src/systems/Collectibles.js`, `web/src/ui/AchievementsScreen.js`, `web/tests/collectibles.test.js`
- Modify: `web/src/config.js` (`ACHIEVEMENTS`, `COLLECTIBLES`), `web/src/systems/Mining.js` (emit `'ore:collected'`), `web/src/world/Zones.js` (fossil chambers)

**Interfaces:**
- Produces: `ACHIEVEMENTS: [{id, name, desc, test: {event: string, count?: number, ore?: number, depthM?: number}}]`; `class Collectibles { constructor(bus, meta); }` listens to bus events and records to `meta.achievements: string[]` and `meta.collection: Record<id, true>`; event `'achievement'` `{id}` shows a toast.

- [ ] **Step 1: Write failing tests**: collecting the nth fossil unlocks its achievement once; reaching depth X unlocks depth achievement; both persist through `applyDeath`; duplicate events never re-award.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; screen is a grid of owned/unowned entries.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Stage and ask.

### Task 13: Core ending

**Files:**
- Create: `web/src/systems/CoreGoal.js`, `web/tests/coregoal.test.js`, `web/src/ui/Ending.js`
- Modify: `web/src/config.js` (`CORE_GOAL`), `web/src/main.js`, `web/src/world/Zones.js` (core chamber), `web/TODO.md` is **not** edited.

**Interfaces:**
- Produces: `class CoreGoal { constructor(world, bus, meta); update(dt, player): void; }`; reaching the core chamber starts a timed "stabilize" sequence (extreme heat+quake from Tasks 4/8; player must survive `CORE_GOAL.HOLD_S` with a charge-station-grade requirement: needs `heat_suit` tech or dies); success sets `meta.completed = true`, grants a reward (cash + a permanent tech token), shows `Ending`, then allows continuing (post-game: all stats unlocked, keep digging).
- Depends on the open TODO bug items for CORE (tier 6 pickaxe can mine CORE; dynamite `pickaxeTier + 1` rule) — verify those first and fix in this task's Step 3 if broken.

- [ ] **Step 1: Write failing tests**: sequence completes only if the player stays alive for `HOLD_S`; death mid-sequence resets the sequence, not `meta`; `meta.completed` persists and the reward is granted once; a tier-6 pickaxe can break `TILE.CORE` (existing TODO question).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and add the ending screen.
- [ ] **Step 4:** `npm test` → PASS; reach core via dev panel teleport and complete the sequence.
- [ ] **Step 5:** Stage and ask.

### Task 14: Daily challenge

**Files:**
- Create: `web/tests/daily.test.js`
- Modify: `web/src/save/SaveSystem.js` (slot kind), `web/src/ui/SaveMenu.js`, `web/src/main.js`, `web/src/config.js` (`DAILY`)

**Interfaces:**
- Produces: `dailySeed(date: Date) -> number` (stable for the UTC day; implemented with the existing `core/RNG.js` hash); a "Daily" slot in `SaveMenu` that starts a fresh world with `dailySeed(today)`, tracks `bestScore` (deepest meters + cash earned) in `meta.daily[dateKey]`, and never touches normal-slot progression.

- [ ] **Step 1: Write failing tests**: `dailySeed` equal within the same UTC day, different next day; daily slot starts with base equipment regardless of normal-save tech.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Stage and ask.

### Task 15: Ladder/platform, big bomb, deep scanner items

**Files:**
- Modify: `web/src/entities/Player.js` (`placeAt`), `web/src/entities/Dynamite.js`, `web/src/systems/Mining.js` (`blast` radius), `web/src/systems/Economy.js` (`CONSUMABLES`), `web/src/config.js` (`CONSUMABLES`, `DYNAMITE.BIG_RADIUS`, `RADAR.DEEP_RANGE`), `web/src/ui/Shop.js`, `web/tests/mining.test.js`

**Interfaces:**
- Produces: consumables `ladder`, `bigBomb`; `Mining.blast(tx, ty, radius = DYNAMITE.RADIUS)`; deep scanner = tech node (Task 3) multiplying radar range via `Tech.stat(meta,'radarRange',…)`.

- [ ] **Step 1: Write failing tests** in `mining.test.js`: big-bomb blast clears a strictly larger radius than the normal one and still respects `dynamiteOutcome` (no break of BEDROCK/camp ground); ladder places only on AIR adjacent to solid and lets the player climb; both are lost on death.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; gate shop entries behind their tech nodes.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Stage and ask.

---

## Self-Review

- **Spec coverage:** core ending → T13; hazards (quake T8, rockfall T8, flowing water/magma T6, unstable soil/sand with warnings + instant crush T5, depth temperature T4, gas incl. mask/explosion/bomb chain T7, heat suit + magma boots T4/T3); designed layout → T9; suit upgrades, jetpack/capacity → T3; ladder/big bomb/scanner → T15; charging station → T10; contracts → T11; fossils + achievements → T12; camp buildings → T10; daily challenge → T14; tech tree + hard pricing → T3; death + permanence → T1 (+ persistence asserts in T10/T11/T12); home stash → T2.
- **Type consistency:** `Economy.pay(cost)` (T2) is what T3, T10, T11 use; `Tech.stat(meta, name, base)` (T3) is what T4, T15 use; `Collapse.markDirty` (T5) is what T8 uses; `Gas.explodeAt` (T7) is what Mining.blast calls.
- **Known gaps to resolve while executing:** exact existing field names in `Economy`/`state` (cargo, consumables) must be read first in T1; existing TODO bug items (CORE tier, dynamite rule, save migration of old saves) are folded into T1 and T13, not duplicated.
- **Proportion:** 15 tasks, signatures and test assertions only.
