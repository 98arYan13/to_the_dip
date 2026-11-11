"""Self-check for prepare_sprite.py: python tools/test_prepare_sprite.py"""
import os
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import prepare_sprite  # noqa: E402

MAGENTA = (255, 0, 255)


def fake_ai_strip(path):
    """3 'frames' of an 8x-upscaled 12x16 figure on magenta, with soft edges like AI output."""
    img = Image.new("RGB", (3 * 200, 200), MAGENTA)
    for i, dy in enumerate((0, -8, 0)):  # middle frame bobs up
        fig = Image.new("RGB", (12, 16), (40, 30, 20))
        fig.paste((230, 190, 60), (2, 1, 10, 6))   # helmet
        fig.paste((60, 90, 200), (2, 6, 10, 15))   # body
        big = fig.resize((96, 128), Image.NEAREST).resize((97, 129), Image.BILINEAR)  # off-grid blur
        img.paste(big, (i * 200 + 50, 60 + dy))
    img.save(path)


with tempfile.TemporaryDirectory() as d:
    raw, out = os.path.join(d, "raw.png"), os.path.join(d, "out.png")
    fake_ai_strip(raw)

    info = prepare_sprite.main([raw, out, "--frames", "3", "--size", "32", "--colors", "8"])
    sheet = np.array(Image.open(out))
    assert sheet.shape == (32, 96, 4), sheet.shape
    assert info["split"] == "gaps" and info["frames"] == 3, info
    assert info["colors_used"] <= 8, info
    assert set(np.unique(sheet[..., 3])) <= {0, 255}, "alpha must be hard"
    opaque = sheet[..., :3][sheet[..., 3] > 0]
    assert not ((opaque[:, 0] > 200) & (opaque[:, 1] < 60) & (opaque[:, 2] > 200)).any(), "magenta left over"
    assert sheet[0, :, 3].max() == 0 and sheet[:, 0, 3].max() == 0, "pad row/col should be empty"
    bottoms = [np.nonzero(sheet[:, i * 32:(i + 1) * 32, 3].max(axis=1))[0].max() for i in range(3)]
    assert len(set(bottoms)) == 1, f"frames not bottom-aligned: {bottoms}"

    prepare_sprite.main([raw, out, "--frames", "3", "--align", "keep"])
    sheet = np.array(Image.open(out))
    bottoms = [np.nonzero(sheet[:, i * 32:(i + 1) * 32, 3].max(axis=1))[0].max() for i in range(3)]
    assert bottoms[1] < bottoms[0] == bottoms[2], f"keep mode lost the hop: {bottoms}"

    pal = os.path.join(d, "p.hex")
    open(pal, "w").write("000000\nffd700\n3050c0\n")
    prepare_sprite.main([raw, out, "--frames", "3", "--palette", pal])
    used = {tuple(c) for c in np.array(Image.open(out))[..., :3][np.array(Image.open(out))[..., 3] > 0]}
    assert used <= {(0, 0, 0), (255, 215, 0), (48, 80, 192)}, used

    prepare_sprite.main([raw, out, "--grid", "3x1", "--size", "16", "--key", "none"])
    assert np.array(Image.open(out)).shape == (16, 48, 4)

print("ALL OK")
