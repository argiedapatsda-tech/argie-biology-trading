"""Offline rehearsal of the whole pipeline with fake random-walk prices.

Replaces the Yahoo download with generated candles, runs a daily scan and a
fast scan into a temporary folder, and checks the website data files.
Run:  python tests/smoke_offline.py
"""
import json
import os
import shutil
import sys
import tempfile

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import engine.data as data  # noqa: E402
import engine.store as store  # noqa: E402
import run  # noqa: E402

FREQ = {"1d": "B", "1h": "h", "15m": "15min"}
LEN = {"5y": 1300, "730d": 5000, "60d": 2500, "5d": 5}


def fake(tickers, period, interval, **kw):
    out = {}
    end = pd.Timestamp.now(tz="UTC").floor("h")
    for t in tickers:
        if t.startswith("BAD"):
            continue  # simulate a symbol Yahoo doesn't know
        rng = np.random.default_rng(abs(hash(t)) % 2**32)
        n = LEN.get(period, 30)
        idx = pd.date_range(end=end, periods=n, freq=FREQ[interval], tz="UTC")
        ret = rng.normal(0.0004, 0.015 if interval == "1d" else 0.004, n)
        c = 100 * np.exp(np.cumsum(ret))
        o = np.r_[c[0], c[:-1]] * (1 + rng.normal(0, 0.002, n))
        hi = np.maximum(o, c) * (1 + np.abs(rng.normal(0, 0.006, n)))
        lo = np.minimum(o, c) * (1 - np.abs(rng.normal(0, 0.006, n)))
        v = 0 if t.endswith("=X") else rng.integers(1e5, 1e7, n)
        out[t] = pd.DataFrame({"Open": o, "High": hi, "Low": lo, "Close": c, "Volume": v}, index=idx)
    return out


