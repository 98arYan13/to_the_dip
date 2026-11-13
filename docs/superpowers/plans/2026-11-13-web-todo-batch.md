# Web TODO Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the concrete unchecked items of `web/TODO.md` (ladders, death rules, pickaxe size, radar cooldown, jump, lamp light, rarer ores). Items that are really features needing design are listed under "Out of scope" and get their own spec.

**Architecture:** All work is in the existing vanilla-JS/Canvas game in `web/src`. Tunables go in `web/src/config.js`; rules stay pure functions covered by vitest in `web/tests`; visual/audio parts are verified in the browser via the dev server (port 5273).

**Tech Stack:** JS (ES modules), Vite 5.4, Vitest 2.1 (`cd web && npm test`), Python+PIL for `tools/make_pickaxe.py`.

**Spec:** none — the source is `web/TODO.md` (unchecked items). Decisions below that the TODO leaves open are marked **(decision)**; change them in the one named constant if you disagree.

## Global Constraints

- Never edit/tick `web/TODO.md` without asking the user (user rule). Plan ends with a *proposal* to tick.
- Never `git commit` unless the user says so; the commit steps below are written for when they do.
- Reply/UI text language: game UI text is English; identifiers English.
- Inputs only via Input Map actions in `config.js` `KEYBINDS` (no raw keycodes in code).
- Web dev server port 5273 (5173 is taken).
- Existing saves must still load: any new economy field needs a default in `Economy.load`.

## Review Focus

- Death with an empty/ore-only cargo: nothing breaks, no negative counts. Death while carrying only materials: all kept.
- New Map when ladders already > 10: must not reduce them (`max`, not set).
- Old save (no new fields) loads with unchanged behaviour.
- Jump pressed in a 1-tile-high tunnel / while on a ladder / while jetting: no clipping, no double jump.
- Aura reveal near world edges (x<0, y>H): no out-of-bounds index.
- Picking up a ladder that other ladders hang from: neighbours stay (ladder only needs *a* support at placement time).

---

## File Structure

- `web/src/config.js` — constants: ladder price/start, `RADAR.COOLDOWN`, `PHYSICS.JUMP_H`, `PICKAXE_SCALE`, `LIGHTING.AURA_TILES`, ore rarity factor.
- `web/src/systems/Economy.js` — `applyDeath`, `newMapState`.
- `web/src/systems/Items.js` — add `pickUpLadder`.
- `web/src/entities/Player.js` — jump, ladder step events.
- `web/src/anim/Overlays.js` / `web/src/render/Renderer.js` — pickaxe angle & size.
- `web/src/world/Visibility.js`, `web/src/render/Lighting.js` — aura + helmet lamp.
- `web/src/audio/SFX.js`, `web/src/core/EventBus.js` — ladder-climb sound.
- `web/src/world/WorldGen.js` — ore rarity.
- Tests: `web/tests/progression.test.js`, `economy.test.js`, `items.test.js`, `animator.test.js`, `worldgen.test.js`.

---

### Task 1: Ladders — cheaper, 10 at start, 10 on New Map

**Files:** Modify `web/src/config.js:445`, `web/src/systems/Economy.js` (`newMapState`); Test `web/tests/equipment.test.js`, `web/tests/progression.test.js`.

**Interfaces:**
- Produces: `CONSUMABLES.ladder.price` (= 3, **decision**, was 6) and `.start` (= 10).
- `Economy.newMapState()` returns `consumables.ladder === Math.max(old, CONSUMABLES.ladder.start)`.

- [ ] **Step 1: Failing tests.** In `equipment.test.js` change the ladder test to: fresh economy has `consumables.ladder === 10`; `buyConsumable('ladder')` with `credits = CONSUMABLES.ladder.price` succeeds and yields 11. In `progression.test.js` add `new map keeps at least 10 ladders`: set `e.consumables.ladder = 2` → `newMapState().consumables.ladder === 10`; set 25 → stays 25.
- [ ] **Step 2:** Run `cd web && npx vitest run tests/equipment.test.js tests/progression.test.js` → FAIL.
- [ ] **Step 3:** Set `price: 3, start: 10` on `ladder` in `CONSUMABLES`; in `newMapState` set the ladder count with `Math.max`.
- [ ] **Step 4:** Same command → PASS (the old "ladders and bombs are lost on death" test is rewritten in Task 2, expect only that one to fail until then).
- [ ] **Step 5: Commit** `git add web/src web/tests && git commit -m "web: cheaper ladders, 10 at start and on new map"`.

