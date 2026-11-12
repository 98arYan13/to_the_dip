"""Procedural pickaxe sprite at 3x detail (matches the 96px player), written for runtime tinting.

Usage: python tools/make_pickaxe.py web/public/player

  pickaxe.png       full sprite: wood handle + grey metal head + dark outline
  pickaxe_tint.png  only the metal (grey), multiplied by the pickaxe's material colour in-game
Grip (hand) is at the left end of the handle, x=0, y=GRIP_Y; the handle points along +x.
The game draws it at 1/3 size (SCALE), so 1 sprite px = 1/3 world px.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SCALE = 3
W, H = 54, 45
GRIP_Y = 22.5

OUTLINE = (26, 22, 30)
WOOD = [(196, 140, 84), (160, 108, 60), (122, 80, 44), (88, 56, 30)]  # light -> dark
METAL = [(250, 250, 250), (214, 214, 214), (168, 168, 168), (120, 120, 120), (84, 84, 84)]


def main(out_dir):
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    kind = np.zeros((H, W), np.int8)       # 0 empty, 1 wood, 2 metal
    shade = np.zeros((H, W), np.int8)

    # handle: rows 20..25, slight grain
    hy0, hy1 = 20, 26
    hand = (xs < 40) & (ys >= hy0) & (ys < hy1)
    kind[hand] = 1
    rowshade = {20: 0, 21: 1, 22: 1, 23: 2, 24: 2, 25: 3}
    for y, s in rowshade.items():
        shade[y, :40] = s
    rng = np.random.default_rng(7)
    for x in rng.choice(np.arange(3, 38), 9, replace=False):  # grain streaks
        y = rng.integers(21, 25)
        shade[y, x:x + 3] = min(3, shade[y, x] + 1)
    # leather wrap near the grip
    for x in range(2, 10, 3):
        shade[hy0:hy1, x] = 3

    # head: crescent = outer ellipse minus inner ellipse, tips curve back toward the handle
    cy = H / 2
    outer = ((xs - 33) / 17) ** 2 + ((ys - cy) / 21) ** 2 <= 1
    inner = ((xs - 24) / 17) ** 2 + ((ys - cy) / 24) ** 2 <= 1
    crescent = outer & ~inner & (xs > 28)
    collar = (xs >= 36) & (xs <= 43) & (ys >= cy - 7) & (ys <= cy + 7)
    metal = crescent | collar
    kind[metal] = 2
    # metal shading: lit from top-left, bright rim on the outer curve
    d_out = 1 - (((xs - 33) / 17) ** 2 + ((ys - cy) / 21) ** 2)   # 0 at outer edge
    t = (ys / H) * 0.6 + np.clip(d_out, 0, 1) * 0.8
    lv = np.digitize(t, [0.25, 0.45, 0.65, 0.85])
    shade[metal] = lv[metal]
    shade[collar] = np.where(ys[collar] < cy, 2, 3)
    shade[collar & (xs == 36)] = 1                                  # collar highlight
    edge = metal & ~np.pad(metal, ((0, 0), (0, 2)))[:, 2:]          # sharp outer edge gleam
    shade[edge & (ys < cy)] = 0

    img = np.zeros((H, W, 4), np.uint8)
    tint = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            if kind[y, x] == 1:
                img[y, x] = WOOD[shade[y, x]] + (255,)
            elif kind[y, x] == 2:
                img[y, x] = METAL[min(4, shade[y, x])] + (255,)
                tint[y, x] = img[y, x]
    filled = kind > 0
    p = np.pad(filled, 1)
    near = p[2:, 1:-1] | p[:-2, 1:-1] | p[1:-1, 2:] | p[1:-1, :-2]  # no wrap-around
    ring = near & ~filled
    img[ring] = OUTLINE + (255,)

    out = Path(out_dir)
    Image.fromarray(img).save(out / "pickaxe.png")
    Image.fromarray(tint).save(out / "pickaxe_tint.png")


if __name__ == "__main__":
    main(sys.argv[1])
