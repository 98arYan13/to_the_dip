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

## Quick reference
| Asset | --size | Mode | Godot node |
|---|---|---|---|
| Character / enemy | 32 | `--frames N` | AnimatedSprite2D |
| Web-game player (3x) | 96 | `--frames N --pad 3 --height 84 --ref-frame i` | Canvas, 32 world px |
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
