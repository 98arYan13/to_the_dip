"""Export rig body parts from an Aseprite file (one layer per bone, drawn in the rest pose).

    python tools/export_rig.py guide out.png
    python tools/export_rig.py export art_source/characters/player_rig.aseprite [--aseprite exe]
Writes web/public/rig/parts/<bone>.png + parts.json. Needs Pillow + numpy.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from prepare_sprite import load_palette  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RIG = os.path.join(ROOT, "web/public/rig/rig.json")
PALETTE = os.path.join(ROOT, "art_source/palette/player_base_hd.hex")
OUT = os.path.join(ROOT, "web/public/rig/parts")
ASEPRITE = "D:/tools/aseprite/build/bin/aseprite.exe"
_COS, _SIN = {0: 1, 90: 0, 180: -1, 270: 0}, {0: 0, 90: 1, 180: 0, 270: -1}


def rest_world(rig):
    """bone -> (x, y, angle) at rest; mirrors solveWorld with a zero pose."""
    w = {}
    for b in rig["bones"]:
        if b["rest"] % 90:
            raise ValueError(f"{b['name']}: rest {b['rest']} is not a multiple of 90")
        if b["parent"] is None:
            w[b["name"]] = (b["x"], b["y"], b["rest"] % 360)
            continue
        px, py, pa = w[b["parent"]]
        c, s = _COS[pa], _SIN[pa]
        w[b["name"]] = (px + b["x"] * c - b["y"] * s, py + b["x"] * s + b["y"] * c, (pa + b["rest"]) % 360)
    return w


def _to_local(xs, ys, origin, angle):
    """Pixel-centre offsets from origin, rotated by -angle into the bone frame."""
    dx, dy = xs + 0.5 - origin[0], ys + 0.5 - origin[1]
    c, s = _COS[angle], _SIN[angle]
    return dx * c + dy * s, -dx * s + dy * c


def part_from_layer(rgba, origin, angle):
    ys, xs = np.nonzero(rgba[..., 3])
    if not len(xs):
        return None
    lx, ly = _to_local(xs, ys, origin, angle)
    i, j = np.round(lx - 0.5).astype(int), np.round(ly - 0.5).astype(int)
    i0, j0 = i.min(), j.min()
    out = np.zeros((j.max() - j0 + 1, i.max() - i0 + 1, 4), np.uint8)
    out[j - j0, i - i0] = rgba[ys, xs]
    return out, [int(-i0), int(-j0)]


def off_palette(rgba, palette):
    px = rgba[rgba[..., 3] > 0][:, :3]
    return sorted({tuple(int(v) for v in p) for p in px} - set(palette))


def guide(rig):
    img = np.zeros((rig["canvas"], rig["canvas"], 4), np.uint8)
    yy, xx = np.mgrid[0:rig["canvas"], 0:rig["canvas"]]
    w = rest_world(rig)
    for b in sorted(rig["bones"], key=lambda b: b["layer"]):
        lx, ly = _to_local(xx, yy, w[b["name"]][:2], w[b["name"]][2])
        m = (lx >= 0) & (lx < b["length"]) & (abs(ly) <= b["width"] / 2)
        img[m] = [*bytes.fromhex(b["color"][1:]), 255]
    return Image.fromarray(img)


def export(path, exe):
    rig = json.load(open(RIG))
    pal = {tuple(int(v) for v in c) for c in load_palette(PALETTE)}
    w = rest_world(rig)
    os.makedirs(OUT, exist_ok=True)
    parts, bad = {}, False
    with tempfile.TemporaryDirectory() as tmp:
        for b in rig["bones"]:
            n, png = b["name"], os.path.join(tmp, b["name"] + ".png")
            subprocess.run([exe, "-b", "--layer", n, path, "--save-as", png], check=False, capture_output=True)
            if not os.path.exists(png):
                continue
            rgba = np.array(Image.open(png).convert("RGBA"))
            for c in off_palette(rgba, pal):
                print(f"{n}: off-palette #{c[0]:02x}{c[1]:02x}{c[2]:02x}")
                bad = True
            res = part_from_layer(rgba, w[n][:2], w[n][2])
            if res:
                Image.fromarray(res[0]).save(os.path.join(OUT, n + ".png"))
                parts[n] = {"sprite": f"parts/{n}.png", "pivot": res[1]}
                print(f"{n}: {res[0].shape[1]}x{res[0].shape[0]} pivot {res[1]}")
    if bad:
        sys.exit(1)
    json.dump(parts, open(os.path.join(os.path.dirname(OUT), "parts.json"), "w"), indent=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["guide", "export"])
    ap.add_argument("path")
    ap.add_argument("--aseprite", default=ASEPRITE)
    a = ap.parse_args()
    if a.cmd == "guide":
        guide(json.load(open(RIG))).save(a.path)
    else:
        export(a.path, a.aseprite)
