"""Argie Biology Trading - main program.

  python run.py full            # 2x a day: every XTB instrument, Daily + Weekly
  python run.py fast            # every 30 min: fast-watch list, 15m / 1H / 4H
  python run.py full --limit 60 # quick local test on a small sample

Writes the website data into site/data/ and remembers state in state/.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import pandas as pd

from engine import alerts, odds, store
from engine.analyze import analyze, pool_outcomes
from engine.data import fix_forex_daily, is_forex, resample

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, "state")
SITE_DATA = os.path.join(ROOT, "site", "data")
DETAIL = os.path.join(SITE_DATA, "detail")
FAST_SIZE = 120          # stocks/ETFs added to the fast-watch list
FAST_MIN_LIQ = 5e6       # ...only if they trade at least this much per day (price x volume)


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


def safe_id(xtb):
    return re.sub(r"[^A-Za-z0-9_\-]", "_", xtb)


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


TF_SEC = {"15m": 900, "1h": 3600, "4h": 14400, "1d": 86400, "1wk": 604800}
KEEP = {"1d": 320, "1wk": 170, "4h": 400, "1h": 400, "15m": 300}


def compact(detail):
    """Candles -> small integers (about 5x smaller). site/app.js decode() reverses it.

    t : first time + gaps measured in candle lengths (1 = next candle)
    c : first close, then change from the previous close
    o : open - close        h : high - max(open, close)    l : min(open, close) - low
    v : volume as 0-99 relative to the biggest volume shown (only used for bar heights)
    """
    dp, tf = detail["dp"], detail["tf"]
    k = 10 ** dp
    cs = detail.pop("candles")
    keep = KEEP[tf]
    cut = max(0, len(cs) - keep)
    cs = cs[cut:]
    detail["marks"] = [[i - cut, p] for i, p in detail["marks"] if i >= cut]
    step = TF_SEC[tf]
    t = [c[0] for c in cs]
    O = [round(c[1] * k) for c in cs]
    H = [round(c[2] * k) for c in cs]
    L = [round(c[3] * k) for c in cs]
    Cl = [round(c[4] * k) for c in cs]
    vmax = max([c[5] for c in cs] + [1])
    detail["c"] = {
        "t0": t[0] if t else 0, "step": step,
        "dt": [round((t[i] - t[i - 1]) / step) for i in range(1, len(t))],
        "c": [Cl[0]] + [Cl[i] - Cl[i - 1] for i in range(1, len(Cl))],
        "o": [O[i] - Cl[i] for i in range(len(O))],
        "h": [H[i] - max(O[i], Cl[i]) for i in range(len(H))],
        "l": [min(O[i], Cl[i]) - L[i] for i in range(len(L))],
        "v": [round(c[5] / vmax * 99) for c in cs],
    }
    for key in ("sma50", "sma200", "rsi"):
        detail.pop(key, None)  # recomputed in the browser from the candles
    for key in ("bull", "bear"):
        detail[key] = detail[key][-250:]
    return detail


def uncompact_check(detail_c, dp):
    """Inverse of compact() - used by the tests to prove nothing is lost."""
    k = 10 ** dp
    C, acc = [], 0
    for i, d in enumerate(detail_c["c"]):
        acc = d if i == 0 else acc + d
        C.append(acc)
    O = [C[i] + detail_c["o"][i] for i in range(len(C))]
    H = [max(O[i], C[i]) + detail_c["h"][i] for i in range(len(C))]
    L = [min(O[i], C[i]) - detail_c["l"][i] for i in range(len(C))]
    return [x / k for x in O], [x / k for x in H], [x / k for x in L], [x / k for x in C]


def merge_detail(xtb, meta, tf_details):
    path = os.path.join(DETAIL, safe_id(xtb) + ".json")
    cur = read_json(path, {"meta": meta, "tf": {}})
    cur["meta"] = meta
    for tf, d in tf_details.items():
        if d is not None:
            cur["tf"][tf] = compact(d)
    write_json(path, cur)


def load_universe(limit=None):
    # the monthly refresh writes state/universe.json; the committed copy is the fallback
    uni = read_json(os.path.join(STATE, "universe.json"), []) or read_json(os.path.join(ROOT, "universe.json"), [])
    # Thai SET stocks (TradingView mode only), built by scripts/build_tv_map.py
    uni = uni + (read_json(os.path.join(STATE, "universe_th.json"), []) or read_json(os.path.join(ROOT, "universe_th.json"), []))
    uni = [u for u in uni if u.get("ok", True)]
    # the hand-checked crypto/index/commodity symbols always win: a monthly list built before a
    # fix kept Toncoin on Yahoo's "TON-USD", a different coin worth 0.005 instead of ~1.5
    other = read_json(os.path.join(ROOT, "scripts", "other_instruments.json"), {})
    fixed = {x: v[0] for group in other.values() if isinstance(group, dict) for x, v in group.items()}
    for u in uni:
        if u["xtb"] in fixed and u["type"] not in ("Stocks", "ETFs"):
            u["yahoo"] = fixed[u["xtb"]]
    if limit:
        # small test sample: keep every non-stock + the first N stocks/ETFs
        others = [u for u in uni if u["type"] not in ("Stocks", "ETFs")]
        stocks = [u for u in uni if u["type"] in ("Stocks", "ETFs")][:limit]
        uni = others + stocks
    return uni


def meta_of(u):
    return {k: u.get(k) for k in ("xtb", "yahoo", "name", "type", "market", "currency", "cfd", "real", "tvonly")}


# ---------------------------------------------------------------- full scan

def pick_slice(uni, max_n):
    """The `max_n` instruments updated longest ago (never-updated first).

    Yahoo blocks big bursts, so each run only refreshes a slice; over a day every
    instrument is still refreshed roughly twice. Symbols that returned no data
    are retried only once a week.
    """
    upd = read_json(os.path.join(STATE, "updated.json"), {})
    nodata = read_json(os.path.join(STATE, "nodata.json"), {})
    now = time.time()
    pool = [u for u in uni if now - nodata.get(u["yahoo"], 0) > 7 * 86400]

    def priority(u):  # on equal age: non-stocks, then CFD stocks, US first
        if u["type"] not in ("Stocks", "ETFs"):
            return 0
        if u.get("tvonly"):
            return 2
        return (1 if u.get("cfd") else 3) + (0 if u["market"] == "USA" else 1)
    pool.sort(key=lambda u: (upd.get(u["yahoo"], 0), priority(u)))
    return pool[:max_n]


def run_full(limit=None, max_n=None):
    t0 = time.time()
    uni_all = load_universe(limit)
    uni = pick_slice(uni_all, max_n) if max_n else uni_all
    log(f"daily scan: {len(uni)} of {len(uni_all)} instruments")
    tickers = sorted({u["yahoo"] for u in uni})
    daily = store.update(STATE, "1d", tickers, log=log)
    upd = read_json(os.path.join(STATE, "updated.json"), {})
    nodata = read_json(os.path.join(STATE, "nodata.json"), {})
    for t in tickers:
        if t in daily and (time.time() - daily[t].index[-1].timestamp()) < 10 * 86400:
            upd[t] = time.time()
            nodata.pop(t, None)
        elif t not in daily:
            nodata[t] = time.time()
    write_json(os.path.join(STATE, "updated.json"), upd)
    write_json(os.path.join(STATE, "nodata.json"), nodata)
    log(f"got data for {sum(t in daily for t in tickers)}/{len(tickers)}")
    fx = [t for t in tickers if is_forex(t)]
    hourly_fx = store.update(STATE, "1h", fx, log=log) if fx else {}

    pooled_prev = read_json(os.path.join(STATE, "pooled.json"), {})
    collected = {"1d": [], "1wk": []}
    rows = []
    for n, u in enumerate(uni, 1):
        df = daily.get(u["yahoo"])
        if df is None or len(df) < 60:
            continue
        if u["type"] != "Crypto":
            # Yahoo adds frozen weekend candles to forex/futures - only crypto trades then
            df = df[df.index.dayofweek < 5]
        if is_forex(u["yahoo"]):
            df = fix_forex_daily(df, hourly_fx.get(u["yahoo"]))
        wk = resample(df, "W-MON")
        try:
            sd, dd, od = analyze(df, "1d", pooled_prev.get("1d"))
            sw, dw, ow = analyze(wk, "1wk", pooled_prev.get("1wk"))
        except Exception as e:  # one bad symbol must never stop the scan
            log("skip", u["xtb"], repr(e)[:120])
            continue
        if sd is None:
            continue
        if od:
            collected["1d"].append(od)
        if ow:
            collected["1wk"].append(ow)
        row = {"x": u["xtb"], "y": u["yahoo"], "n": u["name"], "ty": u["type"], "m": u["market"],
               "cur": u.get("currency"), "cfd": u.get("cfd"), "real": u.get("real"), "d": sd}
        if u.get("tvonly"):
            row["tvo"] = 1  # hidden in XTB mode
        if sw:
            row["w"] = {k: sw[k] for k in ("b", "s", "r", "tr", "pat", "t")}
        rows.append(row)
        merge_detail(u["xtb"], meta_of(u), {"1d": dd, "1wk": dw})
        if n % 500 == 0:
            log(f"  analysed {n}/{len(uni)}")

    # pattern stats over all instruments: only replace them when this run saw enough
    pooled = {tf: pool_outcomes(v) for tf, v in collected.items() if len(v) >= 150}
    merged_pooled = {**pooled_prev, **pooled}
    write_json(os.path.join(STATE, "pooled.json"), merged_pooled)

    # merge this slice into the existing summary (rows from earlier slices stay)
    old = {r["x"]: r for r in read_json(os.path.join(SITE_DATA, "summary.json"), {}).get("rows", [])}
    valid = {u["xtb"] for u in uni_all}
    for r in rows:
        if r["x"] in old:
            for k in ("i", "live"):
                if k in old[r["x"]]:
                    r[k] = old[r["x"]][k]
        old[r["x"]] = r
    all_rows = [r for x, r in old.items() if x in valid]

    alerts.process(rows, "1d", STATE, SITE_DATA, merged_pooled, log=log)
    alerts.morning_digest(all_rows, STATE, log=log)

    fast = choose_fast(all_rows)
    write_json(os.path.join(STATE, "fast.json"), fast)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    summary = {"generated": now, "full_scan": now, "count": len(all_rows), "universe": len(uni_all),
               "fast": [f["xtb"] for f in fast], "rows": all_rows}
    write_json(os.path.join(SITE_DATA, "summary.json"), summary)
    write_json(os.path.join(SITE_DATA, "patterns.json"), merged_pooled)
    log(f"daily scan done: {len(rows)} analysed this run, {len(all_rows)} on the site, {time.time() - t0:.0f}s")
    return summary


def choose_fast(rows):
    """Every non-stock instrument + the strongest liquid CFD stocks/ETFs right now."""
    fast = [r for r in rows if r["ty"] not in ("Stocks", "ETFs")]
    cands = [r for r in rows if r["ty"] in ("Stocks", "ETFs") and r.get("cfd") and not r.get("tvo")
             and (r["d"].get("lq") or 0) >= FAST_MIN_LIQ]
    cands.sort(key=lambda r: -max(r["d"].get("b") or 0, r["d"].get("s") or 0))
    fast += cands[:FAST_SIZE]
    return [{"xtb": r["x"], "yahoo": r["y"]} for r in fast]


# ---------------------------------------------------------------- fast scan

def run_fast():
    t0 = time.time()
    fast = read_json(os.path.join(STATE, "fast.json"), [])
    if not fast:
        log("no fast list yet - run a full scan first")
        return None
    summary = read_json(os.path.join(SITE_DATA, "summary.json"), {"rows": []})
    by_x = {r["x"]: r for r in summary["rows"]}
    uni = {u["xtb"]: u for u in load_universe()}
    tickers = sorted({f["yahoo"] for f in fast})
    log(f"fast scan: {len(tickers)} instruments")
    h1 = store.update(STATE, "1h", tickers, log=log)
    m15 = store.update(STATE, "15m", tickers, log=log)
    pooled = read_json(os.path.join(STATE, "pooled.json"), {})
    collected = {"15m": [], "1h": [], "4h": []}
    touched = []
    odds_rows = {}

    for f in fast:
        y, x = f["yahoo"], f["xtb"]
        frames = {"1h": h1.get(y), "15m": m15.get(y)}
        try:  # 'last times it looked like this' (Good for buying / selling now tabs)
            o = odds.odds(frames["1h"])
            if o:
                odds_rows[x] = o
        except Exception as e:
            log("odds skip", x, repr(e)[:120])
        if frames["1h"] is not None:
            frames["4h"] = resample(frames["1h"], "4h")
            frames["1h"] = frames["1h"].iloc[-1500:]
        out, intr = {}, {}
        for tf in ("15m", "1h", "4h"):
            df = frames.get(tf)
            if df is None:
                continue
            try:
                s, d, o = analyze(df, tf, pooled.get(tf))
            except Exception as e:
                log("skip", x, tf, repr(e)[:120])
                continue
            if s is None:
                continue
            out[tf] = d
            if o:
                collected[tf].append(o)
            intr[tf] = {k: s[k] for k in ("b", "s", "bp", "sp", "r", "tr", "pat", "t", "p", "bt")}
        if not out:
            continue
        u = uni.get(x, {"xtb": x, "yahoo": y})
        merge_detail(x, meta_of(u), out)
        row = by_x.get(x)
        if row is not None:
            row["i"] = intr
            touched.append(row)
            # the latest 15m close is the freshest price we have
            last = intr.get("15m") or intr.get("1h")
            if last and last.get("p") is not None:
                row["live"] = {"p": last["p"], "t": last["t"]}

    new_pooled = {tf: pool_outcomes(v) for tf, v in collected.items() if len(v) >= 20}
    pooled.update(new_pooled)
    alerts.process(touched, "4h", STATE, SITE_DATA, pooled, log=log)
    write_json(os.path.join(STATE, "pooled.json"), pooled)
    write_json(os.path.join(SITE_DATA, "patterns.json"), pooled)
    summary["generated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    summary["fast_scan"] = summary["generated"]
    write_json(os.path.join(SITE_DATA, "odds.json"),
               {"generated": summary["generated"], "months": odds.MONTHS, "min_n": odds.MIN_N,
                "spacing": odds.SPACING, "rows": odds_rows})
    log(f"odds for {len(odds_rows)} instruments")
    write_json(os.path.join(SITE_DATA, "summary.json"), summary)
    log(f"fast scan done in {time.time() - t0:.0f}s")
    return summary


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"

    def opt(name):
        return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else None

    if mode == "full":
        run_full(opt("--limit"), opt("--max"))
    elif mode == "fast":
        run_fast()
    else:
        sys.exit("usage: python run.py full [--max N] [--limit N] | fast")
