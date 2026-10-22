/* Калькулятор: төрт қадам және нәтиже */
(function () {
  'use strict';
  const App = window.App;
  const { C, F, $, $$, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="calc"]');
  const body = $('#calcBody');

  const MODES = [
    { id: 'walk', title: 'Жаяу немесе велосипедпен', text: 'Жанармай жұмсалмайды, бірақ уақыт пен күш кетеді.' },
    { id: 'separate', title: 'Көлікпен арнайы бару', text: 'Пунктке әдейі барып-қайту. Қашықтық екі есе алынады.' },
    { id: 'onway', title: 'Жол-жөнекей соғу', text: 'Басқа жаққа бара жатып соғу. Тек қосымша жол есептеледі.' }
  ];

  // =====================================================================
  //  Қадамдар
  // =====================================================================
  function step1() {
    const choices = Object.entries(App.WHO).map(([id, w]) => `
      <button type="button" class="choice" data-who="${id}" aria-pressed="${st().who === id}">
        <b>${w.label}</b><span>${w.hint}</span>
      </button>`).join('');
    return `<div class="panel pad step">
      <h2 class="step__title">Шикізатты кім жинайды?</h2>
      <p class="hint">Бір нұсқаны таңдап, «Келесі» батырмасын басыңыз.</p>
      <div class="choices">${choices}</div>
    </div>`;
  }

  function step2() {
    const parts = App.participants();
    const group = App.isGroup();
    const canDelete = group && parts.length > 1;
    const head = parts.map((p) => `<th class="num">
        <span class="pname"><input data-pname="${p.id}" value="${esc(p.name)}" aria-label="Қатысушы атауы">${canDelete ? `<button type="button" class="del" data-delp="${p.id}" aria-label="${esc(p.name)} өшіру">×</button>` : ''}</span>
      </th>`).join('');
    const rows = st().materials.map((m) => {
      const cells = parts.map((p) => `<td class="num"><input type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"
        data-mass="${p.id}" data-mat="${m.id}" value="${esc(p.masses[m.id] ?? '')}" aria-label="${esc(m.name)}, ${esc(p.name)}, кг"></td>`).join('');
      return `<tr><th scope="row"><span class="mat">${esc(m.name)}</span><span class="mat__hint">${esc(m.hint || '')}</span></th>${cells}${group ? `<td class="num total" data-total="${m.id}">—</td>` : ''}</tr>`;
    }).join('');
    return `<div class="panel pad step">
      <h2 class="step__title">Не жиналды?</h2>
      <p class="hint">Әр материалдың массасын килограммен жазыңыз. Жоқ материалды бос қалдырыңыз. Тұрмыстық таразымен өлшеуге болады.</p>
      <div class="scroll"><table class="mass">
        <thead><tr><th>Материал</th>${head}${group ? '<th class="num">Барлығы, кг</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="total-line">Барлығы: <b id="massTotal">0 кг</b></p>
      <p class="error" id="massError" hidden></p>
      <div class="actions">
        ${group ? `<button class="btn" type="button" id="addParticipant">+ ${esc(App.WHO[st().who].unit)} қосу</button>` : ''}
        <form class="addmat" id="addMatForm">
          <input name="mat" placeholder="Тізімде жоқ материал" aria-label="Жаңа материал атауы">
          <button class="btn btn--ghost" type="submit">+ Материал</button>
        </form>
      </div>
    </div>`;
  }

  function step3() {
    const mode = st().transport.mode;
    const choices = MODES.map((m) => `
      <button type="button" class="choice" data-mode="${m.id}" aria-pressed="${mode === m.id}">
        <b>${m.title}</b><span>${m.text}</span>
      </button>`).join('');
    const key = mode === 'separate' ? 'oneWayKm' : 'detourKm';
    const distLabel = mode === 'separate' ? 'бір бағытқа, км' : 'қосымша жол, км';
    const points = st().points.map((p) => `
      <div class="pick${p.inCompare ? ' is-on' : ''}">
        <label class="pick__check"><input type="checkbox" data-include="${p.id}"${p.inCompare ? ' checked' : ''}>
          <span><b>${esc(p.name)}</b><small>${esc(p.address || '')}</small></span></label>
        ${mode === 'walk' ? '' : `<label class="pick__dist"><span>${distLabel}</span>
          <input type="number" min="0" step="0.1" inputmode="decimal" data-dist="${p.id}" data-key="${key}" value="${esc(p[key] ?? '')}" placeholder="?"></label>`}
        <a class="link" href="#/map" data-mapgo="${p.id}">Картадан</a>
      </div>`).join('');
    return `<div class="panel pad step">
      <h2 class="step__title">Пунктке қалай жеткізесіз?</h2>
      <div class="choices">${choices}</div>
      <div class="pair${mode === 'walk' ? ' is-off' : ''}">
        <label class="field"><span>Көліктің отын шығыны, л/100 км</span><input type="number" inputmode="decimal" min="0" step="0.1" id="consumption" value="${esc(st().transport.consumption)}"></label>
        <label class="field"><span>Жанармай бағасы, ₸/л (АИ-92)</span><input type="number" inputmode="decimal" min="0" step="1" id="fuelPrice" value="${esc(st().transport.fuelPrice)}" placeholder="бекеттегі баға"></label>
      </div>
      <p class="error" id="carError" hidden></p>
    </div>
    <div class="panel pad step">
      <h2 class="step__title">Қай пункттерді салыстырамыз?</h2>
      <p class="hint">${mode === 'walk' ? 'Белгіленген пункттер салыстырылады.' : 'Белгілеп, әр пунктке дейінгі қашықтықты жазыңыз. Білмесеңіз, «Картадан» сілтемесін басыңыз — Google Maps маршрутындағы километрді осында жазыңыз.'}</p>
      <div class="picks">${points}</div>
    </div>`;
  }

  // =====================================================================
  //  Нәтиже
  // =====================================================================
  function step4() {
    const errs = App.inputErrors();
    if (errs.length) {
      return `<div class="panel pad"><p class="error">${errs.map((e) => esc(e.text)).join('<br>')}</p>
        <p class="hint">Теріс немесе сан емес мәндер болғанда есеп жүргізілмейді. Алдыңғы қадамдарға оралып, түзетіңіз.</p></div>`;
    }
    const ev = App.evaluate();
    if (!ev.total) {
      return `<div class="panel pad hero hero--neutral"><h2>Алдымен массаны енгізіңіз</h2>
        <p>2-қадамда жиналған шикізаттың массасын жазыңыз.</p>
        <button class="btn btn--primary" type="button" data-step="2">2-қадамға өту</button></div>`;
    }
    const tabs = [['compare', 'Пункттерді салыстыру'], ['threshold', 'Қанша жинау керек'], ...(App.isGroup() && st().participants.length > 1 ? [['joint', 'Бірлесіп өткізу']] : []), ['steps', 'Есеп қадамдары']];
    if (!tabs.some(([id]) => id === st().resultTab)) st().resultTab = 'compare';
    return `${hero(ev)}${warnings(ev)}
      <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${st().resultTab === id}">${label}</button>`).join('')}</div>
      <div class="tab-body" id="tabBody">${tabBody(ev)}</div>`;
  }

  function hero(ev) {
    const { cmp, t } = ev;
    const best = cmp.bestFull || cmp.bestAny;
    if (!best) {
      return `<div class="panel pad hero hero--neutral">
        <p class="hero__kicker">Нәтиже</p>
        <h2>Ең тиімді пунктті анықтау әзірге мүмкін емес</h2>
        <p>Ол үшін салыстырылатын пункттің кемінде біреуінде сіздің материалыңыздың <b>бағасы</b> және оған дейінгі <b>қашықтық</b> белгілі болуы керек. Төмендегі ескертулерді қараңыз.</p>
        <div class="actions"><a class="btn btn--primary" href="#/prices">Бағаларды толтыру</a><a class="btn" href="#/map">Қашықтықты анықтау</a></div>
      </div>`;
    }
    const adv = C.advice(best, t.mode);
    const p = App.pointById(best.pointId);
    const title = { covers: 'Қазір өткізуге болады', not_covers: 'Әзірге жинай беріңіз', walk: 'Жаяу өткізуге болады', no_mass: '' }[adv.code];
    const walk = t.mode === 'walk';
    const partial = !cmp.bestFull;
    return `<div class="panel pad hero hero--${adv.tone}">
      <p class="hero__kicker">Нәтиже · барлығы ${F.kg(ev.total)}</p>
      <h2>${title}</h2>
      <p>${App.ADVICE[adv.code]}</p>
      <div class="hero__grid">
        <div>
          <p class="hero__label">${partial ? 'Нәтижесі ең жоғары пункт (бәрін қабылдамайды)' : 'Ұсынылатын пункт'}</p>
          <p class="hero__point">${esc(p.name)}</p>
          <p class="hint">${esc(p.address || '')} ${App.statusTag(p)}</p>
        </div>
        <div>
          <p class="hero__label">Жанармай шығынын шегергендегі нәтиже</p>
          <p class="figure ${App.sign(best.result)}">${F.money(best.result)}</p>
        </div>
      </div>
      <dl class="kv kv--row">
        <div><dt>Түсім</dt><dd>${F.money(best.revenue)}</dd></div>
        <div><dt>Жанармай</dt><dd>${walk ? '—' : F.money(best.fuelCost)}</dd></div>
        <div><dt>Қосымша жүріс</dt><dd>${walk ? '—' : F.km(best.distanceKm)}</dd></div>
      </dl>
      ${partial && best.notAccepted.length ? `<p class="hint">Бұл пункт қабылдамайды: ${App.listNames(best.notAccepted)}.</p>` : ''}
      <div class="actions">
        <button class="btn btn--primary" type="button" data-route="${p.id}">Маршрутты көру</button>
        <button class="btn" type="button" id="toJournal">Болжамды журналға жазу</button>
        <button class="btn btn--ghost" type="button" id="printBtn">Басып шығару</button>
      </div>
    </div>`;
  }

  function warnings(ev) {
    const { t } = ev;
    const list = [];
    const compared = App.comparedPoints();
    if (!compared.length) list.push('Салыстыруға бірде-бір пункт таңдалмаған — 3-қадамда белгілеңіз.');
    if (t.mode !== 'walk' && st().transport.fuelPrice === '') list.push('Жанармай бағасы енгізілмеген (3-қадам), сондықтан жанармай шығыны 0 деп алынды.');
    const noDist = ev.cmp.evals.filter((e) => !e.distanceKnown).map((e) => esc(App.pointById(e.pointId).name));
    if (noDist.length) list.push(`Қашықтығы енгізілмеген: ${noDist.join(', ')}. Олар ең тиімді пунктті таңдауға қатыспайды. <a href="#/map">Картадан анықтау →</a>`);
    const noPrice = ev.cmp.evals.filter((e) => e.hasMass && e.revenue === 0).map((e) => esc(App.pointById(e.pointId).name));
    if (noPrice.length) list.push(`Сіздің материалдарыңыздың бағасы белгісіз: ${noPrice.join(', ')}. <a href="#/prices">Бағаларды нақтылау →</a>`);
    if (compared.some((p) => !p.confirmed)) list.push('Бағалар ашық дереккөздерден алынған және пункттермен расталмаған — барар алдында қоңырау шалыңыз.');
    if (!list.length) return '';
    return `<div class="panel pad warn-panel"><h3>Назар аударыңыз</h3><ul class="warns">${list.map((w) => `<li>${w}</li>`).join('')}</ul></div>`;
  }

  function tabBody(ev) {
    switch (st().resultTab) {
      case 'threshold': return thresholdTab(ev);
      case 'joint': return jointTab(ev);
      case 'steps': return stepsTab(ev);
      default: return compareTab(ev);
    }
  }

  function focusSelect(focus) {
    const options = App.comparedPoints().map((p) => `<option value="${p.id}"${focus && focus.pointId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    return `<label class="inline-select"><span>Пункт:</span><select class="select" data-focus-select>${options}</select></label>`;
  }

  function compareTab(ev) {
    const { cmp, t, focus } = ev;
    if (!cmp.evals.length) return '<div class="panel pad"><p class="hint">Салыстыруға пункт таңдалмаған.</p></div>';
    const walk = t.mode === 'walk';
    const rows = cmp.evals.map((e) => {
      const p = App.pointById(e.pointId);
      const ok = e.items.filter((i) => i.status === C.STATUS.OK);
      const notes = [];
      if (cmp.bestFull && e.pointId === cmp.bestFull.pointId) notes.push('<span class="status status--best">барлық жиынтық үшін ең тиімді</span>');
      else if (cmp.bestAny && e.pointId === cmp.bestAny.pointId && !e.acceptsAll) notes.push('<span class="status status--warn">нәтижесі ең жоғары, бірақ бәрін қабылдамайды</span>');
      notes.push(App.statusTag(p));
      const accepted = [
        ok.length ? App.listNames(ok) : '',
        e.unpriced.length ? `<span class="unk">бағасы белгісіз: ${App.listNames(e.unpriced)}</span>` : ''
      ].filter(Boolean).join('<br>');
      const rejected = [
        e.notAccepted.length ? `Қабылдамайды: ${App.listNames(e.notAccepted)}` : '',
        e.belowMin.length ? `Партиядан аз: ${e.belowMin.map((i) => `${esc(App.matName(i.matId))} (${F.num(i.mass)} / ${F.num(i.minBatch)} кг)`).join(', ')}` : ''
      ].filter(Boolean).join('<br>');
      const unknownRevenue = e.revenue === 0 && e.unpriced.length;
      return `<tr data-focus="${e.pointId}" tabindex="0"${focus && e.pointId === focus.pointId ? ' aria-selected="true"' : ''}>
        <th scope="row">${esc(p.name)}<span class="notes">${notes.join('')}</span></th>
        <td>${accepted || '—'}</td>
        <td class="muted">${rejected || '—'}</td>
        <td class="num">${unknownRevenue ? '<span class="unk">белгісіз</span>' : F.money(e.revenue)}</td>
        <td class="num">${walk ? '—' : e.distanceKnown ? F.km(e.distanceKm) : '<span class="unk">енгізілмеген</span>'}</td>
        <td class="num">${walk ? '—' : e.distanceKnown ? F.money(e.fuelCost) : '—'}</td>
        <td class="num">${unknownRevenue || !e.distanceKnown ? '—' : `<b class="${App.sign(e.result)}">${F.money(e.result)}</b>`}</td>
      </tr>`;
    }).join('');
    return `<p class="hint">Шикізаттың бір бөлігін ғана қабылдайтын пункт барлық жиынтық үшін ең тиімді деп көрсетілмейді. Теріс нәтиже сол күйінде көрсетіледі. Жолды басып, пунктті «Қанша жинау керек» және «Есеп қадамдары» үшін таңдаңыз.</p>
      <div class="scroll panel"><table class="tbl cmp">
        <thead><tr><th>Пункт</th><th>Не қабылданады</th><th>Қабылданбайды / өткізу мүмкін емес</th><th class="num">Түсім</th><th class="num">Жүріс</th><th class="num">Жанармай</th><th class="num">Нәтиже</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  }

  function thresholdTab(ev) {
    const { focus, t, masses } = ev;
    if (!focus) return '<div class="panel pad"><p class="hint">Салыстыруға пункт таңдалмаған.</p></div>';
    const p = App.pointById(focus.pointId);
    const adv = C.advice(focus, t.mode);
    const warns = [];
    for (const i of focus.unpriced) warns.push(`«${App.matName(i.matId)}»: бағасы белгісіз, түсімге қосылмады.`);
    for (const i of focus.belowMin) warns.push(`«${App.matName(i.matId)}»: ${F.num(i.mass)} кг ең аз партиядан (${F.num(i.minBatch)} кг) аз — өткізу мүмкін емес.`);
    for (const i of focus.notAccepted) warns.push(`«${App.matName(i.matId)}»: пункт қабылдамайды.`);
    let scale = '';
    if (focus.scale && t.mode !== 'walk') {
      const paid = App.sumKg(Object.fromEntries(focus.items.filter((i) => i.status === C.STATUS.OK).map((i) => [i.matId, i.mass])));
      scale = `<p>Пункт төлейтін материалдардың осы арақатынасында шамамен <b>${F.num(focus.scale)}</b> есе көп керек: ${F.kg(paid)} орнына шамамен <b>${F.kg(paid * focus.scale)}</b>.</p>`;
    }
    const rows = focus.thresholds.map((th) => {
      const name = `<th scope="row">${esc(App.matName(th.matId))}</th>`;
      if (th.kind === 'unknown_price') return `<tr>${name}<td class="num unk">белгісіз</td><td colspan="3" class="muted">Бағасыз шекті есептеу мүмкін емес</td></tr>`;
      if (th.kind === 'zero_price') return `<tr>${name}<td class="num">0 ₸/кг</td><td colspan="3" class="muted">Өткізу ақшалай түсім бермейді, шек анықталмайды</td></tr>`;
      const have = Number(masses[th.matId]) || 0;
      return `<tr>${name}
        <td class="num">${F.num(p.prices[th.matId])} ₸/кг</td>
        <td class="num">${F.kg(th.mMin)}${th.byBatch > th.byFuel ? '<span class="sub">партия бойынша</span>' : ''}</td>
        <td class="num">${F.kg(have)}</td>
        <td class="num">${th.need <= 0 ? '<span class="pos">жеткілікті</span>' : '+' + F.kg(th.need)}</td></tr>`;
    }).join('');
    return `<div class="cols">
        <div class="panel pad">
          <div class="panel__head"><h3>Қорытынды</h3>${focusSelect(focus)}</div>
          <p class="figure ${App.sign(focus.result)}">${F.money(focus.result)}</p>
          <p class="hint">Түсім ${F.money(focus.revenue)} − жанармай ${F.money(focus.fuelCost)}</p>
          <p class="verdict verdict--${adv.tone}">${App.ADVICE[adv.code]}</p>
          ${scale}
          ${warns.length ? `<ul class="warns">${warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="panel pad" id="chartCard">${chartCard(focus, t)}</div>
      </div>
      <div class="panel pad">
        <div class="panel__head"><h3>Әр материал бойынша жинақтау шегі · ${esc(p.name)}</h3></div>
        <p class="hint">Тек бір материалды өткізгенде жанармай шығынын ${t.mode === 'walk' ? '(жаяу барғанда ол жоқ, сондықтан тек ең аз партия ескеріледі)' : `(${F.money(focus.fuelCost)})`} өтеу үшін одан қанша керек. Шек: <span class="f">m<sub>min</sub> = max(C / p; партия)</span>.</p>
        <div class="scroll"><table class="tbl"><thead><tr><th>Материал</th><th class="num">Баға</th><th class="num">m<sub>min</sub></th><th class="num">Бар</th><th class="num">Тағы керек</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">Пункт материалдарды көрсетпеген</td></tr>'}</tbody></table></div>
      </div>`;
  }

  let chartArgs = null;
  function chartCard(focus, t) {
    chartArgs = null;
    const head = '<div class="panel__head"><h3>Нәтиженің массаға тәуелділігі</h3></div>';
    const paid = focus.items.filter((i) => i.status === C.STATUS.OK);
    const m0 = paid.reduce((s, i) => s + i.mass, 0);
    if (t.mode === 'walk' || !(focus.fuelCost > 0) || !(m0 > 0)) {
      return head + `<p class="hint">${t.mode === 'walk' ? 'Жаяу барғанда жанармай шығыны жоқ, сондықтан өтелу нүктесі болмайды.' : 'График үшін бағасы белгілі материал, қашықтық және жанармай бағасы қажет.'}</p>`;
    }
    const a = focus.revenue / m0;
    const C0 = focus.fuelCost;
    chartArgs = { a, C: C0, m0 };
    const marks = [0, m0, C0 / a, Math.max(m0, C0 / a) * 1.5].sort((x, y) => x - y);
    return head + `
      <ul class="legend">
        <li><i class="lg lg--rev"></i>Түсім R(m)</li>
        <li><i class="lg lg--fuel"></i>Жанармай шығыны C</li>
        <li><i class="lg lg--loss"></i>Залал аймағы</li>
      </ul>
      <div class="chart-box" id="chartBox"></div>
      <p class="hint">Пункт төлейтін материалдардың қазіргі арақатынасы сақталады деп есептеледі (орташа баға ${F.num(a)} ₸/кг).</p>
      <details class="data-table"><summary>Кесте түрінде</summary>
        <table class="tbl"><thead><tr><th class="num">Масса</th><th class="num">Түсім</th><th class="num">Жанармай</th><th class="num">Нәтиже</th></tr></thead>
        <tbody>${marks.map((m) => `<tr><td class="num">${F.kg(m)}</td><td class="num">${F.money(a * m)}</td><td class="num">${F.money(C0)}</td><td class="num">${F.money(a * m - C0)}</td></tr>`).join('')}</tbody></table>
      </details>`;
  }

  function drawChart() {
    const box = $('#chartBox');
    if (box && chartArgs) window.BreakEvenChart.render(box, chartArgs);
  }
  window.addEventListener('resize', drawChart);

  function jointTab(ev) {
    const { cmp, t } = ev;
    if (!App.comparedPoints().length) return '<div class="panel pad"><p class="hint">Салыстыруға пункт таңдалмаған.</p></div>';
    if (!App.pointById(st().joint.pointId) || !App.pointById(st().joint.pointId).inCompare) st().joint.pointId = null;
    const best = cmp.bestFull || cmp.bestAny;
    const point = App.pointById(st().joint.pointId) || (best && App.pointById(best.pointId)) || App.comparedPoints()[0];
    const options = App.comparedPoints().map((p) => `<option value="${p.id}"${p.id === st().joint.pointId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const rows = st().participants.map((p) => `<label class="field field--row"><span>${esc(p.name)}</span>
      <input type="number" min="0" step="0.1" inputmode="decimal" data-pdist="${p.id}" value="${esc(p.distanceKm ?? '')}"></label>`).join('');
    return `<div class="panel pad"><div class="joint">
      <div class="joint__in">
        <p class="hint">Бірнеше жеке сапар бір ортақ сапармен салыстырылады. Ортақ сапар бір отбасының жолымен бірдей емес — шикізатты жинауға айналып өту жолы бөлек жазылады.</p>
        <label class="field"><span>Салыстыратын пункт</span>
          <select id="jointPoint"><option value="">Ең тиімдісі</option>${options}</select></label>
        <div class="subgroup">
          <p class="hint">Әр қатысушының жеке сапарындағы жүріс (бару-қайту), км</p>
          ${rows}
        </div>
        <label class="field"><span>Ортақ сапар жүрісі (жинауға айналып өтуді қоса), км</span>
          <input type="number" min="0" step="0.1" inputmode="decimal" id="jointDist" value="${esc(st().joint.distanceKm)}"></label>
      </div>
      <div class="joint__out" id="jointOut">${jointOut(point, t)}</div>
    </div></div>`;
  }

  function jointOut(point, t) {
    if (!point) return '<p class="hint">Пункт таңдалмаған.</p>';
    const people = st().participants.map((p) => ({ name: p.name, masses: p.masses, distanceKm: Number(p.distanceKm) || 0 }));
    const r = C.compareJoint(point, people, t, Number(st().joint.distanceKm) || 0);
    if (!r.joint.hasMass) return '<p class="hint">2-қадамда қатысушылардың массасын енгізіңіз.</p>';
    const s = r.separateTotal;
    const winner = r.gain > 1e-6 ? 'joint' : r.gain < -1e-6 ? 'separate' : 'equal';
    const col = (title, v, win) => `<div class="vs__col${win ? ' is-win' : ''}">
        <p class="vs__title">${title}${win ? ' <span class="status status--best">тиімдірек</span>' : ''}</p>
        <p class="figure figure--sm ${App.sign(v.result)}">${F.money(v.result)}</p>
        <dl class="kv"><div><dt>Түсім</dt><dd>${F.money(v.revenue)}</dd></div><div><dt>Жүріс</dt><dd>${F.km(v.distanceKm)}</dd></div><div><dt>Жанармай</dt><dd>${F.money(v.fuelCost)}</dd></div></dl>
      </div>`;
    const verdict = {
      joint: `Ортақ сапар ${F.money(r.gain)} тиімдірек және ${F.km(Math.max(0, s.distanceKm - r.joint.distanceKm))} жүрісті үнемдейді.`,
      separate: `Жеке сапарлар ${F.money(-r.gain)} тиімдірек: шикізат жинауға айналып өту жолы тым ұзақ.`,
      equal: 'Ақшалай нәтиже бойынша нұсқалар тең.'
    }[winner];
    return `<p class="hint">Пункт: <b>${esc(point.name)}</b>. Есеп 3-қадамдағы отын шығыны мен жанармай бағасы бойынша жүргізіледі.</p>
      <div class="vs">${col(`Жеке сапарлар (${s.trips})`, s, winner === 'separate')}${col('Бір ортақ сапар', r.joint, winner === 'joint')}</div>
      <p class="verdict verdict--${winner === 'joint' ? 'good' : winner === 'separate' ? 'bad' : 'neutral'}">${verdict}</p>
      ${r.joint.revenue > s.revenue + 1e-6 ? '<p class="hint">Ортақ сапардың түсімі жоғары, себебі бірігу арқылы ең аз партияны жинауға болады.</p>' : ''}`;
  }

  function stepsTab(ev) {
    const e = ev.focus;
    const t = ev.t;
    if (!e || !e.hasMass) return '<div class="panel pad"><p class="hint">Массаны енгізіңіз.</p></div>';
    const p = App.pointById(e.pointId);
    const ok = e.items.filter((i) => i.status === C.STATUS.OK);
    const rTerms = ok.map((i) => `${F.num(i.mass)} кг × ${F.num(i.price)} ₸/кг`).join(' + ') || '0';
    const dText = t.mode === 'separate' ? `2 × ${F.num(Number(p.oneWayKm) || 0)} км (бару-қайту) = ${F.km(e.distanceKm)}`
      : t.mode === 'walk' ? '0 км (жаяу)' : `${F.km(e.distanceKm)} (жолға қосымша)`;
    const first = ok[0];
    const excluded = [...e.notAccepted, ...e.belowMin, ...e.unpriced];
    return `<div class="panel pad">
      <div class="panel__head"><h3>Есеп қадамдары · ${esc(p.name)}</h3>${focusSelect(e)}</div>
      <ol class="steps">
        <li><span>Түсім</span><code>R = ${rTerms} = <b>${F.money(e.revenue)}</b></code></li>
        <li><span>Қосымша жүріс</span><code>d = ${dText}</code></li>
        <li><span>Отын</span><code>Q = ${F.num(e.distanceKm)} × ${F.num(t.consumption)} / 100 = <b>${F.lit(e.liters)}</b></code></li>
        <li><span>Жанармай шығыны</span><code>C = ${F.num(e.liters)} л × ${F.num(t.fuelPrice)} ₸/л = <b>${F.money(e.fuelCost)}</b></code></li>
        <li><span>Нәтиже</span><code>B = ${F.num(e.revenue)} − ${F.num(e.fuelCost)} = <b class="${App.sign(e.result)}">${F.money(e.result)}</b></code></li>
        ${first && t.mode !== 'walk' ? `<li><span>«${esc(App.matName(first.matId))}» шегі</span><code>m<sub>min</sub> = ${F.num(e.fuelCost)} / ${F.num(first.price)} = <b>${F.kg(e.fuelCost / first.price)}</b></code></li>` : ''}
      </ol>
      ${excluded.length ? `<p class="hint">Түсімге кірмеді: ${App.listNames(excluded)}.</p>` : ''}
    </div>`;
  }

  // =====================================================================
  //  Көрсету және жаңарту
  // =====================================================================
  function render() {
    const step = st().step;
    $$('#stepper button').forEach((b) => {
      const n = Number(b.dataset.step);
      b.setAttribute('aria-current', n === step ? 'step' : 'false');
      b.classList.toggle('is-done', n < step);
    });
    body.innerHTML = [null, step1, step2, step3, step4][step]();
    $('#prevStep').hidden = step === 1;
    $('#nextStep').hidden = step === 4;
    $('#nextStep').textContent = step === 3 ? 'Нәтижені көру →' : 'Келесі →';
    if (step === 2) updateMass();
    if (step === 3) updateCarErrors();
    if (step === 4) drawChart();
  }

  function updateMass() {
    const errs = App.inputErrors().filter((e) => e.kind === 'mass');
    $$('[data-mass]').forEach((el) => el.classList.remove('invalid'));
    for (const e of errs) {
      const el = $(`[data-mass="${e.pid}"][data-mat="${e.mid}"]`);
      if (el) el.classList.add('invalid');
    }
    $('#massError').hidden = !errs.length;
    $('#massError').textContent = errs.map((e) => e.text).join('; ');
    const masses = App.totalMasses();
    $('#massTotal').textContent = F.kg(App.sumKg(masses));
    for (const m of st().materials) {
      const cell = $(`[data-total="${m.id}"]`);
      if (cell) cell.textContent = masses[m.id] ? F.num(masses[m.id]) : '—';
    }
    return errs;
  }

  function updateCarErrors() {
    const errs = App.inputErrors().filter((e) => e.kind !== 'mass');
    $('#carError').hidden = !errs.length;
    $('#carError').textContent = errs.map((e) => e.text).join('; ');
  }

  function refreshTab() {
    const tab = $('#tabBody');
    if (!tab) return render();
    tab.innerHTML = tabBody(App.evaluate());
    drawChart();
  }

  function setStep(n) {
    if (st().step === 2 && n > 2 && updateMass().length) return;
    st().step = Math.min(4, Math.max(1, n));
    App.save();
    render();
    root.scrollIntoView({ block: 'start' });
  }

  function relabel() {
    const unit = App.WHO[st().who].unit;
    st().participants.forEach((p, i) => {
      if (/^\d+-(отбасы|қатысушы)$/.test(p.name)) p.name = `${i + 1}-${unit}`;
    });
  }

  // ---------- оқиғалар ----------
  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const d = el.dataset;
    const byId = (list, id) => list.find((x) => x.id === id);
    if (d.mass) { byId(st().participants, d.mass).masses[d.mat] = el.value; updateMass(); }
    else if (d.pname) byId(st().participants, d.pname).name = el.value;
    else if (d.dist) { App.pointById(d.dist)[d.key] = el.value; updateCarErrors(); }
    else if (el.id === 'consumption' || el.id === 'fuelPrice') { st().transport[el.id] = el.value; updateCarErrors(); }
    else if (d.pdist) { byId(st().participants, d.pdist).distanceKm = el.value; refreshJoint(); }
    else if (el.id === 'jointDist') { st().joint.distanceKm = el.value; refreshJoint(); }
    else return;
    App.save();
  });

  function refreshJoint() {
    const ev = App.evaluate();
    const best = ev.cmp.bestFull || ev.cmp.bestAny;
    const point = App.pointById(st().joint.pointId) || (best && App.pointById(best.pointId)) || App.comparedPoints()[0];
    const out = $('#jointOut');
    if (out) out.innerHTML = jointOut(point, ev.t);
  }

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('[data-focus-select]')) { st().focusId = el.value; refreshTab(); }
    else if (el.id === 'jointPoint') { st().joint.pointId = el.value || null; refreshJoint(); }
    else if (el.dataset.include) {
      App.pointById(el.dataset.include).inCompare = el.checked;
      el.closest('.pick').classList.toggle('is-on', el.checked);
    } else return;
    App.save();
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, tr[data-focus], a[data-mapgo]');
    if (!el) return;
    const d = el.dataset;
    if (d.step) setStep(Number(d.step));
    else if (el.id === 'prevStep') setStep(st().step - 1);
    else if (el.id === 'nextStep') setStep(st().step + 1);
    else if (d.who) { st().who = d.who; relabel(); App.save(); render(); }
    else if (d.mode) { st().transport.mode = d.mode; App.save(); render(); }
    else if (d.delp) { st().participants = st().participants.filter((p) => p.id !== d.delp); App.save(); render(); }
    else if (el.id === 'addParticipant') {
      const n = st().participants.length + 1;
      st().participants.push({ id: App.S.uid(), name: `${n}-${App.WHO[st().who].unit}`, masses: {}, distanceKm: '' });
      App.save(); render();
    }
    else if (d.tab) { st().resultTab = d.tab; App.save(); render(); }
    else if (d.focus) { st().focusId = d.focus; App.save(); refreshTab(); }
    else if (d.route) App.go('map', { mapPointId: d.route });
    else if (d.mapgo) { ev.preventDefault(); App.go('map', { mapPointId: d.mapgo }); }
    else if (el.id === 'toJournal') { if (App.addJournalRecord()) App.toast('Болжам журналға жазылды', '#/notes', 'Журналды ашу'); }
    else if (el.id === 'printBtn') window.print();
  });

  root.addEventListener('keydown', (ev) => {
    const tr = ev.target.closest && ev.target.closest('tr[data-focus]');
    if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); st().focusId = tr.dataset.focus; refreshTab(); }
  });

  root.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'addMatForm') return;
    ev.preventDefault();
    const name = ev.target.mat.value.trim();
    if (!name) return;
    st().materials.push({ id: 'm_' + App.S.uid(), name, hint: '' });
    App.save();
    render();
  });

  App.views.calc = { title: 'Калькулятор', render };
})();
