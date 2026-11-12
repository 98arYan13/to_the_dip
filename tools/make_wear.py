"""Cut wearable pieces from paper-doll raw sheets into rig parts.

    python tools/make_wear.py            # writes web/public/rig/wear/<item>/<bone>.png + prints pivots, updates wearables.json
Each piece is fitted to the body part's own sprite box (+1 px each side), so it covers the body exactly.
Pieces are found by empty bands on the magenta sheet, in reading order (rows top->bottom, then left->right).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from prepare_sprite import load_palette  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RIG = os.path.join(ROOT, "web/public/rig")
PAL = np.array(load_palette(os.path.join(ROOT, "art_source/palette/player_base_hd.hex")), float)

# Sheet blob order: shirt, sleeve, sleeve2, glove, hips, leg, leg2, boot.
SETS = {
    "miner": ("wear_miner_raw.png", True, "Work"),
    "heat": ("wear_heatsuit_raw.png", False, "Heat suit"),
    "armor": ("wear_armor_raw.png", False, "Hardsuit"),
}
# (id, name, tint, share of the head it covers from the top)
HELMETS = [("helmet", "Hard hat", True, 0.5), ("helmet_space", "Space helmet", False, 1.1),
           ("helmet_hard", "Hardsuit helmet", False, 1.1), ("helmet_diver", "Diving helmet", False, 1.1)]
GROW = 1  # px of clothing beyond the body sprite on every side


def blobs(path):
    a = np.array(Image.open(path).convert("RGBA")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fg = ~((r > 200) & (b > 200) & (g < 90))  # key near-magenta with tolerance
    a[..., 3] = np.where(fg, 255, 0)
    out = []
    for y0, y1 in _runs(fg.sum(1) > 3):  # rows of pieces, split by empty bands
        band = fg[y0:y1]
        for x0, x1 in _runs(band.sum(0) > 3):
            ys = np.nonzero(band[:, x0:x1].any(1))[0]
            out.append((slice(y0 + ys[0], y0 + ys[-1] + 1), slice(x0, x1)))
    order = [s for s in out if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > 4000]
    return [Image.fromarray(a[s].astype(np.uint8)) for s in order]


def _runs(m, gap=8):
    """[start, stop) runs of True, bridging gaps shorter than `gap`."""
    idx = np.nonzero(m)[0]
    runs, s0 = [], idx[0]
    for a, b in zip(idx, idx[1:]):
        if b - a > gap:
            runs.append((s0, a + 1)); s0 = b
    runs.append((s0, idx[-1] + 1))
    return runs


def to_palette(img, dark=0.0):
    a = np.array(img).astype(float)
    rgb = a[..., :3] * (1 - dark)
    d = ((rgb[..., None, :] - PAL[None, None]) ** 2).sum(-1)
    a[..., :3] = PAL[d.argmin(-1)]
    a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    return Image.fromarray(a.astype(np.uint8))


def body(bone):
    p = json.load(open(os.path.join(RIG, "parts.json")))[bone]
    w, h = Image.open(os.path.join(RIG, p["sprite"])).size
    return w, h, p["pivot"]


def fit(piece, bone, orient, dark=0.0):
    """piece -> bone-local sprite (x along bone) sized to the body part. orient: how the raw piece points."""
    piece = {"down": piece.transpose(Image.Transpose.ROTATE_90),  # top of raw = bone start
             "up": piece.transpose(Image.Transpose.ROTATE_270),   # bottom of raw = bone start
             "right": piece}[orient]
    w, h, (px, py) = body(bone)
    out = to_palette(piece.resize((w + 2 * GROW, h + 2 * GROW), Image.Resampling.BOX), dark)
    return out, [px + GROW, py + GROW]


def cut(img, frac, keep):
    """Split a vertical limb at frac of its height; keep 'top' or 'bottom'."""
    w, h = img.size
    y = round(h * frac)
    return img.crop((0, 0, w, y)) if keep == "top" else img.crop((0, y, w, h))


def save(item, bone, res, tint):
    d = os.path.join(RIG, "wear", item)
    os.makedirs(d, exist_ok=True)
    res[0].save(os.path.join(d, bone + ".png"))
    return {"sprite": f"wear/{item}/{bone}.png", "pivot": res[1], "tint": tint}


def main():
    items = []
    for key, (raw, tint, name) in SETS.items():
        shirt, sleeve, _, glove, hips, leg, leg2, boot = blobs(os.path.join(ROOT, "art_source/raw", raw))
        arm_split, leg_split = 13 / 25, 16 / 32
        sid = lambda k: f"{k}_basic" if key == "miner" else f"{k}_{key}"  # noqa: E731  miner keeps the old ids
        sh, pa, bo, gl = {}, {}, {}, {}
        sh["torso"] = save(sid("shirt"), "torso", fit(shirt, "torso", "up"), tint)
        for side, dk in (("F", 0.0), ("B", 0.28)):
            sh[f"arm{side}_upper"] = save(sid("shirt"), f"arm{side}_upper", fit(cut(sleeve, arm_split, "top"), f"arm{side}_upper", "down", dk), tint)
            sh[f"arm{side}_lower"] = save(sid("shirt"), f"arm{side}_lower", fit(cut(sleeve, arm_split, "bottom"), f"arm{side}_lower", "down", dk), tint)
            lg = leg if side == "F" else leg2
            pa[f"leg{side}_thigh"] = save(sid("pants"), f"leg{side}_thigh", fit(cut(lg, leg_split, "top"), f"leg{side}_thigh", "down", dk), tint)
            pa[f"leg{side}_shin"] = save(sid("pants"), f"leg{side}_shin", fit(cut(lg, leg_split, "bottom"), f"leg{side}_shin", "down", dk), tint)
            gl[f"hand{side}"] = save(sid("gloves"), f"hand{side}", fit(glove, f"hand{side}", "down", dk), tint)
            bo[f"foot{side}"] = save(sid("boots"), f"foot{side}", fit(boot, f"foot{side}", "right", dk), tint and key != "miner")
        pa["hips"] = save(sid("pants"), "hips", fit(hips, "hips", "down"), tint)
        items += [{"id": sid("shirt"), "kind": "shirt", "name": f"{name} shirt", "parts": sh},
                  {"id": sid("pants"), "kind": "pants", "name": f"{name} pants", "parts": pa},
                  {"id": sid("boots"), "kind": "boots", "name": f"{name} boots", "parts": bo},
                  {"id": sid("gloves"), "kind": "gloves", "name": f"{name} gloves", "parts": gl}]
    for (hid, name, tint, cover), img in zip(HELMETS, blobs(os.path.join(ROOT, "art_source/raw/helmets_raw.png"))):
        w, h, (px, py) = body("head")
        hl, hw = round(w * cover) + 2, h + 4
        sp = to_palette(img.transpose(Image.Transpose.ROTATE_270).resize((hl, hw), Image.Resampling.BOX))
        res = (sp, [px - w + hl - 1, py + 2])  # top edge 1 px above the head
        items.insert(0, {"id": hid, "kind": "hat", "name": name, "parts": {"head": save(hid, "head", res, tint)}})
    json.dump({"items": items}, open(os.path.join(RIG, "wearables.json"), "w"), indent=1)
    print(f"{len(items)} items")


if __name__ == "__main__":
    main()
