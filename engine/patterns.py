"""17 classic candlestick patterns.

Each detector returns True on the candle that COMPLETES the pattern. Reversal
patterns also require the right trend before them (a hammer only counts after
a fall), which is how they are defined in the textbooks.
"""
import numpy as np
import pandas as pd

PATTERNS = {
    # id: (name, direction, number of candles, plain meaning)
    "hammer": ("Hammer", "bull", 1, "Sellers pushed price down but buyers pushed it all the way back up. Possible bottom after a fall."),
    "inv_hammer": ("Inverted Hammer", "bull", 1, "After a fall, buyers tried to push higher. Weak bullish hint, needs confirmation."),
    "bull_engulf": ("Bullish Engulfing", "bull", 2, "A green candle completely swallows the previous red one. Buyers took control."),
    "piercing": ("Piercing Line", "bull", 2, "After a red candle, a green candle closes above its midpoint. Selling is fading."),
    "morning_star": ("Morning Star", "bull", 3, "Big red, small indecision candle, then strong green. Classic 3-candle bottom."),
    "bull_harami": ("Bullish Harami", "bull", 2, "A small green candle inside a big red one. Selling pressure is pausing."),
    "three_soldiers": ("Three White Soldiers", "bull", 3, "Three strong green candles in a row. Steady, determined buying."),
    "marubozu_bull": ("Bullish Marubozu", "bull", 1, "A big green candle with almost no wicks. Buyers in full control the whole time."),
    "shooting_star": ("Shooting Star", "bear", 1, "Buyers pushed price up but sellers slammed it back down. Possible top after a rise."),
    "hanging_man": ("Hanging Man", "bear", 1, "Hammer shape but after a rise. Warning that buyers are getting tired."),
    "bear_engulf": ("Bearish Engulfing", "bear", 2, "A red candle completely swallows the previous green one. Sellers took control."),
    "dark_cloud": ("Dark Cloud Cover", "bear", 2, "After a green candle, a red candle closes below its midpoint. Buying is fading."),
    "evening_star": ("Evening Star", "bear", 3, "Big green, small indecision candle, then strong red. Classic 3-candle top."),
    "bear_harami": ("Bearish Harami", "bear", 2, "A small red candle inside a big green one. Buying pressure is pausing."),
    "three_crows": ("Three Black Crows", "bear", 3, "Three strong red candles in a row. Steady, determined selling."),
    "marubozu_bear": ("Bearish Marubozu", "bear", 1, "A big red candle with almost no wicks. Sellers in full control the whole time."),
    "doji": ("Doji", "neutral", 1, "Open and close almost equal. Buyers and sellers are balanced - indecision."),
}


def detect_patterns(df):
    o, h, l, c = df.Open, df.High, df.Low, df.Close
    body = (c - o).abs()
    rng = (h - l).replace(0, np.nan)
    upper = h - np.maximum(o, c)
    lower = np.minimum(o, c) - l
    avg = body.rolling(14).mean()
    avg_rng = (h - l).rolling(14).mean()
    green, red = c > o, c < o
    o1, c1, b1 = o.shift(1), c.shift(1), body.shift(1)
    o2, c2, b2 = o.shift(2), c.shift(2), body.shift(2)
    # trend over the 5 candles BEFORE the pattern
    down, up = c.shift(1) < c.shift(6), c.shift(1) > c.shift(6)
    down3, up3 = c.shift(3) < c.shift(8), c.shift(3) > c.shift(8)
    mid1 = (o1 + c1) / 2

    small_body = body <= 0.35 * rng
    real_body = body > 0.02 * rng
    hammer_shape = (lower >= 2 * body) & (upper <= 0.15 * rng) & small_body & real_body
    star_shape = (upper >= 2 * body) & (lower <= 0.15 * rng) & small_body & real_body

    p = pd.DataFrame(index=df.index)
    p["hammer"] = hammer_shape & down
    p["hanging_man"] = hammer_shape & up
    p["shooting_star"] = star_shape & up
    p["inv_hammer"] = star_shape & down
    p["bull_engulf"] = (c1 < o1) & green & (c >= o1) & (o <= c1) & (body > b1) & down
    p["bear_engulf"] = (c1 > o1) & red & (c <= o1) & (o >= c1) & (body > b1) & up
    p["piercing"] = (c1 < o1) & (b1 > avg) & green & (o <= c1) & (c > mid1) & (c < o1) & down
    p["dark_cloud"] = (c1 > o1) & (b1 > avg) & red & (o >= c1) & (c < mid1) & (c > o1) & up
    star_mid = b1 < 0.5 * avg
    p["morning_star"] = (c2 < o2) & (b2 > avg) & star_mid & green & (c > (o2 + c2) / 2) & down3
    p["evening_star"] = (c2 > o2) & (b2 > avg) & star_mid & red & (c < (o2 + c2) / 2) & up3
    p["bull_harami"] = (c1 < o1) & (b1 > 1.2 * avg) & green & (o > c1) & (c < o1) & (body < 0.6 * b1) & down
    p["bear_harami"] = (c1 > o1) & (b1 > 1.2 * avg) & red & (o < c1) & (c > o1) & (body < 0.6 * b1) & up
    g = green & (body > 0.6 * avg) & (upper < 0.3 * body)
    rd = red & (body > 0.6 * avg) & (lower < 0.3 * body)
    p["three_soldiers"] = g & g.shift(1) & g.shift(2) & (c > c1) & (c1 > c2) & (o > o1) & (o < c1)
    p["three_crows"] = rd & rd.shift(1) & rd.shift(2) & (c < c1) & (c1 < c2) & (o < o1) & (o > c1)
    p["marubozu_bull"] = green & (body > 1.8 * avg) & (upper <= 0.05 * rng) & (lower <= 0.05 * rng)
    p["marubozu_bear"] = red & (body > 1.8 * avg) & (upper <= 0.05 * rng) & (lower <= 0.05 * rng)
    # doji only counts when the candle has a normal-sized range (not a dead, flat candle)
    p["doji"] = (body <= 0.08 * rng) & ((h - l) > 0.5 * avg_rng)
    p = p.fillna(False).astype(bool)
    # a doji that is also a hammer/star is reported as the more specific pattern
    p.loc[p.hammer | p.hanging_man | p.shooting_star | p.inv_hammer, "doji"] = False
    return p[list(PATTERNS)]
