/*
 * EcoEsep — расчётное ядро.
 * Чистые функции без обращения к DOM, чтобы их можно было проверить тестами (tests/calc.test.js).
 *
 * Обозначения:
 *   R = Σ m_i · p_i          — выручка пункта (только принимаемые материалы с известной ценой)
 *   Q = d · c / 100          — расход топлива, л
 *   C = Q · p_fuel           — расходы на топливо, ₸
 *   B = R − C                — результат после расходов на топливо (НЕ чистая прибыль)
 *   m_min = max(C / p, партия) — масса материала, при которой выручка покрывает топливо
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EcoCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODES = { WALK: 'walk', SEPARATE: 'separate', ONWAY: 'onway' };

  // Статусы материала относительно пункта
  const STATUS = {
    OK: 'ok',                       // принимают, цена известна
    UNPRICED: 'unpriced',           // принимают, цена уточняется — в выручку не входит
    BELOW_MIN: 'below_min',         // масса меньше минимальной партии — сдать нельзя
    NOT_ACCEPTED: 'not_accepted'    // пункт не принимает
  };

  function isNum(x) {
    return typeof x === 'number' && Number.isFinite(x);
  }

  /** Проверка массы. Возвращает текст ошибки или null. */
  function validateMass(value) {
    if (value === '' || value === null || value === undefined) return null; // пусто = 0
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Введите число';
    if (n < 0) return 'Масса не может быть отрицательной';
    return null;
  }

  function validateNonNegative(value, label) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return `${label}: введите число`;
    if (n < 0) return `${label}: значение не может быть отрицательным`;
    return null;
  }

  function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /** Дополнительный пробег d, км, для выбранного способа доставки. */
  function tripDistance(mode, point) {
    if (mode === MODES.WALK) return 0;
    if (mode === MODES.SEPARATE) return 2 * toNum(point.oneWayKm); // туда и обратно
    if (mode === MODES.ONWAY) return toNum(point.detourKm);        // только прибавка к маршруту
    return 0;
  }

  /** Q = d·c/100, C = Q·p_fuel */
  function fuel(distanceKm, consumptionPer100, fuelPrice) {
    const liters = (toNum(distanceKm) * toNum(consumptionPer100)) / 100;
    return { liters, cost: liters * toNum(fuelPrice) };
  }

  /**
   * Порог накопления для одного материала.
   * Возвращает { kind, byFuel, byBatch, mMin, need }.
   *   kind: 'ok' | 'zero_price' | 'unknown_price'
   */
  function threshold(fuelCost, price, minBatch, currentMass) {
    const batch = toNum(minBatch);
    const mass = toNum(currentMass);
    if (price === null || price === undefined) {
      return { kind: 'unknown_price', byFuel: null, byBatch: batch, mMin: null, need: null };
    }
    if (!(price > 0)) {
      // Деление на ноль недопустимо: сдача не даёт денежной выручки.
      return { kind: 'zero_price', byFuel: null, byBatch: batch, mMin: null, need: null };
    }
    const byFuel = toNum(fuelCost) / price;
    const mMin = Math.max(byFuel, batch);
    return { kind: 'ok', byFuel, byBatch: batch, mMin, need: Math.max(0, mMin - mass) };
  }

  /**
   * Оценка одного пункта приёма.
   * @param point     { id, name, prices: {matId: number|null}, minBatch: {matId: kg}, oneWayKm, detourKm, ... }
   * @param masses    { matId: kg }
   * @param transport { mode, consumption, fuelPrice }
   * @param opts      { distanceKm } — переопределить пробег (для сравнения совместной сдачи)
   */
  function evaluatePoint(point, masses, transport, opts) {
    opts = opts || {};
    const prices = point.prices || {};
    const minBatch = point.minBatch || {};
    const items = [];
    let revenue = 0;

    for (const matId of Object.keys(masses)) {
      const mass = toNum(masses[matId]);
      if (!(mass > 0)) continue;
      const accepted = Object.prototype.hasOwnProperty.call(prices, matId);
      const price = accepted ? prices[matId] : undefined;
      const batch = toNum(minBatch[matId]);
      let status;
      let itemRevenue = 0;
      if (!accepted) status = STATUS.NOT_ACCEPTED;
      else if (batch > 0 && mass < batch) status = STATUS.BELOW_MIN;
      else if (!isNum(price)) status = STATUS.UNPRICED;
      else {
        status = STATUS.OK;
        itemRevenue = mass * price;
      }
      revenue += itemRevenue;
      items.push({ matId, mass, price: isNum(price) ? price : null, minBatch: batch, status, revenue: itemRevenue });
    }

    const distanceKm = isNum(opts.distanceKm) ? opts.distanceKm : tripDistance(transport.mode, point);
    const f = transport.mode === MODES.WALK && !isNum(opts.distanceKm)
      ? { liters: 0, cost: 0 }
      : fuel(distanceKm, transport.consumption, transport.fuelPrice);

    const result = revenue - f.cost;
    const by = (s) => items.filter((it) => it.status === s);
    const notAccepted = by(STATUS.NOT_ACCEPTED);
    const belowMin = by(STATUS.BELOW_MIN);
    const unpriced = by(STATUS.UNPRICED);
    const hasMass = items.length > 0;
    // «Весь набор» — каждый материал с массой > 0 пункт может принять сейчас
    const acceptsAll = hasMass && notAccepted.length === 0 && belowMin.length === 0;

    // Пороги по каждому принимаемому материалу
    const thresholds = Object.keys(prices).map((matId) => ({
      matId,
      ...threshold(f.cost, prices[matId], minBatch[matId], masses[matId])
    }));

    // Сколько нужно при той же пропорции материалов: k = C / R
    let scale = null;
    if (revenue > 0 && result < 0) scale = f.cost / revenue;

    return {
      pointId: point.id,
      items,
      revenue,
      distanceKm,
      liters: f.liters,
      fuelCost: f.cost,
      result,
      hasMass,
      acceptsAll,
      notAccepted,
      belowMin,
      unpriced,
      thresholds,
      scale
    };
  }

  /**
   * Сравнение пунктов. Возвращает оценки, отсортированные по итогу,
   * и отдельно — лучший пункт для ВСЕГО набора (только среди принимающих всё).
   */
  function comparePoints(points, masses, transport) {
    const evals = points.map((p) => evaluatePoint(p, masses, transport));
    const sorted = evals.slice().sort((a, b) => b.result - a.result);
    const full = sorted.filter((e) => e.acceptsAll);
    return {
      evals: sorted,
      bestFull: full.length ? full[0] : null,
      bestAny: sorted.length && sorted[0].hasMass ? sorted[0] : null
    };
  }

  /** Совет «сдать сейчас или накопить?» */
  function advice(ev, mode) {
    if (!ev || !ev.hasMass) return { tone: 'neutral', text: 'Введите массу накопленного вторсырья.' };
    if (mode === MODES.WALK) {
      return {
        tone: ev.revenue > 0 ? 'good' : 'neutral',
        text: 'Расходов на топливо нет, но затраты времени и сил программа не учитывает.'
      };
    }
    if (ev.result >= 0) {
      return { tone: 'good', text: 'При текущих условиях выручка покрывает расходы на топливо — сдавать сейчас можно.' };
    }
    return {
      tone: 'bad',
      text: 'При текущих условиях выручка не покрывает топливо для этой поездки. Можно накопить больше или совместить сдачу с другой поездкой.'
    };
  }

  /**
   * Совместная сдача: несколько отдельных поездок против одной общей.
   * participants: [{ name, masses, distanceKm }] — distanceKm: доп. пробег его отдельной поездки
   * jointDistanceKm: доп. пробег общей поездки с учётом объезда для сбора сырья
   */
  function compareJoint(point, participants, transport, jointDistanceKm) {
    const car = { mode: MODES.SEPARATE, consumption: transport.consumption, fuelPrice: transport.fuelPrice };
    const separate = participants.map((p) => ({
      name: p.name,
      ev: evaluatePoint(point, p.masses, car, { distanceKm: toNum(p.distanceKm) })
    }));
    const active = separate.filter((s) => s.ev.hasMass);
    const sepRevenue = active.reduce((s, x) => s + x.ev.revenue, 0);
    const sepFuel = active.reduce((s, x) => s + x.ev.fuelCost, 0);
    const sepDistance = active.reduce((s, x) => s + x.ev.distanceKm, 0);

    const total = sumMasses(participants.map((p) => p.masses));
    const joint = evaluatePoint(point, total, car, { distanceKm: toNum(jointDistanceKm) });

    return {
      separate,
      separateTotal: { revenue: sepRevenue, fuelCost: sepFuel, distanceKm: sepDistance, result: sepRevenue - sepFuel, trips: active.length },
      joint,
      gain: joint.result - (sepRevenue - sepFuel),
      totalMasses: total
    };
  }

  function sumMasses(list) {
    const out = {};
    for (const m of list) {
      for (const k of Object.keys(m || {})) out[k] = (out[k] || 0) + toNum(m[k]);
    }
    return out;
  }

  return {
    MODES, STATUS,
    validateMass, validateNonNegative,
    tripDistance, fuel, threshold,
    evaluatePoint, comparePoints, advice, compareJoint, sumMasses
  };
});
