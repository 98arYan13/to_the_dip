# Story, Challenges and Alien Blueprints — Design

Date: 2026-11-16 · Scope: web game (`web/`) only · Status: draft for review
Builds on: `2026-11-12-tech-tree-redesign-design.md` (this is its sub-project 3, "Blueprints", widened to carry the story).

## 1. Intent

The game has six tech eras and a "stabilize the Core" goal but no reason for any of it. This design adds:

- a **story** that explains why a miner starts with a bronze pickaxe and ends with a warp drive;
- **challenges**: a chapter-by-chapter mission line plus optional feats;
- **alien relics** (blueprints) found in the world that gate the late tech tree, so alien technology is something the player digs up, not something they buy.

The user's brief: "begin with the need to save the world from an alien anomaly, but you need to obtain that alien tech to save the world"; sci-fi with real science logic; fit the current tech tree, overhauling it where needed.

### Goals
- Every existing system (eras, ores, hazards, Core goal, space nodes) gets a story reason without being rebuilt.
- Alien tech is earned by exploring dangerous designed places.
- The science holds up at the level of a good popular-science book.

### Non-goals
- Enemies or combat. Planet maps (still sub-project 4). New pixel art (procedural tile colours for now; no Gemini). The Godot game.

### Anti-goals
- Walls of text that stop play. Story is short log entries the player may skip.
- Relics that can soft-lock a save (see 5.4).

## 2. Approaches considered

| | What | Trade-off |
|---|---|---|
| A | Story text and missions only, on current mechanics | Fast, but the aliens exist only in text |
| **B (chosen by user)** | A + alien ruin zones holding relics that gate key techs + a pulse-storm hazard | Medium size; reuses zones, hazards and the tech graph |
| C | B + defence machines and combat | Turns a digging game into an action game; much larger |

## 3. Story: "The Deep Signal"

### 3.1 Premise (science logic)

- **The Seed.** A self-replicating alien probe (a von Neumann machine) struck Earth millions of years ago and sank through the crust. Its scattered hull is what the game already calls **Meteorite** ore, with **Rhodium** and **Platinum** as its alloying metals — which is why Exotic Alloy needs exactly those three.
- **Why the world is ending.** The Seed has woken and is powering its replication with heat drawn from the core. Earth's magnetic field is made by convection in the liquid outer core (the geodynamo); convection needs the heat gradient the Seed is flattening. Result: more quakes (existing Quake hazard), a weakening magnetic field, and in a few decades no shield against solar wind.
- **Why you start with bronze.** The Seed emits strong electromagnetic pulses. Induced currents burn out fine semiconductor junctions within hundreds of kilometres, while thick conductors, simple relays and chemistry survive. The expedition's modern equipment died on arrival; the only way down is to rebuild an industrial chain on site, from kilns upward, and to learn how to shield electronics.
- **Why you need alien tech.** Human engineering cannot survive the deepest layers or talk to the machine. Each ruin the Seed left on its way down holds a piece of its own engineering. Reverse-engineering those pieces is the only route to the Core and to shutting the Seed down.
- **The twist.** Shutting down the Seed does not end it. Its last transmission went to relay stations on the Moon and Mars, and from there to its origin. The Space era is the pursuit: orbit to triangulate, Moon relay, Mars relay, then the source.

### 3.2 Chapters

Chapter = era. Chapter 6 splits at the Core.

| # | Era | Title | Beat |
|---|---|---|---|
| 1 | Bronze Age | Blackout | Everything electronic is dead. Rebuild from clay and ore. First odd metal shard in the sand. |
| 2 | Iron Age | Iron and Static | A crude radio hears the Seed's rhythm. First pulse storm. |
| 3 | Industrial | The Cage | A flooded gallery holds a lattice that pulses cannot cross. Electronics become possible again. |
| 4 | Electric | Borrowed Fire | The machine turns heat into power with no moving parts. So can you. |
| 5 | Atomic | The Loom | Learn to re-forge the Seed's own hull, then find the key to its control system. |
| 6a | — | The Heart | Shut the Seed down in the Core chamber. |
| 6b | Space | The Relays | The signal already left. Follow it. (Placeholder nodes until sub-project 4.) |

## 4. Tech tree overhaul

Era structure, ids and costs stay unless listed here. `TECH` entries gain an optional `relic: '<relic id>'` field; `canUnlock` refuses with `Requires relic: <name>` when it is missing.

