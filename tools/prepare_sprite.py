"""Turn a raw AI image (ChatGPT/Gemini "fake pixel art", ~1024px) into a real pixel-art strip.

Sprite mode (default): key out the background, find N frames separated by empty columns,
scale all frames by ONE common factor, bottom-align each in a SIZE x SIZE cell, reduce colors.
Grid mode (--grid CxR, for tilesets): split into equal cells and scale each cell to SIZE.

    python tools/prepare_sprite.py raw.png out.png --frames 4 --size 32 [--palette art_source/palette/p.hex]
    python tools/prepare_sprite.py raw.png out.png --grid 4x2 --size 16 --colors 16
Prints a JSON summary. Needs Pillow + numpy.
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image


def load_palette(path):
    cols = []
    for line in open(path, encoding="utf-8"):
        h = line.strip().lstrip("#")
        if len(h) == 6 and all(c in "0123456789abcdefABCDEF" for c in h):
            cols.append([int(h[i:i + 2], 16) for i in (0, 2, 4)])
    if not cols:
        sys.exit(f"no RRGGBB colors found in {path}")
    return np.array(cols, dtype=np.int32)


def key_background(img, key, tol):
    a = np.array(img.convert("RGBA"), dtype=np.int32)
    dist = np.abs(a[..., :3] - np.array(key)).sum(axis=2)
    a[..., 3] = np.where((dist <= tol) | (a[..., 3] < 128), 0, 255)
    return a.astype(np.uint8)


def column_runs(alpha, min_gap):
    """Return [(x0, x1)] spans of occupied columns, merging gaps narrower than min_gap."""
    occ = alpha.max(axis=0) > 0
    runs, start, gap = [], None, 0
    for x, o in enumerate(occ):
        if o:
            if start is None:
                start = x
            gap, end = 0, x
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                runs.append((start, end + 1))
                start = None
    if start is not None:
        runs.append((start, end + 1))
    return runs


def bbox(a):
    ys, xs = np.nonzero(a[..., 3])
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None


def shrink(rgba, w, h):
    # Pillow premultiplies alpha for RGBA resizes, so edges don't pick up the keyed color.
    out = np.array(Image.fromarray(rgba, "RGBA").resize((max(w, 1), max(h, 1)), Image.BOX))
    out[..., 3] = np.where(out[..., 3] >= 128, 255, 0)
    return out


def reduce_colors(sheet, palette, colors):
    opaque = sheet[..., 3] > 0
    px = sheet[..., :3][opaque].astype(np.int32)
    if len(px) == 0:
        return sheet
    if palette is not None:
        idx = ((px[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
        px = palette[idx]
    else:
        strip = Image.fromarray(px.astype(np.uint8).reshape(1, -1, 3), "RGB")
        px = np.array(strip.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
                      .convert("RGB")).reshape(-1, 3)
    sheet[..., :3][opaque] = px
    return sheet


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--size", type=int, default=32, help="cell size in px (32 characters, 16 tiles/items)")
    p.add_argument("--frames", type=int, default=1, help="sprite mode: expected frame count")
    p.add_argument("--grid", help="grid mode: COLSxROWS, e.g. 4x2")
    p.add_argument("--pad", type=int, default=1, help="sprite mode: empty px kept around the tallest/widest frame")
    p.add_argument("--align", choices=["bottom", "keep"], default="bottom",
                   help="sprite mode: 'bottom' = feet on one ground line (walk/idle/attack); "
                        "'keep' = keep vertical motion from the raw image (jump/bob/fall)")
    p.add_argument("--height", type=int, help="sprite mode: scale so frame --ref-frame is this many px tall "
                                                  "(use one value for every animation of a character)")
    p.add_argument("--ref-frame", type=int, default=0, help="0-based frame of standing height for --height")
    p.add_argument("--palette", help=".hex file (one RRGGBB per line); overrides --colors")
    p.add_argument("--colors", type=int, default=16)
    p.add_argument("--key", default="FF00FF", help="background color to remove; 'none' to keep")
    p.add_argument("--tol", type=int, default=90, help="key color tolerance (sum of RGB diffs)")
    a = p.parse_args(argv)

    img = Image.open(a.src)
    key = None if a.key.lower() == "none" else [int(a.key[i:i + 2], 16) for i in (0, 2, 4)]
    rgba = key_background(img, key, a.tol) if key else np.array(img.convert("RGBA"))
    palette = load_palette(a.palette) if a.palette else None
    info = {"src": a.src, "dst": a.dst, "size": a.size}

    if a.grid:
        cols, rows = (int(v) for v in a.grid.lower().split("x"))
        H, W = rgba.shape[:2]
        sheet = np.zeros((rows * a.size, cols * a.size, 4), np.uint8)
        for r in range(rows):
            for c in range(cols):
                cell = rgba[r * H // rows:(r + 1) * H // rows, c * W // cols:(c + 1) * W // cols]
                sheet[r * a.size:(r + 1) * a.size, c * a.size:(c + 1) * a.size] = shrink(cell, a.size, a.size)
        info.update(mode="grid", cells=cols * rows)
    else:
        runs = column_runs(rgba[..., 3], min_gap=max(2, rgba.shape[1] // 200))
        if len(runs) == a.frames:
            method = "gaps"
        else:  # frames touch or stray specks: fall back to equal-width cells
            W = rgba.shape[1]
            runs, method = [(i * W // a.frames, (i + 1) * W // a.frames) for i in range(a.frames)], "equal-split"
        boxes = []
        for x0, x1 in runs:
            b = bbox(rgba[:, x0:x1])
            if b is None:
                sys.exit(f"frame at columns {x0}-{x1} is empty; check --key/--tol")
            boxes.append(b)
        if a.align == "keep":  # same vertical window for all frames, so bottom-aligning preserves height offsets
            top, bottom = min(b[1] for b in boxes), max(b[3] for b in boxes)
            boxes = [(b[0], top, b[2], bottom) for b in boxes]
        crops = [rgba[b[1]:b[3], x0 + b[0]:x0 + b[2]] for (x0, _), b in zip(runs, boxes)]
        biggest = max(max(c.shape[0], c.shape[1]) for c in crops)
        scale = (a.size - 2 * a.pad) / biggest  # one factor for all frames keeps the character the same size
        if a.height:  # same character size across animations: frame ref_frame becomes `height` px tall
            scale = a.height / crops[a.ref_frame].shape[0]
            if biggest * scale > a.size - a.pad:
                sys.exit(f"--height {a.height} makes the largest frame {biggest * scale:.1f}px; doesn't fit {a.size}px")
        sheet = np.zeros((a.size, a.size * len(crops), 4), np.uint8)
        for i, c in enumerate(crops):
            s = shrink(c, round(c.shape[1] * scale), round(c.shape[0] * scale))
            h, w = s.shape[:2]
            x = i * a.size + (a.size - w) // 2
            y = a.size - a.pad - h  # bottom-aligned: feet stay on the same ground line
            sheet[y:y + h, x:x + w] = s
        info.update(mode="sprite", frames=len(crops), split=method, align=a.align, scale=round(scale, 4))

    sheet = reduce_colors(sheet, palette, a.colors)
    Image.fromarray(sheet, "RGBA").save(a.dst)
    info["colors_used"] = int(len(np.unique(sheet[..., :3][sheet[..., 3] > 0], axis=0)))
    print(json.dumps(info))
    return info


if __name__ == "__main__":
    main()
