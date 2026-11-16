# Planets and World Generation — Design

Date: 2026-11-16 · Scope: web game (`web/`) only · Status: draft for review
Builds on: `2026-11-16-story-and-blueprints-design.md` (story, relics, ruins, pulse storm) and its plan `docs/plans/2026-11-16-story-and-blueprints.md`. This is sub-project 4 ("Space program") of the tech-tree redesign, widened to cover how every map is generated.

## 1. Intent

Today a map is one fixed recipe: six rock bands, one noise field for caves, ore sprinkled by weight, a few stamped zones. Nothing guarantees that a seed contains what the tech tree asks for, and the Moon, Mars and the stars are "coming soon" placeholders.

This design defines:

1. **One generator, many planets** — a map is built from a *planet profile* (data), so Earth, the Moon, Mars and the Seed's home world share one algorithm.
2. **Tile logic by depth** — what rock, ore, fluid and gas may appear where, and why.
3. **Cave logic** — ordinary caves follow the geology of their layer; special caves ("set pieces") follow risk-and-reward rules.
4. **Fairness** — after generating, the map is *audited* against the tech tree and repaired, so every seed is winnable and no seed is a jackpot.
5. **The space story** — what the player finds on each world.

### Goals
- Every seed on every planet can be finished with the gear the story gives at that point.
- Difficulty comes from depth, hazards and logistics, never from a missing resource.
- Each layer and each planet feels like a different place, for a reason a geologist would accept.

### Non-goals
- Persisting several planets' maps at once (travelling makes a fresh map, as "New Map" does today). Free-roam space flight. New pixel art (procedural colours; cartoon rocket art stays a later TODO item). Enemies.

### Anti-goals
- A generator that needs hand-tuning per seed. A planet the player can be stranded on.

## 2. Approaches considered

| | What | Trade-off |
|---|---|---|
| A | Keep the current generator, add per-planet `if`s and hand-placed extras | Quick for one planet, unmaintainable by the third; no fairness guarantee |
| **B (recommended)** | Data-driven planet profiles + generate → audit → repair pipeline | One refactor of `WorldGen.js`, then planets are mostly data; fairness is testable over many seeds |
| C | Hand-designed fixed maps per planet | Best pacing control, but kills replay (daily seed, New Map) which the game is built around |

## 3. The space story (continues "The Deep Signal")

The Seed's last transmission was relayed by two older machines. Each world is one chapter; each has one ruin holding a relic, like Earth's layers.

| World | Unlocked by | Why go | What is there | Relic → what it gates |
|---|---|---|---|---|
| **Earth orbit** (no map) | `orbital_station` | Triangulate the signal above the pulse zone | A destination screen at the launch pad; shows which worlds are known | — |
| **The Moon** | `lunar_landing` | First relay, buried in a lava tube under Mare Imbrium | Vacuum, 1/6 gravity, no water or gas, moonquakes; helium-3 in the regolith, water ice in cold traps | `relay_alpha` → `fusion_power`, and required by `mars_mission` |
| **Mars** | `mars_mission` | Second relay, under the ice-cemented ground of Utopia Planitia | 0.38 gravity, thin CO2 air, toxic perchlorate dust, brine and methane pockets | `relay_beta` (the star map) → required by `interstellar` |
| **Tessera** (the source, 40 light-years) | `interstellar` (needs `warp_drive`) | Answer in person | The hardest world and the last: a planet the Seeds finished converting long ago. Strata of machine, 1.4 gravity, constant pulses, 1000 tiles deep | `origin_core` → the final sequence |

### 3.1 The ending (closed; happens at the bottom of Tessera)

**The twist — "Seed 4,117".** When the player reaches the Mind at Tessera's core, it does not attack. It greets the ship in the handshake of the Control Key: *WELCOME, SEED 4,117. REPLICATION CONFIRMED.* A Seed that lands on a living world does not copy itself. It threatens the planet slowly, and leaves its own blueprints where diggers will find them, in the order they will need them. The natives, out of desperation, build the next Seed themselves — a ship of Seed alloy, Seed power and a Seed drive — and carry it home. The expedition was never hunting the machine. It *was* the machine's reproduction, and it has just completed.