### Task 2: Death keeps everything except ores

**Files:** Modify `web/src/systems/Economy.js:327` (`applyDeath`), `web/src/main.js:~348` (toast text); Test `web/tests/progression.test.js`.

**Interfaces:** Consumes `isOre(id)` from `config.js` (already exported; materials have `kind:'material'`). Produces `applyDeath()` that zeroes only `cargo[o]` where `isOre(o)` and leaves `consumables` untouched.

- [ ] **Step 1: Replace test** "ladders and bombs are lost on death" with: after `applyDeath`, `consumables.ladder` and `bigBomb` unchanged; a cargo with `ORE.COAL=3`, `ITEM.STEEL=2` → coal 0, steel 2; death on empty cargo emits no error.
- [ ] **Step 2:** Run `npx vitest run tests/progression.test.js` → FAIL.
- [ ] **Step 3:** Edit `applyDeath` to loop `o = 1..ORES.length-1`, zero only ores; drop the consumables reset (keep the two `bus.emit`s). Change the toast in `main.js` to `You died (${cause})! Ores lost, the rest of your pack kept.`
- [ ] **Step 4:** Run → PASS; then `npm test` full → PASS.
- [ ] **Step 5: Commit** `web: keep non-ore pack contents on death`.

### Task 3: Radar cooldown longer + smaller pickaxe head

**Files:** Modify `web/src/config.js:547`, `tools/make_pickaxe.py`, `web/public/player/pickaxe.png`, `pickaxe_tint.png`, `web/src/render/Renderer.js` (two draw paths).

**Interfaces:** `RADAR.COOLDOWN = 10` (**decision**, was 6). New const `PICKAXE_HEAD_SCALE = 0.8` in `make_pickaxe.py` (**decision**; covers both TODO lines "reduce head size").

- [ ] **Step 1:** Set `RADAR.COOLDOWN: 10`. Run `npm test` — if a test pins 6, update it to read `RADAR.COOLDOWN`.
- [ ] **Step 2:** In `make_pickaxe.py` shrink only the metal head (rows of kind 2) by `PICKAXE_HEAD_SCALE` toward the handle tip, keeping handle length and grip (0, 22.5) unchanged so `Renderer.js` offsets stay valid. Re-run `python tools/make_pickaxe.py web/public/player` and check both PNGs have identical size to before (`py -c "from PIL import Image;print(Image.open('web/public/player/pickaxe.png').size)"` → `(54, 45)`).
- [ ] **Step 3:** Verify in browser (`npm run dev -- --port 5273`): mine a block, screenshot; head visibly smaller, handle in hand. Fix tint alignment if the tint layer no longer matches (both PNGs must be regenerated together).
- [ ] **Step 4: Commit** `web: longer radar cooldown, smaller pickaxe head`.

### Task 4: Two-tile jump + pickaxe synced with arms in air

**Files:** Modify `web/src/config.js` (`PHYSICS.JUMP_H`), `web/src/entities/Player.js:~120-135`, `web/src/render/Renderer.js:~358-366` and `:443-460`, `web/src/anim/Overlays.js`; Test `web/tests/landing.test.js` (physics-style tests live there) or new `web/tests/jump.test.js`.

**Interfaces:**
- Produces `jumpVelocity(heightPx: number, gravity: number): number` exported from `Player.js` (= `sqrt(2·g·h)`), and `PHYSICS.JUMP_H = 34` (2 tiles + 2px clearance, tile = 16px; **decision**).
- Jump triggers on `input.wasPressed('jet')` while `onGround && !onLadder`, sets `vy = -jumpVelocity(JUMP_H, PHYSICS.GRAVITY * fallMult)`. Holding the key with a jetpack still thrusts after take-off (existing behaviour untouched).

