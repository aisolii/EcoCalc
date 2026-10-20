// Іске қосу: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const car = { mode: C.MODES.ONWAY, consumption: 10, fuelPrice: 300 };
const point = (extra) => ({ id: 'a', prices: { paper: 40 }, minBatch: {}, oneWayKm: 5, detourKm: 10, ...extra });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('1. Оқу мысалы (шартты деректер): 5 кг × 40 ₸, 10 км, 10 л/100 км, 300 ₸/л', () => {
  const ev = C.evaluatePoint(point(), { paper: 5 }, car);
  close(ev.revenue, 200);
  close(ev.liters, 1);
  close(ev.fuelCost, 300);
  close(ev.result, -100);
  const th = ev.thresholds.find((t) => t.matId === 'paper');
  close(th.mMin, 7.5);
  close(th.need, 2.5);
});

test('2. Жеке сапар — бару-қайту жолы', () => {
  const ev = C.evaluatePoint(point(), { paper: 5 }, { ...car, mode: C.MODES.SEPARATE });
  close(ev.distanceKm, 10); // 2 × 5 км
  close(ev.fuelCost, 300);
});

test('3. Жаяу: жанармай 0, түсім шегерімсіз', () => {
  const ev = C.evaluatePoint(point(), { paper: 5 }, { ...car, mode: C.MODES.WALK });
  close(ev.fuelCost, 0);
  close(ev.result, 200);
  assert.equal(C.advice(ev, C.MODES.WALK).code, 'walk');
});

test('4. Масса нөлге тең → түсім нөлге тең', () => {
  const ev = C.evaluatePoint(point(), { paper: 0 }, car);
  close(ev.revenue, 0);
  assert.equal(ev.hasMass, false);
});

test('5. Теріс масса → қате туралы хабар', () => {
  assert.equal(C.validateMass(-3), 'Масса теріс бола алмайды');
  assert.equal(C.validateMass('abc'), 'Сан енгізіңіз');
  assert.equal(C.validateMass(4), null);
  assert.equal(C.validateMass(''), null);
});

test('6. Материал қабылданбайды → түсімге кірмейді, бөлек көрсетіледі', () => {
  const ev = C.evaluatePoint(point(), { paper: 5, glass: 20 }, car);
  close(ev.revenue, 200);
  assert.deepEqual(ev.notAccepted.map((i) => i.matId), ['glass']);
  assert.equal(ev.acceptsAll, false);
});

test('7. Қашықтық нөлге тең → отын шығыны нөлге тең', () => {
  const ev = C.evaluatePoint(point({ detourKm: 0 }), { paper: 5 }, car);
  close(ev.liters, 0);
  close(ev.fuelCost, 0);
});

test('8. Баға нақтыланбаған → түсімге кірмейді, ескерту шығады', () => {
  const ev = C.evaluatePoint(point({ prices: { paper: 40, pet: null }, confirmed: false }), { paper: 5, pet: 3 }, car);
  close(ev.revenue, 200);
  assert.deepEqual(ev.unpriced.map((i) => i.matId), ['pet']);
  assert.equal(ev.acceptsAll, true); // қабылдайды, тек бағасы белгісіз
});

test('9. Түсім жанармайдан аз → нәтиже теріс (нөлмен алмастырылмайды)', () => {
  const ev = C.evaluatePoint(point(), { paper: 1 }, car);
  close(ev.result, 40 - 300);
  assert.equal(C.advice(ev, car.mode).code, 'not_covers');
});

test('10. Масса ең аз партиядан кем → өткізу мүмкін емес, түсім жоқ', () => {
  const ev = C.evaluatePoint(point({ minBatch: { paper: 10 } }), { paper: 5 }, car);
  close(ev.revenue, 0);
  assert.deepEqual(ev.belowMin.map((i) => i.matId), ['paper']);
  close(ev.thresholds.find((t) => t.matId === 'paper').mMin, 10); // партия 10 кг > жанармай шегі 7,5 кг
});

test('11. Баға нөлге тең → нөлге бөлу жоқ', () => {
  const th = C.threshold(300, 0, 0, 5);
  assert.equal(th.kind, 'zero_price');
  assert.equal(th.mMin, null);
});

test('12. «Барлық жиынтық үшін ең тиімді» — тек бәрін қабылдайтындар арасынан', () => {
  const pts = [
    { id: 'part', prices: { paper: 100 }, minBatch: {}, detourKm: 0 },
    { id: 'full', prices: { paper: 40, glass: 5 }, minBatch: {}, detourKm: 10 }
  ];
  const r = C.comparePoints(pts, { paper: 5, glass: 10 }, car);
  assert.equal(r.bestAny.pointId, 'part');
  assert.equal(r.bestFull.pointId, 'full');
});

test('13. Бірлесіп өткізу: екі жеке сапар және айналып өтетін бір ортақ сапар', () => {
  const people = [
    { name: '1-отбасы', masses: { paper: 5 }, distanceKm: 10 },
    { name: '2-отбасы', masses: { paper: 5 }, distanceKm: 10 }
  ];
  const r = C.compareJoint(point(), people, car, 14);
  close(r.separateTotal.result, -200);  // 2 × (200 − 300)
  close(r.joint.revenue, 400);
  close(r.joint.fuelCost, 420);         // 14 × 10 / 100 × 300
  close(r.joint.result, -20);
  close(r.gain, 180);
});

test('14. Бірігу ең аз партияны жинауға көмектеседі', () => {
  const people = [
    { name: 'A', masses: { paper: 5 }, distanceKm: 10 },
    { name: 'B', masses: { paper: 5 }, distanceKm: 10 }
  ];
  const r = C.compareJoint(point({ minBatch: { paper: 8 } }), people, car, 12);
  close(r.separateTotal.revenue, 0);
  close(r.joint.revenue, 400);
});

test('15. Болжам дәлдігі: орташа абсолют және салыстырмалы ауытқу', () => {
  const e = C.forecastError([
    { predictedRevenue: 200, actualPayment: '180' }, // |−20|, 11,1 %
    { predictedRevenue: 500, actualPayment: '500' }, // 0
    { predictedRevenue: 300, actualPayment: '' }     // нақты дерек жоқ — есептелмейді
  ]);
  assert.equal(e.n, 2);
  close(e.mae, 10);
  close(e.mape, (20 / 180) * 100 / 2);
});
