"""Moving averages, RSI, MACD, ATR and volume ratio.

Input everywhere: DataFrame with Open, High, Low, Close, Volume (one row per candle).
"""
import numpy as np
import pandas as pd


def indicators(df):
    c, h, l = df.Close, df.High, df.Low
    out = pd.DataFrame(index=df.index)
    out["sma20"] = c.rolling(20).mean()
    out["sma50"] = c.rolling(50).mean()
    out["sma200"] = c.rolling(200).mean()

    d = c.diff()
    gain = d.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    loss = (-d.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    out["rsi"] = (100 - 100 / (1 + gain / loss.replace(0, np.nan))).fillna(50)

    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    out["macd"] = ema12 - ema26
    out["macd_sig"] = out["macd"].ewm(span=9, adjust=False).mean()
    out["macd_hist"] = out["macd"] - out["macd_sig"]

    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    out["atr"] = tr.ewm(alpha=1 / 14, adjust=False).mean()

    v = df.Volume.fillna(0)
    out["vol_ratio"] = v / v.rolling(20).mean().shift(1).replace(0, np.nan)
    return out


def has_volume(df):
    """Forex has no real volume on Yahoo - volume rules are skipped for it."""
    v = df.Volume.fillna(0)
    return len(v) > 0 and (v > 0).mean() > 0.8
