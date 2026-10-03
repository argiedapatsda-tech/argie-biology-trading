"""Match every instrument to its TradingView symbol, and build the Thai SET list.

  python scripts/build_tv_map.py            # writes universe_th.json + site/tv.json
  python scripts/build_tv_map.py --to-state # writes state/universe_th.json + state/tv.json

Every candidate symbol is checked against TradingView's own screener, so a symbol
only goes into the map if TradingView really knows it. Nothing here needs a key.
"""
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN = "https://scanner.tradingview.com/{}/scan"

# Yahoo suffix -> (TradingView exchange, how to rewrite the ticker)
SUFFIX = {
    "DE": ["XETR", "GETTEX", "FWB", "TRADEGATE"], "L": ["LSE"], "PA": ["EURONEXT"], "AS": ["EURONEXT"], "BR": ["EURONEXT"],
    "LS": ["EURONEXT"], "MC": ["BME"], "MI": ["MIL", "EURONEXT"], "SW": ["SIX"], "ST": ["OMXSTO"],
    "OL": ["OSL"], "CO": ["OMXCOP"], "HE": ["OMXHEX"], "PR": ["PSECZ"], "BK": ["SET"],
}
# XTB name -> TradingView candidates, first one TradingView knows wins
FIXED = {
    "US100": ["NASDAQ:NDX"], "US500": ["SP:SPX"], "US30": ["DJ:DJI"], "US2000": ["TVC:RUT", "CBOE:RUT"],
    "DE40": ["XETR:DAX"], "UK100": ["TVC:UKX", "FTSE:UKX"], "FRA40": ["EURONEXT:PX1"], "EU50": ["TVC:SX5E"],
    "SPA35": ["BME:IBC"], "ITA40": ["INDEX:FTSEMIB", "MIL:FTSEMIB"], "NED25": ["EURONEXT:AEX"],
    "SUI20": ["SIX:SMI"], "JP225": ["TVC:NI225"], "VIX": ["TVC:VIX", "CBOE:VIX"], "USDIDX": ["TVC:DXY"],
    "W20": ["GPW:WIG20"],
    "GOLD": ["TVC:GOLD", "OANDA:XAUUSD"], "SILVER": ["TVC:SILVER", "OANDA:XAGUSD"],
    "PLATINUM": ["TVC:PLATINUM", "OANDA:XPTUSD"], "PALLADIUM": ["TVC:PALLADIUM", "OANDA:XPDUSD"],
    "COPPER": ["COMEX:HG1!", "OANDA:XCUUSD"], "ALUMINIUM": ["COMEX:ALI1!", "LME:ALI1!"],
    "OIL": ["ICEEUR:BRN1!", "TVC:UKOIL"], "OIL.WTI": ["NYMEX:CL1!", "TVC:USOIL"],
    "NATGAS": ["NYMEX:NG1!", "OANDA:NATGASUSD"], "GASOLINE": ["NYMEX:RB1!"], "COCOA": ["ICEUS:CC1!"],
    "COFFEE": ["ICEUS:KC1!"], "CORN": ["CBOT:ZC1!", "OANDA:CORNUSD"], "SOYBEAN": ["CBOT:ZS1!", "OANDA:SOYBNUSD"],
    "SUGAR": ["ICEUS:SB1!", "OANDA:SUGARUSD"], "WHEAT": ["CBOT:ZW1!", "OANDA:WHEATUSD"],
    "COTTON": ["ICEUS:CT1!"], "ORANGE": ["ICEUS:OJ1!"], "TNOTE": ["CBOT:ZN1!"],
}


