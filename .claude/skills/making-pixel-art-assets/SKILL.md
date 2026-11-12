---
name: making-pixel-art-assets
description: Use when the Digger game needs any new sprite, character, animation, tileset, item, icon or UI art, or when the user drops a raw ChatGPT/Gemini image into art_source/raw/ or says "make this game-ready" / "این رو برای بازی آماده کن".
---

# Making pixel-art assets (Digger)

## Overview
Claude leads the art pipeline. The user only generates raw images in ChatGPT or Gemini (Claude cannot), using prompts Claude writes. Claude turns them into real pixel art and puts them in the game. AI images are *fake* pixel art (≈1024px, blurry, hundreds of colors); nothing raw ever goes into `assets/`.

## Roles
| Who | Does |
|---|---|
| Claude | decides what asset is needed, writes the prompt, processes, cleans, animates, imports, tests |
| User | pastes prompt into ChatGPT/Gemini, saves result to `art_source/raw/`, does final artistic touch-ups |
| `tools/prepare_sprite.py` | key out magenta, split frames, one common scale, bottom-align, palette reduce |
| `aseprite` MCP | frames, tags, durations, cleanup, outline, palette, `export_spritesheet` |
| `godot` MCP | `run_project` + `get_debug_output` to verify in game |

## Pipeline
1. **Request.** Fill a template from `prompts.md` (same folder). Give the user the English prompt in a code block plus the exact save name: `art_source/raw/<asset>_<anim>_raw.png`. For any frame/animation prompt, tell the user to attach the approved base sprite as reference.
2. **Look first.** Read the raw PNG. Reject and ask for a re-roll if: not magenta (#FF00FF) background, frame count wrong, frames overlap, character changes between frames, text/watermark over the figure.
3. **Process.** `python tools/prepare_sprite.py art_source/raw/X_raw.png art_source/work/X.png --frames N --size 32 [--palette art_source/palette/<p>.hex]`
   - Characters 32, tiles/items/icons 16. Tilesets: `--grid CxR --size 16`.
   - Use `--palette` once a project palette exists; until then `--colors 16`.
   - Default `--align bottom` (walk, idle, attack, dig). Use `--align keep` when the body moves vertically (jump, bob, fall, knockback) or the motion is erased.
   - JSON says `"split": "equal-split"` → frames touched; check the result carefully.
4. **Inspect.** Read the output PNG. Check same size/ground line across frames, no stray pixels, readable silhouette.
5. **Aseprite (MCP).** `create_canvas` 32x32 → `add_frame` until N frames → `import_image` the whole strip into each frame `i` (1-based) at `position {x: -(i-1)*32, y: 0}`; the canvas crops it to that frame's cell → `set_frame_duration` (fps table in `docs/TECHNICAL_GUIDE.fa.md` §4.4) → `create_tag` per animation → fix specks/outline with `draw_pixels` / `apply_outline` → `save_as art_source/characters/<name>.aseprite` → `export_spritesheet` (horizontal, padding 0, json true) to `assets/characters/<name>/<name>_<anim>.png`.
6. **Godot.** `AnimatedSprite2D` + `SpriteFrames` from the sheet (frame size 32x32, fps from the table), filter Nearest is project default. Run via `godot` MCP; no errors in `get_debug_output`.
7. **Hand-off.** Tell the user which file to touch up by hand, if anything looks off.

## Web rig body parts and wearables (web/ skeletal player)
The web player is a skeleton (`web/public/rig/rig.json`, 15 bones) drawn piece by piece, not a sprite sheet.
- Source of truth: `art_source/characters/player_rig.aseprite`, 96x96, one layer per bone named exactly as in `rig.json`, every piece drawn in the rig's **rest pose** (arms/legs hang down, torso/head point up, feet point right). Layer `guide` (from `python tools/export_rig.py guide art_source/work/rig_guide.png`) shows each bone's box; it is never exported.
- Export: `python tools/export_rig.py export art_source/characters/player_rig.aseprite` → `web/public/rig/parts/<bone>.png` + `parts.json` (sprite + pivot). It fails on off-palette pixels (`player_base_hd.hex`). An empty/missing layer keeps that bone's coloured rectangle.
- Raw art: ask Gemini for a **paper-doll sheet** (template in `prompts.md`), never a posed character. Gemini ignores exact pixel sizes and draws pieces at different scales, so scale each piece to its own bone length (+2 px overlap at each joint), then map colours to the palette, then place it at the bone's rest position (`export_rig.rest_world`). Back limbs = the front piece darkened ~28% and re-mapped to the palette.
- Aseprite MCP: `import_image` adds a NEW layer on top each call, so import layers bottom-to-top in `rig.json` `layer` order, then delete the default `Layer 1`.
- Verify in `web/rig-editor.html` (big view; set the outfit selects to none to see the bare body), not in-game where the player is tiny.
- Wearables (`wearables.json`, slots hat/shirt/pants/boots/gloves) use the same sprite+pivot format. `tint: true` items must be drawn in neutral light greys (recoloured in-game); special suits are `tint: false`.

## Quick reference
| Asset | --size | Mode | Godot node |
|---|---|---|---|
| Character / enemy | 32 | `--frames N` | AnimatedSprite2D |
| Web-game player (3x) | 96 | `--frames N --pad 3 --height 84 --ref-frame i` | Canvas, 32 world px |
| Web rig body part / wearable | per bone | paper-doll sheet → `player_rig.aseprite` layer → `tools/export_rig.py export` | `RigRenderer` |
| Boss | 64 | `--frames N` | AnimatedSprite2D |
| Tileset | 16 | `--grid CxR` | TileSet + TileMapLayer |
| Item / icon | 16 | `--frames 1` | Sprite2D / TextureRect |

## Common mistakes
- Backslash paths to the `aseprite` MCP break its JSON. Always `D:/...`, `C:/...`.
- Processing frames one by one: each gets a different scale. Process the whole strip in one call.
- Animations of one character at different sizes: without `--height`, each strip is scaled to fit its own biggest frame. Always pass the same `--height` and a standing `--ref-frame` for every animation, and one shared `--palette`.
- Frames touching each other in the raw image: `equal-split` cuts limbs and drags in pieces of neighbours. Separate the figures first, then process.
- Asking for a full walk cycle in one image: AI breaks consistency. Ask for 2–4 key poses per image.
- New chat without reference image: character drifts. Always attach the approved base sprite.
- Writing processed files straight to `assets/`: only Aseprite exports go there; intermediates go to `art_source/work/`.
- Pixel art is judged at 1x and at game scale; never approve from the 1024px raw.
- Gemini draws helmets/heads in three-quarter view unless the prompt spells out a strict 90° profile (front on the RIGHT edge, back on the LEFT, neck ring a flat band not an ellipse). A clean profile facing left is fine: mirror it.
- "Armor", "plates", "gauntlets" make Gemini draw knight armour. For sci-fi suits say "hardsuit / exosuit" and list what NOT to draw.
- Gemini adds black grid lines/cell frames when asked for a grid; always add the explicit "no grid lines, no borders, no cell frames" line. It also merges limb segments (whole arm instead of upper arm + forearm); cut them at the joint instead of re-rolling.
- Gemini's magenta is near, not exact (#FE01FA): key with tolerance, never by exact colour.
