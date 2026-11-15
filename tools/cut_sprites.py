"""Cut separate objects out of a raw AI sheet (magenta background) into individual pixel-art PNGs.

    python tools/cut_sprites.py raw.png out_dir name1,name2,... (--scale 0.125 | --height 30)
        [--palette art_source/palette/p.hex | --colors 32] [--strip-ground]

Objects are found as connected blobs (reading order: rows top to bottom, then left to right).
--scale: one common factor for every object; --height: each object scaled to this height.
--strip-ground removes the thin dark ground line Gemini draws under buildings.
Needs Pillow + numpy.
"""
import argparse, json, os
import numpy as np
from PIL import Image


def load_palette(path):
    cols = [l.strip().lstrip('#') for l in open(path) if l.strip() and not l.startswith(';')]
    return np.array([[int(c[i:i + 2], 16) for i in (0, 2, 4)] for c in cols], dtype=np.int32)


def blobs(mask):
    """Bounding boxes of mask blobs, merging boxes that overlap (small detached bits join their object)."""
    from collections import deque
    h, w = mask.shape
    seen = np.zeros_like(mask)
    boxes = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)]); seen[y0, x0] = 1
        y1 = y2 = y0; x1 = x2 = x0; n = 0
        while q:
            y, x = q.popleft(); n += 1
            y1, y2, x1, x2 = min(y1, y), max(y2, y), min(x1, x), max(x2, x)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = 1; q.append((ny, nx))
        if n > 200:
            boxes.append([x1, y1, x2 + 1, y2 + 1])
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                g = 40  # small gaps (antennas, lamps) still join their object
                if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] + g and b[1] < a[3] + g:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]; merged = True; break
            if merged:
                break
    # reading order: group into rows by vertical centre
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in boxes:
        if rows and abs((b[1] + b[3]) / 2 - (rows[-1][0][1] + rows[-1][0][3]) / 2) < (b[3] - b[1]) / 2:
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out_dir'); ap.add_argument('names')
    ap.add_argument('--scale', type=float); ap.add_argument('--height', type=int)
    ap.add_argument('--palette'); ap.add_argument('--colors', type=int, default=32)
    ap.add_argument('--strip-ground', action='store_true'); ap.add_argument('--tol', type=int, default=120)
    a = ap.parse_args()
    names = a.names.split(',')
    rgb = np.array(Image.open(a.src).convert('RGB')).astype(np.int32)
    bg = np.abs(rgb - [255, 0, 255]).sum(2) < a.tol
    mask = ~bg
    boxes = blobs(mask)
    if a.strip_ground:  # drop the dark line under each object, then re-trim its box
        dark = rgb.sum(2) < 120
        for b in boxes:
            x1, y1, x2, y2 = b
            while y2 > y1 and (mask[y2 - 1, x1:x2] & ~dark[y2 - 1, x1:x2]).sum() < 0.15 * mask[y2 - 1, x1:x2].sum():
                mask[y2 - 1, x1:x2] = False; y2 -= 1
            # ground line was wider than the object: re-trim columns using the lowest 5% of rows
            cols = np.nonzero(mask[y1:y2, x1:x2].any(0))[0]
            b[:] = [x1 + cols[0], y1, x1 + cols[-1] + 1, y2]
    if len(boxes) != len(names):
        raise SystemExit(f'found {len(boxes)} objects, expected {len(names)}: {boxes}')
    pal = load_palette(a.palette) if a.palette else None
    os.makedirs(a.out_dir, exist_ok=True)
    out = {}
    for name, (x1, y1, x2, y2) in zip(names, boxes):
        crop = rgb[y1:y2, x1:x2]; m = mask[y1:y2, x1:x2]
        s = a.scale or a.height / (y2 - y1)
        W, H = max(1, round((x2 - x1) * s)), max(1, round((y2 - y1) * s))
        rgba = np.dstack([crop, m * 255]).astype(np.uint8)
        im = Image.fromarray(rgba, 'RGBA').resize((W, H), Image.BOX)
        arr = np.array(im).astype(np.int32)
        alpha = arr[..., 3] > 127
        col = arr[..., :3]
        if pal is not None:
            d = ((col[..., None, :] - pal[None, None]) ** 2).sum(-1)
            col = pal[d.argmin(-1)]
        else:
            q = Image.fromarray(col.astype(np.uint8)).quantize(a.colors, dither=Image.Dither.NONE).convert('RGB')
            col = np.array(q).astype(np.int32)
        res = np.dstack([col, alpha * 255]).astype(np.uint8)
        Image.fromarray(res, 'RGBA').save(os.path.join(a.out_dir, name + '.png'))
        out[name] = [W, H]
    print(json.dumps(out))


if __name__ == '__main__':
    main()
