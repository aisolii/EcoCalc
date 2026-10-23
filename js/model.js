/*
 * EcoEsep — математикалық модель (DOM-сыз таза функциялар, tests/model.test.js арқылы тексеріледі).
 *
 * 1. Жинақталу моделі — дифференциалдық теңдеу:
 *      dm/dt = g(t)·(1 − m/M),   m(0) = m₀
 *    m — үйде жиналған шикізат, кг; g(t) — шикізаттың пайда болу жылдамдығы, кг/күн;
 *    M — сақтау орнының сыйымдылығы, кг. Сақтау орны толған сайын шикізаттың бір бөлігі
 *    жалпы қоқысқа кетеді: жоғалу ағыны g·m/M.
 *    g = const болғанда аналитикалық шешім: m(t) = M − (M − m₀)·e^(−g·t/M).
 *    Маусымдық g(t) = g₀·(1 + A·sin(2π(t + t₀)/365)) үшін — Рунге–Кутта 4-ретті сандық әдісі.
 *
 * 2. Оңтайлы өткізу аралығы — оңтайландыру есебі:
 *      J(T) = (p̄·m(T) − C) / T → max,   m(T) ≥ партия
 *    J — бір күнге шаққандағы орташа нәтиже, ₸/күн; p̄ — 1 кг жиналған шикізаттың орташа бағасы;
 *    C — бір сапардың жанармай шығыны. g = const үшін қажетті шарт J'(T) = 0:
 *      p̄·g·T·e^(−aT) = p̄·M·(1 − e^(−aT)) − C,   a = g/M.
 *
 * 3. Тәуекел — Монте-Карло әдісі: баға, масса, қашықтық, отын шығыны және жанармай бағасы
 *    кездейсоқ шамалар; B = R − C үлестірімі, P(B > 0), квантильдер, сезімталдық (Пирсон r).
 *
 * 4. Болжам — ең кіші квадраттар әдісі: m(t) = g·t + b, R², g үшін 95 % сенім аралығы.
 *
 * 5. Өткізу жоспары — дискретті оңтайландыру (2ⁿ ішкі жиынды толық іріктеу):
 *    әр материалды ең жоғары баға беретін пунктке бөліп, Σ R − Σ C максимумын табу.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EcoModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const YEAR = 365;

  // =====================================================================
  //  1. Жинақталу моделі
  // =====================================================================
  const genRate = (g0, A, t0) => (t) => g0 * (1 + A * Math.sin((2 * Math.PI * (t + t0)) / YEAR));

  /** g = const үшін аналитикалық шешім. */
  function analytic(g, M, m0, t) {
    if (!Number.isFinite(M)) return m0 + g * t;
    return M - (M - m0) * Math.exp((-g * t) / M);
  }

  /** Берілген массаға жету уақыты (g = const). Жетпейтін болса — Infinity. */
  function timeToReach(target, g, M, m0 = 0) {
    if (target <= m0) return 0;
    if (!(g > 0)) return Infinity;
    if (!Number.isFinite(M)) return (target - m0) / g;
    if (target >= M) return Infinity;
    return -(M / g) * Math.log((M - target) / (M - m0));
  }

  /**
   * Рунге–Кутта 4-ретті әдісі. Күй: [m, lost, gen] —
   * жиналған масса, қоқысқа кеткен масса, барлығы пайда болған масса.
   */
  function simulate({ g0, M, A = 0, t0 = 0, m0 = 0, days = YEAR, h = 0.25 }) {
    const g = genRate(g0, A, t0);
    const sat = (m) => (Number.isFinite(M) ? Math.min(1, Math.max(0, m / M)) : 0);
    const f = (t, y) => {
      const gt = Math.max(0, g(t));
      return [gt * (1 - sat(y[0])), gt * sat(y[0]), gt];
    };
    const steps = Math.round(days / h);
    const out = { t: [0], m: [m0], lost: [0], gen: [0], h };
    let y = [m0, 0, 0];
    for (let i = 0; i < steps; i++) {
      const t = i * h;
      const k1 = f(t, y);
      const k2 = f(t + h / 2, y.map((v, j) => v + (h / 2) * k1[j]));
      const k3 = f(t + h / 2, y.map((v, j) => v + (h / 2) * k2[j]));
      const k4 = f(t + h, y.map((v, j) => v + h * k3[j]));
      y = y.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      out.t.push(t + h);
      out.m.push(y[0]);
      out.lost.push(y[1]);
      out.gen.push(y[2]);
    }
    return out;
  }

  // =====================================================================
  //  2. Оңтайлы өткізу аралығы
  // =====================================================================
  /**
   * Әр цикл бос сақтау орнынан басталады деп, J(T) = (p̄·m(T) − C)/T функциясын
   * T ∈ [Tmin; Tmax] торында есептеп, максимумын табады.
   */
  function optimalInterval({ pbar, C, g0, M, A = 0, t0 = 0, minMass = 0, Tmin = 1, Tmax = YEAR, h = 0.25 }) {
    if (!(pbar > 0) || !(g0 > 0)) return null;
    const sim = simulate({ g0, M, A, t0, m0: 0, days: Tmax, h });
    let best = null;
    const curve = [];
    for (let i = 1; i < sim.t.length; i++) {
      const T = sim.t[i];
      if (T < Tmin) continue;
      const m = sim.m[i];
      const J = (pbar * m - C) / T;
      if (Math.abs(T - Math.round(T)) < 1e-9) curve.push({ T, J, m });
      if (m < minMass) continue;
      if (!best || J > best.J + 1e-12) {
        best = { T, J, m, lost: sim.lost[i], gen: sim.gen[i], tripResult: pbar * m - C };
      }
    }
    if (best) best.efficiency = best.gen > 0 ? best.m / best.gen : 1;
    return { best, curve, sim };
  }

  // =====================================================================
  //  3. Монте-Карло
  // =====================================================================
  /** Қайталанатын нәтиже беретін жалған кездейсоқ сандар генераторы (mulberry32). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normal(u1, u2, mean, sd) {
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(2 * Math.PI * u2);
    return mean + sd * z;
  }

  /** Үшбұрышты үлестірім (a — ең кіші, c — ең ықтимал, b — ең үлкен), кері функция әдісімен. */
  function triangular(u, a, c, b) {
    if (b <= a) return c;
    const fc = (c - a) / (b - a);
    return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
  }

  function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function pearson(xs, ys) {
    const n = xs.length;
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  /**
   * Бір сапардың нәтижесін Монте-Карло әдісімен модельдеу.
   * revenue — баға мен массаның номиналды мәніндегі түсім R₀; spreads — салыстырмалы ауытқулар (0,1 = 10 %).
   *   баға: үшбұрышты [1 − s; 1; 1 + s] (пункт бағалары бірге өзгереді);
   *   масса: қалыпты N(1; s) — таразы қателігі;
   *   қашықтық: қалыпты N(d; s·d) — маршрут таңдауы;
   *   отын шығыны: үшбұрышты [c(1 − s/2); c; c(1 + s)] — қалада шығын жиі артады;
   *   жанармай бағасы: қалыпты N(p; s·p).
   */
  function monteCarlo({ revenue, distanceKm, consumption, fuelPrice, spreads, n = 10000, seed = 42, bins = 30 }) {
    const r = rng(seed);
    const s = Object.assign({ price: 0, mass: 0, dist: 0, cons: 0, fuel: 0 }, spreads);
    const B = new Float64Array(n);
    const factors = { price: new Float64Array(n), mass: new Float64Array(n), dist: new Float64Array(n), cons: new Float64Array(n), fuel: new Float64Array(n) };
    for (let i = 0; i < n; i++) {
      const kp = triangular(r(), 1 - s.price, 1, 1 + s.price);
      const km = Math.max(0, normal(r(), r(), 1, s.mass));
      const d = Math.max(0, normal(r(), r(), distanceKm, s.dist * distanceKm));
      const c = triangular(r(), consumption * (1 - s.cons / 2), consumption, consumption * (1 + s.cons));
      const fp = Math.max(0, normal(r(), r(), fuelPrice, s.fuel * fuelPrice));
      B[i] = revenue * kp * km - (d * c * fp) / 100;
      factors.price[i] = kp; factors.mass[i] = km; factors.dist[i] = d; factors.cons[i] = c; factors.fuel[i] = fp;
    }
    const sorted = Array.from(B).sort((x, y) => x - y);
    let sum = 0, sum2 = 0, pos = 0;
    for (const b of sorted) { sum += b; sum2 += b * b; if (b > 0) pos++; }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));

    const lo = sorted[0], hi = sorted[n - 1];
    const width = hi > lo ? (hi - lo) / bins : 1;
    const hist = Array.from({ length: bins }, (_, k) => ({ x0: lo + k * width, x1: lo + (k + 1) * width, count: 0 }));
    for (const b of sorted) hist[Math.min(bins - 1, Math.floor((b - lo) / width))].count++;

    const Barr = Array.from(B);
    const sens = Object.keys(factors).map((key) => ({ key, r: pearson(Array.from(factors[key]), Barr) }));
    const total = sens.reduce((acc, x) => acc + x.r * x.r, 0);
    for (const x of sens) x.share = total > 0 ? (x.r * x.r) / total : 0;
    sens.sort((x, y) => y.share - x.share);

    return {
      n, mean, sd,
      p5: quantile(sorted, 0.05), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95),
      pPositive: pos / n,
      // Ықтималдық бағасының стандартты қателігі √(p(1−p)/n)
      pError: Math.sqrt(((pos / n) * (1 - pos / n)) / n),
      hist, sens
    };
  }

  // =====================================================================
  //  4. Ең кіші квадраттар әдісі
  // =====================================================================
  const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
    2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];

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
    const r2 = syy > 0 ? 1 - sse / syy : 1;
    const df = n - 2;
    const se = df > 0 ? Math.sqrt(sse / df / sxx) : null;
    const t = df > 0 ? (df <= 30 ? T95[df - 1] : 1.96) : null;
    return { n, slope, intercept, r2, se, ci95: se == null ? null : t * se };
  }

  // =====================================================================
  //  5. Өткізу жоспары (дискретті оңтайландыру)
  // =====================================================================
  /**
   * options: [{ pointId, cost, prices: {matId: ₸/кг | null}, minBatch: {matId: кг} }] — сапар құны белгілі пункттер.
   * Әр пунктке бөлек сапар деп есептеледі (шығынның жоғарғы бағасы).
   */
  function bestPlan(options, masses) {
    const mats = Object.keys(masses).filter((k) => Number(masses[k]) > 0);
    const n = Math.min(options.length, 12);
    let best = null;
    for (let mask = 1; mask < (1 << n); mask++) {
      const assignment = [];
      const used = new Set();
      let revenue = 0;
      for (const matId of mats) {
        const mass = Number(masses[matId]);
        let pick = null;
        for (let j = 0; j < n; j++) {
          if (!(mask & (1 << j))) continue;
          const o = options[j];
          const price = (o.prices || {})[matId];
          if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
          if (mass < (Number((o.minBatch || {})[matId]) || 0)) continue;
          if (!pick || price > pick.price) pick = { j, price };
        }
        if (pick) {
          used.add(pick.j);
          revenue += mass * pick.price;
          assignment.push({ matId, mass, pointId: options[pick.j].pointId, price: pick.price, revenue: mass * pick.price });
        }
      }
      if (used.size !== bitCount(mask)) continue; // пайдаланылмайтын пункті бар жиын кішірек жиынмен бірдей
      const cost = Array.from(used).reduce((acc, j) => acc + options[j].cost, 0);
      const result = revenue - cost;
      if (!best || result > best.result + 1e-9 || (Math.abs(result - best.result) < 1e-9 && used.size < best.pointIds.length)) {
        best = {
          result, revenue, cost, assignment,
          pointIds: Array.from(used).map((j) => options[j].pointId),
          unassigned: mats.filter((m) => !assignment.some((a) => a.matId === m))
        };
      }
    }
    return best;
  }

  function bitCount(x) {
    let c = 0;
    while (x) { c += x & 1; x >>>= 1; }
    return c;
  }

  return {
    analytic, timeToReach, simulate, optimalInterval,
    rng, triangular, monteCarlo, linreg, bestPlan
  };
});
