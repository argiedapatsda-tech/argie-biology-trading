/* Argie Biology Trading - website logic (no framework, no build step). */
(function () {
  'use strict';

  // ---------------------------------------------------------------- pattern knowledge
  // candles for the little drawings: [open, high, low, close] on a 0-10 scale
  const PAT = {
    hammer: ['Hammer', 'bull', 'Sellers pushed price down but buyers pushed it all the way back up. Possible bottom after a fall.', [[8, 8.3, 6.6, 6.8], [6.8, 7, 5.2, 5.4], [5.4, 5.6, 4, 4.2], [4.2, 4.6, 1.2, 4.5]]],
    inv_hammer: ['Inverted Hammer', 'bull', 'After a fall, buyers tried to push higher. Weak bullish hint, needs confirmation.', [[8, 8.2, 6.6, 6.8], [6.8, 7, 5.2, 5.4], [5.4, 5.6, 4, 4.2], [4.1, 7.2, 3.9, 4.4]]],
    bull_engulf: ['Bullish Engulfing', 'bull', 'A green candle completely swallows the previous red one. Buyers took control.', [[8, 8.2, 6.6, 6.8], [6.8, 7, 5.2, 5.4], [5.4, 5.6, 4.4, 4.6], [4.4, 6.4, 4.2, 6.2]]],
    piercing: ['Piercing Line', 'bull', 'After a red candle, a green candle closes above its midpoint. Selling is fading.', [[8, 8.2, 6.6, 6.8], [6.8, 7, 4.6, 4.8], [4.4, 6.2, 4.2, 6.0]]],
    morning_star: ['Morning Star', 'bull', 'Big red, small indecision candle, then strong green. Classic 3-candle bottom.', [[8.5, 8.7, 7.2, 7.4], [7.4, 7.6, 4.8, 5], [4.6, 5, 4, 4.5], [4.6, 7.2, 4.5, 7]]],
    bull_harami: ['Bullish Harami', 'bull', 'A small green candle inside a big red one. Selling pressure is pausing.', [[8.5, 8.7, 7.2, 7.4], [7.4, 7.6, 4, 4.2], [4.8, 6, 4.6, 5.8]]],
    three_soldiers: ['Three White Soldiers', 'bull', 'Three strong green candles in a row. Steady, determined buying.', [[6, 6.2, 4.6, 4.8], [4.8, 6.1, 4.7, 6], [5.6, 7.3, 5.5, 7.2], [6.8, 8.5, 6.7, 8.4]]],
    marubozu_bull: ['Bullish Marubozu', 'bull', 'A big green candle with almost no wicks. Buyers in full control the whole time.', [[5, 5.4, 4.6, 5.2], [5.2, 5.5, 4.9, 5], [4.9, 8.2, 4.9, 8.2]]],
    shooting_star: ['Shooting Star', 'bear', 'Buyers pushed price up but sellers slammed it back down. Possible top after a rise.', [[3, 4.4, 2.8, 4.2], [4.2, 5.8, 4, 5.6], [5.6, 7, 5.4, 6.8], [6.9, 9.6, 6.6, 6.7]]],
    hanging_man: ['Hanging Man', 'bear', 'Hammer shape but after a rise. Warning that buyers are getting tired.', [[3, 4.4, 2.8, 4.2], [4.2, 5.8, 4, 5.6], [5.6, 7, 5.4, 6.8], [7.2, 7.4, 4.4, 6.9]]],
    bear_engulf: ['Bearish Engulfing', 'bear', 'A red candle completely swallows the previous green one. Sellers took control.', [[3, 4.4, 2.8, 4.2], [4.2, 5.8, 4, 5.6], [5.6, 6.6, 5.4, 6.4], [6.6, 6.8, 4.8, 5]]],
    dark_cloud: ['Dark Cloud Cover', 'bear', 'After a green candle, a red candle closes below its midpoint. Buying is fading.', [[3, 4.4, 2.8, 4.2], [4.2, 6.6, 4, 6.4], [6.7, 6.9, 4.9, 5.1]]],
    evening_star: ['Evening Star', 'bear', 'Big green, small indecision candle, then strong red. Classic 3-candle top.', [[2, 3.4, 1.8, 3.2], [3.2, 5.8, 3, 5.6], [5.9, 6.6, 5.6, 6.1], [6, 6.1, 3.4, 3.6]]],
    bear_harami: ['Bearish Harami', 'bear', 'A small red candle inside a big green one. Buying pressure is pausing.', [[2, 3.4, 1.8, 3.2], [3.2, 6.6, 3, 6.4], [5.8, 6, 4.4, 4.6]]],
    three_crows: ['Three Black Crows', 'bear', 'Three strong red candles in a row. Steady, determined selling.', [[4, 5.6, 3.8, 5.4], [5.4, 5.5, 4, 4.1], [4.4, 4.5, 2.8, 2.9], [3.2, 3.3, 1.6, 1.7]]],
    marubozu_bear: ['Bearish Marubozu', 'bear', 'A big red candle with almost no wicks. Sellers in full control the whole time.', [[5, 5.4, 4.6, 5.2], [5.2, 5.5, 4.9, 5], [5, 5, 1.8, 1.8]]],
    doji: ['Doji', 'neutral', 'Open and close almost equal. Buyers and sellers are balanced - indecision. Wait for the next candle.', [[4, 5.4, 3.8, 5.2], [5.2, 6.4, 5, 6.2], [6.2, 7.8, 4.8, 6.25]]],
  };
  const TF_LABEL = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': 'Daily', '1wk': 'Weekly' };
  const narrow = () => window.innerWidth < 480;
  const tfShort = k => narrow() ? { '1d': 'D', '1wk': 'W' }[k] || TF_LABEL[k] : TF_LABEL[k];
  const TF_ORDER = ['15m', '1h', '4h', '1d', '1wk'];

  // ---------------------------------------------------------------- state
  const S = { mode: 'xtb', tv: {}, summary: null, patterns: {}, side: 'buy', ctf: '1d', shown: 50, f: {}, chart: null, detailCache: {}, back: '#/cfd' };
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const safeId = x => x.replace(/[^A-Za-z0-9_\-]/g, '_');
  const pct = (v, d = 1) => v == null ? '–' : (v > 0 ? '+' : '') + v.toFixed(d) + '%';
  const money = v => v == null ? '–' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0);
  function ago(iso) {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
  }
  function meter(v, col) { return `<span class="meter"><i style="width:${v || 0}%;background:${col}"></i></span>`; }
  const isStockLike = r => r.ty === 'Stocks' || r.ty === 'ETFs';
  const inv = r => (r.d && r.d.inv) ? r.d.inv.score : null;
  // daily trading size in US dollars: the scan stores it in the quote currency, and London shares are
  // quoted in pence (100x too big). Rough rates are enough to sort big from small. Mirrors engine/money.py
  const USD_RATE = { USD: 1, EUR: 1.16, GBP: 1.33 / 100, CHF: 1.25, SEK: 0.105, NOK: 0.10, DKK: 0.155, CZK: 0.047, THB: 0.03, PLN: 0.27 };
  const lqUsd = r => (r.d && r.d.lq != null) ? r.d.lq * (USD_RATE[r.cur || 'USD'] ?? 1) : null;
  const bySize = (a, b) => (lqUsd(b) || 0) - (lqUsd(a) || 0);
  // every list shows everything, in size groups: big well-known names first, unknown size last.
  // forex, indices, commodities and crypto are big markets, so they sit in the first group
  const TIERS = ['Big, well-known names · trade over $50 million a day', 'Medium · $5–50 million a day',
    'Small and thinly traded · under $5 million a day · prices jump, spreads are wide', 'Trading size unknown · treat as small'];
  const sizeTier = r => { if (!isStockLike(r)) return 0; const v = lqUsd(r); return v == null ? 3 : v >= 5e7 ? 0 : v >= 5e6 ? 1 : 2; };
  const tierHead = (t, n) => `<div class="tierhead t${t}">${esc(TIERS[t])}<span>${n.toLocaleString()}</span></div>`;
  // render rows with a heading each time the size group changes
  function tiered(items, rowOf, rOf = x => x) {
    const cnt = [0, 0, 0, 0]; items.forEach(x => cnt[sizeTier(rOf(x))]++);
    let last = -1;
    return items.map(x => { const t = sizeTier(rOf(x)), h = t !== last ? tierHead(t, cnt[t]) : ''; last = t; return h + rowOf(x); }).join('');
  }
  // money-market / overnight-rate / very short bond funds rise a few cents almost every week:
  // "rose 100% of the time" is true and useless, so they never get BUY or SELL
  const cashLike = r => r.ty === 'ETFs' && r.d && r.d.inv && r.d.inv.vol != null && r.d.inv.vol < 2;
  const ALL = 1e9;  // lists show everything
  function tfData(r, tf) { return tf === '1d' ? r.d : tf === '1wk' ? r.w : (r.i && r.i[tf]); }
  const isTV = () => S.mode === 'tv';
  const tvSym = x => S.tv[x] || '';
  const tvLive = x => { const t = tvSym(x); return t.includes(':') ? t : ''; };  // has a live price feed
  const shownSym = r => isTV() ? (tvSym(r.x) || r.x) : r.x;
  const tvLink = x => 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(tvSym(x) || x);
  const inMode = r => isTV() || !r.tvo;   // Thai SET stocks only exist in TradingView mode
  const tradable = r => isTV() || r.cfd;  // XTB lists are about CFDs; TradingView lists use everything
  // Forex, indices and commodities close from Friday 22:00 to Sunday 21:00 UTC; crypto never closes
  const weekend = () => { const n = new Date(), d = n.getUTCDay(), h = n.getUTCHours(); return d === 6 || (d === 0 && h < 21) || (d === 5 && h >= 22); };
  const isOpen = r => r.ty === 'Crypto' || !weekend();

  // ---------------------------------------------------------------- boot
  async function boot() {
    const choice = store.get('mode', null);
    if (choice) { S.mode = choice; showApp(); } else $('#start').classList.remove('hidden');
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      if ($('#remember').checked) store.set('mode', b.dataset.mode);
      S.mode = b.dataset.mode;
      showApp();
    }));
    window.addEventListener('hashchange', route);
  }

  async function showApp() {
    $('#start').classList.add('hidden'); $('#app').classList.remove('hidden');
    $('#modeSwitch').onclick = () => { store.set('mode', null); location.hash = ''; location.reload(); };
    $('#modeName').textContent = isTV() ? 'TradingView mode' : 'XTB mode';
    $('#view').innerHTML = '<div class="empty">Loading the latest data…</div>';
    try {
      const [sum, pats, tv, od] = await Promise.all([fetchJSON('data/summary.json'), fetchJSON('data/patterns.json').catch(() => ({})), fetchJSON('tv.json').catch(() => ({})), fetchJSON('data/odds.json').catch(() => null)]);
      S.summary = unslim(sum); S.patterns = pats; S.tv = tv; S.odds = od;
    } catch (e) {
      $('#view').innerHTML = `<div class="empty">Could not load the data (${esc(e.message)}).<br>If the site was just created, the first scan may still be running - try again in a few minutes.</div>`;
      return;
    }
    showUpdated();
    if (narrow()) { $('#modeSwitch').textContent = '⇄'; $('#modeSwitch').setAttribute('aria-label', 'Switch platform'); }
    Live.start();
    route();
    setInterval(showUpdated, 30000);
    setInterval(refreshSummary, 5 * 60000);
  }

  function showUpdated() {
    if (!S.summary) return;
    $('#updated').textContent = (narrow() ? 'Scan ' : 'Scanned ') + ago(S.summary.generated);
    $('#updated').title = `Signals last rescanned: ${new Date(S.summary.generated).toLocaleString()}\nFull scan: ${S.summary.full_scan || '-'}\nFast scan: ${S.summary.fast_scan || '-'}`;
  }

  // pick up a new scan without a page reload (only redraw lists, never yank an open chart away)
  async function refreshSummary() {
    if (document.hidden) return;
    try {
      const sum = await fetchJSON('data/summary.json?t=' + Date.now());
      if (sum.generated === S.summary.generated) return;
      S.summary = unslim(sum); showUpdated();
      S.odds = await fetchJSON('data/odds.json?t=' + Date.now()).catch(() => S.odds);
      if ($('#board')) renderBoard(); else if ($('#rows')) renderRows(); else if ($('#oddsList')) { S.osig = ''; renderProb(); } else if ($('#srows')) renderSearch();
    } catch (e) { /* keep showing what we have */ }
  }

  async function fetchJSON(url) {
    const r = await fetch(url + (url.includes('?') ? '' : '?v=' + Math.floor(Date.now() / 300000)));
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  }

  const hasData = r => !r.nd && r.d && r.d.p != null;

  // ---------------------------------------------------------------- data clean-up
  // run.py write_summary() stores repeated words as codes; this puts them back
  const GRADES = ['Too few examples to judge', 'Historically reliable', 'Slight edge (could be luck)', 'No real edge'];
  const BT_KEYS = ['b', 'bn', 'bg', 's', 'sn', 'sg', 'base'];
  function fatT(t) {
    if (t && Array.isArray(t.bt)) {
      const o = {};
      BT_KEYS.forEach((k, i) => { const v = t.bt[i]; o[k] = (k === 'bg' || k === 'sg') && typeof v === 'number' ? GRADES[v] : v; });
      t.bt = o;
    }
    return t;
  }
  function unslim(sum) {
    for (const r of sum.rows) {
      r.d = fatT(r.d || {});
      if (r.i) Object.values(r.i).forEach(fatT);
      if (r.y == null) r.y = r.x;
      r.cfd = !!r.cfd; r.real = !!r.real;
    }
    return sum;
  }

  // ---------------------------------------------------------------- search that forgives spelling
  // "s&p", "sp500", "S&P 500" and "us500" all find the same row; extra names for the big markets
  const ALIAS = {
    US500: 'sp500 spx standard poors', US100: 'nasdaq ndx tech', US30: 'dow djia', US2000: 'russell small caps',
    DE40: 'dax germany', UK100: 'ftse britain', FRA40: 'cac france', JP225: 'nikkei japan', EU50: 'stoxx europe',
    GOLD: 'xau xauusd', SILVER: 'xag xagusd', OIL: 'brent crude', 'OIL.WTI': 'wti crude oil usoil', NATGAS: 'natural gas',
    BITCOIN: 'btc btcusd', ETHEREUM: 'eth ether', SOLANA: 'sol', RIPPLE: 'xrp', DOGECOIN: 'doge', BINANCECOIN: 'bnb',
    USDIDX: 'dxy dollar index', VIX: 'volatility fear', TNOTE: 'bond treasury 10 year', SHIBA: 'shib', TONCOIN: 'ton',
  };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function searchKey(r) {
    const k = norm([r.n, r.x, r.x.replace(/\.[A-Z]+$/, ''), tvSym(r.x), ALIAS[r.x] || '', r.ty, r.m].join(' '));
    return ' ' + k + ' ' + k.replace(/ /g, '') + ' ';
  }
  function matcher(q) {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return () => true;
    const glued = words.join('');
    // "s&p" -> "s p": single letters only make sense glued together ("sp")
    const loose = words.some(w => w.length < 2);
    return r => {
      const k = r._k || (r._k = searchKey(r));
      return (!loose && words.every(w => k.includes(' ' + w) || (w.length > 2 && k.includes(w)))) || (glued.length > 1 && k.includes((loose ? ' ' : '') + glued));
    };
  }

  // ---------------------------------------------------------------- the BUY / SELL / WAIT word
  // Every row gets ONE word from probability: how often price went each way after past
  // moments that looked like today on the same instrument. BUY / SELL only when it went that way
  // at least 60 times in 100, at least 5 more than normal, gained on average, and is unlikely to be luck.
  const WIN_MIN = 60;
  const MARGIN = 5;   // must beat normal by at least 5 points: shares rise most of the time anyway
  const Z_MIN = 1;
  const MIN_MOVE = 0.5;  // % typical move on the Daily-chart odds, below this a win is too small to matter    // and be unlikely to be luck (about 5 in 6 sure, counting overlapping windows honestly)
  const INV_SELL_MIN = 55;  // shares drift up over months, so falling 55 times in 100 is already unusually bad
  // overlapping windows (a 3-month check every 3 days) are not independent, so the luck test
  // counts them as fewer times
  const nEff = (n, sp, h) => Math.max(1, n * Math.min(1, sp / h));
  const D_LABEL = ['1 week later', '1 month later', '3 months later'];
  const D_SHORT = ['about 1 week', 'about 1 month', 'about 3 months'];

  // the one rule for BUY / SELL: often enough, clearly more often than normal, and gained on average
  const strong = (p, base, minP, fav) => p >= minP && (base == null || p >= base + MARGIN) && fav > 0;

  function dailyEval(r, side, ks, minP) {
    const od = r.d && r.d.od;
    if (!od || !od.c || !od.c[0]) return null;
    const buy = side === 'buy';
    const cells = od.c.map((c, k) => {
      if (!c) return null;
      const n = c[0], wins = buy ? c[1] : c[2], p = wins / n * 100, fav = buy ? c[3] : -c[3];
      const base = od.b[k] ? od.b[k][buy ? 0 : 1] : null;
      return { k, n, wins, p, fav, base, z: luckZ(p, base, nEff(n, od.sp, od.hz[k])), label: D_LABEL[k], short: D_SHORT[k],
        typ: buy ? c[4] : c[5], stop: buy ? c[6] : c[7], worst: null,
        // cash-like funds (T-bill ETFs) rise almost every week by tiny amounts: nothing to trade
        good: ks.includes(k) && strong(p, base, minP, fav) && (buy ? c[4] : c[5]) != null && Math.abs(buy ? c[4] : c[5]) >= MIN_MOVE };
    });
    cells.forEach(x => { if (x && x.good && (x.z < Z_MIN || cashLike(r))) x.good = false; });
    const best = cells.filter(x => x && x.good).sort((a, b) => b.z - a.z || b.p - a.p)[0] || null;
    return { src: 'd', L: od.L, cells, best, n: cells[0].n, live: false };
  }

  // ctx: 'h' (hourly odds, any horizon) / 'h0' 'h1' 'h2' (one horizon) / 'days' (1 week - 1 month) / 'inv' (1 - 3 months)
  function decide(r, ctx) {
    if (!hasData(r)) return { word: 'none' };
    let b = null, s = null, from = ctx;
    if (ctx[0] === 'h') {
      const ks = ctx === 'h' ? [0, 1, 2] : [+ctx[1]];
      if (S.odds && S.odds.rows && S.odds.rows[r.x]) {
        b = oddsEval(r, 'buy', ks); s = oddsEval(r, 'sell', ks);
        if (!b.st) { b = s = null; }
      }
      if (!b) { from = 'days'; ctx = 'days'; }
    }
    if (ctx === 'days') { b = dailyEval(r, 'buy', [0, 1], WIN_MIN); s = dailyEval(r, 'sell', [0, 1], WIN_MIN); }
    if (ctx === 'inv') { b = dailyEval(r, 'buy', [1, 2], WIN_MIN); s = dailyEval(r, 'sell', [1, 2], INV_SELL_MIN); }
    if (!b && !s) return { word: 'none', from };
    // selling a real share you do not own is impossible, and on XTB only CFDs can be sold first
    const canSell = ctx === 'inv' || isTV() || r.cfd;
    const bb = b && b.best, sb = canSell && s && s.best;
    if (bb && (!sb || bb.z >= sb.z)) return { word: 'buy', ev: b, c: bb, from };
    if (sb) return { word: 'sell', ev: s, c: sb, from };
    return { word: 'wait', ev: b || s, from };
  }

  function decBadge(dec, ctx, small) {
    const inv = ctx === 'inv';
    const W = { buy: 'BUY', sell: inv ? 'SELL' : 'SELL', wait: 'WAIT', none: 'NO ODDS' }[dec.word];
    const tip = { buy: 'Past moments like today were usually followed by a rise.', sell: inv ? 'Past moments like today were usually followed by a fall. If you own it, consider selling or protecting it with a stop.' : 'Past moments like today were usually followed by a fall. A CFD sell gains when price falls.',
      wait: 'No clear edge: after past moments like today price went up and down about as often as normal.', none: 'Not enough past history that looked like today to count.' }[dec.word];
    let sub = '';
    if (dec.c) sub = `${dec.word === 'buy' ? 'rose' : 'fell'} ${Math.round(dec.c.p)}% of the time · ${dec.c.short || dec.c.label}${inv && dec.word === 'sell' ? ' · if you own it' : ''}`;
    else if (dec.word === 'wait') sub = 'no clear edge right now';
    else sub = 'not enough history';
    return `<span class="dec ${dec.word}${small ? ' sm' : ''}" title="${esc(tip)}">${W}</span>${small ? '' : `<span class="decsub">${esc(sub)}</span>`}`;
  }

  // ---------------------------------------------------------------- sections
  const CATS = {
    cfd: [['all', 'All'], ['Stocks', 'Stocks'], ['ETFs', 'ETFs'], ['Forex', 'Forex'], ['Indices', 'Indices'], ['Commodities', 'Commodities'], ['Crypto', 'Crypto']],
    inv: [['all', 'All'], ['Stocks', 'Stocks'], ['ETFs', 'ETFs']],
  };
  const SUBS = {
    cfd: [['now', 'Overview'], ['buy', '▲ Good for buying now'], ['sell', '▼ Good for selling now'], ['strong', 'Strong signals'], ['avoid', 'Avoid for now']],
    inv: [['buy', '▲ Good for buying now'], ['sell', '▼ Time to sell'], ['strong', 'Strong for investing'], ['weak', 'Weak for investing']],
  };
  const SEC_NAME = { cfd: 'CFD trading', inv: 'Investing' };
  const inSection = (r, sec) => inMode(r) && (sec === 'cfd' ? tradable(r) : isStockLike(r) && (isTV() || r.real));
  const F = sec => S.f[sec] || (S.f[sec] = { cat: store.get('cat_' + sec, 'all'), mkt: '', q: '' });
  function sectionPool(sec, opts = {}) {
    const f = F(sec), m = matcher(f.q);
    return S.summary.rows.filter(r => inSection(r, sec) && (opts.anyCat || f.cat === 'all' || r.ty === f.cat)
      && (!f.mkt || !isStockLike(r) || r.m === f.mkt) && (opts.noSearch || m(r)));
  }

  function navTabs(sec, sub) {
    const main = [['cfd', '📈 CFD trading', '#/cfd'], ['inv', '🏦 Investing', '#/inv'], ['search', '🔍 Search all', '#/search'],
      ['dict', '📖 Dictionary', '#/dict'], ['alerts', '🔔 Alerts', '#/alerts'], ['library', 'Pattern library', '#/library'], ['practice', 'Practice', '#/practice']];
    $('#tabs').innerHTML = main.map(([k, l, go]) => `<button class="tab main ${sec === k ? 'on' : ''}" data-go="${go}">${l}</button>`).join('');
    const subs = SUBS[sec];
    $('#subtabs').innerHTML = subs ? subs.map(([k, l]) => `<button class="tab ${sub === k ? 'on' : ''} ${k === 'buy' ? 'tb-up' : k === 'sell' ? 'tb-down' : ''}" data-go="#/${sec}/${k}">${l}</button>`).join('') : '';
    $('#subtabs').classList.toggle('hidden', !subs);
    document.querySelectorAll('#tabs [data-go], #subtabs [data-go]').forEach(b => b.onclick = () => { location.hash = b.dataset.go; });
  }

  // category chips + market + search, shared by every sub-tab of a section
  function filterBar(sec, onChange) {
    const f = F(sec);
    const base = S.summary.rows.filter(r => inSection(r, sec));
    const count = cat => cat === 'all' ? base.length : base.filter(r => r.ty === cat).length;
    const cats = CATS[sec].filter(([k]) => k === 'all' || count(k));
    const showMkt = f.cat === 'Stocks' || f.cat === 'ETFs' || sec === 'inv';
    const markets = showMkt ? [...new Set(base.filter(isStockLike).map(r => r.m))].sort() : [];
    const html = `<div class="filters">
        <div class="seg wrap cats" role="group" aria-label="Kind">${cats.map(([k, l]) => `<button data-cat="${k}" class="${f.cat === k ? 'on' : ''}">${l} <span class="cnt">${count(k).toLocaleString()}</span></button>`).join('')}</div></div>
      <div class="filters">
        <input class="fq" type="search" placeholder="Search name or symbol (e.g. Apple, AAPL, gold, bitcoin)…" aria-label="Search" value="${esc(f.q)}">
        ${markets.length > 1 ? `<select class="fm" aria-label="Stock market"><option value="">All stock markets</option>${markets.map(m => `<option ${f.mkt === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>` : ''}
      </div>`;
    const wire = () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { f.cat = b.dataset.cat; store.set('cat_' + sec, f.cat); if (!(f.cat === 'Stocks' || f.cat === 'ETFs' || sec === 'inv')) f.mkt = ''; route(); });
      const q = $('.fq'); if (q) q.oninput = e => { f.q = e.target.value; S.shown = ALL; onChange(); };
      const m = $('.fm'); if (m) m.onchange = e => { f.mkt = e.target.value; S.shown = ALL; onChange(); };
    };
    return { html, wire };
  }

  function route() {
    if (!S.summary) return;
    if (S.chart) { S.chart.destroy(); S.chart = null; }
    Live.want([]); Live.hook(null);
    const h = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').map(decodeURIComponent);
    window.scrollTo(0, 0);
    // old links keep working
    const OLD = { now: '#/cfd/now', 'odds/buy': '#/cfd/buy', 'odds/sell': '#/cfd/sell', 'list/cfd': '#/cfd/strong', 'list/avoid': '#/cfd/avoid',
      'list/inv_strong': '#/inv/strong', 'list/inv_weak': '#/inv/weak', 'list/all': '#/search', odds: '#/cfd/buy' };
    const old = OLD[h.slice(0, 2).join('/')] || OLD[h[0]];
    if (old) { location.replace(old); return; }
    if (h[0] === 'i' && h[1]) return viewInstrument(h[1], h[2] || '1d');
    if (h[0] === 'library') return viewLibrary(h[1] || '1d');
    if (h[0] === 'practice') return viewPractice();
    if (h[0] === 'search') { S.back = '#/search'; return viewSearch(); }
    if (h[0] === 'dict') return viewDict(h[1]);
    if (h[0] === 'alerts') { S.back = '#/alerts'; return viewAlerts(); }
    const sec = h[0] === 'inv' ? 'inv' : 'cfd';
    const sub = SUBS[sec].some(([k]) => k === h[1]) ? h[1] : store.get('sub_' + sec, sec === 'cfd' ? 'now' : 'buy');
    store.set('sub_' + sec, sub);
    S.back = `#/${sec}/${sub}`;
    viewSection(sec, sub);
  }

  const dl = (id, txt) => `<a class="dl" href="#/dict/${id}">${txt}</a>`;

  function viewSection(sec, sub) {
    S.sec = sec; S.sub = sub; S.shown = ALL;
    navTabs(sec, sub);
    if (sec === 'cfd' && sub === 'now') return viewBoard();
    if (sub === 'buy' || sub === 'sell') return viewProb(sec, sub);
    return viewList(sec, sub);
  }

  // ---------------------------------------------------------------- CFD overview board
  // Every CFD with one plain word for the chosen holding time - including the ones NOT worth trading now.
  const BTFS = ['15m', '1h', '4h', '1d'];
  const HIGHER = { '15m': '1h', '1h': '4h', '4h': '1d', '1d': '1wk' };
  const TF_CTX = { '15m': 'h0', '1h': 'h1', '4h': 'h2', '1d': 'days' };
  const HOLD = { '15m': 'about an hour', '1h': 'a few hours', '4h': 'about a day', '1d': 'days to weeks' };

  function verdict(t) {
    if (!t || t.b == null || t.s == null) return 'none';
    if (t.b >= 70 && t.s < 40) return 'buy';
    if (t.s >= 70 && t.b < 40) return 'sell';
    if (t.b >= 55 && t.b - t.s >= 20) return 'lbuy';
    if (t.s >= 55 && t.s - t.b >= 20) return 'lsell';
    return 'wait';
  }
  const dirOf = v => v === 'buy' || v === 'lbuy' ? 'up' : v === 'sell' || v === 'lsell' ? 'down' : '';

  function viewBoard() {
    S.btf = S.btf || store.get('btf', '1d');
    S.showN = { go: 30, lean: 20, wait: 12, none: 8 };
    const closed = weekend(), fb = filterBar('cfd', renderBoard);
    $('#view').innerHTML = `
      <p class="intro">Every CFD with one word: <b class="up">BUY</b>, <b class="down">SELL</b> or <b>WAIT</b>. The word comes from probability: what price did after past moments that looked like today on the same instrument
        (${dl('probability', 'how this works')}). Choose how long you plan to keep the trade open.
        ${closed ? '<br><span class="warn">It is the weekend: only crypto is trading. Other markets show Friday\'s close and reopen Sunday night (UTC).</span>' : ''}</p>
      ${fb.html}
      <div class="filters"><span class="faint" style="font-size:13px">I will hold the trade for</span>
        <div class="seg wrap" role="group" aria-label="Holding time">${BTFS.map(tf => `<button data-btf="${tf}" class="${S.btf === tf ? 'on' : ''}">${HOLD[tf]}</button>`).join('')}</div></div>
      <div id="board"></div>`;
    fb.wire();
    document.querySelectorAll('[data-btf]').forEach(b => b.onclick = () => { S.btf = b.dataset.btf; store.set('btf', S.btf); viewBoard(); });
    renderBoard();
  }

  function renderBoard() {
    const box = $('#board'); if (!box) return;
    const tf = S.btf, ctx = TF_CTX[tf];
    const groups = { go: [], lean: [], wait: [], none: [] };
    for (const r of sectionPool('cfd')) {
      const t = tfData(r, tf), v = verdict(t), dec = decide(r, ctx);
      const g = dec.word === 'buy' || dec.word === 'sell' ? 'go' : !hasData(r) ? 'none' : dirOf(v) ? 'lean' : dec.word === 'none' && !t ? 'none' : 'wait';
      groups[g].push({ r, t, v, dec, z: dec.c ? dec.c.z : 0, str: t && t.b != null ? Math.max(t.b, t.s) : 0 });
    }
    const order = (a, b) => (isOpen(b.r) - isOpen(a.r)) || (b.z - a.z) || (b.str - a.str) || bySize(a.r, b.r);
    Object.values(groups).forEach(g => g.sort(order));
    const SEC = {
      go: ['BUY or SELL now', '', `Price went this way at least ${WIN_MIN} times in 100 after past moments like today, at least ${MARGIN} more than on a normal day, and it is unlikely to be luck. Strongest evidence first.`],
      lean: ['👀 Signals point one way, odds not there yet', 'warn', 'The chart signals lean up or down, but in the past this look did not win often enough. Watch, do not rush.'],
      wait: ['⏸ Wait', '', 'No clear edge: price went up and down about as often as normal. Most traders skip these.'],
      none: ['No data yet', 'faint', 'No price history from our data source yet (new, renamed or delisted). The live price and TradingView chart may still work.'],
    };
    const html = Object.entries(groups).filter(([, g]) => g.length).map(([k, g]) => {
      const [title, cls, sub] = SEC[k];
      const capped = g.slice(0, S.showN[k]);
      return `<section class="bsec"><h3 class="${cls}">${title} <span class="cnt">${g.length.toLocaleString()}</span></h3><p class="faint bsub">${sub}</p>
        <div class="rows">${capped.map(boardRow).join('')}</div>
        ${capped.length < g.length ? `<button class="more" data-more="${k}">Show more (${(g.length - capped.length).toLocaleString()} left)</button>` : ''}</section>`;
    }).join('');
    box.innerHTML = html || '<div class="empty">Nothing matches. Try another kind or clear the search.</div>';
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${tf}`; });
    box.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { S.showN[b.dataset.more] += 50; renderBoard(); });
    Live.paint(); Live.poll();
  }

  function priceBox(r, extraNote) {
    const d = r.d || {}, price = r.live ? r.live.p : d.p, lt = tvLive(r.x);
    return `<div class="px num" ${lt ? `data-live="${esc(lt)}"` : ''}><span class="lp">${price != null ? chartFmt(price, decimalsOf(price)) : '–'}</span><div class="lc ${d.ch >= 0 ? 'up' : 'down'}" style="font-size:13px">${d.ch != null ? pct(d.ch, 2) : ''}</div>${extraNote || ''}</div>`;
  }

  // One plain sentence for a row: why the word is what it is (numbers from the odds)
  function reasonText(dec, sideHint) {
    if (dec.word === 'none') return 'Not enough similar past moments on this instrument to count, so no word yet.';
    if (dec.c) {
      const up = dec.word === 'buy';
      return `In the past, price was ${up ? 'higher' : 'lower'} ${dec.c.short.replace('about ', '')} later in <b>${Math.round(dec.c.p)} of 100</b> moments like this (on a normal day: ${Math.round(dec.c.base)}).`;
    }
    // WAIT: show the plain numbers, so it is clear why it is not a BUY or SELL
    const ev = dec.ev, cells = ev && ev.cells ? ev.cells.filter(Boolean) : [], c0 = cells[0];
    if (!c0) return 'No clear edge right now.';
    return `No clear edge: in the past, price was higher ${c0.short.replace('about ', '')} later in ${Math.round(c0.p)} of 100 moments like this (on a normal day: ${Math.round(c0.base)}). Too close to a coin flip.`;
  }

  // at most ONE warning, and only when something really disagrees with the word
  function cautionText(r, dec, t, tf) {
    const v = verdict(t), d = dirOf(v);
    if (dec.word === 'buy' && d === 'down') return 'The chart signals point down right now, against the odds. Smaller size, and use the stop.';
    if (dec.word === 'sell' && d === 'up') return 'The chart signals point up right now, against the odds. Smaller size, and use the stop.';
    if ((dec.word === 'buy' || dec.word === 'sell') && dec.c && dec.c.stop && dec.c.typ && Math.abs(dec.c.typ) / dec.c.stop < 0.5)
      return `The safe stop is ${(dec.c.stop / Math.abs(dec.c.typ)).toFixed(1)}× bigger than a typical ${dec.word === 'buy' ? 'rise' : 'fall'}, so one loss can cancel several wins.`;
    if (dec.word === 'buy' && t && t.r > 75) return `Already up a lot lately (RSI ${Math.round(t.r)}): buying now is buying late.`;
    if (dec.word === 'sell' && t && t.r < 25) return `Already down a lot lately (RSI ${Math.round(t.r)}): selling now is selling late.`;
    if (dec.word === 'wait' && d) return `The chart signals lean ${d}, but in the past that look did not win often enough here.`;
    return '';
  }

  function reasonHTML(r, dec, t, tf, sideHint) {
    const c = cautionText(r, dec, t, tf);
    return `<div class="reason">${reasonText(dec, sideHint)}</div>${c ? `<div class="caution">⚠ Careful: ${c}</div>` : ''}${isOpen(r) ? '' : '<div class="caution faint">Market closed for the weekend.</div>'}`;
  }

  function boardRow({ r, t, v, dec }) {
    const tf = S.btf;
    const dir = dec.word === 'buy' ? 'up' : dec.word === 'sell' ? 'down' : 'flat';
    return `<button class="row brow b-${dir}" data-x="${esc(r.x)}">
      <div class="name"><div class="decrow">${decBadge(dec, TF_CTX[tf], true)}<span class="rname">${esc(r.n)}</span><span class="sym">${esc(shownSym(r))}</span></div>
        <div class="faint meta">${esc(r.ty)}${isStockLike(r) ? ' · ' + esc(r.m) : ''}${dec.from === 'days' && TF_CTX[tf] !== 'days' && dec.word !== 'none' ? ' · odds from the Daily chart (no hourly odds for this one)' : ''}</div></div>
      ${priceBox(r)}
      <div class="why col">${reasonHTML(r, dec, t, tf, dirOf(v) === 'down' ? 'sell' : 'buy')}</div></button>`;
  }

  // ---------------------------------------------------------------- Good for buying / selling now
  // "The last times it looked like this". Hourly: each instrument's 1H chart described by 4 facts
  // (re-checked live every 15 s), counted over its last 6 months (engine/odds.py odds()).
  // Daily: 3 facts from the last closed daily candle, counted over all its history (odds_daily()).
  // lookOf() must stay identical to look_index() in engine/odds.py.
  const lookOf = i => (i.close > i.sma1 ? 12 : 0) + (i.close > i.sma4 ? 6 : 0) + (i.rsi < 40 ? 0 : i.rsi > 60 ? 4 : 2) + (i.macd > i.sig ? 1 : 0);
  const hzLabel = (o, k) => k === 0 ? '1 hour later' : k === 1 ? '4 hours later' : o.hz[2] >= 20 ? '1 day later' : '1 trading day later';
  const hzShort = (o, k) => k === 0 ? 'about 1 hour' : k === 1 ? 'about 4 hours' : o.hz[2] >= 20 ? 'about 1 day' : 'about 1 trading day';

  function lookText(L, rsi) {
    const up1 = L >= 12, up4 = Math.floor(L / 6) % 2 === 1, rb = Math.floor(L / 2) % 3, mom = L % 2 === 1;
    const r = rsi != null ? ' ' + Math.round(rsi) : '';
    return [
      `<span class="chip ${up1 ? 'g' : 'r'}">1H ${up1 ? 'above' : 'below'} its average</span>`,
      `<span class="chip ${up4 ? 'g' : 'r'}">4H ${up4 ? 'above' : 'below'} its average</span>`,
      `<span class="chip">RSI${r} ${['low (under 40)', 'middle (40–60)', 'high (over 60)'][rb]}</span>`,
      `<span class="chip ${mom ? 'g' : 'r'}">Momentum ${mom ? 'up' : 'down'}</span>`].join('');
  }
  function lookTextD(L) {
    const a50 = L >= 6, a200 = Math.floor(L / 3) % 2 === 1, rb = L % 3;
    return [
      `<span class="chip ${a50 ? 'g' : 'r'}">${a50 ? 'Above' : 'Below'} its 50-day average</span>`,
      `<span class="chip ${a200 ? 'g' : 'r'}">${a200 ? 'Above' : 'Below'} its 200-day average</span>`,
      `<span class="chip">RSI ${['low (under 40)', 'middle (40–60)', 'high (over 60)'][rb]}</span>`].join('');
  }

  function oddsEval(r, side, ks = [0, 1, 2]) {
    const o = S.odds.rows[r.x], lt = tvLive(r.x), c = lt && Live.q[lt];
    let L = o.look, live = false, rsi = null;
    if (c && c.ind && c.p != null && Live.fresh()) { L = lookOf({ ...c.ind, close: c.p }); live = true; rsi = c.ind.rsi; }
    const st = o.st[L];
    if (!st) return { L, live, rsi, st: null };
    const n = st[0], sp = S.odds.spacing || 4;
    const cells = [0, 1, 2].map(k => {
      const h = st[k + 1], wins = side === 'buy' ? h[0] : h[1], p = wins / n * 100, fav = side === 'buy' ? h[2] : -h[2];
      const base = o.base[k] ? o.base[k][side === 'buy' ? 0 : 1] : null, z = luckZ(p, base, nEff(n, sp, o.hz[k]));
      return { k, n, wins, p, fav, base, z, label: hzLabel(o, k), short: hzShort(o, k),
        good: ks.includes(k) && strong(p, base, WIN_MIN, fav) && z >= Z_MIN && (side === 'buy' ? h[3] : h[4]) != null,
        typ: side === 'buy' ? h[3] : h[4], stop: side === 'buy' ? h[5] : h[6], worst: side === 'buy' ? h[7] : h[8] };
    });
    if (cashLike(r)) cells.forEach(x => { x.good = false; });
    const best = cells.filter(x => x.good).sort((a, b) => b.z - a.z || b.p - a.p)[0] || null;
    return { src: 'h', L, live, rsi, st, n, cells, best };
  }

  // could a result this good happen by luck, compared with what price normally did?
  // z = how many standard errors the win rate sits above normal (1.65 = about 95% sure)
  function luckZ(p, base, n) {
    const p0 = Math.min(Math.max((base != null ? base : 50) / 100, 0.05), 0.95);
    return (p / 100 - p0) / Math.sqrt(p0 * (1 - p0) / n);
  }
  function luckChip(c) {
    const p0 = Math.min(Math.max((c.base != null ? c.base : 50) / 100, 0.05), 0.95);
    return c.z >= 1.65 ? `<span class="chip g" title="Clearly better than normal (${Math.round(p0 * 100)}%) - about 95% sure it is not luck.">Passes the luck test</span>`
      : `<span class="chip y" title="Normally price went this way ${Math.round(p0 * 100)}% of the time. With this many past times, a result like this can still happen by luck.">Could still be luck</span>`;
  }
  function rrChip(typ, stop) {
    const rr = Math.abs(typ) / stop;
    if (rr < 0.5) return `<span class="chip y" title="When it went your way it usually moved ${Math.abs(typ).toFixed(2)}%, but the stop is ${stop.toFixed(2)}% away. One stopped-out trade can wipe out several wins.">Stop is ${(1 / rr).toFixed(1)}× bigger than the typical gain</span>`;
    return `<span class="chip" title="Typical gain when it went your way, compared with the stop distance">Typical gain vs stop: ${rr.toFixed(1)} : 1</span>`;
  }

  function viewProb(sec, side) {
    const buy = side === 'buy', inv = sec === 'inv', closed = weekend();
    S.hold = S.hold || store.get('hold', 'days');
    const hours = !inv && S.hold === 'hours';
    if (hours && !(S.odds && S.odds.rows)) { S.hold = 'days'; }
    const fb = filterBar(sec, renderProb);
    const what = inv ? (buy ? 'a RISE over the next 1–3 months' : 'a FALL over the next 1–3 months') : (buy ? 'a RISE' : 'a FALL');
    $('#view').innerHTML = `
      <p class="intro"><b class="${buy ? 'up' : 'down'}">Where past moments like today were usually followed by ${what}.</b>
        ${!inv && !buy ? 'A CFD sell gains when the price falls.' : ''}
        ${inv && !buy ? 'For shares you already own: these usually fell afterwards, so think about selling or protecting them with a ' + dl('stop-loss', 'stop loss') + '. (You cannot sell shares you do not own.)' : ''}
        <span class="warn">This is what happened before, not a promise. ${inv ? '' : 'Set the stop loss shown in XTB when you open the trade.'}</span>
        ${closed && !inv ? '<br><span class="warn">Weekend: only crypto is trading. Other markets are listed last.</span>' : ''}</p>
      ${!inv ? `<div class="filters"><span class="faint" style="font-size:13px">I will hold the trade for</span><div class="seg" role="group" aria-label="Holding time">
        <button data-hold="hours" class="${S.hold === 'hours' ? 'on' : ''}">hours (1H chart)</button><button data-hold="days" class="${S.hold === 'days' ? 'on' : ''}">days to weeks (Daily chart)</button></div></div>` : ''}
      <details class="how"${store.get('howOpen', true) ? ' open' : ''}><summary>How it works</summary><p class="intro">${probHow(inv, S.hold === 'hours' && !inv, buy)}</p></details>
      ${fb.html}
      <div id="oddsStatus" class="countbar faint"></div>
      <div class="rows" id="oddsList"></div>`;
    fb.wire();
    document.querySelectorAll('[data-hold]').forEach(b => b.onclick = () => { S.hold = b.dataset.hold; store.set('hold', S.hold); route(); });
    $('.how').ontoggle = e => store.set('howOpen', e.target.open);
    if (S.hold === 'hours' && !inv) {
      Live.want(sectionPool(sec, { anyCat: true, noSearch: true }).filter(r => S.odds.rows[r.x]).map(r => tvLive(r.x)).filter(Boolean));
      Live.hook(() => { if ($('#oddsList')) renderProb(); });
    }
    S.osig = '';
    renderProb();
    Live.poll();
  }

  function probHow(inv, hours, buy) {
    const thr = inv && !buy ? INV_SELL_MIN : WIN_MIN;
    if (hours) return `Right now each instrument's 1H chart is described by 4 simple facts (shown on each row). We look back over the <b>last ${S.odds.months} months</b> of the same instrument,
      find every hour with the same 4 facts, and count what price did <b>1 hour, 4 hours and 1 day later</b>. The facts are re-checked live every 15 seconds (crypto prices every second).
      Only the ${Object.keys(S.odds.rows).length} instruments on the fast-watch list have hourly odds.`
      + ` Listed when price went your way <b>at least ${thr} times in 100</b>, at least ${MARGIN} more than ${dl('base-rate', 'normal')}, ${buy ? 'rose' : 'fell'} on average, and ${dl('luck-test', 'is unlikely to be luck')}. Best evidence at the top.`;
    return `Today each instrument's <b>Daily chart</b> is described by 3 simple facts (above or below its 50-day and 200-day averages, and its ${dl('rsi', 'RSI')}). We look back over <b>all its history (up to about 8 years)</b>,
      find every day with the same 3 facts, and count what price did <b>1 week, 1 month and 3 months later</b>. ${inv ? 'Investing looks at 1 and 3 months.' : 'CFD trading looks at 1 week and 1 month.'}
      Listed when price went your way <b>at least ${thr} times in 100</b>, at least ${MARGIN} more than ${dl('base-rate', 'normal')}, ${buy ? 'rose' : 'fell'} on average, and ${dl('luck-test', 'is unlikely to be luck')}. Best evidence at the top.
      The facts update each time the instrument is rescanned (a few times a day).`;
  }

  function renderProb() {
    const box = $('#oddsList'); if (!box) return;
    const sec = S.sec, side = S.sub, inv = sec === 'inv', hours = !inv && S.hold === 'hours';
    const all = sectionPool(sec);
    const good = [], cnt = { live: 0, few: 0, other: 0 };
    for (const r of all) {
      if (!hasData(r)) { cnt.few++; continue; }
      if (!inv && side === 'sell' && !(isTV() || r.cfd)) continue;
      let e;
      if (hours) {
        if (!S.odds.rows[r.x]) continue;
        e = oddsEval(r, side);
        if (e.live) cnt.live++;
        if (!e.st) { cnt.few++; continue; }
      } else {
        e = inv ? dailyEval(r, side, [1, 2], side === 'sell' ? INV_SELL_MIN : WIN_MIN) : dailyEval(r, side, [0, 1], WIN_MIN);
        if (!e) { cnt.few++; continue; }
      }
      if (e.best) good.push({ r, e }); else cnt.other++;
    }
    // thinly traded shares (under 1M a day) jump around and have wide spreads: listed after the rest
    // big group: the most traded (best-known) names first; smaller groups: strongest odds first
    good.sort((a, b) => (sizeTier(a.r) - sizeTier(b.r)) || (isOpen(b.r) - isOpen(a.r))
      || (sizeTier(a.r) === 0 && isStockLike(a.r) && isStockLike(b.r) ? bySize(a.r, b.r) : 0)
      || (b.e.best.z - a.e.best.z) || (b.e.best.p - a.e.best.p));
    const liveTxt = !hours ? `From each instrument's last scan` : Live.fresh() ? `Facts checked live for ${cnt.live} instruments` : 'Live check not reachable - using the last scan (' + ago(S.odds.generated) + ')';
    $('#oddsStatus').innerHTML = `<span><b class="${side === 'buy' ? 'up' : 'down'}">${good.length.toLocaleString()}</b> ${side === 'buy' ? 'good for buying' : inv ? 'to sell' : 'good for selling'} now · ${cnt.other.toLocaleString()} with no clear edge · ${cnt.few.toLocaleString()} without enough history</span><span>${liveTxt}</span>`;
    const sig = good.slice(0, S.shown).map(g => g.r.x + ':' + g.e.L + ':' + g.e.best.k).join('|') + '#' + Live.fresh() + '#' + S.shown;
    if (sig === S.osig) { Live.paint(); return; }
    S.osig = sig;
    const shown = good.slice(0, S.shown);
    box.innerHTML = good.length ? tiered(shown, g => probRow(g, sec, side), g => g.r) + (good.length > shown.length ? `<button class="more" id="more">Show more (${(good.length - shown.length).toLocaleString()} left)</button>` : '')
      : `<div class="empty">Nothing is clearly ${side === 'buy' ? 'good for buying' : 'good for selling'} right now${F(sec).cat !== 'all' || F(sec).q ? ' with these filters' : ''}.
      That is normal. It changes as prices move${hours ? ', and this page re-checks by itself every 15 seconds' : ''}.</div>`;
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${hours ? '1h' : '1d'}`; });
    const m = $('#more'); if (m) m.onclick = () => { S.shown += 50; renderProb(); };
    Live.paint(); Fund.want();
  }

  function probRow({ r, e }, sec, side) {
    const buy = side === 'buy', inv = sec === 'inv', lt = tvLive(r.x), b = e.best, hourly = e.src === 'h';
    const c = lt && Live.q[lt], price = (c && c.p) || (r.live ? r.live.p : r.d.p), dp = decimalsOf(price);
    const lvl = f => `<b class="num" ${lt ? `data-lvl="${esc(lt)}" data-f="${f}"` : ''}>${chartFmt(price * f, dp)}</b>`;
    const stop = Math.max(b.stop || 0, 0.05), fs = buy ? 1 - stop / 100 : 1 + stop / 100, ft = 1 + (b.typ || 0) / 100;
    const dec = { word: side, c: b };
    const t = hourly ? tfData(r, '1h') : r.d;
    const extra = inv && lt && r.ty === 'Stocks' ? `<div class="why"><span class="fund" data-fund="${esc(lt)}"></span></div>` : '';
    return `<button class="row orow ${buy ? 'b-up' : 'b-down'}" data-x="${esc(r.x)}">
      <div class="name"><div class="decrow">${decBadge(dec, inv ? 'inv' : 'x', true)}<span class="rname">${esc(r.n)}</span><span class="sym">${esc(shownSym(r))}</span></div>
        <div class="faint meta">${esc(r.ty)}${isStockLike(r) ? ' · ' + esc(r.m) : ''} · based on ${e.n} similar past ${hourly ? 'hours' : 'days'}${hourly && e.live ? ' · checked live' : ''}</div></div>
      ${priceBox(r, `<div class="faint" style="font-size:11px;font-weight:400">${lt ? (lt.startsWith('BINANCE:') ? 'live · every second' : 'live price') : 'last scan price'}</div>`)}
      <div class="why col">${reasonHTML(r, dec, t, null, side)}</div>
      <div class="olevels">
        <div>${inv && !buy ? 'If you own it' : `If you ${buy ? 'buy' : 'sell'}`}, for ${b.short}:</div>
        <div><span class="down">${dl('stop-loss', 'Stop loss')}</span> ${lvl(fs)} <span class="faint">(${buy ? '−' : '+'}${stop.toFixed(2)}% · 8 of 10 past times never went that far against you)</span></div>
        <div><span class="up">Typical ${buy ? 'rise' : 'fall'}</span> to ${lvl(ft)} <span class="faint">(${pct(b.typ, 2)}) · not a promise</span></div>
      </div>${extra}
    </button>`;
  }

  // ---------------------------------------------------------------- simple lists (strong / weak / avoid)
  const LISTS = {
    'cfd/strong': {
      intro: () => `Instruments where several chart signals line up right now (signal score 70+ out of 100). <b>Buy side</b> = upward signals, <b>Sell side</b> = downward signals.
        Signals are not the same as odds: the word on each row (BUY / SELL / WAIT) says whether moments like this actually worked before. Daily and Weekly cover everything; 4H / 1H only the fast-watch list.`,
      filter: r => { const t = tfData(r, S.ctf); return t && (S.side === 'buy' ? t.b >= 70 : t.s >= 70); },
      sort: (a, b) => { const k = S.side === 'buy' ? 'b' : 's'; return (tfData(b, S.ctf)[k] - tfData(a, S.ctf)[k]) || bySize(a, b); },
    },
    'cfd/avoid': {
      intro: () => `CFDs with <b>no clear direction</b> on the Daily chart: both signal scores are under 40 and the odds show no edge. Trades here are close to a coin flip, so most traders wait.`,
      filter: r => r.d.b != null && r.d.b < 40 && r.d.s < 40 && decide(r, 'days').word === 'wait',
      sort: bySize,
    },
    'inv/strong': {
      intro: () => `Stocks and ETFs with a healthy long-term picture (months to years). Long-term trend score 0–100 from the 200-day average, 6- and 12-month performance, distance from the 52-week high and how wild the price moves. Only 70+ listed.
        Each stock also shows ${dl('company-health', 'company health')} (sales, profit, debt) from TradingView.`,
      filter: r => inv(r) >= 70,
      sort: (a, b) => (inv(b) - inv(a)) || bySize(a, b),
    },
    'inv/weak': {
      intro: () => 'Stocks and ETFs whose long-term picture is poor right now: below the 200-day average, lower than 6–12 months ago, far from their highs. Long-term trend score 30 or less. This is the price trend; check company health before deciding.',
      filter: r => inv(r) != null && inv(r) <= 30,
      sort: (a, b) => (inv(a) - inv(b)) || bySize(a, b),
    },
  };

  function viewList(sec, sub) {
    const key = sec + '/' + sub, T = LISTS[key];
    const fb = filterBar(sec, renderRows);
    const extra = key === 'cfd/strong' ? `<div class="filters">
      <div class="seg" role="group" aria-label="Side"><button data-side="buy" class="${S.side === 'buy' ? 'on' : ''}">▲ Buy side</button><button data-side="sell" class="${S.side === 'sell' ? 'on' : ''}">▼ Sell side</button></div>
      <div class="seg" role="group" aria-label="Chart">${['1h', '4h', '1d', '1wk'].map(tf => `<button data-ctf="${tf}" class="${S.ctf === tf ? 'on' : ''}">${TF_LABEL[tf]}</button>`).join('')}</div></div>` : '';
    $('#view').innerHTML = `<p class="intro">${T.intro()}</p>${fb.html}${extra}
      <div class="countbar"><span id="count" class="faint"></span><button class="copy" id="export" title="Download this list as a file you can import into a TradingView watchlist">⬇ TradingView watchlist</button></div>
      <div class="rows" id="rows"></div>`;
    fb.wire();
    $('#export').onclick = exportWatchlist;
    document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { S.side = b.dataset.side; route(); });
    document.querySelectorAll('[data-ctf]').forEach(b => b.onclick = () => { S.ctf = b.dataset.ctf; route(); });
    renderRows();
  }

  function currentList() {
    const T = LISTS[S.sec + '/' + S.sub];
    const list = sectionPool(S.sec).filter(r => { if (!hasData(r)) return false; try { return T.filter(r); } catch (e) { return false; } });
    list.sort((a, b) => (sizeTier(a) - sizeTier(b)) || T.sort(a, b));
    return list;
  }

  function exportWatchlist() {
    // TradingView's "Import list" reads comma-separated symbols; ###Name starts a section
    const list = currentList().map(r => tvLive(r.x)).filter(Boolean).slice(0, 1000);
    if (!list.length) return;
    const name = `Argie ${SEC_NAME[S.sec]} ${S.sub}${S.sub === 'strong' && S.sec === 'cfd' ? ` ${S.side} ${TF_LABEL[S.ctf]}` : ''}`;
    const blob = new Blob([`###${name},` + list.join(',')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    $('#export').textContent = `✓ ${list.length} symbols saved`;
    setTimeout(() => { const b = $('#export'); if (b) b.textContent = '⬇ TradingView watchlist'; }, 4000);
  }

  function renderRows() {
    if (!$('#rows')) return;
    const list = currentList();
    $('#count').textContent = `${list.length.toLocaleString()} match${list.length === 1 ? '' : 'es'}`;
    if (!list.length) { $('#rows').innerHTML = '<div class="empty">Nothing matches right now. Try another kind, chart or filter.</div>'; return; }
    $('#rows').innerHTML = tiered(list.slice(0, S.shown), rowHTML) +
      (list.length > S.shown ? `<button class="more" id="more">Show more (${(list.length - S.shown).toLocaleString()} left)</button>` : '');
    $('#rows').querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${S.sec === 'cfd' && S.sub === 'strong' ? S.ctf : '1d'}`; });
    const m = $('#more'); if (m) m.onclick = () => { S.shown += 50; renderRows(); };
    Live.paint(); Live.poll(); Fund.want();
  }

  function trendChip(tr) { return tr === 'up' ? '<span class="chip g">Uptrend</span>' : tr === 'down' ? '<span class="chip r">Downtrend</span>' : '<span class="chip">Sideways</span>'; }
  function patChips(pats) {
    return (pats || []).filter(p => p.dir !== 'neutral').slice(0, 2).map(p => `<span class="chip ${p.dir === 'bull' ? 'g' : 'r'}">${p.dir === 'bull' ? '▲' : '▼'} ${esc(PAT[p.id][0])}${p.ago ? ` (${p.ago} candle${p.ago > 1 ? 's' : ''} ago)` : ''}</span>`).join('');
  }
  function pastChip(bt, side) {
    if (!bt) return '';
    const w = side === 'buy' ? bt.b : bt.s, n = side === 'buy' ? bt.bn : bt.sn, g = side === 'buy' ? bt.bg : bt.sg;
    if (!n) return '';
    const base = side === 'buy' ? bt.base : (bt.base != null ? Math.round((100 - bt.base) * 10) / 10 : null);
    const cls = g === 'Historically reliable' ? 'g' : g === 'Slight edge (could be luck)' ? 'b' : g === 'No real edge' ? 'y' : '';
    return `<span class="chip ${cls}" title="${esc(g)}. When this signal fired before, how often did price then move its way?">This signal worked ${w}% of ${n} times (normal ${base}%)</span>`;
  }

  function rowHTML(r) {
    const d = r.d, key = S.sec + '/' + S.sub;
    let info = '', ctx = S.sec === 'inv' ? 'inv' : 'days', t = d, hint = 'buy';
    if (key === 'cfd/strong') {
      t = tfData(r, S.ctf);
      const sc = S.side === 'buy' ? t.b : t.s;
      ctx = { '1h': 'h1', '4h': 'h2' }[S.ctf] || 'days';
      hint = S.side;
      info = `<span class="chip" title="How many chart signals point this way, out of 100">${S.side === 'buy' ? '▲ Up' : '▼ Down'} signals ${sc}/100 on the ${TF_LABEL[S.ctf]} chart</span>`;
    } else if (S.sec === 'inv') {
      const v = d.inv;
      info = `<span class="chip">Long-term trend ${v.score}/100</span><span class="chip">12 months ${pct(v.ret12m)}</span><span class="chip">${v.from_high > -1 ? 'At its 52-week high' : pct(v.from_high) + ' from its 52-week high'}</span>
        ${tvLive(r.x) && r.ty === 'Stocks' ? `<span class="fund" data-fund="${esc(tvLive(r.x))}"></span>` : ''}`;
    } else if (key === 'cfd/avoid') {
      info = '<span class="chip">Signals mixed: none above 40/100</span>';
    }
    const dec = decide(r, ctx);
    return `<button class="row" data-x="${esc(r.x)}">
      <div class="name"><div class="decrow">${decBadge(dec, ctx, true)}<span class="rname">${esc(r.n)}</span><span class="sym">${esc(shownSym(r))}</span></div><div class="faint meta">${metaLine(r)}</div></div>
      ${priceBox(r)}<div class="why col">${reasonHTML(r, dec, t, null, hint)}</div>${info ? `<div class="why">${info}</div>` : ''}</button>`;
  }

  function metaLine(r) {
    const d = r.d || {};
    const tags = isTV() ? (r.tvo ? 'Thai SET (not on XTB)' : '') : [r.cfd ? 'CFD' : '', r.real ? 'Real shares' : ''].filter(Boolean).join(' + ');
    return `${esc(r.ty)} · ${esc(r.m)}${tags ? ' · ' + tags : ''}${lqUsd(r) ? ' · trades about $' + money(lqUsd(r)) + '/day' : ''}`;
  }

  // ---------------------------------------------------------------- search all
  function viewSearch() {
    navTabs('search');
    S.sq = S.sq || '';
    S.sty = S.sty || '';
    S.shown = ALL;
    const rows = S.summary.rows.filter(inMode);
    const types = [...new Set(rows.map(r => r.ty))].sort();
    const nd = rows.filter(r => !hasData(r)).length;
    $('#view').innerHTML = `<p class="intro">Every ${isTV() ? '' : 'XTB '}instrument we know: <b>${rows.length.toLocaleString()}</b>. Type a company name, ticker or nickname (Apple, AAPL, nasdaq, gold, btc).
        Each one shows two words: what the odds say for a <b>CFD trade</b> (days to weeks) and for <b>investing</b> (months).
        ${nd ? `<span class="faint">${nd.toLocaleString()} have no price history from our data source yet; they still show a live price and chart where TradingView has one.</span>` : ''}</p>
      <div class="filters"><input id="sq" type="search" placeholder="Search everything…" aria-label="Search everything" value="${esc(S.sq)}" autofocus></div>
      <div class="filters"><div class="seg wrap" role="group" aria-label="Kind"><button data-sty="" class="${S.sty ? '' : 'on'}">All</button>${types.map(t => `<button data-sty="${esc(t)}" class="${S.sty === t ? 'on' : ''}">${esc(t)}</button>`).join('')}</div></div>
      <div class="countbar"><span id="count" class="faint"></span></div>
      <div class="rows" id="srows"></div>`;
    $('#sq').oninput = e => { S.sq = e.target.value; S.shown = ALL; renderSearch(); };
    document.querySelectorAll('[data-sty]').forEach(b => b.onclick = () => { S.sty = b.dataset.sty; document.querySelectorAll('[data-sty]').forEach(o => o.classList.toggle('on', o === b)); S.shown = ALL; renderSearch(); });
    renderSearch();
  }

  function renderSearch() {
    const m = matcher(S.sq), q = norm(S.sq);
    const list = S.summary.rows.filter(r => inMode(r) && (!S.sty || r.ty === S.sty) && m(r));
    // exact symbol / name start first, then the most traded
    const g = q.replace(/ /g, '');
    const rank = r => {
      if (!q) return 3;
      const x = norm(r.x.replace(/\.[A-Z]+$/, '')).replace(/ /g, ''), n = norm(r.n), al = (ALIAS[r.x] || '').split(' ');
      return x === g || al.includes(g) ? 0 : n.startsWith(q) || n.replace(/ /g, '').startsWith(g) ? 1 : (' ' + n).includes(' ' + q) ? 2 : 3;
    };
    list.sort((a, b) => rank(a) - rank(b) || (q ? 0 : sizeTier(a) - sizeTier(b)) || hasData(b) - hasData(a) || bySize(a, b));
    $('#count').textContent = `${list.length.toLocaleString()} match${list.length === 1 ? '' : 'es'}`;
    if (!list.length) { $('#srows').innerHTML = `<div class="empty">Nothing found for "${esc(S.sq)}". Try fewer letters, the ticker (e.g. AAPL) or the company's main name.</div>`; return; }
    $('#srows').innerHTML = (q ? list.slice(0, S.shown).map(searchRow).join('') : tiered(list.slice(0, S.shown), searchRow)) + (list.length > S.shown ? `<button class="more" id="more">Show more (${(list.length - S.shown).toLocaleString()} left)</button>` : '');
    $('#srows').querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/1d`; });
    const mo = $('#more'); if (mo) mo.onclick = () => { S.shown += 50; renderSearch(); };
    Live.paint(); Live.poll();
  }

  function searchRow(r) {
    const d = r.d || {};
    const words = [];
    if (tradable(r)) words.push(`<span class="dlabel">CFD</span>${decBadge(decide(r, 'days'), 'days', true)}`);
    if (isStockLike(r) && (isTV() || r.real)) words.push(`<span class="dlabel">Investing</span>${decBadge(decide(r, 'inv'), 'inv', true)}`);
    const chips = hasData(r) ? (d.inv ? `<span class="chip">Long-term trend ${d.inv.score}/100</span>` : '')
      : '<span class="chip y">No price history from our data source yet: tap for the live chart</span>';
    return `<button class="row" data-x="${esc(r.x)}">
      <div class="name"><div class="decrow">${words.join('<span style="width:10px"></span>')}</div><span class="rname">${esc(r.n)}</span><span class="sym">${esc(shownSym(r))}</span><div class="faint" style="font-size:12px;font-weight:400">${metaLine(r)}</div></div>
      ${priceBox(r)}${chips ? `<div class="why">${chips}</div>` : ''}</button>`;
  }

  // ---------------------------------------------------------------- dictionary
  function viewDict(id) {
    navTabs('dict');
    const D = window.DICT || [];
    S.dq = id ? '' : (S.dq || '');
    S.dcat = id ? '' : (S.dcat || '');
    const cats = [...new Set(D.map(t => t.cat))];
    $('#view').innerHTML = `<p class="intro">Every word used on this site, in plain language: what it means, why it matters, and an everyday example. Tap a word anywhere on the site that is <a class="dl">underlined like this</a> to jump here.</p>
      <div class="filters"><input id="dq" type="search" placeholder="Search a word (e.g. stop loss, RSI, spread)…" aria-label="Search the dictionary" value="${esc(S.dq)}"></div>
      <div class="filters"><div class="seg wrap" role="group" aria-label="Topic"><button data-dcat="" class="${S.dcat ? '' : 'on'}">All topics</button>${cats.map(c => `<button data-dcat="${esc(c)}" class="${S.dcat === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div></div>
      <div id="dlist" class="dgrid"></div>`;
    const draw = () => {
      const m = norm(S.dq);
      const list = D.filter(t => (!S.dcat || t.cat === S.dcat) && (!m || norm(t.term + ' ' + (t.aka || '') + ' ' + t.plain).includes(m)));
      $('#dlist').innerHTML = list.length ? list.map(t => `<article class="card dterm${t.id === id ? ' hl' : ''}" id="d-${t.id}">
          <h3>${esc(t.term)}${t.aka ? ` <small>${esc(t.aka)}</small>` : ''}<span class="dcat">${esc(t.cat)}</span></h3>
          <p class="dplain">${t.plain}</p>
          <p class="dmore">${t.more}</p>
          <div class="dex"><b>Example</b> ${t.ex}</div>
          ${t.see ? `<div class="dsee">See also: ${t.see.map(s => { const o = D.find(x => x.id === s); return o ? `<a href="#/dict/${s}">${esc(o.term)}</a>` : ''; }).join(' · ')}</div>` : ''}
        </article>`).join('') : '<div class="empty">No word matches. Try a shorter search.</div>';
    };
    $('#dq').oninput = e => { S.dq = e.target.value; draw(); };
    document.querySelectorAll('[data-dcat]').forEach(b => b.onclick = () => { S.dcat = b.dataset.dcat; document.querySelectorAll('[data-dcat]').forEach(o => o.classList.toggle('on', o === b)); draw(); });
    draw();
    if (id) { const el = document.getElementById('d-' + id); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 30); }
  }

  // ---------------------------------------------------------------- alerts + report card
  async function viewAlerts() {
    navTabs('alerts');
    $('#view').innerHTML = '<div class="empty">Loading alerts…</div>';
    let al = [];
    try { al = await fetchJSON('data/alerts.json?t=' + Date.now()); } catch (e) { /* none yet */ }
    const byX = new Map(S.summary.rows.map(r => [r.x, r]));
    const items = al.slice().reverse().slice(0, 300).map(a => {
      const r = byX.get(a.x), now = r ? (r.live ? r.live.p : r.d.p) : null;
      const mv = now != null && a.price ? (now / a.price - 1) * 100 : null;
      const ok = mv == null ? null : a.side === 'buy' ? mv > 0 : mv < 0;
      return { a, r, now, mv, ok, age: (Date.now() - new Date(a.at)) / 864e5 };
    });
    const judged = items.filter(i => i.ok != null && i.age >= 1);
    const wins = judged.filter(i => i.ok).length;
    $('#view').innerHTML = `<p class="intro">Every time a signal score crossed 70, or a candle pattern that has worked before appeared at a support or resistance level, the scanner wrote it down here.
        The report card checks honestly how each alert did: the price when it fired compared with the latest price.
        ${''}Telegram messages to your phone start once the bot is set up.</p>
      <div class="grid2" style="margin:0 0 12px"><div class="card"><h3>Report card <small>alerts at least 1 day old</small></h3>
        ${judged.length ? `<div class="bigscore"><div><span class="muted">Went the alert's way</span><b class="num ${wins / judged.length >= 0.5 ? 'up' : 'down'}">${Math.round(wins / judged.length * 100)}%</b></div><div><span class="muted">Alerts checked</span><b class="num">${judged.length}</b></div></div>
        <div class="note">"Went its way" = a buy alert's price is higher now, a sell alert's is lower. It ignores stops and timing, so it is a rough guide, not a trading result. Around 50% means the alerts are no better than a coin flip.</div>` : '<p class="faint">Not enough alerts older than a day yet.</p>'}</div></div>
      <div class="rows">${items.length ? items.map(alertRow).join('') : '<div class="empty">No alerts yet.</div>'}</div>`;
    document.querySelectorAll('#view [data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${b.dataset.tf || '1d'}`; });
  }

  function alertRow({ a, r, now, mv, ok }) {
    const buy = a.side === 'buy';
    const what = a.kind === 'setup' ? `${buy ? 'Buy' : 'Sell'}-side signal score reached ${a.score} on the ${TF_LABEL[a.tf] || a.tf} chart`
      : `${PAT[a.pid] ? PAT[a.pid][0] : a.pid} pattern at a key level on the ${TF_LABEL[a.tf] || a.tf} chart`;
    const dp = a.price ? decimalsOf(a.price) : 2;
    return `<button class="row brow ${buy ? 'b-up' : 'b-down'}" data-x="${esc(a.x)}" data-tf="${esc(a.tf)}">
      <div class="name"><span class="dec ${buy ? 'buy' : 'sell'} sm">${buy ? 'BUY' : 'SELL'}</span> ${esc(a.n)}<span class="sym">${esc(r ? shownSym(r) : a.x)}</span>
        <div class="faint" style="font-size:12.5px;font-weight:400">${esc(what)} · ${ago(a.at)}</div></div>
      <div class="px num">${a.price ? chartFmt(a.price, dp) : '–'}<div class="faint" style="font-size:11px;font-weight:400">price at alert</div></div>
      <div class="why">${mv != null ? `<span class="chip ${ok ? 'g' : 'r'}">Since then: ${pct(mv, 2)} · ${ok ? 'went its way' : 'went against it'}</span><span class="chip">Latest ${chartFmt(now, dp)}</span>` : '<span class="chip">No latest price</span>'}</div></button>`;
  }

  // ---------------------------------------------------------------- company health (live from TradingView)
  const Fund = (() => {
    const URL_SCAN = 'https://scanner.tradingview.com/global/scan';
    const COLS = ['market_cap_basic', 'price_earnings_ttm', 'earnings_per_share_diluted_yoy_growth_ttm', 'total_revenue_yoy_growth_ttm', 'net_margin_ttm', 'debt_to_equity_fq', 'dividends_yield_current', 'sector'];
    const q = {}, pend = new Set();
    let timer = null;
    function want() {
      document.querySelectorAll('[data-fund]').forEach(e => { if (!(e.dataset.fund in q)) pend.add(e.dataset.fund); });
      if (pend.size) { clearTimeout(timer); timer = setTimeout(load, 150); }
      paint();
    }
    async function load() {
      const list = [...pend]; pend.clear();
      for (let i = 0; i < list.length; i += 300) {
        const part = list.slice(i, i + 300);
        try {
          const res = await fetch(URL_SCAN, { method: 'POST', body: JSON.stringify({ symbols: { tickers: part }, columns: COLS }) });
          const js = await res.json();
          for (const r of js.data || []) { const d = r.d; q[r.s] = { mc: d[0], pe: d[1], epsg: d[2], revg: d[3], nm: d[4], de: d[5], dy: d[6], sec: d[7] }; }
          part.forEach(k => { if (!(k in q)) q[k] = null; });
        } catch (e) { /* try again next time */ }
      }
      paint();
    }
    // five plain yes/no checks; missing numbers are skipped, not counted as bad
    function checks(f) {
      const out = [];
      if (f.revg != null) out.push({ ok: f.revg > 0, text: f.revg > 0 ? `Sales up ${f.revg.toFixed(0)}% in a year` : `Sales down ${Math.abs(f.revg).toFixed(0)}% in a year`, id: 'revenue-growth' });
      if (f.nm != null) out.push({ ok: f.nm > 0, text: f.nm > 0 ? `Profitable: keeps ${f.nm.toFixed(0)}% of sales as profit` : 'Losing money', id: 'profit-margin' });
      if (f.epsg != null) out.push({ ok: f.epsg > 0, text: f.epsg > 0 ? `Profit per share up ${f.epsg.toFixed(0)}% in a year` : `Profit per share down ${Math.abs(f.epsg).toFixed(0)}%`, id: 'eps' });
      if (f.de != null) out.push({ ok: f.de < 1.5, text: f.de < 0.5 ? `Low debt (${f.de.toFixed(2)}× equity)` : f.de < 1.5 ? `Moderate debt (${f.de.toFixed(2)}× equity)` : `High debt (${f.de.toFixed(1)}× equity)`, id: 'debt-to-equity' });
      if (f.pe != null && f.pe > 0) out.push({ ok: f.pe <= 35, text: f.pe <= 15 ? `Cheap vs profit (P/E ${f.pe.toFixed(0)})` : f.pe <= 35 ? `Fair price vs profit (P/E ${f.pe.toFixed(0)})` : `Expensive vs profit (P/E ${f.pe.toFixed(0)})`, id: 'pe-ratio' });
      return out;
    }
    function chips(f) {
      const c = checks(f);
      if (!c.length) return '';
      const ok = c.filter(x => x.ok).length;
      return `<span class="chip ${ok / c.length >= 0.7 ? 'g' : ok / c.length < 0.45 ? 'r' : 'y'}" title="${esc(c.map(x => (x.ok ? '✓ ' : '✗ ') + x.text).join('\n'))}">Company health ${ok}/${c.length}</span>`
        + c.slice(0, 3).map(x => `<span class="chip ${x.ok ? '' : 'y'}">${esc(x.text)}</span>`).join('') + (f.dy ? `<span class="chip">Dividend ${f.dy.toFixed(1)}% a year</span>` : '');
    }
    function paint() {
      document.querySelectorAll('[data-fund]').forEach(e => { const f = q[e.dataset.fund]; if (f === undefined || e.dataset.done === '1') return; e.innerHTML = f ? chips(f) : ''; e.dataset.done = '1'; e.style.display = 'contents'; });
    }
    return { want, q, checks, loadNow: async t => { if (!(t in q)) { pend.add(t); await load(); } return q[t]; } };
  })();
  function decimalsOf(p) { return p >= 1000 ? 2 : p >= 10 ? 2 : p >= 1 ? 4 : 6; }

  // ---------------------------------------------------------------- instrument view
  async function loadDetail(x) {
    if (S.detailCache[x]) return S.detailCache[x];
    const d = await fetchJSON(`data/detail/${safeId(x)}.json`);
    S.detailCache[x] = d; return d;
  }
  function decode(t) {
    // reverses compact() in run.py
    const k = Math.pow(10, t.dp), z = t.c, n = z.c.length, ts = [z.t0];
    for (const dt of z.dt) ts.push(ts[ts.length - 1] + dt * z.step);
    const C = new Array(n), O = new Array(n), H = new Array(n), L = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc = i === 0 ? z.c[0] : acc + z.c[i];
      C[i] = acc; O[i] = acc + z.o[i];
      H[i] = Math.max(O[i], C[i]) + z.h[i]; L[i] = Math.min(O[i], C[i]) - z.l[i];
    }
    return { t: ts, o: O.map(v => v / k), h: H.map(v => v / k), l: L.map(v => v / k), c: C.map(v => v / k), v: z.v, dp: t.dp };
  }

  // ---------------------------------------------------------------- instrument extras
  function noDataView(row) {
    const lt = tvLive(row.x), sym = isTV() ? (tvSym(row.x) || row.x) : row.x;
    $('#view').innerHTML = `
      <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '${S.back}')">← Back</button>
      <div class="ihead"><div><h2>${esc(row.n)}</h2><div class="faint" style="font-size:13px">${metaLine(row)}</div></div>
        <div ${lt ? `data-live="${esc(lt)}"` : ''}><span class="big num lp">–</span> <span class="lc num"></span><div class="faint lnote" style="font-size:12.5px">${lt ? 'Waiting for live price…' : ''}</div></div>
        <div class="spacer"></div>
        <div class="symbox"><span class="faint" style="font-size:13px">${isTV() ? 'TradingView' : 'XTB'} symbol</span> <b>${esc(sym)}</b>
          <a class="copy" href="${tvLink(row.x)}" target="_blank" rel="noopener">Open in TradingView ↗</a></div></div>
      <div class="card" style="margin-bottom:12px"><b>No price history from our data source (Yahoo Finance) for this one yet.</b>
        <div class="note" style="font-size:13.5px">So there are no signals or odds for it. Usually it is newly listed, renamed, delisted, or listed under a different code. The scanner tries other codes once a week.
        You can still check it in the XTB app${lt ? ' and on the live TradingView chart below' : ''}.</div></div>
      ${tvSym(row.x) ? '<div class="tvbox" id="tvchart"></div>' : ''}`;
    if (tvSym(row.x)) tvWidget($('#tvchart'), row.x, '1d');
    Live.paint(); Live.poll();
  }

  function decisionStrip(row) {
    if (!row || !hasData(row)) return '';
    const parts = [];
    if (tradable(row)) {
      if (S.odds && S.odds.rows && S.odds.rows[row.x]) parts.push(['CFD · hours', decide(row, 'h')]);
      parts.push(['CFD · days to weeks', decide(row, 'days')]);
    }
    if (isStockLike(row) && (isTV() || row.real)) parts.push(['Investing · months', decide(row, 'inv')]);
    return `<div class="dstrip">${parts.map(([l, dec]) => `<div class="dbox ${dec.word}"><span class="faint">${l}</span><div>${decBadge(dec, l.startsWith('Investing') ? 'inv' : 'x')}</div></div>`).join('')}
      <a class="dl dhow" href="#/dict/probability">How is this decided?</a></div>`;
  }

  function oddsCard(row) {
    if (!row || !row.d.od) return '';
    const e1 = dailyEval(row, 'buy', [0, 1, 2], WIN_MIN), e2 = dailyEval(row, 'sell', [0, 1, 2], WIN_MIN);
    const line = (e, buy) => e.cells.map(c => !c ? '<td class="faint">–</td>' : `<td><b class="${c.good ? (buy ? 'up' : 'down') : ''}">${Math.round(c.p)}%</b> <span class="faint">(normal ${Math.round(c.base)}%)</span></td>`).join('');
    return `<div class="card"><h3>The last times it looked like this <small>Daily chart, all history</small></h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"><span class="faint" style="font-size:12.5px">Today:</span>${lookTextD(row.d.od.L)}</div>
      <table class="otab"><thead><tr class="faint"><td></td><td>1 week</td><td>1 month</td><td>3 months</td></tr></thead>
        <tbody><tr><td class="up">▲ Rose</td>${line(e1, true)}</tr><tr><td class="down">▼ Fell</td>${line(e2, false)}</tr></tbody></table>
      <div class="note">Out of ${e1.n} past days that looked like today. Coloured = at least ${WIN_MIN} in 100, at least ${MARGIN} more than normal, and gained on average. Normal = what price did after any day.</div></div>`;
  }

  function healthCard(row) {
    if (!row || row.ty !== 'Stocks' || !tvLive(row.x)) return '';
    const lt = tvLive(row.x);
    setTimeout(async () => {
      const f = await Fund.loadNow(lt), box = $('#health');
      if (!box) return;
      const c = f ? Fund.checks(f) : [];
      if (!c.length) { box.innerHTML = '<p class="faint">No company figures available for this one.</p>'; return; }
      const ok = c.filter(x => x.ok).length;
      box.classList.remove('faint');
      box.innerHTML = `<div class="bigscore"><div><span class="muted">Checks passed</span><b class="num ${ok / c.length >= 0.7 ? 'up' : ok / c.length < 0.45 ? 'down' : 'warn'}">${ok} / ${c.length}</b></div>
          <div><span class="muted">Company value</span><b class="num">${f.mc ? money(f.mc) : '–'}</b></div></div>
        <ul class="checks">${c.map(x => `<li><span class="ic">${x.ok ? '✅' : '⚠️'}</span><span>${esc(x.text)}</span><a class="pts dl" href="#/dict/${x.id}">what is this?</a></li>`).join('')}
          ${f.dy ? `<li><span class="ic">💵</span><span>Pays a dividend of about ${f.dy.toFixed(1)}% a year</span></li>` : ''}${f.sec ? `<li><span class="ic">🏷️</span><span>Sector: ${esc(f.sec)}</span></li>` : ''}</ul>`;
    }, 0);
    return `<div class="card"><h3>Company health <small>latest yearly figures, from TradingView</small></h3><div id="health" class="faint">Loading…</div>
      <div class="note">The trend and odds come from the price only. These checks look at the business itself. A good business can still have a falling price, and the other way round.</div></div>`;
  }

  // Plan a trade: how big a position so that hitting the stop loses only the chosen % of the account
  function planCard(row, price, tf) {
    if (!row || !hasData(row)) return '';
    const p = store.get('plan', { bal: 1000, risk: 1 });
    // a starting stop: the odds' stop for this holding time if there is one, else 1.5 average candles
    const dec = decide(row, tf === '1h' || tf === '15m' || tf === '4h' ? 'h' : 'days');
    const fromOdds = !!(dec.c && dec.c.stop);
    const stopPct = fromOdds ? dec.c.stop : Math.max(0.1, (row.d.atrp || 1) * 1.5);
    const side = dec.word === 'sell' ? 'sell' : 'buy';
    const dp = decimalsOf(price);
    const stop = side === 'buy' ? price * (1 - stopPct / 100) : price * (1 + stopPct / 100);
    const target = side === 'buy' ? price + 2 * (price - stop) : price - 2 * (stop - price);
    return `<div class="card plan" style="grid-column:1/-1"><h3>Plan a trade <small>how big, and where to get out</small></h3>
      <div class="pgrid">
        <label>Side<select id="pSide"><option value="buy" ${side === 'buy' ? 'selected' : ''}>▲ Buy</option><option value="sell" ${side === 'sell' ? 'selected' : ''}>▼ Sell (CFD)</option></select></label>
        <label>My account (${esc(row.cur || 'same currency')})<input id="pBal" type="number" min="0" step="any" value="${p.bal}"></label>
        <label>Risk per trade (%)<input id="pRisk" type="number" min="0.1" max="10" step="0.1" value="${p.risk}"></label>
        <label>Entry price<input id="pEntry" type="number" step="any" value="${price.toFixed(dp)}"></label>
        <label>Stop loss<input id="pStop" type="number" step="any" value="${stop.toFixed(dp)}"></label>
        <label>Take profit<input id="pTarget" type="number" step="any" value="${target.toFixed(dp)}"></label>
      </div>
      <div id="pOut" class="pout"></div>
      <div class="note">Starting stop = ${fromOdds ? `the odds' stop (8 of 10 past times never went that far against you, ${dec.c.short})` : '1.5 average candles away'}; take profit = 2× the stop distance. Change any box.
        In XTB the size is set in <b>lots</b>: check the lot size in the app (stock CFDs are usually 1 share per lot, forex 100,000 units, gold 100 ounces). If your account is in another currency, convert first. ${dl('position-size', 'Why size this way?')}</div></div>`;
  }

  function wirePlan() {
    if (!$('#pOut')) return;
    const calc = () => {
      const side = $('#pSide').value, bal = +$('#pBal').value, risk = +$('#pRisk').value, e = +$('#pEntry').value, s = +$('#pStop').value, t = +$('#pTarget').value;
      store.set('plan', { bal, risk });
      const per = side === 'buy' ? e - s : s - e, gain = side === 'buy' ? t - e : e - t;
      if (!(bal > 0 && risk > 0 && e > 0 && per > 0)) {
        $('#pOut').innerHTML = `<span class="warn">${per <= 0 && e > 0 ? `For a ${side} the stop loss must be ${side === 'buy' ? 'below' : 'above'} the entry price.` : 'Fill in every box.'}</span>`;
        return;
      }
      const atRisk = bal * risk / 100, units = atRisk / per, value = units * e, rr = gain / per, dp = decimalsOf(e);
      const f = v => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
      $('#pOut').innerHTML = `<div class="bigscore">
          <div><span class="muted">Size</span><b class="num">${units >= 100 ? f(Math.floor(units)) : +units.toPrecision(3)}</b><span class="faint" style="font-size:12px">units (shares, coins, ounces…)</span></div>
          <div><span class="muted">Position value</span><b class="num">${f(value)}</b><span class="faint" style="font-size:12px">${value > bal ? `${(value / bal).toFixed(1)}× your account: needs leverage` : 'no leverage needed'}</span></div></div>
        <ul class="checks">
          <li><span class="ic">🛑</span><span>If the stop is hit you lose about <b class="down">${f(atRisk)}</b> (${risk}% of your account), plus spread and fees.</span></li>
          <li><span class="ic">🎯</span><span>If take profit is hit you gain about <b class="up">${gain > 0 ? f(units * gain) : '–'}</b>.</span></li>
          <li><span class="ic">⚖️</span><span>Reward : risk = <b class="${rr >= 1.5 ? 'up' : 'warn'}">${gain > 0 ? rr.toFixed(1) : '–'} : 1</b>${gain > 0 && rr < 1.5 ? ' (many traders skip trades under 1.5 : 1)' : ''}. Stop ${chartFmt(s, dp)} · entry ${chartFmt(e, dp)} · target ${chartFmt(t, dp)}</span></li>
        </ul>`;
    };
    $('#pSide').onchange = () => {
      // mirror the stop and target to the other side of the entry
      const e = +$('#pEntry').value, s = +$('#pStop').value, t = +$('#pTarget').value;
      $('#pStop').value = (2 * e - s).toFixed(decimalsOf(e)); $('#pTarget').value = (2 * e - t).toFixed(decimalsOf(e));
      calc();
    };
    ['pBal', 'pRisk', 'pEntry', 'pStop', 'pTarget'].forEach(id => { $('#' + id).oninput = calc; });
    calc();
  }

  async function viewInstrument(x, tf) {
    navTabs(null);
    const row = S.summary.rows.find(r => r.x === x);
    $('#view').innerHTML = '<div class="empty">Loading chart…</div>';
    let det;
    if (row && !hasData(row)) return noDataView(row);
    try { det = await loadDetail(x); } catch (e) { if (row) return noDataView(row); $('#view').innerHTML = `<div class="empty">No chart data for ${esc(x)} yet.</div>`; return; }
    const tfs = TF_ORDER.filter(k => det.tf[k]);
    if (!det.tf[tf]) tf = tfs.includes('1d') ? '1d' : tfs[0];
    const T = det.tf[tf], m = det.meta, d = decode(T), study = T.study;
    const lt = tvLive(x), sym = isTV() ? (tvSym(x) || m.xtb) : m.xtb;
    const kind = store.get('chartKind', isTV() ? 'tv' : 'ours');
    const price = d.c[d.c.length - 1], prev = d.c[d.c.length - 2], ch = (price / prev - 1) * 100;
    d.tf = tf;
    d.marks = T.marks.map(([i, pid]) => [i, pid, PAT[pid][1], PAT[pid][0]]);
    d.levels = { sup: T.levels.sup, res: T.levels.res };

    $('#view').innerHTML = `
      <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '${S.back}')">← Back</button>
      <div class="ihead">
        <div><h2>${esc(m.name)}</h2>
          <div class="faint" style="font-size:13px">${esc(m.type)} · ${esc(m.market)} · ${[m.cfd ? 'CFD' : '', m.real ? 'Real shares' : ''].filter(Boolean).join(' · ')}</div></div>
        <div ${lt ? `data-live="${esc(lt)}"` : ''}><span class="big num lp">${chartFmt(price, T.dp)}</span> <span class="lc ${ch >= 0 ? 'up' : 'down'} num">${pct(ch, 2)}</span>
          <div class="faint lnote" style="font-size:12.5px">${lt ? 'Waiting for live price…' : 'Price from the last scan (no live feed for this one)'}</div></div>
        <div class="spacer"></div>
        <div class="symbox"><span class="faint" style="font-size:13px">${isTV() ? 'TradingView' : 'XTB'} symbol</span> <b>${esc(sym)}</b> <button class="copy" id="copy">Copy</button>
          <a class="copy" href="${tvLink(x)}" target="_blank" rel="noopener">Open in TradingView ↗</a></div>
      </div>
      ${decisionStrip(row)}
      ${lt ? `<div class="rating" data-rec="${esc(lt)}"></div>` : ''}
      <div class="chartbar"><div class="tfs">${TF_ORDER.map(k => `<button data-tf="${k}" class="${k === tf ? 'on' : ''}" ${det.tf[k] ? '' : 'disabled title="Only for the fast-watch list"'}>${tfShort(k)}</button>`).join('')}</div>
        <div class="seg kind" role="group" aria-label="Chart type"><button data-kind="ours" class="${kind === 'ours' ? 'on' : ''}">Pattern chart</button><button data-kind="tv" class="${kind === 'tv' ? 'on' : ''}">Live TradingView chart</button></div></div>
      <div class="chartbox ${kind === 'tv' ? 'hidden' : ''}" id="chart"></div>
      <div class="tvbox ${kind === 'tv' ? '' : 'hidden'}" id="tvchart"></div>
      <div class="legend ${kind === 'tv' ? 'hidden' : ''}" id="legend"><span><i style="background:#5aa9ff"></i>50 average</span><span><i style="background:#e5a83b"></i>200 average</span>
        <span><i style="background:rgba(46,194,126,.8)"></i>Support</span><span><i style="background:rgba(240,85,90,.8)"></i>Resistance</span>
        <span class="up">▲ bullish pattern</span><span class="down">▼ bearish pattern</span><span>Drag to move · scroll / pinch to zoom · tap a marked candle</span></div>
      <div id="picked"></div>
      <div class="grid2">
        ${planCard(row, price, tf)}
        ${studyCard(study, T)}
        ${oddsCard(row)}
        ${healthCard(row)}
        ${scoreCard(T)}
        ${pastCard(T, tf)}
        ${T.inv || det.tf['1d']?.inv ? investCard(T.inv || det.tf['1d'].inv) : ''}
        ${patternStatsCard(T, tf)}
      </div>`;
    $('#copy').onclick = () => { navigator.clipboard?.writeText(sym).then(() => { $('#copy').textContent = 'Copied ✓'; }); };
    document.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
      const k = b.dataset.kind; store.set('chartKind', k);
      document.querySelectorAll('[data-kind]').forEach(o => o.classList.toggle('on', o === b));
      $('#chart').classList.toggle('hidden', k === 'tv'); $('#legend').classList.toggle('hidden', k === 'tv');
      $('#tvchart').classList.toggle('hidden', k !== 'tv');
      if (k === 'tv') tvWidget($('#tvchart'), x, tf); else if (S.chart && S.chart.d) S.chart.setData(S.chart.d);  // re-fit the zoom now the box has a width
    });
    if (kind === 'tv') tvWidget($('#tvchart'), x, tf);
    Live.paint(); Live.poll();
    document.querySelectorAll('[data-tf]').forEach(b => b.onclick = () => { if (!b.disabled) location.hash = `#/i/${encodeURIComponent(x)}/${b.dataset.tf}`; });
    wirePlan();
    S.chart = new CandleChart($('#chart'), { onMark: (i, ms) => showPicked(ms, T, tf) });
    S.chart.setData(d);
  }

  function showPicked(ms, T, tf) {
    $('#picked').innerHTML = `<div class="card" style="margin-top:12px">${ms.map(m => {
      const [name, dir, meaning] = PAT[m[1]]; const loc = T.pstats[m[1]] || { n: 0 }; const pool = (S.patterns[tf] || {})[m[1]] || { n: 0 };
      return `<div class="pat"><b class="${dir === 'bull' ? 'up' : dir === 'bear' ? 'down' : ''}">${dir === 'bull' ? '▲' : dir === 'bear' ? '▼' : '•'} ${esc(name)}</b><div>${esc(meaning)}</div>
        <div class="stat">${statLine(loc, dir, 'On this instrument')}</div><div class="stat">${statLine(pool, dir, 'Across all instruments')}</div></div>`;
    }).join('')}</div>`;
    $('#picked').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function statLine(st, dir, label) {
    if (!st || !st.n) return `${label}: no past examples.`;
    if (dir === 'neutral') return `${label}: ${st.n} times · price was higher 5 candles later ${st.up}% of the time (normal ${st.base_up}%).`;
    const word = dir === 'bull' ? 'higher' : 'lower';
    return `${label}: ${st.n.toLocaleString()} times · price was ${word} 5 candles later <b>${st.win}%</b> of the time (normal ${st.base_win}%) · <i>${esc(st.grade)}</i>`;
  }

  function studyCard(st, T) {
    // fall back to the latest all-instrument stats if this file was built before they existed
    const poolNow = S.patterns[T.tf] || {};
    st.recent_patterns.forEach(p => { if ((!p.pool || !p.pool.n) && poolNow[p.id]) p.pool = poolNow[p.id]; });
    const leanCls = st.lean >= 1.5 ? 'up' : st.lean <= -1.5 ? 'down' : 'warn';
    const pats = st.recent_patterns.length ? st.recent_patterns.map(p => `<div class="pat"><b class="${p.dir === 'bull' ? 'up' : p.dir === 'bear' ? 'down' : ''}">${p.dir === 'bull' ? '▲' : p.dir === 'bear' ? '▼' : '•'} ${esc(p.name)}</b> <span class="faint">${p.ago === 0 ? 'on the last closed candle' : p.ago + ' candle' + (p.ago > 1 ? 's' : '') + ' ago'}</span>
        <div>${esc(p.meaning)}</div><div class="stat">${statLine(p.local, p.dir, 'On this instrument')}</div><div class="stat">${statLine(p.pool, p.dir, 'Across all instruments')}</div></div>`).join('')
      : '<div class="faint" style="font-size:14px">No candle pattern on the last 3 closed candles.</div>';
    const icon = { waiting: '⏳', confirmed: '✅', cancelled: '❌', failed: '⚠️' };
    const scen = st.scenarios.map(s => `<div class="scen ${s.side}"><span class="side">${s.side === 'bull' ? '▲ BULLISH CASE' : '▼ BEARISH CASE'}</span><div>${esc(s.text.replace(/^(Bullish|Bearish) case: /, ''))}</div>
      <div class="status">${icon[s.status]} ${esc(s.status_text)}${s.rr ? ` · Reward/risk to next level: <b>${s.rr}</b>` : ''}</div></div>`).join('');
    return `<div class="card" style="grid-column:1/-1"><h3>What next? <small>study notes from closed candles</small></h3>
      <div class="lean ${leanCls}">${esc(st.lean_text)}</div>
      <ul class="checks"><li><span class="ic">📈</span>${esc(st.trend_text)}</li><li><span class="ic">⚡</span>${esc(st.rsi_text)}</li>
      ${st.near_support ? '<li><span class="ic">🟩</span>Price is close to a support level (less than 1 average candle away).</li>' : ''}
      ${st.near_resistance ? '<li><span class="ic">🟥</span>Price is close to a resistance level (less than 1 average candle away).</li>' : ''}</ul>
      <h3 style="margin-top:14px">Recent candle patterns</h3>${pats}
      <h3 style="margin-top:14px">If / then</h3>${scen}
      <div class="note">This counts evidence; it does not predict. Reward/risk = distance to the next level ÷ distance to the "wrong if" price. Many traders skip setups under 1.5.</div></div>`;
  }

  function scoreCard(T) {
    const li = parts => parts.map(p => `<li><span class="ic">${p.ok ? '✅' : p.penalty ? '⚠️' : '▫️'}</span><span class="${p.ok ? '' : 'faint'}">${esc(p.text)}</span><span class="pts">${p.pts > 0 ? '+' : ''}${p.pts}</span></li>`).join('');
    const b = T.bull[T.bull.length - (T.closed ? 1 : 2)], s = T.bear[T.bear.length - (T.closed ? 1 : 2)];
    return `<div class="card"><h3>Signal score <small>0–100, alerts at 70+ · ${dl('signal-score', 'what is this?')}</small></h3>
      <div class="bigscore"><div><span class="up">▲ Buy side</span><b class="up num">${b ?? '–'}</b></div><div><span class="down">▼ Sell side</span><b class="down num">${s ?? '–'}</b></div></div>
      <details open><summary class="muted" style="cursor:pointer">Why (buy side)</summary><ul class="checks" style="margin-top:8px">${li(T.parts.bull)}</ul></details>
      <details style="margin-top:8px"><summary class="muted" style="cursor:pointer">Why (sell side)</summary><ul class="checks" style="margin-top:8px">${li(T.parts.bear)}</ul></details></div>`;
  }

  function pastCard(T, tf) {
    const one = (bt, side) => {
      if (!bt.n) return `<p>The ${side} score has never crossed 70 here, so there is no record.</p>`;
      const w = side === 'buy' ? 'higher' : 'lower';
      return `<p><b class="${side === 'buy' ? 'up' : 'down'}">${side === 'buy' ? '▲ Buy' : '▼ Sell'} signal</b> fired <b>${bt.n}</b> times. ${bt.horizon} candles later price was ${w} <b>${bt.win}%</b> of the time
        (any random candle: ${bt.base_win}%). Average move in the signal's favour: <b>${pct(bt.avg, 2)}</b>.<br><i>${esc(bt.grade)}</i></p>`;
    };
    return `<div class="card"><h3>How the signal did before <small>${TF_LABEL[tf]} chart, this instrument</small></h3>${one(T.bt.bull, 'buy')}${one(T.bt.bear, 'sell')}
      <div class="note">"Normal" is what happened on every candle, so a signal is only useful if it beats it. Fewer than 15 examples = too few to judge.</div></div>`;
  }

  function investCard(v) {
    return `<div class="card"><h3>Long-term trend score <small>for investing (months–years)</small></h3>
      <div class="bigscore"><div><span class="muted">Score</span><b class="num ${v.score >= 70 ? 'up' : v.score <= 30 ? 'down' : ''}">${v.score}</b></div><div><span class="muted">12 months</span><b class="num ${v.ret12m >= 0 ? 'up' : 'down'}">${pct(v.ret12m)}</b></div></div>
      ${v.parts ? `<ul class="checks">${v.parts.map(p => `<li><span class="ic">${p.ok ? '✅' : '▫️'}</span><span class="${p.ok ? '' : 'faint'}">${esc(p.text)}</span><span class="pts">+${p.pts}</span></li>`).join('')}</ul>` : ''}
      <div class="note">Price trend only. For the business itself see Company health.</div></div>`;
  }

  function patternStatsCard(T, tf) {
    const pool = S.patterns[tf] || {};
    const ids = Object.keys(PAT).filter(id => (T.pstats[id] && T.pstats[id].n) || (pool[id] && pool[id].n));
    if (!ids.length) return '';
    const rows = ids.map(id => {
      const [name, dir] = PAT[id], l = T.pstats[id] || {}, p = pool[id] || {};
      const cell = st => !st.n ? '<span class="faint">–</span>' : dir === 'neutral' ? `${st.up}% up <span class="faint">(${st.n})</span>`
        : `<b class="${st.n < 15 ? 'faint' : st.grade === 'Historically reliable' ? 'up' : st.win < st.base_win ? 'down' : ''}">${st.win}%</b> <span class="faint">(${st.n.toLocaleString()})</span>`;
      return `<tr><td class="${dir === 'bull' ? 'up' : dir === 'bear' ? 'down' : ''}">${dir === 'bull' ? '▲' : dir === 'bear' ? '▼' : '•'} ${esc(name)}</td><td>${cell(l)}</td><td>${cell(p)}</td></tr>`;
    }).join('');
    return `<div class="card"><h3>How patterns worked <small>${TF_LABEL[tf]}, next 5 candles</small></h3>
      <table style="width:100%;font-size:13.5px;border-collapse:collapse"><thead><tr class="faint"><td>Pattern</td><td>Here</td><td>All instruments</td></tr></thead><tbody>${rows}</tbody></table>
      <div class="note">% = how often price moved the pattern's way. Green = clearly better than normal (passes the luck test), red = worse than normal, grey = under 15 examples. Number of examples in brackets.</div></div>`;
  }

  // ---------------------------------------------------------------- TradingView chart
  const TV_INT = { '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1wk': 'W' };
  function tvWidget(box, x, tf) {
    // TradingView's free Advanced Chart widget: live candles, their own indicators and drawing tools
    const key = x + '|' + tf;
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
    const sc = document.createElement('script');
    sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    sc.async = true;
    sc.textContent = JSON.stringify({
      autosize: true, symbol: tvSym(x) || x, interval: TV_INT[tf] || 'D', timezone: 'Asia/Bangkok', theme: 'dark', style: '1',
      locale: 'en', backgroundColor: '#10161d', gridColor: 'rgba(36,49,64,0.6)', allow_symbol_change: true,
      hide_side_toolbar: narrow(), withdateranges: true, details: false, calendar: false,
      studies: ['STD;RSI'], support_host: 'https://www.tradingview.com',
    });
    box.firstChild.appendChild(sc);
  }

  // ---------------------------------------------------------------- live prices
  // TradingView's public screener answers browsers directly, so the page can refresh prices
  // by itself between scans. If it ever stops answering, the page simply keeps the scan prices.
  const Live = (() => {
    const URL_SCAN = 'https://scanner.tradingview.com/global/scan';
    const q = {};            // ticker -> {p, ch, mode, rec, ind: {sma1, sma4, rsi, macd, sig}, at}
    let busy = false, again = false, okAt = 0, failed = 0, timer = null, extra = [], onUpdate = null;
    // TradingView columns. The last five describe the 1H chart for the Good for buying / selling
    // tabs - the same facts engine/odds.py reads from past candles.
    const COLS = ['close', 'change', 'update_mode', 'Recommend.All', 'SMA50|60', 'SMA50|240', 'RSI|60', 'MACD.macd|60', 'MACD.signal|60'];
    const TAPE = [['US500', 'S&P 500'], ['US100', 'Nasdaq 100'], ['DE40', 'DAX'], ['JP225', 'Nikkei'], ['GOLD', 'Gold'],
      ['OIL.WTI', 'Oil WTI'], ['EURUSD', 'EUR/USD'], ['USDJPY', 'USD/JPY'], ['BITCOIN', 'Bitcoin'], ['ETHEREUM', 'Ethereum']];
    const tapeItems = () => {
      const t = TAPE.map(([x, n]) => [tvLive(x), n, x]).filter(a => a[0]);
      if (isTV()) t.splice(4, 0, ['SET:SET', 'SET index', ''], ['FX_IDC:USDTHB', 'USD/THB', '']);
      return t;
    };
    const fmt = p => chartFmt(p, decimalsOf(p));

    function renderTape() {
      const items = tapeItems();
      const one = items.map(([t, n, x]) => `<a class="ti" ${x ? `href="#/i/${encodeURIComponent(x)}/1d"` : `href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(t)}" target="_blank" rel="noopener"`} data-live="${esc(t)}"><b>${esc(n)}</b> <span class="lp num">…</span> <span class="lc num"></span></a>`).join('');
      $('#tapeIn').innerHTML = one + one;  // twice, so the scroll loops seamlessly
    }

    function wanted() {
      const s = new Set();
      // lists show every instrument, so only ask for prices on and near the screen (scrolling asks again)
      // measure whole rows only: measuring the price inside an off-screen row (content-visibility: auto)
      // forces the browser to lay that row out, and doing it thousands of times froze the page
      const H = innerHeight;
      document.querySelectorAll('.rows > .row').forEach(row => {
        const b = row.getBoundingClientRect();
        if (b.bottom > -H && b.top < 2 * H && b.height) row.querySelectorAll('[data-live]').forEach(e => s.add(e.dataset.live));
      });
      document.querySelectorAll('[data-live]').forEach(e => { if (!e.closest('.rows > .row')) s.add(e.dataset.live); });  // ticker strip, instrument page
      extra.forEach(t => s.add(t));
      return [...s];
    }

    async function poll() {
      if (busy) { again = true; return; }  // new rows appeared mid-fetch: fetch again right after
      if (document.hidden) return;
      const tickers = wanted();
      if (!tickers.length) return;
      busy = true;
      try {
        for (let i = 0; i < tickers.length; i += 400) {
          const res = await fetch(URL_SCAN, { method: 'POST', body: JSON.stringify({ symbols: { tickers: tickers.slice(i, i + 400) }, columns: COLS }) });
          if (!res.ok) throw new Error(res.status);
          const js = await res.json();
          for (const r of js.data || []) {
            const d = r.d, old = q[r.s];
            // a Binance tick that is newer than TradingView's answer keeps its price
            const p = old && old.bin && Date.now() - old.bin < 5000 ? old.p : d[0];
            q[r.s] = { p, ch: d[1], mode: d[2] || '', rec: d[3], at: Date.now(), bin: old && old.bin,
              ind: d[4] == null || d[6] == null || d[7] == null ? null : { sma1: d[4], sma4: d[5], rsi: d[6], macd: d[7], sig: d[8] } };
          }
        }
        okAt = Date.now(); failed = 0;
      } catch (e) { failed++; }
      busy = false;
      paint();
      Bin.sync(tickers);
      if (onUpdate) onUpdate();
      if (again) { again = false; poll(); }
    }

    // Binance's public price stream: crypto prices every second (TradingView's answer is every 15 s)
    const Bin = (() => {
      let ws = null, key = '', last = 0, pending = false;
      const sym = t => t.startsWith('BINANCE:') && t.endsWith('USDT') ? t.slice(8).toLowerCase() : null;
      function sync(tickers) {
        const want = tickers.map(sym).filter(Boolean).sort();
        const k = want.join('/');
        // keep the open connection when it already covers every coin wanted (e.g. leaving the odds tab)
        if (ws && ws.readyState <= 1 && want.every(w => key.split('/').includes(w))) return;
        key = k;
        if (ws) { ws.onclose = null; ws.close(); ws = null; }
        if (!want.length) return;
        try { ws = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + want.map(s => s + '@miniTicker').join('/')); } catch (e) { return; }
        ws.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data).data; } catch (e) { return; }
          if (!m || !m.s) return;
          const t = 'BINANCE:' + m.s, c = q[t] || (q[t] = { mode: 'streaming' });
          c.p = +m.c; c.bin = Date.now();
          if (!pending) { pending = true; setTimeout(() => { pending = false; last = Date.now(); paint(); }, Math.max(0, 1000 - (Date.now() - last))); }
        };
        ws.onclose = () => { ws = null; key = ''; };  // the next poll reconnects
      }
      return { sync, on: () => ws && ws.readyState === 1 };
    })();

    function recLabel(v) {
      if (v == null) return null;
      return v > 0.5 ? ['Strong buy', 'g'] : v > 0.1 ? ['Buy', 'g'] : v < -0.5 ? ['Strong sell', 'r'] : v < -0.1 ? ['Sell', 'r'] : ['Neutral', ''];
    }

    function paint() {
      document.querySelectorAll('[data-live]').forEach(el => {
        const c = q[el.dataset.live];
        if (!c || c.p == null) return;
        const lp = el.querySelector('.lp'), lc = el.querySelector('.lc'), txt = fmt(c.p);
        if (lp && lp.textContent !== txt) {
          const before = parseFloat(el.dataset.p);
          lp.textContent = txt;
          if (!isNaN(before) && before !== c.p) {
            el.classList.remove('fl-up', 'fl-down'); void el.offsetWidth;
            el.classList.add(c.p > before ? 'fl-up' : 'fl-down');
          }
        }
        el.dataset.p = c.p;
        if (lc && c.ch != null) { lc.textContent = pct(c.ch, 2); lc.classList.toggle('up', c.ch >= 0); lc.classList.toggle('down', c.ch < 0); }
        const note = el.querySelector('.lnote');
        if (note) note.textContent = 'Live price · ' + (c.mode.startsWith('delayed') ? `delayed ${Math.round((+c.mode.split('_').pop() || 900) / 60)} min` : 'real time') + (weekend() && !el.dataset.live.startsWith('BINANCE') && !el.dataset.live.startsWith('COINBASE') ? ' · market closed for the weekend' : '');
      });
      // stop / target prices written as "live price x factor"
      document.querySelectorAll('[data-lvl]').forEach(el => {
        const c = q[el.dataset.lvl];
        if (c && c.p != null) el.textContent = fmt(c.p * +el.dataset.f);
      });
      document.querySelectorAll('[data-rec]').forEach(el => {
        const c = q[el.dataset.rec], l = c && recLabel(c.rec);
        el.innerHTML = l ? `<span class="chip ${l[1]}" title="TradingView's own technical summary (moving averages + oscillators). A second opinion, separate from the scores on this page.">TradingView rating: ${l[0]}</span>` : '';
      });
      const pill = $('#livePill');
      const fresh = Date.now() - okAt < 60000;
      pill.classList.toggle('off', !fresh);
      pill.querySelector('span').textContent = !fresh ? (failed ? 'Live off' : 'Live…') : weekend() ? (narrow() ? 'Weekend' : 'Live · weekend') : 'Live';
      pill.title = !fresh ? 'Live prices are not reachable right now - showing prices from the last scan.'
        : weekend() ? 'Live prices on. It is the weekend, so stock, index, commodity and forex markets are closed and their prices do not move. Crypto trades 24/7.'
          : 'Live prices refresh by themselves every 15 seconds (crypto/forex real time, most stocks 15 min delayed).';
    }

    function start() {
      renderTape();
      poll();
      clearInterval(timer);
      timer = setInterval(poll, 15000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    }
    // extra tickers to fetch even when they are not drawn (the odds tabs need every instrument's facts)
    function want(list) { extra = list || []; }
    let scrollT = null;
    addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(() => { if (!busy) poll(); else again = true; }, 400); }, { passive: true });
    function hook(fn) { onUpdate = fn; }
    return { start, poll, paint, want, hook, q, fresh: () => Date.now() - okAt < 60000, binOn: () => Bin.on() };
  })();

  // ---------------------------------------------------------------- library
  function patSVG(cs) {
    const w = 260, h = 110, n = cs.length, cw = w / (n + 1), Y = v => h - 8 - v / 10 * (h - 16);
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${cs.map(([o, hi, lo, c], i) => {
      const x = (i + 1) * cw, col = c >= o ? '#2ec27e' : '#f0555a', last = i === n - 1 ? '' : 'opacity=".55"';
      return `<g ${last}><line x1="${x}" x2="${x}" y1="${Y(hi)}" y2="${Y(lo)}" stroke="${col}" stroke-width="2"/><rect x="${x - cw * 0.28}" y="${Y(Math.max(o, c))}" width="${cw * 0.56}" height="${Math.max(2, Math.abs(Y(o) - Y(c)))}" fill="${col}" rx="1.5"/></g>`;
    }).join('')}</svg>`;
  }
  function viewLibrary(tf) {
    navTabs('library');
    const pool = S.patterns[tf] || {};
    $('#view').innerHTML = `<p class="intro">Every pattern we look for, what it means, and how it actually worked across all instruments we scan (not textbook claims).</p>
      <div class="filters"><div class="seg">${['1h', '4h', '1d', '1wk'].map(k => `<button data-ltf="${k}" class="${k === tf ? 'on' : ''}">${TF_LABEL[k]}</button>`).join('')}</div></div>
      <div class="libgrid">${Object.entries(PAT).map(([id, [name, dir, meaning, cs]]) => `<div class="card lib">
        <h3 class="${dir === 'bull' ? 'up' : dir === 'bear' ? 'down' : ''}">${dir === 'bull' ? '▲' : dir === 'bear' ? '▼' : '•'} ${esc(name)}</h3>${patSVG(cs)}
        <div style="font-size:14px">${esc(meaning)}</div>
        ${dir !== 'neutral' ? `<div class="note">Confirms when a later candle closes ${dir === 'bull' ? 'above the pattern\'s high' : 'below the pattern\'s low'}. Wrong if price closes ${dir === 'bull' ? 'below its low' : 'above its high'}.</div>` : ''}
        <div class="stat" style="margin-top:8px">${statLine(pool[id], dir, TF_LABEL[tf] + ', all instruments')}</div></div>`).join('')}</div>`;
    document.querySelectorAll('[data-ltf]').forEach(b => b.onclick = () => { location.hash = '#/library/' + b.dataset.ltf; });
  }

  // ---------------------------------------------------------------- practice
  async function viewPractice() {
    navTabs('practice');
    const sc = store.get('practice', { right: 0, total: 0 });
    $('#view').innerHTML = `<p class="intro">A real past chart that stops right after a candle pattern. Guess where price went over the <b>next 5 candles</b>, then see what really happened.
      Your score: <b>${sc.right}/${sc.total}</b>${sc.total ? ` (${Math.round(sc.right / sc.total * 100)}%)` : ''}.</p><div id="pq" class="empty">Finding a chart…</div>`;
    const pool = S.summary.rows.filter(r => r.cfd && (lqUsd(r) || 0) > 2e7 || !isStockLike(r));
    for (let tries = 0; tries < 8; tries++) {
      const r = pool[Math.floor(Math.random() * pool.length)];
      let det; try { det = await loadDetail(r.x); } catch (e) { continue; }
      const tfs = Object.keys(det.tf); const tf = tfs[Math.floor(Math.random() * tfs.length)];
      const T = det.tf[tf], n = T.c.c.length;
      const cands = T.marks.filter(([i, pid]) => PAT[pid][1] !== 'neutral' && i > 120 && i < n - 6);
      if (!cands.length) continue;
      const [idx, pid] = cands[Math.floor(Math.random() * cands.length)];
      return practiceRound(r, det, tf, idx, pid);
    }
    $('#pq').textContent = 'Could not find a practice chart right now - try again.';
  }
  function practiceRound(r, det, tf, idx, pid) {
    const T = det.tf[tf], d = decode(T); d.tf = tf;
    d.marks = T.marks.map(([i, p]) => [i, p, PAT[p][1], PAT[p][0]]); d.limit = idx;
    const [name, dir, meaning] = PAT[pid];
    $('#pq').outerHTML = `<div id="pq"><div class="card" style="margin-bottom:10px"><b>${esc(r.n)}</b> <span class="faint">${esc(r.x)} · ${TF_LABEL[tf]} chart</span>
        <div style="margin-top:4px">The last candle completed a <b class="${dir === 'bull' ? 'up' : 'down'}">${esc(name)}</b>. ${esc(meaning)}</div></div>
      <div class="chartbox" id="chart"></div>
      <div class="practice-q"><button class="pu" data-g="up">📈 Higher in 5 candles</button><button class="pd" data-g="down">📉 Lower in 5 candles</button></div>
      <div id="pres"></div></div>`;
    S.chart = new CandleChart($('#chart'), {}); S.chart.setData(d);
    document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-g]').forEach(x => x.disabled = true);
      let k = idx; const step = () => { k++; S.chart.setLimit(k); if (k < idx + 5) setTimeout(step, 350); else done(); }; step();
      function done() {
        const move = (d.c[idx + 5] / d.c[idx] - 1) * 100, wentUp = move > 0, right = (b.dataset.g === 'up') === wentUp;
        const sc = store.get('practice', { right: 0, total: 0 }); sc.total++; if (right) sc.right++; store.set('practice', sc);
        const pool = (S.patterns[tf] || {})[pid];
        $('#pres').innerHTML = `<div class="card"><div class="result ${right ? 'up' : 'down'}">${right ? '✅ Correct!' : '❌ Not this time.'} Price went ${wentUp ? 'up' : 'down'} ${pct(move, 2)}.</div>
          <div class="stat">${statLine(pool, dir, 'This pattern across all instruments')}</div>
          <div class="note">Even good patterns fail often, which is why traders always decide in advance where they are wrong.</div>
          <button class="more" onclick="location.hash='#/practice?'+Date.now()">Next chart →</button></div>`;
      }
    });
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
