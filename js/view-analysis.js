/* Талдау: әр отбасының регрессиясы, жылдамдықтар үлестірімі, модельді тексеру */
(function () {
  'use strict';
  const App = window.App;
  const P = window.Plots;
  const { F, $, esc } = App;
  const root = $('[data-view="analysis"]');

  const dayDate = (t) => F.date(App.isoAdd(App.campStart(), Math.round(t)));

  function render() {
    const an = App.campAnalysis();
    const body = root.querySelector('#analysisBody');
    if (!an) {
      body.innerHTML = `<header class="page-head"><h1>Деректерді талдау</h1></header>
        <div class="qa"><p class="qa__a">Талдау үшін өлшемдер керек. <a href="#/data">Деректер</a> бетінде енгізіңіз немесе <a href="#/dash">Панельде</a> мысалды ашыңыз.</p></div>`;
      return;
    }
    const fams = an.fits.fams;
    const fitted = fams.filter((f) => !f.pooled);
    const v = an.valid;
    const ci = an.rateCI;
    const r2s = fitted.filter((f) => f.fit.r2 != null && f.fit.n > 2).map((f) => f.fit.r2);
    const meanR2 = r2s.length ? r2s.reduce((s, x) => s + x, 0) / r2s.length : null;
    const comp = Object.entries(an.comp.share).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);

    body.innerHTML = `${App.demoBanner()}
      <header class="page-head"><h1>Деректерді талдау</h1><p>${fams.length} отбасы, ${App.camp().entries.length} өлшем. Әр отбасы үшін жиналу жылдамдығы ең кіші квадраттар әдісімен бағаланады, ал модельдің дәлдігі соңғы аптаны болжау арқылы тексеріледі.</p></header>

      <div class="qa"><p class="qa__q">1. Бір отбасы күніне қанша шикізат жинайды?</p>
        <p class="qa__a">${ci ? `Орта есеппен <b>${F.num(ci.mean, 2)} кг/күн</b> (95 % сенім аралығы ${F.num(ci.lo, 2)}–${F.num(ci.hi, 2)}, бутстрэп). Бүкіл сынып күніне <b>${F.num(an.classRate, 1)} кг</b> жинайды, яғни айына шамамен ${F.num(an.classRate * 30, 0)} кг.` : 'Бағалау үшін отбасыларда кемінде 2 өлшем керек.'}
        ${meanR2 != null ? ` Түзу сызықты модель деректерге жақсы сәйкес келеді: орташа R² = ${F.num(meanR2, 3)}.` : ''}</p></div>
      <div class="cols">
        <div class="panel pad"><h3 class="h3">Отбасылардың жиналу жылдамдығы (үлестірім)</h3><div id="rateHist"></div>
          <p class="hint">Жылдамдықтар әртүрлі: кейбір отбасы көп, кейбірі аз жинайды. Сондықтан болжам әр отбасының өз жылдамдығымен жасалады.</p></div>
        <div class="panel pad"><h3 class="h3">Шикізат құрамы</h3>
          <ul class="sens">${comp.map(([id, s]) => `<li><span>${esc(App.matName(id))}</span><span class="sens__bar"><i style="width:${(s * 100).toFixed(1)}%"></i></span><span class="num">${F.pct(s * 100)}</span></li>`).join('')}</ul>
          <p class="hint">Соңғы өлшемдер бойынша: барлығы ${F.kg(an.comp.total)}.</p></div>
      </div>

      <div class="qa"><p class="qa__q">2. Модель болашақты қаншалықты дәл болжайды?</p>
        <p class="qa__a">${v ? `Әр отбасының соңғы өлшемін жасырып, алдыңғылары бойынша болжадық (${v.rows.length} отбасы). Сыныптың жиынтық массасы: болжам <b>${F.kg(v.totalPred)}</b>, нақты <b>${F.kg(v.totalActual)}</b> — қателік <b>${F.pct(v.errModel * 100)}</b>. «Масса өзгермейді» деген аңғал болжамның қателігі ${F.pct(v.errNaive * 100)}. Бір отбасы үшін орташа абсолют қате: модель ${F.kg(v.maeModel)}, аңғал болжам ${F.kg(v.maeNaive)}.` : 'Тексеру үшін кемінде бір отбасыда 3 өлшем керек (2 өлшем — модельді құру, 1 — тексеру).'}</p></div>
      ${v ? `<div class="scroll panel"><table class="tbl"><thead><tr><th>Код</th><th class="num">Тексеру күні</th><th class="num">Нақты</th><th class="num">Модель</th><th class="num">Аңғал</th><th class="num">Модель қатесі</th></tr></thead>
        <tbody>${v.rows.map((r) => `<tr><th scope="row">${esc(r.code)}</th><td class="num">${dayDate(r.t)}</td><td class="num">${F.kg(r.actual)}</td><td class="num">${F.kg(r.pred)}</td><td class="num">${F.kg(r.naive)}</td><td class="num">${F.num(r.pred - r.actual, 1)}</td></tr>`).join('')}</tbody></table></div>` : ''}

      <div class="qa"><p class="qa__q">3. Сынып мерзімге дейін қанша жинайды?</p>
        <p class="qa__a">${(() => { const f = an.fc(an.deadlineDay); return `${dayDate(an.deadlineDay)} күні шамамен <b>${F.kg(f.mean)}</b>, 95 % болжам аралығы ${F.num(f.lo, 0)}–${F.num(f.hi, 0)} кг.`; })()}</p></div>
      <div class="panel pad"><ul class="legend"><li><i class="lg lg--dot"></i>Нақты</li><li><i class="lg lg--rev"></i>Болжам</li><li><i class="lg lg--band"></i>95 % аралық</li></ul><div id="anChart"></div></div>

      <h2 class="h2">Әр отбасы</h2>
      <div class="scroll panel"><table class="tbl"><thead><tr><th>Код</th><th class="num">Өлшем</th><th class="num">g, кг/күн</th><th class="num">± 95 %</th><th class="num">R²</th><th class="num">Соңғы, кг</th><th>Нүкте</th></tr></thead>
        <tbody>${fams.map((f) => `<tr><th scope="row">${esc(f.code)}</th><td class="num">${f.pts.length}</td><td class="num">${F.num(f.fit.slope, 3)}${f.pooled ? ' <span class="sub">медиана</span>' : ''}</td><td class="num">${f.fit.ci95 != null ? F.num(f.fit.ci95, 3) : '—'}</td><td class="num">${f.fit.r2 != null && f.fit.n > 2 ? F.num(f.fit.r2, 3) : '—'}</td><td class="num">${F.num(f.pts[f.pts.length - 1].y, 1)}</td><td>${esc(f.spot)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Бір ғана өлшемі бар отбасыға сыныптың медианалық жылдамдығы беріледі (ақпаратты біріктіру).</p>

      <details class="math"><summary>Математикасы</summary>
        <p>Әр отбасы i үшін өлшемдер (tᵢₖ, mᵢₖ) бойынша mᵢ(t) = bᵢ + gᵢ·t түзуі ең кіші квадраттар әдісімен табылады:</p>
        <p class="eq">gᵢ = Σ(t − t̄)(m − m̄) / Σ(t − t̄)²,&nbsp; bᵢ = m̄ − gᵢ·t̄,&nbsp; R² = 1 − SSE/SST</p>
        <p>Сынып болжамы M(T) = Σᵢ(bᵢ + gᵢ·T). Отбасылардың қателері тәуелсіз деп, болжам дисперсиясы қосылады:</p>
        <p class="eq">Var M̂(T) = Σᵢ sᵢ² · (1 + 1/nᵢ + (T − t̄ᵢ)²/Sₜₜ,ᵢ),&nbsp; 95 %: M̂ ± 1,96·√Var</p>
        <p>Орташа жылдамдықтың сенім аралығы бутстрэп әдісімен: отбасылар 2000 рет қайталап іріктеліп, орташа мәндердің 2,5 % және 97,5 % квантильдері алынады.</p>
        <p>Модельді тексеру (hold-out): әр отбасының соңғы өлшемі модельді құруға қатыспайды, кейін болжаммен салыстырылады. Салыстыру базасы — аңғал модель m(t) = m(t<sub>соңғы</sub>).</p>
      </details>`;

    if (fitted.length >= 2) {
      const rates = fitted.map((f) => f.fit.slope);
      const lo = Math.min(...rates), hi = Math.max(...rates);
      const nb = Math.min(10, Math.max(4, Math.round(Math.sqrt(rates.length) * 2)));
      const w = (hi - lo || 1) / nb;
      const bins = Array.from({ length: nb }, (_, k) => ({ x0: lo + k * w, x1: lo + (k + 1) * w, count: 0 }));
      for (const r of rates) bins[Math.min(nb - 1, Math.floor((r - lo) / w))].count++;
      P.histogram($('#rateHist'), { bins, n: rates.length, xLabel: 'кг/күн', fmt: (x) => F.num(x, 2), zeroSplit: false, aria: 'Жиналу жылдамдықтарының үлестірімі' });
    }
    App.drawClassChart($('#anChart'), an);
  }

  window.addEventListener('resize', () => { if (!root.hidden) render(); });
  App.views.analysis = { title: 'Талдау', render };
})();