**Why it is logical (all foreshadowed in what the player already saw):**
- One relic per layer, each exactly the technology needed for the next layer, each ruin with a convenient crack in its hull.
- The pulses destroy fine electronics but spare thick conductors, kilns and chemistry — precisely enough to rebuild from.
- The Seed slept for millions of years and woke a century after humans started broadcasting radio: it was waiting for a species able to dig.
- At Earth's core it "did not even notice" the player until they carried its own Control Key.
- The Mars relay's star map was not a clue left by accident. It was an invitation.

**The choice the Mind offers** is not a choice: it begins copying the ship's pattern — crew included, as components — into every Seed it will ever launch.

**The resolution.** The ship is trusted as a Seed, so the player can reach the one place no enemy could: the Mind's heat sink. The Thermal Siphon the Seed taught them on Earth runs both ways. The final sequence (section 8.4) reverses three siphon nodes and pours a planet's stored heat back into the Mind. It melts.

**After.** Every Seed is built with one fail-safe: with no carrier from home, go dormant — that is why Earth's Seed could sleep for ages. With the Mind gone the carrier stops, and every Seed on every world falls silent for good. Earth's core keeps its heat; the convection recovers and the magnetic field rebuilds over decades. The warp drive is the player's own work and still runs. Final scene: the valley camp, a compass needle holding steady north, and the bronze pickaxe hung on the wall of the Trading Post. Last log line: "We were supposed to be its children. We turned out to be its cure." No sequel hook, nothing left unanswered.

The Earth ending text and the relic log entries in the story plan stay exactly as written: the player must still believe "It called home. We had better answer in person", and the foreshadowing is already in what those entries say.

Science notes used for the worlds: lunar mare basalt really is ilmenite-rich and the regolith holds solar-wind helium-3; permanently shadowed craters hold water ice; lunar lava tubes are real and huge because of low gravity. Mars has perchlorate salts in its soil, ground ice, possible brines, and unexplained methane.

## 4. Planet profile (data)

`PLANETS` in `config.js`, one entry per world:

```js
{
  id: 'earth', name: 'Earth',
  H: 256,                     // map height in tiles (width is always 64): Earth 256, Moon 448, Mars 704, Tessera 1000
  gravity: 1,                 // multiplier on Physics gravity and fall damage
  air: 'breathable',          // 'breathable' | 'thin' | 'vacuum'  (vacuum/thin: suit life support drains the battery while underground)
  pulse: { mul: 1 },          // pulse-storm frequency multiplier (0 = none)
  quake: { mul: 1 },
  hpMul: 1,                   // rock HP multiplier (how tough this world's rock is)
  strata: [ ... ],            // section 5
  setPieces: { ... },         // section 7
  relic: 'per-layer' | '<relic id>',   // Earth keeps its five layer ruins; other worlds have one ruin in their deepest stratum but one
  goal: 'core' | 'relic',     // what "finishing" this world means
}
```

Every world after Earth is deeper: Moon 448 tiles (≈3.6 km), Mars 704 (≈5.6 km), Tessera 1000 (8 km). Width stays 64. The save stores `planet`; a save without it is Earth. Code that assumes `WORLD.H` (save validation, minimap, depth fractions, chunk cache) must read the height from the world instead.

## 5. Tile logic by depth

### 5.1 Strata

A stratum is `{ tile, from, to, tier, cave, fluids, gasChance }` with `from/to` as fractions of the underground (boundaries wobble with noise as today). Rules that hold on every planet:

- **Tier rises with depth** by at most one per stratum, so the next layer is always one tool upgrade away, never two.
- **A stratum never hosts an ore whose tier is more than one above its own rock tier** (a "preview" ore the player can see but not yet take — it advertises the next upgrade).
- **Every ore lives in at most two neighbouring strata** (as now), richer toward the bottom of the upper one (existing depth bias). So going deeper is always the better source, but never the only one.
- **Fluids obey temperature and pressure**: liquid water only where the profile allows it; magma only in the deepest two strata; gas only in sealed pockets.

