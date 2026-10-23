/* Калькулятор: бір экранда — бір сұрақ. Барлық есептеулер calc.js және model.js файлдарында. */
(function () {
  'use strict';
  const App = window.App;
  const { C, F, $, $$, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="calc"]');
  const body = $('#calcBody');
  const STEPS = 5; // 4 сұрақ + жауап

  // Таразы болмаса — санап есептеу (шамамен)
  const COUNTERS = {
    pet: { unit: 'бөтелке', kg: 0.03, text: '1 пластик бөтелке ≈ 30 г (0,5–2 л орташа)' },
    alu: { unit: 'банка', kg: 0.015, text: '1 алюминий банка ≈ 15 г' },
    paper: { unit: 'пачка А4', kg: 2.5, text: '500 парақтық 1 пачка А4 қағаз ≈ 2,5 кг' }
  };

  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    walk: svg('<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6.5L14 17v4M11.5 14.5l1-5L9 11v3M12.5 9.5l3 3 2.5.5"/>'),
    separate: svg('<path d="M4 16V12l2-5h12l2 5v4z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M4 12h16"/>'),
    onway: svg('<path d="M4 18c4-1 5-5 8-6s5 1 8-3"/><circle cx="12" cy="12" r="2.2"/><path d="M18 6h2v2"/>'),
    phone: svg('<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>'),
    route: svg('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>')
  };

  const MODES = [
    { id: 'walk', title: 'Жаяу немесе велосипедпен', text: 'Бензин жұмсалмайды' },
    { id: 'separate', title: 'Көлікпен арнайы барамын', text: 'Тек осы үшін барып-қайтамын' },
    { id: 'onway', title: 'Жол-жөнекей соғамын', text: 'Басқа жаққа бара жатып соғамын' }
  ];

  const wiz = () => {
    st().wiz = Object.assign({ mats: [], pointId: 'ls-ualikhanov', details: false }, st().wiz || {});
    // Бұрын енгізілген массасы бар материалдар да таңдалған болып саналады
    const masses = st().participants[0].masses;
    for (const id of Object.keys(masses)) if (Number(masses[id]) > 0 && !st().wiz.mats.includes(id)) st().wiz.mats.push(id);
    return st().wiz;
  };
  const masses = () => st().participants[0].masses;
  const car = () => st().transport.mode !== 'walk';
  const kmKey = () => (st().transport.mode === 'separate' ? 'oneWayKm' : 'detourKm');
  const chosenPoint = () => App.pointById(wiz().pointId);

  // =====================================================================
  //  1-сұрақ: не жинадыңыз?
  // =====================================================================
  function q1() {
    const sel = wiz().mats;
    const tiles = st().materials.map((m) => `
      <button type="button" class="tile" data-mat-toggle="${m.id}" aria-pressed="${sel.includes(m.id)}">
        <b>${esc(m.name)}</b><span>${esc(m.hint || '')}</span>
      </button>`).join('');
    return `<div class="ask">
      <p class="ask__n">1-сұрақ</p>
      <h2>Не жинадыңыз?</h2>
      <p class="ask__help">Жиналған шикізаттың түрлерін басып белгілеңіз. Бірнешеуін таңдауға болады.</p>
      <div class="tiles">${tiles}</div>
    </div>`;
  }

  // =====================================================================
  //  2-сұрақ: қанша кг?
  // =====================================================================
  function q2() {
    const rows = wiz().mats.map((id) => {
      const m = st().materials.find((x) => x.id === id);
      if (!m) return '';
      const cnt = COUNTERS[id];
      return `<div class="kg-row">
        <div class="kg-row__top">
          <label for="kg-${id}"><b>${esc(m.name)}</b></label>
          <div class="stepper-in">
            <button type="button" class="round" data-bump="${id}" data-delta="-1" aria-label="1 кг азайту">−</button>
            <input id="kg-${id}" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0" data-kg="${id}" value="${esc(masses()[id] ?? '')}">
            <span class="unit">кг</span>
            <button type="button" class="round" data-bump="${id}" data-delta="1" aria-label="1 кг қосу">+</button>
          </div>
        </div>
        ${cnt ? `<details class="counter"><summary>Таразы жоқ па? Санап есептеңіз</summary>
          <div class="counter__body">
            <input type="number" inputmode="numeric" min="0" step="1" placeholder="саны" data-count="${id}" aria-label="${cnt.unit} саны">
            <span>${cnt.unit} = <b data-count-out="${id}">0 кг</b></span>
            <button type="button" class="btn btn--small" data-count-add="${id}">Қосу</button>
            <p class="hint">${cnt.text} (шамамен)</p>
          </div></details>` : ''}
      </div>`;
    }).join('');
    const days = (st().model || {}).days || '';
    return `<div class="ask">
      <p class="ask__n">2-сұрақ</p>
      <h2>Әрқайсысы қанша килограмм?</h2>
      <p class="ask__help">Тұрмыстық таразымен өлшеңіз (пакетпен бірге өлшеп, пакеттің салмағын шегеріңіз).</p>
      <div class="kg-list">${rows}</div>
      <p class="total-big">Барлығы: <b id="massTotal">0 кг</b></p>
      <p class="error" id="massError" hidden></p>
      <label class="field field--days"><span>Бұл қанша күнде жиналды? <small>Міндетті емес. Жазсаңыз, сайт қанша күнде бір рет өткізу тиімді екенін есептейді.</small></span>
        <span class="with-unit"><input type="number" min="0" step="1" inputmode="numeric" id="collectDays" value="${esc(days)}" placeholder="мысалы, 30"><span class="unit">күн</span></span></label>
    </div>`;
  }

  // =====================================================================
  //  3-сұрақ: қалай барасыз?
  // =====================================================================
  function q3() {
    const mode = st().transport.mode;
    return `<div class="ask">
      <p class="ask__n">3-сұрақ</p>
      <h2>Пунктке қалай барасыз?</h2>
      <div class="big-choices">${MODES.map((m) => `
        <button type="button" class="big-choice" data-mode="${m.id}" aria-pressed="${mode === m.id}">
          <span class="big-choice__icon">${ICON[m.id]}</span>
          <span><b>${m.title}</b><small>${m.text}</small></span>
        </button>`).join('')}</div>
    </div>`;
  }

  // =====================================================================
  //  4-сұрақ: қай пункт, қанша км?
  // =====================================================================
  function q4() {
    const sel = wiz().mats;
    const key = kmKey();
    const relevant = st().points.filter((p) => sel.some((id) => Object.prototype.hasOwnProperty.call(p.prices || {}, id)));
    const priced = (p) => sel.filter((id) => typeof (p.prices || {})[id] === 'number').length;
    relevant.sort((a, b) => priced(b) - priced(a));
    if (!relevant.some((p) => p.id === wiz().pointId) && relevant[0]) wiz().pointId = relevant[0].id;
    const hidden = st().points.length - relevant.length;
    const cards = relevant.map((p) => {
      const on = p.id === wiz().pointId;
      const chips = sel.map((id) => {
        const name = esc(App.matName(id));
        if (!Object.prototype.hasOwnProperty.call(p.prices || {}, id)) return `<span class="chip chip--no">${name}: қабылдамайды</span>`;
        const price = p.prices[id];
        return price == null ? `<span class="chip chip--unk">${name}: бағасы белгісіз</span>` : `<span class="chip chip--ok">${name}: ${F.num(price)} ₸/кг</span>`;
      }).join('');
      const tel = p.phone ? `<a class="link" href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a>` : '';
      return `<div class="place${on ? ' is-on' : ''}">
        <label class="place__head">
          <input type="radio" name="place" value="${p.id}"${on ? ' checked' : ''} data-place="${p.id}">
          <span><b>${esc(p.name)}</b><small>${esc(p.address || '')}</small></span>
        </label>
        <div class="chips">${chips}</div>
        ${!priced(p) ? `<p class="hint">Бағасын білу үшін қоңырау шалыңыз${tel ? ': ' + tel : ''}.</p>` : ''}
        ${on && car() ? `<div class="km-box">
          <label class="field"><span>${st().transport.mode === 'separate' ? 'Үйден пунктке дейін қанша км? (бір жаққа)' : 'Жолыңыз қанша км ұзарады?'}</span>
            <span class="with-unit"><input type="number" min="0" step="0.1" inputmode="decimal" data-km="${p.id}" data-key="${key}" value="${esc(p[key] ?? '')}" placeholder="км"><span class="unit">км</span></span></label>
          <a class="btn btn--small" href="${esc(App.directionsUrl(p))}" target="_blank" rel="noopener">Google Maps-та қашықтықты көру ↗</a>
        </div>` : ''}
      </div>`;
    }).join('');
    return `<div class="ask">
      <p class="ask__n">4-сұрақ</p>
      <h2>Қай пунктке апарасыз?</h2>
      <p class="ask__help">Пунктті таңдаңыз. Жасыл — бағасы белгілі, сары — бағасын қоңырау шалып білу керек.</p>
      <div class="places">${cards || '<p class="hint">Таңдалған материалдарды қабылдайтын пункт тізімде жоқ.</p>'}</div>
      ${hidden > 0 ? `<p class="hint">Тағы ${hidden} пункт сіздің материалдарыңызды қабылдамайды. Барлық пункт — <a href="#/prices">Бағалар</a> бетінде.</p>` : ''}
      ${car() ? `<div class="fuel-box">
        <h3>Көлік туралы</h3>
        <div class="pair">
          <label class="field"><span>1 литр бензин қанша тұрады?</span>
            <span class="with-unit"><input type="number" min="0" step="1" inputmode="decimal" id="fuelPrice" value="${esc(st().transport.fuelPrice)}" placeholder="бекеттегі баға"><span class="unit">₸</span></span></label>
          <label class="field"><span>Көлік 100 км-ге неше литр жұмсайды? <small>Білмесеңіз, 8 қалдырыңыз — жеңіл көлік үшін орташа.</small></span>
            <span class="with-unit"><input type="number" min="0" step="0.1" inputmode="decimal" id="consumption" value="${esc(st().transport.consumption)}"><span class="unit">л</span></span></label>
        </div>
      </div>` : ''}
      <p class="error" id="q4Error" hidden></p>
    </div>`;
  }

  // =====================================================================
  //  Жауап
  // =====================================================================
  function answer() {
    const errs = App.inputErrors();
    if (errs.length) return `<div class="verdict-card verdict-card--neutral"><h2>Деректерді түзетіңіз</h2><p>${errs.map((e) => esc(e.text)).join('<br>')}</p></div>`;
    const ev = App.evaluate();
    const e = ev.chosen;
    const p = chosenPoint();
    if (!e || !p) return `<div class="verdict-card verdict-card--neutral"><h2>Пункт таңдалмаған</h2><p>4-сұраққа оралыңыз.</p></div>`;
    const t = ev.t;
    const walk = t.mode === 'walk';
    const tel = p.phone ? `<a class="btn btn--primary" href="tel:${esc(p.phone.replace(/\s/g, ''))}">${ICON.phone}Қоңырау шалу</a>` : '';
    const q = App.modelQuick ? App.modelQuick() : null;
    const ctx = App.modelContext ? App.modelContext() : null;

    // Бас жауап
    let tone, title, text;
    if (e.revenue === 0) {
      tone = 'neutral';
      title = 'Бұл пункттің бағасы белгісіз';
      text = `Пункт сіздің шикізатыңызға қанша төлейтінін білмейміз. Қоңырау шалып, бағасын біліңіз де, оны «Бағалар» бетіне жазыңыз.`;
    } else if (walk) {
      tone = 'good';
      title = 'Иә, апара беріңіз';
      text = `Пункт шамамен <b>${F.money(e.revenue)}</b> төлейді. Жаяу барғанда бензинге шығын жоқ.`;
    } else if (e.result >= 0) {
      tone = 'good';
      title = 'Иә, өткізуге болады';
      text = `Бензин шығынын шегергенде шамамен <b>${F.money(e.result)}</b> қалады.`;
    } else {
      tone = 'bad';
      title = 'Әзірге ерте';
      const need = e.scale ? ev.total * e.scale - ev.total : null;
      text = `Бензинге <b>${F.money(e.fuelCost)}</b> кетеді, ал пункт <b>${F.money(e.revenue)}</b> ғана төлейді.`;
      if (need > 0) {
        text += ` Тағы шамамен <b>${F.kg(need)}</b> жинаңыз`;
        if (ctx && ctx.g) {
          const days = window.EcoModel.timeToReach(ev.total + need, ctx.g, ctx.cap, ev.total);
          text += Number.isFinite(days) ? ` — бұл шамамен ${F.num(days, 0)} күн.` : ' — бірақ сақтау орныңызға мұнша сыймайды.';
        } else text += '.';
        text += ' Немесе басқа жаққа бара жатып, жол-жөнекей соғыңыз.';
      }
    }

    const facts = [];
    if (q && q.risk && e.revenue > 0) {
      const k = Math.round(q.risk.pPositive * 10);
      const SUFFIX = { 1: 'і', 2: 'сі', 3: 'і', 4: 'і', 5: 'і', 6: 'сы', 7: 'сі', 8: 'і', 9: 'ы' };
      const share = k >= 10 ? '<b>барлығы дерлік</b>' : k <= 0 ? '<b>бірде-біреуі</b>' : `шамамен <b>${k}</b>-${SUFFIX[k]}`;
      facts.push(`<li><b>Сенімділік:</b> бағалар мен жол өзгерсе де, 10 сапардың ${share} өзін ақтайды (ықтималдығы ${F.pct(q.risk.pPositive * 100)}). <small>Монте-Карло әдісі</small></li>`);
    }
    if (q && q.interval && e.revenue > 0 && q.interval.J <= 0) {
      facts.push('<li><b>Қашан өткізу тиімді:</b> бұл пунктке арнайы сапар бір жыл ішінде де ақталмайды — жол-жөнекей соғыңыз немесе көршілермен бірге апарыңыз. <small>Оңтайландыру</small></li>');
    } else if (q && q.interval && e.revenue > 0) {
      facts.push(`<li><b>Қашан өткізу тиімді:</b> әр <b>${F.num(q.interval.T, 0)} күнде</b> бір рет (шамамен ${F.kg(q.interval.m)}). <small>Оңтайландыру</small></li>`);
    } else if (e.revenue > 0 && !(ctx && ctx.g)) {
      facts.push('<li class="muted">2-сұрақта «қанша күнде жиналды» деп жазсаңыз, сайт қанша күнде бір рет өткізу тиімді екенін есептейді.</li>');
    }
    if (e.notAccepted.length) facts.push(`<li><b>Бұл пункт қабылдамайды:</b> ${App.listNames(e.notAccepted)} — оларды басқа пунктке апарыңыз.</li>`);
    if (e.unpriced.length && e.revenue > 0) facts.push(`<li><b>Бағасы белгісіз, есепке кірмеді:</b> ${App.listNames(e.unpriced)}.</li>`);
    if (e.belowMin.length) facts.push(`<li><b>Аз, пункт қабылдамайды:</b> ${e.belowMin.map((i) => `${esc(App.matName(i.matId))} (кемінде ${F.num(i.minBatch)} кг)`).join(', ')}.</li>`);

    return `<div class="verdict-card verdict-card--${tone}">
        <p class="verdict-card__kicker">${esc(p.name)} · ${F.kg(ev.total)}</p>
        <h2>${title}</h2>
        <p class="verdict-card__text">${text}</p>
      </div>
      ${e.revenue > 0 ? `<div class="three">
        <div><span>Пункт төлейді</span><b>${F.money(e.revenue)}</b></div>
        <div><span>Бензинге</span><b>${walk ? '0 ₸' : F.money(e.fuelCost)}</b></div>
        <div><span>Сізде қалады</span><b class="${App.sign(e.result)}">${F.money(e.result)}</b></div>
      </div>` : ''}
      ${facts.length ? `<ul class="facts">${facts.join('')}</ul>` : ''}
      ${!p.confirmed ? `<p class="soft-warn">Баға интернеттен алынған, пункт әлі растамаған. Барар алдында қоңырау шалып нақтылаңыз.</p>` : ''}
      <div class="answer-actions">
        ${e.revenue === 0 ? tel : `<a class="btn btn--primary" href="${esc(App.directionsUrl(p))}" target="_blank" rel="noopener">${ICON.route}Маршрут</a>`}
        ${e.revenue > 0 ? '<button class="btn" type="button" id="toJournal">Журналға жазу</button>' : ''}
        <button class="btn btn--ghost" type="button" id="restart">Қайта бастау</button>
      </div>
      <details class="details" id="detailsBox"${wiz().details ? ' open' : ''}>
        <summary>Толық талдау (жюриге арналған)</summary>
        <div class="tabs" role="tablist">${[['compare', 'Барлық пункттер'], ['threshold', 'Қанша жинау керек'], ['steps', 'Формулалар']].map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${(st().resultTab || 'compare') === id}">${label}</button>`).join('')}</div>
        <div class="tab-body" id="tabBody">${tabBody(ev)}</div>
        <p class="hint">Терең математикалық модель — <a href="#/model">Ғылым → Математикалық модель</a>.</p>
      </details>`;
  }

  // ---------- толық талдау ----------
  function tabBody(ev) {
    if (st().resultTab === 'threshold') return thresholdTab(ev);
    if (st().resultTab === 'steps') return stepsTab(ev);
    return compareTab(ev);
  }

  function compareTab(ev) {
    const t = ev.t;
    const all = C.comparePoints(st().points, ev.masses, t);
    const walk = t.mode === 'walk';
    const rows = all.evals.filter((e) => e.hasMass).map((e) => {
      const p = App.pointById(e.pointId);
      const unknown = e.revenue === 0;
      const best = all.bestFull && all.bestFull.pointId === e.pointId;
      return `<tr${e.pointId === wiz().pointId ? ' aria-selected="true"' : ''}>
        <th scope="row">${esc(p.name)}${best ? ' <span class="status status--best">ең тиімді</span>' : ''}</th>
        <td class="num">${unknown ? '<span class="unk">белгісіз</span>' : F.money(e.revenue)}</td>
        <td class="num">${walk ? '—' : e.distanceKnown ? F.money(e.fuelCost) : '<span class="unk">км жоқ</span>'}</td>
        <td class="num">${unknown || !e.distanceKnown ? '—' : `<b class="${App.sign(e.result)}">${F.money(e.result)}</b>`}</td>
      </tr>`;
    }).join('');
    return `<p class="hint">Барлық пункт бір кестеде. Қашықтығы мен бағасы белгісіз пункттердің нәтижесі есептелмейді.</p>
      <div class="scroll"><table class="tbl cmp"><thead><tr><th>Пункт</th><th class="num">Төлейді</th><th class="num">Бензин</th><th class="num">Қалады</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  let chartArgs = null;
  function thresholdTab(ev) {
    const e = ev.chosen;
    const t = ev.t;
    chartArgs = null;
    if (!e) return '';
    const p = App.pointById(e.pointId);
    const rows = e.thresholds.filter((th) => wiz().mats.includes(th.matId)).map((th) => {
      const name = `<th scope="row">${esc(App.matName(th.matId))}</th>`;
      if (th.kind !== 'ok') return `<tr>${name}<td colspan="3" class="muted">бағасы белгісіз</td></tr>`;
      const have = Number(ev.masses[th.matId]) || 0;
      return `<tr>${name}<td class="num">${F.kg(th.mMin)}</td><td class="num">${F.kg(have)}</td>
        <td class="num">${th.need <= 0 ? '<span class="pos">жеткілікті</span>' : '+' + F.kg(th.need)}</td></tr>`;
    }).join('');
    const paid = e.items.filter((i) => i.status === C.STATUS.OK);
    const m0 = paid.reduce((s, i) => s + i.mass, 0);
    let chart = '';
    if (!walk(t) && e.fuelCost > 0 && m0 > 0) {
      chartArgs = { a: e.revenue / m0, C: e.fuelCost, m0 };
      chart = `<ul class="legend"><li><i class="lg lg--rev"></i>Пункт төлейтін ақша</li><li><i class="lg lg--fuel"></i>Бензин шығыны</li><li><i class="lg lg--loss"></i>Залал</li></ul><div class="chart-box" id="chartBox"></div>
        <p class="hint">Сызықтар қиылысатын жерде — сапар өзін ақтайтын масса.</p>`;
    }
    return `${chart}
      <p class="hint">Тек бір материалды өткізгенде бензинді (${F.money(e.fuelCost)}) ақтау үшін одан қанша керек · ${esc(p.name)}</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Материал</th><th class="num">Керек</th><th class="num">Бар</th><th class="num">Тағы</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const walk = (t) => t.mode === 'walk';

  function stepsTab(ev) {
    const e = ev.chosen;
    const t = ev.t;
    if (!e) return '';
    const p = App.pointById(e.pointId);
    const ok = e.items.filter((i) => i.status === C.STATUS.OK);
    const rTerms = ok.map((i) => `${F.num(i.mass)} × ${F.num(i.price)}`).join(' + ') || '0';
    const dText = t.mode === 'separate' ? `2 × ${F.num(Number(p.oneWayKm) || 0)} = ${F.km(e.distanceKm)}` : walk(t) ? '0 км' : F.km(e.distanceKm);
    return `<ol class="steps">
        <li><span>Пункт төлейді</span><code>R = Σ m·p = ${rTerms} = <b>${F.money(e.revenue)}</b></code></li>
        <li><span>Қосымша жол</span><code>d = ${dText}</code></li>
        <li><span>Бензин, литр</span><code>Q = d·c/100 = ${F.num(e.distanceKm)} × ${F.num(t.consumption)} / 100 = <b>${F.lit(e.liters)}</b></code></li>
        <li><span>Бензин, теңге</span><code>C = Q·p<sub>ж</sub> = ${F.num(e.liters)} × ${F.num(t.fuelPrice)} = <b>${F.money(e.fuelCost)}</b></code></li>
        <li><span>Қалады</span><code>B = R − C = <b class="${App.sign(e.result)}">${F.money(e.result)}</b></code></li>
      </ol>`;
  }

  function drawChart() {
    const box = $('#chartBox');
    if (box && chartArgs) window.BreakEvenChart.render(box, chartArgs);
  }
  window.addEventListener('resize', drawChart);

  // =====================================================================
  //  Көрсету
  // =====================================================================
  function render() {
    wiz();
    st().who = 'family';
    let step = Math.min(STEPS, Math.max(1, Number(st().step) || 1));
    if (step > 1 && !wiz().mats.length) step = 1;
    st().step = step;
    $('#progress').innerHTML = step < STEPS
      ? `<span>${step} / 4</span><span class="bar"><i style="width:${(step / 4) * 100}%"></i></span>`
      : '<span>Жауап</span><span class="bar"><i style="width:100%"></i></span>';
    $('#calcIntro').hidden = step !== 1;
    body.innerHTML = [null, q1, q2, q3, q4, answer][step]();
    $('#prevStep').hidden = step === 1;
    $('#nextStep').hidden = step === STEPS;
    $('#nextStep').textContent = step === 4 ? 'Жауапты көру' : 'Келесі';
    if (step === 2) updateMass();
    if (step === STEPS) drawChart();
    updateNext();
  }

  function updateNext() {
    const step = st().step;
    const b = $('#nextStep');
    b.disabled = step === 1 && !wiz().mats.length;
  }

  function updateMass() {
    const errs = App.inputErrors().filter((e) => e.kind === 'mass');
    $$('[data-kg]').forEach((el) => el.classList.toggle('invalid', errs.some((e) => e.mid === el.dataset.kg)));
    $('#massError').hidden = !errs.length;
    $('#massError').textContent = errs.map((e) => e.text).join('; ');
    $('#massTotal').textContent = F.kg(App.sumKg(App.totalMasses()));
    return errs;
  }

  function validate(step) {
    if (step === 2) {
      if (updateMass().length) return false;
      if (!(App.sumKg(App.totalMasses()) > 0)) { showErr('#massError', 'Кемінде бір материалдың массасын жазыңыз.'); return false; }
    }
    if (step === 4) {
      const p = chosenPoint();
      if (!p) { showErr('#q4Error', 'Пунктті таңдаңыз.'); return false; }
      if (car()) {
        if (p[kmKey()] === '' || p[kmKey()] == null) { showErr('#q4Error', 'Пунктке дейін қанша км екенін жазыңыз. Білмесеңіз, «Google Maps-та қашықтықты көру» батырмасын басыңыз.'); return false; }
        if (st().transport.fuelPrice === '') { showErr('#q4Error', '1 литр бензиннің бағасын жазыңыз (жанармай құю бекетінің таблосында).'); return false; }
        const bad = App.inputErrors().filter((e) => e.kind !== 'mass');
        if (bad.length) { showErr('#q4Error', bad.map((e) => e.text).join('; ')); return false; }
      }
    }
    return true;
  }

  function showErr(sel, text) {
    const el = $(sel);
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function go(n) {
    if (n > st().step && !validate(st().step)) return;
    st().step = n;
    App.save();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- оқиғалар ----------
  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const d = el.dataset;
    if (d.kg) { masses()[d.kg] = el.value; updateMass(); }
    else if (d.count) {
      const kg = (Number(el.value) || 0) * COUNTERS[d.count].kg;
      $(`[data-count-out="${d.count}"]`).textContent = F.kg(kg);
    }
    else if (el.id === 'collectDays') st().model = Object.assign(st().model || {}, { days: el.value });
    else if (d.km) App.pointById(d.km)[d.key] = el.value;
    else if (el.id === 'consumption' || el.id === 'fuelPrice') st().transport[el.id] = el.value;
    else return;
    if (!$('#q4Error') || d.km || el.id === 'fuelPrice') { const e = $('#q4Error'); if (e) e.hidden = true; }
    App.save();
  });

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.place) { wiz().pointId = el.dataset.place; App.save(); render(); }
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    const d = el.dataset;
    if (d.matToggle) {
      const list = wiz().mats;
      const i = list.indexOf(d.matToggle);
      if (i >= 0) { list.splice(i, 1); delete masses()[d.matToggle]; } else list.push(d.matToggle);
      el.setAttribute('aria-pressed', String(i < 0));
      App.save();
      updateNext();
    } else if (d.bump) {
      const v = Math.max(0, (Number(masses()[d.bump]) || 0) + Number(d.delta));
      masses()[d.bump] = String(Math.round(v * 10) / 10);
      $(`[data-kg="${d.bump}"]`).value = masses()[d.bump];
      App.save();
      updateMass();
    } else if (d.countAdd) {
      const input = $(`[data-count="${d.countAdd}"]`);
      const kg = (Number(input.value) || 0) * COUNTERS[d.countAdd].kg;
      if (kg > 0) {
        masses()[d.countAdd] = String(Math.round(((Number(masses()[d.countAdd]) || 0) + kg) * 100) / 100);
        $(`[data-kg="${d.countAdd}"]`).value = masses()[d.countAdd];
        input.value = '';
        $(`[data-count-out="${d.countAdd}"]`).textContent = '0 кг';
        App.save();
        updateMass();
      }
    } else if (d.mode) {
      st().transport.mode = d.mode;
      App.save();
      go(4); // таңдау жасалды — бірден келесі сұрақ
    } else if (d.tab) {
      st().resultTab = d.tab;
      App.save();
      $$('[data-tab]', root).forEach((b) => b.setAttribute('aria-selected', String(b === el)));
      $('#tabBody').innerHTML = tabBody(App.evaluate());
      drawChart();
    } else if (el.id === 'prevStep') go(st().step - 1);
    else if (el.id === 'nextStep') go(st().step + 1);
    else if (el.id === 'restart') go(1);
    else if (el.id === 'toJournal') { if (App.addJournalRecord()) App.toast('Болжам журналға жазылды', '#/notes', 'Ашу'); }
  });

  root.addEventListener('toggle', (ev) => {
    if (ev.target.id === 'detailsBox') { wiz().details = ev.target.open; App.save(); if (ev.target.open) drawChart(); }
  }, true);

  App.views.calc = { title: 'Отбасы калькуляторы', render };
})();
