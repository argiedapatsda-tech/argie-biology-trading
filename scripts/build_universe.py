"""Build universe.json = every instrument XTB International offers, matched to Yahoo.

Inputs (XTB International specification tables, re-downloaded monthly by the workflow):
  xtb_lists/Specification_Table_Stock_CFDs_and_ETF_CFDs.pdf
  xtb_lists/Specification_Table_Organised_Market_Instruments_OMI.pdf   (real stocks/ETFs)
  xtb_lists/table-current.pdf                                          (forex etc.)
  other_instruments.json                                               (index/commodity/crypto names)

Run:  python scripts/build_universe.py [--download] [--verify]
"""
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LISTS = os.path.join(HERE, "xtb_lists")
ROOT = os.path.dirname(HERE)
BASE_URL = "https://www.xtb.com/int/"
FILES = {
    "cfd": "Specification_Table_Stock_CFDs_and_ETF_CFDs.pdf",
    "omi": "Specification_Table_Organised_Market_Instruments_OMI.pdf",
    "main": "table-current.pdf",
}
# XTB market suffix -> (Yahoo suffix, market name)
MARKETS = {
    "US": ("", "USA"), "UK": (".L", "UK"), "DE": (".DE", "Germany"), "FR": (".PA", "France"),
    "ES": (".MC", "Spain"), "IT": (".MI", "Italy"), "NL": (".AS", "Netherlands"), "CH": (".SW", "Switzerland"),
    "SE": (".ST", "Sweden"), "NO": (".OL", "Norway"), "DK": (".CO", "Denmark"), "FI": (".HE", "Finland"),
    "BE": (".BR", "Belgium"), "PT": (".LS", "Portugal"), "CZ": (".PR", "Czechia"), "PL": (".WA", "Poland"),
}
# US share classes XTB writes without a separator
US_SPECIAL = {"BRKB": "BRK-B", "BRKA": "BRK-A", "BFB": "BF-B", "BFA": "BF-A", "LENB": "LEN-B",
              "HEIA": "HEI-A", "MOGA": "MOG-A", "GEFB": "GEF-B", "CWENA": "CWEN-A", "UHALB": "UHAL-B"}


def download():
    os.makedirs(LISTS, exist_ok=True)
    for f in FILES.values():
        req = urllib.request.Request(BASE_URL + f, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=120).read()
        if not data.startswith(b"%PDF"):
            raise RuntimeError(f"{f}: not a PDF - XTB may have renamed it")
        with open(os.path.join(LISTS, f), "wb") as fh:
            fh.write(data)
        print("downloaded", f, len(data))


def pdf_text(name):
    from pypdf import PdfReader
    cache = os.path.join(LISTS, name + ".txt")
    src = os.path.join(LISTS, name)
    if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(src):
        return open(cache, encoding="utf-8").read()
    txt = "\n".join(p.extract_text() or "" for p in PdfReader(src).pages)
    with open(cache, "w", encoding="utf-8") as fh:
        fh.write(txt)
    return txt


def to_yahoo(sym):
    base, mkt = sym.rsplit(".", 1)
    suffix = MARKETS[mkt][0]
    if mkt == "US":
        return US_SPECIAL.get(base, base)
    if mkt == "UK":
        base = base.rstrip(".")
    # Nordic share classes: XTB "ATCOA" -> Yahoo "ATCO-A"
    if mkt in ("SE", "DK", "FI", "NO") and len(base) > 3 and base[-1] in "ABCDR" and base[-2] != "-":
        known_whole = {"SAAB", "SEB", "NOKIA", "SAMPO", "DANSKE", "ORSTED", "EQNR"}
        if base not in known_whole:
            return base[:-1] + "-" + base[-1] + suffix
    return base + suffix


SYM = r"([A-Z0-9][A-Z0-9\-]{0,9}\.(?:%s))(?:_\d+)?" % "|".join(MARKETS)


def parse_cfd(txt):
    """Stock CFDs then ETF CFDs. Row: SYMBOL Name CUR ..."""
    out = {}
    etf_start = txt.find("\nETF CFD\n")
    row = re.compile(r"^" + SYM + r"\s+(.+?)\s+(USD|EUR|GBP|GBX|CHF|SEK|NOK|DKK|PLN|CZK)\s+\d", re.M)
    for m in row.finditer(txt):
        sym, name, cur = m.group(1), m.group(2).strip(), m.group(3)
        kind = "ETF" if (etf_start > 0 and m.start() > etf_start) else "Stock"
        name = re.sub(r"\s*ETF CFD$", "", name).strip()
        out[sym] = {"name": name, "kind": kind, "currency": cur}
    return out


def parse_omi(txt):
    """Real stocks/ETFs (stop before the Fractional Rights section)."""
    lines = txt.splitlines()
    starts = [i for i, l in enumerate(lines) if l.strip() == "Stocks"]
    stocks_i = starts[-1] if starts else 0
    etf_i = next(i for i in range(stocks_i, len(lines)) if lines[i].strip().startswith("ETF, ETN, ETC"))
    frac_i = next((i for i in range(etf_i, len(lines)) if lines[i].strip().startswith("Specification Table Fractional")), len(lines))
    row = re.compile(r"^" + SYM + r"(\*?)\s+(.+?)\s+([A-Z]{2}[A-Z0-9]{9}\d)\s+([A-Z]{3})\b")
    out = {}
    for i in range(stocks_i, frac_i):
        m = row.match(lines[i].strip())
        if not m:
            continue
        sym, star, name, isin, cur = m.groups()
        if star or "CLOSE ONLY" in name:
            continue  # close-only: you can sell but not buy - useless for signals
        name = re.sub(r",?\s*(DIST|ACC),.*$", "", name).strip(" ,")
        out[sym] = {"name": name, "isin": isin, "currency": cur, "kind": "ETF" if i >= etf_i else "Stock"}
    return out