- [ ] **Step 1: Failing tests.** `jumpVelocity(34, 650)` ≈ 210.3; simulate with `Physics` + a Player on flat ground: after a jump, peak rise is between 32 and 36 px; a Player in a 1-tile-high tunnel (solid tile 1 above head) does not end inside solid; pressing while `onLadder` or airborne changes nothing.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `jumpVelocity` and the grounded-press branch in `Player.update` before gravity is applied. The `jump` animation clip already plays when `vy < -40` (`Animator.js:21`).
- [ ] **Step 4: Pickaxe/hand sync.** When not mining (`mineState !== 1`) the pickaxe uses a fixed `idle` angle (`Renderer.js:449`, `0.9` in rig path). Replace with the angle of the pose's back-hand grip: in `Overlays.js` export `idleGripAngle(rig, pose)` (angle of forearm `armB` from elbow to hand) and use it for `pickAngle` when not mining so the tool follows the jump/jet/climb poses. Test: `idleGripAngle` returns different angles for the `jump` and `idle` poses (use existing `anims.json` + `solveWorld` as in `overlays.test.js`).
- [ ] **Step 5:** Run `npm test` → PASS. Browser check: jump, jet, walk — screenshot mid-jump; pickaxe stays in the hand.
- [ ] **Step 6: Commit** `web: 2-tile jump, pickaxe follows arm pose`.

### Task 5: Ladder polish — climb sound, pickup, animation check

**Files:** Modify `web/src/core/EventBus.js` (add `LADDER_STEP: 'player:ladderStep'`), `web/src/entities/Player.js` (emit), `web/src/audio/SFX.js` (`ladderStep()`), `web/src/systems/Items.js` (`pickUpLadder`), `web/src/main.js:~409` (slot4 on an existing ladder tile), `web/src/anim/Animator.js:65`; Test `web/tests/progression.test.js`, `web/tests/animator.test.js`.

**Interfaces:**
- `pickUpLadder(w: World, bus: EventBus, x: number, y: number): boolean` — true and tile becomes AIR (DIRTY, `EV.TILE_CHANGED`) only if the tile is `TILE.LADDER`.
- Player emits `EV.LADDER_STEP` each time accumulated climb distance crosses `PHYSICS.LADDER_STEP_DIST` (= 12, **decision**), reusing the `FOOTSTEP_DIST` accumulator pattern.
- In `main.js`: pressing slot4 while aiming at a ladder tile within 5 tiles removes it and `economy.consumables.ladder++` (emit `CONSUMABLES_CHANGED`) instead of placing.