### 5.2 Earth (unchanged bands, rules made explicit)

| Stratum | Depth | Tier | Geology → cave style | Fluids / gas | Ores (existing hosts) |
|---|---|---|---|---|---|
| Topsoil & clay | 0–15% | 1 | Loose ground cannot hold a void → almost no caves, sand pockets | — | coal, iron, lead, zinc, bauxite |
| Limestone | 15–35% | 2 | Karst: water dissolved it → long galleries, vertical shafts | water (aquifers) | + copper, nickel, lithium, tin, fossil, oil shale |
| Granite | 35–55% | 3 | Hard and jointed → few, narrow diagonal fissures | sealed gas pockets | cobalt, uranium, lapis, silver, tungsten, ilmenite |
| Basalt | 55–78% | 4 | Old lava flows → long horizontal lava tubes | water seeps | opal, platinum, gold, meteorite |
| Mantle rock | 78–92% | 5 | Hot, plastic → only magma chambers and channels | magma | rhodium, ruby, diamond, meteorite |
| Core rock | 92–100% | 6 | none; the Core chamber | magma | — |

### 5.3 The Moon

`gravity 0.4` (1/6 would be unplayable; 0.4 reads as "floaty"), `air: 'vacuum'`, no fluids, no gas, `pulse.mul 0.5`, `quake.mul 1.5`, `hpMul 1.5`.

| Stratum | Depth | Tier | Cave style | Ores |
|---|---|---|---|---|
| Regolith (dust; behaves like sand) | 0–8% | 5 | none; collapses | **Helium-3**, iron, bauxite |
| Megaregolith (impact breccia) | 8–30% | 6 | rubble voids: many small pockets | ilmenite, **Rare Earths (KREEP)**, nickel |
| Mare basalt | 30–60% | 6 | giant lava tubes (radius 3–4) | ilmenite (very rich), cobalt, platinum |
| Anorthosite crust | 60–88% | 7 | rare fissures; **cold traps** with **Water Ice** | bauxite (very rich), uranium, gold |
| Lunar mantle | 88–100% | 7 | none; the relay ruin sits at its top | diamond |

### 5.4 Mars

`gravity 0.6`, `air: 'thin'`, `pulse.mul 1`, `quake.mul 0.5`, `hpMul 2`.

| Stratum | Depth | Tier | Cave style | Fluids / gas | Ores |
|---|---|---|---|---|---|
| Rusty regolith | 0–6% | 6 | none; dust sinks (sand) | — | iron (very rich), **Perchlorate** |
| Ice-cemented ground | 6–25% | 7 | ice lenses: flat wide pockets | **Water Ice** as ore; brine (water) pockets | Water Ice, lead, zinc |
| Basalt | 25–55% | 7 | lava tubes | methane (gas) pockets | copper, nickel, cobalt, tungsten |
| Sulfate & clay beds | 55–82% | 8 | karst-like dissolution caves | brine | lithium, uranium, opal |
| Deep crust | 82–100% | 8 | fissures | magma traces | platinum, rhodium, diamond |

### 5.5 Tessera

`gravity 1.4`, `air: 'thin'`, `pulse.mul 3`, `quake.mul 0`, `hpMul 3`. Artificial strata, so caves are **corridors**: straight horizontal and vertical runs on a grid, not noise.

| Stratum | Depth | Tier | Structure | Ores |
|---|---|---|---|---|
| Ash crust | 0–5% | 7 | natural rubble | iron, coal |
| Hull plating | 5–30% | 8 | sparse service corridors | **meteorite (very rich)**, platinum |
| Lattice | 30–62% | 8 (HP ×1.5) | dense corridor grid, coolant (water) channels | meteorite, rhodium |
| Heat sink | 62–92% | 8 (HP ×2) | wide halls, magma-hot coolant | rhodium, diamond |
| The Mind | 92–100% | 8 (HP ×3) | the final chamber with three siphon nodes | — |

