"""Crop labelled tile sheets in assets/tilesets/*.jpg into 32x32 PNGs in web/public/tiles/.
Tiles are found as large non-background blocks; output is <sheet>_<n>.png in reading order."""
import glob, os, sys
import numpy as np
from PIL import Image

SRC, DST, SIZE = 'assets/tilesets', 'web/public/tiles', 32

def runs(mask, min_len):
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None: start = i
        elif not v and start is not None:
            if i - start >= min_len: out.append((start, i))
            start = None
    return out

def crop_sheet(path):
    img = Image.open(path).convert('RGB')
    a = np.asarray(img).astype(int)
    bg = np.median(np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3)]), axis=0)
    fg = np.abs(a - bg).sum(axis=2) > 30
    tiles = []
    for c0, c1 in runs(fg.mean(axis=0) > 0.15, 150):
        for r0, r1 in runs(fg[:, c0:c1].mean(axis=1) > 0.6, 150):
            tiles.append((r0, c0, r1, c1))
    tiles.sort(key=lambda t: (round(t[0] / 200), t[1]))  # reading order
    name = os.path.splitext(os.path.basename(path))[0].replace(' ', '-')
    for n, (r0, c0, r1, c1) in enumerate(tiles):
        ins = int((r1 - r0) * 0.03)  # drop the dark outline / shadow
        box = (c0 + ins, r0 + ins, c1 - ins, r1 - ins)
        img.crop(box).resize((SIZE, SIZE), Image.BOX).save(f'{DST}/{name}_{n}.png')
    print(name, len(tiles))

for old in glob.glob(f'{DST}/*.png'): os.remove(old)  # outputs are fully regenerated
for p in sorted(glob.glob(f'{SRC}/*.jpg')): crop_sheet(p)
