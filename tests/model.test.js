// Математикалық модельді тексеру. Іске қосу: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/model.js');

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} ≠ ${b} (±${eps})`);

test('М1. Рунге–Кутта шешімі аналитикалық шешіммен сәйкес келеді', () => {
  const sim = M.simulate({ g0: 0.8, M: 40, m0: 5, days: 120, h: 0.25 });
  for (const t of [10, 30, 60, 120]) {
    const i = t / 0.25;
    near(sim.m[i], M.analytic(0.8, 40, 5, t), 1e-6, `t=${t}`);
  }
});

test('М1. Масса сақталады: жиналған + жоғалған = пайда болған', () => {
  const sim = M.simulate({ g0: 1.2, M: 30, A: 0.3, t0: 40, m0: 0, days: 200 });
  const i = sim.t.length - 1;
  near(sim.m[i] + sim.lost[i], sim.gen[i], 1e-6);
  assert.ok(sim.m[i] < 30, 'сақтау орнынан аспайды');
});

test('М1. Шекке жету уақыты: t = −(M/g)·ln(1 − m/M)', () => {
  const t = M.timeToReach(20, 1, 40);
  near(t, -40 * Math.log(0.5), 1e-12);
  near(M.analytic(1, 40, 0, t), 20, 1e-9);
  assert.equal(M.timeToReach(45, 1, 40), Infinity); // сақтау орнынан үлкен масса ешқашан жиналмайды
  near(M.timeToReach(10, 0.5, Infinity), 20, 1e-12); // шексіз сақтау орны — сызықтық өсу
});

test('М2. Оңтайлы аралық J\'(T) = 0 шартын қанағаттандырады', () => {
  const p = 20, C = 300, g = 1, Mcap = 60;
  const r = M.optimalInterval({ pbar: p, C, g0: g, M: Mcap, h: 0.01, Tmax: 200 });
  const T = r.best.T;
  const a = g / Mcap;
  const lhs = p * g * T * Math.exp(-a * T);
  const rhs = p * Mcap * (1 - Math.exp(-a * T)) - C;
  near(lhs, rhs, 0.5, 'қажетті шарт');
  // Тікелей тексеру: оңтайлы нүктенің маңында J кішірек
  const J = (x) => (p * M.analytic(g, Mcap, 0, x) - C) / x;
  assert.ok(J(T) >= J(T - 2) && J(T) >= J(T + 2));
});

test('М2. Ең аз партия шектеуі ескеріледі', () => {
  const r = M.optimalInterval({ pbar: 20, C: 0, g0: 1, M: 100, minMass: 25 });
  assert.ok(r.best.m >= 25);
});

test('М3. Шашырау нөлге тең болса, Монте-Карло детерминистік нәтиже береді', () => {
  const r = M.monteCarlo({ revenue: 820, distanceKm: 8, consumption: 8, fuelPrice: 310, spreads: {}, n: 2000 });
  near(r.mean, 820 - 8 * 8 / 100 * 310, 1e-9);
  near(r.sd, 0, 1e-6);
  assert.equal(r.pPositive, 1);
});

test('М3. Симметриялы тәуекелде ақталу ықтималдығы ≈ 0,5', () => {
  // Номиналда R = C: B-ның үлестірімі нөл маңында
  const r = M.monteCarlo({ revenue: 300, distanceKm: 10, consumption: 10, fuelPrice: 300, spreads: { price: 0.3 }, n: 20000, seed: 7 });
  near(r.pPositive, 0.5, 0.02);
  assert.equal(r.sens[0].key, 'price');
  assert.ok(r.p5 < 0 && r.p95 > 0);
});

test('М3. Бірдей seed — бірдей нәтиже (қайталанатын эксперимент)', () => {
  const args = { revenue: 500, distanceKm: 6, consumption: 9, fuelPrice: 300, spreads: { price: 0.2, mass: 0.03, dist: 0.1, cons: 0.15, fuel: 0.02 }, n: 3000, seed: 1 };
  assert.deepEqual(M.monteCarlo(args).p50, M.monteCarlo(args).p50);
});

test('М4. Ең кіші квадраттар әдісі түзуді дәл табады', () => {
  const pts = [0, 3, 7, 10, 14].map((x) => ({ x, y: 0.5 * x + 2 }));
  const r = M.linreg(pts);
  near(r.slope, 0.5, 1e-12);
  near(r.intercept, 2, 1e-12);
  near(r.r2, 1, 1e-12);
  near(r.ci95, 0, 1e-9);
});

test('М4. Шуылы бар деректер: R² < 1, сенім аралығы оң', () => {
  const r = M.linreg([{ x: 0, y: 0 }, { x: 5, y: 2.9 }, { x: 10, y: 4.8 }, { x: 15, y: 7.6 }]);
  assert.ok(r.r2 > 0.95 && r.r2 < 1);
  assert.ok(r.ci95 > 0);
});

test('М5. Жоспар: әр материал ең жоғары баға беретін пунктке', () => {
  const options = [
    { pointId: 'A', cost: 100, prices: { paper: 40, pet: 30 } },
    { pointId: 'B', cost: 120, prices: { pet: 120 } },
    { pointId: 'C', cost: 500, prices: { paper: 45 } }
  ];
  const plan = M.bestPlan(options, { paper: 10, pet: 5 });
  // A: 400 + 150 − 100 = 450; A+B: 400 + 600 − 220 = 780; B+C: 450 + 600 − 620 = 430
  assert.deepEqual(plan.pointIds.sort(), ['A', 'B']);
  near(plan.result, 780, 1e-9);
  assert.equal(plan.assignment.find((a) => a.matId === 'pet').pointId, 'B');
});
