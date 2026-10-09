"""Telegram alerts + the alert history the website shows.

Alerts fire once, on the candle where something NEW happened:
  setup   - buy or sell setup score crossed 70 (Daily, or 4H for the fast list)
  pattern - a pattern that has historically worked completed right at support/resistance
Plus one morning digest (about 8:00 Thailand time) with the top setups.

Telegram is optional: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (GitHub secrets).
Without them alerts are still recorded for the website, just not sent.
"""
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from .money import lq_usd
from .patterns import PATTERNS

SITE = "https://argiedapatsda-tech.github.io/argie-biology-trading/"
MAX_PER_RUN = 8            # never flood the phone
MIN_LIQ = 5e6              # stocks/ETFs must trade at least this many US dollars per day
TF_NAME = {"1d": "Daily", "4h": "4H", "1h": "1H"}


def _read(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def _write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".tmp", "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(path + ".tmp", path)


def send_telegram(text, log=print):
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return False
    data = urllib.parse.urlencode({"chat_id": chat, "text": text, "parse_mode": "HTML",
                                   "disable_web_page_preview": "true"}).encode()
    try:
        urllib.request.urlopen(f"https://api.telegram.org/bot{token}/sendMessage", data, timeout=20).read()
        return True
    except Exception as e:  # never let a Telegram problem stop the scan
        log("telegram failed:", repr(e)[:150])
        return False


def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _link(x, tf):
    return f'{SITE}#/i/{urllib.parse.quote(x)}/{tf}'


def _eligible(row):
    if not row.get("cfd"):
        return False
    if row["ty"] in ("Stocks", "ETFs"):
        return (lq_usd(row) or 0) >= MIN_LIQ
    return True


def find_events(rows, tf, pooled):
    """rows: summary rows just analysed. Returns list of event dicts."""
    events = []
    for r in rows:
        if not _eligible(r):
            continue
        t = r["d"] if tf == "1d" else (r.get("i") or {}).get(tf)
        if not t or t.get("b") is None:
            continue
        for side, k, kp in (("buy", "b", "bp"), ("sell", "s", "sp")):
            if t[k] >= 70 and (t.get(kp) is None or t[kp] < 70):
                bt = t.get("bt") or {}
                events.append({"kind": "setup", "side": side, "x": r["x"], "n": r["n"], "tf": tf,
                               "score": t[k], "t": t["t"], "price": t.get("p", r["d"].get("p")),
                               "trend": t.get("tr"), "pats": t.get("pat", []),
                               "past": {"win": bt.get("b" if side == "buy" else "s"),
                                        "n": bt.get("bn" if side == "buy" else "sn"),
                                        "grade": bt.get("bg" if side == "buy" else "sg"),
                                        "base": bt.get("base")}})
        for p in t.get("pat", []):
            if p["ago"] != 0 or p["dir"] == "neutral":
                continue
            st = (pooled.get(tf) or {}).get(p["id"], {})
            at_level = r["d"].get("nearS") if p["dir"] == "bull" else r["d"].get("nearR")
            if tf != "1d":
                at_level = True  # intraday rows don't carry level flags; rely on the stats test
            if st.get("grade") == "Historically reliable" and at_level:
                events.append({"kind": "pattern", "side": "buy" if p["dir"] == "bull" else "sell",
                               "x": r["x"], "n": r["n"], "tf": tf, "pid": p["id"], "t": t["t"],
                               "price": t.get("p", r["d"].get("p")), "stat": st})
    return events


def format_event(e):
    arrow = "🟢 ▲" if e["side"] == "buy" else "🔴 ▼"
    head = f'{arrow} <b>{_esc(e["n"])}</b> ({_esc(e["x"])}) · {TF_NAME.get(e["tf"], e["tf"])}'
    if e["kind"] == "setup":
        lines = [head, f'{"Buy" if e["side"] == "buy" else "Sell"}-side setup score crossed 70 → <b>{e["score"]}</b>/100']
        if e.get("pats"):
            names = ", ".join(PATTERNS[p["id"]][0] for p in e["pats"] if p["dir"] != "neutral")
            if names:
                lines.append(f"Candles: {_esc(names)}")
        past = e["past"]
        if past.get("n"):
            base = past["base"] if e["side"] == "buy" else (100 - past["base"] if past.get("base") is not None else None)
            lines.append(f'Past: worked {past["win"]}% of {past["n"]} times (normal {base}%) – {_esc(past["grade"])}')
    else:
        name = PATTERNS[e["pid"]][0]
        st = e["stat"]
        where = "at support" if e["side"] == "buy" else "at resistance"
        lines = [head, f"<b>{_esc(name)}</b> just completed {where}" if e["tf"] == "1d" else f"<b>{_esc(name)}</b> just completed",
                 f'Across all instruments it worked {st["win"]}% of {st["n"]:,} times (normal {st["base_win"]}%)']
    lines.append(f'Price {e["price"]} · <a href="{_link(e["x"], e["tf"])}">open chart & study notes</a>')
    return "\n".join(lines)


def process(rows, tf, state_dir, site_data, pooled, log=print):
    sent_path = os.path.join(state_dir, "alerts_sent.json")
    sent = _read(sent_path, {})
    now = time.time()
    sent = {k: v for k, v in sent.items() if now - v < 21 * 86400}   # forget after 3 weeks
    events = find_events(rows, tf, pooled)
    new = []
    for e in events:
        key = f'{e["x"]}|{e["tf"]}|{e["kind"]}|{e["side"]}|{e.get("pid", "")}|{e["t"]}'
        if key not in sent:
            e["key"] = key
            new.append(e)
    new.sort(key=lambda e: (e["kind"] != "setup", -(e.get("score") or 0)))
    delivered = 0
    for e in new[:MAX_PER_RUN]:
        if send_telegram(format_event(e), log):
            delivered += 1
        sent[e["key"]] = now
    for e in new[MAX_PER_RUN:]:
        sent[e["key"]] = now   # recorded on the site, not pushed
    _write(sent_path, sent)

    hist_path = os.path.join(site_data, "alerts.json")
    hist = _read(hist_path, [])
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for e in new:
        hist.append({k: e.get(k) for k in ("kind", "side", "x", "n", "tf", "score", "pid", "price", "t")} | {"at": stamp})
    _write(hist_path, hist[-500:])
    if new:
        log(f"alerts: {len(new)} new ({tf}), {delivered} sent to Telegram")
    return new


def morning_digest(rows, state_dir, log=print):
    """Once a day after 01:00 UTC (08:00 Thailand): top setups in one message."""
    flag = os.path.join(state_dir, "digest_day.txt")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if datetime.now(timezone.utc).hour < 1:
        return
    try:
        if open(flag).read().strip() == today:
            return
    except OSError:
        pass
    good = [r for r in rows if _eligible(r) and r["d"].get("b") is not None]
    buys = sorted([r for r in good if r["d"]["b"] >= 70], key=lambda r: -r["d"]["b"])[:5]
    sells = sorted([r for r in good if r["d"]["s"] >= 70], key=lambda r: -r["d"]["s"])[:5]
    inv = sorted([r for r in rows if (r["d"].get("inv") or {}).get("score", 0) >= 85 and (lq_usd(r) or 0) >= 2e7],
                 key=lambda r: -r["d"]["inv"]["score"])[:5]
    fmt = lambda r, k: f'• <a href="{_link(r["x"], "1d")}">{_esc(r["n"])}</a> ({_esc(r["x"])}) {r["d"][k]}'
    parts = ["☀️ <b>Morning summary</b> (Daily charts)"]
    if buys:
        parts += ["", "🟢 <b>Strongest buy-side setups</b>"] + [fmt(r, "b") for r in buys]
    if sells:
        parts += ["", "🔴 <b>Strongest sell-side setups</b>"] + [fmt(r, "s") for r in sells]
    if inv:
        parts += ["", "📈 <b>Strong long-term trends</b>"] + [f'• {_esc(r["n"])} ({_esc(r["x"])}) {r["d"]["inv"]["score"]}' for r in inv]
    parts += ["", f'<a href="{SITE}">Open the website</a> · evidence, not advice']
    send_telegram("\n".join(parts), log)
    with open(flag, "w") as fh:
        fh.write(today)
