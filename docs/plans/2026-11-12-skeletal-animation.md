# Web Game: Skeletal Player Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the player's frame-by-frame body sheet in `web/` with a runtime 2D skeleton (rigid parts on 14 bones), keyframed clips, live overlays (head look, arm IK to the pickaxe, landing squash), per-bone wearables with tinting, and a dev-only animation editor.

**Architecture:** Pure, testable modules in `web/src/anim/` (`Rig` FK, `Clip` sampling, `Animator` state→clip, `Overlays`, `Outfit`) feed a browser-only `RigRenderer` that composes the pose into a 96x96 offscreen canvas (nearest, snapped angles), which `Renderer` draws into the existing 32x32 world box. Data lives in `web/public/rig/*.json`; a dev-only Vite plugin lets the editor page write it back.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Vite 5.4.10, vitest 2.1.4 (node environment). No new dependencies.

**Spec:** `docs/plans/2026-11-12-skeletal-animation-design.md`

## Global Constraints

- Rig canvas is 96x96 art px; it is drawn into the 32x32 world-px box exactly where the current sheet is drawn (`cx - 16, top`, `top = y + p.h - 31`). Hitbox and physics unchanged.
- Character ~84 px tall on the rig canvas, feet on row 93 (3 px pad), matching `prepare_sprite.py --size 96 --pad 3 --height 84`.
- Bone names (exact): `hips, torso, head, armB_upper, armB_lower, handB, armF_upper, armF_lower, handF, legB_thigh, legB_shin, footB, legF_thigh, legF_shin, footF`. (`hips` is the root; 15 names incl. root = the spec's "14 bones" plus root.)
- Angles in JSON are degrees; in code, radians. Bone direction vector is `(cos a, sin a)` (canvas y-down), so a limb hanging straight down has world angle 90°.
- `angleStep` default 10°; head look clamp ±30°; clip cross-fade 0.1 s; no cross-fade when entering `mine_side`/`mine_down`; walk threshold `Math.abs(vx) > 10`.
- Priority: hurt > ladder > mine > air > land > walk > idle.
- Placeholder colours come from `art_source/palette/player_base_hd.hex`; 1 px dark outline.
- `imageSmoothingEnabled = false` on every rig canvas context.
- The save endpoint exists only under `vite serve` and only writes `public/rig/rig.json` or `public/rig/anims.json`.
- Static typing via JSDoc, as in the rest of `web/src`. Files `PascalCase.js` for classes, matching existing modules.
- **User rule:** never run `git commit` without the user's permission. Commit steps below mean "stage and ask the user to approve the commit".

## Review Focus

1. **Rig data fails to load** (404, bad JSON): the game must keep drawing the old sheet / code-drawn body, never throw. → test in Task 7 (`loadRigAssets` returns `null` on failure).
2. **Aim target on or behind the shoulder** (distance 0, or mouse behind the player): IK and head look must not produce `NaN`. → tests in Task 4.
3. **Facing left**: mouse → rig-space conversion must mirror x so head/arm aim toward the mouse, not away. → test in Task 4 (`toRigSpace`).
4. **Clip data naming a bone the rig lacks, or empty `keys`**: sampling ignores it instead of crashing. → test in Task 2.
5. **Old or tampered saves** (no `outfit`, unknown wearable id, colour not `#rrggbb`): load with defaults. → test in Task 5.

---

### Task 1: Rig data and forward kinematics

**Files:**
- Create: `web/public/rig/rig.json`
- Create: `web/src/anim/Rig.js`
- Test: `web/tests/rig.test.js`

**Interfaces:**
- Produces:
  - `rig.json` shape: `{ canvas: 96, angleStep: 10, bones: [{ name, parent: string|null, x, y, rest, length, width, layer, color }] }` — `x,y` = joint offset in the parent's local frame (root: absolute rig-canvas px), `rest` = rest angle (deg, relative to parent), `layer` = draw order (higher drawn later), `color` = palette hex.
  - `loadRig(data): Rig` — `Rig = { canvas, angleStep, bones: BoneDef[], index: Map<string, number>, parent: Int16Array, drawOrder: number[] }`. Throws `Error` if a bone's parent is unknown or appears after the child.
  - `createPose(rig): Pose` — `Pose = { angle: Float32Array, dx: Float32Array, dy: Float32Array }`, all zero (= rest pose). Values are deltas over rest; `angle` in radians.
  - `solveWorld(rig, pose, out?): WorldPose` — `WorldPose = { x: Float32Array, y: Float32Array, a: Float32Array }`: joint position and world angle (radians) per bone. Child joint = parent joint + rotate(parent world angle)(x + dx, y + dy); child angle = parent angle + rest + pose.angle. Root uses identity parent.
  - `boneTip(rig, world, i): [number, number]` — joint + length·(cos a, sin a).

- [ ] **Step 1: Write failing tests** in `web/tests/rig.test.js`:
  - `loadRig` on a 3-bone chain builds `index` and `drawOrder` sorted by `layer`.
  - `loadRig` throws when a parent name is missing, and when a child precedes its parent.
  - rest pose: a child at `(10, 0)` under a root with rest 90° lands at `(root.x, root.y + 10)` (within 1e-6).
  - rotating the root by +90° via `pose.angle` moves the child joint and adds 90° to the child's world angle.
  - the real `public/rig/rig.json` loads, contains exactly the 15 names from Global Constraints, and every foot tip's y is within 93 ± 1.5 at rest.
- [ ] **Step 2: Run** `npx vitest run tests/rig.test.js` in `web/` — expect FAIL (module not found).
- [ ] **Step 3: Implement `Rig.js`** and author `rig.json` (standing T-less rest pose: arms hanging at 90°, back limbs offset 2–3 px from front limbs; torso ~26 px, thigh ~16, shin ~16, upper arm ~13, forearm ~12, head length ~22 width ~20; tune so the figure is ~84 px tall with feet on row 93).
- [ ] **Step 4: Run** the test file — expect PASS.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: bone data and forward kinematics`.

### Task 2: Clip sampling and pose blending

**Files:**
- Create: `web/src/anim/Clip.js`
- Test: `web/tests/clip.test.js`

**Interfaces:**
- Consumes: `Rig`, `Pose`, `createPose` (Task 1).
- Produces:
  - Clip JSON: `{ loop: boolean, duration: number, keys: { [bone]: [t, angleDeg, dx, dy, ease?][] } }`, keys sorted by `t`, `ease ∈ 'linear'|'in'|'out'|'inout'|'step'` (default `'linear'`, applies to the segment starting at that key).
  - `sampleClip(clip, t, rig, pose): Pose` — resets `pose` to zero, then writes each keyed bone. Loop: `t` wrapped into `[0, duration)`, last key interpolates toward first key at `duration`. One-shot: `t` clamped. Bones absent from the rig are skipped (warn once per name via a module-level `Set`). A single key = constant.
  - `blendPose(a, b, w, out): Pose` — `out = a + (b - a)·w` per channel, `w` clamped to `[0, 1]`.
  - `clipEnded(clip, t): boolean` — `!clip.loop && t >= clip.duration`.

- [ ] **Step 1: Write failing tests** in `web/tests/clip.test.js`:
  - two keys `[0, 0]`, `[1, 90]` → at `t=0.5` angle = `Math.PI/4`.
  - loop with keys at 0 and 0.5, duration 1 → at `t=0.75` halfway back to the first key; `t=1.25` equals `t=0.25`.
  - one-shot `t=5` equals last key.
  - `'step'` ease holds the earlier value until the next key.
  - key for unknown bone `"tail"` and a bone with `[]` keys → no throw, other bones still sampled.
  - `blendPose` at `w=0.25`, and clamps `w=2` to `b`.
- [ ] **Step 2: Run** `npx vitest run tests/clip.test.js` — expect FAIL.
- [ ] **Step 3: Implement `Clip.js`**; easing: `in = t²`, `out = 1-(1-t)²`, `inout = smoothstep`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: clip sampling and blending`.

### Task 3: Animator (state → clip) and starter clips

**Files:**
- Create: `web/src/anim/Animator.js`
- Create: `web/public/rig/anims.json`
- Test: `web/tests/animator.test.js`

**Interfaces:**
- Consumes: `sampleClip`, `blendPose`, `clipEnded` (Task 2); `createPose` (Task 1).
- Produces:
  - `CLIP_NAMES = ['idle','walk','jump','fall','land','mine_side','mine_down','climb','hurt','jet']`.
  - `selectClip(p, ctx): string` — pure. `p` uses existing Player fields `hurtTimer, onLadder, onGround, mineState, vy, vx, jetting`; `ctx = { aimDown: boolean, landing: boolean }`. Rules in priority order: `hurtTimer>0`→`hurt`; `onLadder && !onGround`→`climb`; `mineState===1`→`aimDown ? 'mine_down' : 'mine_side'`; `!onGround`→`jetting ? 'jet' : vy < -40 ? 'jump' : 'fall'`; `landing`→`land`; `abs(vx)>10`→`walk`; else `idle`.
  - `class Animator { constructor(rig, clips); update(p, dt, ctx: { time, aimDown }): Pose; clip: string; squashT: number; landVY: number }`. Detects landing on `onGround` false→true with `p.impactVY > 60` (sets `landing` until the `land` clip ends, stores `landVY`, resets `squashT=0`). Clip time sources: `walk` → `p.walkPhase / (2π)` scaled to clip duration; `mine_*` → `p.swingPhase · duration`; `climb` → accumulated `|vy|·dt / 24` px per cycle; `idle`/`jet` → `ctx.time`; others → time since clip start. Cross-fade 0.1 s from the previous output pose, except entering `mine_*` (snap).
- [ ] **Step 1: Write failing tests** in `web/tests/animator.test.js`:
  - `selectClip` table test: one row per rule plus overlaps (hurt while mining → `hurt`; mining in air → `mine_side`; jetting on ground with vx 50 → `walk`).
  - `Animator`: switching idle→walk, after 0.05 s the pose is between the two clips' poses; after 0.1 s it equals walk.
  - entering `mine_side` gives the mining pose on the first update (no blend).
  - landing with `impactVY=200` selects `land` until it ends, then `idle`; with `impactVY=30` it never selects `land`.
  - data check: `public/rig/anims.json` has every name in `CLIP_NAMES`; every bone key exists in `rig.json`; every clip has `duration > 0`.
- [ ] **Step 2: Run** `npx vitest run tests/animator.test.js` — expect FAIL.
- [ ] **Step 3: Implement `Animator.js`** and write starter keyframes in `anims.json` for all 10 clips (rough but readable: walk = opposite leg/arm swing ±25°, 4 keys; mine_side = raise → strike → recover, strike pose at `t = 0.7·duration`; others 2–3 keys). Final tuning happens in Task 9.
- [ ] **Step 4: Run** — expect PASS. Run full `npx vitest run` — no regressions.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: animator and starter clips`.

### Task 4: Overlays — head look, arm IK, squash, rig-space mapping

**Files:**
- Create: `web/src/anim/Overlays.js`
- Test: `web/tests/overlays.test.js`

**Interfaces:**
- Consumes: `Rig`, `Pose`, `solveWorld`, `boneTip` (Task 1).
- Produces:
  - `toRigSpace(wx, wy, boxX, boxY, facing): [number, number]` — world px → rig px: `rx = (wx - boxX)·3`, `ry = (wy - boxY)·3`; if `facing < 0`, `rx = 96 - rx`. `boxX = cx - 16`, `boxY = top`.
  - `solveTwoBone(l1, l2, dx, dy, bend): { a1: number, a2: number, reached: boolean }` — world angle of bone 1 and relative angle of bone 2 so the chain tip reaches `(dx, dy)` from the root; `bend = 1 | -1` picks elbow side. Distance clamped to `[|l1-l2|+1e-3, l1+l2]`; distance 0 → arm points along +x (no NaN). Unreachable → straight toward target, `reached=false`.
  - `headLook(rig, pose, world, tx, ty): void` — sets `pose.angle[head]` so the head's world angle points at `(tx, ty)` relative to its rest direction, clamped ±30°.
  - `gripTarget(rig, world, pickAngle): [number, number]` — `armF_upper` joint + `0.85·(l_upper + l_lower)·(cos, sin)(pickAngle)`.
  - `armToGrip(rig, pose, world, gx, gy): void` — runs `solveTwoBone` with `bend = -1` and writes `armF_upper`/`armF_lower` `pose.angle` deltas (relative to parent world angle and rest).
  - `squashOffset(landVY, t): number` — px drop on `hips`: `min(6, landVY/60)·max(0, 1 - t/0.18)`, rounded.
  - `applyOverlays(rig, pose, ctx: { look: [x,y], mining: boolean, pickAngle: number, landVY: number, squashT: number }): WorldPose` — order: squash → solveWorld → headLook → (if mining) armToGrip → solveWorld again; returns final world pose.
- [ ] **Step 1: Write failing tests** in `web/tests/overlays.test.js`:
  - `solveTwoBone(10, 10, 12, 5, 1)` → tip computed from `a1, a2` is within 1 px of `(12, 5)`, `reached=true`.
  - target `(50, 0)` with lengths 10/10 → `reached=false`, both angles ≈ 0.
  - target `(0, 0)` → finite numbers.
  - `headLook` toward a point straight above the neck clamps to −30°.
  - `toRigSpace` with `facing=-1`: a mouse to the left of the player maps to `rx > 48` (in front of the character).
  - `applyOverlays` with `mining=true`: `boneTip(handF … )`/`handF` joint within 1 px of `gripTarget` for a reachable `pickAngle` (use real `rig.json`).
  - `squashOffset(300, 0) === 5`, `squashOffset(300, 0.2) === 0`.
- [ ] **Step 2: Run** `npx vitest run tests/overlays.test.js` — expect FAIL.
- [ ] **Step 3: Implement `Overlays.js`** (law-of-cosines two-bone IK).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: head look, arm IK and landing squash`.

### Task 5: Outfit model, wearable data, save integration

**Files:**
- Create: `web/src/anim/Outfit.js`
- Create: `web/public/rig/wearables.json`
- Modify: `web/src/main.js:119-125` (restore) and `web/src/main.js:237` (`getState` → add `outfit`)
- Modify: `web/src/entities/Player.js` constructor — `this.outfit = defaultOutfit()`
- Test: `web/tests/outfit.test.js`

**Interfaces:**
- Produces:
  - `wearables.json`: `{ items: [{ id, kind: 'hat'|'shirt'|'pants'|'boots'|'gloves', name, parts: { [bone]: { sprite: string|null, pivot: [x, y], tint: boolean } } }] }`. `sprite: null` → placeholder shape for that bone in the wearable's colour. Ship placeholder items: `helmet` (head), `shirt_basic` (torso, armF_upper, armB_upper), `pants_basic` (hips, thighs, shins), `boots_basic` (feet), `gloves_basic` (hands).
  - `WEAR_KINDS = ['hat','shirt','pants','boots','gloves']`.
  - `defaultOutfit(): Outfit` — `{ hat:'helmet', shirt:'shirt_basic', pants:'pants_basic', boots:'boots_basic', gloves:null, colors: { hat:'#e8e2d0', shirt:'#d0662a', pants:'#2d3340', boots:'#1a1d24', gloves:'#6b4a2b' } }` (colours from the current code-drawn body).
  - `sanitizeOutfit(raw: any, items: {id, kind}[]): Outfit` — starts from `defaultOutfit()`; keeps a slot only if the id exists with the matching `kind` (or is `null`); keeps colours matching `/^#[0-9a-f]{6}$/i`.
- [ ] **Step 1: Write failing tests** in `web/tests/outfit.test.js`:
  - `sanitizeOutfit(undefined, items)` deep-equals `defaultOutfit()`.
  - unknown id `"crown"` in `hat` → `'helmet'`; a shirt id placed in `hat` → `'helmet'`; `gloves: null` stays `null`.
  - colour `"red"` → default; `"#A1b2C3"` kept.
  - every item in `public/rig/wearables.json` has a valid `kind` and only bone names from `rig.json`.
  - extend `tests/save.test.js`: a save with `player.outfit` round-trips; a save without it deserializes without error.
- [ ] **Step 2: Run** `npx vitest run tests/outfit.test.js tests/save.test.js` — expect FAIL on outfit tests.
- [ ] **Step 3: Implement `Outfit.js`**, add `wearables.json`, add `outfit` to `Player`, to `getState()` (`outfit: player.outfit`), and on load `player.outfit = sanitizeOutfit(p.outfit, items)` (items come from the loaded wearables; until loaded, keep the default and re-sanitize when they arrive — see Task 7).
- [ ] **Step 4: Run** full `npx vitest run` — expect PASS.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: outfit model and save support`.

### Task 6: RigRenderer (offscreen composition)

**Files:**
- Create: `web/src/anim/RigRenderer.js`
- Test: `web/tests/rigrenderer.test.js` (pure helpers only; drawing is verified in the browser in Task 7)

**Interfaces:**
- Consumes: `Rig`, `WorldPose` (Task 1); `Outfit`, wearables items (Task 5).
- Produces:
  - `snapAngle(rad, stepDeg): number` — round to nearest multiple of `stepDeg` (in radians).
  - `buildDrawList(rig, outfit, items): DrawItem[]` — `DrawItem = { bone: number, layer: number, kind: 'part'|'wear'|'pick'|'jetpack', sprite: string|null, pivot: [x,y], color: string, tint: boolean }`. One `part` per bone (body/skin), then each equipped wearable's parts at the same bone `layer + 0.5`; one `jetpack` item on `torso` at `layer(torso) - 0.5` (placeholder rect 5x11 art-px ×3, `#6b7280`, behind the back; replaces the old jetpack rects in `_drawPlayer`); one `pick` item at `layer(handF) - 0.25` (pickaxe behind the front hand, in front of the torso). Sorted by `layer`, stable.
  - `class RigRenderer { constructor(rig, items, images: Map<string, HTMLImageElement>); render(world: WorldPose, outfit, pick: { sprite: HTMLCanvasElement|null, angle: number, color: string }): HTMLCanvasElement }` — owns one 96x96 canvas, cleared each call. For each `DrawItem`: translate to the rounded joint, rotate by `snapAngle(world.a[bone], rig.angleStep)`, draw the sprite at `-pivot`, or for `sprite === null` a placeholder rect `length × width` starting at the joint, centred on the bone axis, filled with `color` and outlined 1 px in `#1a1d24`. Tinted sprites cached per `sprite|color` (same multiply / destination-in technique as `Renderer._pickSprite`). `pick` item draws `pick.sprite` (the existing tinted 3x pickaxe canvas) at the `handF` joint with grip at `(3, 22.5)` and `pick.angle`.
- [ ] **Step 1: Write failing tests** in `web/tests/rigrenderer.test.js`:
  - `snapAngle(0.2, 10)` ≈ `Math.PI/18` (11.5° → 10°); `snapAngle(-0.09, 10)` ≈ `-Math.PI/18` (−5.2° → −10°); `snapAngle(0.05, 10)` ≈ `0`.
  - `buildDrawList` with `defaultOutfit()` and real data: `armB_*` items come before `torso`, `armF_*` after; the `jetpack` item comes before `torso`; the `pick` item sits between `torso` and `handF`; the helmet item directly after the head part; with `gloves: null` there is no glove item.
- [ ] **Step 2: Run** `npx vitest run tests/rigrenderer.test.js` — expect FAIL.
- [ ] **Step 3: Implement `RigRenderer.js`.** Keep canvas creation lazy so importing the module in node tests does not touch `document`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: offscreen renderer with wearables and tint`.

### Task 7: Game integration and dev-panel outfit controls

**Files:**
- Create: `web/src/anim/loadRigAssets.js`
- Modify: `web/src/render/Renderer.js:288-323` (`_drawPlayer`), `:388-412` (`_drawPlayerTool`), `:360-372` (`_playerFrame` kept for the fallback path only)
- Modify: `web/src/ui/DevPanel.js` (outfit section)
- Modify: `web/src/main.js` (wire dev-panel outfit changes to `player.outfit`)
- Test: `web/tests/rigassets.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces:
  - `loadRigAssets(fetchFn = fetch, base = 'rig/'): Promise<{ rig, clips, items, images } | null>` — fetches the three JSON files and every non-null wearable sprite; returns `null` (and `console.warn`s) on any failure. `images` is a `Map<string, HTMLImageElement>`; in node tests, image loading is skipped when `typeof Image === 'undefined'`.
  - `DevPanel` gains `onOutfit(outfit)` hook and `setOutfitItems(items)`; one `<select>` per kind (incl. "none") plus an `<input type="color">` per kind. Unlike other dev overrides, outfit changes are real (saved).
- [ ] **Step 1: Write failing tests** in `web/tests/rigassets.test.js`: a fake `fetchFn` returning the real files → non-null with 15 bones; a `fetchFn` that rejects, or returns invalid JSON for `anims.json` → resolves `null` (no throw).
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** `loadRigAssets`. In `Renderer`: start loading in the constructor; when ready, build `Animator` and `RigRenderer`. New `_drawPlayer` path when rig assets are ready:
  1. `aimDown` as today; `pose = animator.update(p, dt, { time, aimDown })`.
  2. Pickaxe angle in rig space: convert `st.aimX/aimY` with `toRigSpace`, `aim = atan2` from the `armF_upper` joint, `swing = mineState===1 ? -1.5 + swingPhase^2.2 · 2.1 : 0` (facing already normalised), idle angle `0.9`.
  3. `world = applyOverlays(...)`, `canvas = rigRenderer.render(world, p.outfit, { sprite: this._pickSprite(color), angle, color })`.
  4. Draw `canvas` into `(cx - 16, top, 32, 32)`, mirrored when `facing < 0`. Keep the jetpack-flame rect.
  Otherwise fall back to the existing sheet path unchanged. When assets arrive, re-run `sanitizeOutfit(player.outfit, items)`.
  `Renderer` needs `dt`; pass the frame dt it already receives (line 78 doc) through to `_drawPlayer`.
- [ ] **Step 4: Run** full `npx vitest run` — expect PASS.
- [ ] **Step 5: Verify in the browser:** `preview_start` the web dev server (add a `.claude/launch.json` entry for `npm run dev` in `web/` if missing). Check, facing both ways: idle, walk, jump/fall/land, mine side and down (hand on the grip throughout), ladder, hurt, jetpack. In the dev panel, swap each wearable, set it to none, and recolour it. Reload the save and confirm the outfit persists. Delete `rig.json` temporarily (or block it in devtools) and confirm the old sheet still draws. Console has no errors. Take a screenshot.
- [ ] **Step 6: Commit** (with user approval) — `Web rig: draw the player from the skeleton`.

### Task 8: Dev-only save endpoint

**Files:**
- Create: `web/vite/rigSavePlugin.js`
- Modify: `web/vite.config.js` (`plugins: [rigSavePlugin()]`)
- Test: `web/tests/rigsave.test.js`

**Interfaces:**
- Produces:
  - `validateRigSave(name: string, body: string): { ok: true, json: object } | { ok: false, error: string }` — `name` must be exactly `'rig.json'` or `'anims.json'`; body must parse to a plain object; `anims.json` values must each have numeric `duration > 0` and an object `keys`; `rig.json` must have a `bones` array.
  - `rigSavePlugin(): import('vite').Plugin` — `apply: 'serve'`; middleware for `POST /__rig/save?file=<name>`; writes `public/rig/<name>` pretty-printed (2 spaces + trailing newline); responds `200 {ok:true}` or `400 {error}`.
- [ ] **Step 1: Write failing tests**: valid anims body → ok; `'../index.html'`, `'rig.json.bak'` → rejected; `'not json'` → rejected; anims clip with `duration: 0` → rejected; `rigSavePlugin().apply === 'serve'`.
- [ ] **Step 2: Run** `npx vitest run tests/rigsave.test.js` — expect FAIL.
- [ ] **Step 3: Implement** (no new deps; use `node:fs/promises` and the raw request stream).
- [ ] **Step 4: Run** — expect PASS. Run `npm run build` and confirm `dist/` contains no `rig-editor.html` and the bundle has no `__rig/save` string.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: dev-only save endpoint`.

### Task 9: Animation editor page and clip tuning

**Files:**
- Create: `web/rig-editor.html`
- Create: `web/src/editor/RigEditor.js`
- Modify: `web/public/rig/anims.json` (tuned clips)

**Interfaces:**
- Consumes: `loadRigAssets`, `Animator`/`sampleClip`, `applyOverlays`, `RigRenderer`, `defaultOutfit`, the `/__rig/save` endpoint.
- Produces: an editor page reachable at `http://localhost:<port>/rig-editor.html` in dev.

- [ ] **Step 1: Build the page** with: clip list; timeline (keys per bone; click to select, drag to move in time, buttons add/delete key at the playhead); bone picking by click on the canvas (nearest joint) and a bone list; angle/dx/dy numeric fields + drag-to-rotate on the canvas; play/pause, speed (0.25x–2x), scrub; zoom 4x–8x with nearest scaling; onion skin of the previous key at 30% alpha; outfit + colour preview (same controls as the dev panel); an "aim" toggle where the mouse sets the look/pick target and a "mining" toggle to preview IK; Save button → `POST /__rig/save?file=anims.json`, showing the server's error text on failure. All drawing goes through `RigRenderer` so it matches the game.
- [ ] **Step 2: Verify in the browser:** open the editor, change a key, save, reload — change persists in `public/rig/anims.json`; an invalid edit (duration 0 via field) is refused with the error shown.
- [ ] **Step 3: Tune all 10 clips** in the editor until they read clearly at 1x in the game: walk with contact/passing poses and 1 px torso bob; mine_side/mine_down with anticipation, strike at the hit moment, follow-through; jump crouch → stretch; fall with arms up; land squash; climb alternating arms/legs; hurt recoil; jet legs trailing. Check each in the game (Task 7 checklist again), screenshot walk + mining.
- [ ] **Step 4: Run** full `npx vitest run` (the Task 3 data check guards the tuned file) — expect PASS.
- [ ] **Step 5: Commit** (with user approval) — `Web rig: animation editor and tuned clips`.
