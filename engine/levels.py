"""Support / resistance from recent swing highs and lows.

A swing high is a candle whose high is the highest of the 5 candles either side.
Swings close together (within 0.6 ATR) are merged into one level; more touches
means a stronger level.
"""
import numpy as np


def key_levels(df, atr, lookback=180, k=5, max_each=3):
    d = df.iloc[-lookback:]
    h, l = d.High, d.Low
    win = 2 * k + 1
    sh = h[h == h.rolling(win, center=True).max()].dropna()
    sl = l[l == l.rolling(win, center=True).min()].dropna()
    pts = sorted([float(x) for x in sh.values] + [float(x) for x in sl.values])
    tol = 0.6 * atr
    clusters = []
    for x in pts:
        if clusters and x - clusters[-1][-1] <= tol:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    levels = [{"price": float(np.mean(cl)), "touches": len(cl)} for cl in clusters]
    price = float(df.Close.iloc[-1])
    sup = sorted([L for L in levels if L["price"] < price], key=lambda L: -L["price"])[:max_each]
    res = sorted([L for L in levels if L["price"] > price], key=lambda L: L["price"])[:max_each]
    return sup, res
