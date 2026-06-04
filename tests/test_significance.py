import math
from btc_oracle.significance import diebold_mariano


def test_dm_detects_a_real_edge_as_significant():
    n = 30
    a = [0.10 + 0.02 * math.sin(i) for i in range(n)]   # model loss ~0.10 (with variance)
    b = [0.25 + 0.02 * math.cos(i) for i in range(n)]   # benchmark loss ~0.25
    r = diebold_mariano(a, b)
    assert r is not None
    assert r["favors"] == "model" and r["mean_diff"] < 0
    assert r["significant"] and r["p_value"] < 0.05


def test_dm_not_significant_when_no_edge():
    # losses vary but the differential has zero mean -> dm ~ 0, p ~ 1
    a = [0.20, 0.22, 0.18, 0.21, 0.19, 0.20] * 6
    b = [0.20] * 36
    r = diebold_mariano(a, b)
    assert r is not None
    assert not r["significant"] and r["p_value"] > 0.05


def test_dm_none_for_tiny_sample():
    assert diebold_mariano([0.1, 0.2, 0.1], [0.2, 0.2, 0.2]) is None
