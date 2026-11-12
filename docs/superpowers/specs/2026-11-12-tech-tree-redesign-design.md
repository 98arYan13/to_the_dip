# Tech Tree Redesign — Core (Sub-project 1) — Design

Date: 2026-11-12 · Scope: web game (`web/`) only · Status: draft for review

## 1. Goal

Replace the flat 19-node tech list with a believable, era-based progression where:

- Raw ores must be **smelted / processed** in camp buildings before they are useful; the more exotic the ore, the more advanced the building.
- Processed **materials** (steel, titanium, carbon fiber, circuits…) are crafted and consumed by techs, buildings and equipment.
- Difficulty grows with the length of the production chain, not with arbitrary prices.
- The jetpack is no longer default gear, warp sits at the very end, ladders and the field camp are basic shop items.
- Progress (tech, cash, stash, buildings, gear) carries over to a fresh map with **New Game**.

All in-game text and all identifiers are **English**.

### Decisions already made

| Topic | Decision |
|---|---|
| Space travel | Will be real new planet maps (sub-project 4); this spec only defines the tree nodes |
| Fuel | Powers camp buildings **and** battery charging |
| Crafting time | Instant |
| Equipment (pickaxes, rig, jetpack, radar) | Crafted from **materials only**, no cash |
| Tech unlock cost | **Cash (research) + materials (prototype)** |
| New ores | Bauxite, Ilmenite, Oil Shale |
| Buildings | Fixed slots at base camp, upgraded by level |
| Data model | One shared id space for ores and materials (approach A) |
| Tech UI | Era tabs + small per-era graph + have/need side panel |
| Crafting UI | Buildings drawn at camp; `E` near one opens the terminal on that building's tab |

### Sub-project roadmap (each gets its own spec)

1. **Core (this spec):** materials, crafting, buildings, tech graph, tech/craft UI, item moves (jetpack/warp/ladder/camp), New Game carry-over, save migration.
2. **Energy economy:** fuel tuning, consumption rates, per-building power draw balance.
3. **Blueprints:** scenarios and world placement of blueprint finds that unlock special techs.
4. **Space program:** launch pad, cartoon rocket/space station art, Moon / Mars / interstellar maps.

## 2. Realism model

Furnace levels follow real melting / extraction temperatures:

| Furnace level | Name | ~Temp | Processes |
|---|---|---|---|
| 1 | Clay Kiln | 500 °C | lead, tin → Solder |
| 2 | Bloomery | 1200 °C | copper, tin → Bronze, Copper Wire; iron + coal → Wrought Iron (bloomery iron never fully melts — historically accurate) |
| 3 | Blast Furnace | 1600 °C | iron + coal → Steel; Steel + nickel → Stainless Steel |
| 4 | Electric Arc Furnace | 3000 °C+ | Aluminium (electrolysis, needs power), Titanium (Kroll process), Tungsten Carbide |

Non-melting processes: oil shale is distilled (Refinery), electronics and isotopes are made in the Lab.

## 3. Items: ores and materials (shared id space)

`ORES` in `config.js` keeps its name (to avoid touching every caller) and gains a `kind: 'ore' | 'material'` field. Materials have `hosts: []`, so world generation never places them. Code that loops over all ores for world-gen or ore-only UI must check `kind === 'ore'` (or `hosts.length`).

### 3.1 New ores (appended so saved `oreType` ids stay valid)

| id | key | name | host bands | tier | notes |
|---|---|---|---|---|---|
| 22 | BAUXITE | Bauxite | 1, 2 | 1 | common, useless until Arc Furnace |
| 23 | ILMENITE | Ilmenite | 3, 4 | 3 | titanium source |
| 24 | OIL_SHALE | Oil Shale | 2, 3 | 2 | solid tile, no fluid simulation |

Tile art: procedural colors for now (like Tungsten). `weight` of Meteorite, Rhodium, Ruby & Emerald and Diamond is cut by ~30% so they become real bottlenecks.

