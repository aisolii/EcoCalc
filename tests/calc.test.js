// Запуск: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const car = (km) => ({ mode: C.MODES.ONWAY, consumption: 10, fuelPrice: 300 });
const point = (extra) => ({ id: 'a', prices: { paper: 40 }, minBatch: {}, oneWayKm: 5, detourKm: 10, ...extra });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('Пример из работы (условные данные): 5 кг × 40 ₸, 10 км, 10 л/100 км, 300 ₸/л', () => {
  const ev = C.evaluatePoint(point(), { paper: 5 }, car());
  close(ev.revenue, 200);
  close(ev.liters, 1);
  close(ev.fuelCost, 300);
  close(ev.result, -100);
  const th = ev.thresholds.find((t) => t.matId === 'paper');
  close(th.mMin, 7.5);
  close(th.need, 2.5);
});

test('Отдельная поездка = путь туда и обратно', () => {
  const ev = C.evaluatePoint(point(), { paper: 5 }, { mode: C.MODES.SEPARATE, consumption: 10, fuelPrice: 300 });
  close(ev.distanceKm, 10); // 2 × 5 км
  close(ev.fuelCost, 300);
});

test('Пешком: топливо 0, выручка без вычетов', () => {
  const ev = C.evaluatePoint(point(), { paper: 5 }, { mode: C.MODES.WALK, consumption: 10, fuelPrice: 300 });
  close(ev.fuelCost, 0);
  close(ev.result, 200);
});

test('Масса равна нулю → выручка равна нулю', () => {
  const ev = C.evaluatePoint(point(), { paper: 0 }, car());
  close(ev.revenue, 0);
  assert.equal(ev.hasMass, false);
});

test('Отрицательная масса → сообщение об ошибке', () => {
  assert.equal(C.validateMass(-3), 'Масса не может быть отрицательной');
  assert.equal(C.validateMass('abc'), 'Введите число');
  assert.equal(C.validateMass(4), null);
  assert.equal(C.validateMass(''), null);
});

test('Материал не принимают → не входит в выручку, показан отдельно', () => {
  const ev = C.evaluatePoint(point(), { paper: 5, glass: 20 }, car());
  close(ev.revenue, 200);
  assert.deepEqual(ev.notAccepted.map((i) => i.matId), ['glass']);
  assert.equal(ev.acceptsAll, false);
});

test('Расстояние равно нулю → расход топлива равен нулю', () => {
  const ev = C.evaluatePoint(point({ detourKm: 0 }), { paper: 5 }, car());
  close(ev.liters, 0);
  close(ev.fuelCost, 0);
});

test('Цена не подтверждена / уточняется → предупреждение, в выручку не входит', () => {
  const ev = C.evaluatePoint(point({ prices: { paper: 40, pet: null }, confirmed: false }), { paper: 5, pet: 3 }, car());
  close(ev.revenue, 200);
  assert.deepEqual(ev.unpriced.map((i) => i.matId), ['pet']);
  assert.equal(ev.acceptsAll, true); // принять могут, неизвестна только цена
});

test('Выручка меньше топлива → отрицательный результат (не ноль)', () => {
  const ev = C.evaluatePoint(point(), { paper: 1 }, car());
  close(ev.result, 40 - 300);
  assert.ok(ev.result < 0);
});

test('Масса ниже минимальной партии → нельзя сдать, нет выручки', () => {
  const ev = C.evaluatePoint(point({ minBatch: { paper: 10 } }), { paper: 5 }, car());
  close(ev.revenue, 0);
  assert.deepEqual(ev.belowMin.map((i) => i.matId), ['paper']);
  const th = ev.thresholds.find((t) => t.matId === 'paper');
  close(th.mMin, 10); // партия 10 кг больше порога по топливу 7,5 кг
});

test('Нулевая цена → без деления на ноль', () => {
  const th = C.threshold(300, 0, 0, 5);
  assert.equal(th.kind, 'zero_price');
  assert.equal(th.mMin, null);
});

test('Сравнение: лучший «для всего набора» только среди принимающих всё', () => {
  const pts = [
    { id: 'part', prices: { paper: 100 }, minBatch: {}, detourKm: 0 },
    { id: 'full', prices: { paper: 40, glass: 5 }, minBatch: {}, detourKm: 10 }
  ];
  const r = C.comparePoints(pts, { paper: 5, glass: 10 }, car());
  assert.equal(r.bestAny.pointId, 'part');
  assert.equal(r.bestFull.pointId, 'full');
});

test('Совместная сдача: две поездки против одной с объездом', () => {
  const p = point();
  const people = [
    { name: 'Семья 1', masses: { paper: 5 }, distanceKm: 10 },
    { name: 'Семья 2', masses: { paper: 5 }, distanceKm: 10 }
  ];
  const r = C.compareJoint(p, people, { consumption: 10, fuelPrice: 300 }, 14);
  close(r.separateTotal.result, 2 * (200 - 300)); // −200
  close(r.joint.revenue, 400);
  close(r.joint.fuelCost, 14 * 10 / 100 * 300);  // 420
  close(r.joint.result, -20);
  close(r.gain, 180);
});

test('Совместная сдача помогает набрать минимальную партию', () => {
  const p = point({ minBatch: { paper: 8 } });
  const people = [
    { name: 'A', masses: { paper: 5 }, distanceKm: 10 },
    { name: 'B', masses: { paper: 5 }, distanceKm: 10 }
  ];
  const r = C.compareJoint(p, people, { consumption: 10, fuelPrice: 300 }, 12);
  close(r.separateTotal.revenue, 0);
  close(r.joint.revenue, 400);
});
