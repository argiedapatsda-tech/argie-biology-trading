"""Turn one instrument's candles into the numbers the website shows."""
import math

import numpy as np
import pandas as pd

from .backtest import backtest_score, pattern_outcomes, summarize_outcome
from .data import last_closed_index
from .indicators import indicators
from .levels import key_levels
from .patterns import PATTERNS, detect_patterns
from .score import BEAR_RULES, BULL_RULES, explain_parts, setup_scores
from .study import study_notes

# candles after a signal used to judge it, per timeframe
SCORE_HORIZON = {"15m": 8, "1h": 8, "4h": 6, "1d": 10, "1wk": 4}
PATTERN_HORIZON = 5
CHART_CANDLES = {"15m": 300, "1h": 400, "4h": 400, "1d": 400, "1wk": 260}
THRESHOLD = 70


def decimals(price):
    if not price or price <= 0 or math.isnan(price):
        return 2
    return int(min(8, max(2, 5 - math.floor(math.log10(price)))))


def _r(x, dp):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), dp)


# ---------------------------------------------------------------- long-term (investing) score

INVEST_RULES = [
    ("above200", 20, "Price is above its 200-day average (long-term uptrend)"),
    ("rising200", 15, "200-day average is rising"),
    ("ret6m", 15, "Higher than 6 months ago"),
    ("ret12m", 10, "Higher than 12 months ago"),
    ("near_high", 15, "Within 15% of its 52-week high"),
    ("golden", 10, "50-day average above the 200-day"),
    ("calm", 10, "Moves are not wild (yearly volatility under 45%)"),
    ("not_stretched", 5, "Not stretched far above its average (under +30%)"),
]


def invest_technical(df, ind):
    c = df.Close
    if len(c) < 260 or pd.isna(ind.sma200.iloc[-1]):
        return None
    last = float(c.iloc[-1])
    s200 = float(ind.sma200.iloc[-1])
    vol = float(np.log(c / c.shift()).iloc[-252:].std() * math.sqrt(252))
    checks = {
        "above200": last > s200,
        "rising200": s200 > float(ind.sma200.iloc[-21]),
        "ret6m": last > float(c.iloc[-126]),
        "ret12m": last > float(c.iloc[-252]),
        "near_high": last >= 0.85 * float(df.High.iloc[-252:].max()),
        "golden": float(ind.sma50.iloc[-1]) > s200,
        "calm": vol < 0.45,
        "not_stretched": last < 1.3 * s200,
    }
    pts = sum(p for k, p, _ in INVEST_RULES if checks[k])
    return {
        "score": pts,
        "parts": [{"ok": bool(checks[k]), "pts": p, "text": t} for k, p, t in INVEST_RULES],
        "ret6m": round((last / float(c.iloc[-126]) - 1) * 100, 1),
        "ret12m": round((last / float(c.iloc[-252]) - 1) * 100, 1),
        "vol": round(vol * 100, 1),
        "from_high": round((last / float(df.High.iloc[-252:].max()) - 1) * 100, 1),
    }


# ---------------------------------------------------------------- main

