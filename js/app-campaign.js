/* Мектеп акциясының ортақ күйі мен есептері (интерфейстен тәуелсіз бөлігі) */
(function () {
  'use strict';
  const App = window.App;
  const K = window.EcoCampaign;
  const st = () => App.state;
  const DAY = 864e5;

  // Акцияда негізгі болып саналатын материалдар (сауалнама сұрақтарымен сәйкес)
  App.CAMP_MATS = ['paper', 'cardboard', 'pet', 'alu', 'glass'];

  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
  App.isoAdd = addDays;
  App.today = today;

  App.camp = () => {
    st().campaign = Object.assign({
      name: 'Мектеп эко-акциясы', start: '', deadline: '', entries: [], csvUrl: '', demo: false,
      centerId: 'ls-ualikhanov', objective: 'total', tripKm: '',
      car: { capacity: '300' },
      route: { school: { name: 'Мектеп', coord: '' }, center: '', spots: [], k: '', calib: [] }
    }, st().campaign || {});
    const c = st().campaign;
    c.car = Object.assign({ capacity: '300' }, c.car);
    c.route = Object.assign({ school: { name: 'Мектеп', coord: '' }, center: '', spots: [], k: '', calib: [] }, c.route);
    return c;
  };

  App.campStart = () => {
    const c = App.camp();
    if (c.start) return c.start;
    const dates = c.entries.map((e) => e.date).sort();
    return dates[0] || today();
  };

  App.campDeadline = () => App.camp().deadline || addDays(App.campStart(), 35);

  App.parseCoord = (s) => {
    const m = String(s || '').match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1].replace(',', '.')), lng = Number(m[2].replace(',', '.'));
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  };

  /** Пункттің сатылы бағалары: tiers өрісі, болмаса — бір сатылы prices. */
  App.tiersFor = (p) => {
    const out = {};
    for (const id of Object.keys(p.prices || {})) {
      if (p.tiers && Array.isArray(p.tiers[id]) && p.tiers[id].length) out[id] = p.tiers[id];
      else if (typeof p.prices[id] === 'number') out[id] = [{ min: Number((p.minBatch || {})[id]) || 0, price: p.prices[id] }];
    }
    return out;
  };

  // =====================================================================
  //  Деректерді талдау
  // =====================================================================
  App.campAnalysis = () => {
    const c = App.camp();
    if (!c.entries.length) return null;
    const start = App.campStart();
    const fits = K.familyFits(c.entries, start);
    const nowDay = Math.max(...c.entries.map((e) => K.dayIndex(e.date, start)));
    const deadlineDay = K.dayIndex(App.campDeadline(), start);
    const rates = fits.fams.filter((f) => !f.pooled).map((f) => f.fit.slope);
    const classRate = fits.fams.reduce((s, f) => s + f.fit.slope, 0);
    const comp = K.composition(fits, st().materials.map((m) => m.id));
    // Нақты жиынтық: әр өлшем күні үшін әр отбасының осы күнге дейінгі соңғы мәні
    const days = Array.from(new Set(c.entries.map((e) => K.dayIndex(e.date, start)))).sort((a, b) => a - b);
    const actual = days.map((t) => ({
      t,
      y: fits.fams.reduce((s, f) => { const p = f.pts.filter((x) => x.t <= t).pop(); return s + (p ? p.y : 0); }, 0)
    }));
    const currentTotal = actual.length ? actual[actual.length - 1].y : 0;
    return {
      start, fits, nowDay, deadlineDay, classRate, rates, comp, actual, currentTotal,
      rateCI: K.bootstrapMean(rates),
      valid: K.validate(c.entries, start),
      fc: (t) => K.forecast(fits, t)
    };
  };

  // =====================================================================
  //  Маршрут
  // =====================================================================
  App.routeResult = () => {
    const c = App.camp();
    const r = c.route;
    const school = App.parseCoord(r.school.coord);
    const center = App.parseCoord(r.center);
    const spots = r.spots.map((s) => ({ ...s, pos: App.parseCoord(s.coord) })).filter((s) => s.pos);
    const calib = K.calibrateK(r.calib.map((p) => {
      const a = placeById(p.a), b = placeById(p.b);
      return { straight: a && b ? K.haversine(a, b) : 0, road: Number(p.road) || 0 };
    }));
    const k = Number(r.k) > 0 ? Number(r.k) : calib ? calib.k : 1.3;
    const kSrc = Number(r.k) > 0 ? 'manual' : calib ? 'calib' : 'default';
    if (!school || !center) return { ready: false, k, kSrc, calib, spots };
    const places = [school, ...spots.map((s) => s.pos), center];
    const D = K.distanceMatrix(places, k);
    const hk = K.heldKarp(D);
    const back = D[places.length - 1][0]; // пункттен мектепке қайту
    const routeKm = hk.length + back;
    const inputKm = places.reduce((s, p, i) => (i ? s + D[i - 1][i] : 0), 0) + back;
    // Салыстыру: әр отбасы өз нүктесінен пунктке жеке барып-қайтады
    const an = App.campAnalysis();
    const fams = an ? an.fits.fams : [];
    let soloKm = 0;
    for (const f of fams) {
      const s = spots.find((x) => x.name && f.spot && x.name.trim().toLowerCase() === f.spot.trim().toLowerCase());
      const from = s ? s.pos : school;
      soloKm += 2 * K.haversine(from, center) * k;
    }
    const counts = spots.map((s) => fams.filter((f) => f.spot && s.name && f.spot.trim().toLowerCase() === s.name.trim().toLowerCase()).length);
    return {
      ready: true, k, kSrc, calib, spots, school, center, places, order: hk.order, routeKm, inputKm, soloKm,
      families: fams.length, counts
    };
  };

  function placeById(id) {
    const c = App.camp();
    if (id === 'school') return App.parseCoord(c.route.school.coord);
    if (id === 'center') return App.parseCoord(c.route.center);
    const s = c.route.spots.find((x) => x.id === id);
    return s ? App.parseCoord(s.coord) : null;
  }
  App.placeName = (id) => {
    const c = App.camp();
    if (id === 'school') return c.route.school.name || 'Мектеп';
    if (id === 'center') return App.pointById(c.centerId) ? App.pointById(c.centerId).name : 'Пункт';
    const s = c.route.spots.find((x) => x.id === id);
    return s ? s.name : '?';
  };

  // =====================================================================
  //  Жинау күнінің жоспары
  // =====================================================================
  App.planResult = () => {
    const an = App.campAnalysis();
    if (!an) return null;
    const c = App.camp();
    const point = App.pointById(c.centerId);
    if (!point) return null;
    const tiers = App.tiersFor(point);
    const route = App.routeResult();
    const tripKm = route.ready ? route.routeKm : Number(c.tripKm) || 0;
    const t = App.transport();
    const liters = K.fuelOf(tripKm, t.consumption);
    const tripCost = liters * t.fuelPrice;
    const share = an.comp.share;
    const massAt = (day) => {
      const total = an.fc(day).mean;
      const m = {};
      for (const id of Object.keys(share)) if (share[id] > 0) m[id] = total * share[id];
      return m;
    };
    const plan = K.planByDay({
      massAt, tiers, capacity: Number(c.car.capacity) || 300, tripCost,
      fromDay: Math.max(an.nowDay, 1), toDay: Math.max(an.deadlineDay, an.nowDay + 1), startDay: 0
    });
    const best = c.objective === 'rate' ? plan.bestRate : plan.bestTotal;
    // Әр материал үшін келесі баға сатысына жету күні
    const tierDays = [];
    for (const id of Object.keys(tiers)) {
      for (const tr of tiers[id].slice().sort((a, b) => a.min - b.min)) {
        if (tr.min <= 0) continue;
        const d = plan.days.find((x) => (x.items[id] || {}).kg >= tr.min);
        const row = { matId: id, min: tr.min, price: tr.price, day: d ? d.t : null };
        if (!d && best) {
          // Мерзімге дейін жетпесе: қанша жетіспейді және сатыға жетсе, түсім қаншаға өседі
          const kg = (best.items[id] || {}).kg || 0;
          row.need = tr.min - kg;
          row.gain = tr.min * tr.price - ((best.items[id] || {}).revenue || 0);
        }
        tierDays.push(row);
      }
    }
    return { an, point, tiers, plan, best, tripKm, tripCost, liters, route, tierDays, fromRoute: route.ready };
  };

  // =====================================================================
  //  Мысал деректер (тек көрсету үшін, нақты емес)
  // =====================================================================
  App.makeDemo = () => {
    const c = App.camp();
    const start = addDays(today(), -21);
    let s = 11;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const spots = [
      { id: 'd1', name: 'Мектеп ауласы', coord: '53.2860, 69.3925' },
      { id: 'd2', name: 'Сарыарқа ш/а, дүкен жаны', coord: '53.2945, 69.4120' },
      { id: 'd3', name: 'Васильковский, аялдама', coord: '53.2640, 69.3640' },
      { id: 'd4', name: 'Орталық базар жаны', coord: '53.2790, 69.3780' }
    ];
    const entries = [];
    for (let i = 1; i <= 18; i++) {
      const code = `10А-${String(i).padStart(2, '0')}`;
      const g = 0.12 + rnd() * 0.75; // кг/күн
      const spot = spots[Math.floor(rnd() * spots.length)].name;
      const skipLast = rnd() < 0.15;
      for (const d of [0, 7, 14, 21]) {
        if (d === 21 && skipLast) continue;
        const y = Math.max(0, g * d * (0.9 + rnd() * 0.2) + (rnd() - 0.5) * 0.6);
        entries.push({
          code, date: addDays(start, d), spot,
          masses: { paper: +(y * 0.52).toFixed(1), cardboard: +(y * 0.27).toFixed(1), pet: +(y * 0.15).toFixed(1), alu: +(y * 0.04).toFixed(1), glass: +(y * 0.02).toFixed(1) }
        });
      }
    }
    Object.assign(c, {
      name: '10А сыныбының эко-акциясы (МЫСАЛ)', start, deadline: addDays(start, 42), entries, demo: true,
      route: { school: { name: 'Мектеп', coord: '53.2860, 69.3925' }, center: '53.2725, 69.3990', spots: spots.slice(1), k: '', calib: [] }
    });
    if (!st().transport.fuelPrice) { st().transport.fuelPrice = '250'; c.demoFuel = true; }
    App.save();
  };

  App.clearDemo = () => {
    const c = App.camp();
    if (c.demoFuel) { st().transport.fuelPrice = ''; c.demoFuel = false; }
    Object.assign(c, { name: 'Мектеп эко-акциясы', start: '', deadline: '', entries: [], demo: false,
      route: { school: { name: 'Мектеп', coord: '' }, center: '', spots: [], k: '', calib: [] } });
    App.save();
  };

  App.demoBanner = () => (App.camp().demo
    ? '<div class="demo-banner"><b>МЫСАЛ ДЕРЕКТЕР</b> — нақты емес, сайттың қалай жұмыс істейтінін көрсету үшін. <button type="button" class="link" data-clear-demo>Мысалды өшіру</button></div>'
    : '');
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-clear-demo]');
    if (!el) return;
    if (!confirm('Мысал деректерді өшіру керек пе?')) return;
    App.clearDemo();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
})();
