/* Маршрут: жинау нүктелері, жол коэффициентін калибрлеу, коммивояжер есебі (Хелд–Карп) */
(function () {
  'use strict';
  const App = window.App;
  const K = window.EcoCampaign;
  const { F, $, esc } = App;
  const root = $('[data-view="route"]');
  const NS = 'http://www.w3.org/2000/svg';

  const coordField = (attr, value, label) => `<label class="field"><span>${label}</span><input ${attr} value="${esc(value)}" placeholder="53.2860, 69.3925" inputmode="decimal"></label>`;

  function render() {
    const c = App.camp();
    const r = c.route;
    const res = App.routeResult();
    const t = App.transport();
    const placeOptions = (sel) => [['school', r.school.name || 'Мектеп'], ...r.spots.map((s) => [s.id, s.name || '?']), ['center', App.placeName('center')]]
      .map(([id, n]) => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');

    let result = '';
    if (!res.ready) {
      result = '<div class="qa"><p class="qa__q">Сұрақ: көлік шикізатты қай ретпен жинаса, жол ең қысқа болады?</p><p class="qa__a">Мектептің және қабылдау пунктінің координаттарын енгізіңіз — сонда маршрут есептеледі.</p></div>';
    } else {
      const names = res.order.map((i) => (i === 0 ? r.school.name || 'Мектеп' : i === res.places.length - 1 ? App.placeName('center') : res.spots[i - 1].name));
      const save = res.soloKm - res.routeKm;
      const lSave = K.fuelOf(save, t.consumption);
      const lRoute = K.fuelOf(res.routeKm, t.consumption);
      const waypoints = res.order.slice(1, -1).map((i) => `${res.places[i].lat},${res.places[i].lng}`).join('|');
      const gm = `https://www.google.com/maps/dir/?api=1&origin=${res.school.lat},${res.school.lng}&destination=${res.center.lat},${res.center.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
      result = `<div class="qa"><p class="qa__q">Сұрақ: көлік шикізатты қай ретпен жинаса, жол ең қысқа болады?</p>
        <p class="qa__a">Ең қысқа маршрут — <b>${F.km(res.routeKm)}</b> (қайтуды қоса): ${names.map(esc).join(' → ')} → ${esc(r.school.name || 'Мектеп')}.
        ${res.families ? ` Әр отбасы (${res.families}) өзі барса — ${F.km(res.soloKm)}. Бірлесіп жинағанда <b>${F.km(save)}</b> жол, <b>${F.num(lSave, 1)} л</b> бензин${t.fuelPrice ? ` (${F.money(lSave * t.fuelPrice)})` : ''} және <b>${F.num(lSave * K.CO2_PER_LITER, 1)} кг CO₂</b> үнемделеді.` : ''}</p></div>
        <div class="cols">
          <div class="panel pad"><h3 class="h3">Сұлба</h3><div id="routeMap" class="route-map"></div>
            <div class="actions"><a class="btn btn--primary" href="${esc(gm)}" target="_blank" rel="noopener">Google Maps-та маршрутты ашу ↗</a></div></div>
          <div class="panel pad"><h3 class="h3">Салыстыру</h3>
            <table class="tbl"><thead><tr><th>Нұсқа</th><th class="num">Жол</th><th class="num">Бензин</th><th class="num">CO₂</th></tr></thead><tbody>
              <tr class="is-best"><th>Оңтайлы маршрут</th><td class="num">${F.km(res.routeKm)}</td><td class="num">${F.num(lRoute, 1)} л</td><td class="num">${F.num(lRoute * K.CO2_PER_LITER, 1)} кг</td></tr>
              <tr><th>Нүктелерді тізім ретімен аралау</th><td class="num">${F.km(res.inputKm)}</td><td class="num">${F.num(K.fuelOf(res.inputKm, t.consumption), 1)} л</td><td class="num">${F.num(K.fuelOf(res.inputKm, t.consumption) * K.CO2_PER_LITER, 1)} кг</td></tr>
              ${res.families ? `<tr><th>Әр отбасы жеке барады</th><td class="num">${F.km(res.soloKm)}</td><td class="num">${F.num(K.fuelOf(res.soloKm, t.consumption), 1)} л</td><td class="num">${F.num(K.fuelOf(res.soloKm, t.consumption) * K.CO2_PER_LITER, 1)} кг</td></tr>` : ''}
            </tbody></table>
            <p class="hint">Жол коэффициенті k = ${F.num(res.k, 3)} (${res.kSrc === 'manual' ? 'қолмен енгізілген' : res.kSrc === 'calib' ? `${res.calib.n} өлшем бойынша калибрленген, R² = ${F.num(res.calib.r2, 3)}` : 'әдепкі мән — төменде калибрлеңіз'}). CO₂: 1 л бензин ≈ ${K.CO2_PER_LITER} кг (US EPA).</p>
          </div>
        </div>`;
    }

    root.querySelector('#routeBody').innerHTML = `${App.demoBanner()}
      <header class="page-head"><h1>Маршрут</h1><p>Көлік мектептен шығып, жинау нүктелерін аралап, шикізатты пунктке апарады. Сайт ең қысқа ретті табады. Үй мекенжайлары жиналмайды — тек ашық орындар (мектеп, аялдама, дүкен).</p></header>
      ${result}
      <div class="panel pad">
        <h2 class="h3">Орындар</h2>
        <p class="hint">Координатты алу: Google Maps-та орынды басып тұрыңыз (компьютерде — оң жақ батырма) → «53.28…, 69.39…» сандары шығады → көшіріп, осында қойыңыз.</p>
        <div class="pair">
          <label class="field"><span>Бастау атауы</span><input data-r="schoolName" value="${esc(r.school.name)}"></label>
          ${coordField('data-r="schoolCoord"', r.school.coord, 'Бастау (мектеп) координаты')}
          ${coordField('data-r="center"', r.center, `Соңы — қабылдау пункті (${esc(App.placeName('center'))})`)}
        </div>
        <h3 class="h3 mt">Жинау нүктелері</h3>
        <div class="spots">${r.spots.map((s, i) => `<div class="spot">
          <label class="field"><span>Атауы</span><input data-spot="${s.id}" data-key="name" value="${esc(s.name)}" placeholder="мысалы, Сарыарқа, дүкен жаны"></label>
          ${coordField(`data-spot="${s.id}" data-key="coord"`, s.coord, 'Координаты')}
          <span class="spot__n">${res.counts && res.ready ? `${res.counts[res.spots.findIndex((x) => x.id === s.id)] ?? 0} отбасы` : ''}</span>
          <button type="button" class="del" data-del-spot="${s.id}" aria-label="Өшіру">×</button></div>`).join('') || '<p class="hint">Нүкте жоқ — көлік тек мектептен пунктке барады.</p>'}</div>
        <div class="actions"><button class="btn" type="button" id="addSpot">+ Нүкте қосу</button></div>
        <p class="hint">Отбасының нүктесі өлшем жазғанда таңдалады (Деректер бетінде немесе сауалнамада). Ең көбі 12 нүкте.</p>
      </div>
      <details class="panel pad" ${r.calib.length ? 'open' : ''}>
        <summary><b>Жол коэффициентін калибрлеу</b> — түзу арақашықтықты нақты жолға айналдыру</summary>
        <p class="hint">Екі нүкте арасындағы жол қашықтығын Google Maps-тан қарап жазыңыз (кемінде 3 жұп). Сайт k = Σ(sᵢ·rᵢ)/Σsᵢ² табады, мұнда sᵢ — түзу (гаверсинус), rᵢ — жол қашықтығы.</p>
        <div class="calib">${r.calib.map((p, i) => {
          const a = App.parseCoord(p.a === 'school' ? r.school.coord : p.a === 'center' ? r.center : (r.spots.find((s) => s.id === p.a) || {}).coord);
          const b = App.parseCoord(p.b === 'school' ? r.school.coord : p.b === 'center' ? r.center : (r.spots.find((s) => s.id === p.b) || {}).coord);
          const s = a && b ? K.haversine(a, b) : null;
          return `<div class="calib__row"><select data-cal="${i}" data-key="a">${placeOptions(p.a)}</select><span>→</span><select data-cal="${i}" data-key="b">${placeOptions(p.b)}</select>
            <span class="with-unit"><input data-cal="${i}" data-key="road" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(p.road)}" placeholder="жол"><span class="unit">км</span></span>
            <span class="hint">түзу: ${s == null ? '—' : F.km(s)}${s && p.road ? ` · k = ${F.num(p.road / s, 2)}` : ''}</span>
            <button type="button" class="del" data-del-cal="${i}" aria-label="Өшіру">×</button></div>`;
        }).join('')}</div>
        <div class="actions"><button class="btn" type="button" id="addCal">+ Жұп қосу</button>
          <label class="field field--inline-k"><span>немесе k-ны қолмен</span><input data-r="k" type="number" min="1" step="0.01" value="${esc(r.k)}" placeholder="${res.calib ? F.num(res.calib.k, 2) : '1,3'}"></label></div>
        ${res.calib ? `<p class="hint">Нәтиже: k = ${F.num(res.calib.k, 3)}, R² = ${F.num(res.calib.r2, 3)}, орташа салыстырмалы қате ${F.pct(res.calib.mape * 100)}.</p>` : ''}
      </details>
      <details class="math"><summary>Математикасы</summary>
        <p>Нүктелер арасындағы түзу арақашықтық — гаверсинус формуласы (R = 6371 км):</p>
        <p class="eq">s = 2R·arcsin √( sin²(Δφ/2) + cos φ₁·cos φ₂·sin²(Δλ/2) )</p>
        <p>Қала көшелері түзу емес, сондықтан жол d = k·s. Коэффициент k бірнеше нақты маршрут бойынша ең кіші квадраттар әдісімен (бас нүкте арқылы өтетін түзу) табылады.</p>
        <p>Маршрут — ашық коммивояжер есебі: мектептен шығып, n нүктенің әрқайсысына бір рет соғып, пунктте аяқтау. Толық іріктеу n! жолды қарайды (12! ≈ 4,8·10⁸), ал <b>Хелд–Карп</b> динамикалық бағдарламалау әдісі O(n²·2ⁿ) операцияда дәл шешімді табады:</p>
        <p class="eq">D(S, j) = min<sub>i∈S∖{j}</sub> [ D(S∖{j}, i) + d(i, j) ],&nbsp; D({j}, j) = d(0, j)</p>
        <p>мұнда D(S, j) — S жиынындағы нүктелерді аралап, j-де аяқталатын ең қысқа жол. Бензин Q = d·c/100, CO₂ = 2,35·Q кг.</p>
      </details>`;
    if (res.ready) drawMap(res);
  }

  function drawMap(res) {
    const box = $('#routeMap');
    if (!box) return;
    const W = Math.max(280, box.clientWidth), H = 300, pad = 30;
    const pts = res.places;
    const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const proj = (p) => ({ x: p.lng * Math.cos((lat0 * Math.PI) / 180), y: -p.lat });
    const xy = pts.map(proj);
    const minX = Math.min(...xy.map((p) => p.x)), maxX = Math.max(...xy.map((p) => p.x));
    const minY = Math.min(...xy.map((p) => p.y)), maxY = Math.max(...xy.map((p) => p.y));
    const sc = Math.min((W - 2 * pad) / (maxX - minX || 1e-6), (H - 2 * pad) / (maxY - minY || 1e-6));
    const X = (p) => pad + (p.x - minX) * sc + ((W - 2 * pad) - (maxX - minX) * sc) / 2;
    const Y = (p) => pad + (p.y - minY) * sc + ((H - 2 * pad) - (maxY - minY) * sc) / 2;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Маршрут сұлбасы');
    const path = res.order.map((i) => xy[i]);
    path.push(xy[0]);
    let d = '';
    path.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p).toFixed(1)},${Y(p).toFixed(1)}`; });
    svg.innerHTML = `<path d="${d}" class="route-line"/>` + res.order.map((i, step) => {
      const p = xy[i];
      const kind = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'spot';
      const label = i === 0 ? 'Мектеп' : i === pts.length - 1 ? 'Пункт' : `${step}`;
      return `<g class="route-pt route-pt--${kind}"><circle cx="${X(p)}" cy="${Y(p)}" r="${kind === 'spot' ? 11 : 9}"/><text x="${X(p)}" y="${Y(p) + (kind === 'spot' ? 4 : -14)}" text-anchor="middle">${label}</text></g>`;
    }).join('');
    box.innerHTML = '';
    box.appendChild(svg);
  }

  // ---------- оқиғалар ----------
  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => { const a = document.activeElement; const sel = a && a.dataset ? Object.entries(a.dataset).map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${v}"]`).join('') : ''; render(); if (sel) { const el = root.querySelector(sel); if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); } } }, 600); };

  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const d = el.dataset;
    const r = App.camp().route;
    if (d.r === 'schoolName') r.school.name = el.value;
    else if (d.r === 'schoolCoord') r.school.coord = el.value;
    else if (d.r === 'center') r.center = el.value;
    else if (d.r === 'k') r.k = el.value;
    else if (d.spot) r.spots.find((s) => s.id === d.spot)[d.key] = el.value;
    else if (d.cal !== undefined && d.key === 'road') r.calib[Number(d.cal)].road = el.value;
    else return;
    App.save(); later();
  });

  root.addEventListener('change', (ev) => {
    const d = ev.target.dataset;
    if (d.cal !== undefined && (d.key === 'a' || d.key === 'b')) {
      App.camp().route.calib[Number(d.cal)][d.key] = ev.target.value;
      App.save(); render();
    }
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    const r = App.camp().route;
    if (el.id === 'addSpot') {
      if (r.spots.length >= 12) { alert('Ең көбі 12 нүкте.'); return; }
      r.spots.push({ id: App.S.uid(), name: '', coord: '' });
    } else if (el.dataset.delSpot) r.spots = r.spots.filter((s) => s.id !== el.dataset.delSpot);
    else if (el.id === 'addCal') r.calib.push({ a: 'school', b: 'center', road: '' });
    else if (el.dataset.delCal !== undefined) r.calib.splice(Number(el.dataset.delCal), 1);
    else return;
    App.save(); render();
  });

  window.addEventListener('resize', () => { if (!root.hidden) { const res = App.routeResult(); if (res.ready) drawMap(res); } });

  App.views.route = { title: 'Маршрут', render };
})();