Tessera is the hardest world on every axis at once: deepest map, toughest rock, heaviest gravity (falls hurt most, jetpack weakest), pulses three times as often, and no natural caves to rest in — only the machine's own corridors.

### 5.6 New ores and materials (appended ids; procedural colours)

| Item | Kind | Found / made | Used for |
|---|---|---|---|
| Helium-3 | ore | Moon regolith | Fusion Fuel |
| Rare Earths | ore | Moon megaregolith | Superconductor |
| Water Ice | ore | Moon cold traps, Mars ice ground | Propellant, Fusion Fuel |
| Perchlorate | ore | Mars regolith | Propellant |
| Propellant | material | Refinery 2: 2 water ice + 1 perchlorate (or + 2 fuel on the Moon) | launch cost between worlds |
| Fusion Fuel | material | Lab 2: 2 helium-3 + 1 water ice | Generator 4 fuel, `interstellar` |
| Superconductor | material | Lab 2: 2 rare earths + 1 copper wire | `fusion_power`, `interstellar` |

Tech additions (era 6): `fusion_power` (relic `relay_alpha`; Generator level 4 "Fusion Reactor"), `mars_mission` gains relic `relay_alpha`, `interstellar` gains relic `relay_beta`, and their costs swap part of the enriched uranium/fuel for Propellant, Fusion Fuel and Superconductor. The four placeholder effects (`coming_soon`) are replaced by `{unlock:'dest_<planet>'}`.

## 6. Cave logic

### 6.1 Ordinary caves — one of five styles per stratum

| Style | Algorithm | Result |
|---|---|---|
| `none` | — | solid ground |
| `karst` | fBm noise stretched horizontally (low `freqX`), plus 1–3 vertical "worm" shafts per 64 columns that link galleries | galleries and pits |
| `fissure` | ridged noise (thin where `|noise|` is near 0), rotated ~30° | narrow diagonal cracks one tile wide |
| `tube` | horizontal random-walk worms, radius from profile, gentle slope, never crossing the camp shaft column | long tunnels |
| `pocket` | high-frequency fBm with a high threshold | many 2–4 tile voids |
| `corridor` (Tessera) | grid: horizontal runs every 6–9 rows, vertical links every 8–14 columns, each segment kept with probability from the profile | machine halls |

### 6.2 Open-space budget (difficulty control)

Caves make travel cheap, so their amount is fixed per stratum, not left to the seed: each stratum has `open: [min, max]` (fraction of its tiles that are air). After carving, the generator measures the fraction and moves the noise threshold by bisection (max 8 steps) until it lands inside the range. Starting budgets for Earth: soil 0–1%, limestone 8–12%, granite 3–5%, basalt 7–10%, mantle 4–6% (magma counts as open).

### 6.3 Rules for all caves

- Nothing is carved in the top `CAVE_MIN_DEPTH` rows, under the camp pad, or within 2 columns of the camp shaft for the first 15% of depth (the first descent is always dug, never fallen).
- No fluid or gas tile may touch the shaft column in the first stratum.
- A cave floor wider than 6 tiles in `karst` gets a 30% chance of standing water one tile deep.
- Caves never break through the stratum boundary of a higher tier by more than 2 rows (no free shortcut past a tool gate).

### 6.4 Special caves (set pieces)

The current zones plus ruins, generalised. Each kind is data: `{ size, strata, hazard, reward, guaranteed }`.

**Rules**
- **Risk pays.** Every set piece pairs one hazard with one reward. Reward value targets 0.5–1.0 expected trip income of the era that can first reach it (`expectedTripIncome`), so finding one is a good day, not a skipped era.
- **One landmark per stratum** is guaranteed (as today), plus 2 drawn from the stratum's pool, plus the ruin where the profile has one.
- **Spacing**: 3 tiles from each other, clear of the shaft, pad and core chamber (as today). At most one set piece of the same kind per stratum.
- **Signposting**: each kind leaves a visible hint 2–3 tiles outside its wall so an attentive player can find it without radar — moss near water, glints near a geode, warm glow near lava, violet flecks near a ruin.
- **Approach**: any piece whose hazard can kill on entry (gas, magma) keeps the safe two-tile approach tunnel.

