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
  const S = { mode: 'xtb', tv: {}, summary: null, patterns: {}, tab: 'cfd', side: 'buy', ctf: '1d', shown: 50, filt: { q: '', m: '', ty: '', lq: '0' }, chart: null, detailCache: {}, back: '#/now' };
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

  // ---------------------------------------------------------------- tabs
  const TABS = {
    cfd: {
      label: 'Strong setups', short: 'Setups',
      intro: () => `Instruments where several signals line up right now. <b>Buy side</b> = upward setups, <b>Sell side</b> = downward setups (${isTV() ? 'a fall can only be traded with CFDs or short selling' : 'with CFDs you can profit from a fall'}). Score 0–100; only scores of 70+ are listed. Daily and Weekly cover everything; 4H / 1H only cover the ${S.summary ? S.summary.fast.length : ''} instruments in the fast-watch list.`,
      filter: r => { const t = tfData(r, S.ctf); return tradable(r) && t && (S.side === 'buy' ? t.b >= 70 : t.s >= 70); },
      sort: (a, b) => { const k = S.side === 'buy' ? 'b' : 's'; return (tfData(b, S.ctf)[k] - tfData(a, S.ctf)[k]) || ((b.d.lq || 0) - (a.d.lq || 0)); },
    },
    inv_strong: {
      label: 'Strong for investing', short: 'Strong invest',
      intro: () => 'Stocks and ETFs with a healthy long-term picture (months to years). Long-term score 0–100 from the 200-day trend, 6- and 12-month performance, distance from the 52-week high and how wild the price moves. Only 70+ listed. <span class="warn">Company results (earnings, revenue, profit) are not included yet.</span>',
      filter: r => isStockLike(r) && inv(r) >= 70,
      sort: (a, b) => (inv(b) - inv(a)) || ((b.d.lq || 0) - (a.d.lq || 0)),
    },
    inv_weak: {
      label: 'Weak for investing', short: 'Weak invest',
      intro: () => 'Stocks and ETFs whose long-term picture is poor right now: below the 200-day average, lower than 6–12 months ago, far from their highs. Long-term score 30 or less. This is about the price trend only, not whether the company is good.',
      filter: r => isStockLike(r) && inv(r) != null && inv(r) <= 30,
      sort: (a, b) => (inv(a) - inv(b)) || ((b.d.lq || 0) - (a.d.lq || 0)),
    },
    avoid: {
      label: 'Avoid for now', short: 'Avoid',
      intro: () => (isTV() ? 'Instruments' : 'CFD instruments') + ' with <b>no clear direction</b> on the Daily chart: both the buy and the sell score are under 40. Signals conflict here, so trades are more of a coin flip. Usually better to wait.',
      filter: r => tradable(r) && r.d.b != null && r.d.b < 40 && r.d.s < 40,
      sort: (a, b) => (b.d.lq || 0) - (a.d.lq || 0),
    },
    all: {
      label: 'Search all', short: 'All',
      intro: () => `Every instrument we scan. Type a name or ${isTV() ? 'TradingView' : 'XTB'} symbol.`,
      filter: () => true,
      sort: (a, b) => (b.d.lq || 0) - (a.d.lq || 0),
    },
  };

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
      const [sum, pats, tv] = await Promise.all([fetchJSON('data/summary.json'), fetchJSON('data/patterns.json').catch(() => ({})), fetchJSON('tv.json').catch(() => ({}))]);
      S.summary = sum; S.patterns = pats; S.tv = tv;
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
      S.summary = sum; showUpdated();
      if ($('#board')) renderBoard(); else if ($('#rows')) renderRows();
    } catch (e) { /* keep showing what we have */ }
  }

  async function fetchJSON(url) {
    const r = await fetch(url + (url.includes('?') ? '' : '?v=' + Math.floor(Date.now() / 300000)));
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  }

  function route() {
    if (!S.summary) return;
    if (S.chart) { S.chart.destroy(); S.chart = null; }
    const h = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').map(decodeURIComponent);
    window.scrollTo(0, 0);
    if (h[0] === 'i' && h[1]) return viewInstrument(h[1], h[2] || '1d');
    if (h[0] === 'library') return viewLibrary(h[1] || '1d');
    if (h[0] === 'practice') return viewPractice();
    if (h[0] === 'list' && TABS[h[1]]) { S.tab = h[1]; S.back = '#/list/' + h[1]; return viewList(); }
    S.back = '#/now';
    viewBoard();
  }

  function navTabs(active) {
    const items = [`<button class="tab ${active === 'now' ? 'on' : ''}" data-go="#/now">CFDs now</button>`].concat(Object.entries(TABS).map(([k, t]) => `<button class="tab ${active === k ? 'on' : ''}" data-go="#/list/${k}">${t.label}</button>`));
    items.push(`<button class="tab ${active === 'library' ? 'on' : ''}" data-go="#/library">Pattern library</button>`);
    items.push(`<button class="tab ${active === 'practice' ? 'on' : ''}" data-go="#/practice">Practice</button>`);
    $('#tabs').innerHTML = items.join('');
    $('#tabs').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.hash = b.dataset.go; });
  }

  // ---------------------------------------------------------------- CFDs now board
  // Every non-stock CFD (crypto, forex, indices, commodities) in one place, each with a plain verdict
  // for the chosen timeframe - including the ones that are NOT worth trading right now.
  const BCATS = [['all', 'All'], ['Crypto', 'Crypto'], ['Forex', 'Forex'], ['Indices', 'Indices'], ['Commodities', 'Commodities'], ['stocks', 'Popular stock CFDs']];
  const BTFS = ['15m', '1h', '4h', '1d'];
  const HIGHER = { '15m': '1h', '1h': '4h', '4h': '1d', '1d': '1wk' };

  function verdict(t) {
    if (!t || t.b == null || t.s == null) return 'none';
    if (t.b >= 70 && t.s < 40) return 'buy';
    if (t.s >= 70 && t.b < 40) return 'sell';
    if (t.b >= 55 && t.b - t.s >= 20) return 'lbuy';
    if (t.s >= 55 && t.s - t.b >= 20) return 'lsell';
    return 'wait';
  }
  const dirOf = v => v === 'buy' || v === 'lbuy' ? 'up' : v === 'sell' || v === 'lsell' ? 'down' : '';

  function boardPool(cat) {
    const fast = new Set(S.summary.fast || []);
    return S.summary.rows.filter(r => {
      if (!inMode(r)) return false;
      if (cat === 'stocks') return isStockLike(r) && fast.has(r.x) && tradable(r);
      return !isStockLike(r) && (cat === 'all' || r.ty === cat);
    });
  }

  function viewBoard() {
    navTabs('now');
    S.bcat = S.bcat || store.get('bcat', 'all');
    S.btf = S.btf || store.get('btf', '1h');
    S.showWait = false;
    const closed = weekend();
    $('#view').innerHTML = `
      <p class="intro">Every CFD market in one list with a plain answer: <b class="up">set up now</b>, <b class="warn">getting close</b> or <b>not now</b>.
        Pick how long you plan to hold a trade: 15m / 1H for hours, 4H for a day or two, Daily for days to weeks.
        ${closed ? '<br><span class="warn">It is the weekend: only crypto is trading. Forex, indices and commodities show where they closed on Friday and reopen Sunday night (UTC).</span>' : ''}</p>
      <div class="filters">
        <div class="seg wrap" role="group" aria-label="Market">${BCATS.map(([k, l]) => `<button data-bcat="${k}" class="${S.bcat === k ? 'on' : ''}">${l} <span class="cnt">${boardPool(k).length}</span></button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Timeframe">${BTFS.map(tf => `<button data-btf="${tf}" class="${S.btf === tf ? 'on' : ''}">${TF_LABEL[tf]}</button>`).join('')}</div>
        <input id="bq" type="search" placeholder="Search…" aria-label="Search" value="${esc(S.bq || '')}">
      </div>
      <div id="board"></div>`;
    document.querySelectorAll('[data-bcat]').forEach(b => b.onclick = () => { S.bcat = b.dataset.bcat; store.set('bcat', S.bcat); viewBoard(); });
    document.querySelectorAll('[data-btf]').forEach(b => b.onclick = () => { S.btf = b.dataset.btf; store.set('btf', S.btf); viewBoard(); });
    $('#bq').oninput = e => { S.bq = e.target.value; renderBoard(); };
    renderBoard();
  }

  function renderBoard() {
    const box = $('#board'); if (!box) return;
    const tf = S.btf, q = (S.bq || '').trim().toLowerCase();
    const groups = { go: [], lean: [], wait: [], none: [] };
    for (const r of boardPool(S.bcat)) {
      if (q && !(r.n.toLowerCase().includes(q) || r.x.toLowerCase().includes(q) || tvSym(r.x).toLowerCase().includes(q))) continue;
      const t = tfData(r, tf), v = verdict(t);
      const g = v === 'buy' || v === 'sell' ? 'go' : v === 'lbuy' || v === 'lsell' ? 'lean' : v;
      groups[g].push({ r, t, v, str: t && t.b != null ? Math.max(t.b, t.s) : 0, agree: dirOf(verdict(tfData(r, HIGHER[tf]))) === dirOf(v) ? 1 : 0 });
    }
    // open markets first, then the bigger chart agreeing, then the strongest score
    const order = (a, b) => (isOpen(b.r) - isOpen(a.r)) || (b.agree - a.agree) || (b.str - a.str) || ((b.r.d.lq || 0) - (a.r.d.lq || 0));
    Object.values(groups).forEach(g => g.sort(order));
    const SEC = {
      go: ['✅ Set up now', 'up', 'Most signals point the same way on the ' + TF_LABEL[tf] + ' chart (score 70+ on one side, under 40 on the other).'],
      lean: ['👀 Getting close', 'warn', 'Leaning one way but not strong yet. Worth watching, not rushing.'],
      wait: ['⏸ Not now', '', 'No clear direction: buy and sell signals are mixed or weak. Trades here are close to a coin flip, so most traders wait.'],
      none: ['No ' + TF_LABEL[tf] + ' data yet', 'faint', 'Not scanned on this timeframe yet (or too new to have a score).'],
    };
    const html = Object.entries(groups).filter(([k, g]) => g.length).map(([k, g]) => {
      const [title, cls, sub] = SEC[k];
      const capped = k === 'wait' && !S.showWait ? g.slice(0, 12) : g;
      return `<section class="bsec"><h3 class="${cls}">${title} <span class="cnt">${g.length}</span></h3><p class="faint bsub">${sub}</p>
        <div class="rows">${capped.map(boardRow).join('')}</div>
        ${capped.length < g.length ? `<button class="more" id="moreWait">Show all ${g.length} "not now"</button>` : ''}</section>`;
    }).join('');
    box.innerHTML = html || '<div class="empty">Nothing matches.</div>';
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${tf}`; });
    const mw = $('#moreWait'); if (mw) mw.onclick = () => { S.showWait = true; renderBoard(); };
    Live.paint(); Live.poll();
  }

  function boardRow({ r, t, v }) {
    const tf = S.btf, d = r.d, price = r.live ? r.live.p : d.p, lt = tvLive(r.x);
    const side = dirOf(v) === 'down' ? 'sell' : 'buy';
    const LBL = { buy: '▲ BUY setup', sell: '▼ SELL setup', lbuy: '↗ Leaning buy', lsell: '↘ Leaning sell', wait: '⏸ Not now', none: 'No data' };
    const vcls = { buy: 'g', sell: 'r', lbuy: 'g soft', lsell: 'r soft', wait: '', none: '' }[v];
    const chips = [];
    if (t && t.b != null) chips.push(`<span class="chip">▲ ${t.b} · ▼ ${t.s}</span>`);
    if (dirOf(v)) {
      const hv = verdict(tfData(r, HIGHER[tf])), hl = TF_LABEL[HIGHER[tf]];
      if (dirOf(hv) === dirOf(v)) chips.push(`<span class="chip g">${hl} chart agrees</span>`);
      else if (dirOf(hv)) chips.push(`<span class="chip y">${hl} chart points the other way</span>`);
      if (side === 'buy' && t.r > 72) chips.push(`<span class="chip y">RSI ${Math.round(t.r)}: stretched, late to buy</span>`);
      if (side === 'sell' && t.r < 28) chips.push(`<span class="chip y">RSI ${Math.round(t.r)}: stretched, late to sell</span>`);
      chips.push(pastChip(t.bt, side));
    }
    if (t && t.tr) chips.push(trendChip(t.tr));
    chips.push(patChips(t && t.pat));
    if (!isOpen(r)) chips.push('<span class="chip y">Market closed (weekend)</span>');
    // the same verdict on every timeframe, so you can see at a glance whether they line up
    const ladder = BTFS.map(k => {
      const kv = dirOf(verdict(tfData(r, k)));
      return `<span class="tfdot ${kv} ${k === tf ? 'cur' : ''}" title="${TF_LABEL[k]}: ${kv === 'up' ? 'leaning up' : kv === 'down' ? 'leaning down' : 'no clear direction'}">${tfShort(k)} ${kv === 'up' ? '▲' : kv === 'down' ? '▼' : '–'}</span>`;
    }).join('');
    return `<button class="row brow b-${dirOf(v) || 'flat'}" data-x="${esc(r.x)}">
      <div class="name"><span class="verdict ${vcls}">${LBL[v]}</span> ${esc(r.n)}<span class="sym">${esc(shownSym(r))}</span>
        <div class="ladder">${ladder}<span class="faint" style="font-size:12px">${esc(r.ty)}</span></div></div>
      <div class="px num" ${lt ? `data-live="${esc(lt)}"` : ''}><span class="lp">${price != null ? chartFmt(price, decimalsOf(price)) : '–'}</span><div class="lc ${d.ch >= 0 ? 'up' : 'down'}" style="font-size:13px">${pct(d.ch, 2)}</div></div>
      <div class="why">${chips.join('')}</div></button>`;
  }

  // ---------------------------------------------------------------- list view
  function viewList() {
    navTabs(S.tab);
    const T = TABS[S.tab];
    const rows = S.summary.rows.filter(inMode);
    const markets = [...new Set(rows.map(r => r.m))].sort();
    const types = [...new Set(rows.map(r => r.ty))].sort();
    const f = S.filt;
    const extra = S.tab === 'cfd' ? `
      <div class="seg" role="group" aria-label="Side"><button data-side="buy" class="${S.side === 'buy' ? 'on' : ''}">▲ Buy side</button><button data-side="sell" class="${S.side === 'sell' ? 'on' : ''}">▼ Sell side</button></div>
      <div class="seg" role="group" aria-label="Timeframe">${['1h', '4h', '1d', '1wk'].map(tf => `<button data-ctf="${tf}" class="${S.ctf === tf ? 'on' : ''}">${TF_LABEL[tf]}</button>`).join('')}</div>` : '';
    const tyChips = `<div class="seg wrap" role="group" aria-label="Type"><button data-ty="" class="${f.ty ? '' : 'on'}">All types</button>${types.map(t => `<button data-ty="${esc(t)}" class="${f.ty === t ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>`;
    $('#view').innerHTML = `
      <p class="intro">${T.intro()}</p>
      <div class="filters">${tyChips}</div>
      <div class="filters">
        ${extra}
        <input id="q" type="search" placeholder="Search name or ${isTV() ? 'TradingView' : 'XTB'} symbol…" value="${esc(f.q)}" aria-label="Search">
        <select id="fm" aria-label="Market"><option value="">All markets</option>${markets.map(m => `<option ${f.m === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        <select id="flq" aria-label="Minimum trading"><option value="0">Any trading volume</option>
          <option value="1e6" ${f.lq === '1e6' ? 'selected' : ''}>Trades > 1M per day</option>
          <option value="1e7" ${f.lq === '1e7' ? 'selected' : ''}>Trades > 10M per day</option>
          <option value="1e8" ${f.lq === '1e8' ? 'selected' : ''}>Trades > 100M per day</option></select>
      </div>
      <div class="countbar"><span id="count" class="faint"></span><button class="copy" id="export" title="Download this list as a file you can import into a TradingView watchlist">⬇ TradingView watchlist</button></div>
      <div class="rows" id="rows"></div>`;
    const rerender = () => { S.shown = 50; renderRows(); };
    $('#q').oninput = e => { f.q = e.target.value; rerender(); };
    $('#fm').onchange = e => { f.m = e.target.value; rerender(); };
    document.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => {
      f.ty = b.dataset.ty; rerender();
      document.querySelectorAll('[data-ty]').forEach(o => o.classList.toggle('on', o === b));
    });
    $('#flq').onchange = e => { f.lq = e.target.value; rerender(); };
    $('#export').onclick = exportWatchlist;
    document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { S.side = b.dataset.side; viewList(); });
    document.querySelectorAll('[data-ctf]').forEach(b => b.onclick = () => { S.ctf = b.dataset.ctf; viewList(); });
    renderRows();
  }

  function currentList() {
    const T = TABS[S.tab], f = S.filt, q = f.q.trim().toLowerCase(), minLq = +f.lq;
    const list = S.summary.rows.filter(r => {
      if (!inMode(r)) return false;
      if (f.m && r.m !== f.m) return false;
      if (f.ty && r.ty !== f.ty) return false;
      if (minLq && r.d.lq != null && r.d.lq < minLq) return false;
      if (q && !(r.n.toLowerCase().includes(q) || r.x.toLowerCase().includes(q) || tvSym(r.x).toLowerCase().includes(q))) return false;
      try { return T.filter(r); } catch (e) { return false; }
    });
    list.sort(T.sort);
    return list;
  }

  function exportWatchlist() {
    // TradingView's "Import list" reads comma-separated symbols; ###Name starts a section
    const list = currentList().map(r => tvLive(r.x)).filter(Boolean).slice(0, 1000);
    if (!list.length) return;
    const T = TABS[S.tab];
    const name = `Argie ${T.label}${S.tab === 'cfd' ? ` ${S.side} ${TF_LABEL[S.ctf]}` : ''}`;
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
    if (!list.length) { $('#rows').innerHTML = '<div class="empty">Nothing matches right now. Try another timeframe, side or filter.</div>'; return; }
    $('#rows').innerHTML = list.slice(0, S.shown).map(rowHTML).join('') +
      (list.length > S.shown ? `<button class="more" id="more">Show more (${(list.length - S.shown).toLocaleString()} left)</button>` : '');
    $('#rows').querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${S.tab === 'cfd' ? S.ctf : '1d'}`; });
    const m = $('#more'); if (m) m.onclick = () => { S.shown += 50; renderRows(); };
    Live.paint(); Live.poll();
  }

  function trendChip(tr) { return tr === 'up' ? '<span class="chip g">Uptrend</span>' : tr === 'down' ? '<span class="chip r">Downtrend</span>' : '<span class="chip">Sideways</span>'; }
  function patChips(pats) {
    return (pats || []).filter(p => p.dir !== 'neutral').slice(0, 2).map(p => `<span class="chip ${p.dir === 'bull' ? 'g' : 'r'}">${p.dir === 'bull' ? '▲' : '▼'} ${esc(PAT[p.id][0])}${p.ago ? ` (${p.ago} ago)` : ''}</span>`).join('');
  }
  function pastChip(bt, side) {
    if (!bt) return '';
    const w = side === 'buy' ? bt.b : bt.s, n = side === 'buy' ? bt.bn : bt.sn, g = side === 'buy' ? bt.bg : bt.sg;
    if (!n) return '';
    const base = side === 'buy' ? bt.base : (bt.base != null ? 100 - bt.base : null);
    const cls = g === 'Historically reliable' ? 'g' : g === 'Slight edge (could be luck)' ? 'b' : g === 'No real edge' ? 'y' : '';
    return `<span class="chip ${cls}" title="${esc(g)}">Past: worked ${w}% of ${n} times (normal ${base}%)</span>`;
  }

  function rowHTML(r) {
    const d = r.d, price = r.live ? r.live.p : d.p, lt = tvLive(r.x);
    let right = `<div class="px num" ${lt ? `data-live="${esc(lt)}"` : ''}><span class="lp">${price != null ? chartFmt(price, decimalsOf(price)) : '–'}</span><div class="lc ${d.ch >= 0 ? 'up' : 'down'}" style="font-size:13px">${pct(d.ch, 2)}</div></div>`;
    let why = '';
    if (S.tab === 'cfd') {
      const t = tfData(r, S.ctf), sc = S.side === 'buy' ? t.b : t.s, col = S.side === 'buy' ? 'var(--up)' : 'var(--down)';
      why = `<span class="score ${S.side === 'buy' ? 'up' : 'down'}">${S.side === 'buy' ? '▲' : '▼'} ${sc} ${meter(sc, col)}</span>${trendChip(t.tr)}${patChips(t.pat)}<span class="chip">RSI ${Math.round(t.r)}</span>${pastChip(t.bt, S.side)}${S.ctf !== '1d' ? `<span class="chip b">${TF_LABEL[S.ctf]}</span>` : ''}`;
    } else if (S.tab === 'inv_strong' || S.tab === 'inv_weak') {
      const v = d.inv, good = S.tab === 'inv_strong';
      why = `<span class="score ${good ? 'up' : 'down'}">Long-term ${v.score} ${meter(v.score, good ? 'var(--up)' : 'var(--down)')}</span>
        <span class="chip ${v.ret12m >= 0 ? 'g' : 'r'}">12 months ${pct(v.ret12m)}</span><span class="chip ${v.ret6m >= 0 ? 'g' : 'r'}">6 months ${pct(v.ret6m)}</span>
        <span class="chip">${v.from_high > -1 ? 'At 52-week high' : pct(v.from_high) + ' from 52-week high'}</span><span class="chip ${v.vol > 45 ? 'y' : ''}">Volatility ${v.vol}%</span>`;
    } else if (S.tab === 'avoid') {
      why = `<span class="chip">▲ Buy score ${d.b}</span><span class="chip">▼ Sell score ${d.s}</span>${trendChip(d.tr)}<span class="chip y">No clear direction</span>`;
    } else {
      why = `<span class="chip ${d.b >= 70 ? 'g' : ''}">▲ ${d.b ?? '–'}</span><span class="chip ${d.s >= 70 ? 'r' : ''}">▼ ${d.s ?? '–'}</span>${trendChip(d.tr)}${d.inv ? `<span class="chip">Long-term ${d.inv.score}</span>` : ''}`;
    }
    const tags = isTV() ? (r.tvo ? 'Thai SET (not on XTB)' : '') : [r.cfd ? 'CFD' : '', r.real ? 'Real shares' : ''].filter(Boolean).join(' · ');
    return `<button class="row" data-x="${esc(r.x)}">
      <div class="name">${esc(r.n)}<span class="sym">${esc(shownSym(r))}</span><div class="faint" style="font-size:12px;font-weight:400">${esc(r.ty)} · ${esc(r.m)}${tags ? ' · ' + tags : ''}${d.lq ? ' · trades ' + money(d.lq) + ' ' + esc(r.cur || '') + '/day' : ''}</div></div>
      ${right}<div class="why">${why}</div></button>`;
  }
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

  async function viewInstrument(x, tf) {
    navTabs(null);
    const row = S.summary.rows.find(r => r.x === x);
    $('#view').innerHTML = '<div class="empty">Loading chart…</div>';
    let det;
    try { det = await loadDetail(x); } catch (e) { $('#view').innerHTML = `<div class="empty">No chart data for ${esc(x)} yet.</div>`; return; }
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
      <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '${S.back}')">← Back to list</button>
      <div class="ihead">
        <div><h2>${esc(m.name)}</h2>
          <div class="faint" style="font-size:13px">${esc(m.type)} · ${esc(m.market)} · ${[m.cfd ? 'CFD' : '', m.real ? 'Real shares' : ''].filter(Boolean).join(' · ')}</div></div>
        <div ${lt ? `data-live="${esc(lt)}"` : ''}><span class="big num lp">${chartFmt(price, T.dp)}</span> <span class="lc ${ch >= 0 ? 'up' : 'down'} num">${pct(ch, 2)}</span>
          <div class="faint lnote" style="font-size:12.5px">${lt ? 'Waiting for live price…' : 'Price from the last scan (no live feed for this one)'}</div></div>
        <div class="spacer"></div>
        <div class="symbox"><span class="faint" style="font-size:13px">${isTV() ? 'TradingView' : 'XTB'} symbol</span> <b>${esc(sym)}</b> <button class="copy" id="copy">Copy</button>
          <a class="copy" href="${tvLink(x)}" target="_blank" rel="noopener">Open in TradingView ↗</a></div>
      </div>
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
        ${studyCard(study, T)}
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
    return `<div class="card"><h3>Setup score <small>0–100, alerts at 70+</small></h3>
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
    return `<div class="card"><h3>Past record <small>${TF_LABEL[tf]} chart, this instrument</small></h3>${one(T.bt.bull, 'buy')}${one(T.bt.bear, 'sell')}
      <div class="note">"Normal" is what happened on every candle, so a signal is only useful if it beats it. Fewer than 15 examples = too few to judge.</div></div>`;
  }

  function investCard(v) {
    return `<div class="card"><h3>Long-term score <small>for investing (months–years)</small></h3>
      <div class="bigscore"><div><span class="muted">Score</span><b class="num ${v.score >= 70 ? 'up' : v.score <= 30 ? 'down' : ''}">${v.score}</b></div><div><span class="muted">12 months</span><b class="num ${v.ret12m >= 0 ? 'up' : 'down'}">${pct(v.ret12m)}</b></div></div>
      ${v.parts ? `<ul class="checks">${v.parts.map(p => `<li><span class="ic">${p.ok ? '✅' : '▫️'}</span><span class="${p.ok ? '' : 'faint'}">${esc(p.text)}</span><span class="pts">+${p.pts}</span></li>`).join('')}</ul>` : ''}
      <div class="note">Price trend only. Company results (earnings, revenue, debt) come in a later update.</div></div>`;
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
    const q = {};            // ticker -> {p, ch, mode, rec}
    let busy = false, again = false, okAt = 0, failed = 0, timer = null;
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
      document.querySelectorAll('[data-live]').forEach(e => s.add(e.dataset.live));
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
          const res = await fetch(URL_SCAN, { method: 'POST', body: JSON.stringify({ symbols: { tickers: tickers.slice(i, i + 400) }, columns: ['close', 'change', 'update_mode', 'Recommend.All'] }) });
          if (!res.ok) throw new Error(res.status);
          const js = await res.json();
          for (const r of js.data || []) q[r.s] = { p: r.d[0], ch: r.d[1], mode: r.d[2] || '', rec: r.d[3] };
        }
        okAt = Date.now(); failed = 0;
      } catch (e) { failed++; }
      busy = false;
      paint();
      if (again) { again = false; poll(); }
    }

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
    return { start, poll, paint };
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
    const pool = S.summary.rows.filter(r => r.cfd && (r.d.lq || 0) > 2e7 || !isStockLike(r));
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
