"""'The last times it looked like this' - odds for the Good for buying / selling now tabs.

Every hour of the last 6 months is described by 4 plain facts (the "look"):
  1. 1H price above or below its 50-candle average
  2. 4H price above or below its 50-candle average
  3. 1H RSI low (<40), middle (40-60) or high (>60)
  4. 1H MACD above or below its signal line (momentum up / down)
That gives 2 x 2 x 3 x 2 = 24 possible looks. For each look we count what price did
1 hour, 4 hours and 1 trading day later, using only this instrument's own history.

The facts are chosen so the browser can work out TODAY's look live from TradingView's
screener (columns close, SMA50|60, SMA50|240, RSI|60, MACD.macd|60, MACD.signal|60),
the same way this file works it out from the past candles. site/app.js lookOf() mirrors
look_index() below - keep the two identical.

Counting rules (so the numbers are not inflated):
  - hours in the same look are only counted once every SPACING candles, so one long
    stretch of the same look does not count as 20 separate "times"
  - a look needs MIN_N past times before the site shows any odds for it
"""
import numpy as np
import pandas as pd

from .indicators import indicators

MONTHS = 6
SPACING = 4              # candles between two counted hours of the same look
MIN_N = 30               # fewer past times than this -> "not enough history"
STOP_Q = 0.8             # stop survives 8 of 10 past moves against the trade
RSI_EDGES = (40, 60)
LOOKS = 24


def look_index(above1h, above4h, rsi, macd_up):
    """Facts -> 0..23. Works on numbers or numpy arrays."""
    r = np.where(rsi < RSI_EDGES[0], 0, np.where(rsi > RSI_EDGES[1], 2, 1))
    return (np.asarray(above1h, int) * 12 + np.asarray(above4h, int) * 6 + r * 2 + np.asarray(macd_up, int))


def describe(look):
    """0..23 -> the 4 facts (for tests and the log)."""
    return {"above1h": bool(look // 12), "above4h": bool(look // 6 % 2),
            "rsi": ("low", "middle", "high")[look // 2 % 3], "macd_up": bool(look % 2)}


def _sma50_4h(h1):
    """4H 50-average as TradingView shows it during the hour: 49 finished 4H closes + this hour's close."""
    c4 = h1.Close.resample("4h", label="left", closed="left").last().dropna()
    prev49 = c4.rolling(49).sum().shift(1)          # sum of the 49 finished 4H candles before each one
    bucket = h1.index.floor("4h")
    return (prev49.reindex(bucket).values + h1.Close.values) / 50


def candles_per_day(h1):
    """Stocks have ~7 hourly candles a day, forex/crypto ~24. Used for the '1 day later' check."""
    days = pd.Index(h1.index.date).nunique()
    return int(max(4, min(24, round(len(h1) / max(days, 1)))))


def looks(h1):
    """Look (0..23, or -1 when an average does not exist yet) for every hourly candle."""
    ind = indicators(h1)
    s4 = _sma50_4h(h1)
    c = h1.Close.values
    lk = look_index(c > ind.sma50.values, c > s4, ind.rsi.values, ind.macd.values > ind.macd_sig.values)
    lk[np.isnan(ind.sma50.values) | np.isnan(s4)] = -1
    return lk


def _q(a, q):
    return round(float(np.quantile(a, q)) * 100, 3) if len(a) else None


def _med(a):
    return round(float(np.median(a)) * 100, 3) if len(a) else None


def odds(h1, months=MONTHS):
    """Hourly candles (UTC index, long history is fine) -> odds table for the website.

    Returns None when there is not enough data. Otherwise
      {"look": today's look, "dpd": candles per day, "hz": [1, 4, dpd], "n_hours": ...,
       "base": [[% of ALL hours that went up, % that went down] for 1h / 4h / 1d later],
       "st": {look: [n, [h1 stats], [h4 stats], [1d stats]]}}
    each horizon's stats = [up, down, avg, rise, fall, stop_buy, stop_sell, worst_buy, worst_sell]
      up / down : how many of the n times price was higher / lower at the end (the rest: unchanged,
                  common on forex where price moves in whole pips)
      avg  : average change % (positive = went up on average)
      rise : typical (median) rise % among the times it rose     fall: same for falls (negative)
      stop_buy  : % fall below entry that 8 of 10 past times never reached (lowest low in the window)
      stop_sell : % rise above entry that 8 of 10 past times never reached (highest high)
      worst_buy / worst_sell : the biggest move against a buy / sell in the window
    Only looks with at least MIN_N times are kept.
    """
    if h1 is None or len(h1) < 400:
        return None
    lk_all = looks(h1)
    start = h1.index[-1] - pd.DateOffset(months=months)
    keep = h1.index >= start
    dpd = candles_per_day(h1[keep])
    hz = [1, 4, dpd]
    c, hi, lo = h1.Close.values, h1.High.values, h1.Low.values
    n_all = len(h1)
    idx_all = np.flatnonzero(keep)

    # rolling max/min of the NEXT h candles (for stop-loss distances)
    def fwd_extreme(arr, h, fn):
        s = pd.Series(arr[::-1]).rolling(h, min_periods=h).agg(fn).values[::-1]  # s[i] = fn(arr[i..i+h-1])
        out = np.full(n_all, np.nan)
        out[:-1] = s[1:]                                                      # window i+1 .. i+h
        return out
    fwd = {h: np.r_[c[h:] / c[:-h] - 1, np.full(h, np.nan)] for h in hz}
    mx = {h: fwd_extreme(hi, h, "max") / c - 1 for h in hz}
    mn = {h: fwd_extreme(lo, h, "min") / c - 1 for h in hz}

    base = []
    for h in hz:
        f = fwd[h][idx_all]
        f = f[~np.isnan(f)]
        base.append([round(float((f > 0).mean()) * 100, 1), round(float((f < 0).mean()) * 100, 1)] if len(f) else None)

    # thin out: within each look keep an hour only SPACING candles after the last kept one
    last = {}
    picked = {}
    for i in idx_all:
        L = int(lk_all[i])
        if L < 0 or np.isnan(fwd[hz[-1]][i]):
            continue
        if i - last.get(L, -10 ** 9) >= SPACING:
            picked.setdefault(L, []).append(i)
            last[L] = i

    st = {}
    for L, ids in picked.items():
        ids = np.array(ids)
        if len(ids) < MIN_N:
            continue
        per = []
        for h in hz:
            f, up_mv, dn_mv = fwd[h][ids], mx[h][ids], mn[h][ids]
            per.append([int((f > 0).sum()), int((f < 0).sum()), round(float(f.mean()) * 100, 3),
                        _med(f[f > 0]), _med(f[f < 0]),
                        _q(-dn_mv, STOP_Q), _q(up_mv, STOP_Q),
                        round(float(-dn_mv.min()) * 100, 3), round(float(up_mv.max()) * 100, 3)])
        st[str(L)] = [len(ids)] + per

    return {"look": int(lk_all[-1]), "dpd": dpd, "hz": hz, "n_hours": int(keep.sum()),
            "base": base, "st": st}