def parse_forex(txt):
    pairs = set()
    sec = txt.split("CFD on indices")[0] if "CFD on indices" in txt else txt
    for m in re.finditer(r"^([A-Z]{6})\s+\1\s", sec, re.M):
        pairs.add(m.group(1))
    return sorted(pairs)


def build():
    cfd = parse_cfd(pdf_text(FILES["cfd"]))
    omi = parse_omi(pdf_text(FILES["omi"]))
    fx = parse_forex(pdf_text(FILES["main"]))

    # Germany's Xetra lists thousands of foreign companies (Dell, Apple...). Keep a
    # .DE real-stock line only if it is a German company or has no home listing here.
    isin_home = {}
    for sym, r in omi.items():
        mkt = sym.rsplit(".", 1)[1]
        country = r["isin"][:2]
        if (country == "GB" and mkt == "UK") or country == mkt:
            isin_home[r["isin"]] = sym

    rows = {}
    for sym, r in omi.items():
        mkt = sym.rsplit(".", 1)[1]
        home = isin_home.get(r["isin"])
        if home and home != sym:
            continue
        rows[sym] = {"xtb": sym, "yahoo": to_yahoo(sym), "name": r["name"], "type": r["kind"] + "s",
                     "market": MARKETS[mkt][1], "currency": r["currency"], "isin": r["isin"],
                     "real": True, "cfd": False}
    for sym, r in cfd.items():
        mkt = sym.rsplit(".", 1)[1]
        if sym in rows:
            rows[sym]["cfd"] = True
            continue
        rows[sym] = {"xtb": sym, "yahoo": to_yahoo(sym), "name": r["name"], "type": r["kind"] + "s",
                     "market": MARKETS[mkt][1], "currency": r["currency"], "isin": None,
                     "real": False, "cfd": True}

    # the same ETF is often listed on several exchanges - keep one line per ISIN
    pref = ["US", "UK", "DE", "NL", "FR", "IT", "CH", "ES", "SE", "NO", "DK", "FI", "BE", "PT", "CZ", "PL"]
    best = {}
    for sym, r in rows.items():
        if r["type"] != "ETFs" or not r.get("isin"):
            continue
        rank = pref.index(sym.rsplit(".", 1)[1])
        cur = best.get(r["isin"])
        if cur is None or rank < cur[0] or (rank == cur[0] and r["cfd"] and not rows[cur[1]]["cfd"]):
            best[r["isin"]] = (rank, sym)
    keep = {sym for _, sym in best.values()}
    rows = {s: r for s, r in rows.items() if r["type"] != "ETFs" or not r.get("isin") or s in keep}

    other = json.load(open(os.path.join(HERE, "other_instruments.json"), encoding="utf-8"))
    for pair in fx:
        rows[pair] = {"xtb": pair, "yahoo": pair + "=X", "name": pair[:3] + " / " + pair[3:],
                      "type": "Forex", "market": "Global", "currency": pair[3:], "cfd": True, "real": False}
    for group in ("Indices", "Commodities", "Crypto"):
        for xtb, (yahoo, name) in other[group].items():
            rows[xtb] = {"xtb": xtb, "yahoo": yahoo, "name": name, "type": group,
                         "market": "Global", "currency": "USD", "cfd": True, "real": False}
    return list(rows.values())


def verify(universe):
    """Download 1 month for every Yahoo symbol; mark the ones that return data."""
    sys.path.insert(0, ROOT)
    from engine.data import download_many
    ys = sorted({u["yahoo"] for u in universe})
    got = download_many(ys, "1mo", "1d", log=print)

    # second chance: the other share-class spelling ("ATCO-A.ST" <-> "ATCOA.ST")
    alts = {}
    for u in universe:
        y = u["yahoo"]
        if y in got:
            continue
        base, dot, suf = y.partition(".") if not y.startswith("^") else (y, "", "")
        if "-" in base and not y.endswith("-USD"):
            alts[base.replace("-", "") + dot + suf] = u
        elif u["market"] in ("Sweden", "Denmark", "Finland", "Norway") and len(base) > 3:
            alts[base[:-1] + "-" + base[-1] + dot + suf] = u
    if alts:
        got2 = download_many(list(alts), "1mo", "1d", log=print)
        for y, u in alts.items():
            if y in got2:
                u["yahoo"] = y
                got[y] = got2[y]

    for u in universe:
        df = got.get(u["yahoo"])
        u["ok"] = bool(df is not None and len(df) >= 5)
    return universe


if __name__ == "__main__":
    if "--download" in sys.argv:
        download()
    uni = build()
    if "--verify" in sys.argv:
        uni = verify(uni)
    path = os.path.join(ROOT, "state", "universe.json") if "--to-state" in sys.argv else os.path.join(ROOT, "universe.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(uni, fh, ensure_ascii=False, indent=0)
    from collections import Counter
    print("instruments:", len(uni))
    print("by type:", dict(Counter(u["type"] for u in uni)))
    print("by market:", dict(Counter(u["market"] for u in uni).most_common()))
    print("CFD:", sum(u["cfd"] for u in uni), " real:", sum(u["real"] for u in uni))
    if "--verify" in sys.argv:
        bad = [u for u in uni if not u["ok"]]
        print("matched to price data:", len(uni) - len(bad), " NOT matched:", len(bad))
        print("by type not matched:", dict(Counter(u["type"] for u in bad)))
        print("examples:", [(u["xtb"], u["yahoo"]) for u in bad[:40]])