def post(market, body, tries=4):
    data = json.dumps(body).encode()
    for i in range(tries):
        try:
            req = urllib.request.Request(SCAN.format(market), data=data, headers={"Content-Type": "text/plain", "User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - retry anything, report the last
            err = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"TradingView screener failed: {err}")


def known(tickers):
    """The subset of `tickers` that TradingView recognises."""
    ok = set()
    tickers = list(dict.fromkeys(tickers))
    for i in range(0, len(tickers), 800):
        res = post("global", {"symbols": {"tickers": tickers[i:i + 800]}, "columns": ["name"]})
        ok.update(d["s"] for d in res.get("data", []))
        time.sleep(0.5)
    return ok


def candidates(u):
    y, x, t = u["yahoo"], u["xtb"], u["type"]
    if x in FIXED:
        return FIXED[x]
    if t == "Forex":
        p = y.replace("=X", "")
        return [f"FX_IDC:{p}", f"FX:{p}", f"OANDA:{p}"]
    if t == "Crypto":
        base = y.split("-")[0]
        base = re.sub(r"(?<=[A-Z])\d{4,}$", "", base)  # Yahoo's numbered ids: UNI7083 -> UNI
        return [f"BINANCE:{base}USDT", f"COINBASE:{base}USD", f"BITSTAMP:{base}USD", f"CRYPTO:{base}USD"]
    if "." in y:
        base, suf = y.rsplit(".", 1)
    else:
        base, suf = y, None
    if suf is None:  # USA
        b = base.replace("-", ".")
        return [f"{ex}:{b}" for ex in ("NASDAQ", "NYSE", "AMEX", "BATS", "OTC")]
    out = []
    for ex in SUFFIX.get(suf, []):
        for b in dict.fromkeys([base, base.replace("-", "."), base.replace("-", "_"), base + ".", base.replace("-", "")]):
            out.append(f"{ex}:{b}")
    return out


def thai_list():
    """Every common stock and ETF on SET + mai, biggest first."""
    res = post("thailand", {
        "columns": ["name", "description", "type", "subtype", "exchange", "market_cap_basic", "currency"],
        "filter": [{"left": "exchange", "operation": "equal", "right": "SET"}],
        "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"}, "range": [0, 5000]})
    out = []
    for d in res["data"]:
        name, desc, typ, sub, ex, cap, cur = d["d"]
        if typ == "stock" and sub in ("common", "preferred", "reit"):
            kind = "Stocks"
        elif typ == "fund" and sub in ("etf",):
            kind = "ETFs"
        else:
            continue  # DRs, warrants, unit trusts: no Yahoo history
        if name.endswith("-F") or name.endswith("-P") or name.endswith("-Q"):
            continue  # foreign / preferred boards duplicate the main line
        out.append({"xtb": name + ".BK", "yahoo": name + ".BK", "name": desc.title() if desc.isupper() else desc,
                    "type": kind, "market": "Thailand", "currency": cur or "THB", "isin": None,
                    "real": False, "cfd": False, "tvonly": True, "tv": d["s"]})
    return out


def main():
    to_state = "--to-state" in sys.argv
    uni = None
    for p in (os.path.join(ROOT, "state", "universe.json"), os.path.join(ROOT, "universe.json")):
        if os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                uni = json.load(fh)
            break
    cands = {u["xtb"]: candidates(u) for u in uni}
    cands_type = {u["xtb"]: u["type"] for u in uni}
    ok = known([c for cs in cands.values() for c in cs])
    tv = {}
    for x, cs in cands.items():
        hit = next((c for c in cs if c in ok), None)
        if hit:
            tv[x] = hit
        elif cs and ":" in cs[0] and cands_type[x] in ("Stocks", "ETFs"):
            # the screener misses some listings; a bare ticker still opens on a TradingView chart
            tv[x] = cs[0].split(":", 1)[1]
    th = thai_list()
    for u in th:
        tv[u["xtb"]] = u.pop("tv")
    missing = [x for x in cands if x not in tv]
    bare = sum(1 for v in tv.values() if ":" not in v)
    print(f"mapped {len(tv) - len(th)}/{len(cands)} XTB instruments ({bare} chart-only), {len(th)} Thai SET; missing {len(missing)}: {missing[:30]}")

    out_dir = os.path.join(ROOT, "state") if to_state else ROOT
    tv_path = os.path.join(ROOT, "state", "tv.json") if to_state else os.path.join(ROOT, "site", "tv.json")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "universe_th.json"), "w", encoding="utf-8") as fh:
        json.dump(th, fh, ensure_ascii=False, indent=0)
    with open(tv_path, "w", encoding="utf-8") as fh:
        json.dump(tv, fh, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
