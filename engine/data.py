"""Download candles from Yahoo Finance and clean them up.

Known data problems handled here:
- Yahoo's DAILY forex candles have a broken Close (it is a price from just after
  the open). Forex trades nonstop, so the real close of a day is the next day's
  open; the newest day takes its close from the latest 1-hour candle.
- The newest candle may still be forming. `last_closed_index` tells the rest of
  the engine which candle is the newest one that has really closed.
"""
import time
import warnings
from datetime import datetime, timezone

import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")
COLS = ["Open", "High", "Low", "Close", "Volume"]
TF_SECONDS = {"15m": 900, "1h": 3600, "4h": 14400, "1d": 86400, "1wk": 604800}


def is_forex(yahoo):
    return yahoo.endswith("=X")


def _clean(df):
    if df is None or df.empty:
        return pd.DataFrame(columns=COLS)
    df = df[[c for c in COLS if c in df.columns]].copy()
    if "Volume" not in df:
        df["Volume"] = 0
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    df = df[(df.High >= df.Low) & (df.Close > 0)]
    return df[~df.index.duplicated(keep="last")]


def fix_forex_daily(daily, hourly=None):
    d = daily.copy()
    nxt_open = d.Open.shift(-1)
    d["Close"] = nxt_open
    if hourly is not None and len(hourly):
        d.iloc[-1, d.columns.get_loc("Close")] = float(hourly.Close.iloc[-1])
    else:
        d.iloc[-1, d.columns.get_loc("Close")] = float(daily.Close.iloc[-1])
    d["High"] = d[["High", "Close", "Open"]].max(axis=1)
    d["Low"] = d[["Low", "Close", "Open"]].min(axis=1)
    return d.dropna(subset=["Close"])


def resample(df, rule):
    if df.empty:
        return df
    out = df.resample(rule, label="left", closed="left").agg(
        {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
    return out.dropna(subset=["Open", "Close"])


def _download_chunk(part, period, interval):
    try:
        raw = yf.download(part, period=period, interval=interval, group_by="ticker",
                          auto_adjust=True, threads=4, progress=False)
    except Exception:
        return {}
    got = {}
    if raw is None or raw.empty:
        return got
    for t in part:
        try:
            df = raw[t] if isinstance(raw.columns, pd.MultiIndex) else raw
        except KeyError:
            continue
        df = _clean(df)
        if len(df):
            got[t] = df
    return got


def download_many(tickers, period, interval, chunk=100, pause=4.0, rounds=3, log=None):
    """Batch download -> {ticker: DataFrame}. Missing tickers are simply absent.

    Yahoo rate-limits big bursts ("Too Many Requests"), so we go in small chunks
    with a pause between them, then retry whatever failed after a longer wait.
    """
    result = {}
    todo = list(dict.fromkeys(tickers))
    for rnd in range(rounds):
        for k in range(0, len(todo), chunk):
            result.update(_download_chunk(todo[k:k + chunk], period, interval))
            if k + chunk < len(todo):
                time.sleep(pause)
        missing = [t for t in todo if t not in result]
        if log:
            log(f"  round {rnd + 1}: {len(todo) - len(missing)}/{len(todo)} ok")
        # a few misses = symbols Yahoo doesn't have; only many misses look like blocking
        if not missing or rnd == rounds - 1 or len(missing) <= max(10, 0.1 * len(todo)):
            break
        time.sleep(45 * (rnd + 1))   # let the rate limit cool down
        todo = missing
        chunk = max(25, chunk // 2)
    return result


def last_closed_index(df, interval, now=None):
    """Positional index of the newest candle that has fully closed."""
    if df.empty:
        return -1
    now = now or datetime.now(timezone.utc)
    ts = df.index[-1]
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    end = ts + pd.Timedelta(seconds=TF_SECONDS[interval])
    closed = now >= end.to_pydatetime()
    return len(df) - 1 if closed else len(df) - 2


def load_timeframes(yahoo_list, want=("1d", "4h", "1h")):
    """Return {ticker: {tf: DataFrame}} for the requested timeframes.

    1d  : 5 years (needed for backtests and the 200 average)
    1h  : last 180 days, 4h is built from 2 years of 1h
    1wk : built from daily
    """
    out = {t: {} for t in yahoo_list}
    hourly = {}
    if "1h" in want or "4h" in want or any(is_forex(t) for t in yahoo_list):
        hourly = download_many(yahoo_list, "730d", "1h")
    if "1d" in want or "1wk" in want:
        daily = download_many(yahoo_list, "5y", "1d")
        for t, d in daily.items():
            if is_forex(t):
                d = fix_forex_daily(d, hourly.get(t))
            out[t]["1d"] = d
            if "1wk" in want:
                out[t]["1wk"] = resample(d, "W-MON")
    for t, h in hourly.items():
        if "4h" in want:
            out[t]["4h"] = resample(h, "4h")
        if "1h" in want:
            cut = h.index[-1] - pd.Timedelta(days=180)
            out[t]["1h"] = h[h.index >= cut]
    if "15m" in want:
        m15 = download_many(yahoo_list, "60d", "15m")
        for t, m in m15.items():
            out[t]["15m"] = m
    return out
