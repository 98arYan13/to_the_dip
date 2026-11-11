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