### 3.2 Materials (id ≥ 25)

| id | key | name | made in | recipe (in → 1 out) |
|---|---|---|---|---|
| 25 | SOLDER | Solder | Furnace 1 | 2 tin + 1 lead |
| 26 | BRONZE | Bronze | Furnace 2 | 3 copper + 1 tin |
| 27 | COPPER_WIRE | Copper Wire | Furnace 2 | 2 copper |
| 28 | WROUGHT_IRON | Wrought Iron | Furnace 2 | 2 iron + 1 coal |
| 29 | STEEL | Steel | Furnace 3 | 2 iron + 2 coal |
| 30 | STAINLESS | Stainless Steel | Furnace 3 | 2 steel + 1 nickel |
| 31 | ALUMINIUM | Aluminium | Furnace 4 | 4 bauxite (high power) |
| 32 | TITANIUM | Titanium | Furnace 4 | 3 ilmenite + 1 coal |
| 33 | TUNGSTEN_CARBIDE | Tungsten Carbide | Furnace 4 | 2 tungsten + 1 coal |
| 34 | FUEL | Fuel | Refinery 1 | 2 oil shale |
| 35 | PLASTIC | Plastic | Refinery 1 | 2 oil shale |
| 36 | CARBON_FIBER | Carbon Fiber | Refinery 2 | 3 plastic |
| 37 | CIRCUIT | Circuit Board | Lab 1 | 2 copper wire + 1 gold + 1 plastic |
| 38 | LI_ION_CELL | Li-ion Cell | Lab 1 | 2 lithium + 1 cobalt + 1 nickel |
| 39 | INDUSTRIAL_DIAMOND | Industrial Diamond | Lab 1 | 1 diamond |
| 40 | ENRICHED_URANIUM | Enriched Uranium | Lab 2 | 5 uranium |
| 41 | EXOTIC_ALLOY | Exotic Alloy | Furnace 4 | 2 meteorite + 1 rhodium + 1 platinum |
| 42 | WARP_CHARGE | Warp Charge | Lab 2 | 1 exotic alloy + 1 enriched uranium |

Material fields follow two rules, checked by a test:

- `kg` = 0.5 × total input kg (refining removes the rock matrix).
- `price` ≈ 1.3 × total input price (processing adds value, so selling processed goods pays).

Materials can be sold, stashed, carried and spent exactly like ores (existing `pay`, `canAfford`, `deposit`, `sellFromStash` work unchanged).

## 4. Camp buildings

`CAMP_BUILDINGS` is extended. Each level has `cost` (materials only), `tech` (tech id required to build it, or none) and a placeholder art size. Level 1 of Generator, Furnace and Workshop is owned at start.

| Building | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| Generator | Coal Generator (start) | Diesel Generator — 20 steel + 10 copper wire · `diesel_power` | Fission Reactor — 30 stainless + 40 lead + 10 circuit · `fission` | — |
| Furnace | Clay Kiln (start) | Bloomery — 15 iron + 10 coal · `bloomery` | Blast Furnace — 20 wrought iron + 10 bronze · `blast_furnace` | Arc Furnace — 30 steel + 20 copper wire, needs Generator 2 · `arc_furnace` |
| Refinery | Distillery — 20 steel + 10 solder · `oil_refining` | Carbonizer — 20 stainless + 10 aluminium · `carbon_fiber` | — | — |
| Lab | Electronics Lab — 20 aluminium + 10 copper wire · `electronics` | Isotope Lab — 20 stainless + 30 lead + 10 circuit · `fission` | — | — |
| Workshop | Forge Bench (start) | Machine Shop — 20 steel + 10 bronze · `machining` | Precision Shop — 20 titanium + 10 circuit · `precision` | — |
| Trading Post | unchanged (sell multiplier) | | | |

The old Workshop `upgradeDiscount` effect is removed (no more cash upgrades). Owned old Workshop levels are refunded in cash during save migration.

### 4.1 Camp layout

