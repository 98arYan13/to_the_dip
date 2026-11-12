import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from make_wear import _runs  # noqa: E402


def test_runs_bridges_small_gaps():
    m = np.zeros(40, bool)
    m[2:5] = m[7:10] = m[30:35] = True
    assert _runs(m, gap=8) == [(2, 10), (30, 35)]


if __name__ == "__main__":
    test_runs_bridges_small_gaps()
    print("ok")
