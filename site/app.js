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
  const S = { summary: null, patterns: {}, tab: 'cfd', side: 'buy', ctf: '1d', shown: 50, filt: { q: '', m: '', ty: '', lq: '0' }, chart: null, detailCache: {} };
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

  // ---------------------------------------------------------------- tabs
  const TABS = {
    cfd: {
      label: 'Strong CFD setups', short: 'CFD setups',
      intro: () => `Instruments where several signals line up right now. <b>Buy side</b> = upward setups, <b>Sell side</b> = downward setups (with CFDs you can profit from a fall). Score 0–100; only scores of 70+ are listed. Daily and Weekly cover everything; 4H / 1H only cover the ${S.summary ? S.summary.fast.length : ''} instruments in the fast-watch list.`,
      filter: r => { const t = tfData(r, S.ctf); return r.cfd && t && (S.side === 'buy' ? t.b >= 70 : t.s >= 70); },
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
      intro: () => 'CFD instruments with <b>no clear direction</b> on the Daily chart: both the buy and the sell score are under 40. Signals conflict here, so trades are more of a coin flip. Usually better to wait.',
      filter: r => r.cfd && r.d.b != null && r.d.b < 40 && r.d.s < 40,
      sort: (a, b) => (b.d.lq || 0) - (a.d.lq || 0),
    },
    all: {
      label: 'Search all', short: 'All',
      intro: () => 'Every instrument we scan. Type a name or XTB symbol.',
      filter: () => true,
      sort: (a, b) => (b.d.lq || 0) - (a.d.lq || 0),
    },
  };

  // ---------------------------------------------------------------- boot
  async function boot() {
    const choice = store.get('mode', null);
    if (choice) showApp(); else $('#start').classList.remove('hidden');
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      if ($('#remember').checked) store.set('mode', b.dataset.mode);
      showApp();
    }));
    window.addEventListener('hashchange', route);
  }

  async function showApp() {
    $('#start').classList.add('hidden'); $('#app').classList.remove('hidden');
    $('#modeSwitch').onclick = () => { store.set('mode', null); location.hash = ''; location.reload(); };
    $('#view').innerHTML = '<div class="empty">Loading the latest data…</div>';
    try {
      const [sum, pats] = await Promise.all([fetchJSON('data/summary.json'), fetchJSON('data/patterns.json').catch(() => ({}))]);
      S.summary = sum; S.patterns = pats;
    } catch (e) {
      $('#view').innerHTML = `<div class="empty">Could not load the data (${esc(e.message)}).<br>If the site was just created, the first scan may still be running - try again in a few minutes.</div>`;
      return;
    }
    $('#updated').textContent = (narrow() ? '' : 'Updated ') + ago(S.summary.generated);
    if (narrow()) { $('#modeSwitch').textContent = '⇄'; $('#modeSwitch').setAttribute('aria-label', 'Switch platform'); }
    $('#updated').title = `Full scan: ${S.summary.full_scan || '-'}\nFast scan: ${S.summary.fast_scan || '-'}`;
    route();
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
    if (h[0] === 'list' && TABS[h[1]]) S.tab = h[1];
    viewList();
  }

  function navTabs(active) {
    const items = Object.entries(TABS).map(([k, t]) => `<button class="tab ${active === k ? 'on' : ''}" data-go="#/list/${k}">${t.label}</button>`);
    items.push(`<button class="tab ${active === 'library' ? 'on' : ''}" data-go="#/library">Pattern library</button>`);
    items.push(`<button class="tab ${active === 'practice' ? 'on' : ''}" data-go="#/practice">Practice</button>`);
    $('#tabs').innerHTML = items.join('');
    $('#tabs').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.hash = b.dataset.go; });
  }

  // ---------------------------------------------------------------- list view
  function viewList() {
    navTabs(S.tab);
    const T = TABS[S.tab];
    const rows = S.summary.rows;
    const markets = [...new Set(rows.map(r => r.m))].sort();
    const types = [...new Set(rows.map(r => r.ty))].sort();
    const f = S.filt;
    const extra = S.tab === 'cfd' ? `
      <div class="seg" role="group" aria-label="Side"><button data-side="buy" class="${S.side === 'buy' ? 'on' : ''}">▲ Buy side</button><button data-side="sell" class="${S.side === 'sell' ? 'on' : ''}">▼ Sell side</button></div>
      <div class="seg" role="group" aria-label="Timeframe">${['1h', '4h', '1d', '1wk'].map(tf => `<button data-ctf="${tf}" class="${S.ctf === tf ? 'on' : ''}">${TF_LABEL[tf]}</button>`).join('')}</div>` : '';
    $('#view').innerHTML = `
      <p class="intro">${T.intro()}</p>
      <div class="filters">
        ${extra}
        <input id="q" type="search" placeholder="Search name or XTB symbol…" value="${esc(f.q)}" aria-label="Search">
        <select id="fm" aria-label="Market"><option value="">All markets</option>${markets.map(m => `<option ${f.m === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        <select id="fty" aria-label="Type"><option value="">All types</option>${types.map(m => `<option ${f.ty === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        <select id="flq" aria-label="Minimum trading"><option value="0">Any trading volume</option>
          <option value="1e6" ${f.lq === '1e6' ? 'selected' : ''}>Trades > 1M per day</option>
          <option value="1e7" ${f.lq === '1e7' ? 'selected' : ''}>Trades > 10M per day</option>
          <option value="1e8" ${f.lq === '1e8' ? 'selected' : ''}>Trades > 100M per day</option></select>
      </div>
      <div id="count" class="faint" style="font-size:13px;margin-bottom:8px"></div>
      <div class="rows" id="rows"></div>`;
    const rerender = () => { S.shown = 50; renderRows(); };
    $('#q').oninput = e => { f.q = e.target.value; rerender(); };
    $('#fm').onchange = e => { f.m = e.target.value; rerender(); };
    $('#fty').onchange = e => { f.ty = e.target.value; rerender(); };
    $('#flq').onchange = e => { f.lq = e.target.value; rerender(); };
    document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { S.side = b.dataset.side; viewList(); });
    document.querySelectorAll('[data-ctf]').forEach(b => b.onclick = () => { S.ctf = b.dataset.ctf; viewList(); });
    renderRows();
  }

  function renderRows() {
    const T = TABS[S.tab], f = S.filt, q = f.q.trim().toLowerCase(), minLq = +f.lq;
    let list = S.summary.rows.filter(r => {
      if (f.m && r.m !== f.m) return false;
      if (f.ty && r.ty !== f.ty) return false;
      if (minLq && r.d.lq != null && r.d.lq < minLq) return false;
      if (q && !(r.n.toLowerCase().includes(q) || r.x.toLowerCase().includes(q))) return false;
      try { return T.filter(r); } catch (e) { return false; }
    });
    list.sort(T.sort);
    $('#count').textContent = `${list.length.toLocaleString()} match${list.length === 1 ? '' : 'es'}`;
    if (!list.length) { $('#rows').innerHTML = '<div class="empty">Nothing matches right now. Try another timeframe, side or filter.</div>'; return; }
    $('#rows').innerHTML = list.slice(0, S.shown).map(rowHTML).join('') +
      (list.length > S.shown ? `<button class="more" id="more">Show more (${(list.length - S.shown).toLocaleString()} left)</button>` : '');
    $('#rows').querySelectorAll('[data-x]').forEach(b => b.onclick = () => { location.hash = `#/i/${encodeURIComponent(b.dataset.x)}/${S.tab === 'cfd' ? S.ctf : '1d'}`; });
    const m = $('#more'); if (m) m.onclick = () => { S.shown += 50; renderRows(); };
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
    const d = r.d, price = r.live ? r.live.p : d.p;
    let right = `<div class="px num">${price != null ? chartFmt(price, decimalsOf(price)) : '–'}<div class="${d.ch >= 0 ? 'up' : 'down'}" style="font-size:13px">${pct(d.ch, 2)}</div></div>`;
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
    const tags = [r.cfd ? 'CFD' : '', r.real ? 'Real shares' : ''].filter(Boolean).join(' · ');
    return `<button class="row" data-x="${esc(r.x)}">
      <div class="name">${esc(r.n)}<span class="sym">${esc(r.x)}</span><div class="faint" style="font-size:12px;font-weight:400">${esc(r.ty)} · ${esc(r.m)}${tags ? ' · ' + tags : ''}${d.lq ? ' · trades ' + money(d.lq) + ' ' + esc(r.cur || '') + '/day' : ''}</div></div>
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
    const price = d.c[d.c.length - 1], prev = d.c[d.c.length - 2], ch = (price / prev - 1) * 100;
    d.tf = tf;
    d.marks = T.marks.map(([i, pid]) => [i, pid, PAT[pid][1], PAT[pid][0]]);
    d.levels = { sup: T.levels.sup, res: T.levels.res };

    $('#view').innerHTML = `
      <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '#/list/${S.tab}')">← Back to list</button>
      <div class="ihead">
        <div><h2>${esc(m.name)}</h2>
          <div class="faint" style="font-size:13px">${esc(m.type)} · ${esc(m.market)} · ${[m.cfd ? 'CFD' : '', m.real ? 'Real shares' : ''].filter(Boolean).join(' · ')}</div></div>
        <div><span class="big num">${chartFmt(price, T.dp)}</span> <span class="${ch >= 0 ? 'up' : 'down'} num">${pct(ch, 2)}</span>
          <div class="faint" style="font-size:12.5px">${T.closed ? 'Last candle closed' : 'Last candle still forming'} · ${tf === '1d' || tf === '1wk' ? 'prices may be ~15 min delayed' : 'intraday'}</div></div>
        <div class="spacer"></div>
        <div><span class="faint" style="font-size:13px">XTB symbol</span> <b>${esc(m.xtb)}</b> <button class="copy" id="copy">Copy</button></div>
      </div>
      <div class="tfs">${TF_ORDER.map(k => `<button data-tf="${k}" class="${k === tf ? 'on' : ''}" ${det.tf[k] ? '' : 'disabled title="Only for the fast-watch list"'}>${tfShort(k)}</button>`).join('')}</div>
      <div class="chartbox" id="chart"></div>
      <div class="legend"><span><i style="background:#5aa9ff"></i>50 average</span><span><i style="background:#e5a83b"></i>200 average</span>
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
    $('#copy').onclick = () => { navigator.clipboard?.writeText(m.xtb).then(() => { $('#copy').textContent = 'Copied ✓'; }); };
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