Each building has a fixed slot (`BUILDING_SLOTS` in `WORLD.BASE_CAMP`) on the camp pad. Unbuilt buildings show a dashed outline; locked ones are dimmed. Pressing `E` within `INTERACT_RANGE` of a building opens the terminal on that building's Craft sub-tab. Widen `PAD_X0..PAD_X1` if six slots plus shop and shaft do not fit.

## 5. Power

- The camp has a power pool `economy.power` (number). Capacity by Generator level: 200 / 1,000 / 10,000.
- The generator **auto-burns** fuel from the stash when the pool is low, cheapest sell-value-per-power first, using only fuels its level allows:
  - Coal → 10 power (L1+)
  - Fuel → 40 power (L2+)
  - Enriched Uranium → 500 power (L3)
- Battery charging at camp and at field charging stations costs 1 power per 10 energy. With an empty pool and no burnable fuel, nothing charges.
- Every recipe has a `power` cost (e.g. Steel 5, Aluminium 30).
- New game starts with 100 power and 20 coal in the stash.
- **Emergency rescue keeps working** so the player can never be soft-locked: it behaves as today and, after a rescue, the battery gets the existing `ENERGY.RESCUE_ENERGY_FRAC` (30% of max) for free, without drawing from the pool.
- Exact rates are tuned in sub-project 2; this spec only builds the pool, the generator and the coal path.

## 6. Tech graph

### 6.1 Data shape

```js
{ id, era, name, desc, parent?, requires: [], cost: { cash, ores: { id: n } }, effect? }
```

- `requires` is the real logic (all must be owned). `parent` only places a sub-tech under its parent in the UI.
- A tech's rewards are found by reverse lookup: every recipe, building level, equipment level or consumable with `tech: id` unlocks when that tech is owned. `effect` remains for stat changes and feature flags (`{stat, add?, mul?}` / `{unlock}`).
- An era is "reached" when its key tech (marked `key: true` in the previous era) is owned.

### 6.2 Tree content (costs are starting points; the balance test is the authority)

**Era 1 — Bronze Age** (start: Bronze Pickaxe, Clay Kiln, Coal Generator, Forge Bench)
- `bloomery` **key** — $300 + 15 iron + 10 coal → Furnace 2, Bronze, Copper Wire, Wrought Iron
- `solder` — $100 + 3 tin + 3 lead → Solder recipe
- `contracts_terminal` — $500 + 6 zinc
- `stash_2` — $800 + 20 iron
- `padded_suit_1` — $400 + 4 zinc

**Era 2 — Iron Age**
- `ironworking` — $600 + 8 wrought iron → Iron Pickaxe, Rig 1
- `radio` — $800 + 4 copper wire + 2 solder → Radar 1
- `pack_1` — $800 + 4 nickel + 2 wrought iron
- `battery_1` — $600 + 6 lead + 2 copper wire
- `blast_furnace` **key** — $4,000 + 20 wrought iron + 10 bronze + 10 coal → Furnace 3, Steel, Stainless

**Era 3 — Industrial**
- `steelmaking` — $3,000 + 6 steel → Steel Pickaxe, Rig 2
- `machining` — $5,000 + 10 steel + 6 bronze → Workshop 2
- `oil_refining` — $6,000 + 10 steel + 6 solder + 10 oil shale → Refinery 1, Fuel, Plastic
  - `gas_mask` (parent `oil_refining`) — $3,000 + 2 plastic + 4 coal
  - `big_bomb` (parent `oil_refining`) — $6,000 + 4 fuel + 4 coal (ANFO)
- `diesel_power` (requires `oil_refining`) — $12,000 + 20 steel + 10 copper wire + 10 fuel → Generator 2
- `heat_suit` — $15,000 + 6 stainless + 4 copper wire → heat resist 0.5 (must be reachable before ~260 m)
- `padded_suit_2` — $5,000 + 4 steel + 4 plastic
- `battery_2` — $6,000 + 4 nickel + 3 cobalt
- `deep_scanner` — $7,000 + 3 silver + 4 copper wire
- `arc_furnace` **key** (requires `diesel_power`) — $25,000 + 30 steel + 20 copper wire → Furnace 4, Aluminium, Titanium, Tungsten Carbide

