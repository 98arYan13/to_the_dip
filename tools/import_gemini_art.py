"""Turn the Gemini sheets in art_source/raw/ into web game sprites.

    python tools/import_gemini_art.py
tiles_{a,b,c}_raw.png, ores_raw.png : 2 rows x 4 tiles on dark bg -> web/public/tiles/gen_<sheet>_<n>.png (32x32)
items_raw.png                       : 3 rows x 7 icons on magenta -> web/public/icons/mat_<n>.png (16x16)
fx_particles_raw.png                : 3 rows x 6 on magenta (dust anim, sparks, chips) -> web/public/fx/particles.png
"""
import os
import numpy as np
from PIL import Image

RAW, PUB = 'art_source/raw', 'web/public'


def runs(mask, min_len):
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    return out


def boxes(fg, min_len, frac_c, frac_r):
    """Rows of objects first (horizontal bands), then columns inside each band."""
    out = []
    for r0, r1 in runs(fg.mean(axis=1) > frac_r, min_len):
        band = fg[r0:r1]
        for c0, c1 in runs(band.mean(axis=0) > frac_c, min_len):
            ys = np.where(band[:, c0:c1].any(axis=1))[0]
            out.append((c0, r0 + ys[0], c1, r0 + ys[-1] + 1))
    return out


def tiles(name):
    img = Image.open(f'{RAW}/{name}_raw.png').convert('RGB')
    a = np.asarray(img).astype(int)
    bg = np.median(np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3)]), axis=0)
    diff = np.abs(a - bg).sum(axis=2)
    bands = runs((diff > 40).mean(axis=1) > 0.3, 150)
    assert len(bands) == 2, (name, bands)
    W, bx = a.shape[1], []
    for r0, r1 in bands:  # 4 tiles per row, one per quarter; dark tiles need a low threshold
        for q in range(4):
            x0 = q * W // 4
            cs = runs((diff[r0:r1, x0:x0 + W // 4] > 12).mean(axis=0) > 0.5, 150)
            c0, c1 = max(cs, key=lambda c: c[1] - c[0])
            bx.append((x0 + c0, r0, x0 + c1, r1))
    for n, (c0, r0, c1, r1) in enumerate(bx):
        ins = int((r1 - r0) * 0.02)
        t = img.crop((c0 + ins, r0 + ins, c1 - ins, r1 - ins)).resize((32, 32), Image.BOX)
        t = t.quantize(14, method=Image.Quantize.MEDIANCUT).convert('RGB')
        t.save(f'{PUB}/tiles/gen_{name}_{n}.png')
    print(name, len(bx))


def magenta_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ~((r > 150) & (b > 150) & (g < 110))


def cut(img, fg, box):
    c0, r0, c1, r1 = box
    sub, m = img.crop(box), fg[r0:r1, c0:c1]
    ys, xs = np.where(m)
    bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    sub = np.asarray(sub.convert('RGBA')).copy()
    sub[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(sub).crop(bb)


def fit(sprite, scale, cell):
    w, h = max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))
    s = sprite.resize((w, h), Image.BOX)
    a = np.asarray(s).copy()
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    s = Image.fromarray(a)
    out = Image.new('RGBA', (cell, cell))
    out.paste(s, ((cell - w) // 2, (cell - h) // 2), s)
    return out


def sprite_rows(name, cols):
    img = Image.open(f'{RAW}/{name}_raw.png').convert('RGB')
    fg = magenta_mask(np.asarray(img).astype(int))
    rows = []
    for r0, r1 in runs(fg.mean(axis=1) > 0.002, 20):
        cs = runs(fg[r0:r1].any(axis=0), 4)
        # merge pieces closer than a gap so wisps/fragments stay with their sprite
        merged = []
        for c in cs:
            if merged and c[0] - merged[-1][1] < 40:
                merged[-1] = (merged[-1][0], c[1])
            else:
                merged.append(c)
        assert len(merged) == cols, (name, len(merged), merged)
        rows.append([cut(img, fg, (c0, r0, c1, r1)) for c0, c1 in merged])
    return img, rows


def items():
    _, rows = sprite_rows('items', 7)
    assert len(rows) == 3
    sprites = [s for r in rows for s in r]
    big = max(max(s.size) for s in sprites)
    for n, s in enumerate(sprites):
        fit(s, 16 / big, 16).save(f'{PUB}/icons/mat_{n}.png')
    print('items', len(sprites))


def fx():
    _, rows = sprite_rows('fx_particles', 6)
    assert len(rows) == 3
    sheet = Image.new('RGBA', (16 * 6, 16 * 3))
    for r, (row, size) in enumerate(zip(rows, (16, 10, 8))):
        big = max(max(s.size) for s in row)
        for c, s in enumerate(row):
            sheet.paste(fit(s, size / big, 16), (c * 16, r * 16))
    os.makedirs(f'{PUB}/fx', exist_ok=True)
    sheet.save(f'{PUB}/fx/particles.png')
    print('fx ok')


if __name__ == '__main__':
    for t in ('tiles_a', 'tiles_b', 'tiles_c', 'ores'):
        tiles(t)
    items()
    fx()
