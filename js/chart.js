/*
 * Өтелу графигі: түсім R(m) = a·m және жанармай шығыны C.
 * a — пункт төлейтін материалдардың қазіргі арақатынасындағы орташа бағасы, ₸/кг.
 * Сызықтардың қиылысуы — өтелу нүктесі m* = C / a.
 */
(function () {
  'use strict';
  const F = window.Fmt;
  const NS = 'http://www.w3.org/2000/svg';

  function niceStep(span, count) {
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  function ticks(max, count) {
    const step = niceStep(max, count);
    const out = [];
    for (let v = 0; v <= max + step * 1e-6; v += step) out.push(v);
    return out;
  }

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function render(box, { a, C, m0 }) {
    box.innerHTML = '';
    const W = Math.max(300, box.clientWidth);
    const H = 280;
    const pad = { l: 64, r: 20, t: 26, b: 44 };
    const mStar = C / a;

    const xStep = niceStep(Math.max(m0, mStar) * 1.4 || 10, 5);
    const xMax = Math.ceil((Math.max(m0, mStar) * 1.4 || 10) / xStep) * xStep;
    const yStep = niceStep(Math.max(a * xMax, C) * 1.1, 4);
    const yMax = Math.ceil((Math.max(a * xMax, C) * 1.1) / yStep) * yStep;
    const x = (m) => pad.l + (m / xMax) * (W - pad.l - pad.r);
    const y = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart', role: 'img',
      'aria-label': `Өтелу графигі: түсім жанармай шығынын ${F.kg(mStar)} массада өтейді` }, box);

    // Тор мен осьтер
    const grid = el('g', { class: 'chart__grid' }, svg);
    for (const v of ticks(yMax, 4)) {
      el('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }, grid);
      el('text', { x: pad.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart__tick' }, grid).textContent = F.num(v, 0);
    }
    for (const v of ticks(xMax, 5)) {
      el('text', { x: x(v), y: H - pad.b + 18, 'text-anchor': 'middle', class: 'chart__tick' }, grid).textContent = F.num(v, 1);
    }
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: 'chart__axis' }, svg);
    el('text', { x: W - pad.r, y: H - 6, 'text-anchor': 'end', class: 'chart__label' }, svg).textContent = 'Жиналған масса, кг';
    el('text', { x: pad.l + 4, y: pad.t - 12, class: 'chart__label' }, svg).textContent = '₸';

    // Залал аймағы (m < m*)
    if (mStar < xMax) {
      el('path', { d: `M${x(0)},${y(0)} L${x(mStar)},${y(C)} L${x(0)},${y(C)} Z`, class: 'chart__loss' }, svg);
    }

    // Сызықтар
    el('line', { x1: x(0), x2: x(xMax), y1: y(C), y2: y(C), class: 'chart__fuel' }, svg);
    el('line', { x1: x(0), x2: x(xMax), y1: y(0), y2: y(a * xMax), class: 'chart__rev' }, svg);

    // Өтелу нүктесі
    if (mStar <= xMax) {
      el('line', { x1: x(mStar), x2: x(mStar), y1: y(C), y2: y(0), class: 'chart__guide' }, svg);
      el('circle', { cx: x(mStar), cy: y(C), r: 5, class: 'chart__star' }, svg);
      el('text', { x: x(mStar) - 9, y: y(C) - 10, 'text-anchor': 'end', class: 'chart__note' }, svg).textContent = `өтелу: ${F.kg(mStar)}`;
    }
    // Қазіргі масса
    el('circle', { cx: x(m0), cy: y(a * m0), r: 5, class: 'chart__now' }, svg);
    el('text', { x: x(m0) + 9, y: y(a * m0) + 20, class: 'chart__note' }, svg).textContent = `қазір: ${F.kg(m0)}`;

    // Тінтуір қабаты
    const hover = el('g', { class: 'chart__hover', visibility: 'hidden' }, svg);
    const vline = el('line', { y1: pad.t, y2: y(0) }, hover);
    const dot = el('circle', { r: 4 }, hover);
    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    tip.hidden = true;
    box.appendChild(tip);
    const hit = el('rect', { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, fill: 'transparent' }, svg);

    function move(clientX) {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const m = Math.min(xMax, Math.max(0, ((px - pad.l) / (W - pad.l - pad.r)) * xMax));
      const R = a * m;
      hover.setAttribute('visibility', 'visible');
      vline.setAttribute('x1', x(m)); vline.setAttribute('x2', x(m));
      dot.setAttribute('cx', x(m)); dot.setAttribute('cy', y(R));
      tip.hidden = false;
      tip.innerHTML = `<b>${F.kg(m)}</b><span>Түсім</span><span>${F.money(R)}</span><span>Жанармай</span><span>${F.money(C)}</span><span>Нәтиже</span><span>${F.money(R - C)}</span>`;
      const left = (x(m) / W) * r.width;
      tip.style.left = Math.min(r.width - 170, left + 12) + 'px';
    }
    hit.addEventListener('pointermove', (e) => move(e.clientX));
    hit.addEventListener('pointerdown', (e) => move(e.clientX));
    hit.addEventListener('pointerleave', () => { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; });

    return { mStar, xMax };
  }

  window.BreakEvenChart = { render };
})();