### 4.1 Relics

| id | Name | Found in | What it teaches |
|---|---|---|---|
| `hull_shard` | Hull Shard | Layer 1 ruin | The alloy rings at the Seed's pulse frequency: a detector |
| `shield_lattice` | Shielding Lattice | Layer 2 ruin | A metamaterial cage geometry that blocks the pulses |
| `thermal_siphon` | Thermal Siphon | Layer 3 ruin | Solid-state heat-to-electricity conversion (advanced thermoelectrics) |
| `matter_loom` | Matter Loom | Layer 4 ruin | How the Seed re-forges its own hull metal |
| `control_key` | Control Key | Layer 5 ruin | The handshake the Seed's control system accepts |
| `seed_core` | Seed Core | Granted on Core shutdown | The probe's drive: folding space |

### 4.2 New and changed techs

| Tech | Era | Change |
|---|---|---|
| `pulse_detector` (new) | 2 | requires `radio`, relic `hull_shard`. Cost ≈ other era-2 techs (copper wire + solder). Effect `{unlock:'pulse_detector'}`: pulse warning time ×2 and the nearest unlooted ruin is pinged on the minimap. |
| `faraday_shielding` (new) | 3 | requires `blast_furnace`, relic `shield_lattice`. Cost: copper wire + stainless. Effect `{stat:'pulseResist', add:0.5}`. |
| `electronics` | 4 | No relic dependency (it is an ancestor of the era-4 key tech `fission`, and the era chain must never be relic-blocked). Description: circuits that only survive inside the camp's grounded cage. |
| `charge_station`, `titanium_drill`, `precision` | 4 | add `requires: faraday_shielding` — electronics that leave camp need the lattice. |
| `thermal_power` (new) | 4 | requires `electronics`, relic `thermal_siphon`. Cost: aluminium + circuit + copper wire. Effect `{stat:'maxEnergy', mul:1.25}` (suit trickle-charges from rock heat, modelled as a bigger battery). |
| `heat_suit_2` | 4 | add `requires: thermal_power` (its "active cooling" is the siphon run in reverse). |
| `pulse_hardening` (new) | 5 | requires `faraday_shielding`, `carbon_fiber`. Cost: carbon fiber + circuit. Effect `{stat:'pulseResist', add:0.5}` (total 1.0 = immune). |
| `exotic_materials` | 6 → **5** | requires `fission` (was `rocketry`), relic `matter_loom`. Description: re-forging Seed hull fragments. Cost unchanged in materials; cash rescaled to era 5 by the balance test. |
| `core_interface` (new) | 5 | requires `exotic_materials`, relic `control_key`. Cost: exotic alloy + circuit + enriched uranium. Effect `{unlock:'core_interface'}`. Needed to shut down the Seed (6.3). |
| `warp_drive` | 6 | add relic `seed_core`. |
| `orbital_station`, `lunar_landing`, `mars_mission`, `interstellar` | 6 | Descriptions only: triangulate the signal / first relay / second relay / the source. Still `coming_soon`. |

`rocketry` stays the era-5 key tech and does not need a relic, so the era chain itself is never relic-blocked; relics gate the story path and the best gear.

### 4.3 Reachability rule (extends the data-validation test)

A relic in layer N must be reachable with the gear of the era whose tech needs it, or earlier:

| Relic | Needed in era | Layer depth | Must be obtainable with |
|---|---|---|---|
| `hull_shard` | 2 | 0–15% | starting gear |
| `shield_lattice` | 3 | 15–35% | era-2 gear |
| `thermal_siphon` | 4 | 35–55% | era-3 gear incl. `gas_mask` |
| `matter_loom` | 5 | 55–78% | era-4 gear + Big Bomb |
| `control_key` | 5 | 78–92% | era-5 gear incl. `magma_boots` |

## 5. Alien ruins

### 5.1 Zone

One new zone kind, `alien_ruin`, placed **once per layer** in addition to the current landmark and random zones. Size 9×6 including a 1-tile wall ring. Planned after all existing zones with its own RNG stream, so existing zone positions for a seed do not change.

