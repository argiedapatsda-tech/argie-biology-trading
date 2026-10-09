"""Daily trading size (price x volume) in US dollars, so shares from different markets compare fairly.

The scan stores "lq" in the currency Yahoo quotes the share in. London GBP shares are quoted in
pence, so their raw number is 100x too big; Swedish/Norwegian/Danish crowns are about 10x too big.
Rates are rough on purpose: this only sorts big from small, it is never used for a price.
The site mirrors this table in app.js (USD_RATE / lqUsd) - keep the two the same.
"""

USD_RATE = {"USD": 1.0, "EUR": 1.16, "GBP": 1.33 / 100, "CHF": 1.25, "SEK": 0.105, "NOK": 0.10,
            "DKK": 0.155, "CZK": 0.047, "THB": 0.03, "PLN": 0.27}


def lq_usd(row):
    lq = (row.get("d") or {}).get("lq")
    if lq is None:
        return None
    return lq * USD_RATE.get(row.get("cur") or "USD", 1.0)