def main():
    tmp = tempfile.mkdtemp(prefix="abt_")
    try:
        store.download_many = fake
        data.download_many = fake
        run.STATE = os.path.join(tmp, "state")
        run.SITE_DATA = os.path.join(tmp, "site", "data")
        run.DETAIL = os.path.join(run.SITE_DATA, "detail")
        uni = [
            {"xtb": "AAA.US", "yahoo": "AAA", "name": "Alpha Inc", "type": "Stocks", "market": "USA", "currency": "USD", "cfd": True, "real": True},
            {"xtb": "BBB.UK", "yahoo": "BBB.L", "name": "Beta plc", "type": "Stocks", "market": "UK", "currency": "GBP", "cfd": True, "real": False},
            {"xtb": "CCC.US", "yahoo": "CCC", "name": "Gamma ETF", "type": "ETFs", "market": "USA", "currency": "USD", "cfd": False, "real": True},
            {"xtb": "EURUSD", "yahoo": "EURUSD=X", "name": "EUR / USD", "type": "Forex", "market": "Global", "currency": "USD", "cfd": True, "real": False},
            {"xtb": "GOLD", "yahoo": "GC=F", "name": "Gold", "type": "Commodities", "market": "Global", "currency": "USD", "cfd": True, "real": False},
            {"xtb": "BAD.US", "yahoo": "BAD1", "name": "Missing Co", "type": "Stocks", "market": "USA", "currency": "USD", "cfd": True, "real": True},
        ]
        os.makedirs(run.STATE)
        with open(os.path.join(run.STATE, "universe.json"), "w") as fh:
            json.dump(uni, fh)

        real = lambda s: sum(1 for r in s["rows"] if not r.get("nd"))
        s1 = run.run_full(max_n=3)            # first slice
        assert real(s1) == 3 and s1["count"] == len(run.load_universe()), (real(s1), s1["count"])  # the rest are placeholders
        s2 = run.run_full(max_n=3)            # second slice picks the rest
        assert real(s2) == 5, real(s2)        # BAD1 has no data...
        bad = [r for r in s2["rows"] if r["x"] == "BAD.US"][0]
        assert bad.get("nd") == 1 and bad["d"] == {}, bad  # ...but still appears (search)
        aaa = [r for r in s2["rows"] if r["x"] == "AAA.US"][0]
        # today's look can be rare on one random series, so check that most rows got odds
        with_od = [r for r in s2["rows"] if r["d"].get("od")]
        assert len(with_od) >= 3, len(with_od)
        od_d = with_od[0]["d"]["od"]
        assert 0 <= od_d["L"] < 12 and len(od_d["c"]) == 3 and od_d["c"][0][0] >= 25, od_d
        raw = json.load(open(os.path.join(run.SITE_DATA, "summary.json")))
        assert raw["slim"] == 1 and isinstance([r for r in raw["rows"] if r["x"] == "AAA.US"][0]["d"]["bt"], list)
        back = run.read_summary()
        assert [r for r in back["rows"] if r["x"] == "AAA.US"][0]["d"]["bt"] == aaa["d"]["bt"]
        s2b = run.run_full(max_n=50, cache_only=True)   # re-analyse from saved history, no downloads
        assert real(s2b) == 5, real(s2b)
        nodata = json.load(open(os.path.join(run.STATE, "nodata.json")))
        assert "BAD1" in nodata
        s3 = run.run_fast()
        assert s3 is not None
        rows = {r["x"]: r for r in s3["rows"]}
        assert "i" in rows["GOLD"] and "4h" in rows["GOLD"]["i"], rows["GOLD"].keys()
        od = json.load(open(os.path.join(run.SITE_DATA, "odds.json")))
        assert "GOLD" in od["rows"] and "EURUSD" in od["rows"], od["rows"].keys()
        g_o = od["rows"]["GOLD"]
        assert 0 <= g_o["look"] < 24 and g_o["st"] and len(g_o["base"]) == 3
        print(f"odds.json: {len(od['rows'])} instruments, {os.path.getsize(os.path.join(run.SITE_DATA, 'odds.json')) / 1024:.0f} KB")
        det = json.load(open(os.path.join(run.DETAIL, "GOLD.json")))
        assert set(det["tf"]) >= {"1d", "1wk", "15m", "1h", "4h"}, det["tf"].keys()
        d = det["tf"]["1d"]
        assert len(d["c"]["o"]) == len(d["c"]["dt"]) + 1
        O, H, L, C = run.uncompact_check(d["c"], d["dp"])
        assert abs(C[-1] - rows["GOLD"]["d"]["p"]) < 10 ** -d["dp"], (C[-1], rows["GOLD"]["d"]["p"])
        assert all(H[i] >= max(O[i], C[i]) and L[i] <= min(O[i], C[i]) for i in range(len(C)))
        assert all(0 <= m[0] < len(C) for m in d["marks"])
        assert d["study"]["scenarios"][0]["status"] in ("waiting", "confirmed", "cancelled", "failed")
        # alerts: force a fresh crossing and check it is found, formatted and not repeated
        from engine import alerts
        g = json.loads(json.dumps(rows["GOLD"]))
        g["d"].update({"b": 76, "bp": 61})
        ev = alerts.find_events([g], "1d", {})
        assert any(e["kind"] == "setup" and e["side"] == "buy" for e in ev), ev
        msg = alerts.format_event(ev[0])
        assert "Gold" in msg and "76" in msg, msg
        first = alerts.process([g], "1d", run.STATE, run.SITE_DATA, {})
        again = alerts.process([g], "1d", run.STATE, run.SITE_DATA, {})
        assert first and not again, (len(first), len(again))
        print("alert message example:\n" + msg)
        size = sum(os.path.getsize(os.path.join(run.DETAIL, f)) for f in os.listdir(run.DETAIL))
        print(f"detail files: {len(os.listdir(run.DETAIL))}, avg {size / len(os.listdir(run.DETAIL)) / 1024:.0f} KB")
        print("summary row example:", json.dumps(rows["AAA.US"])[:400])
        # copy result next to the site for a local look
        out = os.path.join(ROOT, "site", "data")
        if "--publish-local" in sys.argv:
            shutil.rmtree(out, ignore_errors=True)
            shutil.copytree(run.SITE_DATA, out)
            print("copied fake data to site/data for a local preview")
        print("SMOKE TEST PASSED")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