- Wall ring: new material `ALIEN_HULL` (dark violet, faint glow; procedural colours like Tungsten). No pickaxe can mine it; only a Big Bomb breaks it.
- Breach: in layers 1, 2, 3 and 5 the two lowest tiles of the left wall are ordinary host rock (a crack in the hull), so the way in is dug with that layer's pickaxe. Layer 4 has no breach.
- Inside: one **relic tile** (new tile type `RELIC`, any pickaxe mines it) at the centre of the floor. Mining it emits `EV.RELIC_FOUND { id }`.
- Each layer's ruin is filled with that layer's signature hazard — that is the challenge:

| Layer | Ruin name | Fill / twist | What the player must do |
|---|---|---|---|
| 1 | Buried Shard | packed with loose sand | dig in through the breach; the sand pours out (existing Collapse) |
| 2 | Flooded Gallery | full of water | drain it by digging a channel below, or work under water |
| 3 | Choked Hall | gas at `GAS.MAX` | gas mask; any explosion detonates the room |
| 4 | Sealed Vault | no breach in the hull | only a Big Bomb gets in |
| 5 | Drowned Forge | magma to two tiles below the ceiling | Heat Suit II + Magma Boots |

### 5.2 Relic handling

- Mining the relic tile adds its id to `economy.relics` at once. It is not cargo, has no weight, cannot be sold and survives death (the data core is indestructible).
- The relic tile is blast-proof and fluid-proof: explosions, collapses, water and magma never destroy or move it; only mining it removes it.
- The gated tech becomes unlockable at once. The next time the camp terminal is opened the relic is **decoded**: its log entry (section 7) pops up once.

### 5.3 Tech screen

Side panel of a relic-gated tech shows a line: `Relic: Shielding Lattice — found ✓` or `— not found (ruin in layer 2)`. Missing relic = node is locked (grey) regardless of materials.

### 5.4 Never soft-lock

- Relic tiles and ruins are deterministic per seed and one per layer, so a relic always exists.
- "New Map (keep progress)" keeps `economy.relics`. Ruins whose relic is already owned spawn with an empty pedestal.
- Saves made before this version: ruins are not stamped into their existing world (it would overwrite dug tunnels). Such a save shows a one-time toast: "Signals detected — start a New Map to find alien ruins." Detected as: loaded world has no `ALIEN_HULL` tile and fewer than five relics are owned.

## 6. Hazard and goal changes

### 6.1 Pulse storm (new, `systems/Hazards/Pulse.js`)

Modelled on `Quake`. Config `HAZARD.PULSE`: `SAFE_DEPTH_M`, `WARN_S`, `MIN_GAP_S`, `MAX_GAP_S`, `DRAIN_FRAC`, `STUN_S`.

- Below `SAFE_DEPTH_M` (start ≈150 m), pulses arrive at random intervals that shorten with depth.
- `WARN_S` before a pulse: HUD warning + rising hum (Web Audio). With `pulse_detector` the warning is twice as long.
- On the pulse, scaled by `(1 − pulseResist)`: the battery loses `DRAIN_FRAC` of max energy, and **powered gear** (drill tiers 4–6, jetpack, radar) is offline for `STUN_S` seconds. Hand tools are unaffected.
- Shelter: inside base camp or a placed Field Camp the pulse does nothing (grounded mesh tent).
- Consequence by design: pulses are a mild battery tax in eras 1–3 and a real threat exactly when the player starts relying on electronics — which is when shielding becomes available.

Starting numbers (my call, tune in play): `SAFE_DEPTH_M 150, WARN_S 5, MIN_GAP_S 150, MAX_GAP_S 360, DRAIN_FRAC 0.25, STUN_S 6`.

### 6.2 Quakes

No mechanical change; the log explains them as the Seed's doing.

### 6.3 Core goal

`CoreGoal.update`: the hold sequence only starts if the player owns `core_interface` (the heat-suit requirement stays). Without it, entering the chamber shows a toast once per visit: "The machine does not answer. You need its key." On completion also add relic `seed_core`.

### 6.4 Ending

Replace the two-line ending with the twist: title `THE SEED IS SILENT`, three short paragraphs (text in section 7, entry `ending`), reward unchanged, button `Keep digging`.

## 7. Story delivery

### 7.1 Intro

On a fresh game only, a modal with entry `intro` and a `Begin` button.

### 7.2 Expedition Log (new terminal tab `Log`)

A list of unlocked entries, newest first; unread ones are marked. Data in a new `web/src/story.js`:

