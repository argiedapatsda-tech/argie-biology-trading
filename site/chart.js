/* Candlestick chart on <canvas>: price + volume + RSI, pattern markers,
   support/resistance lines. Drag = move, wheel / pinch = zoom, tap = details. */
(function () {
  const C = {
    up: '#2ec27e', down: '#f0555a', grid: '#1c2733', axis: '#6b7d8f', text: '#9fb0c0',
    sma50: '#5aa9ff', sma200: '#e5a83b', sup: 'rgba(46,194,126,.55)', res: 'rgba(240,85,90,.55)',
    cross: 'rgba(230,237,243,.35)', rsi: '#b48cff', vol: 'rgba(159,176,192,.22)'
  };

  function sma(a, n) {
    const out = new Array(a.length).fill(null); let s = 0;
    for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
  }
  function rsi(a, n = 14) {
    const out = new Array(a.length).fill(null); let g = 0, l = 0;
    for (let i = 1; i < a.length; i++) {
      const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i === 1) { g = up; l = dn; } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
      if (i >= n) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  }

  class CandleChart {
    constructor(box, opts = {}) {
      this.box = box; this.opts = opts;
      this.cv = document.createElement('canvas'); box.appendChild(this.cv);
      this.tip = document.createElement('div'); this.tip.className = 'tip hidden'; box.appendChild(this.tip);
      this.ctx = this.cv.getContext('2d');
      this.hover = -1; this.pointers = new Map();
      this._bind();
      this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(box);
    }
    setData(d) {
      // d: {t,o,h,l,c,v, dp, marks:[[i,pid,dir,name]], levels, limit}
      this.d = d;
      this.n = d.c.length;
      this.sma50 = sma(d.c, 50); this.sma200 = sma(d.c, 200); this.rsi = rsi(d.c);
      this.hasVol = d.v.some(x => x > 0);
      this.marksAt = {};
      (d.marks || []).forEach(m => { (this.marksAt[m[0]] = this.marksAt[m[0]] || []).push(m); });
      const last = (d.limit != null ? d.limit : this.n - 1);
      const span = Math.min(this.box.clientWidth < 600 ? 70 : 120, last + 1);
      this.end = last + 3; this.start = Math.max(0, this.end - span);
      this.hover = -1; this.draw();
    }
    setLimit(limit) { this.d.limit = limit; this.draw(); }
    destroy() { this.ro.disconnect(); this.box.innerHTML = ''; }

    _bind() {
      const cv = this.cv;
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, t: Date.now(), s0: this.start, e0: this.end });
        if (this.pointers.size === 2) { const p = [...this.pointers.values()]; this.pinch0 = { dist: Math.abs(p[0].x - p[1].x) || 1, s: this.start, e: this.end }; }
      });
      cv.addEventListener('pointermove', e => {
        const p = this.pointers.get(e.pointerId);
        if (!p) { this._setHover(e.offsetX); return; }
        p.x = e.offsetX; p.y = e.offsetY;
        if (this.pointers.size === 2 && this.pinch0) {
          const ps = [...this.pointers.values()]; const dist = Math.abs(ps[0].x - ps[1].x) || 1;
          const span0 = this.pinch0.e - this.pinch0.s; const span = Math.max(15, Math.min(this._maxIdx() + 1, span0 * this.pinch0.dist / dist));
          const mid = (this.pinch0.s + this.pinch0.e) / 2;
          this.start = mid - span / 2; this.end = mid + span / 2; this._clamp(); this.draw(); return;
        }
        const dx = e.offsetX - p.sx;
        if (Math.abs(dx) > 4) {
          const per = (p.e0 - p.s0) / this.plotW;
          this.start = p.s0 - dx * per; this.end = p.e0 - dx * per; this._clamp(); this.hover = -1; this.draw();
        } else if (e.pointerType === 'mouse') this._setHover(e.offsetX);
      });
      const up = e => {
        const p = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch0 = null;
        if (p && Math.abs(e.offsetX - p.sx) <= 4 && Date.now() - p.t < 500) {
          this._setHover(e.offsetX);
          const i = this.hover; if (i >= 0 && this.marksAt[i] && this.opts.onMark) this.opts.onMark(i, this.marksAt[i]);
        }
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !this.pointers.size) { this.hover = -1; this.draw(); } });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        const f = e.deltaY > 0 ? 1.12 : 1 / 1.12; const span = this.end - this.start;
        const ns = Math.max(15, Math.min(this._maxIdx() + 1, span * f));
        const at = this.start + (e.offsetX - this.padL) / this.plotW * span; const r = (at - this.start) / span;
        this.start = at - ns * r; this.end = this.start + ns; this._clamp(); this.draw();
      }, { passive: false });
    }
    _maxIdx() { return this.d.limit != null ? this.d.limit : this.n - 1; }
    _clamp() {
      const span = this.end - this.start, max = this._maxIdx() + 3;
      if (this.end > max) { this.end = max; this.start = max - span; }
      if (this.start < -2) { this.start = -2; this.end = this.start + span; }
    }
    _setHover(x) {
      const i = Math.round(this.start + (x - this.padL) / this.plotW * (this.end - this.start) - 0.5);
      this.hover = (i >= 0 && i <= this._maxIdx()) ? i : -1; this.draw();
    }

    draw() {
      if (!this.d) return;
      const W = this.box.clientWidth, H = this.opts.height || (W < 600 ? 360 : 480), dpr = window.devicePixelRatio || 1;
      this.cv.width = W * dpr; this.cv.height = H * dpr; this.cv.style.height = H + 'px';
      const g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const d = this.d, dp = d.dp, last = this._maxIdx();
      this.padL = 6; const padR = W < 600 ? 58 : 70; this.plotW = W - this.padL - padR;
      const rsiH = Math.round(H * 0.2), timeH = 20, priceH = H - rsiH - timeH - 8;
      const s = Math.max(0, Math.floor(this.start)), e = Math.min(last, Math.ceil(this.end));
      if (e <= s) return;
      let lo = Infinity, hi = -Infinity, vmax = 0;
      for (let i = s; i <= e; i++) {
        lo = Math.min(lo, d.l[i]); hi = Math.max(hi, d.h[i]); vmax = Math.max(vmax, d.v[i]);
        for (const a of [this.sma50[i], this.sma200[i]]) if (a != null) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
      }
      const padP = (hi - lo) * 0.08 || hi * 0.01; lo -= padP; hi += padP;
      const span = this.end - this.start, cw = this.plotW / span;
      const X = i => this.padL + (i - this.start + 0.5) * cw;
      const Y = p => 6 + (hi - p) / (hi - lo) * (priceH - 6);
      const rTop = priceH + 8, RY = v => rTop + (100 - v) / 100 * rsiH;

      // grid + price axis
      g.font = '11px system-ui,sans-serif'; g.textBaseline = 'middle';
      const step = niceStep((hi - lo) / 6);
      g.strokeStyle = C.grid; g.lineWidth = 1; g.fillStyle = C.axis;
      for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) {
        const y = Math.round(Y(p)) + .5; g.beginPath(); g.moveTo(this.padL, y); g.lineTo(W - padR, y); g.stroke();
        g.fillText(fmt(p, axisDp(step, dp)), W - padR + 6, y);
      }
      // time labels
      g.textBaseline = 'alphabetic'; g.fillStyle = C.axis;
      const every = Math.max(1, Math.round(90 / cw));
      for (let i = s; i <= e; i++) if (i % every === 0) g.fillText(tlabel(d.t[i], d.tf), X(i) - 16, H - 5);

      // support / resistance
      (d.levels ? [...d.levels.sup.map(L => [L, C.sup]), ...d.levels.res.map(L => [L, C.res])] : []).forEach(([L, col]) => {
        if (L.p < lo || L.p > hi) return; const y = Math.round(Y(L.p)) + .5;
        g.setLineDash([5, 5]); g.strokeStyle = col; g.beginPath(); g.moveTo(this.padL, y); g.lineTo(W - padR, y); g.stroke(); g.setLineDash([]);
      });

      // volume
      if (this.hasVol && vmax > 0) {
        g.fillStyle = C.vol; const vh = priceH * 0.16;
        for (let i = s; i <= e; i++) { const h = d.v[i] / vmax * vh; g.fillRect(X(i) - cw * 0.35, priceH - h, cw * 0.7, h); }
      }
      // candles
      const bw = Math.max(1, cw * 0.66);
      for (let i = s; i <= e; i++) {
        const up = d.c[i] >= d.o[i]; g.strokeStyle = g.fillStyle = up ? C.up : C.down;
        const x = Math.round(X(i)) + .5; g.beginPath(); g.moveTo(x, Y(d.h[i])); g.lineTo(x, Y(d.l[i])); g.stroke();
        const y1 = Y(Math.max(d.o[i], d.c[i])), y2 = Y(Math.min(d.o[i], d.c[i]));
        g.fillRect(X(i) - bw / 2, y1, bw, Math.max(1, y2 - y1));
      }
      // averages
      line(g, this.sma50, s, e, X, Y, C.sma50); line(g, this.sma200, s, e, X, Y, C.sma200);
      // pattern markers
      g.font = 'bold 11px system-ui,sans-serif'; g.textAlign = 'center';
      for (let i = s; i <= e; i++) {
        const ms = this.marksAt[i]; if (!ms) continue;
        const dirs = new Set(ms.map(m => m[2]));
        if (dirs.has('bull')) { g.fillStyle = C.up; tri(g, X(i), Y(d.l[i]) + 10, 5, 1); }
        if (dirs.has('bear')) { g.fillStyle = C.down; tri(g, X(i), Y(d.h[i]) - 10, 5, -1); }
        if (dirs.has('neutral') && !dirs.has('bull') && !dirs.has('bear')) { g.fillStyle = C.axis; g.beginPath(); g.arc(X(i), Y(d.h[i]) - 8, 2.5, 0, 7); g.fill(); }
      }
      g.textAlign = 'left';
      // RSI pane
      g.strokeStyle = C.grid; g.strokeRect(this.padL + .5, rTop + .5, this.plotW, rsiH);
      g.setLineDash([3, 4]); [30, 70].forEach(v => { g.beginPath(); g.moveTo(this.padL, RY(v)); g.lineTo(W - padR, RY(v)); g.stroke(); }); g.setLineDash([]);
      g.fillStyle = C.axis; g.font = '11px system-ui,sans-serif'; g.textBaseline = 'middle';
      g.fillText('RSI', W - padR + 6, rTop + 10); g.fillText('70', W - padR + 6, RY(70)); g.fillText('30', W - padR + 6, RY(30));
      line(g, this.rsi, s, e, X, RY, C.rsi);
      // hidden future (practice mode)
      if (d.limit != null && d.limit < this.n - 1) {
        const x = X(d.limit) + cw / 2; g.fillStyle = 'rgba(90,169,255,.08)'; g.fillRect(x, 0, W - padR - x, H - timeH);
        g.fillStyle = C.text; g.fillText('?', x + 10, priceH / 2);
      }
      // crosshair + tooltip
      if (this.hover >= s && this.hover <= e) {
        const i = this.hover, x = Math.round(X(i)) + .5;
        g.strokeStyle = C.cross; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H - timeH); g.stroke(); g.setLineDash([]);
        const ch = i > 0 ? (d.c[i] / d.c[i - 1] - 1) * 100 : 0;
        const pats = (this.marksAt[i] || []).map(m => `<div class="${m[2] === 'bull' ? 'up' : m[2] === 'bear' ? 'down' : 'muted'}">${m[2] === 'bull' ? '▲' : m[2] === 'bear' ? '▼' : '•'} ${m[3]}</div>`).join('');
        this.tip.innerHTML = `<div class="faint">${tfull(d.t[i], d.tf)}</div>
          <div class="num">O ${fmt(d.o[i], dp)} H ${fmt(d.h[i], dp)}<br>L ${fmt(d.l[i], dp)} C ${fmt(d.c[i], dp)} <span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span></div>
          ${this.rsi[i] != null ? `<div class="faint">RSI ${this.rsi[i].toFixed(0)}</div>` : ''}${pats}${pats ? '<div class="faint">Tap the candle to learn about it</div>' : ''}`;
        this.tip.classList.remove('hidden');
        this.tip.style.left = (x > W / 2 ? 8 : W - padR - 250) + 'px';
      } else this.tip.classList.add('hidden');
    }
  }
  function line(g, arr, s, e, X, Y, col) {
    g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); let on = false;
    for (let i = s; i <= e; i++) { const v = arr[i]; if (v == null) { on = false; continue; } if (!on) { g.moveTo(X(i), Y(v)); on = true; } else g.lineTo(X(i), Y(v)); }
    g.stroke(); g.lineWidth = 1;
  }
  function tri(g, x, y, r, dir) { g.beginPath(); g.moveTo(x, y - dir * r); g.lineTo(x - r, y + dir * r); g.lineTo(x + r, y + dir * r); g.closePath(); g.fill(); }
  // axis labels only need as many decimals as the grid step has
  function axisDp(step, dp) { return Math.min(dp, Math.max(0, -Math.floor(Math.log10(step) + 1e-9))); }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function fmt(p, dp) { return Number(p).toLocaleString('en-US', { minimumFractionDigits: Math.min(dp, 5), maximumFractionDigits: Math.min(dp, 5) }); }
  function tlabel(t, tf) {
    const d = new Date(t * 1000);
    if (tf === '1d' || tf === '1wk') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return d.toLocaleString('en-GB', { day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function tfull(t, tf) {
    const d = new Date(t * 1000);
    if (tf === '1d' || tf === '1wk') return (tf === '1wk' ? 'Week of ' : '') + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' (your time)';
  }
  window.CandleChart = CandleChart;
  window.chartFmt = fmt;
})();
