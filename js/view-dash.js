/* Панель: акцияның басты көрсеткіштері, ұсыныс және болжам графигі */
(function () {
  'use strict';
  const App = window.App;
  const K = window.EcoCampaign;
  const P = window.Plots;
  const { F, $, esc } = App;
  const root = $('[data-view="dash"]');

  const dayDate = (t) => F.date(App.isoAdd(App.campStart(), Math.round(t)));
  const shortDate = (t) => dayDate(t).slice(0, 5);
  const WEEK = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
  const weekday = (t) => WEEK[new Date(Date.parse(App.isoAdd(App.campStart(), Math.round(t)))).getUTCDay()];

  /** Сыныптың жиынтық массасы: нақты өлшемдер, болжам және 95 % аралық. Панельде де, талдауда да қолданылады. */
  App.drawClassChart = (box, an, { tierLine } = {}) => {
    if (!box || !an) return;
    const end = Math.max(an.deadlineDay, an.nowDay + 7);
    const xs = [];
    for (let t = 0; t <= end; t += 1) xs.push(t);
    const fc = xs.map((t) => an.fc(t));
    const hl = tierLine ? [{ v: tierLine.v, label: tierLine.label, cls: 'chart__ref' }] : [];
    P.line(box, {
      series: [
        { x: xs, y: fc.map((f) => f.mean), cls: 'chart__rev' },
        { x: an.actual.map((a) => a.t), y: an.actual.map((a) => a.y), cls: 'chart__dot', dots: true }
      ],
      bands: [{ x: xs, lo: fc.map((f) => f.lo), hi: fc.map((f) => f.hi) }],
      hlines: hl,
      vlines: [{ v: an.deadlineDay, label: 'мерзім' }],
      xMax: end, xLabel: 'Күні', yLabel: 'кг', xFmt: shortDate,
      aria: 'Сыныптың жиынтық массасы мен болжамы',
      tip: (x) => {
        const t = Math.round(x);
        const f = an.fc(t);
        const a = an.actual.find((p) => p.t === t);
        return `<b>${dayDate(t)}</b><span>Болжам</span><span>${F.kg(f.mean)}</span><span>95 %</span><span>${F.num(f.lo, 0)}–${F.num(f.hi, 0)}</span>${a ? `<span>Нақты</span><span>${F.kg(a.y)}</span>` : ''}`;
      }
    });
  };

  function onboarding() {
    return `<div class="intro-card">
        <p class="intro-card__brand">EcoEsep · Көкшетау</p>
        <h1>Мектептің эко-акциясын математикамен жоспарлаңыз</h1>
        <p>Сынып отбасылары апта сайын үйде жиналған шикізатты өлшейді. Сайт осы <b>нақты деректер</b> бойынша қашан жинау керегін, пункт қанша төлейтінін және көліктің <b>ең қысқа маршрутын</b> есептейді.</p>
      </div>
      <ol class="howto">
        <li><b>Отбасыларға код беріңіз</b> (мысалы, 10А-01 … 10А-25). Аты-жөні мен үй мекенжайы жиналмайды.</li>
        <li><b>Апта сайын өлшеңіз.</b> Әр отбасы үйдегі шикізаттың жалпы массасын өлшеп, Google Forms сауалнамасына немесе осы сайтқа жазады.</li>
        <li><b>Нәтижені алыңыз.</b> 2–3 аптадан кейін сайт болжам жасайды, моделін тексереді, жинау күнін және маршрутты ұсынады.</li>
      </ol>
      <div class="answer-actions">
        <a class="btn btn--primary" href="#/data">Өлшемдерді енгізу</a>
        <button class="btn" type="button" id="loadDemo">Мысал деректермен көру</button>
        <a class="btn btn--ghost" href="#/calc">Тек отбасыма есептеу</a>
      </div>`;
  }

  function render() {
    const an = App.campAnalysis();
    if (!an) { root.querySelector('#dashBody').innerHTML = onboarding(); return; }
    const c = App.camp();
    const pr = App.planResult();
    const fcD = an.fc(an.deadlineDay);
    const fams = an.fits.fams.length;
    const v = an.valid;
    const best = pr && pr.best;
    const t = App.transport();

    let rec = '';
    if (!pr) rec = '<div class="verdict-card verdict-card--neutral"><h2>Пункт таңдалмаған</h2><p><a href="#/plan">Жоспар</a> бетінде қабылдау пунктін таңдаңыз.</p></div>';
    else if (!best || best.revenue <= 0) {
      rec = `<div class="verdict-card verdict-card--neutral"><p class="verdict-card__kicker">${esc(pr.point.name)}</p><h2>Бағасы белгісіз немесе масса аз</h2>
        <p class="verdict-card__text">Пункттің бағалары жоқ немесе мерзімге дейін ең аз партияға жетпейсіз. <a href="#/plan">Жоспарды</a> қараңыз.</p></div>`;
    } else {
      const tone = best.profit > 0 ? 'good' : 'bad';
      rec = `<div class="verdict-card verdict-card--${tone}">
        <p class="verdict-card__kicker">Ұсыныс · ${esc(pr.point.name)}</p>
        <h2>Жинау күні: ${dayDate(best.t)}</h2>
        <p class="verdict-card__text">${weekday(best.t)}. Болжам бойынша шамамен <b>${F.kg(best.mass)}</b> жиналады, пункт <b>${F.money(best.revenue)}</b> төлейді${t.fuelPrice ? `, бензинге ${F.money(best.cost)} (${best.trips} сапар)` : ''}. Сыныпта <b>${F.money(best.profit)}</b> қалады.</p>
      </div>`;
      const tip = pr.tierDays.filter((x) => x.need > 0 && x.gain > 0).sort((a, b) => b.gain / b.need - a.gain / a.need)[0];
      if (tip) rec += `<p class="tip-line"><b>Кеңес:</b> мерзімге дейін тағы <b>${F.kg(tip.need)}</b> ${esc(App.matName(tip.matId)).toLowerCase()} жинасаңыз, баға ${tip.price} ₸/кг сатысына көтеріліп, түсім <b>+${F.money(tip.gain)}</b> өседі.</p>`;
    }
    const route = pr && pr.route.ready ? pr.route : null;
    const saveKm = route ? route.soloKm - route.routeKm : null;

    root.querySelector('#dashBody').innerHTML = `${App.demoBanner()}
      <header class="page-head"><h1>${esc(c.name)}</h1><p>Акция басталды: ${F.date(an.start)} · мерзімі: ${F.date(App.campDeadline())} · соңғы өлшем: ${dayDate(an.nowDay)}</p></header>
      <div class="kpis">
        <div class="kpi"><span>Қатысушы отбасы</span><b>${fams}</b><small>${c.entries.length} өлшем</small></div>
        <div class="kpi"><span>Қазір жиналды</span><b>${F.kg(an.currentTotal)}</b><small>барлық отбасы</small></div>
        <div class="kpi"><span>Сынып күніне жинайды</span><b>${F.num(an.classRate, 1)} кг</b><small>${an.rateCI ? `1 отбасы: ${F.num(an.rateCI.mean, 2)} (${F.num(an.rateCI.lo, 2)}–${F.num(an.rateCI.hi, 2)}) кг/күн` : 'өлшем аз'}</small></div>
        <div class="kpi"><span>Мерзімге дейін болжам</span><b>${F.kg(fcD.mean)}</b><small>95 %: ${F.num(fcD.lo, 0)}–${F.num(fcD.hi, 0)} кг</small></div>
      </div>
      ${rec}
      <div class="facts-grid">
        <a class="fact" href="#/analysis"><span>Модель дәлдігі</span>${v ? `<b>${F.pct(v.errModel * 100)} қателік</b><small>соңғы аптаның жиынтығын болжағанда · «өзгермейді» деген аңғал болжамда ${F.pct(v.errNaive * 100)}</small>` : '<b>—</b><small>тексеру үшін әр отбасыда кемінде 3 өлшем керек</small>'}</a>
        <a class="fact" href="#/route"><span>Маршрут</span>${route ? `<b>${F.km(route.routeKm)}</b><small>әр отбасы жеке барса — ${F.km(route.soloKm)}; үнемдеу ${F.km(saveKm)}, ${F.num(K.fuelOf(saveKm, t.consumption), 1)} л бензин, ${F.num(K.fuelOf(saveKm, t.consumption) * K.CO2_PER_LITER, 1)} кг CO₂</small>` : '<b>—</b><small>Маршрут бетінде мектеп, нүктелер және пункт координаттарын енгізіңіз</small>'}</a>
        <a class="fact" href="#/analysis"><span>Шикізат құрамы</span><b>${Object.entries(an.comp.share).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id, s]) => `${esc(App.matName(id))} ${F.num(s * 100, 0)}%`).join(', ') || '—'}</b><small>соңғы өлшемдер бойынша</small></a>
      </div>
      <div class="panel pad">
        <h2 class="h3">Сыныптың жиынтық массасы</h2>
        <ul class="legend"><li><i class="lg lg--dot"></i>Нақты өлшемдер</li><li><i class="lg lg--rev"></i>Модель болжамы</li><li><i class="lg lg--band"></i>95 % болжам аралығы</li>${pr && pr.tierDays[0] ? '<li><i class="lg lg--ref"></i>Жоғары баға сатысы</li>' : ''}</ul>
        <div id="dashChart"></div>
      </div>`;
    const tier = pr && pr.tierDays.filter((x) => x.matId === 'paper').sort((a, b) => b.min - a.min)[0];
    const share = an.comp.share.paper || 0;
    App.drawClassChart($('#dashChart'), an, tier && share > 0 ? { tierLine: { v: tier.min / share, label: `${App.matName('paper')} ${tier.min} кг → ${tier.price} ₸/кг` } } : {});
  }

  root.addEventListener('click', (ev) => {
    if (ev.target.closest('#loadDemo')) { App.makeDemo(); render(); }
  });
  window.addEventListener('resize', () => { if (!root.hidden) render(); });

  App.views.dash = { title: 'Панель', render };
})();
