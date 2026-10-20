/*
 * EcoEsep — есептеу ядросы.
 * DOM-ға тәуелсіз таза функциялар: оларды tests/calc.test.js арқылы тексеруге болады.
 *
 * Белгілеулер:
 *   R = Σ mᵢ·pᵢ               — пункттің түсімі (тек қабылданатын, бағасы белгілі материалдар)
 *   Q = d·c / 100             — отын шығыны, л
 *   C = Q·p_ж                 — жанармай шығыны, ₸
 *   B = R − C                 — жанармай шығынын шегергендегі нәтиже (таза пайда ЕМЕС)
 *   m_min = max(C / p; партия) — түсім жанармайды өтейтін масса
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EcoCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODES = { WALK: 'walk', SEPARATE: 'separate', ONWAY: 'onway' };

  // Материалдың пунктке қатысты күйі
  const STATUS = {
    OK: 'ok',                    // қабылданады, бағасы белгілі
    UNPRICED: 'unpriced',        // қабылданады, бағасы нақтыланбаған — түсімге кірмейді
    BELOW_MIN: 'below_min',      // масса ең аз партиядан кем — өткізу мүмкін емес
    NOT_ACCEPTED: 'not_accepted' // пункт қабылдамайды
  };

  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
  const isEmpty = (v) => v === '' || v === null || v === undefined;

  function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /** Массаны тексеру. Қате мәтінін немесе null қайтарады. Бос өріс = 0. */
  function validateMass(value) {
    if (isEmpty(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Сан енгізіңіз';
    if (n < 0) return 'Масса теріс бола алмайды';
    return null;
  }

  function validateNonNegative(value, label) {
    if (isEmpty(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return `${label}: сан енгізіңіз`;
    if (n < 0) return `${label}: мәні теріс бола алмайды`;
    return null;
  }

  /** Жеткізу тәсіліне сәйкес қосымша жүріс d, км. */
  function tripDistance(mode, point) {
    if (mode === MODES.SEPARATE) return 2 * toNum(point.oneWayKm); // бару-қайту
    if (mode === MODES.ONWAY) return toNum(point.detourKm);        // бағытқа қосымша жол ғана
    return 0;
  }

  function fuel(distanceKm, consumptionPer100, fuelPrice) {
    const liters = (toNum(distanceKm) * toNum(consumptionPer100)) / 100;
    return { liters, cost: liters * toNum(fuelPrice) };
  }

  /**
   * Бір материал бойынша жинақтау шегі.
   * kind: 'ok' | 'zero_price' (нөлге бөлуге болмайды) | 'unknown_price'
   */
  function threshold(fuelCost, price, minBatch, currentMass) {
    const batch = toNum(minBatch);
    if (!isNum(price)) return { kind: 'unknown_price', byFuel: null, byBatch: batch, mMin: null, need: null };
    if (!(price > 0)) return { kind: 'zero_price', byFuel: null, byBatch: batch, mMin: null, need: null };
    const byFuel = toNum(fuelCost) / price;
    const mMin = Math.max(byFuel, batch);
    return { kind: 'ok', byFuel, byBatch: batch, mMin, need: Math.max(0, mMin - toNum(currentMass)) };
  }

  function classify(mass, prices, minBatch, matId) {
    if (!Object.prototype.hasOwnProperty.call(prices, matId)) return STATUS.NOT_ACCEPTED;
    const batch = toNum(minBatch[matId]);
    if (batch > 0 && mass < batch) return STATUS.BELOW_MIN;
    return isNum(prices[matId]) ? STATUS.OK : STATUS.UNPRICED;
  }

  /**
   * Бір қабылдау пунктін бағалау.
   * point:     { id, prices: {matId: ₸/кг | null}, minBatch: {matId: кг}, oneWayKm, detourKm }
   * masses:    { matId: кг }
   * transport: { mode, consumption, fuelPrice }
   * opts.distanceKm — жүрісті тікелей беру (бірлесіп өткізуді салыстыру үшін)
   */
  function evaluatePoint(point, masses, transport, opts = {}) {
    const prices = point.prices || {};
    const minBatch = point.minBatch || {};
    const items = [];

    for (const matId of Object.keys(masses)) {
      const mass = toNum(masses[matId]);
      if (!(mass > 0)) continue;
      const status = classify(mass, prices, minBatch, matId);
      const price = isNum(prices[matId]) ? prices[matId] : null;
      items.push({
        matId, mass, price, status,
        minBatch: toNum(minBatch[matId]),
        revenue: status === STATUS.OK ? mass * price : 0
      });
    }

    const revenue = items.reduce((s, it) => s + it.revenue, 0);
    const fixedDistance = isNum(opts.distanceKm);
    const distanceKm = fixedDistance ? opts.distanceKm : tripDistance(transport.mode, point);
    const f = transport.mode === MODES.WALK && !fixedDistance
      ? { liters: 0, cost: 0 }
      : fuel(distanceKm, transport.consumption, transport.fuelPrice);
    const result = revenue - f.cost;

    const by = (s) => items.filter((it) => it.status === s);
    const notAccepted = by(STATUS.NOT_ACCEPTED);
    const belowMin = by(STATUS.BELOW_MIN);
    const hasMass = items.length > 0;

    return {
      pointId: point.id,
      items,
      revenue,
      distanceKm,
      liters: f.liters,
      fuelCost: f.cost,
      result,
      hasMass,
      // «Барлық жиынтық» — массасы бар әр материалды пункт дәл қазір қабылдай алады
      acceptsAll: hasMass && notAccepted.length === 0 && belowMin.length === 0,
      notAccepted,
      belowMin,
      unpriced: by(STATUS.UNPRICED),
      thresholds: Object.keys(prices).map((matId) => ({
        matId, ...threshold(f.cost, prices[matId], minBatch[matId], masses[matId])
      })),
      // Материалдардың осы арақатынасында қанша есе көп керек: k = C / R
      scale: revenue > 0 && result < 0 ? f.cost / revenue : null
    };
  }

  /** Пункттерді нәтиже бойынша сұрыптайды; «ең тиімдісі» тек бәрін қабылдайтындар арасынан. */
  function comparePoints(points, masses, transport) {
    const evals = points.map((p) => evaluatePoint(p, masses, transport))
      .sort((a, b) => b.result - a.result);
    return {
      evals,
      bestFull: evals.find((e) => e.acceptsAll) || null,
      bestAny: evals.length && evals[0].hasMass ? evals[0] : null
    };
  }

  /** «Қазір өткізу ме, әлде жинай беру ме?» — кодты қайтарады, мәтінді интерфейс таңдайды. */
  function advice(ev, mode) {
    if (!ev || !ev.hasMass) return { tone: 'neutral', code: 'no_mass' };
    if (mode === MODES.WALK) return { tone: 'neutral', code: 'walk' };
    return ev.result >= 0 ? { tone: 'good', code: 'covers' } : { tone: 'bad', code: 'not_covers' };
  }

  /**
   * Бірлесіп өткізу: бірнеше жеке сапар мен бір ортақ сапар.
   * participants: [{ name, masses, distanceKm }] — distanceKm: қатысушының жеке сапарындағы жүріс
   * jointDistanceKm: шикізат жинауға айналып өтуді қоса алғандағы ортақ сапар жүрісі
   */
  function compareJoint(point, participants, transport, jointDistanceKm) {
    const car = { mode: MODES.SEPARATE, consumption: transport.consumption, fuelPrice: transport.fuelPrice };
    const separate = participants.map((p) => ({
      name: p.name,
      ev: evaluatePoint(point, p.masses, car, { distanceKm: toNum(p.distanceKm) })
    }));
    const active = separate.filter((s) => s.ev.hasMass);
    const sum = (key) => active.reduce((s, x) => s + x.ev[key], 0);
    const separateTotal = {
      revenue: sum('revenue'),
      fuelCost: sum('fuelCost'),
      distanceKm: sum('distanceKm'),
      trips: active.length
    };
    separateTotal.result = separateTotal.revenue - separateTotal.fuelCost;

    const totalMasses = sumMasses(participants.map((p) => p.masses));
    const joint = evaluatePoint(point, totalMasses, car, { distanceKm: toNum(jointDistanceKm) });

    return { separate, separateTotal, joint, gain: joint.result - separateTotal.result, totalMasses };
  }

  function sumMasses(list) {
    const out = {};
    for (const m of list) {
      for (const k of Object.keys(m || {})) out[k] = (out[k] || 0) + toNum(m[k]);
    }
    return out;
  }

  /** Болжам мен нақты төлемді салыстыру (пилоттық тексеру журналы). */
  function forecastError(records) {
    const done = records.filter((r) => !isEmpty(r.actualPayment) && Number.isFinite(Number(r.actualPayment)));
    if (!done.length) return { n: 0, mae: null, mape: null };
    const abs = done.map((r) => Math.abs(Number(r.actualPayment) - r.predictedRevenue));
    const rel = done.filter((r) => Number(r.actualPayment) > 0)
      .map((r) => Math.abs(Number(r.actualPayment) - r.predictedRevenue) / Number(r.actualPayment));
    return {
      n: done.length,
      mae: abs.reduce((s, x) => s + x, 0) / done.length,
      mape: rel.length ? (rel.reduce((s, x) => s + x, 0) / rel.length) * 100 : null
    };
  }

  return {
    MODES, STATUS,
    validateMass, validateNonNegative,
    tripDistance, fuel, threshold,
    evaluatePoint, comparePoints, advice, compareJoint, sumMasses, forecastError
  };
});
