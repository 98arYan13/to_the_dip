# Rig Body Sprites from Aseprite: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coloured rectangles that the web rig (`web/src/anim`) draws for each bone with pixel-art body parts drawn in Aseprite.

**Architecture:** One Aseprite file holds one layer per bone, drawn in the rig's rest pose on the 96x96 rig canvas. `tools/export_rig.py` exports each layer, crops it, rotates it into the bone's local frame (every rest angle is a multiple of 90°, so the rotation is lossless) and computes its pivot. It writes `web/public/rig/parts/<bone>.png` plus `web/public/rig/parts.json`. `loadRigAssets` merges `parts.json` into the bones, and `RigRenderer` already draws `sprite` + `pivot`. A bone that has no sprite keeps its rectangle.

**Tech Stack:** Python 3.12 + numpy + Pillow (tools), Aseprite CLI, JS/Canvas + Vitest (web).

**Spec:** this file. The design was agreed in chat on 2026-11-12. The current renderer is documented in `docs/plans/2026-11-12-skeletal-animation.md`.

## Global Constraints

- Rig canvas 96x96, `angleStep` 10, bone data in `web/public/rig/rig.json`. This plan does not change it.
- Palette: `art_source/palette/player_base_hd.hex` (32 colours). No other colours in the part sprites.
- Source file: `art_source/characters/player_rig.aseprite`. Exported PNGs go only to `web/public/rig/parts/`.
- Aseprite MCP paths always use forward slashes (`C:/...`).
- Aseprite CLI: `D:/tools/aseprite/build/bin/aseprite.exe`. The script takes `--aseprite <path>` to override it.
- Never `git commit` without the user's permission. Every "Commit" step means: ask first.
- Code identifiers and commit messages are in English. Replies to the user are in Persian.

## Review Focus

1. **Off-by-one after rotation.** A part drawn at rest must land on exactly the canvas pixels it occupied in Aseprite, including bones whose world angle is 90°/180°/270°. This is pinned by the round-trip test in Task 1.
2. **Missing or empty layer.** A bone layer that is absent or fully transparent produces no PNG and no `parts.json` entry, and the game draws that bone's rectangle (Task 1 and Task 2 tests).
3. **Off-palette pixels.** The export fails and names the bone and the colour; it does not silently ship them (Task 1 test).
4. **Missing `parts.json` or a part PNG that fails to load.** The game must still run. `parts.json` is required (it ships as `{}`), and a failed image load already makes `loadRigAssets` return null → old sprite sheet (Task 2 test).
5. **Non-bone layers** (`ref`, `guide`). They are never exported (Task 1 test).

---

### Task 1: `tools/export_rig.py`

**Files:**
- Create: `tools/export_rig.py`
- Test: `tools/test_export_rig.py` (assert-based self-check like `tools/test_prepare_sprite.py`; run with `python tools/test_export_rig.py`)

**Interfaces:**
- Produces:
  - `rest_world(rig: dict) -> dict[str, tuple[float, float, int]]`: bone name → (x, y, world angle in degrees, normalised to 0/90/180/270). It is forward kinematics with a zero pose and mirrors `solveWorld` in `web/src/anim/Rig.js`. It raises `ValueError` if an angle is not a multiple of 90.
  - `part_from_layer(rgba: np.ndarray, origin: tuple[float, float], angle: int) -> tuple[np.ndarray, list[int]] | None`: takes a 96x96x4 layer and returns (the cropped sprite in the bone-local frame, the `[px, py]` pivot), or None if the layer is empty.
  - `off_palette(rgba: np.ndarray, palette: set[tuple[int,int,int]]) -> list[tuple[int,int,int]]`: colours of opaque pixels that are not in the palette.
  - `guide(rig: dict) -> Image.Image`: a 96x96 RGBA picture of every bone's rest rectangle (`length` x `width`, same colours as `rig.json`) for use as a tracing layer.
  - CLI:
    - `python tools/export_rig.py guide <out.png>`
    - `python tools/export_rig.py export <file.aseprite> [--aseprite <exe>]`
    - `export` runs `<exe> -b --layer <bone> <file> --save-as <tmp>/<bone>.png` once per bone in `rig.json`. It skips bones whose PNG is missing or empty. It writes `web/public/rig/parts/<bone>.png` and `web/public/rig/parts.json` = `{"<bone>": {"sprite": "parts/<bone>.png", "pivot": [px, py]}}`. It exits non-zero with `<bone>: off-palette #rrggbb` if any pixel is off-palette.

The renderer's mapping, which `part_from_layer` must invert: a sprite pixel (u, v) lands on canvas pixel `floor(origin + R(angle) · (u + 0.5 − px, v + 0.5 − py))`, where `R` is the canvas rotation (y down, positive = clockwise on screen). Use `np.rot90` for the rotation. Do not use `Image.rotate`.

- [ ] **Step 1: Write the failing tests** in `tools/test_export_rig.py`:
  - `test_rest_world`: with the real `web/public/rig/rig.json`, `rest_world(rig)["hips"] == (48, 60, 90)`, `["torso"][2] == 270`, `["armF_upper"][2] == 90`, `["footF"][2] == 0`. A rig with a bone whose `rest` is 45 raises `ValueError`.
  - `test_round_trip`: for each angle in (0, 90, 180, 270) and origin (48, 60), take a 96x96 layer with an asymmetric 3x5 blob (one corner pixel a different colour) near the origin. Run `part_from_layer` and re-place every opaque sprite pixel with the mapping above. The result equals the original layer pixel-for-pixel.
  - `test_empty_layer`: an all-transparent layer → `None`.
  - `test_off_palette`: a layer with one `(1, 2, 3)` pixel → `[(1, 2, 3)]` against the real palette. A layer of palette colours only → `[]`.
  - `test_guide_size`: `guide(rig).size == (96, 96)`, and the pixel at the hips origin is opaque.