```js
{ id, chapter, title, text, trigger: { event: 'start'|'era'|'depth'|'relic'|'tech'|'pulse'|'completed', ... } }
```

A small `systems/Story.js` listens on the EventBus (like `Collectibles`), records `economy.story.seen`, and emits a toast `New log entry: <title>`. Only `intro`, relic decodes and `ending` open a modal by themselves.

Entries (final wording can be polished by the builder; keep each under ~60 words):

| id | Trigger | Text |
|---|---|---|
| `intro` | start | "Eleven days ago every chip within 300 km of this valley burned out at once. The pulses come from below, and they are getting stronger. The planet's magnetic field is already slipping. We have a kiln, a bronze pick and a hole in the ground. Whatever is down there, we go and meet it." |
| `ch1_tools` | era 1, first ore sold | "Nothing with a transistor survives here. Copper, tin, clay and fire still work. We rebuild from the beginning." |
| `relic_hull_shard` | relic | "This is not ore. The alloy is layered atom by atom, and it rings — faintly, every few minutes, in time with the pulses. Something made this. Pieces of it are scattered through the rock." |
| `ch2_radio` | tech `radio` | "The valve radio hears it: a carrier wave from straight down, steady as a heartbeat. We are calling the source the Seed." |
| `first_pulse` | first pulse survived | "Lamp dead, battery half gone, teeth aching. Down here the pulses hit hard. Thick wires survive. Fine ones do not." |
| `relic_shield_lattice` | relic | "A mesh with a repeating cell just the wrong size for the Seed's frequency. The pulse cannot cross it. We can copy this in copper and steel — and behind it, circuits will live." |
| `ch3_quakes` | depth where quakes begin | "The quakes are not tectonic. The Seed is drawing heat from the core, and the convection that drives Earth's magnetic field is stalling. Our estimate: a few decades of shield left." |
| `ch4_electronics` | tech `electronics` | "First working circuit board since the blackout, sealed in a lattice cage. It felt like lighting a fire in the rain." |
| `relic_thermal_siphon` | relic | "No turbine, no moving parts. Heat goes in one face, current comes out the other, far better than any thermocouple we know. This is how it feeds." |
| `ch5_fission` | tech `fission` | "We split atoms to out-dig a machine that drinks a planet's heat. It has been here for millions of years. We have had four hundred of science." |
| `relic_matter_loom` | relic | "The meteorite ore was never a meteorite. It is hull. The Loom shows how the Seed re-forges it — and with rhodium and platinum, so can we." |
| `relic_control_key` | relic | "A pattern, not an object: the handshake its control system expects. Build an interface that speaks it, carry it to the heart, and the Seed may listen." |
| `core_denied` | chamber entered without `core_interface` | "It did not even notice me." |
| `ending` | completed | "The hum stops. The tremors fade; far above, compass needles steady. In the silence the Seed's core is still warm in your hands — a drive that folds space. Then the last line of its log decodes: one transmission sent, relayed by the Moon and by Mars, to a star 40 light-years away. It called home. We had better answer in person." |
| `ch6_relays` | tech `rocketry` owned and completed | "Orbit first, to triangulate. Then the relays. Then the source." |

### 7.3 Missions

One main objective is always shown as a single HUD line under the depth readout, and listed (done / current / upcoming hidden) at the top of the `Log` tab. Data in `story.js`:

```js
{ id, chapter, text, test: { event, ... }, reward: { cash } }
```

