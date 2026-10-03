"""Check that each non-stock Yahoo symbol is really the instrument we think it is.

Some short crypto tickers (APE-USD, UNI-USD, ...) belong to a different coin on
Yahoo than the one XTB offers. Prints Yahoo's own name next to ours so wrong
matches stand out. Run on GitHub (Actions -> tools -> check_names).
"""
import json
import os
import sys
import time

import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uni = json.load(open(os.path.join(ROOT, "universe.json"), encoding="utf-8"))
types = sys.argv[1:] or ["Crypto", "Commodities", "Indices"]
bad = 0
for u in uni:
    if u["type"] not in types:
        continue
    try:
        info = yf.Ticker(u["yahoo"]).get_info()
        yname = info.get("longName") or info.get("shortName") or info.get("name") or "?"
        price = info.get("regularMarketPrice") or info.get("previousClose")
        vol = info.get("volume24Hr") or info.get("averageDailyVolume10Day") or info.get("volume")
        mcap = info.get("marketCap")
    except Exception as e:
        yname, price, vol, mcap = f"ERROR {repr(e)[:60]}", None, None, None
    ours = u["name"].lower().split()[0]
    flag = "" if ours[:4] in yname.lower() else "  <-- CHECK"
    bad += bool(flag)
    print(f'{u["xtb"]:14} {u["yahoo"]:14} ours="{u["name"]}"  yahoo="{yname}"  price={price}  vol={vol}  mcap={mcap}{flag}')
    time.sleep(0.4)
print(f"\n{bad} to check")
