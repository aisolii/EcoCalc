// Мектеп акциясының математикасын тексеру. Іске қосу: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/campaign.js');

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} ≠ ${b} (±${eps})`);
const MATS = ['paper', 'cardboard', 'pet', 'hdpe', 'film', 'alu', 'glass'];

test('А1. Google Forms CSV: бағандар тақырып бойынша табылады, күн пішімдері түрленеді', () => {
  const csv = 'Отметка времени,Отбасы коды,Өлшеу күні,"Макулатура, кг","Картон, кг","ПЭТ бөтелкелер, кг",Жинау нүктесі\n' +
    '01.10.2026 10:00,10а-01,01.10.2026,"2,5",1,0.4,Мектеп\n' +
    '08.10.2026 10:00,10А-01,2026-10-08,4,2,"1,1",Мектеп\n' +
    ',,,1,1,1,\n';
  const { entries, skipped } = K.entriesFromRows(K.parseCSV(csv), MATS);
  assert.equal(entries.length, 2);
  assert.equal(skipped, 1);
  assert.equal(entries[0].code, '10А-01'); // кіші әріп бас әріпке айналады
  assert.equal(entries[0].date, '2026-10-01');
  near(entries[0].masses.paper, 2.5, 1e-12);
  near(entries[1].masses.pet, 1.1, 1e-12);
  assert.equal(entries[1].spot, 'Мектеп');
});

test('А2. Отбасы регрессиясы және сынып болжамы', () => {
  const start = '2026-10-01';
  const mk = (code, d, kg) => ({ code, date: d, masses: { paper: kg } });
  const entries = [
    mk('A', '2026-10-01', 0), mk('A', '2026-10-08', 7), mk('A', '2026-10-15', 14),
    mk('B', '2026-10-01', 1), mk('B', '2026-10-08', 4.5), mk('B', '2026-10-15', 8),
    mk('C', '2026-10-08', 3) // бір өлшем — медианалық жылдамдық беріледі
  ];
  const fits = K.familyFits(entries, start);
  const A = fits.fams.find((f) => f.code === 'A');
  near(A.fit.slope, 1, 1e-12);
  near(A.fit.r2, 1, 1e-12);
  const C = fits.fams.find((f) => f.code === 'C');
  assert.equal(C.pooled, true);
  near(fits.median, 0.75, 1e-12);
  // t = 21: A = 21, B = 1 + 0,5·21 = 11,5, C = 3 + 0,75·(21 − 7) = 13,5
  near(K.forecast(fits, 21).mean, 21 + 11.5 + 13.5, 1e-9);
});

test('А3. Hold-out тексеру: модель аңғал модельден дәлірек', () => {
  const entries = [];
  for (const [code, g] of [['A', 1], ['B', 0.5], ['C', 0.8]]) {
    for (const d of [0, 7, 14, 21]) entries.push({ code, date: new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10), masses: { paper: g * d } });
  }
  const v = K.validate(entries, '2026-10-01');
  assert.equal(v.rows.length, 3);
  near(v.maeModel, 0, 1e-9);
  assert.ok(v.maeNaive > 3);
  near(v.errModel, 0, 1e-12);
});

test('А4. Сатылы баға және жинау күнін оңтайландыру', () => {
  const tiers = { paper: [{ min: 50, price: 15 }, { min: 200, price: 30 }] };
  assert.equal(K.tierPrice(tiers.paper, 40), null);
  assert.equal(K.tierPrice(tiers.paper, 150), 15);
  assert.equal(K.tierPrice(tiers.paper, 200), 30);
  // Күніне 10 кг: 20-күні 200 кг — баға екі есе өседі
  const plan = K.planByDay({ massAt: (t) => ({ paper: 10 * t }), tiers, capacity: 300, tripCost: 500, fromDay: 1, toDay: 25 });
  const d19 = plan.days.find((d) => d.t === 19), d20 = plan.days.find((d) => d.t === 20);
  near(d19.profit, 190 * 15 - 500, 1e-9);
  near(d20.profit, 200 * 30 - 500, 1e-9);
  assert.equal(plan.breakEven.t, 5); // 50 кг·15 = 750 > 500
  assert.equal(plan.bestTotal.t, 25);
  near(plan.bestTotal.trips, 1, 0);
});

test('А5. Сыйымдылық: 300 кг-нан асса, екінші сапар қосылады', () => {
  const plan = K.planByDay({ massAt: (t) => ({ paper: 10 * t }), tiers: { paper: [{ min: 0, price: 30 }] }, capacity: 300, tripCost: 1000, fromDay: 30, toDay: 31 });
  assert.equal(plan.days[0].trips, 1);
  assert.equal(plan.days[1].trips, 2);
  assert.ok(plan.days[1].profit < plan.days[0].profit); // 310·30 − 2000 < 300·30 − 1000
});

test('А6. Гаверсинус: экватордағы 1° бойлық ≈ 111,19 км', () => {
  near(K.haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111.19, 0.01);
});

test('А7. Жол коэффициенті k: ЕКК бас нүкте арқылы', () => {
  const r = K.calibrateK([{ straight: 2, road: 2.6 }, { straight: 4, road: 5.2 }, { straight: 1, road: 1.3 }]);
  near(r.k, 1.3, 1e-12);
  near(r.r2, 1, 1e-12);
});

test('А8. Хелд–Карп толық іріктеумен бірдей ең қысқа жолды табады', () => {
  // кездейсоқ 7 нүкте: бастау, 5 аралық, соңы
  let s = 3;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pts = Array.from({ length: 7 }, () => ({ lat: 53.25 + rnd() * 0.06, lng: 69.35 + rnd() * 0.08 }));
  const D = K.distanceMatrix(pts, 1.3);
  const hk = K.heldKarp(D);
  // толық іріктеу
  const mid = [1, 2, 3, 4, 5];
  let best = Infinity;
  const perm = (arr, used) => {
    if (arr.length === mid.length) {
      const path = [0, ...arr, 6];
      let L = 0;
      for (let i = 0; i < path.length - 1; i++) L += D[path[i]][path[i + 1]];
      best = Math.min(best, L);
      return;
    }
    for (const x of mid) if (!used.has(x)) { used.add(x); perm([...arr, x], used); used.delete(x); }
  };
  perm([], new Set());
  near(hk.length, best, 1e-9);
  assert.equal(hk.order[0], 0);
  assert.equal(hk.order[hk.order.length - 1], 6);
  assert.equal(new Set(hk.order).size, 7);
});

test('А9. Бутстрэп сенім аралығы орташа мәнді қамтиды', () => {
  const b = K.bootstrapMean([0.4, 0.6, 0.5, 0.9, 0.3, 0.7]);
  near(b.mean, 0.5666666, 1e-6);
  assert.ok(b.lo < b.mean && b.mean < b.hi);
});