- [ ] **Step 2: Run** `python tools/test_export_rig.py`. Expected: fails with an ImportError / AttributeError.
- [ ] **Step 3: Implement** the four functions and the CLI in `tools/export_rig.py`. Read the palette with the same `.hex` parsing as `prepare_sprite.py`'s `load_palette`, and import that function rather than copying it. The CLI only selects layers by bone name, so `ref`/`guide` are never exported.
- [ ] **Step 4: Run** `python tools/test_export_rig.py`. Expected: prints `OK`, exit 0.
- [ ] **Step 5: Commit** (ask first): `tools: export rig body parts from Aseprite layers`

### Task 2: Load and draw bone sprites in the web rig

**Files:**
- Create: `web/public/rig/parts.json` with content `{}`
- Modify: `web/src/anim/loadRigAssets.js`. Fetch `parts.json` alongside the other three files. Before `loadRig`, `Object.assign` each entry into the matching bone of `rigData.bones` (ignore unknown bone names). Add bone `sprite`s to the image set that gets loaded.
- Modify: `web/src/anim/Rig.js`. Add optional `sprite?: string, pivot?: [number, number]` to the `BoneDef` typedef. No logic change.
- Modify: `web/src/anim/RigRenderer.js` `buildDrawList`. The `part` entries use `sprite: b.sprite ?? null, pivot: b.pivot ?? [0, 0]`.
- Test: `web/tests/rigassets.test.js`, `web/tests/rigrenderer.test.js`

**Interfaces:**
- Consumes: the `parts.json` format from Task 1.
- Produces: `rig.bones[i].sprite` / `.pivot`. `RigRenderer.render` already draws any draw item with a loaded sprite, so it needs no change.

- [ ] **Step 1: Write the failing tests**
  - `rigassets.test.js` `merges parts.json`: with a fake fetch whose `parts.json` is `{"torso":{"sprite":"parts/torso.png","pivot":[3,4]},"nope":{"sprite":"x.png","pivot":[0,0]}}`, the result has `rig.bones[rig.index.get('torso')].sprite === 'parts/torso.png'`, the same `pivot` is `[3, 4]`, and `head` has no `sprite`.
  - `rigassets.test.js` `null without parts.json`: a fetch that 404s only `parts.json` → `null`.
  - `rigrenderer.test.js` `bone sprite in draw list`: copy `realRig()`, set `torso.sprite = 'parts/torso.png'` and `pivot = [3, 4]`. In `buildDrawList`, the `torso` `part` item has that sprite/pivot and the `head` `part` item still has `sprite: null`.
- [ ] **Step 2: Run** `cd web && npx vitest run tests/rigassets.test.js tests/rigrenderer.test.js`. Expected: the 3 new tests FAIL.
- [ ] **Step 3: Implement** the four file changes listed above.
- [ ] **Step 4: Run** `cd web && npm test`. Expected: all tests pass.
- [ ] **Step 5: Commit** (ask first): `Web rig: draw bone sprites from parts.json`

### Task 3: The Aseprite source file and first export

**Files:**
- Create: `art_source/characters/player_rig.aseprite`
- Create (generated): `web/public/rig/parts/*.png`, `web/public/rig/parts.json`

**Interfaces:**
- Consumes: the `guide` / `export` CLI from Task 1 and the loader from Task 2.

- [ ] **Step 1:** `python tools/export_rig.py guide art_source/work/rig_guide.png`
- [ ] **Step 2:** Using the `aseprite` MCP, create a 96x96 RGBA canvas with the `player_base_hd.hex` palette. Add these layers, bottom to top:
  - `guide`: import `rig_guide.png`, set to 30% opacity.
  - `ref`: import the standing frame of `art_source/work/hd_idle.png`, aligned so its feet meet the guide's feet.
  - One empty layer per bone, named exactly as in `rig.json` (15 layers).
  - Save it as `C:/programming_projects/Digger/art_source/characters/player_rig.aseprite`.
- [ ] **Step 3: Art (the user, or Claude via MCP).** Fill each bone layer by cutting from `ref` or drawing over `guide`.
  - Each part reaches 2–3 px past its joint, rounded at the end, so rotation leaves no gaps.
  - Use only palette colours.
  - Leave a bone layer empty to keep its rectangle.
- [ ] **Step 4:** `python tools/export_rig.py export art_source/characters/player_rig.aseprite`. Expected: one line per exported bone, `parts.json` written, exit 0.
- [ ] **Step 5: Verify in the game.** Use `preview_start` on the web dev server (port 5273). In the browser preview, check the following, and attach a screenshot of each to the report:
  - idle, walk, swinging the pick, mouse-look (head turns) and facing left
  - no console errors
  - parts meet at the joints
  - `rig-editor.html` shows the same sprites
- [ ] **Step 6: Commit** (ask first): `Art: rig body parts from player_rig.aseprite`

---

**Out of scope (later, same pipeline):**
- Clothing sprites, using layers named `wear/<item>/<bone>` that fill `sprite`/`pivot` in `wearables.json`. Once the body has sprites, the clothing rectangles will cover it until this is done.
- Pre-rotated per-angle sprites, if the 10° rotation looks too jagged.
