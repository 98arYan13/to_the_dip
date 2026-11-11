# Journey to the Depths of the Earth

A 2D atmospheric mining & excavation game in vanilla JavaScript (ES modules, Canvas 2D, Web Audio).
Every texture, light and sound is generated procedurally at runtime: there are no image, audio or font files.

You are a deep-earth explorer. Descend from the Expedition Base Camp through topsoil, limestone,
granite and basalt to the molten mantle. Mine ore, watch your suit energy, return to the surface
to sell, and buy better pickaxes to break ever-harder rock.

## Run

```bash
npm install
npm run dev        # dev server (Vite)
npm run build      # static build in dist/ (works from any static server, relative paths)
npm run preview    # serve the built dist/
npm test           # unit tests (Vitest)
```

Vite and Vitest are dev-only dependencies. The game has no runtime dependencies.

## Controls

| Action | Keys |
|---|---|
| Walk | `A` / `D` or `←` / `→` |
| Jetpack | `W`, `Space` or `↑` |
| Aim / mine | Mouse, hold left button |
| Radar | `R` |
| Dynamite / Teleporter / Energy cell | `1` / `2` / `3` |
| Base camp terminal | `E` (next to the Trading Post) |
| Pause / settings | `Esc` |
| Debug overlay | `F3` |

Gamepad (optional): left stick to walk, right stick to aim, A = jetpack, RT = mine, X = radar,
D-pad = items, Y = terminal, Start = pause.

## Gameplay rules

- **Pickaxe tiers** (Bronze → Iron → Steel → Titanium → Tungsten Carbide → Diamond-Tipped) gate what you can mine.
  A tile needs `max(hostRock.tier, ore.tier)`. A pickaxe that is too weak does 0 damage, plays a clink and shows a hint.
- **Dynamite** breaks host rock up to `pickaxeTier + 1`, collects only ores your pickaxe can mine, and never bypasses the diamond gate.
- **Energy** drains passively, faster with the jetpack and in the mantle heat. Recharge at the station.
  At 0 % an emergency rescue teleports you home and you lose half of every cargo stack.
- **Cargo** is slot-based (each slot stacks 2 units of one ore). When it is full, ore drops on the ground as pickups.
- **Saves** go to `localStorage` automatically every 15 s, when you open the shop and when you close the tab.

## Architecture

```
src/
  config.js            every tunable number (materials, ores, prices, tiers, physics, audio, render)
  main.js              bootstrap + dependency wiring
  core/                GameLoop (fixed 60 Hz, interpolation), EventBus, Input (action map),
                       RNG (mulberry32), Noise (value noise + fBm), Pool, log
  world/               World (typed arrays), WorldGen (pure, seeded), ChunkCache (16×16 chunk canvases),
                       Visibility (fog of war, radar timers)
  entities/            Player (movement + mining state machine), Dynamite, Pickup
  systems/             Physics (swept AABB vs grid), Mining (tier gating), Energy, Economy
  render/              Renderer (layer order), Camera (critically damped spring, trauma shake),
                       TileArt (baked atlas), Lighting (light buffer, occluded cone, bloom),
                       Particles (SoA Float32Arrays), Background (sky, parallax, base camp), PostFX
  audio/               AudioEngine (bus graph, reverb, voice stealing), Music (generative score),
                       SFX (material-aware hits, equipment, ambience), DSP (noise, IRs, curves)
  ui/                  HUD, Minimap (ImageData), Shop, Settings, Toast (DOM + CSS)
  save/SaveSystem.js   versioned RLE + base64 save with checksum and migrations
  debug/DebugOverlay.js
```

**Data layout.** The 64×256 world lives in flat typed arrays indexed `y * W + x`:
`tileType: Uint8Array`, `tileHP: Uint16Array`, `oreType: Uint8Array`, `flags: Uint8Array`
(DISCOVERED, RADAR_LIT, DIRTY, SOLID, FUNGI, MOSS). The band map is recomputed from the seed.

**Rendering.** Tiles are pre-rendered into 16×16-tile chunk canvases that rebuild only when dirty
(with a per-frame budget). Every texture variant, crack stage and edge overlay is baked once into
one atlas. Lighting renders at ½ or ¼ resolution: a multiply pass for darkness and an additive pass
for emissives, with a downsampled bloom. Particles are a struct-of-arrays with swap-remove, drawn
in two blend groups.

**Decoupling.** Systems talk through `EventBus` events (`EV.*`) or references injected in `main.js`.
There are no globals. Tile events carry a plain tile index so the hot paths do not allocate.

**Quality presets** (Low / Medium / High) change the light-buffer scale, bloom, particle cap,
headlamp ray count, heat shimmer and film grain. "Auto" measures frame time over the first
3 seconds and picks one.

## Tests

`npm test` covers RNG and noise determinism, world-generation invariants (same seed gives the same
world, ores only in their host rock, bedrock bounds), the tier-gating and dynamite rules, the economy
balance (3 to 5 full trips at tier N afford tier N+1, trip value rises per tier, prices follow
real-world order), cargo rules, and the save round-trip, corruption detection and migration.