**Earth pool** (existing seven, three new):

| Kind | Stratum | Hazard | Reward |
|---|---|---|---|
| sand pocket · fossil chamber · aquifer · vault · gas cavern · crystal geode · lava lake | as today | as today | as today |
| `karst_shaft` (new) | limestone | 12–18 tile vertical drop, water at the bottom | ore-lined walls; a fast way down once laddered |
| `lava_tube` (new) | basalt | long (20–30 tiles) and dark, rockfall-prone roof | level highway across the map; opal/gold on the floor |
| `magma_chamber` (new) | mantle | magma on three sides | rhodium/ruby crust on the roof |

**Other worlds**: Moon — `cold_trap` (reward water ice; hazard: battery drain ×2 inside), `tube_cathedral` (huge tube; hosts the relay ruin), `regolith_slide` (sand). Mars — `ice_lens`, `brine_pocket`, `methane_vent` (gas), `dust_sink` (sand). Tessera — `fabricator_hall` (meteorite hoard, pulse ×2 inside), `coolant_channel` (water), `data_vault` (ruin with `origin_core`).

## 7. Fairness: generate → audit → repair

`generateWorld(seed, planet)` becomes a pipeline of pure passes:

1. **Strata** → 2. **Caves** (with open-space budget) → 3. **Fluids & gas** → 4. **Ore veins** → 5. **Set pieces & ruins** → 6. **Core chamber / goal** → 7. **Audit** → 8. **Repair** → 9. **HP**.

### 7.1 Ore audit (the difficulty guarantee)

For each ore the generator knows the **need**: the total amount the tech tree asks for on this planet — every tech, building level and equipment recipe of the eras this planet serves (Earth: eras 1–5 plus `core_interface`; Moon/Mars/Tessera: the era-6 items that name their ores), with materials expanded to raw ores.

- **Floor:** the map must contain at least `1.5 × need` of every ore, of which at least `1.0 × need` outside set pieces. (1.5 leaves room for selling, contracts and waste, without making shortage impossible to feel.)
- **Ceiling:** no ore above `6 × need` or its weight share, whichever is larger (no jackpot seeds).
- **Era-6 megaprojects on Earth are exempt** — `warp_drive`, `interstellar` and Quantum Rig need more meteorite than one Earth holds on purpose: that is what New Map and Tessera's hull strata are for.

Repair: for an ore under its floor, add veins in its richer host stratum (same random-walk rule, seeded stream) until the floor is met; for an ore over its ceiling, turn the excess veins farthest from the shaft back into host rock.

### 7.2 Reachability audit

A flood fill from the camp shaft where a tile is passable if its required tier ≤ T, it is not `ALIEN_HULL`, and it is not magma:

