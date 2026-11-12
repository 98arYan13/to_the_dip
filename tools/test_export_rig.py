"""Self-check for export_rig.py: python tools/test_export_rig.py"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import export_rig as e  # noqa: E402
from prepare_sprite import load_palette  # noqa: E402

rig = json.load(open(e.RIG))
pal = {tuple(int(v) for v in c) for c in load_palette(e.PALETTE)}


def test_rest_world():
    w = e.rest_world(rig)
    assert w["hips"] == (48, 60, 90) and w["torso"][2] == 270 and w["armF_upper"][2] == 90 and w["footF"][2] == 0
    try:
        e.rest_world({"bones": [{"name": "a", "parent": None, "x": 0, "y": 0, "rest": 45}]})
        assert False
    except ValueError:
        pass


def test_round_trip():
    for ang in (0, 90, 180, 270):
        layer = np.zeros((96, 96, 4), np.uint8)
        layer[58:63, 50:53] = (10, 20, 30, 255)
        layer[58, 50] = (200, 0, 0, 255)
        spr, (px, py) = e.part_from_layer(layer, (48, 60), ang)
        out = np.zeros_like(layer)
        c, s = e._COS[ang], e._SIN[ang]
        for v, u in zip(*np.nonzero(spr[..., 3])):
            lx, ly = u + 0.5 - px, v + 0.5 - py
            X, Y = int(np.floor(48 + lx * c - ly * s)), int(np.floor(60 + lx * s + ly * c))
            out[Y, X] = spr[v, u]
        assert (out == layer).all(), ang


def test_empty_and_palette():
    assert e.part_from_layer(np.zeros((96, 96, 4), np.uint8), (48, 60), 0) is None
    a = np.zeros((96, 96, 4), np.uint8)
    a[0, 0] = (1, 2, 3, 255)
    assert e.off_palette(a, pal) == [(1, 2, 3)]
    a[0, 0] = (*next(iter(pal)), 255)
    assert e.off_palette(a, pal) == []


def test_guide_size():
    g = e.guide(rig)
    assert g.size == (96, 96) and g.getpixel((48, 60))[3] == 255


for t in (test_rest_world, test_round_trip, test_empty_and_palette, test_guide_size):
    t()
print("OK")
