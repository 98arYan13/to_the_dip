# Web Game: Skeletal (Cutout) Player Animation — Design

**Status:** approved in brainstorming, awaiting spec review.
**Scope:** `web/` only. The Godot game is out of scope.

## Problem

The player is drawn from a 22-frame, 96px, AI-generated sprite sheet (`web/public/player/player_body.png`) plus a separately rotated head (7 angles) and pickaxe. Problems, all confirmed by the user:

1. Frames are inconsistent — proportions, size and position drift between frames (jitter).
2. Too few frames — walk / mine / jump look stiff.
3. Pickaxe and hand don't line up while mining.
4. Changing clothes or a hat means redrawing every frame.

## Goal

Replace frame-by-frame body animation with a runtime 2D skeleton: body parts (sprites) mounted on bones, animated by keyframed clips plus live procedural overlays, with wearables mounted per bone. Hitbox and physics stay unchanged (the character still fills a 32x32 world-px box, drawn from a 96x96 art canvas).

**Done when:**
- Placeholder parts animate through every clip in the running game.
- The hand stays on the pickaxe grip throughout mining.
- Changing a wearable or its colour from the dev panel shows immediately with no new art per animation.
- All new vitest tests pass.

## Decisions

| Question | Decision |
|---|---|
| Approach | Own runtime skeletal renderer (not baked sheets, not Spine/DragonBones) |
| Part art source | Placeholder parts first (generated from `rig.json`), real art later |
| Authoring | Keyframes in JSON + a dev-only browser editor that saves to disk |
| Wearables v1 | Hat/helmet, shirt, pants, boots, gloves, colour tinting |

## Architecture

New modules in `web/src/anim/`, each with one job:

| File | Job | Depends on |
|---|---|---|
| `Rig.js` | Load rig data, hold the bone tree, compute world transforms from local angle/offset (forward kinematics) | nothing (pure) |
| `Clip.js` | Sample a clip at time `t`: per-bone keyframe interpolation with easing; loop or one-shot | nothing (pure) |
| `Animator.js` | Choose the clip from player state, cross-fade between clips, drive clip time from the right source | `Clip` |
| `Overlays.js` | Live adjustments after the clip: head look, two-bone arm IK to the pickaxe grip, landing squash | `Rig` |
| `RigRenderer.js` | Draw the final pose into a 96x96 offscreen canvas (nearest, snapped angles), apply wearables and tints (cached per colour), generate placeholder parts | `Rig`, wearable data |

Data in `web/public/rig/`:

- `rig.json` — bones `{name, parent, x, y, length, width}`, part pivot per bone, draw order, `angleStep` (default 10°), placeholder colours.
- `anims.json` — `{ clipName: { loop: bool, duration: s, keys: { boneName: [[t, angleDeg, dx, dy, ease?], ...] } } }`. Missing bones keep their rest pose.
- `wearables.json` + PNGs — `{ id, kind: "hat"|"shirt"|"pants"|"boots"|"gloves", parts: { boneName: { sprite, pivot, tintMask? } } }`. One wearable can cover several bones (a shirt covers torso and both arms).

Player state gains `outfit = { hat, shirt, pants, boots, gloves, colors: {kind: "#rrggbb"} }`, persisted in the save (default outfit when absent in old saves).

### Integration with existing code

- `Renderer._drawPlayer` and `_playerFrame` are replaced by a call into `Animator` → `Overlays` → `RigRenderer`, then one `drawImage` of the 96px canvas into the 32x32 world box (flipped by `facing`, as now).
- `_drawPlayerTool` takes the pickaxe angle from `Overlays` so hand and pickaxe share one number. The existing aim + swing formula is kept as the source of that angle.
- The old sprite-sheet path stays as a fallback until rig data loads; the code-drawn body stays as the last fallback.
- Dev panel (`web/src/ui/DevPanel.js`) gets an outfit section: pick each wearable and its colour.

## Skeleton

14 bones in 96px art space, feet on the bottom row:

```
hips (root)
├─ torso
│  ├─ head
│  ├─ armB_upper → armB_lower → handB   (back arm, drawn behind torso)
│  └─ armF_upper → armF_lower → handF   (front arm, drawn in front)
├─ legB_thigh → legB_shin → footB
└─ legF_thigh → legF_shin → footF
```

The jetpack is a fixed sprite on `torso` (not a wearable choice in v1).

## Clips and state mapping

| Clip | When | Time source |
|---|---|---|
| `idle` | standing | game time (1px breathing on torso) |
| `walk` | on ground and `abs(vx) > 10` | `player.walkPhase` (feet match distance, no sliding) |
| `jump` / `fall` | airborne, by `vy` | own time |
| `land` | one-shot on touchdown | own time |
| `mine_side` / `mine_down` | `mineState === 1`, direction as today | `player.swingPhase` (strike pose lines up with the hit) |
| `climb` | on ladder | distance climbed |
| `hurt` | `hurtTimer > 0` | own time |
| `jet` | `jetting` | game time |

Priority: hurt > ladder > mine > air > walk > idle. Clip changes cross-fade over 0.1 s, except entering a mining clip (no blend, so timing stays exact).

## Live overlays (applied after the clip, before drawing)

1. **Head look** — head bone rotates toward the mouse, clamped to ±30° (replaces the 7-angle head sheet).
2. **Arm IK** — while mining, `armF_upper`/`armF_lower` are solved by analytic two-bone IK so `handF` reaches the pickaxe grip; target out of reach → arm fully extended toward it, no snapping. Outside mining the pickaxe is attached to `handF` at a fixed angle.
3. **Landing squash** — hips drop a few px for a short time, scaled by landing speed.

## Pixel handling

- Each part's world angle is snapped to `angleStep`; positions rounded to whole 96px-canvas pixels.
- Rendering uses `imageSmoothingEnabled = false` on the 96x96 canvas, then the canvas is drawn into the 32 world-px box. All parts share one pixel grid and never drift sub-pixel against each other.
- Tinted wearable sprites are built once per (sprite, colour) and cached, the same way as `_pickSprite`.
- Placeholder parts: rectangles from each bone's `length`/`width`, filled with a palette colour from `art_source/palette/player_base_hd.hex` and a 1px dark outline.

## Animation editor (dev only)

- Separate Vite page `web/rig-editor.html`, excluded from the game build entry.
- Uses the same `Rig`, `Clip`, `Animator`, `Overlays`, `RigRenderer` — what you see is what the game shows.
- Features: clip list; timeline with keyframes (add / move / delete); select a bone and set angle/offset by drag or numeric field; play / pause / speed; zoom 4x–8x; onion skin of the previous key; outfit and colour preview; an aim target that follows the mouse to test head look and arm IK.
- Saving: a Vite plugin active only in `serve` mode adds `POST /__rig/save` that writes `public/rig/anims.json` (and `rig.json` when pivots/bones change). The endpoint only accepts those two file names and valid JSON. It does not exist in production builds.

## Future art pipeline (not built in this spec, documented only)

- A fixed "parts sheet" template: every part in a set slot, 3x detail, HD palette. Claude writes the ChatGPT/Gemini prompt for that template.
- `tools/slice_parts.py` cuts a sheet into per-part PNGs and writes their pivots. Each wearable is made the same way, with only the parts it covers.

## Testing

vitest, no browser:

- `Rig`: child world position after parent rotation; draw order respected.
- `Clip`: interpolation between keys, loop wrap, one-shot clamp, `t` at exact key times.
- `Animator`: correct clip per player state; priority order; no blend into mining; cross-fade weight over time.
- `Overlays`: IK puts the hand within 1px of a reachable grip; unreachable target gives a straight arm pointing at it; head clamp.
- Data check: every bone in `anims.json` exists in `rig.json`; every clip in the mapping exists.
- Save: old saves without `outfit` load with the default outfit.

Manual check in the running game: walk, jump/fall/land, mine side and down, ladder, hurt, jetpack, outfit swap and recolour from the dev panel, and both facings.

## Out of scope

- Godot version of the skeleton.
- Real part art and `slice_parts.py` implementation.
- A shop / UI for buying clothes.
- Mesh deformation or skinning (parts are rigid).