- [ ] **Step 1: Failing tests.** `pickUpLadder` on a placed ladder → true & AIR; on soil → false & unchanged. Animator: with `onLadder=true, onGround=false, vy=0` for 1 s, `climbDist` does not advance (arms don't cycle while hanging still); with `vy=90` it does.
- [ ] **Step 2:** Run → FAIL (pickup missing; check the animator test — if it already passes the animation item is verified by test only).
- [ ] **Step 3:** Implement; `ladderStep()` in SFX: short wooden tick, copy `footstep()` structure with `e.osc(v,'triangle', 300*p, 220, t, 0.05, 0.14*g)`.
- [ ] **Step 4:** Browser check: place ladders, climb up/down — animation reads well, ticks sound, slot4 on a ladder returns it. Adjust `climbDist / 24` divisor in `Animator.js` if the arms slip against movement.
- [ ] **Step 5:** `npm test` → PASS. **Commit** `web: ladder sound, pickup, climb animation fix`.

### Task 6: Light around the player and headlamp upgrade

**Files:** Modify `web/src/config.js` (`LIGHTING.AURA_TILES`, tech `led_lamp`), `web/src/world/Visibility.js:58-80`, `web/src/render/Lighting.js:~130-143`, `web/src/main.js:450,514,592` (use `economy.stat('headlamp', economy.radar.headlamp)`); Test `web/tests/techdata.test.js`, `web/tests/overlays.test.js` or new `web/tests/visibility.test.js`.

**Interfaces:**
- `LIGHTING.AURA_TILES = 3` (**decision**): every tile within this radius of the player is revealed regardless of cone direction (cheap circle in the existing `Visibility.update` loop; guard `inBounds`).
- New tech `{ id: 'led_lamp', era: 3, requires: ['radio'], effect: { stat: 'headlamp', mul: 1.3 }, cost: tc(...) }` — copy the `deep_scanner` entry shape; price to the era's trip-income rule enforced by `techdata.test.js` (run it to tune the cash number).
- Helmet light: a second small `_glow` at the head position (`playerX`, `playerY - 10`) in `Lighting.js`, colour `LIGHTING.CONE_COLOR`, radius 40.

- [ ] **Step 1: Failing tests.** `Visibility`: with player at tile (10,10) and aim pointing right, tile (8,10)-behind-player within 3 tiles becomes `DISCOVERED`; a tile 6 away behind does not; at world edge (0,0) no exception. `techStat(['led_lamp'],'headlamp',190) === 247`. `techdata.test.js` passes with the new tech.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement aura, helmet glow, tech, and `economy.stat('headlamp', …)` in the three `main.js` call sites.
- [ ] **Step 4:** `npm test` → PASS. Browser check underground: dark tiles around the character appear, helmet glow visible, buying `led_lamp` extends the cone (Tech screen entry shows).
- [ ] **Step 5: Commit** `web: player aura reveal, helmet light, LED lamp tech`.

### Task 7: Rarer special ores

**Files:** Modify `web/src/world/WorldGen.js` (ore weight), `web/src/config.js` (`ORE_RARITY_BY_PRICE` factor); Test `web/tests/worldgen.test.js`, `web/tests/economy.test.js` (balance).

**Interfaces:** Weight multiplier `rarity(price) = price <= 100 ? 1 : 0.6` (**decision**; threshold in a named config const) applied when picking ores per host band.

- [ ] **Step 1: Failing test.** Count ore tiles of seed 1 before/after: ores with `price > 100` total ≤ 70% of the old count (record the old count as a number in the test); common ores' count within ±10% of old.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test` (the `expectedTripIncome` balance tests may shift — update expectations only if the ordering invariants still hold; otherwise lower the factor). 
- [ ] **Step 5: Commit** `web: rarer high-value ores`.

---

## Out of scope (need their own brainstorm → spec → plan)

These TODO lines are features, not tweaks; planning them now would be guessing:
1. **Backpack redesign** (visible contents, capacity by item count/size) — touches Economy, HUD, Shop, save format.
2. **Blueprint scenarios** for special tech.
3. **Space travel** (Moon/Mars/interstellar), **spaceship & space station** — new maps, art, whole new layer.
4. **Per-device/backpack pixel icons** — art pipeline (ChatGPT/Gemini → `prepare_sprite.py`), needs user-generated art.
5. **Elevator tech** — new tile/entity + tech node; best planned after Task 5 (ladders) lands.

Duplicates collapsed: "reduce pickaxe head size" ×2 → Task 3; ladder-climb animation and ladder-removal are in Task 5.

## Self-review

- Coverage: every unchecked TODO line is either in Tasks 1–7 or in Out of scope (ladder price, 10 ladders, pickaxe head ×2, death keeps non-ore, ladder sound, radar cooldown, arm/pickaxe sync, climb animation, backpack*, lamp+aura, device icons*, rarer ores, blueprints*, space*, spaceship*, head-light upgrade, 2-tile jump, ladder pickup, elevator*; * = out of scope).
- Names consistent: `jumpVelocity`, `pickUpLadder`, `LADDER_STEP`, `led_lamp`, `AURA_TILES`.
- Risk: Task 4 Step 4 and Task 5 Step 4 need eyeballing in the browser; tests only cover the maths.

## Execution handoff

After the user reviews: after Task 1–3 (config-level, low risk) Tasks 4–7 are independent and could each run in its own session, but 4 and 5 both touch `Player.js`/`Renderer.js`, so run those two sequentially.
