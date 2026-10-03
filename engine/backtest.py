"""'How did this signal do in the past?'

Every number here compares the signal with the BASELINE (what happened on all
days), so a signal only looks good if it beats just holding.
"""
import numpy as np

MIN_SIGNALS = 15  # fewer examples than this -> we refuse to judge at all


def grade(n, win, base_win):
    """Is the win rate clearly better than 'normal', or could it be luck?

    z = how many standard errors the win rate sits above the normal rate.
    On random fake prices a 67% vs 54% result from 24 signals happens by luck
    (z ~ 1.3), so 'reliable' needs z >= 1.65 (about 95% sure it is not luck).
    """
    if not n or n < MIN_SIGNALS:
        return "Too few examples to judge"
    p0 = (base_win if base_win is not None else 50) / 100
    p0 = min(max(p0, 0.05), 0.95)
    z = (win / 100 - p0) / ((p0 * (1 - p0) / n) ** 0.5)
    if z >= 1.65 and win >= 55:
        return "Historically reliable"
    if z >= 0.5:
        return "Slight edge (could be luck)"
    return "No real edge"


def backtest_score(score, close, thr, horizon, bullish=True):
    """When the score first crosses `thr`, how did price do `horizon` candles later?"""
    fwd = close.shift(-horizon) / close - 1
    valid = fwd.notna() & score.notna()
    onset = (score >= thr) & (score.shift() < thr) & valid
    idx, last = [], -10 ** 9
    for i, flag in enumerate(onset.values):  # cooldown: no overlapping signals
        if flag and i - last >= horizon:
            idx.append(i)
            last = i
    f = fwd.iloc[idx]
    base = fwd[valid]
    sign = 1 if bullish else -1
    n = len(f)
    win = round(float(((f * sign) > 0).mean()) * 100, 1) if n else None
    base_win = round(float(((base * sign) > 0).mean()) * 100, 1) if len(base) else None
    return {
        "n": n, "win": win, "base_win": base_win, "horizon": horizon,
        "avg": round(float(f.mean()) * 100 * sign, 2) if n else None,
        "grade": grade(n, win, base_win),
    }


def pattern_outcomes(df, pats, horizon=5):
    """Forward returns `horizon` candles after each pattern completed."""
    fwd = df.Close.shift(-horizon) / df.Close - 1
    out = {pid: fwd[pats[pid]].dropna().values for pid in pats.columns}
    base = fwd.dropna().values
    return out, base


def summarize_outcome(arr, direction, base):
    """arr/base: arrays of forward returns (can be pooled across instruments)."""
    n = len(arr)
    if n == 0:
        return {"n": 0}
    up = float((arr > 0).mean()) * 100
    base_up = float((base > 0).mean()) * 100 if len(base) else None
    r = {"n": n, "up": round(up, 1), "avg": round(float(np.mean(arr)) * 100, 2),
         "base_up": round(base_up, 1) if base_up is not None else None}
    if direction == "bull":
        r["win"], r["base_win"] = r["up"], r["base_up"]
    elif direction == "bear":
        r["win"] = round(100 - up, 1)
        r["base_win"] = round(100 - base_up, 1) if base_up is not None else None
    if direction != "neutral":
        r["grade"] = grade(n, r["win"], r["base_win"])
    return r
