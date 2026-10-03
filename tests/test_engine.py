"""Run:  python -m pytest tests   (or: python tests/test_engine.py)

Hand-built candles where the right answer is known in advance.
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engine.data import fix_forex_daily, last_closed_index  # noqa: E402
from engine.patterns import detect_patterns  # noqa: E402
from engine.study import _status  # noqa: E402


def frame(rows):
    """rows: list of (open, high, low, close). Prepends a 20-candle base."""
    base = []
    p = 100.0
    for _ in range(20):
        base.append((p, p + 1.0, p - 1.0, p + 0.3))
        p += 0.3
    allrows = base + rows
    idx = pd.date_range("2024-01-01", periods=len(allrows), freq="D", tz="UTC")
    df = pd.DataFrame(allrows, columns=["Open", "High", "Low", "Close"], index=idx)
    df["Volume"] = 1000
    return df


def falling(start, n=6, step=1.0):
    rows, p = [], start
    for _ in range(n):
        rows.append((p, p + 0.3, p - step - 0.3, p - step))
        p -= step
    return rows, p


def rising(start, n=6, step=1.0):
    rows, p = [], start
    for _ in range(n):
        rows.append((p, p + step + 0.3, p - 0.3, p + step))
        p += step
    return rows, p


def last_hits(df):
    pats = detect_patterns(df)
    return {k for k, v in pats.iloc[-1].items() if v}


def test_hammer_after_fall():
    rows, p = falling(106)
    rows.append((p, p + 0.05, p - 3.0, p + 0.4))      # long lower wick, small body near top
    assert "hammer" in last_hits(frame(rows))


def test_hammer_shape_after_rise_is_hanging_man():
    rows, p = rising(106)
    rows.append((p, p + 0.05, p - 3.0, p + 0.4))
    hits = last_hits(frame(rows))
    assert "hanging_man" in hits and "hammer" not in hits


def test_shooting_star_after_rise():
    rows, p = rising(106)
    rows.append((p, p + 3.0, p - 0.05, p - 0.4))
    assert "shooting_star" in last_hits(frame(rows))


def test_bullish_engulfing():
    rows, p = falling(106)
    rows.append((p, p + 0.2, p - 1.2, p - 1.0))        # red
    rows.append((p - 1.1, p + 0.6, p - 1.2, p + 0.4))  # green, swallows it
    assert "bull_engulf" in last_hits(frame(rows))


def test_bearish_engulfing():
    rows, p = rising(106)
    rows.append((p, p + 1.2, p - 0.2, p + 1.0))
    rows.append((p + 1.1, p + 1.2, p - 0.6, p - 0.4))
    assert "bear_engulf" in last_hits(frame(rows))


def test_morning_star():
    rows, p = falling(110, n=8)
    rows.append((p, p + 0.1, p - 2.6, p - 2.5))        # big red
    q = p - 2.6
    rows.append((q, q + 0.3, q - 0.3, q + 0.1))        # small star
    rows.append((q + 0.1, q + 2.4, q, q + 2.3))        # strong green, above midpoint of red
    assert "morning_star" in last_hits(frame(rows))


def test_three_white_soldiers():
    rows, p = falling(110, n=3)
    for _ in range(3):
        rows.append((p, p + 1.55, p - 0.05, p + 1.5))
        p += 1.2                                       # next opens inside previous body
    assert "three_soldiers" in last_hits(frame(rows))


def test_plain_candle_has_no_pattern():
    rows, p = rising(106, n=3, step=0.3)
    rows.append((p, p + 1.0, p - 1.0, p + 0.3))
    assert last_hits(frame(rows)) == set()


def test_doji():
    rows, p = rising(106, n=3, step=0.3)
    rows.append((p, p + 1.2, p - 1.2, p + 0.02))
    assert "doji" in last_hits(frame(rows))


def test_forex_daily_fix_uses_next_open():
    idx = pd.date_range("2024-01-01", periods=3, freq="D", tz="UTC")
    d = pd.DataFrame({"Open": [1.10, 1.12, 1.11], "High": [1.13, 1.13, 1.12],
                      "Low": [1.09, 1.10, 1.10], "Close": [1.1001, 1.1201, 1.1101],
                      "Volume": 0}, index=idx)
    f = fix_forex_daily(d)
    assert np.isclose(f.Close.iloc[0], 1.12) and np.isclose(f.Close.iloc[1], 1.11)


def test_last_closed_index():
    idx = pd.date_range("2024-01-01", periods=3, freq="D", tz="UTC")
    d = pd.DataFrame({"Open": 1, "High": 1, "Low": 1, "Close": 1, "Volume": 0}, index=idx)
    during = pd.Timestamp("2024-01-03 12:00", tz="UTC").to_pydatetime()
    after = pd.Timestamp("2024-01-04 00:01", tz="UTC").to_pydatetime()
    assert last_closed_index(d, "1d", during) == 1
    assert last_closed_index(d, "1d", after) == 2


def test_status_walk():
    closes = np.array([10, 10, 10.5, 11.2, 11.0])     # setup at 1, trigger 11, invalid 9.5
    assert _status(closes, 1, 4, 11, 9.5, True) == "confirmed"
    assert _status(closes, 1, 2, 11, 9.5, True) == "waiting"
    assert _status(np.array([10, 10, 9.4, 12]), 1, 3, 11, 9.5, True) == "cancelled"
    assert _status(np.array([10, 10, 11.5, 9.0]), 1, 3, 11, 9.5, True) == "failed"


if __name__ == "__main__":
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            try:
                fn()
                print("PASS", name)
            except AssertionError:
                fails += 1
                print("FAIL", name)
    sys.exit(1 if fails else 0)
