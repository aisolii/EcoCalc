/* Математикалық модель беті: бес сұрақ — бес әдіс. Есептеулер model.js файлында. */
(function () {
  'use strict';
  const App = window.App;
  const M = window.EcoModel;
  const P = window.Plots;
  const { F, $, $$, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="model"]');

  const MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
  const FACTORS = { price: 'Қабылдау бағасы', mass: 'Таразы қателігі', dist: 'Қашықтық', cons: 'Отын шығыны', fuel: 'Жанармай бағасы' };
  const TABS = [
    ['accum', '1. Жинақталу', 'Дифференциалдық теңдеу'],
    ['interval', '2. Оңтайлы мерзім', 'Оңтайландыру'],
    ['risk', '3. Тәуекел', 'Ықтималдық, Монте-Карло'],
    ['forecast', '4. Болжам', 'Регрессия, ЕКК'],
    ['plan', '5. Өткізу жоспары', 'Дискретті оңтайландыру']
  ];

  function model() {
    st().model = Object.assign({ days: '', capacity: '50', season: '0', peak: '11', gManual: '', tab: 'accum',
      spreads: { price: '', mass: '3', dist: '10', cons: '15', fuel: '2' }, n: '10000' }, st().model || {});
    st().model.spreads = Object.assign({ price: '', mass: '3', dist: '10', cons: '15', fuel: '2' }, st().model.spreads);
    if (!Array.isArray(st().diary)) st().diary = [];
    return st().model;
  }

  const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  const addDays = (n) => F.date(new Date(Date.now() + n * 864e5).toISOString());
  const kgd = (g) => `${F.num(g, 2)} кг/күн`;
  const days = (t) => (Number.isFinite(t) ? `${F.num(t, t < 10 ? 1 : 0)} күн` : 'ешқашан');

  function diaryFit() {
    const rows = st().diary
      .filter((r) => r.date && r.kg !== '' && Number.isFinite(Number(r.kg)))
      .map((r) => ({ t: new Date(r.date).getTime(), y: Number(r.kg) }))
      .sort((a, b) => a.t - b.t);
    if (rows.length < 2) return { rows, fit: null };
    const t0 = rows[0].t;
    const pts = rows.map((r) => ({ x: (r.t - t0) / 864e5, y: r.y }));
    return { rows, pts, t0, fit: M.linreg(pts) };
  }

  /** Модельдің бастапқы деректері — калькулятордан, күнделіктен және осы беттегі өрістерден. */
  App.modelContext = () => {
    const m = model();
    const ev = App.evaluate();
    const best = ev.chosen && ev.chosen.revenue > 0 ? ev.chosen : ev.cmp.bestFull || ev.cmp.bestAny;
    const diary = diaryFit();
    let g = null;
    let gSrc = 'none';
    if (Number(m.gManual) > 0) { g = Number(m.gManual); gSrc = 'manual'; }
    else if (diary.fit && diary.pts.length >= 3 && diary.fit.slope > 0) { g = diary.fit.slope; gSrc = 'diary'; }
    else if (Number(m.days) > 0 && ev.total > 0) { g = ev.total / Number(m.days); gSrc = 'days'; }
    const cap = Number(m.capacity) > 0 ? Number(m.capacity) : Infinity;
    const pbar = best && ev.total > 0 ? best.revenue / ev.total : null;
    const C = best ? best.fuelCost : null;
    // Ең аз партияны жалпы массаға келтіру: mᵢ = sᵢ·m ≥ партияᵢ
    let minMass = 0;
    if (best) {
      for (const it of best.items) {
        if (it.status === App.C.STATUS.OK && it.minBatch > 0) minMass = Math.max(minMass, it.minBatch / (it.mass / ev.total));
      }
    }
    const mMin = pbar > 0 ? Math.max(C / pbar, minMass) : null;
    const A = (Number(m.season) || 0) / 100;
    const peakDoy = Number(m.peak) * 30.4 + 15;
    const t0 = dayOfYear(new Date()) - peakDoy + 365 / 4; // g(t) ең үлкен мәніне таңдалған айда жетеді
    return { ev, best, g, gSrc, cap, pbar, C, minMass, mMin, A, t0, diary, m };
  };

  /** Калькулятор нәтижесіндегі қысқа қорытынды. */
  App.modelQuick = () => {
    const ctx = App.modelContext();
    if (!ctx.best) return null;
    const out = {};
    const t = App.transport();
    if (t.mode !== 'walk' && ctx.C > 0) out.risk = M.monteCarlo({ ...riskInputs(ctx), n: 4000 });
    if (ctx.g && ctx.pbar) {
      const r = M.optimalInterval({ pbar: ctx.pbar, C: ctx.C, g0: ctx.g, M: ctx.cap, A: ctx.A, t0: ctx.t0, minMass: ctx.minMass });
      out.interval = r && r.best;
    }
    return out;
  };

  function riskInputs(ctx) {
    const s = ctx.m.spreads;
    const p = App.pointById(ctx.best.pointId);
    const pct = (v, def) => (v === '' || !Number.isFinite(Number(v)) ? def : Number(v)) / 100;
    return {
      revenue: ctx.best.revenue,
      distanceKm: ctx.best.distanceKm,
      consumption: App.transport().consumption,
      fuelPrice: App.transport().fuelPrice,
      spreads: { price: pct(s.price, p.confirmed ? 5 : 25), mass: pct(s.mass, 3), dist: pct(s.dist, 10), cons: pct(s.cons, 15), fuel: pct(s.fuel, 2) },
      n: Math.min(50000, Math.max(500, Number(ctx.m.n) || 10000)),
      seed: 42
    };
  }

  // =====================================================================
  //  Қаңқа
  // =====================================================================
  function render() {
    const m = model();
    const ctx = App.modelContext();
    const gNote = gSource(ctx);
    root.querySelector('#modelParams').innerHTML = `
      <div class="params">
        <div class="param-g">
          <p class="hint">Күніне қанша кг жиналады (g)</p>
          <p class="param-g__v">${ctx.g ? kgd(ctx.g) : '—'}</p>
          <p class="hint param-g__src">${gNote}</p>
        </div>
        <label class="field"><span>Өзіңіз жазу, кг/күн</span><input type="number" min="0" step="0.01" inputmode="decimal" data-m="gManual" value="${esc(m.gManual)}" placeholder="бос — автоматты"></label>
        <label class="field"><span>Есептеудегі шикізат неше күнде жиналды</span><input type="number" min="0" step="1" inputmode="decimal" data-m="days" value="${esc(m.days)}" placeholder="мысалы, 30"></label>
        <label class="field"><span>Үйде ең көбі қанша кг сыяды (M)</span><input type="number" min="0" step="1" inputmode="decimal" data-m="capacity" value="${esc(m.capacity)}" placeholder="бос — шексіз" title="Үйде (балкон, қойма) сақтауға болатын ең көп масса"></label>
        <label class="field"><span>Маусымға қарай өзгеру, ±%</span><input type="number" min="0" max="90" step="5" inputmode="decimal" data-m="season" value="${esc(m.season)}"></label>
        <label class="field"><span>Ең көп жиналатын ай</span><select data-m="peak">${MONTHS.map((n, i) => `<option value="${i}"${String(i) === String(m.peak) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      ${ctx.best ? `<p class="hint">Пункт: <b>${esc(App.pointById(ctx.best.pointId).name)}</b> · 1 кг жиналған шикізаттың орташа бағасы p̄ = ${F.num(ctx.pbar)} ₸/кг · бір сапар шығыны C = ${F.money(ctx.C)}. Деректер калькулятордан алынады.</p>`
        : '<p class="notice">Калькуляторда массасы, бағасы және қашықтығы белгілі пункт жоқ — модельдің 2–3-бөлімдері үшін алдымен <a href="#/calc">калькуляторды</a> толтырыңыз.</p>'}`;
    root.querySelector('#modelTabs').innerHTML = TABS.map(([id, label, sub]) =>
      `<button type="button" role="tab" data-mtab="${id}" aria-selected="${m.tab === id}"><b>${label}</b><span>${sub}</span></button>`).join('');
    renderBody(ctx);
  }

  function renderBody(ctx = App.modelContext()) {
    const body = root.querySelector('#modelBody');
    const tab = ctx.m.tab;
    const fn = { accum: accumTab, interval: intervalTab, risk: riskTab, forecast: forecastTab, plan: planTab }[tab] || accumTab;
    body.innerHTML = fn(ctx);
    draw[tab] && draw[tab](ctx);
  }

  const question = (q, a) => `<div class="qa"><p class="qa__q">Сұрақ: ${q}</p>${a ? `<p class="qa__a">${a}</p>` : ''}</div>`;
  const mathBlock = (html) => `<details class="math"><summary>Математикасы</summary>${html}</details>`;
  const need = (text) => `<div class="panel pad"><p class="hint">${text}</p></div>`;

  // =====================================================================
  //  1. Жинақталу (ДТ)
  // =====================================================================
  function accumTab(ctx) {
    if (!ctx.g) return question('Шикізат уақыт өте қалай жиналады және сақтау орны толса не болады?') +
      need('Жиналу жылдамдығы g белгісіз. Жоғарыда «Неше күнде жиналды» өрісін толтырыңыз, g-ні қолмен жазыңыз немесе «4. Болжам» бөлімінде жинау күнделігін жүргізіңіз.');
    const finite = Number.isFinite(ctx.cap);
    const t50 = finite ? M.timeToReach(0.5 * ctx.cap, ctx.g, ctx.cap) : Infinity;
    const t90 = finite ? M.timeToReach(0.9 * ctx.cap, ctx.g, ctx.cap) : Infinity;
    const tMin = ctx.mMin ? M.timeToReach(ctx.mMin, ctx.g, ctx.cap) : null;
    let answer = `Жиналу жылдамдығы — <b>${kgd(ctx.g)}</b>.`;
    if (finite) answer += ` Сақтау орны (${F.kg(ctx.cap)}) жартылай <b>${days(t50)}</b>, 90 %-ға <b>${days(t90)}</b> толады; одан кейін шикізаттың көбі жалпы қоқысқа кетеді.`;
    if (ctx.mMin) {
      answer += Number.isFinite(tMin)
        ? ` Сапар ақталатын массаға (${F.kg(ctx.mMin)}) <b>${days(tMin)}</b> ішінде жетесіз — шамамен ${addDays(tMin)}.`
        : ` <span class="neg">Сапар ақталатын масса (${F.kg(ctx.mMin)}) сақтау орнынан үлкен — жеке сапар ешқашан ақталмайды.</span> Бірлесіп өткізіңіз, жол-жөнекей соғыңыз немесе сақтау орнын үлкейтіңіз.`;
    }
    const sim = M.simulate({ g0: ctx.g, M: ctx.cap, A: ctx.A, t0: ctx.t0, days: 365, h: 0.25 });
    let maxErr = 0;
    if (!ctx.A) for (let i = 0; i < sim.t.length; i += 4) maxErr = Math.max(maxErr, Math.abs(sim.m[i] - M.analytic(ctx.g, ctx.cap, 0, sim.t[i])));
    return question('Шикізат уақыт өте қалай жиналады және сақтау орны толса не болады?', answer) + `
      <div class="panel pad">
        <ul class="legend"><li><i class="lg lg--rev"></i>Үйде жиналған масса m(t)</li><li><i class="lg lg--fuel"></i>Қоқысқа кеткен масса</li>${ctx.mMin ? '<li><i class="lg lg--ref"></i>Сапар ақталатын масса</li>' : ''}</ul>
        <div id="accumChart"></div>
        <p class="hint">Графикті тінтуірмен (немесе саусақпен) жүргізіп, кез келген күндегі мәнді көріңіз.</p>
      </div>
      ${mathBlock(`<p>Модель: үйдегі шикізат массасы m(t) мына дифференциалдық теңдеуге бағынады</p>
        <p class="eq">dm/dt = g(t) · (1 − m/M),&nbsp;&nbsp; m(0) = 0</p>
        <p>Мағынасы: шикізат g жылдамдықпен пайда болады, бірақ сақтау орны толған сайын (m → M) оның көп бөлігі жалпы қоқысқа кетеді. Қоқысқа кету ағыны — g·m/M.</p>
        <p>g = const болғанда айнымалыларды бөліп интегралдаймыз: ∫ dm/(M − m) = ∫ (g/M) dt ⇒</p>
        <p class="eq">m(t) = M · (1 − e<sup>−g·t/M</sup>),&nbsp;&nbsp; t(m) = −(M/g) · ln(1 − m/M)</p>
        <p>Маусымдық жағдайда g(t) = g₀ · (1 + A·cos(2π(t − t<sub>max</sub>)/365)) — аналитикалық шешім күрделі, сондықтан теңдеу <b>Рунге–Кутта 4-ретті</b> әдісімен h = 0,25 күн қадаммен сандық шешіледі.</p>
        ${ctx.A ? '' : `<p>Тексеру: сандық және аналитикалық шешімдердің ең үлкен айырмасы — ${maxErr.toExponential(1)} кг.</p>`}
        <p>Параметрлер: g = ${F.num(ctx.g, 3)} кг/күн, M = ${finite ? F.kg(ctx.cap) : '∞'}, A = ${F.num(ctx.A * 100, 0)} %.</p>`)}`;
  }

  // =====================================================================
  //  2. Оңтайлы мерзім
  // =====================================================================
  let intervalCache = null;
  function intervalTab(ctx) {
    const q = 'Қанша күнде бір рет өткізу ең тиімді?';
    if (!ctx.best) return question(q) + need('Калькуляторда бағасы мен қашықтығы белгілі пункт керек.');
    if (!ctx.g) return question(q) + need('Жиналу жылдамдығы g белгісіз — жоғарыдағы өрістерді толтырыңыз.');
    const r = M.optimalInterval({ pbar: ctx.pbar, C: ctx.C, g0: ctx.g, M: ctx.cap, A: ctx.A, t0: ctx.t0, minMass: ctx.minMass });
    intervalCache = r;
    if (!r || !r.best) return question(q) + need('Берілген шектеулерде (сақтау орны, ең аз партия) жарамды мерзім табылмады.');
    const b = r.best;
    const walk = !(ctx.C > 0);
    let answer = walk
      ? `Сапар тегін болғандықтан, жиі өткізген тиімді (уақыт есепке алынбайды). Ұсыныс: <b>${days(b.T)}</b> сайын.`
      : `Әр <b>${days(b.T)}</b> сайын өткізіңіз (келесі рет — ${addDays(b.T)}). Бір сапарда шамамен <b>${F.kg(b.m)}</b>, нәтиже <b class="${App.sign(b.tripResult)}">${F.money(b.tripResult)}</b>, орташа <b>${F.money(b.J)}/күн</b>.`;
    answer += b.efficiency > 0.995
      ? ' Сақтау орны толмайды — пайда болған шикізаттың бәрі өткізіледі.'
      : ` Пайда болған шикізаттың <b>${F.pct(b.efficiency * 100)}</b>-ы өткізіледі, қалғаны сақтау орны толғандықтан қоқысқа кетеді.`;
    if (b.J < 0) answer += ' <span class="neg">Ең жақсы мерзімде де нәтиже теріс — бұл пунктке жеке сапар тиімсіз.</span>';
    const rows = [7, 14, 30, 60].filter((T) => T <= 365).map((T) => {
      const c = r.curve.find((x) => x.T === T);
      return c ? `<tr><td class="num">${T}</td><td class="num">${F.kg(c.m)}</td><td class="num">${F.money(ctx.pbar * c.m - ctx.C)}</td><td class="num">${F.money(c.J)}</td></tr>` : '';
    }).join('');
    return question(q, answer) + `
      <div class="cols">
        <div class="panel pad">
          <ul class="legend"><li><i class="lg lg--rev"></i>J(T) — күніне орташа нәтиже</li><li><i class="lg lg--star"></i>Оңтайлы нүкте</li></ul>
          <div id="intervalChart"></div>
        </div>
        <div class="panel pad">
          <h3 class="h3">Басқа мерзімдермен салыстыру</h3>
          <table class="tbl"><thead><tr><th class="num">T, күн</th><th class="num">Масса</th><th class="num">Сапар нәтижесі</th><th class="num">₸/күн</th></tr></thead>
          <tbody>${rows}<tr class="is-best"><td class="num"><b>${F.num(b.T, 1)}</b></td><td class="num">${F.kg(b.m)}</td><td class="num">${F.money(b.tripResult)}</td><td class="num"><b>${F.money(b.J)}</b></td></tr></tbody></table>
        </div>
      </div>
      ${mathBlock(`<p>Шикізатты әр T күн сайын өткізсек, бір циклдің нәтижесі p̄·m(T) − C, ал бір күнге шаққанда</p>
        <p class="eq">J(T) = (p̄ · m(T) − C) / T → max,&nbsp;&nbsp; m(T) ≥ m<sub>партия</sub></p>
        <p>Жиі өткізсек — жанармай көп кетеді (C/T үлкен); сирек өткізсек — сақтау орны толып, шикізат жоғалады. Оңтайлы T* — осы екі әсердің тепе-теңдігі.</p>
        <p>g = const үшін J'(T) = 0 қажетті шарты:</p>
        <p class="eq">p̄·g·T·e<sup>−aT</sup> = p̄·M·(1 − e<sup>−aT</sup>) − C,&nbsp;&nbsp; a = g/M</p>
        <p>Бұл трансцендентті теңдеу, сондықтан максимум T ∈ [1; 365] күн торында (қадамы 0,25 күн) сандық ізделеді; m(T) Рунге–Кутта әдісімен есептеледі. Шексіз сақтау орнында J(T) = p̄g − C/T монотонды өседі — шектеуді тек сақтау орны мен партия қояды.</p>
        <p>Параметрлер: p̄ = ${F.num(ctx.pbar)} ₸/кг, C = ${F.money(ctx.C)}, g = ${F.num(ctx.g, 3)} кг/күн, M = ${Number.isFinite(ctx.cap) ? F.kg(ctx.cap) : '∞'}, m<sub>партия</sub> = ${F.kg(ctx.minMass)}.</p>`)}`;
  }

  // =====================================================================
  //  3. Тәуекел (Монте-Карло)
  // =====================================================================
  let riskCache = null;
  function riskTab(ctx) {
    const q = 'Бағалар мен шығындар дәл белгісіз болса, сапардың ақталу ықтималдығы қандай?';
    if (!ctx.best) return question(q) + need('Калькуляторда бағасы мен қашықтығы белгілі пункт керек.');
    if (App.transport().mode === 'walk' || !(ctx.C > 0)) return question(q) + need('Жаяу барғанда немесе жанармай бағасы енгізілмегенде сапар шығыны жоқ — тәуекел тек бағаға байланысты, нәтиже теріс бола алмайды.');
    const inp = riskInputs(ctx);
    const r = M.monteCarlo(inp);
    riskCache = r;
    const top = r.sens[0];
    const answer = `Сапардың ақталу ықтималдығы <b class="big-inline ${r.pPositive >= 0.5 ? 'pos' : 'neg'}">${F.pct(r.pPositive * 100)}</b> ${r.pPositive > 0 && r.pPositive < 1 ? ` (± ${F.pct(r.pError * 196)})` : ` (${F.num(r.n, 0)} сынақтың ${r.pPositive ? 'бәрінде' : 'бірде-бірінде'} ақталды)`}. 90 % жағдайда нәтиже <b>${F.money(r.p5)} … ${F.money(r.p95)}</b> аралығында, орташа ${F.money(r.mean)}. Нәтижеге ең көп әсер ететін фактор — <b>${FACTORS[top.key].toLowerCase()}</b> (${F.pct(top.share * 100)}).`;
    const s = ctx.m.spreads;
    const def = { price: App.pointById(ctx.best.pointId).confirmed ? 5 : 25, mass: 3, dist: 10, cons: 15, fuel: 2 };
    const field = (key, label) => `<label class="field"><span>${label}, ±%</span><input type="number" min="0" max="90" step="1" inputmode="decimal" data-spread="${key}" value="${esc(s[key])}" placeholder="${def[key]}"></label>`;
    return question(q, answer) + `
      <div class="cols">
        <div class="panel pad">
          <h3 class="h3">Сапар нәтижесінің үлестірімі (${F.num(r.n, 0)} кездейсоқ сынақ)</h3>
          <div id="riskChart"></div>
        </div>
        <div class="panel pad">
          <h3 class="h3">Нәтижеге әсер ету үлесі</h3>
          <ul class="sens">${r.sens.map((x) => `<li><span>${FACTORS[x.key]}</span><span class="sens__bar"><i style="width:${(x.share * 100).toFixed(1)}%"></i></span><span class="num">${F.pct(x.share * 100)}</span></li>`).join('')}</ul>
          <p class="hint">Үлес = r² / Σr², мұнда r — фактор мен нәтиже арасындағы Пирсон корреляциясы.</p>
          <details class="data-table" open><summary>Белгісіздік параметрлері</summary>
            <div class="pair">${field('price', 'Қабылдау бағасы')}${field('mass', 'Таразы қателігі')}${field('dist', 'Қашықтық')}${field('cons', 'Отын шығыны')}${field('fuel', 'Жанармай бағасы')}
            <label class="field"><span>Сынақ саны</span><input type="number" min="500" max="50000" step="500" data-m="n" value="${esc(ctx.m.n)}"></label></div>
            <p class="hint">Расталмаған бағаға әдепкі ±25 %, расталғанға ±5 %.</p>
          </details>
        </div>
      </div>
      ${mathBlock(`<p>Бір сапардың нәтижесі B = R·k<sub>p</sub>·k<sub>m</sub> − d·c·p<sub>ж</sub>/100 кездейсоқ шама, мұнда:</p>
        <ul class="limits">
          <li>k<sub>p</sub> ~ үшбұрышты үлестірім [1 − s; 1; 1 + s] — пункттің бағасы (s = ${F.pct(inp.spreads.price * 100)});</li>
          <li>k<sub>m</sub> ~ N(1; ${F.num(inp.spreads.mass, 2)}) — таразы қателігі;</li>
          <li>d ~ N(${F.num(inp.distanceKm, 1)}; ${F.num(inp.spreads.dist * inp.distanceKm, 2)}) км — маршрут таңдауы;</li>
          <li>c ~ үшбұрышты [c(1 − s/2); c; c(1 + s)] — қалада отын шығыны жиі артады;</li>
          <li>p<sub>ж</sub> ~ N(p; ${F.num(inp.spreads.fuel, 2)}·p) — жанармай бағасы.</li>
        </ul>
        <p>Әр сынақта шамалар кездейсоқ таңдалады (қалыпты — Бокс–Мюллер түрлендіруімен, үшбұрышты — кері функция әдісімен), N = ${F.num(r.n, 0)}.</p>
        <p class="eq">P(B &gt; 0) ≈ (оң нәтижелер саны) / N,&nbsp;&nbsp; σ<sub>P</sub> = √(P(1 − P)/N) = ${F.num(r.pError * 100, 2)} %</p>
        <p>Генератор seed = 42 арқылы бекітілген — эксперимент қайталанады. Медиана ${F.money(r.p50)}, стандартты ауытқу ${F.money(r.sd)}.</p>`)}`;
  }

  // =====================================================================
  //  4. Болжам (регрессия)
  // =====================================================================
  function forecastTab(ctx) {
    const q = 'Шикізат қаншалықты жылдам жиналады және сапар ақталатын массаға қашан жетеміз?';
    const d = ctx.diary;
    const rows = st().diary.map((r) => `<tr>
      <td><input type="date" data-diary="${r.id}" data-dkey="date" value="${esc(r.date)}" aria-label="Күні"></td>
      <td class="num"><input type="number" min="0" step="0.1" inputmode="decimal" data-diary="${r.id}" data-dkey="kg" value="${esc(r.kg)}" aria-label="Жалпы масса, кг"></td>
      <td><button type="button" class="del" data-deldiary="${r.id}" aria-label="Өшіру">×</button></td></tr>`).join('');
    let answer = '';
    const fit = d.fit;
    if (fit && d.pts.length >= 3) {
      answer = `Жиналу жылдамдығы g = <b>${F.num(fit.slope, 2)}${fit.ci95 != null ? ` ± ${F.num(fit.ci95, 2)}` : ''} кг/күн</b>${fit.ci95 != null ? ' (95 % сенім аралығы)' : ''}, анықталу коэффициенті R² = <b>${F.num(fit.r2, 3)}</b>.`;
      if (ctx.mMin) {
        const x = (ctx.mMin - fit.intercept) / fit.slope;
        const date = new Date(d.t0 + x * 864e5);
        answer += x > d.pts[d.pts.length - 1].x
          ? ` Сапар ақталатын массаға (${F.kg(ctx.mMin)}) шамамен <b>${F.date(date.toISOString())}</b> жетесіз.`
          : ` Сапар ақталатын масса (${F.kg(ctx.mMin)}) жиналып қойды — өткізуге болады.`;
      }
      if (fit.r2 < 0.8) answer += ' <span class="unk">R² төмен: жинау біркелкі емес, болжамның сенімділігі аз.</span>';
    }
    return question(q, answer || 'Кемінде 3 өлшем енгізіңіз — сонда жиналу жылдамдығы ең кіші квадраттар әдісімен бағаланады.') + `
      <div class="cols">
        <div class="panel pad">
          <h3 class="h3">Жинау күнделігі</h3>
          <p class="hint">Әр 3–7 күн сайын жиналған шикізаттың <b>жалпы</b> массасын өлшеп жазыңыз (өткізгеннен кейін күнделікті жаңадан бастаңыз).</p>
          <table class="tbl diary"><thead><tr><th>Күні</th><th class="num">Жалпы масса, кг</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">Әзірге өлшем жоқ</td></tr>'}</tbody></table>
          <div class="actions"><button class="btn btn--primary" type="button" id="addDiary">+ Өлшем қосу</button></div>
        </div>
        <div class="panel pad">
          <ul class="legend"><li><i class="lg lg--dot"></i>Өлшемдер</li><li><i class="lg lg--rev"></i>Регрессия түзуі</li>${ctx.mMin ? '<li><i class="lg lg--ref"></i>Сапар ақталатын масса</li>' : ''}</ul>
          <div id="forecastChart">${fit ? '' : '<p class="hint">График өлшемдер енгізілгеннен кейін шығады.</p>'}</div>
        </div>
      </div>
      ${mathBlock(`<p>Өлшемдер (tᵢ, mᵢ) бойынша m(t) = g·t + b түзуінің параметрлері ең кіші квадраттар әдісімен табылады:</p>
        <p class="eq">g = Σ(tᵢ − t̄)(mᵢ − m̄) / Σ(tᵢ − t̄)²,&nbsp;&nbsp; b = m̄ − g·t̄</p>
        <p class="eq">R² = 1 − Σ(mᵢ − m̂ᵢ)² / Σ(mᵢ − m̄)²,&nbsp;&nbsp; σ<sub>g</sub> = √( Σ(mᵢ − m̂ᵢ)² / (n − 2) / Σ(tᵢ − t̄)² )</p>
        <p>95 % сенім аралығы: g ± t<sub>0,975; n−2</sub>·σ<sub>g</sub> (Стьюдент үлестірімі). Табылған g модельдің 1–2-бөлімдерінде қолданылады (қолмен енгізілмесе).</p>
        <p>Түзу сызықты модель сақтау орны толмаған бастапқы кезеңге сәйкес келеді; сақтау орны толуға жақындағанда 1-бөлімдегі дифференциалдық модель дәлірек.</p>
        ${fit ? `<p>Нәтиже: n = ${fit.n}, g = ${F.num(fit.slope, 4)}, b = ${F.num(fit.intercept, 3)}, R² = ${F.num(fit.r2, 4)}${fit.se != null ? `, σ<sub>g</sub> = ${F.num(fit.se, 4)}` : ''}.</p>` : ''}`)}`;
  }

  // =====================================================================
  //  5. Өткізу жоспары
  // =====================================================================
  function planTab(ctx) {
    const q = 'Материалдарды бірнеше пунктке бөліп өткізу тиімді ме?';
    const ev = ctx.ev;
    if (!ev.total) return question(q) + need('Калькулятордың 2-қадамында массаны енгізіңіз.');
    const options = ev.cmp.evals.filter((e) => e.distanceKnown).map((e) => {
      const p = App.pointById(e.pointId);
      return { pointId: p.id, cost: e.fuelCost, prices: p.prices, minBatch: p.minBatch };
    });
    if (!options.length) return question(q) + need('Қашықтығы белгілі пункт жоқ — калькулятордың 3-қадамында немесе картада қашықтықты енгізіңіз.');
    const plan = M.bestPlan(options, ev.masses);
    if (!plan) return question(q) + need('Сіздің материалдарыңызды бағасы белгілі бағамен қабылдайтын пункт жоқ.');
    const single = ctx.best;
    const gain = single ? plan.result - single.result : null;
    const names = plan.pointIds.map((id) => esc(App.pointById(id).name));
    let answer = plan.pointIds.length > 1
      ? `Ең тиімдісі — <b>${plan.pointIds.length} пунктке</b> бөліп өткізу: ${names.join(' және ')}. Нәтиже <b class="${App.sign(plan.result)}">${F.money(plan.result)}</b>`
      : `Ең тиімдісі — барлығын бір пунктке өткізу: <b>${names[0]}</b>. Нәтиже <b class="${App.sign(plan.result)}">${F.money(plan.result)}</b>`;
    if (gain != null && plan.pointIds.length > 1) answer += `, бір пункттен ${F.money(gain)} артық.`;
    else answer += '.';
    if (plan.unassigned.length) answer += ` Ешбір пункт бағасымен қабылдамайтын материалдар: ${plan.unassigned.map((m) => esc(App.matName(m))).join(', ')}.`;
    const rows = plan.assignment.map((a) => `<tr><th scope="row">${esc(App.matName(a.matId))}</th><td>${esc(App.pointById(a.pointId).name)}</td><td class="num">${F.kg(a.mass)}</td><td class="num">${F.num(a.price)} ₸/кг</td><td class="num">${F.money(a.revenue)}</td></tr>`).join('');
    const costRows = plan.pointIds.map((id) => `<tr><td>${esc(App.pointById(id).name)}</td><td class="num">${F.money(options.find((o) => o.pointId === id).cost)}</td></tr>`).join('');
    return question(q, answer) + `
      <div class="cols">
        <div class="panel pad">
          <h3 class="h3">Қай материалды қайда апару керек</h3>
          <div class="scroll"><table class="tbl"><thead><tr><th>Материал</th><th>Пункт</th><th class="num">Масса</th><th class="num">Баға</th><th class="num">Түсім</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
        <div class="panel pad">
          <h3 class="h3">Сапар шығыны</h3>
          <table class="tbl"><tbody>${costRows}<tr><th>Барлығы</th><td class="num"><b>${F.money(plan.cost)}</b></td></tr></tbody></table>
          <p class="hint">Тексерілген комбинациялар: 2<sup>${options.length}</sup> − 1 = ${(1 << Math.min(options.length, 12)) - 1}. Әр пунктке бөлек сапар деп есептеледі (шығынның жоғарғы бағасы).</p>
        </div>
      </div>
      ${mathBlock(`<p>Пункттер жиыны J, материалдар жиыны I. Таңдалатын пункттер S ⊆ J үшін әр материал S ішіндегі ең жоғары баға беретін пунктке беріледі:</p>
        <p class="eq">B(S) = Σ<sub>i∈I</sub> m<sub>i</sub> · max<sub>j∈S</sub> p<sub>ij</sub> − Σ<sub>j∈S</sub> C<sub>j</sub> → max</p>
        <p>Бұл — сыйымдылығы шектелмеген орналастыру есебі (uncapacitated facility location), NP-қиын есептер класына жатады. Пункттер аз (n ≤ 12) болғандықтан, 2ⁿ − 1 ішкі жиынның бәрі толық іріктеледі — табылған шешім кепілді түрде оңтайлы. Ең аз партиядан кем материал ол пунктке берілмейді.</p>`)}`;
  }

  // =====================================================================
  //  Графиктерді салу
  // =====================================================================
  const draw = {
    accum(ctx) {
      const box = $('#accumChart');
      if (!box || !ctx.g) return;
      const tMin = ctx.mMin ? M.timeToReach(ctx.mMin, ctx.g, ctx.cap) : 0;
      const horizon = Math.min(365, Math.max(90, Number.isFinite(tMin) ? tMin * 1.8 : 0, Number.isFinite(ctx.cap) ? M.timeToReach(0.95 * ctx.cap, ctx.g, ctx.cap) : 90));
      const sim = M.simulate({ g0: ctx.g, M: ctx.cap, A: ctx.A, t0: ctx.t0, days: horizon, h: 0.25 });
      const step = 4;
      const pick = (arr) => arr.filter((_, i) => i % step === 0);
      const hl = [];
      if (Number.isFinite(ctx.cap)) hl.push({ v: ctx.cap, label: `сақтау орны M = ${F.kg(ctx.cap)}`, cls: 'chart__cap' });
      if (ctx.mMin && ctx.mMin < (Number.isFinite(ctx.cap) ? ctx.cap * 1.6 : Infinity)) hl.push({ v: ctx.mMin, label: `ақталу: ${F.kg(ctx.mMin)}`, cls: 'chart__ref' });
      const marks = ctx.mMin && Number.isFinite(tMin) && tMin <= horizon ? [{ x: tMin, y: ctx.mMin, label: `${F.num(tMin, 0)}-күн` }] : [];
      P.line(box, {
        series: [
          { x: pick(sim.t), y: pick(sim.m), cls: 'chart__rev' },
          { x: pick(sim.t), y: pick(sim.lost), cls: 'chart__fuel' }
        ],
        hlines: hl, marks, xMax: horizon, xLabel: 'Уақыт, күн', yLabel: 'кг',
        aria: 'Жинақталу графигі',
        tip: (x) => {
          const i = Math.min(sim.t.length - 1, Math.round(x / sim.h));
          return `<b>${F.num(sim.t[i], 0)}-күн</b><span>Үйде</span><span>${F.kg(sim.m[i])}</span><span>Қоқысқа</span><span>${F.kg(sim.lost[i])}</span>`;
        }
      });
    },
    interval(ctx) {
      const box = $('#intervalChart');
      const r = intervalCache;
      if (!box || !r || !r.best) return;
      const pts = r.curve.filter((c) => c.T <= 365);
      const Js = pts.map((c) => c.J);
      const lo = Math.max(Math.min(...Js), r.best.J - Math.abs(r.best.J) * 4 - 20);
      const clipped = pts.filter((c) => c.J >= lo);
      P.line(box, {
        series: [{ x: clipped.map((c) => c.T), y: clipped.map((c) => c.J), cls: 'chart__rev' }],
        marks: [{ x: r.best.T, y: r.best.J, label: `T* = ${F.num(r.best.T, 1)} күн`, cls: 'chart__star' }],
        vlines: [{ v: r.best.T }],
        xMax: 365, xLabel: 'Өткізу аралығы T, күн', yLabel: '₸/күн', yMin: lo,
        aria: 'Оңтайлы өткізу аралығы графигі',
        tip: (x) => {
          const c = pts[Math.min(pts.length - 1, Math.max(0, Math.round(x) - 1))];
          return `<b>T = ${c.T} күн</b><span>₸/күн</span><span>${F.money(c.J)}</span><span>Масса</span><span>${F.kg(c.m)}</span>`;
        }
      });
    },
    risk() {
      const box = $('#riskChart');
      const r = riskCache;
      if (!box || !r) return;
      P.histogram(box, {
        bins: r.hist, n: r.n, xLabel: 'Сапар нәтижесі, ₸',
        marks: [{ v: r.p5, label: '5 %' }, { v: r.p95, label: '95 %' }],
        aria: `Монте-Карло: ақталу ықтималдығы ${F.pct(r.pPositive * 100)}`
      });
    },
    forecast(ctx) {
      const box = $('#forecastChart');
      const d = ctx.diary;
      if (!box || !d.fit) return;
      const fit = d.fit;
      const lastX = d.pts[d.pts.length - 1].x;
      let xEnd = lastX * 1.3 + 1;
      if (ctx.mMin && fit.slope > 0) {
        const x = (ctx.mMin - fit.intercept) / fit.slope;
        if (x > lastX && x < lastX * 4 + 60) xEnd = Math.max(xEnd, x * 1.1);
      }
      const hl = ctx.mMin ? [{ v: ctx.mMin, label: `ақталу: ${F.kg(ctx.mMin)}`, cls: 'chart__ref' }] : [];
      P.line(box, {
        series: [
          { x: [0, xEnd], y: [fit.intercept, fit.intercept + fit.slope * xEnd], cls: 'chart__rev' },
          { x: d.pts.map((p) => p.x), y: d.pts.map((p) => p.y), cls: 'chart__dot', dots: true }
        ],
        hlines: hl, xMax: xEnd, xLabel: 'Алғашқы өлшемнен бері, күн', yLabel: 'кг',
        aria: 'Регрессия графигі',
        tip: (x) => `<b>${F.num(x, 0)}-күн</b><span>Болжам</span><span>${F.kg(fit.intercept + fit.slope * x)}</span><span>Күні</span><span>${F.date(new Date(d.t0 + x * 864e5).toISOString())}</span>`
      });
    }
  };

  window.addEventListener('resize', () => {
    if (!root.hidden) { const ctx = App.modelContext(); const t = ctx.m.tab; draw[t] && draw[t](ctx); }
  });

  // =====================================================================
  //  Оқиғалар
  // =====================================================================
  let timer = null;
  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const d = el.dataset;
    const m = model();
    if (d.m) m[d.m] = el.value;
    else if (d.spread) m.spreads[d.spread] = el.value;
    else if (d.diary) st().diary.find((r) => r.id === d.diary)[d.dkey] = el.value;
    else return;
    App.save();
    clearTimeout(timer);
    // Параметрлер өзгергенде тек нәтиже қайта есептеледі, өрістер орнында қалады
    timer = setTimeout(() => {
      if (d.m && ['gManual', 'days', 'capacity', 'season', 'peak'].includes(d.m)) {
        const ctx = App.modelContext();
        updateG(ctx);
        renderBody(ctx);
      } else if (d.diary) {
        refreshDiaryResult();
      } else renderBody();
    }, 250);
  });

  function gSource(ctx) {
    return {
      manual: 'қолмен енгізілген',
      diary: 'жинау күнделігі бойынша (регрессия)',
      days: `калькулятордан: ${F.kg(ctx.ev.total)} / ${ctx.m.days} күн`,
      none: 'белгісіз — «неше күнде жиналды» өрісін толтырыңыз'
    }[ctx.gSrc];
  }

  function updateG(ctx) {
    const v = root.querySelector('.param-g__v');
    if (v) v.textContent = ctx.g ? kgd(ctx.g) : '—';
    const s = root.querySelector('.param-g__src');
    if (s) s.textContent = gSource(ctx);
  }

  // Күнделік енгізілгенде кестені қайта салмай, нәтиже мен графикті ғана жаңарту
  function refreshDiaryResult() {
    const ctx = App.modelContext();
    updateG(ctx);
    const focused = document.activeElement;
    const key = focused && focused.dataset ? [focused.dataset.diary, focused.dataset.dkey] : null;
    renderBody(ctx);
    if (key && key[0]) {
      const again = root.querySelector(`[data-diary="${key[0]}"][data-dkey="${key[1]}"]`);
      if (again) { again.focus(); if (again.type === 'number') { const v = again.value; again.value = ''; again.value = v; } }
    }
  }

  root.addEventListener('change', (ev) => {
    if (ev.target.dataset.m === 'peak') { model().peak = ev.target.value; App.save(); renderBody(); }
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    if (el.dataset.mtab) {
      model().tab = el.dataset.mtab;
      App.save();
      $$('[data-mtab]', root).forEach((b) => b.setAttribute('aria-selected', String(b === el)));
      renderBody();
    } else if (el.id === 'addDiary') {
      const last = st().diary[st().diary.length - 1];
      st().diary.push({ id: App.S.uid(), date: new Date().toISOString().slice(0, 10), kg: last ? '' : '0' });
      App.save();
      renderBody();
      const inputs = root.querySelectorAll('[data-dkey="kg"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    } else if (el.dataset.deldiary) {
      st().diary = st().diary.filter((r) => r.id !== el.dataset.deldiary);
      App.save();
      render();
    }
  });

  App.views.model = { title: 'Математикалық модель', render };
})();
