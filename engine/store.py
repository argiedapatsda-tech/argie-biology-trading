"""Price history store: download long history ONCE, then only top it up.

Yahoo blocks big bursts of requests. Re-downloading 5 years for 8,000 symbols
every run would get us blocked quickly, so history lives in one Parquet file per
timeframe (kept between GitHub runs by the Actions cache) and each run only
fetches the last few days.
"""
import os
from datetime import datetime, timezone

import pandas as pd

from .data import download_many

# interval -> (full-history period, top-up period, max candles kept)
SPEC = {
    "1d": ("5y", "5d", 1400),
    "1h": ("730d", "5d", 12000),
    "15m": ("60d", "5d", 3000),
}


def _path(folder, tf):
    return os.path.join(folder, f"history_{tf}.parquet")


def load(folder, tf):
    p = _path(folder, tf)
    if not os.path.exists(p):
        return {}
    long = pd.read_parquet(p)
    out = {}
    for t, g in long.groupby("ticker", sort=False):
        df = g.drop(columns="ticker").set_index("ts").sort_index()
        out[t] = df.astype("float64")
    return out


def save(folder, tf, hist):
    os.makedirs(folder, exist_ok=True)
    parts = []
    for t, df in hist.items():
        if df is None or df.empty:
            continue
        d = df[["Open", "High", "Low", "Close", "Volume"]].astype("float32").copy()
        d.index = d.index.tz_convert("UTC") if d.index.tz is not None else d.index.tz_localize("UTC")
        d = d.rename_axis("ts").reset_index()
        d.insert(0, "ticker", t)
        parts.append(d)
    if not parts:
        return
    long = pd.concat(parts, ignore_index=True)
    long["ticker"] = long["ticker"].astype("category")
    tmp = _path(folder, tf) + ".tmp"
    long.to_parquet(tmp, compression="zstd", index=False)
    os.replace(tmp, _path(folder, tf))


def _to_utc(df, tf):
    idx = df.index
    df = df.copy()
    if tf == "1d":
        # keep the exchange's own calendar date (a Paris candle for Oct 2 must not
        # become "Oct 1 22:00 UTC")
        df.index = pd.DatetimeIndex(pd.to_datetime(idx.date)).tz_localize("UTC")
    else:
        df.index = idx.tz_convert("UTC") if idx.tz is not None else idx.tz_localize("UTC")
    return df


def update(folder, tf, tickers, log=print):
    """Bring `tickers` up to date for timeframe `tf`. Returns {ticker: DataFrame} (UTC index)."""
    full_p, short_p, keep = SPEC[tf]
    hist = load(folder, tf)
    now = datetime.now(timezone.utc)
    stale_limit = {"1d": 4, "1h": 4, "15m": 4}[tf]
    fresh, new = [], []
    for t in tickers:
        df = hist.get(t)
        if df is None or df.empty:
            new.append(t)
        elif (now - df.index[-1].to_pydatetime()).days <= stale_limit:
            fresh.append(t)
        else:
            new.append(t)  # gap too big for a top-up - refetch
    log(f"[{tf}] top-up {len(fresh)}, full download {len(new)}")
    got = {}
    if fresh:
        got.update(download_many(fresh, short_p, tf, log=log))
    if new:
        got.update(download_many(new, full_p, tf, log=log))
    for t, df in got.items():
        df = _to_utc(df, tf)
        old = hist.get(t)
        if old is not None and not old.empty:
            df = pd.concat([old, df])
            df = df[~df.index.duplicated(keep="last")].sort_index()
        hist[t] = df.iloc[-keep:]
    save(folder, tf, hist)
    missing = [t for t in tickers if t not in hist]
    if missing:
        log(f"[{tf}] no data for {len(missing)} symbols")
    return {t: hist[t] for t in tickers if t in hist}
