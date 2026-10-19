/* EcoEsep — интерфейс. Все расчёты — в calc.js */
(function () {
  'use strict';
  const C = window.EcoCalc;
  const D = window.EcoData;
  const STORE_KEY = 'ecoesep.v1';
  const DEMO_SOURCE = 'условные данные';

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---------- форматирование ----------
  const nf = (max) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: max });
  const minus = (s) => s.replace(/^[-−]/, '−');
  const money = (n) => minus(nf(1).format(Math.abs(n) < 0.05 ? 0 : n)) + ' ₸';
  const kg = (n) => nf(2).format(n) + ' кг';
  const km = (n) => nf(1).format(n) + ' км';
  const lit = (n) => nf(2).format(n) + ' л';
  const num = (n, d = 2) => minus(nf(d).format(n));

  // ---------- состояние ----------
  const WHO = {
    family: { label: 'Семья', unit: 'Семья', hint: 'Одна семья — одна колонка масс.' },
    class: { label: 'Класс', unit: 'Участник', hint: 'Каждый участник класса вводит свою массу; итог складывается.' },
    families: { label: 'Несколько семей', unit: 'Семья', hint: 'Массы семей складываются; ниже можно сравнить отдельные поездки с одной общей.' }
  };

  function defaultState() {
    return {
      who: 'family',
      materials: clone(D.materials),
      participants: [{ id: uid(), name: 'Семья 1', masses: { paper: '12', cardboard: '6', pet_clear: '3' }, distanceKm: '10' }],
      transport: { mode: 'separate', consumption: '9', fuelPrice: '300' },
      points: clone(D.points),
      focusId: null,
      joint: { pointId: null, distanceKm: '14' }
    };
  }

  let state = load() || defaultState();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.points) || !Array.isArray(s.participants)) return null;
      return Object.assign(defaultState(), s);
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }

  const matName = (id) => (state.materials.find((m) => m.id === id) || { name: id }).name;
  const pointById = (id) => state.points.find((p) => p.id === id);
  const activeParticipants = () => (state.who === 'family' ? state.participants.slice(0, 1) : state.participants);
  const isGroup = () => state.who !== 'family';

  function transport() {
    return { mode: state.transport.mode, consumption: Number(state.transport.consumption) || 0, fuelPrice: Number(state.transport.fuelPrice) || 0 };
  }
  function totalMasses() {
    return C.sumMasses(activeParticipants().map((p) => p.masses));
  }

  // ---------- проверка ввода ----------
  function inputErrors() {
    const errs = [];
    for (const p of activeParticipants()) {
      for (const m of state.materials) {
        const e = C.validateMass(p.masses[m.id]);
        if (e) errs.push({ where: 'mass', pid: p.id, mid: m.id, text: `${p.name}, ${m.name}: ${e.toLowerCase()}` });
      }
    }
    if (state.transport.mode !== 'walk') {
      for (const [k, label] of [['consumption', 'Расход'], ['fuelPrice', 'Цена топлива']]) {
        const e = C.validateNonNegative(state.transport[k], label);
        if (e) errs.push({ where: 'car', text: e });
      }
    }
    for (const p of state.points) {
      for (const k of ['oneWayKm', 'detourKm']) {
        const e = C.validateNonNegative(p[k], `${p.name}: расстояние`);
        if (e) errs.push({ where: 'dist', text: e });
      }
    }
    return errs;
  }

  // =====================================================================
  //  Структурный рендер (пересобирает поля ввода)
  // =====================================================================
  function renderInputs() {
    // Блок А
    for (const b of document.querySelectorAll('#whoSeg button')) b.setAttribute('aria-checked', String(b.dataset.who === state.who));
    $('#whoHint').textContent = WHO[state.who].hint;
    $('#addParticipant').hidden = !isGroup();

    // Блок Б
    const parts = activeParticipants();
    const group = isGroup();
    let h = '<thead><tr><th>Материал</th>';
    for (const p of parts) {
      h += `<th class="num"><div class="pname"><input class="pname__in" data-pname="${p.id}" value="${esc(p.name)}" aria-label="Имя участника">` +
        (group && parts.length > 1 ? `<button type="button" class="x" data-delp="${p.id}" aria-label="Удалить">✕</button>` : '') + '</div></th>';
    }
    if (group) h += '<th class="num total">Всего</th>';
    h += '</tr></thead><tbody>';
    for (const m of state.materials) {
      h += `<tr><td><div class="mat">${esc(m.name)}</div>${m.hint ? `<div class="mat__hint">${esc(m.hint)}</div>` : ''}</td>`;
      for (const p of parts) {
        h += `<td class="num"><input type="number" inputmode="decimal" min="0" step="0.1" placeholder="0" data-mass="${p.id}" data-mat="${m.id}" value="${esc(p.masses[m.id] ?? '')}" aria-label="${esc(m.name)}, ${esc(p.name)}, кг"></td>`;
      }
      if (group) h += `<td class="num total" data-total="${m.id}">—</td>`;
      h += '</tr>';
    }
    h += `</tbody><tfoot><tr><td colspan="${parts.length + (group ? 2 : 1)}">
      <form class="addmat" id="addMatForm"><input name="mat" placeholder="Свой материал, как в прайсе пункта" aria-label="Новый материал"><button class="link-btn" type="submit">+ материал</button></form></td></tr></tfoot>`;
    $('#massTable').innerHTML = h;

    // Блок В
    for (const b of document.querySelectorAll('#modeSeg button')) b.setAttribute('aria-checked', String(b.dataset.mode === state.transport.mode));
    $('#consumption').value = state.transport.consumption;
    $('#fuelPrice').value = state.transport.fuelPrice;
    $('#carFields').classList.toggle('is-off', state.transport.mode === 'walk');
    $('#modeHint').textContent = {
      walk: 'Расходы на топливо равны нулю, но это не значит, что затрат нет: время и силы программа не учитывает.',
      separate: 'Отдельная поездка — путь туда и обратно: калькулятор удваивает расстояние до пункта.',
      onway: 'Заезд по пути — только прибавка к обычному маршруту (например, к поездке в магазин).'
    }[state.transport.mode];

    // Блок Г
    const mode = state.transport.mode;
    $('#distHint').textContent = mode === 'separate' ? 'Для отдельной поездки — расстояние в одну сторону.' : mode === 'onway' ? 'Для заезда по пути — прибавка к маршруту.' : '';
    $('#pointsList').innerHTML = state.points.map((p) => {
      const accepted = Object.keys(p.prices || {});
      const chips = accepted.map((mid) => {
        const pr = p.prices[mid];
        const mb = (p.minBatch || {})[mid];
        return `<span class="chip${pr == null ? ' chip--warn' : ''}">${esc(matName(mid))} · ${pr == null ? 'уточняется' : num(pr) + ' ₸/кг'}${mb ? ` · от ${num(mb)} кг` : ''}</span>`;
      }).join('') || '<span class="muted small">Материалы не указаны</span>';
      const distField = mode === 'walk' ? '' : mode === 'separate'
        ? `<label class="field field--inline"><span>В одну сторону, км</span><input type="number" min="0" step="0.1" inputmode="decimal" data-dist="${p.id}" data-key="oneWayKm" value="${esc(p.oneWayKm ?? '')}"></label>`
        : `<label class="field field--inline"><span>Прибавка к маршруту, км</span><input type="number" min="0" step="0.1" inputmode="decimal" data-dist="${p.id}" data-key="detourKm" value="${esc(p.detourKm ?? '')}"></label>`;
      return `<div class="pt">
        <div class="pt__top">
          <div><div class="pt__name">${esc(p.name)}${p.confirmed ? '<span class="tag tag--ok">проверено</span>' : '<span class="tag tag--warn">не подтверждено</span>'}</div>
          <div class="pt__meta">${esc(p.address || 'адрес не указан')}</div></div>
          <button type="button" class="link-btn" data-edit="${p.id}">Изменить</button>
        </div>
        <div class="chips">${chips}</div>
        <div class="pt__meta">${p.requirements ? 'Требования: ' + esc(p.requirements) + ' · ' : ''}Источник: ${esc(p.source || '—')}${p.checkedAt ? ' · проверено ' + esc(new Date(p.checkedAt).toLocaleDateString('ru-RU')) : ''}</div>
        ${distField}
      </div>`;
    }).join('') || '<p class="muted">Добавьте хотя бы один пункт приёма.</p>';

    $('#demoNotice').hidden = !state.points.some((p) => p.source === DEMO_SOURCE);
    renderJointInputs();
  }

  function renderJointInputs() {
    const box = $('#jointCard');
    if (!isGroup() || state.participants.length < 2) {
      box.innerHTML = `<div class="empty"><p>Выберите в блоке «А» <b>Класс</b> или <b>Несколько семей</b> и добавьте хотя бы двух участников — тогда здесь появится сравнение отдельных поездок и одной общей.</p>
        <button class="btn btn--ghost" type="button" id="jointDemo">Попробовать на двух семьях</button></div>`;
      return;
    }
    if (!pointById(state.joint.pointId)) state.joint.pointId = null;
    const opts = state.points.map((p) => `<option value="${p.id}"${p.id === state.joint.pointId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    box.innerHTML = `<div class="joint">
      <div class="joint__in">
        <label class="field"><span>Пункт для сравнения</span><select id="jointPoint"><option value="">Лучший для всего набора</option>${opts}</select></label>
        <div class="joint__list">
          <p class="small muted">Доп. пробег отдельной поездки каждого участника (туда и обратно), км</p>
          ${state.participants.map((p) => `<label class="field field--inline"><span>${esc(p.name)}</span><input type="number" min="0" step="0.1" inputmode="decimal" data-pdist="${p.id}" value="${esc(p.distanceKm ?? '')}"></label>`).join('')}
        </div>
        <label class="field"><span>Пробег общей поездки с объездом для сбора, км</span><input type="number" min="0" step="0.1" inputmode="decimal" id="jointDist" value="${esc(state.joint.distanceKm)}"></label>
        <p class="small muted">Расчёт ведётся для автомобиля с расходом и ценой топлива из блока «В».</p>
      </div>
      <div class="joint__out" id="jointOut"></div>
    </div>`;
  }

  // =====================================================================
  //  Рендер результатов
  // =====================================================================
  function renderResults() {
    const errs = inputErrors();
    // подсветка ошибок
    for (const el of document.querySelectorAll('[data-mass]')) el.classList.remove('invalid');
    for (const e of errs.filter((x) => x.where === 'mass')) {
      const el = document.querySelector(`[data-mass="${e.pid}"][data-mat="${e.mid}"]`);
      if (el) el.classList.add('invalid');
    }
    const massErr = errs.filter((e) => e.where === 'mass').map((e) => e.text);
    $('#massError').hidden = !massErr.length;
    $('#massError').textContent = massErr.join('; ');
    const carErr = errs.filter((e) => e.where !== 'mass').map((e) => e.text);
    $('#carError').hidden = !carErr.length;
    $('#carError').textContent = carErr.join('; ');

    const masses = totalMasses();
    if (isGroup()) {
      for (const m of state.materials) {
        const cell = document.querySelector(`[data-total="${m.id}"]`);
        if (cell) cell.textContent = masses[m.id] ? num(masses[m.id]) : '—';
      }
    }

    if (errs.length) {
      const msg = '<div class="empty"><p><b>Исправьте ошибки ввода</b> — расчёт не выполняется, пока есть отрицательные или нечисловые значения.</p></div>';
      $('#summary').innerHTML = msg;
      $('#cmpTable').innerHTML = '';
      $('#verdictCard').innerHTML = msg; $('#thCard').innerHTML = ''; $('#stepsCard').innerHTML = msg;
      const jo = $('#jointOut'); if (jo) jo.innerHTML = msg;
      return;
    }

    const t = transport();
    const cmp = C.comparePoints(state.points, masses, t);
    const focus = cmp.evals.find((e) => e.pointId === state.focusId) || cmp.bestFull || cmp.bestAny || cmp.evals[0] || null;
    renderSummary(cmp, masses, t);
    renderCompare(cmp, focus);
    renderThreshold(cmp, focus, t);
    renderSteps(focus, t);
    renderJoint(cmp, t);
    save();
  }

  function totalKg(masses) {
    return Object.values(masses).reduce((s, v) => s + (Number(v) || 0), 0);
  }

  function renderSummary(cmp, masses, t) {
    const total = totalKg(masses);
    const best = cmp.bestFull;
    const who = WHO[state.who].label.toLowerCase();
    let h = `<p class="eyebrow">Итог · ${esc(who)}</p>`;
    if (!total) {
      $('#summary').innerHTML = h + '<p class="big muted">0 ₸</p><p class="muted">Введите массу накопленного вторсырья в блоке «Б».</p>';
      return;
    }
    const shown = best || cmp.bestAny;
    const adv = C.advice(shown, t.mode);
    h += `<p class="small muted">Всего накоплено <b>${kg(total)}</b></p>`;
    if (best) {
      h += `<p class="sum__label">Лучший пункт для всего набора</p><p class="sum__point">${esc(pointById(best.pointId).name)}</p>`;
    } else {
      h += `<p class="sum__label">Ни один пункт не примет весь набор сразу</p>` +
        (cmp.bestAny ? `<p class="sum__point">${esc(pointById(cmp.bestAny.pointId).name)} <span class="tag tag--warn">примет не всё</span></p>` : '');
    }
    if (shown) {
      h += `<p class="big ${shown.result < 0 ? 'neg' : 'pos'}">${money(shown.result)}</p>
        <p class="small muted">Результат после расходов на топливо</p>
        <dl class="kv">
          <div><dt>Выручка</dt><dd>${money(shown.revenue)}</dd></div>
          <div><dt>Топливо</dt><dd>${t.mode === 'walk' ? '—' : money(shown.fuelCost)}</dd></div>
          <div><dt>Доп. пробег</dt><dd>${t.mode === 'walk' ? '—' : km(shown.distanceKm)}</dd></div>
        </dl>
        <p class="verdict verdict--${adv.tone}">${esc(adv.text)}</p>`;
    }
    h += '<a class="link-btn" href="#compare">Все пункты ↓</a>';
    $('#summary').innerHTML = h;
  }

  function itemList(items) {
    return items.map((i) => esc(matName(i.matId))).join(', ');
  }

  function renderCompare(cmp, focus) {
    const anyMass = cmp.evals.some((e) => e.hasMass);
    if (!anyMass) {
      $('#cmpTable').innerHTML = '<tbody><tr><td class="empty">Введите массу, чтобы сравнить пункты.</td></tr></tbody>';
      return;
    }
    const walk = state.transport.mode === 'walk';
    let h = `<thead><tr><th>Пункт</th><th>Что примут</th><th>Не примут / нельзя сдать</th><th class="num">Выручка</th><th class="num">Пробег</th><th class="num">Топливо</th><th class="num">Итог</th></tr></thead><tbody>`;
    for (const e of cmp.evals) {
      const p = pointById(e.pointId);
      const ok = e.items.filter((i) => i.status === 'ok');
      const badges = [];
      if (cmp.bestFull && e.pointId === cmp.bestFull.pointId) badges.push('<span class="tag tag--best">лучший для всего набора</span>');
      else if (cmp.bestAny && e.pointId === cmp.bestAny.pointId && !e.acceptsAll) badges.push('<span class="tag tag--warn">наибольший итог, но примет не всё</span>');
      if (!p.confirmed) badges.push('<span class="tag tag--muted">цены не подтверждены</span>');
      const rejected = [];
      if (e.notAccepted.length) rejected.push(`<div>Не принимают: ${itemList(e.notAccepted)}</div>`);
      if (e.belowMin.length) rejected.push(`<div>Меньше партии: ${e.belowMin.map((i) => `${esc(matName(i.matId))} (${num(i.mass)} из ${num(i.minBatch)} кг)`).join(', ')}</div>`);
      const accepted = [ok.length ? itemList(ok) : '', e.unpriced.length ? `<span class="warn-text">цена уточняется: ${itemList(e.unpriced)}</span>` : ''].filter(Boolean).join('<br>');
      h += `<tr class="${focus && e.pointId === focus.pointId ? 'is-focus' : ''}" data-focus="${e.pointId}" tabindex="0">
        <td><b>${esc(p.name)}</b><div class="badges">${badges.join('')}</div></td>
        <td>${accepted || '<span class="muted">—</span>'}</td>
        <td class="small">${rejected.join('') || '<span class="muted">—</span>'}</td>
        <td class="num">${money(e.revenue)}</td>
        <td class="num">${walk ? '—' : km(e.distanceKm)}</td>
        <td class="num">${walk ? '—' : money(e.fuelCost)}</td>
        <td class="num"><b class="${e.result < 0 ? 'neg' : 'pos'}">${money(e.result)}</b></td>
      </tr>`;
    }
    h += '</tbody>';
    $('#cmpTable').innerHTML = h;
  }

  function focusSelect(focus) {
    return `<select class="focus-sel" data-focus-select aria-label="Пункт">${state.points.map((p) => `<option value="${p.id}"${focus && focus.pointId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
  }

  function renderThreshold(cmp, focus, t) {
    if (!focus) { $('#verdictCard').innerHTML = '<p class="muted">Добавьте пункт приёма.</p>'; $('#thCard').innerHTML = ''; return; }
    const adv = C.advice(focus, t.mode);
    const warn = [];
    const p = pointById(focus.pointId);
    if (!p.confirmed) warn.push('Цены пункта не подтверждены — уточните перед поездкой.');
    for (const i of focus.unpriced) warn.push(`«${matName(i.matId)}»: цена уточняется, в выручку не включено.`);
    for (const i of focus.belowMin) warn.push(`«${matName(i.matId)}»: ${num(i.mass)} кг меньше минимальной партии ${num(i.minBatch)} кг — сдать нельзя.`);
    for (const i of focus.notAccepted) warn.push(`«${matName(i.matId)}»: пункт не принимает — не входит в выручку.`);
    let scaleTxt = '';
    if (focus.scale && t.mode !== 'walk') {
      const tot = totalKg(Object.fromEntries(focus.items.filter((i) => i.status === 'ok').map((i) => [i.matId, i.mass])));
      scaleTxt = `<p class="small">При той же пропорции материалов, которые пункт оплачивает, нужно в <b>${num(focus.scale)}</b> раза больше — около <b>${kg(tot * focus.scale)}</b> вместо ${kg(tot)}.</p>`;
    }
    $('#verdictCard').innerHTML = `<div class="card__head"><h3>Вердикт</h3>${focusSelect(focus)}</div>
      <p class="big ${focus.result < 0 ? 'neg' : 'pos'}">${money(focus.result)}</p>
      <p class="small muted">Результат после расходов на топливо: выручка ${money(focus.revenue)} − топливо ${money(focus.fuelCost)}</p>
      <p class="verdict verdict--${adv.tone}">${esc(adv.text)}</p>
      ${scaleTxt}
      ${warn.length ? `<ul class="warns">${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;

    const rows = focus.thresholds.map((th) => {
      const cur = Number(totalMasses()[th.matId]) || 0;
      let cells;
      if (th.kind === 'unknown_price') cells = `<td class="num muted">уточняется</td><td colspan="3" class="muted small">Порог нельзя рассчитать без цены</td>`;
      else if (th.kind === 'zero_price') cells = `<td class="num">0 ₸/кг</td><td colspan="3" class="muted small">Сдача не даёт денежной выручки — порог не определён</td>`;
      else {
        const reach = th.need <= 0;
        cells = `<td class="num">${kg(th.mMin)}${th.byBatch > th.byFuel ? '<div class="small muted">по партии</div>' : ''}</td>
          <td class="num">${kg(cur)}</td>
          <td class="num">${reach ? '<span class="pos">достаточно</span>' : '+' + kg(th.need)}</td>`;
        return `<tr><td>${esc(matName(th.matId))}</td><td class="num">${num(Number(pointById(focus.pointId).prices[th.matId]))} ₸/кг</td>${cells}</tr>`;
      }
      return `<tr><td>${esc(matName(th.matId))}</td>${cells}</tr>`;
    }).join('');
    $('#thCard').innerHTML = `<div class="card__head"><h3>Порог накопления · ${esc(p.name)}</h3></div>
      <p class="small muted">Если сдавать только один материал: сколько его нужно, чтобы покрыть топливо ${t.mode === 'walk' ? '(пешком топлива нет — остаётся только минимальная партия)' : money(focus.fuelCost)}.</p>
      <div class="table-scroll"><table class="th-table"><thead><tr><th>Материал</th><th class="num">Цена</th><th class="num">m<sub>min</sub></th><th class="num">Есть</th><th class="num">Нужно ещё</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Пункт не указал материалы</td></tr>'}</tbody></table></div>`;
  }

  function renderSteps(e, t) {
    if (!e || !e.hasMass) { $('#stepsCard').innerHTML = '<h3>Расчёт по шагам</h3><p class="muted">Введите массу или откройте учебный пример.</p>'; return; }
    const p = pointById(e.pointId);
    const ok = e.items.filter((i) => i.status === 'ok');
    const rParts = ok.map((i) => `${num(i.mass)} кг × ${num(i.price)} ₸/кг`).join(' + ') || '0';
    const walk = t.mode === 'walk';
    const dTxt = t.mode === 'separate' ? `2 × ${num(Number(p.oneWayKm) || 0)} км (туда и обратно) = ${km(e.distanceKm)}` : walk ? '0 км (пешком)' : `${km(e.distanceKm)} (прибавка к маршруту)`;
    const firstOk = ok[0];
    const thLine = firstOk && !walk
      ? `<li><span>Порог по «${esc(matName(firstOk.matId))}»</span><code>m<sub>min</sub> = ${num(e.fuelCost)} / ${num(firstOk.price)} = <b>${kg(e.fuelCost / firstOk.price)}</b></code></li>` : '';
    $('#stepsCard').innerHTML = `<div class="card__head"><h3>Расчёт по шагам · ${esc(p.name)}</h3>${focusSelect(e)}</div>
      <ol class="steps">
        <li><span>Выручка</span><code>R = ${rParts} = <b>${money(e.revenue)}</b></code></li>
        <li><span>Доп. пробег</span><code>d = ${dTxt}</code></li>
        <li><span>Топливо</span><code>Q = ${num(e.distanceKm)} × ${num(t.consumption)} / 100 = <b>${lit(e.liters)}</b></code></li>
        <li><span>Расходы</span><code>C = ${num(e.liters)} л × ${num(t.fuelPrice)} ₸/л = <b>${money(e.fuelCost)}</b></code></li>
        <li><span>Итог</span><code>B = ${num(e.revenue)} − ${num(e.fuelCost)} = <b class="${e.result < 0 ? 'neg' : 'pos'}">${money(e.result)}</b></code></li>
        ${thLine}
      </ol>
      ${e.notAccepted.length || e.belowMin.length || e.unpriced.length ? `<p class="small muted">Не вошло в выручку: ${itemList([...e.notAccepted, ...e.belowMin, ...e.unpriced])}.</p>` : ''}`;
  }

  function renderJoint(cmp, t) {
    const out = $('#jointOut');
    if (!out) return;
    const point = pointById(state.joint.pointId) || (cmp.bestFull && pointById(cmp.bestFull.pointId)) || (cmp.bestAny && pointById(cmp.bestAny.pointId)) || state.points[0];
    if (!point) { out.innerHTML = '<p class="muted">Добавьте пункт приёма.</p>'; return; }
    const r = C.compareJoint(point, state.participants.map((p) => ({ name: p.name, masses: p.masses, distanceKm: Number(p.distanceKm) || 0 })), t, Number(state.joint.distanceKm) || 0);
    if (!r.joint.hasMass) { out.innerHTML = '<p class="muted">Введите массы участников в блоке «Б».</p>'; return; }
    const better = r.gain > 0.0001 ? 'joint' : r.gain < -0.0001 ? 'sep' : 'eq';
    const s = r.separateTotal;
    out.innerHTML = `<p class="small muted">Пункт: <b>${esc(point.name)}</b></p>
      <div class="vs">
        <div class="vs__col ${better === 'sep' ? 'is-win' : ''}">
          <p class="vs__t">${s.trips} отдельн${s.trips === 1 ? 'ая поездка' : s.trips < 5 ? 'ые поездки' : 'ых поездок'}</p>
          <p class="big ${s.result < 0 ? 'neg' : 'pos'}">${money(s.result)}</p>
          <dl class="kv"><div><dt>Выручка</dt><dd>${money(s.revenue)}</dd></div><div><dt>Пробег</dt><dd>${km(s.distanceKm)}</dd></div><div><dt>Топливо</dt><dd>${money(s.fuelCost)}</dd></div></dl>
        </div>
        <div class="vs__col ${better === 'joint' ? 'is-win' : ''}">
          <p class="vs__t">Одна общая поездка</p>
          <p class="big ${r.joint.result < 0 ? 'neg' : 'pos'}">${money(r.joint.result)}</p>
          <dl class="kv"><div><dt>Выручка</dt><dd>${money(r.joint.revenue)}</dd></div><div><dt>Пробег</dt><dd>${km(r.joint.distanceKm)}</dd></div><div><dt>Топливо</dt><dd>${money(r.joint.fuelCost)}</dd></div></dl>
        </div>
      </div>
      <p class="verdict verdict--${better === 'joint' ? 'good' : better === 'sep' ? 'bad' : 'neutral'}">${better === 'joint'
        ? `Общая поездка выгоднее на ${money(r.gain)} и экономит ${km(Math.max(0, s.distanceKm - r.joint.distanceKm))} пробега.`
        : better === 'sep' ? `Отдельные поездки выгоднее на ${money(-r.gain)} — объезд для сбора слишком длинный.` : 'Варианты равны по денежному результату.'}</p>
      ${r.joint.revenue > s.revenue + 0.0001 ? '<p class="small">Выручка общей поездки выше: вместе удаётся набрать минимальную партию.</p>' : ''}`;
  }

  // =====================================================================
  //  События
  // =====================================================================
  function full() { renderInputs(); renderResults(); }

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.mass) {
      const p = state.participants.find((x) => x.id === el.dataset.mass);
      p.masses[el.dataset.mat] = el.value;
    } else if (el.dataset.dist) {
      pointById(el.dataset.dist)[el.dataset.key] = el.value;
    } else if (el.dataset.pdist) {
      state.participants.find((x) => x.id === el.dataset.pdist).distanceKm = el.value;
    } else if (el.dataset.pname) {
      state.participants.find((x) => x.id === el.dataset.pname).name = el.value;
      renderJointInputs();
    } else if (el.id === 'consumption' || el.id === 'fuelPrice') {
      state.transport[el.id] = el.value;
    } else if (el.id === 'jointDist') {
      state.joint.distanceKm = el.value;
    } else return;
    renderResults();
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('[data-focus-select]')) { state.focusId = el.value; renderResults(); }
    else if (el.id === 'jointPoint') { state.joint.pointId = el.value || null; renderResults(); }
    else if (el.id === 'importInput') importFile(el.files[0]);
  });

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, tr[data-focus]');
    if (!el) return;
    if (el.dataset.who) { state.who = el.dataset.who; relabel(); full(); }
    else if (el.dataset.mode) { state.transport.mode = el.dataset.mode; full(); }
    else if (el.dataset.delp) { state.participants = state.participants.filter((p) => p.id !== el.dataset.delp); full(); }
    else if (el.dataset.edit) openPoint(el.dataset.edit);
    else if (el.dataset.focus) { state.focusId = el.dataset.focus; renderResults(); }
    else if (el.id === 'addParticipant') {
      state.participants.push({ id: uid(), name: `${WHO[state.who].unit} ${state.participants.length + 1}`, masses: {}, distanceKm: '10' });
      full();
    } else if (el.id === 'addPoint') openPoint(null);
    else if (el.id === 'exampleBtn') loadExample();
    else if (el.id === 'jointDemo') loadJointDemo();
    else if (el.id === 'exportBtn') exportData();
    else if (el.id === 'resetBtn') {
      if (confirm('Вернуть условные данные? Введённые пункты и массы будут удалены.')) { state = defaultState(); full(); }
    } else if (el.id === 'themeBtn') toggleTheme();
  });

  document.addEventListener('keydown', (ev) => {
    const tr = ev.target.closest && ev.target.closest('tr[data-focus]');
    if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); state.focusId = tr.dataset.focus; renderResults(); }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'addMatForm') return;
    ev.preventDefault();
    const name = ev.target.mat.value.trim();
    if (!name) return;
    state.materials.push({ id: 'm_' + uid(), name, hint: '' });
    full();
  });

  function relabel() {
    // Переименовать участников по умолчанию под выбранный режим
    const unit = WHO[state.who].unit;
    state.participants.forEach((p, i) => {
      if (/^(Семья|Участник) \d+$/.test(p.name)) p.name = `${unit} ${i + 1}`;
    });
  }

  function loadExample() {
    const ex = D.example;
    state.who = 'family';
    state.participants = [{ id: uid(), name: 'Семья 1', masses: clone(ex.masses), distanceKm: '10' }];
    state.transport = { mode: ex.transport.mode, consumption: String(ex.transport.consumption), fuelPrice: String(ex.transport.fuelPrice) };
    state.points = [clone(ex.point)];
    state.focusId = ex.point.id;
    full();
    document.getElementById('method').scrollIntoView({ behavior: 'smooth' });
  }

  function loadJointDemo() {
    state.who = 'families';
    const first = state.participants[0] || { masses: {} };
    state.participants = [
      { id: uid(), name: 'Семья 1', masses: first.masses, distanceKm: '10' },
      { id: uid(), name: 'Семья 2', masses: { paper: '7', cardboard: '4' }, distanceKm: '12' }
    ];
    full();
  }

  // ---------- редактор пункта ----------
  let editingId = null;
  function openPoint(id) {
    editingId = id;
    const p = id ? pointById(id) : { name: '', address: '', prices: {}, minBatch: {}, requirements: '', source: '', checkedAt: '', confirmed: false };
    const f = $('#pointForm');
    $('#pointDlgTitle').textContent = id ? 'Пункт приёма' : 'Новый пункт приёма';
    f.ptName.value = p.name; f.address.value = p.address || '';
    f.requirements.value = p.requirements || ''; f.source.value = p.source || '';
    f.checkedAt.value = p.checkedAt || ''; f.confirmed.checked = !!p.confirmed;
    $('#deletePoint').hidden = !id;
    $('#matEditor').innerHTML = `<div class="me me--head"><span></span><span>Материал</span><span>Цена, ₸/кг</span><span>Мин. партия, кг</span></div>` +
      state.materials.map((m) => {
        const on = Object.prototype.hasOwnProperty.call(p.prices, m.id);
        return `<div class="me">
          <input type="checkbox" data-acc="${m.id}" ${on ? 'checked' : ''} aria-label="Принимает: ${esc(m.name)}">
          <span>${esc(m.name)}</span>
          <input type="number" min="0" step="0.1" inputmode="decimal" data-price="${m.id}" placeholder="уточняется" value="${on && p.prices[m.id] != null ? p.prices[m.id] : ''}">
          <input type="number" min="0" step="0.1" inputmode="decimal" data-batch="${m.id}" placeholder="нет" value="${(p.minBatch || {})[m.id] ?? ''}">
        </div>`;
      }).join('');
    $('#pointDlg').showModal();
  }

  $('#pointForm').addEventListener('submit', (ev) => {
    const submitter = ev.submitter;
    if (!submitter || submitter.value !== 'save') return;
    const f = ev.target;
    if (!f.ptName.value.trim()) { ev.preventDefault(); f.ptName.focus(); return; }
    const prices = {}; const minBatch = {};
    let bad = false;
    for (const m of state.materials) {
      if (!$(`[data-acc="${m.id}"]`, f).checked) continue;
      const pv = $(`[data-price="${m.id}"]`, f).value;
      const bv = $(`[data-batch="${m.id}"]`, f).value;
      if ((pv !== '' && Number(pv) < 0) || (bv !== '' && Number(bv) < 0)) bad = true;
      prices[m.id] = pv === '' ? null : Number(pv);
      if (bv !== '' && Number(bv) > 0) minBatch[m.id] = Number(bv);
    }
    if (bad) { ev.preventDefault(); alert('Цена и партия не могут быть отрицательными.'); return; }
    const data = {
      name: f.ptName.value.trim(), address: f.address.value.trim(), prices, minBatch,
      requirements: f.requirements.value.trim(), source: f.source.value.trim(),
      checkedAt: f.checkedAt.value, confirmed: f.confirmed.checked
    };
    if (editingId) Object.assign(pointById(editingId), data);
    else state.points.push({ id: 'p_' + uid(), oneWayKm: '', detourKm: '', ...data });
    full();
  });

  $('#deletePoint').addEventListener('click', () => {
    if (!editingId || !confirm('Удалить пункт?')) return;
    state.points = state.points.filter((p) => p.id !== editingId);
    $('#pointDlg').close();
    full();
  });

  // Отметка «принимает» включается при вводе цены
  $('#matEditor').addEventListener('input', (ev) => {
    const id = ev.target.dataset.price || ev.target.dataset.batch;
    if (id && ev.target.value !== '') $(`[data-acc="${id}"]`).checked = true;
  });

  // ---------- экспорт / импорт ----------
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'EcoEsep', version: 1, savedAt: new Date().toISOString(), materials: state.materials, points: state.points }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ecoesep-punkty.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importFile(file) {
    if (!file) return;
    file.text().then((txt) => {
      const d = JSON.parse(txt);
      if (!Array.isArray(d.points)) throw new Error('нет списка пунктов');
      if (Array.isArray(d.materials)) state.materials = d.materials;
      state.points = d.points;
      full();
    }).catch((e) => alert('Не удалось прочитать файл: ' + e.message));
  }

  // ---------- тема ----------
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('ecoesep.theme', next); } catch (e) { /* ignore */ }
  }
  try { applyTheme(localStorage.getItem('ecoesep.theme')); } catch (e) { /* ignore */ }

  full();
})();