def analyze(df, tf, pooled=None, chart=True):
    """Return (summary, detail, outcomes). `pooled`: {pid: stats} across all instruments."""
    if df is None or len(df) < 60:
        return None, None, None
    ind = indicators(df)
    bs, ss, bparts, sparts, vol = setup_scores(df, ind)
    pats = detect_patterns(df)
    lc = last_closed_index(df, tf)
    if lc < 30:
        return None, None, None
    atr = float(ind.atr.iloc[lc])
    sup, res = key_levels(df.iloc[:lc + 1], atr)

    outs, base = pattern_outcomes(df, pats, PATTERN_HORIZON)
    local = {pid: summarize_outcome(outs[pid], PATTERNS[pid][1], base) for pid in pats.columns}
    pooled = pooled or {}
    notes = study_notes(df, ind, pats, local, pooled, sup, res, lc)

    hz = SCORE_HORIZON[tf]
    bt_bull = backtest_score(bs, df.Close, THRESHOLD, hz, True)
    bt_bear = backtest_score(ss, df.Close, THRESHOLD, hz, False)

    price = float(df.Close.iloc[-1])
    prev = float(df.Close.iloc[-2])
    dp = decimals(price)
    b_now = None if pd.isna(bs.iloc[lc]) else int(bs.iloc[lc])
    s_now = None if pd.isna(ss.iloc[lc]) else int(ss.iloc[lc])
    b_prev = None if pd.isna(bs.iloc[lc - 1]) else int(bs.iloc[lc - 1])
    s_prev = None if pd.isna(ss.iloc[lc - 1]) else int(ss.iloc[lc - 1])
    liquidity = float((df.Close * df.Volume).iloc[max(0, lc - 19):lc + 1].mean()) if vol else None

    summary = {
        "p": _r(price, dp), "ch": round((price / prev - 1) * 100, 2),
        "b": b_now, "s": s_now, "bp": b_prev, "sp": s_prev,
        "r": round(float(ind.rsi.iloc[lc]), 1),
        "tr": notes["trend"], "lean": notes["lean"],
        "pat": [{"id": p["id"], "dir": p["dir"], "ago": p["ago"]} for p in notes["recent_patterns"]],
        "bt": {"b": bt_bull["win"], "bn": bt_bull["n"], "bg": bt_bull["grade"],
               "s": bt_bear["win"], "sn": bt_bear["n"], "sg": bt_bear["grade"],
               "base": bt_bull["base_win"]},
        "atrp": round(atr / price * 100, 2) if price else None,
        "lq": round(liquidity) if liquidity else None,
        "t": str(df.index[lc].date()) if tf in ("1d", "1wk") else df.index[lc].isoformat(),
        "nearS": bool(notes.get("near_support")), "nearR": bool(notes.get("near_resistance")),
    }
    if tf == "1d":
        summary["inv"] = invest_technical(df, ind)

    detail = None
    if chart:
        n = CHART_CANDLES[tf]
        w = df.iloc[-n:]
        off = len(df) - len(w)
        ts = [int(x.timestamp()) for x in w.index]
        candles = [[ts[i], _r(r.Open, dp), _r(r.High, dp), _r(r.Low, dp), _r(r.Close, dp), int(r.Volume or 0)]
                   for i, r in enumerate(w.itertuples())]
        marks = []
        pw = pats.iloc[-n:]
        for pid in pats.columns:
            for i in np.flatnonzero(pw[pid].values):
                marks.append([int(i), pid])
        detail = {
            "tf": tf, "dp": dp, "closed": lc == len(df) - 1,
            "candles": candles,
            "sma50": [_r(x, dp) for x in ind.sma50.iloc[off:]],
            "sma200": [_r(x, dp) for x in ind.sma200.iloc[off:]],
            "rsi": [_r(x, 1) for x in ind.rsi.iloc[off:]],
            "bull": [None if pd.isna(x) else int(x) for x in bs.iloc[off:]],
            "bear": [None if pd.isna(x) else int(x) for x in ss.iloc[off:]],
            "marks": marks,
            "levels": {"sup": [{"p": _r(L["price"], dp), "n": L["touches"]} for L in sup],
                       "res": [{"p": _r(L["price"], dp), "n": L["touches"]} for L in res]},
            "parts": {
                "bull": explain_parts(bparts, BULL_RULES, vol, float(ind.rsi.iloc[lc]), "bull", lc),
                "bear": explain_parts(sparts, BEAR_RULES, vol, float(ind.rsi.iloc[lc]), "bear", lc),
            },
            "bt": {"bull": bt_bull, "bear": bt_bear},
            "pstats": {pid: v for pid, v in local.items() if v.get("n")},
            "study": notes,
        }
        if tf == "1d" and summary.get("inv"):
            detail["inv"] = summary["inv"]
    # trim summary copy of investing parts (they live in the detail file)
    if summary.get("inv"):
        summary["inv"] = {k: v for k, v in summary["inv"].items() if k != "parts"}
    return summary, detail, (outs, base)


def pool_outcomes(collected):
    """collected: list of (outs, base). Returns {pid: stats} over every instrument."""
    by = {pid: [] for pid in PATTERNS}
    bases = []
    for outs, base in collected:
        for pid, arr in outs.items():
            if len(arr):
                by[pid].append(arr)
        if len(base):
            bases.append(base[::5])
    base_all = np.concatenate(bases) if bases else np.array([])
    return {pid: summarize_outcome(np.concatenate(v) if v else np.array([]), PATTERNS[pid][1], base_all)
            for pid, v in by.items()}
