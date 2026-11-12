# Prompt templates for ChatGPT / Gemini

Replace `[...]`. Keep the style block identical across all assets of the game — consistency comes from repetition. Once a palette is chosen, add its name and hex list to the style block.

## Style block (append to every prompt)
```
Pixel art, hard nearest-neighbor edges, limited 16-color palette, 1-pixel dark outline,
simple cel shading with 2-3 tones per color, no anti-aliasing, no gradients, no blur, no texture noise.
Solid flat magenta background (#FF00FF). No text, no watermark, no UI, no grid lines.
```

## Base character (first; becomes the reference for everything else)
```
Game sprite of [description: who, clothes, colors, held item], 32x32 pixel character scaled up,
side view facing right, full body, standing idle pose, centered, single character only.
[STYLE BLOCK]
```

## Animation key poses (attach the approved base sprite)
```
Using the attached character as exact reference (same proportions, colors, outline, details),
create a horizontal sprite sheet of [N] frames of [animation], side view facing right: [pose 1], [pose 2], ...
Each frame in its own equal square cell with clear empty space between frames,
same character size and same ground line in every frame.
[STYLE BLOCK]
```
Pose lists: walk = `contact, down, passing, up` · idle = `neutral, slight inhale` · attack = `wind-up, swing, impact, recover` · jump = `crouch, rise, peak, fall` · hurt = `recoil, flinch` · dig = `raise pickaxe, strike ground, debris, recover`.

## Tileset
```
Tileset for a 2D side-scrolling platformer, 16x16 pixel tiles scaled up, arranged on a strict [C]x[R] grid,
each tile filling its cell exactly: [tile list in reading order].
Tiles must tile seamlessly, straight-on front view, no perspective.
[STYLE BLOCK without the magenta line]
```

## Item / icon
```
Game item icon, 16x16 pixels scaled up, [item], centered.
[STYLE BLOCK]
```

## Web rig: paper-doll sheets (attach the approved reference)
Shared rules block for every rig sheet (append after the piece list):
```
STRICT SIDE PROFILE: exact 90-degree side view facing RIGHT, like a classic 2D side-scrolling platformer sprite.
No front view, no three-quarter view, no perspective, no top view.
Every arm and leg piece is perfectly vertical, not tilted, not bent.
Both ends of every limb piece are rounded and extend 2-3 pixels past the joint so pieces overlap when assembled.
All pieces at the same pixel scale as each other.
Pixel art, hard nearest-neighbor edges, limited 32-color palette, 1-pixel dark outline,
simple cel shading with 2-3 tones per color, light from the upper left, no anti-aliasing, no gradients, no blur, no texture noise.
Solid flat magenta background (#FF00FF). No text, no numbers, no labels, no watermark, no UI.
No grid lines, no borders, no cell frames, no black lines between cells; the whole background is one flat magenta.
```
- **Body** (attach `assets/characters/player_base/player_base_hd.png`), 3x3 grid: head with neck (face on the RIGHT), torso in plain undershirt (no arms), hips in plain shorts, upper arm, forearm, fist (wrist at TOP), thigh, shin, bare foot (toes RIGHT). Give rough px sizes from `rig.json` (length x width) only as proportions. Save `art_source/raw/player_rig_parts_raw.png`.
- **Outfit** (attach the body sheet), 4x2 grid, "draw ONLY the clothing that fits over those body pieces (no skin)": torso piece, upper sleeve, lower sleeve, glove, waist piece, thigh piece, shin piece, boot. Tintable outfits: "ONLY in neutral light grey shades (recolored in-game)". Save `art_source/raw/wear_<id>_raw.png`.
- **Helmets** (no attachment needed), 2x2 grid, "draw ONLY the helmet, no head": say "each helmet fits a head about 20 px wide and 23 px tall on an 84-px character", put the visor/lamp on the RIGHT edge and the back on the LEFT, opaque visors (no transparency). Save `art_source/raw/helmets_raw.png`.