- With T = stratum tier, every stratum's top row must be reachable (no layer sealed off by harder rock).
- Each ruin's breach must be reachable with the pickaxe tier of its own layer (layer 4 on Earth: up to the hull, since it needs a bomb).
- The Core chamber (or the planet's goal) must be reachable with tier 6, crossing magma allowed.

Repair: carve a one-tile-wide vertical "fault" of the layer's own rock tier through the blocker at the column nearest the shaft.

### 7.3 Safety audit

- No magma or water within 3 tiles of the shaft column in the first two strata → drained to air.
- No gas pocket open to the shaft column → sealed with host rock.

### 7.4 Give-up rule

If any audit still fails after repair, regenerate with `seed' = hash(seed, attempt)` (max 8 attempts, then accept the best). The world stores the seed actually used (`genSeed`), because the save recomputes the band map from the seed.

## 8. Travelling between worlds

- **Launch pad**: a new camp structure owned once `rocketry` is researched; `E` opens the destination screen (worlds whose `dest_*` flag is owned).
- **Travel = New Map (keep progress)** with the chosen planet profile and a fresh seed. The camp, buildings, stash, tech and gear travel with the ship. Relics and per-planet `done` flags live in the economy.
- **Launch cost**: Propellant from the stash, per destination (Moon 10, Mars 25, Tessera 0 — the warp drive pays in Warp Charges: 3).
- **Never stranded**: returning to Earth is always free ("emergency return"), from any world, at any time.
- **Life support**: on `vacuum`/`thin` worlds the suit drains battery while underground (starting value: +50% idle drain on `thin`, +100% on `vacuum`); `fusion_power` halves it.
- **Gravity**: scales jump height, fall speed and fall damage; low gravity makes ladders less necessary and jetpack fuel last longer — the Moon is deliberately the "easy to move, hard to stay alive" world and Tessera the opposite.

### 8.1 Deeper worlds need matching technology

A 1000-tile shaft cannot be played with the gear that finished a 256-tile Earth. Each world supplies the materials for the gear the next one demands, so the tech tree keeps its "one upgrade ahead" rhythm. Eras extend to eight: 6 **Space** (Moon; key tech `mars_mission`), 7 **Interplanetary** (Mars; key tech `interstellar`), 8 **Interstellar** (Tessera).

| Need on deep maps | Technology | Era | Made from | Effect (starting numbers) |
|---|---|---|---|---|
| Getting up and down | **Cargo Elevator** (the TODO "elevator") | 5 | steel + carbon fiber per stop | a shaft lift from camp; `E` at a stop rides to any other stop. Stops cost materials, max 4 on Earth, 8/12/16 on the other worlds |
| Harder rock (tier 7) | **Plasma Cutter** (pickaxe 7) | 6 | superconductor + fusion fuel + tungsten carbide | damage 40 |
| Hardest rock (tier 8) | **Lattice Cutter** (pickaxe 8) | 7 | exotic alloy + superconductor + industrial diamond, relic `relay_beta` | damage 64 |
| Longer trips | **Fusion Pack** (rig 6) · **Lattice Frame** (rig 7) | 6 · 7 | fusion fuel + superconductor · exotic alloy + fusion fuel | capacity 2400 kg / 25 000 energy · 4800 kg / 60 000 energy |
| Staying alive | **Pressure Suit** (part of `lunar_landing`) · **Heat Suit III** | 6 · 7 | — · superconductor + exotic alloy | allows vacuum/thin air · heat resist to 1.0 |
| Rest points | more Field Camps and charging stations per map | 6–8 | — | max camps 3 → 5 / 7 / 9 |
| Flying in 1.4 g | **Jetpack V** | 7 | exotic alloy + fusion fuel | thrust 4800 |
| Power for all this | **Fusion Reactor** (Generator 4) | 6 | relic `relay_alpha` | capacity 100 000; burns Fusion Fuel (5000 power each) |

`warp_drive` moves from era 6 to era 7 (it needs Mars-era materials and is the step before `interstellar`). Era 8 has no techs of its own: its content is Tessera and the ending.

Rules: a world's first stratum is always minable with the tool the player must own to get there (Moon tier 5 ≤ diamond drill tier 6; Mars tier 6; Tessera tier 7 ≤ Plasma Cutter), and the tool for its last stratum is built from resources found in its upper strata or on the previous world. `eraPickTier` extends to `[1, 2, 3, 4, 6, 7, 8, 8]`. The ore audit (7.1) computes each world's *need* from the techs and gear of its own era, so each deep map is stocked for exactly the technology it requires.

### 8.2 Pacing of a deep map

Depth alone would be a slog, so deep maps are paced: every ~120 tiles of depth has a guaranteed landmark set piece and enough flat cave floor for a Field Camp; the elevator's stop limit equals roughly one stop per 60 tiles; and the open-space budget rises slightly with depth on Moon and Mars (tubes and ice lenses), while Tessera gives corridors instead.

### 8.3 Performance

64 × 1000 = 64 000 tiles (Earth: 16 384). Typed arrays and the chunk cache already scale; fluid/gas/collapse simulations have per-tick caps. The save's RLE handles the size. A test generates and saves a Tessera map under a time budget (generation < 1.5 s, encode < 0.5 s on the test machine).

### 8.4 The final sequence (Tessera, The Mind)

Reaching the chamber with `origin_core` owned triggers the greeting (3.1) as a modal. Then the player must reverse three **siphon nodes** placed left, right and top of the chamber: stand at each for 20 s. During the sequence pulses arrive every 8 s, and after each node the magma-hot coolant rises two rows. A death restarts only the node in progress, not the whole sequence. Completing the third node shows the ending screens and marks the game finished; play continues afterwards on any world, with pulses and quakes switched off everywhere (the Seeds are dormant).

## 9. Missions and log (added to the story plan's data)

Chapters: 6 **The Relays** (Moon), 7 **The Invitation** (Mars), 8 **Seed 4,117** (Tessera). Missions: build the Launch Pad → build the Cargo Elevator → land on the Moon → recover Relay Alpha → achieve Fusion Power → forge the Plasma Cutter → land on Mars → recover Relay Beta → forge the Lattice Cutter → build the Warp Drive → reach Tessera → take the Origin Core → reach the Mind → reverse the three siphons. Log entries: one on first landing on each world, one per relic, the greeting, and the final entry (3.1). Exact wording is left to the builder in the tone of the existing entries (≤ 60 words each), except the greeting line and the last log line, which are fixed in 3.1.

## 10. Save and compatibility

- Save gains `planet` (default `'earth'`) and `genSeed`; the world-size check uses the planet's height. `SAVE.VERSION` bump.
- **Existing Earth saves keep their world untouched**; the new generator only runs for new maps. Because the cave and ore passes change, a given Earth seed produces a different map than before — acceptable (the daily seed is only compared within a day), but the snapshot test "existing zones unchanged" from the story plan is retired for Earth and replaced by "same seed → same map" determinism tests.

## 11. Testing

- Determinism: same `(seed, planet)` → identical arrays.
- **Fairness over 200 seeds per planet**: ore floors and ceilings hold; reachability holds; safety holds; open-space fraction of every stratum is inside its budget; exactly one landmark and one ruin (where defined) per stratum; give-up rule used in < 2% of seeds.
- Rules of 5.1 as data tests: tier steps ≤ 1; every ore in ≤ 2 neighbouring strata per planet; preview-ore rule.
- Need calculation: for Earth, `need(METEORITE)` equals the hand-computed figure from the era-5 recipes.
- Travel: launch cost paid; free return; relics and stash survive; a world with its relic owned spawns an empty ruin.
- Deep maps: each world's first stratum is minable with the tool required to arrive; the tool for its last stratum is craftable from ores present on that world or earlier ones; a landmark exists in every 120-tile depth window; Tessera generates and encodes within the time budget.
- Final sequence: three nodes in any order complete it; death resets only the current node; afterwards pulses and quakes are off on every world.
- Physics: gravity multiplier applied to fall damage and jump; life-support drain by `air`.
- Manual (port 5273): one descent on each planet with the Dev panel; screenshots of each stratum's cave style.

## 12. Delivery order (two plans)

1. **Generator refactor on Earth**: planet profile for Earth, cave styles, open-space budget, three new set pieces, signposting, audit and repair, `genSeed`. Playable and better on its own. Must land **after** the story plan's Task 3 (ruins), which it absorbs into the set-piece pass.
2. **Planets**: variable map height; Moon, Mars, Tessera profiles; new ores, materials, eras 7–8 and gear (8.1); elevator; launch pad and travel; gravity and life support; missions, log, the final sequence and ending.

## 13. Left to the builder / open numbers

All numbers marked "starting" (open-space budgets, audit factors 1.5 and 6, launch costs, life-support drain, gravity values) are Claude's proposals to be tuned by the fairness tests and play. Exact strata boundaries for the new worlds, colours of new tiles, and final log wording are the builder's.
