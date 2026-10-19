// Word audit: run with Playwright MCP browser_run_code_unsafe (filename) against a local copy of site/ served on :8765
// with the live data/summary.json, odds.json, patterns.json, alerts.json. Must return problems: [] before any push
// that touches words, colours, headings, levels or decide(). See the argie-trading-site skill.
async (page) => {
  // Audits every CFD/Investing view at every holding time: word <-> colour, word <-> heading,
  // word <-> sentence, stop/target on the right side of the price, and the same word on every tab.
  const BASE = 'http://localhost:8765/';
  const out = { problems: [], counts: {}, crossChecked: 0 };
  const bad = (where, msg) => { if (out.problems.length < 400) out.problems.push(where + ': ' + msg); };

  const scan = async (label) => page.evaluate((label) => {
    const res = { rows: [], textHits: [] };
    const body = document.querySelector('#view').textContent;
    if (/TRADE\s*▼/.test(body)) res.textHits.push('TRADE ▼ text on page');
    if (/Strong (buy|sell)/.test(body)) res.textHits.push('TradingView Strong buy/sell wording');
    let head = '';
    for (const el of document.querySelectorAll('#view h3, #view .tierhead, #view .row')) {
      if (!el.classList.contains('row')) { head = el.textContent.trim().slice(0, 70); continue; }
      const d = el.querySelector('.dec');
      if (!d) continue;
      const nums = [...el.querySelectorAll('.olevels b.num')].map(b => +b.textContent.replace(/[^0-9.\-]/g, ''));
      const px = el.querySelector('.px .lp, .px');
      res.rows.push({ x: el.dataset.x, head, word: d.textContent.trim(), cls: d.className,
        reason: (el.querySelector('.reason') || {}).textContent || '', nums,
        price: px ? +px.textContent.trim().split(/\s/)[0].replace(/[^0-9.\-]/g, '') : null,
        lv: (el.querySelector('.olevels') || {}).textContent || '',
        ch: (() => { const lc = el.querySelector('.px .lc'); const v = lc && parseFloat(lc.textContent.replace('−', '-')); return isNaN(v) ? null : v; })() });
    }
    return res;
  }, label);

  const check = (where, data, expectSide, words) => {
    data.textHits.forEach(t => bad(where, t));
    for (const r of data.rows) {
      const w = r.word;
      const isUp = /^TRADE NOW ▲$|^BUY$/.test(w), isDown = /^SELL NOW ▼$|^SELL$/.test(w);
      // 1. word <-> colour class
      if (isUp && !/\bbuy\b/.test(r.cls)) bad(where, `${r.x} says ${w} but is not green (${r.cls})`);
      if (isDown && !/\bsell\b/.test(r.cls)) bad(where, `${r.x} says ${w} but is not red (${r.cls})`);
      if (/\bbuy\b/.test(r.cls) && !isUp) bad(where, `${r.x} green badge with word "${w}"`);
      if (/\bsell\b/.test(r.cls) && !isDown) bad(where, `${r.x} red badge with word "${w}"`);
      // 2. word <-> heading / list
      const side = expectSide ? expectSide(r.head) : null;
      if (side === 'up' && !isUp) bad(where, `${r.x} "${w}" under heading "${r.head}"`);
      if (side === 'down' && !isDown) bad(where, `${r.x} "${w}" under heading "${r.head}"`);
      if (/trade/i.test(r.head) && isDown) bad(where, `${r.x} red ${w} under a heading containing "trade": "${r.head}"`);
      // 3. word <-> sentence
      if (isUp && /lower|fell/.test(r.reason) && !/higher|rose/.test(r.reason)) bad(where, `${r.x} ${w} but sentence says lower: ${r.reason.slice(0, 90)}`);
      if (isDown && /higher|rose/.test(r.reason) && !/lower|fell/.test(r.reason)) bad(where, `${r.x} ${w} but sentence says higher: ${r.reason.slice(0, 90)}`);
      // 4. stop / target sides
      if (r.nums.length === 2 && r.price > 0) {
        const [stop, tgt] = r.nums;
        if (isUp && !(stop < r.price && tgt > r.price)) bad(where, `${r.x} ${w}: stop ${stop} / target ${tgt} vs price ${r.price}`);
        if (isDown && !(stop > r.price && tgt < r.price)) bad(where, `${r.x} ${w}: stop ${stop} / target ${tgt} vs price ${r.price}`);
        if (isDown && !/SELL/.test(r.lv)) bad(where, `${r.x} red row but levels text lacks SELL: ${r.lv.slice(0, 80)}`);
        if (isUp && !/BUY|buy/.test(r.lv)) bad(where, `${r.x} green row but levels text lacks BUY: ${r.lv.slice(0, 80)}`);
      }
      // 5. cautious words: never TRADE NOW next to a red day change or SELL NOW next to a green one
      if (r.ch != null && !/^BUY$|^SELL$/.test(w)) {
        if (isUp && r.ch < 0) bad(where, `${r.x} ${w} but today's change is ${r.ch}%`);
        if (isDown && r.ch > 0) bad(where, `${r.x} ${w} but today's change is +${r.ch}%`);
      }
      if (/^WAIT\s*[▲▼]/.test(w) && !/But |Still needs/.test(r.reason)) bad(where, `${r.x} WAIT without saying what is missing: ${r.reason.slice(0, 80)}`);
      if ((isUp || isDown) && !/^BUY$|^SELL$/.test(w) && r.nums.length !== 2) bad(where, `${r.x} ${w} without stop + target levels`);
      // 6. collect for cross-tab comparison (CFD words only)
      if (words && r.x && (isUp || isDown || /^WAIT|^DON'T TRADE|^NO ODDS/.test(w))) {
        const k = isUp ? 'up' : isDown ? 'down' : 'none';
        (words[r.x] = words[r.x] || []).push([where, k]);
      }
    }
    out.counts[where] = data.rows.length;
  };

  const go = async (hash, wait = 2500) => {
    await page.evaluate(h => { location.hash = '#/x'; location.hash = h; }, hash);
    await page.waitForTimeout(wait);
  };
  const showAll = async () => { const m = page.locator('#more'); if (await m.count()) { await m.first().click(); await page.waitForTimeout(3500); } };

  for (const btf of ['15m', '1h', '4h', '1d']) {
    await page.goto(BASE + '?a=' + btf + '#/cfd/now');
    await page.evaluate(b => { localStorage.mode = '"xtb"'; localStorage.btf = JSON.stringify(b); localStorage.cat_cfd = '"all"'; }, btf);
    await page.goto(BASE + '?b=' + btf + '#/cfd/now');
    await page.waitForTimeout(5000);
    const words = {};
    // Overview: show every group in full
    for (let i = 0; i < 40; i++) { const m = page.locator('[data-more]'); if (!(await m.count())) break; await m.first().click(); await page.waitForTimeout(400); }
    check(btf + ' Overview', await scan(), h => /Trade now/.test(h) ? 'up' : /Sell now/.test(h) ? 'down' : null, words);
    await go('#/cfd/forex'); const fa = page.locator('#fxall, [data-fxall]'); if (await fa.count()) { await fa.first().click(); await page.waitForTimeout(1500); }
    check(btf + ' Forex', await scan(), h => /to TRADE NOW/.test(h) ? 'up' : /to SELL NOW/.test(h) ? 'down' : null, words);
    for (const [sub, side] of [['buy', 'up'], ['sell', 'down']]) {
      await go('#/cfd/' + sub); check(btf + ' CFD ' + sub + ' top10', await scan(), () => side, words);
      await showAll(); check(btf + ' CFD ' + sub + ' all', await scan(), () => side, words);
    }
    for (const sd of ['buy', 'sell']) {
      await go('#/cfd/strong'); await page.locator(`[data-side="${sd}"]`).click(); await page.waitForTimeout(2000);
      check(btf + ' Strong ' + sd, await scan(), h => /agree/.test(h) ? (sd === 'buy' ? 'up' : 'down') : null, words);
    }
    await go('#/cfd/avoid'); check(btf + ' Avoid', await scan(), null, words);
    // cross-tab: one instrument, one word
    for (const [x, seen] of Object.entries(words)) {
      const ks = new Set(seen.map(s => s[1]).filter(k => k !== 'none'));
      if (ks.size > 1) bad(btf + ' CROSS-TAB', `${x}: ${seen.map(s => s[0].replace(btf + ' ', '') + '=' + s[1]).join(', ')}`);
      // a TRADE on one tab must not be WAIT on another
      const any = seen.map(s => s[1]);
      if (ks.size === 1 && any.includes('none')) bad(btf + ' CROSS-TAB', `${x}: word on one tab, WAIT on another: ${seen.map(s => s[0].replace(btf + ' ', '') + '=' + s[1]).join(', ')}`);
      out.crossChecked++;
    }
  }
  // Investing tabs (holding time not used)
  for (const [sub, side] of [['buy', 'up'], ['sell', 'down']]) {
    await go('#/inv/' + sub); await showAll(); check('Investing ' + sub, await scan(), () => side, null);
  }
  await go('#/alerts', 4000);
  const al = await scan(); check('Alerts', al, null, null);
  out.alertTradeBadges = al.rows.filter(r => /UP SIGNAL|DOWN SIGNAL/.test(r.word) && /\b(buy|sell)\b/.test(r.cls)).length;
  return out;
}
