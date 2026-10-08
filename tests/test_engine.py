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
from engine import odds  # noqa: E402


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


def _hourly(n=6000, seed=1):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(end="2026-10-01", periods=n, freq="h", tz="UTC")
    c = 100 * np.exp(np.cumsum(rng.normal(0, 0.004, n)))
    o = np.r_[c[0], c[:-1]]
    hi, lo = np.maximum(o, c) * 1.002, np.minimum(o, c) * 0.998
    return pd.DataFrame({"Open": o, "High": hi, "Low": lo, "Close": c, "Volume": 0}, index=idx)


def test_look_index_covers_24_looks():
    seen = set()
    for a in (0, 1):
        for b in (0, 1):
            for r in (30, 50, 70):
                for m in (0, 1):
                    L = int(odds.look_index(a, b, r, m))
                    d = odds.describe(L)
                    assert d["above1h"] == bool(a) and d["above4h"] == bool(b) and d["macd_up"] == bool(m)
                    assert d["rsi"] == {30: "low", 50: "middle", 70: "high"}[r]
                    seen.add(L)
    assert seen == set(range(24))
    assert int(odds.look_index(1, 1, 40, 1)) == int(odds.look_index(1, 1, 60, 1))  # 40 and 60 are "middle"


def test_odds_counts_match_brute_force():
    """Recount one look by hand: spacing, 6-month window, up/down/flat and the stop distance."""
    df = _hourly()
    o = odds.odds(df)
    assert o and o["hz"] == [1, 4, 24] and o["st"]
    lk = odds.looks(df)
    start = df.index[-1] - pd.DateOffset(months=6)
    L = max(o["st"], key=lambda k: o["st"][k][0])
    c, lo = df.Close.values, df.Low.values
    ids, last = [], -10 ** 9
    for i in range(len(df)):
        if df.index[i] < start or lk[i] != int(L) or i + 24 >= len(df):
            continue
        if i - last >= odds.SPACING:
            ids.append(i)
            last = i
    n, h4 = o["st"][L][0], o["st"][L][2]
    assert n == len(ids), (n, len(ids))
    assert min(np.diff(ids)) >= odds.SPACING
    f = np.array([c[i + 4] / c[i] - 1 for i in ids])
    assert h4[0] == (f > 0).sum() and h4[1] == (f < 0).sum()
    dd = np.array([-(lo[i + 1:i + 5].min() / c[i] - 1) for i in ids])
    assert abs(h4[5] - np.quantile(dd, 0.8) * 100) < 1e-3, (h4[5], np.quantile(dd, 0.8) * 100)
    assert abs(h4[7] - dd.max() * 100) < 1e-3


def test_odds_today_look_and_rare_looks_hidden():
    df = _hourly()
    o = odds.odds(df)
    assert o["look"] == int(odds.looks(df)[-1])
    assert all(v[0] >= odds.MIN_N for v in o["st"].values())
    assert odds.odds(_hourly(300)) is None          # too little history


def test_stock_hours_give_shorter_day():
    df = _hourly()
    df = df[(df.index.hour >= 14) & (df.index.hour <= 20) & (df.index.dayofweek < 5)]  # 7 candles a day
    assert odds.candles_per_day(df) == 7


def test_4h_average_matches_tradingview_style():
    """During a 4H candle the average = 49 finished 4H closes + this hour's close, / 50."""
    df = _hourly(2000)
    s4 = odds._sma50_4h(df)
    i = 1500
    b = df.index[i].floor("4h")
    c4 = df.Close.resample("4h").last()
    prev = c4[c4.index < b].iloc[-49:]
    assert abs(s4[i] - (prev.sum() + df.Close.iloc[i]) / 50) < 1e-9


def test_daily_odds_match_brute_force():
    """odds_daily counts = a plain loop over every past day with today's look."""
    from engine.indicators import indicators
    rng = np.random.default_rng(7)
    n = 1500
    c = 100 * np.exp(np.cumsum(rng.normal(0.0003, 0.012, n)))
    idx = pd.date_range("2019-01-01", periods=n, freq="B", tz="UTC")
    df = pd.DataFrame({"Open": c, "High": c * 1.01, "Low": c * 0.99, "Close": c, "Volume": 1000}, index=idx)
    o = odds.odds_daily(df)
    ind = indicators(df)
    lk = odds.look_daily(c > ind.sma50.values, c > ind.sma200.values, ind.rsi.values)
    lk[np.isnan(ind.sma200.values) | np.isnan(ind.rsi.values)] = -1
    assert o["L"] == lk[-1]
    ids, prev = [], -10 ** 9
    for i in range(n - 1):
        if lk[i] == o["L"] and i - prev >= odds.D_SPACING:
            ids.append(i)
            prev = i
    for k, h in enumerate(odds.D_HZ):
        sel = [i for i in ids if i + h < n]
        cell = o["c"][k]
        if len(sel) < odds.D_MIN_N:
            assert cell is None
            continue
        up = sum(c[i + h] > c[i] for i in sel)
        assert cell[0] == len(sel) and cell[1] == up, (h, cell[:3], len(sel), up)
        base_up = np.mean(c[h:] > c[:-h]) * 100
        assert abs(o["b"][k][0] - base_up) < 0.11


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
