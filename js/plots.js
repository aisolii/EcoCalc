/* Модель графиктері: сызықтық график (тінтуірмен көрсеткіш) және гистограмма. Тек SVG, кітапханасыз. */
(function () {
  'use strict';
  const F = window.Fmt;
  const NS = 'http://www.w3.org/2000/svg';

  function niceStep(span, count) {
    const raw = span / count || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  function ticks(min, max, count) {
    const step = niceStep(max - min, count);
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function frame(box, H) {
    box.innerHTML = '';
    box.classList.add('chart-box');
    const W = Math.max(300, box.clientWidth || 600);
    const pad = { l: 60, r: 18, t: 26, b: 42 };
    return { W, H, pad, iw: W - pad.l - pad.r, ih: H - pad.t - pad.b };
  }

  /**
   * series: [{ x: [], y: [], cls, label }]; hlines/vlines: [{ v, label, cls }]; marks: [{ x, y, label, cls }]
   * tip(x) — тінтуір астындағы x үшін HTML
   */
  function line(box, { series, xLabel, yLabel, hlines = [], vlines = [], marks = [], bands = [], tip, yMin, yMax, xMax, H = 280, aria, xFmt }) {
    const f = frame(box, H);
    const xs = series.flatMap((s) => s.x);
    const ys = series.flatMap((s) => s.y).concat(hlines.map((h) => h.v), marks.map((m) => m.y), bands.flatMap((b) => b.hi));
    const x1 = xMax ?? Math.max(...xs);
    let lo = yMin ?? Math.min(0, ...ys);
    let hi = yMax ?? Math.max(...ys);
    if (hi <= lo) hi = lo + 1;
    const padY = (hi - lo) * 0.08;
    if (yMin == null && lo < 0) lo -= padY;
    hi += padY;
    const X = (v) => f.pad.l + (v / x1) * f.iw;
    const Y = (v) => f.pad.t + (1 - (v - lo) / (hi - lo)) * f.ih;

    const svg = el('svg', { viewBox: `0 0 ${f.W} ${H}`, width: f.W, height: H, class: 'chart', role: 'img', 'aria-label': aria || '' }, box);
    const grid = el('g', { class: 'chart__grid' }, svg);
    for (const v of ticks(lo, hi, 4)) {
      el('line', { x1: f.pad.l, x2: f.W - f.pad.r, y1: Y(v), y2: Y(v) }, grid);
      el('text', { x: f.pad.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'chart__tick' }, grid).textContent = F.num(v, Math.abs(hi - lo) < 5 ? 1 : 0);
    }
    for (const v of ticks(0, x1, 6)) {
      el('text', { x: X(v), y: H - f.pad.b + 18, 'text-anchor': 'middle', class: 'chart__tick' }, grid).textContent = xFmt ? xFmt(v) : F.num(v, 1);
    }
    for (const b of bands) {
      const top = b.x.map((x, i) => `${X(x).toFixed(1)},${Y(b.hi[i]).toFixed(1)}`);
      const bot = b.x.map((x, i) => `${X(x).toFixed(1)},${Y(b.lo[i]).toFixed(1)}`).reverse();
      el('polygon', { points: top.concat(bot).join(' '), class: b.cls || 'chart__band' }, svg);
    }
    if (lo < 0 && hi > 0) el('line', { x1: f.pad.l, x2: f.W - f.pad.r, y1: Y(0), y2: Y(0), class: 'chart__axis' }, svg);
    else el('line', { x1: f.pad.l, x2: f.W - f.pad.r, y1: Y(lo), y2: Y(lo), class: 'chart__axis' }, svg);
    el('text', { x: f.W - f.pad.r, y: H - 6, 'text-anchor': 'end', class: 'chart__label' }, svg).textContent = xLabel || '';
    el('text', { x: f.pad.l + 4, y: f.pad.t - 12, class: 'chart__label' }, svg).textContent = yLabel || '';

    for (const h of hlines) {
      el('line', { x1: f.pad.l, x2: f.W - f.pad.r, y1: Y(h.v), y2: Y(h.v), class: h.cls || 'chart__ref' }, svg);
      if (h.label) el('text', { x: f.W - f.pad.r - 4, y: Y(h.v) - 6, 'text-anchor': 'end', class: 'chart__note' }, svg).textContent = h.label;
    }
    for (const v of vlines) {
      el('line', { x1: X(v.v), x2: X(v.v), y1: f.pad.t, y2: f.pad.t + f.ih, class: v.cls || 'chart__guide' }, svg);
      if (v.label) el('text', { x: X(v.v) - 4, y: f.pad.t + 12, 'text-anchor': 'end', class: 'chart__note' }, svg).textContent = v.label;
    }
    for (const s of series) {
      const d = s.x.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(s.y[i]).toFixed(1)}`).join('');
      if (s.dots) {
        s.x.forEach((x, i) => el('circle', { cx: X(x), cy: Y(s.y[i]), r: 4.5, class: s.cls }, svg));
      } else {
        el('path', { d, class: s.cls, fill: 'none' }, svg);
      }
      if (s.label && !s.dots) {
        const i = Math.floor(s.x.length * 0.82);
        el('text', { x: X(s.x[i]), y: Y(s.y[i]) - 8, 'text-anchor': 'middle', class: 'chart__note' }, svg).textContent = s.label;
      }
    }
    for (const m of marks) {
      el('circle', { cx: X(m.x), cy: Y(m.y), r: 5, class: m.cls || 'chart__star' }, svg);
      if (m.label) {
        const right = X(m.x) < f.pad.l + f.iw * 0.7;
        el('text', { x: X(m.x) + (right ? 9 : -9), y: Y(m.y) - 10, 'text-anchor': right ? 'start' : 'end', class: 'chart__note' }, svg).textContent = m.label;
      }
    }

    if (tip) {
      const hover = el('g', { class: 'chart__hover', visibility: 'hidden' }, svg);
      const vl = el('line', { y1: f.pad.t, y2: f.pad.t + f.ih }, hover);
      const tipBox = document.createElement('div');
      tipBox.className = 'chart__tip';
      tipBox.hidden = true;
      box.appendChild(tipBox);
      const hit = el('rect', { x: f.pad.l, y: f.pad.t, width: f.iw, height: f.ih, fill: 'transparent' }, svg);
      const move = (e) => {
        const r = svg.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * f.W;
        const xv = Math.min(x1, Math.max(0, ((px - f.pad.l) / f.iw) * x1));
        vl.setAttribute('x1', X(xv)); vl.setAttribute('x2', X(xv));
        hover.setAttribute('visibility', 'visible');
        tipBox.hidden = false;
        tipBox.innerHTML = tip(xv);
        tipBox.style.left = Math.min(r.width - 180, (X(xv) / f.W) * r.width + 12) + 'px';
      };
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { hover.setAttribute('visibility', 'hidden'); tipBox.hidden = true; });
    }
  }

  /** Гистограмма: bins [{x0, x1, count}]; нөлден кіші бағандар залал аймағында. */
  function histogram(box, { bins, n, xLabel, marks = [], H = 260, aria, fmt = F.money, zeroSplit = true }) {
    const f = frame(box, H);
    const lo = bins[0].x0, hi = bins[bins.length - 1].x1;
    const maxC = Math.max(...bins.map((b) => b.count));
    const X = (v) => f.pad.l + ((v - lo) / (hi - lo || 1)) * f.iw;
    const Y = (c) => f.pad.t + (1 - c / maxC) * f.ih;
    const svg = el('svg', { viewBox: `0 0 ${f.W} ${H}`, width: f.W, height: H, class: 'chart', role: 'img', 'aria-label': aria || '' }, box);
    const grid = el('g', { class: 'chart__grid' }, svg);
    for (const v of ticks(0, maxC / n * 100, 4)) {
      const c = (v / 100) * n;
      el('line', { x1: f.pad.l, x2: f.W - f.pad.r, y1: Y(c), y2: Y(c) }, grid);
      el('text', { x: f.pad.l - 8, y: Y(c) + 4, 'text-anchor': 'end', class: 'chart__tick' }, grid).textContent = F.num(v, 1) + '%';
    }
    for (const v of ticks(lo, hi, 6)) {
      el('text', { x: X(v), y: H - f.pad.b + 18, 'text-anchor': 'middle', class: 'chart__tick' }, grid).textContent = F.num(v, hi - lo < 5 ? 2 : 0);
    }
    if (zeroSplit && lo < 0 && hi > 0) el('rect', { x: f.pad.l, y: f.pad.t, width: X(0) - f.pad.l, height: f.ih, class: 'chart__loss' }, svg);
    const tipBox = document.createElement('div');
    tipBox.className = 'chart__tip';
    tipBox.hidden = true;
    box.appendChild(tipBox);
    for (const b of bins) {
      const w = Math.max(1, X(b.x1) - X(b.x0) - 2);
      const rect = el('rect', { x: X(b.x0) + 1, y: Y(b.count), width: w, height: Math.max(0, f.pad.t + f.ih - Y(b.count)), rx: 2, class: 'chart__bar' }, svg);
      const show = () => {
        tipBox.hidden = false;
        tipBox.innerHTML = `<b>${fmt(b.x0)} … ${fmt(b.x1)}</b><span>Үлесі</span><span>${F.pct((b.count / n) * 100)}</span>`;
        const r = svg.getBoundingClientRect();
        tipBox.style.left = Math.min(r.width - 180, (X(b.x1) / f.W) * r.width + 8) + 'px';
      };
      rect.addEventListener('pointerenter', show);
      rect.addEventListener('pointerdown', show);
      rect.addEventListener('pointerleave', () => { tipBox.hidden = true; });
    }
    el('line', { x1: f.pad.l, x2: f.W - f.pad.r, y1: f.pad.t + f.ih, y2: f.pad.t + f.ih, class: 'chart__axis' }, svg);
    if (zeroSplit && lo < 0 && hi > 0) {
      el('line', { x1: X(0), x2: X(0), y1: f.pad.t, y2: f.pad.t + f.ih, class: 'chart__zero' }, svg);
      el('text', { x: X(0) - 6, y: f.pad.t + 12, 'text-anchor': 'end', class: 'chart__note' }, svg).textContent = 'залал';
      el('text', { x: X(0) + 6, y: f.pad.t + 12, class: 'chart__note' }, svg).textContent = 'пайда';
    }
    for (const m of marks) {
      el('line', { x1: X(m.v), x2: X(m.v), y1: f.pad.t + 18, y2: f.pad.t + f.ih, class: 'chart__guide' }, svg);
      el('text', { x: X(m.v), y: f.pad.t + 30, 'text-anchor': 'middle', class: 'chart__note' }, svg).textContent = m.label;
    }
    el('text', { x: f.W - f.pad.r, y: H - 6, 'text-anchor': 'end', class: 'chart__label' }, svg).textContent = xLabel || '';
  }

  window.Plots = { line, histogram };
})();
