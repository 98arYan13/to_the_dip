"""Split the player sheet into a headless body sheet + a pre-rotated head strip for mouse look.

Usage: python tools/split_head.py assets/characters/player_base/player_base.png web/public/player

Writes into the output dir:
  player_body.png  same layout as the input; the head is erased on LOOK_FRAMES
  player_head.png  ANGLES head variants, CELL x CELL each, neck pivot at PIVOT
  player_head.json {"cell", "pivot", "angles", "neck": [[x, y] | null per frame]}
The head comes from frame 0 (idle). Rotation is done 8x upscaled with nearest
neighbour so it stays crisp pixel art (a simple RotSprite).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Sizes below are for a 32px frame and scale with the sheet height (32, 64, 96...).
HEAD_ROWS_32 = 10       # head height in px, from the first opaque row down
LOOK_FRAMES = list(range(0, 6)) + list(range(14, 18))  # idle, walk, jump: upright head
ANGLES = list(range(-30, 31, 10))  # degrees, + = looking down
CELL_32 = 24
PIVOT_32 = (12, 16)     # neck point inside a head cell


def head_box(f):
    ys, xs = np.nonzero(f[..., 3])
    top = ys.min()
    m = f[top:top + HEAD_ROWS, :, 3] > 0
    hx = np.nonzero(m)[1]
    return top, hx.mean()


def main(src, out_dir):
    global FRAME, HEAD_ROWS, CELL, PIVOT
    out = Path(out_dir)
    a = np.array(Image.open(src).convert("RGBA"))
    FRAME = a.shape[0]
    k = FRAME // 32
    HEAD_ROWS, CELL, PIVOT = HEAD_ROWS_32 * k + (k - 1), CELL_32 * k, (PIVOT_32[0] * k, PIVOT_32[1] * k)
    n = a.shape[1] // FRAME
    frames = [a[:, i * FRAME:(i + 1) * FRAME].copy() for i in range(n)]

    top0, cx0 = head_box(frames[0])
    neck0 = (int(round(cx0)), int(top0) + HEAD_ROWS)  # frame-0 neck point (x, y)
    head = frames[0][top0:top0 + HEAD_ROWS].copy()

    # head in a CELL canvas with the neck on PIVOT
    cell = np.zeros((CELL, CELL, 4), np.uint8)
    ox, oy = PIVOT[0] - neck0[0], PIVOT[1] - HEAD_ROWS
    for y in range(HEAD_ROWS):
        for x in range(FRAME):
            tx = x + ox
            if 0 <= tx < CELL and head[y, x, 3]:
                cell[y + oy, tx] = head[y, x]
    S = 4
    big = Image.fromarray(cell).resize((CELL * S, CELL * S), Image.NEAREST)
    strip = Image.new("RGBA", (CELL * len(ANGLES), CELL))
    for k, deg in enumerate(ANGLES):
        r = big.rotate(-deg, resample=Image.NEAREST, center=(PIVOT[0] * S, PIVOT[1] * S))
        r = r.resize((CELL, CELL), Image.NEAREST)
        strip.paste(r, (k * CELL, 0))
    strip.save(out / "player_head.png")

    necks = []
    for i, f in enumerate(frames):
        if i not in LOOK_FRAMES:
            necks.append(None)
            continue
        top, cx = head_box(f)
        necks.append([neck0[0] + round(cx - cx0), int(top + HEAD_ROWS)])
        f[:top + HEAD_ROWS] = 0
        a[:, i * FRAME:(i + 1) * FRAME] = f
    Image.fromarray(a).save(out / "player_body.png")
    (out / "player_head.json").write_text(json.dumps(
        {"frame": FRAME, "cell": CELL, "pivot": PIVOT, "angles": ANGLES, "neck": necks}))
    print(json.dumps({"frames": n, "neck0": neck0, "look_frames": LOOK_FRAMES}))


if __name__ == "__main__":
    main(*sys.argv[1:3])
