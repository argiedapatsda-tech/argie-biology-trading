"""Find working Yahoo symbols for XTB instruments whose first guess returned no data.

The universe builder guesses one Yahoo symbol per XTB instrument. About 500 guesses
return nothing (for example Aker ASA is AKER.OL, not AKE-R.OL; Andritz trades in
Vienna as ANDR.VI, not on Xetra under ANDR.DE). For each of those this script
tries a few other spellings, then Yahoo's own name search, and keeps the
first symbol that really has prices AND whose name matches ours.

Writes state/yahoo_fix.json  {xtb: yahoo}. run.py load_universe() applies it.
Runs weekly inside the scan workflow (Yahoo answers GitHub's network, not home IPs).

  python scripts/fix_missing.py            # every instrument still without data
  python scripts/fix_missing.py --dry      # print, do not write
"""
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from engine.data import download_many  # noqa: E402

STATE = os.path.join(ROOT, "state")
# ISIN country -> Yahoo suffix of the home exchange (Xetra/US listings of foreign companies)
HOME = {"AT": ".VI", "NL": ".AS", "FR": ".PA", "ES": ".MC", "IT": ".MI", "CH": ".SW", "GB": ".L",
        "SE": ".ST", "NO": ".OL", "DK": ".CO", "FI": ".HE", "BE": ".BR", "PT": ".LS", "PL": ".WA",
        "IE": ".IR", "HK": ".HK", "CA": ".TO", "JP": ".T", "AU": ".AX", "US": "", "DE": ".DE"}
MARKET_SUFFIX = {"USA": "", "UK": ".L", "Germany": ".DE", "France": ".PA", "Spain": ".MC", "Netherlands": ".AS",
                 "Switzerland": ".SW", "Sweden": ".ST", "Norway": ".OL", "Denmark": ".CO", "Finland": ".HE",
                 "Belgium": ".BR", "Portugal": ".LS", "Italy": ".MI", "Poland": ".WA", "Czechia": ".PR"}
HAND = {"USDCNH=X": ["CNH=X"], "EURCNH=X": ["EURCNH=X", "EURCNY=X"], "WIG20.WA": ["WIG20.WA", "^WIG20"]}
STOP = {"inc", "corp", "ltd", "plc", "ag", "sa", "se", "nv", "asa", "ab", "the", "group", "holding", "holdings",
        "co", "company", "class", "a", "b", "adr", "oyj", "spa", "as", "bv", "de", "and", "&"}


def read(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def words(name):
    return [w for w in re.findall(r"[a-z0-9]+", (name or "").lower()) if w not in STOP]


def same_name(ours, theirs):
    a, b = words(ours), words(theirs)
    return bool(a and b) and (a[0] == b[0] or a[0][:5] == b[0][:5])


def guesses(u):
    y = u["yahoo"]
    out = list(HAND.get(y, []))
    base, dot, suf = y.partition(".")
    suf = dot + suf
    if "-" in base and not y.endswith("-USD"):
        out.append(base.replace("-", "") + suf)                 # AKE-R.OL -> AKER.OL
    if re.search(r"[A-Z]\d$", base):
        out.append(base[:-1] + suf)                             # ACX1.MC -> ACX.MC
    isin = (u.get("isin") or "")[:2]
    if suf == ".DE" and isin in HOME and isin != "DE":
        out.append(base + HOME[isin])                           # Xetra listing -> home market
    if suf in (".DE",):
        out.append(base + ".F")
    return [g for g in dict.fromkeys(out) if g != y]


def search(u):
    """Yahoo's own search by company name; only symbols on the right market with a matching name."""
    import yfinance as yf
    try:
        quotes = yf.Search(u["name"], max_results=8, news_count=0).quotes
    except Exception:
        return []
    out = []
    for q in quotes:
        sym, nm = q.get("symbol", ""), q.get("longname") or q.get("shortname") or ""
        if not same_name(u["name"], nm):
            continue
        if u["type"] == "Crypto":
            if sym.endswith("-USD"):
                out.append(sym)
            continue
        want = MARKET_SUFFIX.get(u["market"])
        if want is None:
            out.append(sym)
        elif want == "" and "." not in sym:
            out.append(sym)
        elif want and sym.endswith(want):
            out.append(sym)
    return out


def main():
    dry = "--dry" in sys.argv
    uni = read(os.path.join(STATE, "universe.json"), []) or read(os.path.join(ROOT, "universe.json"), [])
    fixes = read(os.path.join(STATE, "yahoo_fix.json"), {})
    summary = read(os.path.join(ROOT, "site", "data", "summary.json"), {"rows": []})
    have = {r["x"] for r in summary["rows"] if not r.get("nd")}
    missing = {u["xtb"] for u in uni if u["xtb"] not in have}
    todo = [u for u in uni if u["xtb"] in missing and u["xtb"] not in fixes]
    print(f"{len(todo)} instruments without data to fix")

    # round 1: other spellings, checked in one batch download
    cand = {u["xtb"]: guesses(u) for u in todo}
    flat = sorted({g for gs in cand.values() for g in gs})
    got = download_many(flat, "1mo", "1d", log=print) if flat else {}
    found = {}
    for u in todo:
        for g in cand[u["xtb"]]:
            if g in got and len(got[g]) >= 5:
                found[u["xtb"]] = g
                break
    print(f"round 1 (spellings): {len(found)} fixed")

    # round 2: name search for the rest
    rest = [u for u in todo if u["xtb"] not in found]
    sc = {}
    for u in rest:
        s = [g for g in search(u) if g != u["yahoo"]]
        if s:
            sc[u["xtb"]] = s[:3]
        time.sleep(0.3)
    flat = sorted({g for gs in sc.values() for g in gs})
    got = download_many(flat, "1mo", "1d", log=print) if flat else {}
    n2 = 0
    for u in rest:
        for g in sc.get(u["xtb"], []):
            if g in got and len(got[g]) >= 5:
                found[u["xtb"]] = g
                n2 += 1
                break
    print(f"round 2 (name search): {n2} fixed")
    for x, g in sorted(found.items()):
        print(f"  {x:14} -> {g}")
    still = [u["xtb"] for u in todo if u["xtb"] not in found]
    print(f"still without data: {len(still)} (likely delisted, renamed or not on Yahoo)")
    print("  " + " ".join(still[:200]))
    if not dry:
        fixes.update(found)
        os.makedirs(STATE, exist_ok=True)
        with open(os.path.join(STATE, "yahoo_fix.json"), "w", encoding="utf-8") as fh:
            json.dump(fixes, fh, indent=0, sort_keys=True)


if __name__ == "__main__":
    main()
