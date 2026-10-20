/* EcoEsep — интерфейс. Барлық есептеулер calc.js файлында. */
(function () {
  'use strict';
  const C = window.EcoCalc;
  const D = window.EcoData;
  const F = window.Fmt;
  const S = window.Store;
  const esc = F.esc;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const DEMO_SOURCE = 'шартты деректер';

  const WHO = {
    family: { unit: 'отбасы', hint: 'Бір отбасы — массалардың бір бағаны.' },
    class: { unit: 'қатысушы', hint: 'Сыныптың әр қатысушысы өз массасын енгізеді, жалпы сомасы автоматты түрде есептеледі.' },
    families: { unit: 'отбасы', hint: 'Отбасылардың массалары қосылады. 7-бөлімде жеке сапарларды бір ортақ сапармен салыстыруға болады.' }
  };

  const MODE_HINT = {
    walk: 'Жанармай шығыны нөлге тең, бірақ бұл шығын жоқ дегенді білдірмейді: уақыт пен күш есепке алынбайды.',
    separate: 'Жеке сапар — бару-қайту жолы: калькулятор пунктке дейінгі қашықтықты екі есе алады.',
    onway: 'Жол-жөнекей соғу — күнделікті бағытқа (мысалы, дүкенге баратын жолға) қосылатын жол ғана.'
  };

  const ADVICE = {
    no_mass: 'Жиналған шикізаттың массасын енгізіңіз.',
    walk: 'Жанармай шығыны жоқ, бірақ бағдарлама уақыт пен күш шығынын есептемейді.',
    covers: 'Қазіргі жағдайда түсім жанармай шығынын өтейді — қазір өткізуге болады.',
    not_covers: 'Қазіргі жағдайда түсім бұл сапардың жанармай шығынын өтемейді. Көбірек жинауға немесе өткізуді басқа сапармен біріктіруге болады.'
  };

  let state = S.load();

  // ---------- көмекші функциялар ----------
  const matName = (id) => (state.materials.find((m) => m.id === id) || { name: id }).name;
  const pointById = (id) => state.points.find((p) => p.id === id);
  const isGroup = () => state.who !== 'family';
  const participants = () => (isGroup() ? state.participants : state.participants.slice(0, 1));
  const totalMasses = () => C.sumMasses(participants().map((p) => p.masses));
  const sumKg = (masses) => Object.values(masses).reduce((s, v) => s + (Number(v) || 0), 0);
  const listNames = (items) => items.map((i) => esc(matName(i.matId))).join(', ');
  const sign = (n) => (n < 0 ? 'neg' : 'pos');

  function transport() {
    const t = state.transport;
    return { mode: t.mode, consumption: Number(t.consumption) || 0, fuelPrice: Number(t.fuelPrice) || 0 };
  }

  function inputErrors() {
    const errs = [];
    for (const p of participants()) {
      for (const m of state.materials) {
        const e = C.validateMass(p.masses[m.id]);
        if (e) errs.push({ kind: 'mass', pid: p.id, mid: m.id, text: `${p.name}, ${m.name}: ${e.toLowerCase()}` });
      }
    }
    if (state.transport.mode !== 'walk') {
      for (const [k, label] of [['consumption', 'Отын шығыны'], ['fuelPrice', 'Жанармай бағасы']]) {
        const e = C.validateNonNegative(state.transport[k], label);
        if (e) errs.push({ kind: 'other', text: e });
      }
    }
    for (const p of state.points) {
      for (const k of ['oneWayKm', 'detourKm']) {
        const e = C.validateNonNegative(p[k], `${p.name}, қашықтық`);
        if (e) errs.push({ kind: 'other', text: e });
      }
    }
    return errs;
  }

  // =====================================================================
  //  Енгізу өрістері (құрылым өзгергенде ғана қайта салынады)
  // =====================================================================
  function renderInputs() {
    $$('#whoSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === state.who)));
    $('#whoHint').textContent = WHO[state.who].hint;
    $('#addParticipant').hidden = !isGroup();

    renderMassTable();

    $$('#modeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.transport.mode)));
    $('#consumption').value = state.transport.consumption;
    $('#fuelPrice').value = state.transport.fuelPrice;
    $('#carFields').classList.toggle('is-off', state.transport.mode === 'walk');
    $('#modeHint').textContent = MODE_HINT[state.transport.mode];

    renderPoints();
    $('#demoNotice').hidden = !state.points.some((p) => p.source === DEMO_SOURCE);
    renderJointInputs();
    renderProjectMeta();
  }

  function renderMassTable() {
    const parts = participants();
    const group = isGroup();
    const canDelete = group && parts.length > 1;
    const head = parts.map((p) => `<th class="num">
        <span class="pname"><input data-pname="${p.id}" value="${esc(p.name)}" aria-label="Қатысушы атауы">${canDelete ? `<button type="button" class="del" data-delp="${p.id}" aria-label="${esc(p.name)} өшіру">×</button>` : ''}</span>
      </th>`).join('');
    const rows = state.materials.map((m) => {
      const cells = parts.map((p) => `<td class="num"><input type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"
        data-mass="${p.id}" data-mat="${m.id}" value="${esc(p.masses[m.id] ?? '')}" aria-label="${esc(m.name)}, ${esc(p.name)}, кг"></td>`).join('');
      return `<tr><th scope="row"><span class="mat">${esc(m.name)}</span>${m.hint ? `<span class="mat__hint">${esc(m.hint)}</span>` : ''}</th>${cells}${group ? `<td class="num total" data-total="${m.id}">—</td>` : ''}</tr>`;
    }).join('');
    $('#massTable').innerHTML = `<thead><tr><th>Материал</th>${head}${group ? '<th class="num">Барлығы, кг</th>' : ''}</tr></thead><tbody>${rows}</tbody>`;
  }

  function renderPoints() {
    const mode = state.transport.mode;
    $('#distHint').textContent = mode === 'separate' ? 'Жеке сапар үшін бір бағыттағы қашықтықты енгізіңіз.'
      : mode === 'onway' ? 'Жол-жөнекей соғу үшін бағытқа қосылатын жолды енгізіңіз.' : '';
    const key = mode === 'separate' ? 'oneWayKm' : 'detourKm';
    const label = mode === 'separate' ? 'Бір бағытқа, км' : 'Бағытқа қосымша, км';

    $('#pointsList').innerHTML = state.points.map((p) => {
      const prices = Object.keys(p.prices || {}).map((mid) => {
        const price = p.prices[mid];
        const batch = (p.minBatch || {})[mid];
        return `<li${price == null ? ' class="unk"' : ''}><span>${esc(matName(mid))}</span><span class="num">${price == null ? 'нақтыланбаған' : F.num(price) + ' ₸/кг'}${batch ? `, ${F.num(batch)} кг-нан` : ''}</span></li>`;
      }).join('');
      const meta = [
        p.requirements && `Талаптар: ${esc(p.requirements)}`,
        `Дереккөз: ${esc(p.source || '—')}`,
        p.checkedAt && `Тексерілді: ${esc(F.date(p.checkedAt))}`
      ].filter(Boolean).join(' · ');
      return `<article class="pt">
        <header class="pt__head">
          <div>
            <h3>${esc(p.name)} <span class="status ${p.confirmed ? 'status--ok' : 'status--warn'}">${p.confirmed ? 'расталған' : 'расталмаған'}</span></h3>
            <p class="pt__addr">${esc(p.address || 'мекенжайы көрсетілмеген')}</p>
          </div>
          <button type="button" class="link" data-edit="${p.id}">Өзгерту</button>
        </header>
        ${prices ? `<ul class="pt__prices">${prices}</ul>` : '<p class="hint">Материалдар көрсетілмеген</p>'}
        <p class="pt__meta">${meta}</p>
        ${mode === 'walk' ? '' : `<label class="field field--row"><span>${label}</span><input type="number" min="0" step="0.1" inputmode="decimal" data-dist="${p.id}" data-key="${key}" value="${esc(p[key] ?? '')}"></label>`}
      </article>`;
    }).join('') || '<p class="hint">Кемінде бір қабылдау пунктін қосыңыз.</p>';
  }

  function renderJointInputs() {
    const box = $('#jointCard');
    if (!isGroup() || state.participants.length < 2) {
      box.innerHTML = `<div class="empty">
        <p>1-бөлімде <b>«Сынып»</b> немесе <b>«Бірнеше отбасы»</b> нұсқасын таңдап, кемінде екі қатысушы қосыңыз. Сонда мұнда жеке сапарлар мен ортақ сапардың салыстыруы шығады.</p>
        <button class="btn" type="button" id="jointDemo">Екі отбасы мысалында көру</button>
      </div>`;
      return;
    }
    if (!pointById(state.joint.pointId)) state.joint.pointId = null;
    const options = state.points.map((p) => `<option value="${p.id}"${p.id === state.joint.pointId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const rows = state.participants.map((p) => `<label class="field field--row"><span>${esc(p.name)}</span>
      <input type="number" min="0" step="0.1" inputmode="decimal" data-pdist="${p.id}" value="${esc(p.distanceKm ?? '')}"></label>`).join('');
    box.innerHTML = `<div class="joint">
      <div class="joint__in">
        <label class="field"><span>Салыстыруға арналған пункт</span>
          <select id="jointPoint"><option value="">Барлық жиынтық үшін ең тиімдісі</option>${options}</select></label>
        <div class="subgroup">
          <p class="hint">Әр қатысушының жеке сапарындағы қосымша жүріс (бару-қайту), км</p>
          ${rows}
        </div>
        <label class="field"><span>Ортақ сапар жүрісі (шикізат жинауға айналып өтуді қоса), км</span>
          <input type="number" min="0" step="0.1" inputmode="decimal" id="jointDist" value="${esc(state.joint.distanceKm)}"></label>
        <p class="hint">Есеп 3-бөлімдегі отын шығыны мен жанармай бағасы бойынша автокөлік үшін жүргізіледі.</p>
      </div>
      <div class="joint__out" id="jointOut"></div>
    </div>`;
  }

  function renderProjectMeta() {
    const p = D.project || {};
    const parts = [
      p.author && `Авторы: ${esc(p.author)}`,
      p.school && esc(p.school),
      p.supervisor && `Ғылыми жетекшісі: ${esc(p.supervisor)}`,
      [p.city, p.year].filter(Boolean).map(esc).join(', ')
    ].filter(Boolean);
    $('#projectMeta').innerHTML = parts.join(' · ');
  }

  // =====================================================================
  //  Нәтижелер (әр енгізуден кейін жаңартылады)
  // =====================================================================
  function renderResults() {
    const errs = inputErrors();
    $$('[data-mass]').forEach((el) => el.classList.remove('invalid'));
    for (const e of errs.filter((x) => x.kind === 'mass')) {
      const el = $(`[data-mass="${e.pid}"][data-mat="${e.mid}"]`);
      if (el) el.classList.add('invalid');
    }
    showError('#massError', errs.filter((e) => e.kind === 'mass'));
    showError('#carError', errs.filter((e) => e.kind !== 'mass'));

    const masses = totalMasses();
    if (isGroup()) {
      for (const m of state.materials) {
        const cell = $(`[data-total="${m.id}"]`);
        if (cell) cell.textContent = masses[m.id] ? F.num(masses[m.id]) : '—';
      }
    }

    if (errs.length) {
      const msg = '<div class="empty"><p><b>Енгізу қателерін түзетіңіз.</b> Теріс немесе сан емес мәндер болғанда есеп жүргізілмейді.</p></div>';
      for (const id of ['#summary', '#verdictCard', '#stepsCard']) $(id).innerHTML = msg;
      for (const id of ['#cmpTable', '#thCard', '#chartCard']) $(id).innerHTML = '';
      const out = $('#jointOut');
      if (out) out.innerHTML = msg;
      renderJournal(null);
      return;
    }

    const t = transport();
    const cmp = C.comparePoints(state.points, masses, t);
    const focus = cmp.evals.find((e) => e.pointId === state.focusId) || cmp.bestFull || cmp.bestAny || cmp.evals[0] || null;

    renderSummary(cmp, masses, t);
    renderCompare(cmp, focus, t);
    renderVerdict(focus, t);
    renderChart(focus, t);
    renderThresholds(focus, t, masses);
    renderSteps(focus, t);
    renderJoint(cmp, t);
    renderJournal(focus);
    S.save(state);
  }

  function showError(sel, errs) {
    $(sel).hidden = !errs.length;
    $(sel).textContent = errs.map((e) => e.text).join('; ');
  }

  function focusSelect(focus) {
    const options = state.points.map((p) => `<option value="${p.id}"${focus && focus.pointId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    return `<select class="select" data-focus-select aria-label="Пунктті таңдау">${options}</select>`;
  }

  function renderSummary(cmp, masses, t) {
    const total = sumKg(masses);
    const box = $('#summary');
    if (!total) {
      box.innerHTML = `<h2 class="summary__title">Нәтиже</h2><p class="hint">${ADVICE.no_mass}</p>`;
      return;
    }
    const shown = cmp.bestFull || cmp.bestAny;
    const adv = C.advice(shown, t.mode);
    const walk = t.mode === 'walk';
    box.innerHTML = `
      <h2 class="summary__title">Нәтиже</h2>
      <p class="summary__line">Барлығы жиналды: <b>${F.kg(total)}</b></p>
      <p class="summary__caption">${cmp.bestFull ? 'Барлық жиынтық үшін ең тиімді пункт' : 'Бірде-бір пункт барлық жиынтықты бірден қабылдамайды'}</p>
      ${shown ? `<p class="summary__point">${esc(pointById(shown.pointId).name)}${cmp.bestFull ? '' : ' <span class="status status--warn">бәрін қабылдамайды</span>'}</p>
      <p class="figure ${sign(shown.result)}">${F.money(shown.result)}</p>
      <p class="summary__caption">жанармай шығынын шегергендегі нәтиже</p>
      <dl class="kv">
        <div><dt>Түсім</dt><dd>${F.money(shown.revenue)}</dd></div>
        <div><dt>Жанармай</dt><dd>${walk ? '—' : F.money(shown.fuelCost)}</dd></div>
        <div><dt>Қосымша жүріс</dt><dd>${walk ? '—' : F.km(shown.distanceKm)}</dd></div>
      </dl>
      <p class="verdict verdict--${adv.tone}">${ADVICE[adv.code]}</p>` : ''}
      <a class="link" href="#compare">Барлық пункттер</a>`;
  }

  function renderCompare(cmp, focus, t) {
    if (!cmp.evals.some((e) => e.hasMass)) {
      $('#cmpTable').innerHTML = '<tbody><tr><td class="empty">Пункттерді салыстыру үшін массаны енгізіңіз.</td></tr></tbody>';
      return;
    }
    const walk = t.mode === 'walk';
    const rows = cmp.evals.map((e) => {
      const p = pointById(e.pointId);
      const ok = e.items.filter((i) => i.status === C.STATUS.OK);
      const notes = [];
      if (cmp.bestFull && e.pointId === cmp.bestFull.pointId) notes.push('<span class="status status--best">барлық жиынтық үшін ең тиімді</span>');
      else if (cmp.bestAny && e.pointId === cmp.bestAny.pointId && !e.acceptsAll) notes.push('<span class="status status--warn">нәтижесі ең жоғары, бірақ бәрін қабылдамайды</span>');
      if (!p.confirmed) notes.push('<span class="status">бағалар расталмаған</span>');
      const accepted = [
        ok.length ? listNames(ok) : '',
        e.unpriced.length ? `<span class="warn">бағасы нақтыланбаған: ${listNames(e.unpriced)}</span>` : ''
      ].filter(Boolean).join('<br>');
      const rejected = [
        e.notAccepted.length ? `Қабылдамайды: ${listNames(e.notAccepted)}` : '',
        e.belowMin.length ? `Партиядан аз: ${e.belowMin.map((i) => `${esc(matName(i.matId))} (${F.num(i.mass)} / ${F.num(i.minBatch)} кг)`).join(', ')}` : ''
      ].filter(Boolean).join('<br>');
      const isFocus = focus && e.pointId === focus.pointId;
      return `<tr data-focus="${e.pointId}" tabindex="0"${isFocus ? ' aria-selected="true"' : ''}>
        <th scope="row">${esc(p.name)}<span class="notes">${notes.join('')}</span></th>
        <td>${accepted || '—'}</td>
        <td class="muted">${rejected || '—'}</td>
        <td class="num">${F.money(e.revenue)}</td>
        <td class="num">${walk ? '—' : F.km(e.distanceKm)}</td>
        <td class="num">${walk ? '—' : F.money(e.fuelCost)}</td>
        <td class="num"><b class="${sign(e.result)}">${F.money(e.result)}</b></td>
      </tr>`;
    }).join('');
    $('#cmpTable').innerHTML = `<thead><tr><th>Пункт</th><th>Не қабылданады</th><th>Қабылданбайды / өткізу мүмкін емес</th>
      <th class="num">Түсім</th><th class="num">Жүріс</th><th class="num">Жанармай</th><th class="num">Нәтиже</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderVerdict(focus, t) {
    const box = $('#verdictCard');
    if (!focus) { box.innerHTML = '<p class="hint">Қабылдау пунктін қосыңыз.</p>'; return; }
    const p = pointById(focus.pointId);
    const adv = C.advice(focus, t.mode);
    const warns = [];
    if (!p.confirmed) warns.push('Пункт бағалары расталмаған — сапар алдында нақтылаңыз.');
    for (const i of focus.unpriced) warns.push(`«${matName(i.matId)}»: бағасы нақтыланбаған, түсімге қосылмады.`);
    for (const i of focus.belowMin) warns.push(`«${matName(i.matId)}»: ${F.num(i.mass)} кг ең аз партиядан (${F.num(i.minBatch)} кг) аз — өткізу мүмкін емес.`);
    for (const i of focus.notAccepted) warns.push(`«${matName(i.matId)}»: пункт қабылдамайды, түсімге кірмейді.`);

    let scale = '';
    if (focus.scale && t.mode !== 'walk') {
      const paid = sumKg(Object.fromEntries(focus.items.filter((i) => i.status === C.STATUS.OK).map((i) => [i.matId, i.mass])));
      scale = `<p>Пункт төлейтін материалдардың осы арақатынасында шамамен <b>${F.num(focus.scale)}</b> есе көп керек: ${F.kg(paid)} орнына шамамен <b>${F.kg(paid * focus.scale)}</b>.</p>`;
    }
    box.innerHTML = `<div class="panel__head"><h3>Қорытынды</h3>${focusSelect(focus)}</div>
      <p class="figure ${sign(focus.result)}">${F.money(focus.result)}</p>
      <p class="hint">Түсім ${F.money(focus.revenue)} − жанармай ${F.money(focus.fuelCost)}</p>
      <p class="verdict verdict--${adv.tone}">${ADVICE[adv.code]}</p>
      ${scale}
      ${warns.length ? `<ul class="warns">${warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
  }

  function renderChart(focus, t) {
    const box = $('#chartCard');
    const head = '<div class="panel__head"><h3>Нәтиженің массаға тәуелділігі</h3></div>';
    if (!focus || !focus.hasMass) { box.innerHTML = head + '<p class="hint">Массаны енгізіңіз.</p>'; return; }
    const paid = focus.items.filter((i) => i.status === C.STATUS.OK);
    const m0 = paid.reduce((s, i) => s + i.mass, 0);
    if (t.mode === 'walk' || !(focus.fuelCost > 0) || !(m0 > 0)) {
      box.innerHTML = head + `<p class="hint">${t.mode === 'walk' ? 'Жаяу барғанда жанармай шығыны жоқ, сондықтан өтелу нүктесі болмайды.' : 'График үшін пункт төлейтін материал мен нөлден үлкен жүріс қажет.'}</p>`;
      return;
    }
    const a = focus.revenue / m0;
    const C0 = focus.fuelCost;
    box.innerHTML = head + `
      <ul class="legend">
        <li><i class="lg lg--rev"></i>Түсім R(m)</li>
        <li><i class="lg lg--fuel"></i>Жанармай шығыны C</li>
        <li><i class="lg lg--loss"></i>Залал аймағы</li>
      </ul>
      <div class="chart-box" id="chartBox"></div>
      <p class="hint">Пункт төлейтін материалдардың қазіргі арақатынасы сақталады деп есептеледі (орташа баға ${F.num(a)} ₸/кг).</p>
      <details class="data-table"><summary>Кесте түрінде</summary>
        <table class="tbl"><thead><tr><th class="num">Масса</th><th class="num">Түсім</th><th class="num">Жанармай</th><th class="num">Нәтиже</th></tr></thead>
        <tbody>${[0, m0, C0 / a, Math.max(m0, C0 / a) * 1.5].sort((x, y) => x - y).map((m) => `<tr><td class="num">${F.kg(m)}</td><td class="num">${F.money(a * m)}</td><td class="num">${F.money(C0)}</td><td class="num">${F.money(a * m - C0)}</td></tr>`).join('')}</tbody></table>
      </details>`;
    chartArgs = { a, C: C0, m0 };
    window.BreakEvenChart.render($('#chartBox'), chartArgs);
  }
  let chartArgs = null;
  window.addEventListener('resize', () => {
    const boxEl = $('#chartBox');
    if (boxEl && chartArgs) window.BreakEvenChart.render(boxEl, chartArgs);
  });

  function renderThresholds(focus, t, masses) {
    const box = $('#thCard');
    if (!focus) { box.innerHTML = ''; return; }
    const p = pointById(focus.pointId);
    const rows = focus.thresholds.map((th) => {
      const name = `<th scope="row">${esc(matName(th.matId))}</th>`;
      if (th.kind === 'unknown_price') return `<tr>${name}<td class="num muted">нақтыланбаған</td><td colspan="3" class="muted">Бағасыз шекті есептеу мүмкін емес</td></tr>`;
      if (th.kind === 'zero_price') return `<tr>${name}<td class="num">0 ₸/кг</td><td colspan="3" class="muted">Өткізу ақшалай түсім бермейді, шек анықталмайды</td></tr>`;
      const have = Number(masses[th.matId]) || 0;
      return `<tr>${name}
        <td class="num">${F.num(p.prices[th.matId])} ₸/кг</td>
        <td class="num">${F.kg(th.mMin)}${th.byBatch > th.byFuel ? '<span class="sub">партия бойынша</span>' : ''}</td>
        <td class="num">${F.kg(have)}</td>
        <td class="num">${th.need <= 0 ? '<span class="pos">жеткілікті</span>' : '+' + F.kg(th.need)}</td></tr>`;
    }).join('');
    box.innerHTML = `<div class="panel__head"><h3>Әр материал бойынша жинақтау шегі · ${esc(p.name)}</h3></div>
      <p class="hint">Тек бір материалды өткізгенде жанармай шығынын ${t.mode === 'walk' ? '(жаяу барғанда ол жоқ, сондықтан тек ең аз партия ескеріледі)' : `(${F.money(focus.fuelCost)})`} өтеу үшін одан қанша керек.</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Материал</th><th class="num">Баға</th><th class="num">m<sub>min</sub></th><th class="num">Бар</th><th class="num">Тағы керек</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted">Пункт материалдарды көрсетпеген</td></tr>'}</tbody></table></div>`;
  }

  function renderSteps(e, t) {
    const box = $('#stepsCard');
    if (!e || !e.hasMass) { box.innerHTML = '<h3>Есептеу қадамдары</h3><p class="hint">Массаны енгізіңіз немесе оқу мысалын ашыңыз.</p>'; return; }
    const p = pointById(e.pointId);
    const ok = e.items.filter((i) => i.status === C.STATUS.OK);
    const rTerms = ok.map((i) => `${F.num(i.mass)} кг × ${F.num(i.price)} ₸/кг`).join(' + ') || '0';
    const dText = t.mode === 'separate' ? `2 × ${F.num(Number(p.oneWayKm) || 0)} км (бару-қайту) = ${F.km(e.distanceKm)}`
      : t.mode === 'walk' ? '0 км (жаяу)' : `${F.km(e.distanceKm)} (бағытқа қосымша)`;
    const first = ok[0];
    const excluded = [...e.notAccepted, ...e.belowMin, ...e.unpriced];
    box.innerHTML = `<div class="panel__head"><h3>Есептеу қадамдары · ${esc(p.name)}</h3>${focusSelect(e)}</div>
      <ol class="steps">
        <li><span>Түсім</span><code>R = ${rTerms} = <b>${F.money(e.revenue)}</b></code></li>
        <li><span>Қосымша жүріс</span><code>d = ${dText}</code></li>
        <li><span>Отын</span><code>Q = ${F.num(e.distanceKm)} × ${F.num(t.consumption)} / 100 = <b>${F.lit(e.liters)}</b></code></li>
        <li><span>Жанармай шығыны</span><code>C = ${F.num(e.liters)} л × ${F.num(t.fuelPrice)} ₸/л = <b>${F.money(e.fuelCost)}</b></code></li>
        <li><span>Нәтиже</span><code>B = ${F.num(e.revenue)} − ${F.num(e.fuelCost)} = <b class="${sign(e.result)}">${F.money(e.result)}</b></code></li>
        ${first && t.mode !== 'walk' ? `<li><span>«${esc(matName(first.matId))}» шегі</span><code>m<sub>min</sub> = ${F.num(e.fuelCost)} / ${F.num(first.price)} = <b>${F.kg(e.fuelCost / first.price)}</b></code></li>` : ''}
      </ol>
      ${excluded.length ? `<p class="hint">Түсімге кірмеді: ${listNames(excluded)}.</p>` : ''}`;
  }

  function renderJoint(cmp, t) {
    const out = $('#jointOut');
    if (!out) return;
    const best = cmp.bestFull || cmp.bestAny;
    const point = pointById(state.joint.pointId) || (best && pointById(best.pointId)) || state.points[0];
    if (!point) { out.innerHTML = '<p class="hint">Қабылдау пунктін қосыңыз.</p>'; return; }
    const people = state.participants.map((p) => ({ name: p.name, masses: p.masses, distanceKm: Number(p.distanceKm) || 0 }));
    const r = C.compareJoint(point, people, t, Number(state.joint.distanceKm) || 0);
    if (!r.joint.hasMass) { out.innerHTML = '<p class="hint">2-бөлімде қатысушылардың массасын енгізіңіз.</p>'; return; }

    const s = r.separateTotal;
    const winner = r.gain > 1e-6 ? 'joint' : r.gain < -1e-6 ? 'separate' : 'equal';
    const col = (title, v, win) => `<div class="vs__col${win ? ' is-win' : ''}">
        <p class="vs__title">${title}${win ? ' <span class="status status--best">тиімдірек</span>' : ''}</p>
        <p class="figure figure--sm ${sign(v.result)}">${F.money(v.result)}</p>
        <dl class="kv"><div><dt>Түсім</dt><dd>${F.money(v.revenue)}</dd></div><div><dt>Жүріс</dt><dd>${F.km(v.distanceKm)}</dd></div><div><dt>Жанармай</dt><dd>${F.money(v.fuelCost)}</dd></div></dl>
      </div>`;
    const verdict = {
      joint: `Ортақ сапар ${F.money(r.gain)} тиімдірек және ${F.km(Math.max(0, s.distanceKm - r.joint.distanceKm))} жүрісті үнемдейді.`,
      separate: `Жеке сапарлар ${F.money(-r.gain)} тиімдірек: шикізат жинауға айналып өту жолы тым ұзақ.`,
      equal: 'Ақшалай нәтиже бойынша нұсқалар тең.'
    }[winner];
    out.innerHTML = `<p class="hint">Пункт: <b>${esc(point.name)}</b></p>
      <div class="vs">${col(`Жеке сапарлар (${s.trips})`, s, winner === 'separate')}${col('Бір ортақ сапар', r.joint, winner === 'joint')}</div>
      <p class="verdict verdict--${winner === 'joint' ? 'good' : winner === 'separate' ? 'bad' : 'neutral'}">${verdict}</p>
      ${r.joint.revenue > s.revenue + 1e-6 ? '<p class="hint">Ортақ сапардың түсімі жоғары, себебі бірігу арқылы ең аз партияны жинауға болады.</p>' : ''}`;
  }

  // ---------- пилоттық тексеру журналы ----------
  function renderJournal(focus) {
    const box = $('#journalCard');
    const canSave = focus && focus.hasMass;
    const rows = state.journal.map((r) => {
      return `<tr>
        <td>${esc(F.date(r.date))}</td>
        <th scope="row">${esc(r.caseName)}</th>
        <td>${esc(r.pointName)}</td>
        <td class="num">${F.num(r.predictedKg)}</td>
        <td class="num">${F.money(r.predictedRevenue)}</td>
        <td class="num">${F.money(r.predictedResult)}</td>
        <td class="num"><input type="number" min="0" step="0.1" inputmode="decimal" data-jr="${r.id}" data-jkey="actualKg" value="${esc(r.actualKg)}" aria-label="Нақты масса, кг"></td>
        <td class="num"><input type="number" min="0" step="1" inputmode="decimal" data-jr="${r.id}" data-jkey="actualPayment" value="${esc(r.actualPayment)}" aria-label="Нақты төлем, ₸"></td>
        ${journalDiffCells(r)}
        <td><input data-jr="${r.id}" data-jkey="reason" value="${esc(r.reason)}" placeholder="—" aria-label="Себебі"></td>
        <td><button type="button" class="del" data-deljr="${r.id}" aria-label="Жазбаны өшіру">×</button></td>
      </tr>`;
    }).join('');
    const defaultName = participants()[0] ? participants()[0].name : '';
    box.innerHTML = `
      <form class="jform" id="journalForm">
        <label class="field"><span>Жағдай атауы</span><input name="caseName" value="${esc(defaultName)}" required></label>
        <p class="hint">${canSave ? `Болжам «${esc(pointById(focus.pointId).name)}» пункті үшін сақталады: түсім ${F.money(focus.revenue)}, нәтиже ${F.money(focus.result)}.` : 'Болжамды сақтау үшін массаны енгізіңіз.'}</p>
        <button class="btn btn--primary" type="submit"${canSave ? '' : ' disabled'}>Болжамды журналға жазу</button>
      </form>
      ${state.journal.length ? `<div class="scroll"><table class="tbl journal">
        <thead><tr><th>Күні</th><th>Жағдай</th><th>Пункт</th><th class="num">Болжам: масса, кг</th><th class="num">Болжам: төлем</th><th class="num">Болжам: нәтиже</th>
        <th class="num">Нақты масса, кг</th><th class="num">Нақты төлем, ₸</th><th class="num">Айырма</th><th class="num">Айырма, %</th><th>Себебі</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
        <p class="journal__stats" id="journalStats">${journalStats()}</p>
        <div class="block__foot"><button class="link" type="button" id="csvBtn">CSV-ге экспорттау</button></div>` : '<p class="hint">Журнал әзірге бос.</p>'}`;
  }

  function journalDiffCells(r) {
    const actual = r.actualPayment === '' ? NaN : Number(r.actualPayment);
    if (!Number.isFinite(actual)) return `<td class="num" data-jdiff="${r.id}">—</td><td class="num">—</td>`;
    const diff = actual - r.predictedRevenue;
    const rel = actual > 0 ? F.pct((diff / actual) * 100) : '—';
    return `<td class="num" data-jdiff="${r.id}"><span class="${sign(diff)}">${F.money(diff)}</span></td><td class="num">${rel}</td>`;
  }

  function journalStats() {
    const e = C.forecastError(state.journal);
    if (!e.n) return 'Өткізгеннен кейін нақты төлемді енгізіңіз — дәлдік автоматты түрде есептеледі.';
    return `Нақты деректері бар жағдайлар: <b>${e.n}</b> · орташа абсолют ауытқу: <b>${F.money(e.mae)}</b>` +
      (e.mape == null ? '' : ` · орташа салыстырмалы ауытқу: <b>${F.pct(e.mape)}</b>`);
  }

  // Кестені қайта салмай, тек есептелетін ұяшықтарды жаңарту (курсор орнында қалады)
  function updateJournalRow(id) {
    const r = byId(state.journal, id);
    const cell = $(`[data-jdiff="${id}"]`);
    if (r && cell) {
      cell.nextElementSibling.remove();
      cell.outerHTML = journalDiffCells(r);
    }
    $('#journalStats').innerHTML = journalStats();
  }

  function addJournalRecord(caseName) {
    const masses = totalMasses();
    const cmp = C.comparePoints(state.points, masses, transport());
    const focus = cmp.evals.find((e) => e.pointId === state.focusId) || cmp.bestFull || cmp.bestAny;
    if (!focus || !focus.hasMass) return;
    state.journal.push({
      id: S.uid(),
      date: new Date().toISOString(),
      caseName,
      pointName: pointById(focus.pointId).name,
      mode: state.transport.mode,
      predictedKg: sumKg(masses),
      predictedRevenue: focus.revenue,
      predictedFuel: focus.fuelCost,
      predictedResult: focus.result,
      actualKg: '',
      actualPayment: '',
      reason: ''
    });
  }

  function exportCsv() {
    const head = ['Күні', 'Жағдай', 'Пункт', 'Жеткізу тәсілі', 'Болжам: масса, кг', 'Болжам: төлем, ₸', 'Болжам: жанармай, ₸', 'Болжам: нәтиже, ₸', 'Нақты масса, кг', 'Нақты төлем, ₸', 'Себебі'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = state.journal.map((r) => [F.date(r.date), r.caseName, r.pointName, r.mode, r.predictedKg, r.predictedRevenue, r.predictedFuel, r.predictedResult, r.actualKg, r.actualPayment, r.reason].map(cell).join(';'));
    download('ecoesep-zhurnal.csv', '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n'), 'text/csv');
  }

  // =====================================================================
  //  Оқиғалар
  // =====================================================================
  const full = () => { renderInputs(); renderResults(); };
  const byId = (list, id) => list.find((x) => x.id === id);

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    const d = el.dataset;
    if (d.mass) byId(state.participants, d.mass).masses[d.mat] = el.value;
    else if (d.dist) pointById(d.dist)[d.key] = el.value;
    else if (d.pdist) byId(state.participants, d.pdist).distanceKm = el.value;
    else if (d.pname) { byId(state.participants, d.pname).name = el.value; renderJointInputs(); }
    else if (d.jr) { byId(state.journal, d.jr)[d.jkey] = el.value; updateJournalRow(d.jr); S.save(state); return; }
    else if (el.id === 'consumption' || el.id === 'fuelPrice') state.transport[el.id] = el.value;
    else if (el.id === 'jointDist') state.joint.distanceKm = el.value;
    else return;
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
    const d = el.dataset;
    if (d.who) { state.who = d.who; relabel(); full(); }
    else if (d.mode) { state.transport.mode = d.mode; full(); }
    else if (d.delp) { state.participants = state.participants.filter((p) => p.id !== d.delp); full(); }
    else if (d.deljr) { if (confirm('Жазбаны өшіру керек пе?')) { state.journal = state.journal.filter((r) => r.id !== d.deljr); renderResults(); } }
    else if (d.edit) openPoint(d.edit);
    else if (d.focus) { state.focusId = d.focus; renderResults(); }
    else if (el.id === 'addParticipant') {
      const n = state.participants.length + 1;
      state.participants.push({ id: S.uid(), name: `${n}-${WHO[state.who].unit}`, masses: {}, distanceKm: '10' });
      full();
    }
    else if (el.id === 'addPoint') openPoint(null);
    else if (el.id === 'exampleBtn') loadExample();
    else if (el.id === 'jointDemo') loadJointDemo();
    else if (el.id === 'exportBtn') exportPoints();
    else if (el.id === 'csvBtn') exportCsv();
    else if (el.id === 'printBtn') window.print();
    else if (el.id === 'resetBtn') {
      if (confirm('Шартты деректерді қайтару керек пе? Енгізілген пункттер мен массалар өшіріледі (журнал сақталады).')) {
        const journal = state.journal;
        state = S.defaults();
        state.journal = journal;
        full();
      }
    }
  });

  document.addEventListener('keydown', (ev) => {
    const tr = ev.target.closest && ev.target.closest('tr[data-focus]');
    if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); state.focusId = tr.dataset.focus; renderResults(); }
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target;
    if (form.id === 'addMatForm') {
      ev.preventDefault();
      const name = form.mat.value.trim();
      if (!name) return;
      state.materials.push({ id: 'm_' + S.uid(), name, hint: '' });
      form.reset();
      full();
    } else if (form.id === 'journalForm') {
      ev.preventDefault();
      addJournalRecord(form.caseName.value.trim());
      renderResults();
    }
  });

  // Әдепкі атауларды таңдалған режимге сәйкес өзгерту: «1-отбасы» ↔ «1-қатысушы»
  function relabel() {
    const unit = WHO[state.who].unit;
    state.participants.forEach((p, i) => {
      if (/^\d+-(отбасы|қатысушы)$/.test(p.name)) p.name = `${i + 1}-${unit}`;
    });
  }

  function loadExample() {
    const ex = D.example;
    state.who = 'family';
    state.participants = [{ id: S.uid(), name: '1-отбасы', masses: S.clone(ex.masses), distanceKm: '10' }];
    state.transport = { mode: ex.transport.mode, consumption: String(ex.transport.consumption), fuelPrice: String(ex.transport.fuelPrice) };
    state.points = [S.clone(ex.point)];
    state.focusId = ex.point.id;
    full();
    $('#method').scrollIntoView({ behavior: 'smooth' });
  }

  function loadJointDemo() {
    state.who = 'families';
    const first = state.participants[0] || { masses: {} };
    state.participants = [
      { id: S.uid(), name: '1-отбасы', masses: first.masses, distanceKm: '10' },
      { id: S.uid(), name: '2-отбасы', masses: { paper: '7', cardboard: '4' }, distanceKm: '12' }
    ];
    full();
  }

  // ---------- пункт редакторы ----------
  let editingId = null;
  const form = $('#pointForm');

  function openPoint(id) {
    editingId = id;
    const p = id ? pointById(id) : { name: '', address: '', prices: {}, minBatch: {}, requirements: '', source: '', checkedAt: '', confirmed: false };
    $('#pointDlgTitle').textContent = id ? 'Қабылдау пункті' : 'Жаңа қабылдау пункті';
    form.ptName.value = p.name;
    form.address.value = p.address || '';
    form.requirements.value = p.requirements || '';
    form.source.value = p.source || '';
    form.checkedAt.value = p.checkedAt || '';
    form.confirmed.checked = !!p.confirmed;
    $('#deletePoint').hidden = !id;
    const rows = state.materials.map((m) => {
      const on = Object.prototype.hasOwnProperty.call(p.prices, m.id);
      return `<div class="me">
        <input type="checkbox" data-acc="${m.id}"${on ? ' checked' : ''} aria-label="Қабылдайды: ${esc(m.name)}">
        <span>${esc(m.name)}</span>
        <input type="number" min="0" step="0.1" inputmode="decimal" data-price="${m.id}" placeholder="нақтыланбаған" value="${on && p.prices[m.id] != null ? p.prices[m.id] : ''}" aria-label="${esc(m.name)}, баға">
        <input type="number" min="0" step="0.1" inputmode="decimal" data-batch="${m.id}" placeholder="жоқ" value="${(p.minBatch || {})[m.id] ?? ''}" aria-label="${esc(m.name)}, ең аз партия">
      </div>`;
    }).join('');
    $('#matEditor').innerHTML = `<div class="me me--head"><span></span><span>Материал</span><span>Баға, ₸/кг</span><span>Ең аз партия, кг</span></div>${rows}`;
    $('#pointDlg').showModal();
  }

  form.addEventListener('submit', (ev) => {
    if (!ev.submitter || ev.submitter.value !== 'save') return;
    if (!form.ptName.value.trim()) { ev.preventDefault(); form.ptName.focus(); return; }
    const prices = {};
    const minBatch = {};
    for (const m of state.materials) {
      if (!$(`[data-acc="${m.id}"]`, form).checked) continue;
      const price = $(`[data-price="${m.id}"]`, form).value;
      const batch = $(`[data-batch="${m.id}"]`, form).value;
      if ((price !== '' && Number(price) < 0) || (batch !== '' && Number(batch) < 0)) {
        ev.preventDefault();
        alert('Баға мен партия теріс бола алмайды.');
        return;
      }
      prices[m.id] = price === '' ? null : Number(price);
      if (Number(batch) > 0) minBatch[m.id] = Number(batch);
    }
    const data = {
      name: form.ptName.value.trim(),
      address: form.address.value.trim(),
      prices,
      minBatch,
      requirements: form.requirements.value.trim(),
      source: form.source.value.trim(),
      checkedAt: form.checkedAt.value,
      confirmed: form.confirmed.checked
    };
    if (editingId) Object.assign(pointById(editingId), data);
    else state.points.push({ id: 'p_' + S.uid(), oneWayKm: '', detourKm: '', ...data });
    full();
  });

  $('#deletePoint').addEventListener('click', () => {
    if (!editingId || !confirm('Пунктті өшіру керек пе?')) return;
    state.points = state.points.filter((p) => p.id !== editingId);
    $('#pointDlg').close();
    full();
  });

  // Баға енгізілгенде «қабылдайды» белгісі өзі қойылады
  $('#matEditor').addEventListener('input', (ev) => {
    const id = ev.target.dataset.price || ev.target.dataset.batch;
    if (id && ev.target.value !== '') $(`[data-acc="${id}"]`).checked = true;
  });

  // ---------- экспорт / импорт ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportPoints() {
    const payload = { app: 'EcoEsep', version: 2, savedAt: new Date().toISOString(), materials: state.materials, points: state.points };
    download('ecoesep-punktter.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  function importFile(file) {
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text);
      if (!Array.isArray(data.points)) throw new Error('пункттер тізімі жоқ');
      if (Array.isArray(data.materials)) state.materials = data.materials;
      state.points = data.points;
      full();
    }).catch((e) => alert('Файлды оқу мүмкін болмады: ' + e.message));
  }

  window.addEventListener('beforeprint', () => { $('.intro').dataset.printed = F.date(new Date().toISOString()); });

  full();
})();
