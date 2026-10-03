"""0-100 bullish / bearish setup score.

Each rule is a plain yes/no check worth some points. The score is the share of
points earned, so every number on the website can be explained rule by rule.
"""
import numpy as np
import pandas as pd

from .indicators import has_volume

# (key, points, plain-English reason). Bear rules mirror the bull rules.
BULL_RULES = [
    ("above50", 15, "Price is above its 50-candle average (uptrend)"),
    ("golden", 10, "50 average is above the 200 average (long-term uptrend)"),
    ("slope", 5, "50 average is rising"),
    ("rsi_zone", 10, "RSI 50-70: strong momentum, not yet overbought"),
    ("rsi_turn", 10, "RSI recovered from oversold in the last 10 candles"),
    ("macd_pos", 10, "MACD above its signal line (momentum up)"),
    ("macd_cross", 10, "MACD crossed up in the last 5 candles (fresh momentum)"),
    ("vol_surge", 10, "Big volume (1.5x normal) on an up candle recently"),
    ("breakout", 10, "Made a new 20-candle high (breakout)"),
]
BEAR_RULES = [
    ("above50", 15, "Price is below its 50-candle average (downtrend)"),
    ("golden", 10, "50 average is below the 200 average (long-term downtrend)"),
    ("slope", 5, "50 average is falling"),
    ("rsi_zone", 10, "RSI 30-50: weak momentum, not yet oversold"),
    ("rsi_turn", 10, "RSI dropped back from overbought in the last 10 candles"),
    ("macd_pos", 10, "MACD below its signal line (momentum down)"),
    ("macd_cross", 10, "MACD crossed down in the last 5 candles (fresh selling)"),
    ("vol_surge", 10, "Big volume (1.5x normal) on a down candle recently"),
    ("breakout", 10, "Made a new 20-candle low (breakdown)"),
]
PENALTY = {"bull": "RSI above 78: overbought, pullback risk",
           "bear": "RSI below 22: oversold, bounce risk"}


def setup_scores(df, ind):
    """Return (bull_score, bear_score, bull_parts, bear_parts, has_volume)."""
    c, r = df.Close, ind.rsi
    vol = has_volume(df)
    up_bar, dn_bar = c > c.shift(), c < c.shift()
    cross_up = (ind.macd > ind.macd_sig) & (ind.macd.shift() <= ind.macd_sig.shift())
    cross_dn = (ind.macd < ind.macd_sig) & (ind.macd.shift() >= ind.macd_sig.shift())
    surge = ind.vol_ratio >= 1.5

    def recent(s, n):
        return s.astype(float).rolling(n).max() > 0

    bull = pd.DataFrame({
        "above50": c > ind.sma50,
        "golden": ind.sma50 > ind.sma200,
        "slope": ind.sma50 > ind.sma50.shift(10),
        "rsi_zone": (r >= 50) & (r <= 70),
        "rsi_turn": (r.rolling(10).min() < 35) & (r > 40),
        "macd_pos": ind.macd > ind.macd_sig,
        "macd_cross": recent(cross_up, 5),
        "vol_surge": recent(surge & up_bar, 3),
        "breakout": recent(c >= c.rolling(20).max(), 3),
    })
    bear = pd.DataFrame({
        "above50": c < ind.sma50,
        "golden": ind.sma50 < ind.sma200,
        "slope": ind.sma50 < ind.sma50.shift(10),
        "rsi_zone": (r >= 30) & (r < 50),
        "rsi_turn": (r.rolling(10).max() > 65) & (r < 60),
        "macd_pos": ind.macd < ind.macd_sig,
        "macd_cross": recent(cross_dn, 5),
        "vol_surge": recent(surge & dn_bar, 3),
        "breakout": recent(c <= c.rolling(20).min(), 3),
    })
    if not vol:
        bull["vol_surge"] = False
        bear["vol_surge"] = False

    def score(parts, rules, penalty):
        pts = sum(parts[k].fillna(False).astype(float) * p for k, p, _ in rules)
        mx = sum(p for k, p, _ in rules if vol or k != "vol_surge")
        return ((pts - penalty * 10).clip(lower=0) / mx * 100).round(0)

    bs = score(bull, BULL_RULES, (r > 78).astype(float))
    ss = score(bear, BEAR_RULES, (r < 22).astype(float))
    # meaningless until the 200 average exists
    bs[ind.sma200.isna()] = np.nan
    ss[ind.sma200.isna()] = np.nan
    return bs, ss, bull, bear, vol


def explain_parts(parts, rules, vol, rsi_now, side, i=-1):
    rows = []
    for k, p, text in rules:
        if k == "vol_surge" and not vol:
            continue
        rows.append({"ok": bool(parts[k].iloc[i]), "pts": p, "text": text})
    if side == "bull" and rsi_now > 78:
        rows.append({"ok": False, "pts": -10, "text": PENALTY["bull"], "penalty": True})
    if side == "bear" and rsi_now < 22:
        rows.append({"ok": False, "pts": -10, "text": PENALTY["bear"], "penalty": True})
    return rows
