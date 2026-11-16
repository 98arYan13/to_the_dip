# Planets, Deep Maps and the Ending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Moon (448 tiles deep), Mars (704) and Tessera (1000) as playable worlds with their own geology, resources, gear and relics, travel between them, and the closed "Seed 4,117" ending at the bottom of Tessera.

**Architecture:** Each world is a `PLANETS` profile consumed by the generator from the Earth plan; travel reuses the existing "New Map (keep progress)" reload with the destination stored in the carried economy. Eras 7–8, new ores/materials and gear tiers 7–8 are pure data plus the existing crafting/tech systems. The ending is one new goal system (`MindGoal`) modelled on `CoreGoal`.

**Tech Stack:** Vanilla JS (ES modules), Canvas, Vitest 2.1 (`npm test` in `web/`), Vite.

**Spec:** `docs/superpowers/specs/2026-11-16-planets-and-worldgen-design.md` (sections 3, 5.3–5.6, 8, 8.1–8.4, 9–11). Fixed copy lives in spec 3.1.

**Order:** After `docs/plans/2026-11-16-story-and-blueprints.md` (all tasks) and `docs/plans/2026-11-16-worldgen-earth.md` (all tasks).

## Global Constraints

- Work only in `web/`. English identifiers and text. No new art files; procedural colours (launch pad, elevator and new tiles are drawn like the placeholder building boxes).
- Map width is 64 on every world; heights: Earth 256, Moon 448, Mars 704, Tessera 1000. No code may read `WORLD.H` for a live world — use `world.H`.
- Never stranded: returning to Earth is always free; emergency rescue keeps working on every world.
- The era chain must stay unlockable in order; relic gates as listed in Task 3 only.
- Fixed copy (do not reword): greeting `WELCOME, SEED 4,117. REPLICATION CONFIRMED.`; last log line `We were supposed to be its children. We turned out to be its cure.`
- Starting numbers from spec 8.1 are used verbatim, then tuned only through `balance.test.js` and the fairness suite.
- Do not `git commit` unless the user has allowed commits for this run. Each task ends with "Checkpoint": full `npm test`; commit only with that permission.
- Do not edit `web/TODO.md` (the elevator item is the user's to tick).

## Review Focus

1. **Travel with a full cargo / active contracts / placed camps** — cargo and materials travel; contracts, stations, field camps and elevator stops are cleared; nothing is duplicated by pressing travel twice (Task 5 test).
2. **Arriving without the means to leave** — on the Moon with 0 Propellant the player can still return to Earth for free and can still be rescued (Task 5 test).
3. **Dying during the final sequence** — only the node in progress resets; completed nodes and the raised coolant level persist; saving and reloading mid-sequence restores the same state (Task 8 test).
4. **Save from Tessera opened by code expecting 256 rows** — minimap, camera clamp, quake depth and save validation must all use the world's height (Task 1 test).
5. **Finishing the game, then starting a New Map on Earth** — pulses and quakes stay off, relic ruins stay empty, the Log still opens (Task 8 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/config.js` | `PLANETS.moon/mars/tessera`, new tiles/ores/materials/recipes, `ERAS` 7–8, techs, gear tiers, `TRAVEL`, `ELEVATOR`, `MIND_GOAL`, new `RELICS` |
| `web/src/story.js` | chapters 6–8 missions and log entries |
| `web/src/systems/Travel.js` (new) | pure travel rules + state change |
| `web/src/systems/Elevator.js` (new) | stops and rides |
| `web/src/systems/MindGoal.js` (new) | final sequence |
| `web/src/ui/TravelScreen.js`, `web/src/ui/ElevatorScreen.js` (new) | destination and stop pickers |
| `systems/Economy.js`, `Energy.js`, `CoreGoal.js`, `Hazards/Pulse.js`, `Hazards/Quake.js`, `Tech.js`, `Power.js`, `entities/Player.js`, `entities/Pickup.js`, `world/WorldGen.js`, `world/Zones.js`, `world/Ruins.js`, `world/World.js`, `save/SaveSystem.js`, `render/Camera.js`, `render/TileArt.js`, `ui/Minimap.js`, `ui/Ending.js`, `ui/HUD.js`, `ui/Shop.js`, `main.js` | wiring |

Economy fields added (fresh values): `planet: 'earth'`, `elevatorStops: []` (tile `{x, y}`), `finished: false`, `mind: { nodes: [], coolant: 0, greeted: false }`.

---

### Task 1: Variable map height and the planet in the save

**Files:** Modify every `WORLD.H` use (9 in `main.js`, `world/WorldGen.js`, `save/SaveSystem.js`, `render/Camera.js`, `ui/Minimap.js`, `systems/Hazards/Quake.js`), `systems/Economy.js`, `world/World.js`, `config.js` (`SAVE.VERSION` +1); Test `tests/save.test.js`, `tests/worldgen.test.js`, `tests/economy.test.js`

**Interfaces — produces:**
- `economy.planet: string` in `createEconomyState`/`load`/`toJSON`; `newMapState()` keeps it.
- `World.generate(seed, planetId = 'earth')`; `world.planet`, `world.H`.
- `main.js` boot: `planet = loaded.ok ? loaded.data.economy.planet ?? 'earth' : carry?.planet ?? 'earth'` (read the carry *before* constructing the world; today it is taken inside the `Economy` constructor call).
- `deserialize`: size check becomes `s.world.W === WORLD.W && s.world.H === PLANETS[planet].H`.
- Depth helpers: any `UNDER_M`/`UNDERGROUND_PX` constant computed from `WORLD.H` becomes a function of `world.H`.
- Migration: add `planet: 'earth'`, `elevatorStops: []`, `finished: false`, `mind` defaults.

- [ ] **Step 1: Failing tests**
```js
it('a 1000-row world generates, saves and loads', () => {
  const w = generateWorld(9, 'tessera'); expect(w.H).toBe(1000);
  const back = deserialize(serialize({ seed: 9, player: {}, economy: { ...createEconomyState(), planet: 'tessera' }, world: w }));
  expect(back.world.H).toBe(1000);
});
it('a save whose world height does not match its planet is rejected', () => {});
it('old saves migrate to planet earth', () => {});
it('no source file reads WORLD.H outside config and generator defaults', () => {
  // read web/src/**/*.js as text; allow only config.js and the default parameter in strata.js
});
```
The first test needs a minimal `PLANETS.tessera` stub (`H: 1000`, strata copied from Earth); Task 4 replaces it.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 2: Planet physics and environment

**Files:** Modify `entities/Player.js` (lines using `PHYSICS.GRAVITY * this.fallMult`, fall damage), `entities/Pickup.js`, `main.js` (dynamite/ladder gravity ~516), `systems/Energy.js` (idle drain), `systems/Hazards/Pulse.js`, `systems/Hazards/Quake.js`, `world/WorldGen.js` (`maxHPFor`); Test new `tests/planetphysics.test.js`, `tests/pulse.test.js`, `tests/heat.test.js`

**Interfaces — produces:**
- `planetGravity(planetId): number` (config helper). Everywhere gravity is used it becomes `PHYSICS.GRAVITY * fallMult * planetGravity`. Fall damage scales by the same factor; jump launch speed is computed from the scaled gravity so jump *height* in tiles stays the same on every world (only hang time and fall speed change).
- `lifeSupportMul(planetId, tech: string[]): number` — `breathable` 1; `thin` 1.5; `vacuum` 2; with `fusion_power` the surcharge is halved (1.25 / 1.5). Multiplies the idle drain term in `Energy` while underground.
- `Pulse`/`Quake` gap is divided by the planet's `pulse.mul` / `quake.mul`; a `mul` of 0 disables the scheduler; both are disabled when `economy.finished`.
- `maxHPFor(type, ore, hpMul = 1)` where `hpMul = planet.hpMul × (stratum.hpMul ?? 1)`; the generator passes it per tile.

- [ ] **Step 1: Failing tests**
```js
it('fall damage and fall speed scale with gravity; jump height does not', () => {
  // same drop: damage(moon) ≈ 0.4 × damage(earth); jump apex height equal within 1 px for earth, moon, tessera
});
it('life support drain', () => {
  expect(lifeSupportMul('earth', [])).toBe(1); expect(lifeSupportMul('mars', [])).toBe(1.5);
  expect(lifeSupportMul('moon', [])).toBe(2); expect(lifeSupportMul('moon', ['fusion_power'])).toBe(1.5);
});
it('Tessera pulses come three times as often; a finished game has none', () => {});
it('Tessera heat-sink rock has 2× the HP of its hull plating at the same tier', () => {});
```
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 3: Eras 7–8, resources, techs and gear

**Files:** Modify `config.js` (ORE/ITEM ids, `ORE_LIST`, `MATERIAL_INPUTS`, `MATERIAL_DEFS`, `RECIPE_DEFS`, `ERAS`, `TECH`, `PICKAXES`, `UPGRADES`, `CAMP_BUILDINGS.generator`, `POWER`, `RELICS`, `BALANCE.FOCUS_BAND_BY_TIER`), `systems/Tech.js` (`eraPickTier`); Test `tests/techdata.test.js`, `tests/balance.test.js`, `tests/items.test.js`, `tests/equipment.test.js`

**Data (append ids; never renumber existing ones):**
- Ores (hosts are filled per planet in Task 4; give them `hosts: []` on Earth so Earth never spawns them): `HELIUM3` (tier 5), `RARE_EARTHS` (tier 6), `WATER_ICE` (tier 6), `PERCHLORATE` (tier 6). Prices: place each between the two Earth ores of the neighbouring tiers by `perKg`.
- Materials: `PROPELLANT` ← 2 water ice + 1 perchlorate (Refinery 2); `PROPELLANT_LUNAR` is not a separate item — add a second recipe `propellant_lunar`: 2 water ice + 2 fuel → 1 Propellant (Refinery 2), so the Moon can refuel before Mars; `FUSION_FUEL` ← 2 helium-3 + 1 water ice (Lab 2); `SUPERCONDUCTOR` ← 2 rare earths + 1 copper wire (Lab 2). `RECIPES` currently derives one recipe per output from `MATERIAL_INPUTS`; extend `RECIPE_DEFS` rows with an optional explicit `in` for the second Propellant recipe.
- `ERAS`: `{n: 6, name: 'Space'}`, `{n: 7, name: 'Interplanetary'}`, `{n: 8, name: 'Interstellar'}`. `eraPickTier` table → `[1, 2, 3, 4, 6, 7, 8, 8]`.
- `RELICS` += `{ id: 'relay_alpha', name: 'Relay Alpha', planet: 'moon' }`, `{ id: 'relay_beta', name: 'Relay Beta', planet: 'mars' }`, `{ id: 'origin_core', name: 'Origin Core', planet: 'tessera' }`; existing entries gain `planet: 'earth'`.
- Techs (costs: cash = previous key tech's cash × ~1.5, then tuned by the balance test; ores as listed):

| id | era | key | requires | relic | cost ores | effect / unlocks |
|---|---|---|---|---|---|---|
| `elevator` | 5 | | `carbon_fiber`, `machining` | — | 20 steel, 10 carbon fiber | `{unlock:'elevator'}` |
| `orbital_station` | 6 | | `rocketry` | — | as today | `{unlock:'launch_pad'}` |
| `lunar_landing` | 6 | | `orbital_station` | — | as today | `{unlock:'dest_moon'}` (includes the Pressure Suit) |
| `fusion_power` | 6 | | `lunar_landing` | `relay_alpha` | 10 superconductor, 10 fusion fuel, 20 stainless | Generator 4, Fusion Fuel as generator fuel |
| `plasma_cutter` | 6 | | `fusion_power` | — | 6 superconductor, 4 fusion fuel, 6 tungsten carbide | pickaxe 7 |
| `fusion_pack` | 6 | | `fusion_power` | — | 6 fusion fuel, 4 superconductor | rig 6 |
| `mars_mission` | 6 | ✓ | `lunar_landing`, `fusion_power` | `relay_alpha` | 40 carbon fiber, 20 propellant, 30 circuit, 10 fusion fuel | `{unlock:'dest_mars'}` |
| `exotic_materials`… | 5 | | (unchanged) | | | |
| `lattice_cutter` | 7 | | `mars_mission`, `exotic_materials` | `relay_beta` | 6 exotic alloy, 6 superconductor, 4 industrial diamond | pickaxe 8 |
| `lattice_frame` | 7 | | `mars_mission`, `exotic_materials` | — | 6 exotic alloy, 8 fusion fuel | rig 7 |
| `heat_suit_3` | 7 | | `mars_mission`, `heat_suit_2` | — | 6 superconductor, 4 exotic alloy | `{stat:'heatResist', add:0.2}` (total 1.0) |
| `jetpack_5` | 7 | | `mars_mission`, `exotic_materials` | — | 4 exotic alloy, 4 fusion fuel | jetpack 5 |
| `warp_drive` | 7 | | `mars_mission`, `exotic_materials` | `seed_core` | 10 exotic alloy, 20 fusion fuel, 40 circuit | as today (Warp Charge, rig 5 stays) |
| `interstellar` | 7 | ✓ | `warp_drive` | `relay_beta` | 20 exotic alloy, 30 fusion fuel, 20 superconductor, 60 carbon fiber | `{unlock:'dest_tessera'}` |

  Era 8 has no techs of its own (its content is Tessera and the ending); the "one key tech per era" test becomes "eras 1–7 have exactly one key tech, era 8 none". All `coming_soon` effects are gone.
- Gear (spec 8.1 numbers): pickaxe 7 `Plasma Cutter` damage 40, swing 0.30, powered, workshop 3; pickaxe 8 `Lattice Cutter` damage 64, swing 0.28, powered, workshop 3; rig 6 `Fusion Pack` capacity 2400, maxEnergy 25000, eff 6.5; rig 7 `Lattice Frame` capacity 4800, maxEnergy 60000, eff 8; jetpack 5 thrust 4800, maxUp 520, drain 0.45. Recipes = the ore columns of their techs above.
- Generator level 4 `Fusion Reactor`: cost 30 superconductor + 20 stainless + 20 circuit, tech `fusion_power`; `POWER.CAP[3] = 100000`; fuel `{ id: FUSION_FUEL, power: 5000, gen: 4 }`.
- `BALANCE.FOCUS_BAND_BY_TIER` and `expectedTripIncome` need entries for tiers 7–8 (rig levels 6–7); if they index Earth bands, add a per-planet focus stratum lookup instead of extending the array blindly.

- [ ] **Step 1: Failing tests** — extend `techdata.test.js`: all references exist; graph acyclic and reachable; key-tech chain through era 7; "materials used in era N producible by era N" (teach `materialEra` about the planet that supplies the ore: an ore with no Earth hosts is era ≥ 6); new test:
```js
it('each world can be entered and finished with gear it or earlier worlds supply (spec 8.1)', () => {
  // first stratum tier ≤ pick tier required to get there: moon ≤ 6, mars ≤ 7, tessera ≤ 8 with first stratum ≤ 7
  // the recipe of the pick needed for a world's last stratum uses only ores hosted on that world's upper strata or earlier worlds
});
```
(The second half needs Task 4's profiles; write it now, mark it `it.todo`-free by using stub host lists, and tighten in Task 4.)
- [ ] **Step 2–4:** fail → implement → pass (`balance.test.js` bands hold for eras 6–7). **Step 5: Checkpoint.**

---

### Task 4: Moon, Mars and Tessera profiles

**Files:** Modify `config.js` (`PLANETS`, `TILE`/`MATERIALS` for new rock, `SET_PIECES`), `world/Zones.js`, `world/Ruins.js`, `world/WorldGen.js`, `render/TileArt.js`, `systems/CoreGoal.js`; Test `tests/planetdata.test.js` (already loops over all planets), `tests/fairness.test.js`, `tests/ruins.test.js`

**Interfaces — produces:**
- New rock tiles (procedural colours, one material each): Moon `REGOLITH` (falls like `SAND`), `BRECCIA`, `MARE_BASALT`, `ANORTHOSITE`, `LUNAR_MANTLE`; Mars `RUST_REGOLITH` (falls), `ICE_GROUND`, `MARS_BASALT`, `SULFATE`, `MARS_CRUST`; Tessera `ASH`, `HULL_PLATE`, `LATTICE`, `HEAT_SINK`, `MIND`. Tile ids are `Uint8` — 12 existing + 2 (story) + 15 = fine. Collapse must treat `REGOLITH`/`RUST_REGOLITH` exactly as `SAND` (introduce `MATERIALS[].loose: true` and replace `=== TILE.SAND` checks).
- Profiles exactly as spec tables 5.3, 5.4, 5.5 (fractions, tiers, per-stratum `hpMul`, cave style, fluids/gas, ore hosts), plus `H`, `gravity` 0.4 / 0.6 / 1.4, `air`, `pulse.mul` 0.5 / 1 / 3, `quake.mul` 1.5 / 0.5 / 0, `hpMul` 1.5 / 2 / 3, `eras` `[6]` / `[7]` / `[]` (Tessera has no ore need of its own: its meteorite feeds leftover era-7 costs — give it `needFrom: [7]` restricted to meteorite, rhodium, platinum, diamond).
- Ore hosts per planet: `PLANETS[p].ores = { [oreId]: { strata: number[], weight } }` overrides `ORES[].hosts/weight` when present (Earth has none and keeps using `hosts`). "Very rich" in the spec = weight ×3.
- Cave open budgets: Moon regolith 0–1%, breccia 6–9%, mare basalt 10–14% (tube radius 3), anorthosite 2–4%, mantle 0; Mars regolith 0–1%, ice ground 6–9% (`pocket`, flat: `fy` ×3), basalt 8–11%, sulfate 8–12% (`karst`), crust 3–5% (`fissure`); Tessera ash 3–5% (`pocket`), hull 4–6%, lattice 12–16%, heat sink 14–18%, Mind 0 (all `corridor`).
- Set pieces (spec 6.4): `cold_trap` (anorthosite; water-ice walls; inside: battery idle drain ×2 — a zone rect check in `Energy`), `tube_cathedral` (mare basalt, 30×9, hosts the `relay_alpha` ruin inside it), `regolith_slide`; `ice_lens`, `brine_pocket`, `methane_vent`, `dust_sink`; `fabricator_hall` (meteorite hoard, pulse gap ÷2 while inside), `coolant_channel`, `data_vault` (the `origin_core` ruin, heat-sink stratum).
- Ruins: `planRuins(seed, W, H, planet)` — Earth unchanged; other worlds return one ruin (`relic` id from the profile) placed in the stratum named by the profile (`ruinStratum`: Moon 2, Mars 3, Tessera 3). `relicIdAt(planetId, y, H)` (signature gains `planetId`; update the story plan's callers). Ruin fill: Moon air (vacuum), Mars methane, Tessera coolant (water).
- Goal: profile `goal` — `'core'` (Earth, existing chamber), `'relic'` (Moon, Mars: no chamber; taking the relic sets `economy.done[planet] = true`), `'mind'` (Tessera: chamber 15×9 at the bottom, stamped by `stampMind(d)` with three node tiles left, right and top; positions exported by `mindNodes(W, H): {x, y}[]`).

- [ ] **Step 1: Failing tests** — `planetdata.test.js` rules now run on four planets (tighten the Task 3 stub test); `fairness.test.js` loops over all planets with 200 seeds each for Moon/Mars and 60 for Tessera (size), asserting ore floors/ceilings from `oreNeed(planet)`, reachability with that world's tiers (goal reachable with tier 8 on Tessera), budgets, safety, exactly one ruin; plus:
```js
it('deep maps are paced: every 120-row window below the surface holds a set piece and a flat 4×4 air spot', () => {});
it('Tessera caves are straight: ≥ 90% of air tiles in the lattice lie on a full row-run or column-run ≥ 5', () => {});
it('Tessera generates in < 1.5 s and encodes in < 0.5 s', () => {});
it('regolith falls like sand', () => {});
```
- [ ] **Step 2–4:** fail → implement. Pacing: after set-piece planning, for each empty 120-row window add one extra landmark from that stratum's pool and guarantee a 4×4 air pocket with a solid floor (carve if absent, outside `protect`). → pass. **Step 5: Checkpoint.**

---

### Task 5: Launch pad and travel

**Files:** Create `systems/Travel.js`, `ui/TravelScreen.js`; Modify `config.js` (`TRAVEL`, `WORLD.BASE_CAMP.BUILDING_SLOTS.launch_pad`), `main.js` (prompt/interaction like other buildings, `onTravel`), `systems/Economy.js`, `world/Ruins.js` (`clearOwnedRelics` already per relic id), `render/*` (placeholder pad box + rocket silhouette); Test new `tests/travel.test.js`

**Interfaces — produces:**
- `TRAVEL = { COST: { moon: { [ITEM.PROPELLANT]: 10 }, mars: { [ITEM.PROPELLANT]: 25 }, tessera: { [ITEM.WARP_CHARGE]: 3 }, earth: {} }, FLAG: { moon: 'dest_moon', mars: 'dest_mars', tessera: 'dest_tessera' } }`.
- `destinations(economy): { id, name, known: boolean, cost, affordable: boolean, current: boolean }[]` — Earth always known and free.
- `canTravel(economy, dest): { ok, reason? }` — reasons: `'Launch pad not built'` (needs tech effect `launch_pad`), `'Unknown destination'`, `'Already here'`, `'Not enough Propellant'` / `'Not enough Warp Charges'`.
- `travelState(economy, dest): object` — pays the cost, then returns `economy.newMapState()` with `planet: dest`, `elevatorStops: []`. `main.js` `onTravel(dest)`: `saves.setCarry(travelState(economy, dest)); saves.clear(); restart();` — one call, guarded by a `travelling` flag so a double click cannot pay twice.
- Camp exists on every world (same pad, same buildings — "the ship is the camp"); the launch pad slot is drawn once `launch_pad` is owned; `E` near it opens `TravelScreen` (list from `destinations`, button per row).
- First arrival on a world sets story flag `landed_<planet>`.

- [ ] **Step 1: Failing tests**
```js
it('Earth is always a free destination', () => {});
it('unknown, unaffordable and current destinations are refused with the right reason', () => {});
it('travel pays once and keeps stash, tech, gear, relics, cargo materials', () => {});
it('travel clears contracts, stations, field camps, elevator stops and resets completed, not finished', () => {});
it('from the Moon with zero Propellant, Earth is still reachable', () => {});
it('a world whose relic is owned spawns its ruin empty', () => {});
```
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 6: Cargo elevator

**Files:** Create `systems/Elevator.js`, `ui/ElevatorScreen.js`; Modify `config.js` (`ELEVATOR`), `main.js`, `render/*` (stop marker), `ui/HUD.js` (prompt), `ui/Minimap.js` (stops); Test new `tests/elevator.test.js`

**Interfaces — produces:**
- `ELEVATOR = { STOP_COST: { ores: { [ITEM.STEEL]: 10, [ITEM.CARBON_FIBER]: 4 } }, MAX: { earth: 4, moon: 8, mars: 12, tessera: 16 }, MIN_GAP: 20, SPEED_TILES_S: 30, POWER_PER_10_TILES: 1 }`.
- `canPlaceStop(economy, world, tx, ty): { ok, reason? }` — needs tech effect `elevator`; standing on solid floor with 2 tiles of headroom; ≥ `MIN_GAP` rows from every other stop and from the surface; below `MAX[planet]`; affordable.
- `placeStop(economy, world, tx, ty)`; `stops(economy): {x, y, label}[]` — the camp is always stop 0 ("Camp"), others labelled by depth in metres.
- `ride(economy, from, to): { ok, seconds, power, reason? }` — `seconds = |Δrows| / SPEED_TILES_S`; draws `power` from the camp pool (`drawPower` from `Power.js`); refuses with `'Not enough camp power'`. `main.js` plays a fade, moves the player to the stop tile, advances hazards by nothing (the ride is a pause).
- Placing: a key action `place_stop` in the Input Map (bind like the charging station placement); `E` at a stop opens `ElevatorScreen`.
- Field camp cap per planet: `CAMP.FIELD_CAMP.MAX` becomes a per-planet lookup `{ earth: 3, moon: 5, mars: 7, tessera: 9 }`; station cap likewise `4 / 6 / 8 / 10`.

- [ ] **Step 1: Failing tests** — placement rules (each refusal reason), cost paid once, max per planet, `ride` time and power maths (`300 rows → 10 s, 30 power`), refusal on empty pool, stops cleared by `travelState`, camp/stations caps per planet.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 7: Missions and log for chapters 6–8

**Files:** Modify `web/src/story.js`, `config.js` (`STORY.REWARD_BY_CHAPTER = [10, 30, 250, 3000, 80000, 200000, 500000, 0]`), `systems/Story.js` (flags `landed_*`, `mind_greeted`, `finished`; `when: {finished: true}`); Test `tests/story.test.js`

**Data:** append, in this order (chapter in brackets): build the Launch Pad `{tech:'orbital_station'}` [6] → build the Cargo Elevator `{tech:'elevator'}` [6] → land on the Moon `{flag:'landed_moon'}` [6] → recover Relay Alpha `{relic:'relay_alpha'}` [6] → achieve Fusion Power `{tech:'fusion_power'}` [6] → forge the Plasma Cutter `{tech:'plasma_cutter'}` [6] → land on Mars `{flag:'landed_mars'}` [7] → recover Relay Beta `{relic:'relay_beta'}` [7] → forge the Lattice Cutter `{tech:'lattice_cutter'}` [7] → build the Warp Drive `{tech:'warp_drive'}` [7] → reach Tessera `{flag:'landed_tessera'}` [8] → take the Origin Core `{relic:'origin_core'}` [8] → reach the Mind `{flag:'mind_greeted'}` [8] → reverse the three siphons `{finished:true}` [8]. The story plan's last mission ("Research Rocketry and follow the signal") stays before these.

Log entries (≤ 60 words each, tone of the existing ones; `modal: true` on the three relic entries): `land_moon`, `relic_relay_alpha` (the relay is older than the Seed and still listening), `land_mars`, `relic_relay_beta` (a star map with one route marked — "an invitation", foreshadowing), `land_tessera` (a planet with no rock left in it), `relic_origin_core`, `final` `{finished:true}` ending with the fixed last line.

- [ ] **Step 1: Failing tests** — data well-formed (ids unique, references exist, chapters 1–8); mission order reaches the end when all conditions are met; `final` entry text ends with the fixed line.
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 8: The final sequence and ending

**Files:** Create `systems/MindGoal.js`; Modify `config.js` (`MIND_GOAL = { NODE_S: 20, PULSE_EVERY_S: 8, COOLANT_ROWS: 2, NODE_RANGE: 1.5 }`), `main.js`, `ui/Ending.js`, `ui/HUD.js`, `systems/Hazards/Pulse.js` (`trigger()` public), `systems/Hazards/Fluids.js` (helper to raise a level in a rect); Test new `tests/mindgoal.test.js`

**Interfaces — produces:**
- `class MindGoal { constructor(world, bus, economy); update(dt, px, py): void; progress: number /* 0..1 of the current node */; activeNode: number /* -1 = none */ }`, hooks `onPulse()`, `onRaiseCoolant(rows)`.
- Rules: only on `planet === 'tessera'`. Entering the chamber without `origin_core` → toast once per entry "The Mind does not open." With it, first entry sets `economy.mind.greeted`, story flag `mind_greeted`, and emits `EV.MIND_GREETING` (main shows a `StoryModal` titled with the fixed greeting line and the twist text of spec 3.1 "The twist", then "The choice the Mind offers"). After the greeting, standing within `NODE_RANGE` tiles of an unfinished node (`mindNodes`) accumulates hold; leaving the range or dying resets the hold of that node only; at `NODE_S` the node index is pushed to `economy.mind.nodes`, `economy.mind.coolant += COOLANT_ROWS`, `onRaiseCoolant` is called. While any node is unfinished and the player is in the chamber, `onPulse` fires every `PULSE_EVERY_S`. Nodes may be done in any order. On load, the coolant level is re-applied from `economy.mind.coolant`.
- Third node → `economy.finished = true`, `EV.FINISHED`. `main.js` then shows the ending as three `StoryModal` pages built from spec 3.1 ("The resolution", "After", final scene) and finally the `Ending` screen titled `THE SEED IS SILENT — FOR GOOD` with the fixed last line and a `Keep digging` button.
- After `finished`: `Pulse` and `Quake` never fire on any world; HUD objective shows "All objectives complete".
- HUD during the sequence: node counter `Siphons 1/3` and the hold bar (reuse the Core hold bar).
- Requirements to survive are gear, not new mechanics: `heat_suit_3` for the chamber heat (same check style as `CoreGoal`'s heat suit: without it, the existing heat damage applies — no instant death).

- [ ] **Step 1: Failing tests**
```js
it('nothing happens without the Origin Core', () => {});
it('greeting fires once, then nodes can be held', () => {});
it('holding a node for 20 s completes it and raises the coolant 2 rows', () => {});
it('leaving or dying resets only the node in progress', () => {
  // complete node 0, hold node 1 for 15 s, emit PLAYER_DEAD: nodes === [0], coolant === 2, progress === 0
});
it('pulses fire every 8 s during the sequence', () => {});
it('nodes complete in any order; the third sets finished and emits FINISHED once', () => {});
it('mid-sequence state survives a save round-trip', () => {});
it('after finished, Pulse and Quake never fire, on a new Earth map too', () => {});
```
- [ ] **Step 2–4:** fail → implement → pass. **Step 5: Checkpoint.**

---

### Task 9: Whole-game verification

- [ ] `npm test` and `npm run build` succeed; the fairness suite covers four planets.
- [ ] Dev server on 5273, Dev panel to grant techs/relics as needed:
  - Earth: launch pad appears after `orbital_station`; destination screen lists only known worlds; travelling to the Moon costs 10 Propellant.
  - Moon: floaty falls, same jump height, faster battery drain underground, no water or gas anywhere, giant tubes in the mare basalt, a cold trap with ice, the relay ruin inside the cathedral tube; free return to Earth with empty tanks.
  - Elevator: place three stops, ride between them, power is drawn, stops show on the minimap.
  - Mars: dust sinks collapse, brine and methane pockets exist, tier-8 rock refuses the Plasma Cutter with the right hint.
  - Tessera: straight corridors, heavy falls, frequent pulses; minimap and camera work at 1000 rows; frame rate stays smooth while descending (note the measured FPS).
  - Final sequence: greeting modal with the fixed line; three nodes in a chosen order; die once mid-node and confirm only that node resets; ending pages, then the final screen; afterwards no pulses on a new Earth map.
- [ ] Load a save from before this plan: opens on Earth, no console errors.
- [ ] Screenshots for the user: each world's surface camp, one cave per world, the destination screen, the elevator screen, the greeting and the final screen.