**Era 4 — Electric**
- `electronics` — $20,000 + 20 aluminium + 10 copper wire + 4 gold → Lab 1, Circuit, Li-ion Cell
- `titanium_drill` (requires `electronics`, `machining`) — $30,000 + 6 titanium + 2 li-ion → Titanium Drill
- `jetpack` (requires `electronics`) — $25,000 + 4 aluminium + 2 li-ion + 2 copper wire → Jetpack 1
  - `jet_tank_1`, `jet_thrust_1` (parent `jetpack`) — existing effects, new material costs
- `charge_station` (requires `electronics`) — field charging stations; station cost becomes 4 steel + 2 copper wire
- `heat_suit_2` (requires `heat_suit`) — $40,000 + 8 aluminium + 4 stainless + 2 circuit → heat resist 0.8
- `precision` — $50,000 + 20 titanium + 10 circuit → Workshop 3, Rig 3, Radar 2
- `battery_3` — $40,000 + 4 li-ion + 2 platinum
- `pack_2` — $9,000 + 6 aluminium + 4 titanium
- `fission` **key** (requires `electronics`, `arc_furnace`) — $150,000 + 30 stainless + 40 lead + 10 circuit + 10 uranium → Lab 2, Enriched Uranium, Generator 3

**Era 5 — Atomic**
- `carbon_fiber` — $80,000 + 20 stainless + 10 aluminium + 20 plastic → Refinery 2
- `tungsten_drill` (requires `precision`) — $90,000 + 6 tungsten carbide + 4 titanium + 2 circuit → Tungsten Carbide Drill
- `magma_boots` (requires `heat_suit_2`) — $90,000 + 4 tungsten carbide + 4 carbon fiber
- `diamond_tooling` (requires `tungsten_drill`) — $250,000 + 4 diamond + 6 tungsten carbide → Industrial Diamond, Diamond-Tipped Drill, Radar 3
- `jet_tank_2` (parent `jetpack`) — existing effect, new cost
- `isotope_rig` (requires `carbon_fiber`, `fission`) — $120,000 + 6 carbon fiber + 2 enriched uranium → Rig 4
- `rocketry` **key** (requires `carbon_fiber`, `fission`) — $500,000 + 40 carbon fiber + 40 aluminium + 20 circuit + 60 fuel

**Era 6 — Space** (chain, each requires the previous)
- `orbital_station` — $800,000 + 30 carbon fiber + 30 titanium + 20 circuit + 10 li-ion
- `lunar_landing` — $1,200,000 + 40 aluminium + 20 titanium + 80 fuel + 20 circuit
- `mars_mission` — $2,000,000 + 40 carbon fiber + 20 enriched uranium + 30 circuit + 20 stainless
- `warp_drive` — $3,000,000 + 10 exotic alloy + 30 enriched uranium + 40 circuit
- `interstellar` — $5,000,000 + 20 exotic alloy + 40 enriched uranium + 60 carbon fiber
- `exotic_materials` (requires `rocketry`) — $600,000 + 4 meteorite + 2 rhodium + 2 platinum → Exotic Alloy recipe; also required by `warp_drive`
- `warp_drive` → Warp Charge recipe (portable teleporter), Rig 5
- Space nodes other than `warp_drive` can be unlocked but their effect is a "Coming in a future update" toast until sub-project 4.

## 7. Equipment (crafted, materials only)

`PICKAXES` and `UPGRADES.*.levels` replace `cost` with `recipe: { id: n }`, `tech` and `workshop` (minimum Workshop level). Crafting the next level is done in the Workshop tab, only in order.

