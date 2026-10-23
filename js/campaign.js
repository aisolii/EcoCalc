/*
 * EcoEsep — мектеп эко-акциясының математикалық ядросы (DOM-сыз, tests/campaign.test.js арқылы тексеріледі).
 *
 * 1. Деректер: Google Forms кестесінен (CSV) немесе қолмен енгізілген апталық өлшемдер.
 *    Әр жазба — отбасының үйде жиналған шикізатының ЖИЫНТЫҚ массасы (кг) берілген күні.
 * 2. Әр отбасы үшін ең кіші квадраттар әдісі: mᵢ(t) = bᵢ + gᵢ·t.
 * 3. Сынып болжамы: M(t) = Σ(bᵢ + gᵢ·t), болжам аралығы — тәуелсіз қателер дисперсияларының қосындысы.
 * 4. Модельді тексеру: соңғы өлшемді алып тастап, қалғанымен болжау (hold-out), аңғал модельмен салыстыру.
 * 5. Жинау күнін оңтайландыру: сатылы баға p(m), көлік сыйымдылығы Q, сапар саны ⌈m/Q⌉.
 * 6. Маршрут: гаверсинус арақашықтығы × k (k — жол коэффициенті, ЕКК арқылы калибрленеді),
 *    коммивояжер есебі Хелд–Карп динамикалық бағдарламалау әдісімен (дәл шешім).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EcoCampaign = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 864e5;
  const CO2_PER_LITER = 2.35; // кг CO₂ / 1 л бензин (US EPA: 8 887 г/галлон)
  const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
    2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  const tcrit = (df) => (df >= 1 ? (df <= 30 ? T95[df - 1] : 1.96) : null);

  const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const dayIndex = (date, start) => Math.round((Date.parse(date) - Date.parse(start)) / DAY);

  // =====================================================================
  //  1. CSV (Google Forms / Sheets)
  // =====================================================================
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
  }

  // Бағандарды тақырыптағы кілт сөздер бойынша табу (қазақша, орысша)
  const COLUMN_KEYS = {
    code: ['код', 'code', 'отбасы', 'семья'],
    date: ['өлшеу күні', 'күні', 'дата', 'date'],
    spot: ['нүкте', 'точка', 'spot'],
    paper: ['макулатура', 'қағаз', 'бумага', 'paper'],
    cardboard: ['картон'],
    pet: ['пэт', 'pet', 'бөтелке', 'бутыл'],
    hdpe: ['пнд', 'hdpe', 'канистр'],
    film: ['үлдір', 'пленк', 'плёнк', 'полиэтилен'],
    alu: ['алюмин', 'банка'],
    glass: ['шыны', 'стекл', 'glass']
  };

  function normDate(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  /** CSV жолдарынан өлшемдер: [{ code, date, spot, masses: {matId: кг} }]. */
  function entriesFromRows(rows, materialIds) {
    if (rows.length < 2) return { entries: [], columns: {}, skipped: 0 };
    const head = rows[0].map((h) => h.toLowerCase());
    const find = (keys, exclude = []) => head.findIndex((h, i) => !exclude.includes(i) && keys.some((k) => h.includes(k)));
    const columns = {};
    columns.code = find(COLUMN_KEYS.code);
    columns.date = find(COLUMN_KEYS.date, [columns.code]);
    if (columns.date < 0) columns.date = head.findIndex((h) => h.includes('timestamp') || h.includes('отметка'));
    columns.spot = find(COLUMN_KEYS.spot, [columns.code, columns.date]);
    const used = [columns.code, columns.date, columns.spot];
    for (const id of materialIds) {
      if (!COLUMN_KEYS[id]) continue;
      const idx = find(COLUMN_KEYS[id], used);
      if (idx >= 0) { columns[id] = idx; used.push(idx); }
    }
    const entries = [];
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const code = (r[columns.code] || '').trim().toUpperCase();
      const date = normDate(r[columns.date]);
      if (!code || !date) { skipped++; continue; }
      const masses = {};
      for (const id of materialIds) if (columns[id] >= 0 && columns[id] !== undefined) masses[id] = num(r[columns[id]]);
      entries.push({ code, date, spot: columns.spot >= 0 ? (r[columns.spot] || '').trim() : '', masses });
    }
    return { entries, columns, skipped };
  }

  // =====================================================================
  //  2. Регрессия
  // =====================================================================
  function linreg(points) {
    const n = points.length;
    if (n < 2) return null;
    let mx = 0, my = 0;
    for (const p of points) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    let sse = 0;
    for (const p of points) sse += (p.y - (slope * p.x + intercept)) ** 2;
    const df = n - 2;
    const s2 = df > 0 ? sse / df : 0;
    return {
      n, slope, intercept, mx, sxx, s2,
      r2: syy > 0 ? 1 - sse / syy : 1,
      se: df > 0 ? Math.sqrt(s2 / sxx) : null,
      ci95: df > 0 ? tcrit(df) * Math.sqrt(s2 / sxx) : null
    };
  }

  const total = (masses) => Object.values(masses || {}).reduce((s, v) => s + num(v), 0);

  /** Отбасылар бойынша топтау; t — акция басталғаннан бергі күн. Бір күнгі қайталанған жазбаның соңғысы алынады. */
  function byFamily(entries, start) {
    const map = new Map();
    for (const e of entries) {
      const t = dayIndex(e.date, start);
      if (!map.has(e.code)) map.set(e.code, new Map());
      map.get(e.code).set(t, { t, y: total(e.masses), masses: e.masses, spot: e.spot });
    }
    const out = [];
    for (const [code, days] of map) {
      const pts = Array.from(days.values()).sort((a, b) => a.t - b.t);
      out.push({ code, pts, spot: (pts.filter((p) => p.spot).pop() || {}).spot || '' });
    }
    return out.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Әр отбасының жиналу жылдамдығы. Өлшемі 2-ден аз отбасыға сыныптың медианалық жылдамдығы беріледі
   * (ақпаратты біріктіру — pooling), сонда болжам барлық қатысушыны қамтиды.
   */
  function familyFits(entries, start) {
    const fams = byFamily(entries, start);
    for (const f of fams) f.fit = linreg(f.pts.map((p) => ({ x: p.t, y: p.y })));
    const slopes = fams.filter((f) => f.fit).map((f) => f.fit.slope).sort((a, b) => a - b);
    const median = slopes.length ? slopes[Math.floor((slopes.length - 1) / 2)] * 0.5 + slopes[Math.ceil((slopes.length - 1) / 2)] * 0.5 : 0;
    for (const f of fams) {
      if (!f.fit) {
        const last = f.pts[f.pts.length - 1];
        f.pooled = true;
        f.fit = { n: f.pts.length, slope: median, intercept: last.y - median * last.t, r2: null, se: null, s2: 0, mx: last.t, sxx: 0 };
      }
    }
    return { fams, median };
  }

  /** Сыныптың болжамы M(t) және 95 % болжам аралығы. */
  function forecast(fits, t) {
    let mean = 0, varSum = 0;
    for (const f of fits.fams) {
      const r = f.fit;
      mean += Math.max(0, r.intercept + r.slope * t);
      if (r.sxx > 0 && r.n > 2) varSum += r.s2 * (1 + 1 / r.n + (t - r.mx) ** 2 / r.sxx);
    }
    const sd = Math.sqrt(varSum);
    return { mean, lo: Math.max(0, mean - 1.96 * sd), hi: mean + 1.96 * sd, sd };
  }

  /** Материалдар бойынша үлес (соңғы өлшемдер бойынша) — болжамды материалдарға бөлу үшін. */
  function composition(fits, materialIds) {
    const sum = {};
    let all = 0;
    for (const f of fits.fams) {
      const last = f.pts[f.pts.length - 1];
      for (const id of materialIds) { const v = num(last.masses[id]); sum[id] = (sum[id] || 0) + v; all += v; }
    }
    const share = {};
    for (const id of materialIds) share[id] = all > 0 ? (sum[id] || 0) / all : 0;
    return { share, kg: sum, total: all };
  }

  /** Бутстрэп: орташа жылдамдықтың 95 % сенім аралығы (отбасыларды қайталап іріктеу). */
  function bootstrapMean(values, B = 2000, seed = 7) {
    if (values.length < 2) return null;
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const means = [];
    for (let b = 0; b < B; b++) {
      let s = 0;
      for (let i = 0; i < values.length; i++) s += values[Math.floor(r() * values.length)];
      means.push(s / values.length);
    }
    means.sort((x, y) => x - y);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return { mean, lo: means[Math.floor(0.025 * B)], hi: means[Math.floor(0.975 * B)] };
  }

  // =====================================================================
  //  3. Модельді тексеру (hold-out)
  // =====================================================================
  /**
   * Әр отбасының СОҢҒЫ өлшемін жасырып, қалған өлшемдер бойынша болжаймыз.
   * Салыстыру: аңғал модель «масса өзгермейді» (соңғы белгілі мән).
   */
  function validate(entries, start) {
    const fams = byFamily(entries, start).filter((f) => f.pts.length >= 3);
    const rows = [];
    let sumPred = 0, sumNaive = 0, sumActual = 0;
    for (const f of fams) {
      const train = f.pts.slice(0, -1);
      const test = f.pts[f.pts.length - 1];
      const fit = linreg(train.map((p) => ({ x: p.t, y: p.y })));
      if (!fit) continue;
      const pred = Math.max(0, fit.intercept + fit.slope * test.t);
      const naive = train[train.length - 1].y;
      rows.push({ code: f.code, t: test.t, actual: test.y, pred, naive });
      sumPred += pred; sumNaive += naive; sumActual += test.y;
    }
    if (!rows.length) return null;
    const mae = (key) => rows.reduce((s, r) => s + Math.abs(r[key] - r.actual), 0) / rows.length;
    return {
      rows,
      maeModel: mae('pred'),
      maeNaive: mae('naive'),
      totalActual: sumActual,
      totalPred: sumPred,
      totalNaive: sumNaive,
      errModel: sumActual > 0 ? Math.abs(sumPred - sumActual) / sumActual : null,
      errNaive: sumActual > 0 ? Math.abs(sumNaive - sumActual) / sumActual : null
    };
  }

  // =====================================================================
  //  4. Жинау күнін оңтайландыру
  // =====================================================================
  /** Сатылы баға: tiers = [{ min: кг, price: ₸/кг }]; m ≥ min болатын ең үлкен саты. */
  function tierPrice(tiers, m) {
    if (!Array.isArray(tiers) || !tiers.length) return null;
    let p = null;
    for (const t of tiers.slice().sort((a, b) => a.min - b.min)) if (m >= t.min) p = t.price;
    return p; // ең төменгі сатыдан аз болса — null (пункт қабылдамайды)
  }

  /**
   * Күндер бойынша жоспар. Әр T күн үшін: болжамды масса (материалдар бойынша), түсім, сапар саны, нәтиже.
   * massAt(t) → {matId: кг}; tiers: {matId: [{min, price}]}; Q — көліктің бір сапардағы сыйымдылығы; tripCost — бір сапар.
   */
  function planByDay({ massAt, tiers, capacity, tripCost, fromDay, toDay, startDay = 0 }) {
    const days = [];
    for (let t = fromDay; t <= toDay; t++) {
      const m = massAt(t);
      let revenue = 0, mass = 0;
      const items = {};
      for (const id of Object.keys(m)) {
        const kg = m[id];
        mass += kg;
        const p = tierPrice(tiers[id], kg);
        items[id] = { kg, price: p, revenue: p ? kg * p : 0 };
        revenue += items[id].revenue;
      }
      const trips = mass > 0 ? Math.ceil(mass / Math.max(1, capacity)) : 0;
      const cost = trips * tripCost;
      const profit = revenue - cost;
      const span = Math.max(1, t - startDay);
      days.push({ t, mass, revenue, trips, cost, profit, perDay: profit / span, items });
    }
    const bestTotal = days.reduce((b, d) => (!b || d.profit > b.profit + 1e-9 ? d : b), null);
    const bestRate = days.reduce((b, d) => (!b || d.perDay > b.perDay + 1e-9 ? d : b), null);
    const breakEven = days.find((d) => d.profit > 0) || null;
    return { days, bestTotal, bestRate, breakEven };
  }

  // =====================================================================
  //  5. Маршрут
  // =====================================================================
  function haversine(a, b) {
    const R = 6371;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Жол коэффициенті k: жол = k · түзу арақашықтық, бас нүкте арқылы өтетін түзу бойынша ЕКК. */
  function calibrateK(pairs) {
    const ok = pairs.filter((p) => p.straight > 0 && p.road > 0);
    if (!ok.length) return null;
    const sxy = ok.reduce((s, p) => s + p.straight * p.road, 0);
    const sxx = ok.reduce((s, p) => s + p.straight * p.straight, 0);
    const k = sxy / sxx;
    const mean = ok.reduce((s, p) => s + p.road, 0) / ok.length;
    const sse = ok.reduce((s, p) => s + (p.road - k * p.straight) ** 2, 0);
    const sst = ok.reduce((s, p) => s + (p.road - mean) ** 2, 0);
    return { k, n: ok.length, r2: sst > 0 ? 1 - sse / sst : 1, mape: ok.reduce((s, p) => s + Math.abs(p.road - k * p.straight) / p.road, 0) / ok.length };
  }

  /**
   * Хелд–Карп: start-тан шығып, барлық аралық нүктелерді бір реттен аралап, end-те аяқталатын ең қысқа жол.
   * D — арақашықтық матрицасы; 0 — бастау, n−1 — соңы, 1..n−2 — аралық нүктелер. Күрделілігі O(n²·2ⁿ).
   */
  function heldKarp(D) {
    const n = D.length;
    const k = n - 2; // аралық нүктелер саны
    if (k <= 0) return { order: [0, n - 1], length: D[0][n - 1] };
    const FULL = 1 << k;
    const dp = Array.from({ length: FULL }, () => new Float64Array(k).fill(Infinity));
    const parent = Array.from({ length: FULL }, () => new Int16Array(k).fill(-1));
    for (let j = 0; j < k; j++) dp[1 << j][j] = D[0][j + 1];
    for (let S = 1; S < FULL; S++) {
      for (let j = 0; j < k; j++) {
        if (!(S & (1 << j)) || dp[S][j] === Infinity) continue;
        for (let x = 0; x < k; x++) {
          if (S & (1 << x)) continue;
          const S2 = S | (1 << x);
          const v = dp[S][j] + D[j + 1][x + 1];
          if (v < dp[S2][x]) { dp[S2][x] = v; parent[S2][x] = j; }
        }
      }
    }
    let best = Infinity, last = -1;
    for (let j = 0; j < k; j++) {
      const v = dp[FULL - 1][j] + D[j + 1][n - 1];
      if (v < best) { best = v; last = j; }
    }
    const order = [n - 1];
    let S = FULL - 1, j = last;
    while (j >= 0) { order.push(j + 1); const pj = parent[S][j]; S ^= 1 << j; j = pj; }
    order.push(0);
    return { order: order.reverse(), length: best };
  }

  /** Маршруттың арақашықтық матрицасы: places = [{lat, lng}], k — жол коэффициенті. */
  function distanceMatrix(places, k) {
    return places.map((a) => places.map((b) => (a === b ? 0 : haversine(a, b) * k)));
  }

  const fuelOf = (km, consumption) => (km * consumption) / 100;

  return {
    CO2_PER_LITER, parseCSV, entriesFromRows, normDate, linreg, byFamily, familyFits, forecast,
    composition, bootstrapMean, validate, tierPrice, planByDay, haversine, calibrateK, heldKarp,
    distanceMatrix, fuelOf, dayIndex, total
  };
});
