/* Жоспар: жинау күнін оңтайландыру (сатылы баға, көлік сыйымдылығы, сапар құны) */
(function () {
  'use strict';
  const App = window.App;
  const P = window.Plots;
  const { F, $, esc } = App;
  const root = $('[data-view="plan"]');
  const st = () => App.state;

  const dayDate = (t) => F.date(App.isoAdd(App.campStart(), Math.round(t)));

  function tiersEditor(point) {
    const tiers = App.tiersFor(point);
    const ids = App.CAMP_MATS.filter((id) => Object.prototype.hasOwnProperty.call(point.prices || {}, id));
    if (!ids.length) return '<p class="hint">Бұл пункт акция материалдарын қабылдамайды.</p>';
    return `<div class="scroll"><table class="tbl tiers"><thead><tr><th>Материал</th><th>Баға сатылары: «кемінде, кг → ₸/кг»</th></tr></thead><tbody>
      ${ids.map((id) => `<tr><th scope="row">${esc(App.matName(id))}</th><td>
        <input class="tier-in" data-tier="${id}" value="${esc((tiers[id] || []).map((t) => `${t.min}→${t.price}`).join('; '))}" placeholder="бағасы белгісіз">
      </td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Мысалы, «50→15; 200→30»: 50 кг-нан 15 ₸/кг, 200 кг-нан 30 ₸/кг. Пунктке қоңырау шалып нақтылаңыз.</p>`;
  }

  function parseTiers(s) {
    return String(s).split(/[;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => {
      const m = x.match(/(\d+(?:[.,]\d+)?)\s*(?:→|->|:|=)\s*(\d+(?:[.,]\d+)?)/);
      return m ? { min: Number(m[1].replace(',', '.')), price: Number(m[2].replace(',', '.')) } : null;
    }).filter(Boolean);
  }

  function render() {
    const c = App.camp();
    const pr = App.planResult();
    const point = App.pointById(c.centerId);
    const options = st().points.filter((p) => App.CAMP_MATS.some((id) => Object.prototype.hasOwnProperty.call(p.prices || {}, id)))
      .map((p) => `<option value="${p.id}"${p.id === c.centerId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const t = App.transport();
    let result = '';
    if (!pr) result = '<div class="qa"><p class="qa__a">Алдымен <a href="#/data">Деректер</a> бетінде өлшемдерді енгізіңіз.</p></div>';
    else {
      const b = pr.best;
      const ok = b && b.revenue > 0;
      result = `<div class="qa"><p class="qa__q">Сұрақ: шикізатты қай күні жинап, пунктке апару тиімді?</p>
        <p class="qa__a">${ok
          ? `<b>${dayDate(b.t)}</b> жинаңыз: шамамен ${F.kg(b.mass)}, пункт ${F.money(b.revenue)} төлейді, ${b.trips} сапар (${F.money(b.cost)}), сыныпта <b class="${App.sign(b.profit)}">${F.money(b.profit)}</b> қалады${c.objective === 'rate' ? ` — күніне ${F.money(b.perDay)}` : ''}.`
          : 'Мерзімге дейін пункт ештеңе төлемейді: бағасы белгісіз немесе масса ең аз партиядан аз.'}
        ${pr.plan.breakEven ? (pr.plan.breakEven.t <= pr.an.nowDay ? ' Жиналған шикізат сапарды қазірдің өзінде ақтайды.' : ` Сапар ${dayDate(pr.plan.breakEven.t)} бастап ақталады.`) : ''}</p></div>
        <div class="cols">
          <div class="panel pad"><ul class="legend"><li><i class="lg lg--rev"></i>Жинау күніне байланысты нәтиже</li><li><i class="lg lg--star"></i>Ұсынылатын күн</li></ul><div id="planChart"></div>
            <p class="hint">Секірістер — баға сатысына жеткен немесе көлікке сыймай, қосымша сапар қажет болған күндер.</p></div>
          <div class="panel pad"><h3 class="h3">Маңызды күндер</h3>
            <table class="tbl"><tbody>
              ${pr.plan.breakEven ? `<tr><th>Сапар ақтала бастайды</th><td class="num">${dayDate(pr.plan.breakEven.t)}</td></tr>` : ''}
              ${pr.tierDays.map((x) => `<tr><th>${esc(App.matName(x.matId))} ${x.min} кг-ға жетеді (${x.price} ₸/кг)</th><td class="num">${x.day == null ? `жетпейді${x.need > 0 ? `<span class="sub">тағы ${F.kg(x.need)} керек → +${F.money(x.gain)}</span>` : ''}` : dayDate(x.day)}</td></tr>`).join('')}
              ${(() => { const d = pr.plan.days.find((x) => x.trips > 1); return d ? `<tr><th>Көлікке сыймайды, 2-сапар керек</th><td class="num">${dayDate(d.t)}</td></tr>` : ''; })()}
              <tr><th>Бір сапар</th><td class="num">${F.km(pr.tripKm)} · ${F.num(pr.liters, 1)} л · ${F.money(pr.tripCost)}</td></tr>
            </tbody></table>
            ${pr.fromRoute ? '<p class="hint">Сапар ұзындығы «Маршрут» бетіндегі оңтайлы маршруттан алынды.</p>' : '<p class="hint">Сапар ұзындығы қолмен енгізілген. Дәлірек болу үшін «Маршрут» бетін толтырыңыз.</p>'}
          </div>
        </div>`;
    }
    root.querySelector('#planBody').innerHTML = `${App.demoBanner()}
      <header class="page-head"><h1>Жинау күні</h1><p>Сыныптың болжамды массасы, пункттің сатылы бағалары және көліктің сыйымдылығы бойынша ең тиімді жинау күнін табамыз.</p></header>
      ${result}
      <div class="panel pad">
        <h2 class="h3">Шарттар</h2>
        <div class="pair">
          <label class="field"><span>Қабылдау пункті</span><select id="planCenter">${options}</select></label>
          <label class="field"><span>Мақсат</span><select id="planObjective">
            <option value="total"${c.objective === 'total' ? ' selected' : ''}>Мерзімге дейін бір рет жинап, ең көп ақша алу</option>
            <option value="rate"${c.objective === 'rate' ? ' selected' : ''}>Тұрақты жинағанда күніне ең көп ақша</option></select></label>
          <label class="field"><span>Көлікке бір сапарда қанша кг сыяды</span><span class="with-unit"><input id="planCap" type="number" min="1" step="10" inputmode="numeric" value="${esc(c.car.capacity)}"><span class="unit">кг</span></span></label>
          <label class="field"><span>Мерзімі</span><input id="planDeadline" type="date" value="${esc(App.campDeadline())}"></label>
          <label class="field"><span>1 л бензин</span><span class="with-unit"><input id="planFuel" type="number" min="0" step="1" inputmode="decimal" value="${esc(st().transport.fuelPrice)}" placeholder="бекеттегі баға"><span class="unit">₸</span></span></label>
          <label class="field"><span>Көлік 100 км-ге</span><span class="with-unit"><input id="planCons" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(st().transport.consumption)}"><span class="unit">л</span></span></label>
          ${pr && pr.fromRoute ? '' : `<label class="field"><span>Бір сапардың жолы (мектеп → пункт → мектеп)</span><span class="with-unit"><input id="planKm" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(c.tripKm)}"><span class="unit">км</span></span></label>`}
        </div>
        ${point ? `<h3 class="h3 mt">Бағалар · ${esc(point.name)} ${App.statusTag(point)}</h3>${tiersEditor(point)}` : ''}
      </div>
      ${pr ? actualBlock(pr) : ''}
      <details class="math"><summary>Математикасы</summary>
        <p>Жинау күні T үшін болжамды масса M(T) = Σ(bᵢ + gᵢT) материалдарға үлестері sⱼ бойынша бөлінеді: mⱼ(T) = sⱼ·M(T).</p>
        <p class="eq">B(T) = Σⱼ mⱼ(T)·pⱼ(mⱼ(T)) − ⌈M(T)/Q⌉ · C<sub>сапар</sub> → max,&nbsp; T ≤ T<sub>мерзім</sub></p>
        <p>pⱼ(m) — сатылы (бөліктік-тұрақты) функция: m ≥ m<sub>k</sub> болғанда p = p<sub>k</sub>. Сапар саны ⌈M/Q⌉ — бүтін санды функция. Сондықтан B(T) үзілісті, туындысы арқылы максимум іздеуге болмайды — мақсат функциясы күн сайын есептеліп, ең үлкен мәні таңдалады (дискретті іріктеу). «Күніне ең көп» мақсатында B(T)/T максималданады.</p>
      </details>`;
    drawChart(pr);
  }

  /** Акциядан кейін: нақты нәтижені болжаммен салыстыру — модельдің соңғы тексерісі. */
  function actualBlock(pr) {
    const c = App.camp();
    const a = Object.assign({ date: '', kg: '', payment: '' }, c.actual || {});
    let cmp = '';
    if (a.date && Number(a.kg) > 0) {
      const day = window.EcoCampaign.dayIndex(a.date, App.campStart());
      const f = pr.an.fc(day);
      const errKg = (f.mean - Number(a.kg)) / Number(a.kg);
      const inside = Number(a.kg) >= f.lo && Number(a.kg) <= f.hi;
      const planDay = pr.plan.days.find((d) => d.t === day);
      cmp = `<p class="qa__a">Болжам ${F.kg(f.mean)} (95 %: ${F.num(f.lo, 0)}–${F.num(f.hi, 0)}), нақты <b>${F.kg(Number(a.kg))}</b> — қателік <b>${F.pct(Math.abs(errKg) * 100)}</b>, нақты мән ${inside ? 'болжам аралығына <b>кірді</b>' : 'болжам аралығынан <b>тыс</b>'}.${
        Number(a.payment) > 0 && planDay ? ` Төлем: болжам ${F.money(planDay.revenue)}, нақты <b>${F.money(Number(a.payment))}</b> (айырма ${F.pct(Math.abs(planDay.revenue - Number(a.payment)) / Number(a.payment) * 100)}).` : ''}</p>`;
    }
    return `<div class="panel pad actual">
      <h2 class="h3">Акциядан кейін: нақты нәтиже</h2>
      <p class="hint">Шикізатты өткізгеннен кейін пункт таразысындағы массаны және алынған ақшаны жазыңыз — сайт болжаммен салыстырады. Бұл — жұмыстағы ең маңызды дәлел.</p>
      <div class="pair">
        <label class="field"><span>Өткізілген күні</span><input type="date" data-actual="date" value="${esc(a.date)}"></label>
        <label class="field"><span>Пункт таразысы, кг</span><input type="number" min="0" step="0.1" inputmode="decimal" data-actual="kg" value="${esc(a.kg)}"></label>
        <label class="field"><span>Алынған ақша, ₸</span><input type="number" min="0" step="1" inputmode="decimal" data-actual="payment" value="${esc(a.payment)}"></label>
      </div>
      ${cmp}
    </div>`;
  }

  function drawChart(pr) {
    const box = $('#planChart');
    if (!box || !pr) return;
    const d = pr.plan.days;
    const key = App.camp().objective === 'rate' ? 'perDay' : 'profit';
    P.line(box, {
      series: [{ x: d.map((x) => x.t), y: d.map((x) => x[key]), cls: 'chart__rev' }],
      marks: pr.best ? [{ x: pr.best.t, y: pr.best[key], label: dayDate(pr.best.t).slice(0, 5), cls: 'chart__star' }] : [],
      xMax: d[d.length - 1].t, xLabel: 'Жинау күні', yLabel: key === 'perDay' ? '₸/күн' : '₸',
      xFmt: (t) => dayDate(t).slice(0, 5),
      aria: 'Жинау күніне байланысты нәтиже',
      tip: (x) => {
        const v = d.reduce((a, b) => (Math.abs(b.t - x) < Math.abs(a.t - x) ? b : a));
        return `<b>${dayDate(v.t)}</b><span>Масса</span><span>${F.kg(v.mass)}</span><span>Түсім</span><span>${F.money(v.revenue)}</span><span>Сапар</span><span>${v.trips}</span><span>Қалады</span><span>${F.money(v.profit)}</span>`;
      }
    });
  }

  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => { const f = document.activeElement && document.activeElement.id; render(); if (f && $('#' + f)) { const el = $('#' + f); el.focus(); } }, 500); };

  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const c = App.camp();
    if (el.id === 'planCap') c.car.capacity = el.value;
    else if (el.id === 'planFuel') st().transport.fuelPrice = el.value;
    else if (el.id === 'planCons') st().transport.consumption = el.value;
    else if (el.id === 'planKm') c.tripKm = el.value;
    else if (el.dataset.actual) { c.actual = Object.assign({}, c.actual, { [el.dataset.actual]: el.value }); App.save(); return; }
    else return;
    App.save(); later();
  });

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    const c = App.camp();
    if (el.id === 'planCenter') c.centerId = el.value;
    else if (el.id === 'planObjective') c.objective = el.value;
    else if (el.id === 'planDeadline') c.deadline = el.value;
    else if (el.dataset.actual) { c.actual = Object.assign({}, c.actual, { [el.dataset.actual]: el.value }); }
    else if (el.dataset.tier) {
      const p = App.pointById(c.centerId);
      const tiers = parseTiers(el.value);
      p.tiers = Object.assign({}, p.tiers, { [el.dataset.tier]: tiers });
      p.prices[el.dataset.tier] = tiers.length ? tiers.slice().sort((a, b) => a.min - b.min)[0].price : null;
    } else return;
    App.save(); render();
  });

  window.addEventListener('resize', () => { if (!root.hidden) drawChart(App.planResult()); });

  App.views.plan = { title: 'Жинау күні', render };
})();
