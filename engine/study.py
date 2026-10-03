"""'What next' study notes: plain-language if/then scenarios.

Built only from CLOSED candles - a candle that is still forming can change shape
before it closes, so it never confirms anything.
"""
import pandas as pd

from .patterns import PATTERNS


def fmt(x):
    if x is None:
        return "-"
    ax = abs(x)
    if ax >= 1000:
        return f"{x:,.1f}"
    if ax >= 10:
        return f"{x:,.2f}"
    return f"{x:.4f}" if ax < 2 else f"{x:.3f}"


def _status(closes, start, end, trigger, invalid, bullish):
    """Walk closed candles after the setup candle and report what happened."""
    state = "waiting"
    for j in range(start + 1, end + 1):
        cj = closes[j]
        beyond = cj > trigger if bullish else cj < trigger
        broken = cj < invalid if bullish else cj > invalid
        if state == "waiting":
            if broken:
                return "cancelled"
            if beyond:
                state = "confirmed"
        elif state == "confirmed" and broken:
            return "failed"
    return state


STATUS_TEXT = {
    "waiting": "Waiting - no candle has closed beyond the confirmation price yet.",
    "confirmed": "Confirmed - a candle already closed beyond the confirmation price.",
    "cancelled": "Cancelled - price closed beyond the 'wrong if' price before confirming.",
    "failed": "Confirmed, then failed - price later closed back beyond the 'wrong if' price.",
}


def study_notes(df, ind, pats, stats_local, stats_pool, sup, res, last_closed):
    """last_closed: positional index of the newest CLOSED candle."""
    i = last_closed
    c = float(df.Close.iloc[i])
    atr = float(ind.atr.iloc[i])
    s50, s200 = ind.sma50.iloc[i], ind.sma200.iloc[i]
    rsi = float(ind.rsi.iloc[i])
    notes = {"close": c, "atr": atr, "rsi": round(rsi, 1)}

    if pd.notna(s50) and pd.notna(s200):
        if c > s50 > s200:
            trend = ("up", "Uptrend: price is above the 50 and 200 averages, which are stacked upward.")
        elif c < s50 < s200:
            trend = ("down", "Downtrend: price is below the 50 and 200 averages, which are stacked downward.")
        else:
            trend = ("mixed", "Mixed / sideways: price and the averages are not lined up in one direction.")
    elif pd.notna(s50):
        trend = ("up" if c > s50 else "down", "Price is " + ("above" if c > s50 else "below") + " its 50 average.")
    else:
        trend = ("mixed", "Not enough history for trend averages.")
    notes["trend"], notes["trend_text"] = trend

    if rsi >= 70:
        notes["rsi_text"] = f"RSI {rsi:.0f}: overbought - strong, but late buyers often get caught by pullbacks."
    elif rsi <= 30:
        notes["rsi_text"] = f"RSI {rsi:.0f}: oversold - weak, but bounces are common from here."
    elif rsi >= 50:
        notes["rsi_text"] = f"RSI {rsi:.0f}: buyers slightly in control."
    else:
        notes["rsi_text"] = f"RSI {rsi:.0f}: sellers slightly in control."

    # patterns completed on the last 3 closed candles
    recent = []
    for back in range(3):
        j = i - back
        for pid in pats.columns:
            if pats[pid].iloc[j]:
                name, direction, ncand, meaning = PATTERNS[pid]
                recent.append({
                    "id": pid, "name": name, "dir": direction, "ago": back, "meaning": meaning, "idx": j,
                    "low": float(df.Low.iloc[j - ncand + 1:j + 1].min()),
                    "high": float(df.High.iloc[j - ncand + 1:j + 1].max()),
                    "local": stats_local.get(pid, {"n": 0}),
                    "pool": stats_pool.get(pid, {"n": 0}),
                })
    notes["recent_patterns"] = recent

    if sup:
        notes["near_support"] = (c - sup[0]["price"]) <= atr
    if res:
        notes["near_resistance"] = (res[0]["price"] - c) <= atr

    # scenarios, anchored on the newest directional pattern (or the last closed candle)
    main = next((p for p in recent if p["dir"] != "neutral"), None)
    base_i = main["idx"] if main else i
    hi = main["high"] if main else float(df.High.iloc[i])
    lo = main["low"] if main else float(df.Low.iloc[i])
    up_target = next((L["price"] for L in res if L["price"] > hi + 0.2 * atr), None)
    dn_target = next((L["price"] for L in sup if L["price"] < lo - 0.2 * atr), None)
    closes = df.Close.values

    def rr(entry, stop, target):
        risk = abs(entry - stop)
        return round(abs(target - entry) / risk, 2) if target is not None and risk > 0 else None

    scen = []
    for side in ("bull", "bear"):
        bull = side == "bull"
        trig, inv, tgt = (hi, lo, up_target) if bull else (lo, hi, dn_target)
        st = _status(closes, base_i, i, trig, inv, bull)
        if bull:
            text = (f"Bullish case: a candle CLOSING above {fmt(trig)} confirms buyers. "
                    f"The idea is wrong if price closes below {fmt(inv)}. "
                    + (f"Next resistance to watch: {fmt(tgt)}." if tgt else "No resistance overhead in recent history."))
        else:
            text = (f"Bearish case: a candle CLOSING below {fmt(trig)} confirms sellers. "
                    f"The idea is wrong if price closes above {fmt(inv)}. "
                    + (f"Next support to watch: {fmt(tgt)}." if tgt else "No support below in recent history."))
        scen.append({"side": side, "trigger": trig, "invalid": inv, "target": tgt,
                     "rr": rr(trig, inv, tgt), "status": st, "status_text": STATUS_TEXT[st], "text": text})
    notes["scenarios"] = scen

    # overall lean - counts evidence, it does not predict
    lean = {"up": 1, "down": -1}.get(trend[0], 0)
    lean += 1 if rsi > 55 else -1 if rsi < 45 else 0
    if main:
        st = main["pool"]
        if st.get("n", 0) >= 30 and st.get("grade") == "Historically reliable":
            lean += 1 if main["dir"] == "bull" else -1
    for s in scen:
        if s["status"] == "confirmed":
            lean += 1 if s["side"] == "bull" else -1
    if notes.get("near_support"):
        lean += 0.5
    if notes.get("near_resistance"):
        lean -= 0.5
    notes["lean"] = lean
    notes["lean_text"] = ("Evidence leans bullish" if lean >= 1.5 else
                          "Evidence leans bearish" if lean <= -1.5 else
                          "Evidence is mixed - often best to wait for a clearer candle")
    for p in recent:
        p.pop("idx", None)
    return notes