| Item | Level → recipe · tech · workshop |
|---|---|
| Pickaxe | 1 Bronze (start) · 2 Iron: 4 wrought iron · `ironworking` · W1 · 3 Steel: 6 steel · `steelmaking` · W1 · 4 Titanium Drill: 6 titanium + 2 li-ion + 4 copper wire · `titanium_drill` · W2 · 5 Tungsten Carbide Drill: 6 tungsten carbide + 4 titanium + 2 circuit · `tungsten_drill` · W3 · 6 Diamond-Tipped Drill: 4 industrial diamond + 6 tungsten carbide + 4 circuit + 2 li-ion · `diamond_tooling` · W3 |
| Rig | 0 Canvas Sack & Lead-Acid (start) · 1 Reinforced Frame & NiCad: 4 wrought iron + 3 nickel · `ironworking` · 2 Steel Exo-Frame & NiMH: 6 steel + 4 nickel + 2 cobalt · `steelmaking` · 3 Aluminium Rig & Li-ion: 6 aluminium + 3 li-ion · `precision` · 4 Carbon Pod & Isotope Core: 6 carbon fiber + 2 enriched uranium + 2 circuit · `isotope_rig` · 5 Quantum Cargo & Plasma: 4 exotic alloy + 4 circuit + 2 enriched uranium · `warp_drive` |
| Jetpack | 0 **None** (start — no flight) · 1: 4 aluminium + 2 steel + 2 copper wire · `jetpack` · 2: 4 titanium + 2 li-ion · `jetpack` · W2 · 3: 4 carbon fiber + 2 circuit · `carbon_fiber` · 4: 2 exotic alloy + 2 circuit · `exotic_materials` |
| Radar | 0 start · 1: 4 copper wire + 2 solder · `radio` · 2: 2 circuit + 2 aluminium · `precision` · 3: 4 circuit + 2 industrial diamond · `diamond_tooling` |

Jetpack stats: the existing four stat levels become levels 1–4; the new level 0 has `thrust: 0`, and the player cannot fly while jetpack level is 0.

Gear that is a feature flag (Gas Mask, Heat Suit, Magma Boots) stays a tech unlock: the tech's material cost is the prototype.

## 8. Shop and consumables

- **Ladder:** cash only, no tech (`tech` removed), available from the start.
- **Field Camp Kit:** new consumable, cash only, no tech. Placed underground in a cleared 4×4 air area with a solid floor. A placed camp lets the player rest (restores health, not energy) and open the stash. Max active camps and price are config values; camps are lost on New Map.
- **Teleporter:** no longer sold in the shop. Uses Warp Charge items (crafted in Lab 2 after `warp_drive`); HUD slot 2 shows Warp Charges from the stash + cargo.
- **Dynamite, Reserve Cell:** unchanged. **Big Bomb:** cash, gated by `big_bomb`.

## 9. UI

### 9.1 Tech tab (approved layout C)

- Era tabs across the top: `1 Bronze Age ✓`, `2 Iron Age ✓`, `3 Industrial`, `4 Electric 🔒`… Locked eras can be viewed but show all nodes as locked.
- Inside an era: a small left-to-right graph of that era's techs with lines from prerequisites; sub-techs sit right of their parent. Node colors: owned = green, unlockable = amber, locked = grey.
- Side panel for the selected node: name, one-line real-world description, cash and each material as `have/need` (green if enough, red if not), what it unlocks (reverse lookup), and the Unlock button. Disabled reason text as today.
- Keyboard: arrows move between nodes, `[` / `]` switch eras, Enter unlocks (`E` keeps closing the terminal).

### 9.2 Craft tab (approved option B)

- Sub-tab per building: Generator, Furnace, Refinery, Lab, Workshop.
- Top row: current level, next level cost and required tech, `Upgrade` button.
- Recipe rows: `Steel ← 2 Iron Ore (40) + 2 Coal (9) · ⚡5`, buttons `×1` and `×10`. Locked recipes show the missing tech or building level.
- Generator sub-tab shows the power pool, capacity and fuel available.
- Workshop sub-tab lists equipment (next level of each item) in place of the old cash Upgrades tab, which is removed.