Completing one pays a small cash reward (≈ 10% of that era's cheapest tech) and shows the next.

| Ch | Objective | Test |
|---|---|---|
| 1 | Sell your first load of ore | first sale |
| 1 | Research the Bloomery | tech `bloomery` |
| 1 | Find the source of the strange signal in the upper sands | relic `hull_shard` |
| 2 | Build a Radio | tech `radio` |
| 2 | Build the Pulse Detector | tech `pulse_detector` |
| 2 | Survive a pulse storm below 150 m | pulse survived |
| 2 | Research the Blast Furnace | tech `blast_furnace` |
| 3 | Recover the relic from the Flooded Gallery | relic `shield_lattice` |
| 3 | Build Faraday Shielding | tech `faraday_shielding` |
| 3 | Research the Arc Furnace | tech `arc_furnace` |
| 4 | Restore Electronics | tech `electronics` |
| 4 | Recover the relic from the Choked Hall | relic `thermal_siphon` |
| 4 | Achieve Nuclear Fission | tech `fission` |
| 5 | Breach the Sealed Vault | relic `matter_loom` |
| 5 | Forge Exotic Alloy | first Exotic Alloy crafted |
| 5 | Recover the Control Key from the Drowned Forge | relic `control_key` |
| 5 | Build the Core Interface | tech `core_interface` |
| 6 | Reach the Core and shut down the Seed | completed |
| 6 | Research Rocketry and follow the signal | tech `rocketry` |

### 7.4 Optional feats (added to `ACHIEVEMENTS`)

Achievement tests gain event kinds `relic`, `tech`, `pulse` and a `flag` check.

| id | Name | Condition |
|---|---|---|
| `relic_first` | First Contact | find any relic |
| `relic_all` | Archaeologist of the Impossible | find all five ruin relics |
| `clean_air` | Don't Light a Match | take the Choked Hall relic without a gas explosion in that zone |
| `dry_feet` | Plumber | drain the Flooded Gallery fully before taking its relic |
| `pulse_10` | Static Cling | survive 10 pulse storms outside shelter |
| `immune` | Faraday's Heir | reach pulse resistance 100% |
| `seed_silent` | The Seed Is Silent | replaces the name/desc of the existing `core` achievement (id kept) |

## 8. Data and save

- `economy.relics: string[]`, `economy.story: { seen: string[], read: string[], flags: string[], mission: number }`.
- `SAVE.VERSION` bump; migration adds the empty fields. A migrated save that already has `completed` gets `seed_core`, `core_interface` and all `relic_*` ids granted so nothing owned becomes locked; techs already owned stay owned even if their new prerequisites are missing.
- New `EV`: `RELIC_FOUND`, `PULSE_WARN`, `PULSE`, `TECH_UNLOCKED` (if not present), `LOG_ENTRY`.

## 9. Code changes (overview)

| File | Change |
|---|---|
| `config.js` | `RELICS`, `ALIEN_HULL` material + relic tile, `ZONES` ruin entries, `HAZARD.PULSE`, `TECH` edits (4.2), new achievements |
| `story.js` (new) | log entries, missions |
| `systems/Story.js` (new) | triggers, mission progress, rewards |
| `systems/Hazards/Pulse.js` (new) | pulse storm |
| `systems/Tech.js` | relic check in `canUnlock`; `pulseResist` via `techStat` |
| `systems/CoreGoal.js` | `core_interface` gate, grant `seed_core` |
| `systems/Mining.js` | relic tile → `RELIC_FOUND`; unbreakable hull in layer 4 except Big Bomb |
| `world/Zones.js`, `world/WorldGen.js` | plan + stamp `alien_ruin` per layer; skip relic if owned |
| `entities/Player.js`, `systems/Energy.js` | stun of powered gear, battery drain |
| `render/TileArt.js`, `ui/Minimap.js` | hull/relic tile look, ruin ping |
| `ui/` | `Log` tab, intro modal, relic decode modal, HUD objective line, pulse warning, Tech side-panel relic line, new `Ending` text |
| `save/SaveSystem.js` | migration |

## 10. Testing

- Unit: relic gate in `canUnlock`; Story triggers fire once; mission order; Pulse (resist scaling, shelter, stun only on powered gear); CoreGoal with/without interface; migration of an old and of a completed save.
- World: for 50 seeds, every layer has exactly one ruin, it overlaps no blocked area or other zone, and existing zones are unchanged from before this change.
- Data validation: every `relic` id exists; reachability rule 4.3; tech graph still acyclic and fully reachable given relics.
- Balance test: new techs fall inside their era's 1–3 trip band; `exotic_materials` rescaled to era 5.
- Manual (port 5273): fresh game shows intro; find `hull_shard`, decode at camp, unlock `pulse_detector`; trigger a pulse below 150 m; dev-panel jump to the Core without and with `core_interface`.

## 11. Left to the builder

Exact costs of new techs (balance test is the authority), how the Flooded Gallery plays with the current water rules (check `Fluids.js`; the relic must be reachable with era-2 gear either by draining or by wading), final log wording, ruin interior decoration, pulse sound design, HUD placement details. Calls marked "my call" above are Claude's proposals, not user decisions.