### 9.3 Tabs after the change

`Sell Cargo · Stash · Craft · Tech · Shop · Camp · Contracts · Awards` — "Consumables" is renamed "Shop"; "Upgrades" is folded into Craft → Workshop.

## 10. New Game carry-over

Settings → New Game opens the save-slot menu (as today); the active slot gets a second button next to "New game":

- **New Map (keep progress):** new seed; keeps cash, stash, tech, buildings, equipment levels, power, achievements, consumables. Resets world, cargo, field charging stations, field camps, active contracts and `completed`.
- **Start Over:** current behaviour (fresh economy).

## 11. Save migration (bump `SAVE.VERSION`)

- Add new fields with defaults: `power`, building levels (Generator/Furnace/Workshop at 1).
- Map old tech ids to new ones (`battery_1..3`, `padded_suit_*`, `heat_suit`, `magma_boots`, `gas_mask`, `jet_*`, `stash_2`, `pack_*`, `charge_station`, `big_bomb`, `deep_scanner`, `contracts_terminal` keep their ids). `ladder_kit` is dropped with a cash refund. Also grant every tech an old item depended on, so nothing owned becomes unreachable.
- Old jetpack level n → new level n+1 (players keep the jetpack they had). Old pickaxe, rig and radar levels are kept as-is.
- Old Workshop building levels are refunded in cash and reset.
- Old teleporter count converts 1:1 to Warp Charge items in the stash.

## 12. Code changes (overview)

| File | Change |
|---|---|
| `config.js` | new ores/materials, `RECIPES`, extended `CAMP_BUILDINGS`, `BUILDING_SLOTS`, new `TECH`, equipment recipes, `POWER`, consumables |
| `systems/Crafting.js` (new) | pure `canCraft`, `craft`, `canUpgradeBuilding`, `craftEquipment` |
| `systems/Power.js` (new) | pool, auto-burn, `drawPower` |
| `systems/Tech.js` | `isUnlocked(ec, item)`, reverse-lookup `unlocksOf(id)`, era helpers |
| `systems/Economy.js` | `power`, buildings defaults, remove cash upgrades, `newMap()` |
| `systems/Energy.js` | charging draws power |
| `systems/Camp.js` | building upgrade via materials, field camp placement |
| `entities/Player.js` | jetpack level 0 = no flight; heat resist from tech level |
| `ui/TechScreen.js` | era tabs + graph + side panel |
| `ui/CraftScreen.js` (new) | building sub-tabs |
| `ui/Shop.js`, `ui/HUD.js`, `ui/Settings.js` | tab changes, warp charge slot, New Game choice |
| `render/*` | placeholder building boxes at camp slots |
| `world/*` | ore loops respect `kind`/`hosts` |
| `save/SaveSystem.js` | migration step |

## 13. Testing

- Unit: Crafting (pay, output to stash, locked/insufficient cases), Power (auto-burn order, capacity, empty pool), Tech (reverse lookup, era reach), save migration (old save → new shape, jetpack shift, refunds).
- Data validation test: every `requires`, `tech`, `parent` and item id exists; the tech graph has no cycles; every tech is reachable from the start; every material used in era N is producible in era ≤ N and every ore it needs is mineable with that era's pickaxe; material `kg`/`price` rules hold.
- Balance test (extends `economy.test.js`): each key tech costs 4–6 trips and each other tech 1–3 trips of income at that era (cash + market value of materials); era totals increase monotonically.
- Manual: run the web game on port 5273, play from a fresh save through Era 2, check the tech and craft tabs, camp buildings, ladder in shop, no jetpack at start, New Game carry-over.

## 14. Out of scope

Fuel rate tuning (sub-project 2), blueprints (3), planets and launch pad (4), backpack redesign, final building art (placeholders now; art goes through the normal pixel-art pipeline later).
