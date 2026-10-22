/* EcoEsep — ортақ күй, көмекші функциялар және пункт редакторы. Барлық есептеулер calc.js файлында. */
(function () {
  'use strict';
  const C = window.EcoCalc;
  const D = window.EcoData;
  const F = window.Fmt;
  const S = window.Store;

  const App = (window.App = { C, D, F, S, views: {} });
  App.state = S.load();
  App.save = () => S.save(App.state);
  App.$ = (sel, root = document) => root.querySelector(sel);
  App.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  App.esc = F.esc;

  const st = () => App.state;

  App.WHO = {
    family: { label: 'Отбасы', unit: 'отбасы', hint: 'Бір отбасы жинаған шикізат.' },
    class: { label: 'Сынып', unit: 'қатысушы', hint: 'Сыныптың әр қатысушысы өз массасын енгізеді, жалпы сомасы автоматты түрде есептеледі.' },
    families: { label: 'Бірнеше отбасы', unit: 'отбасы', hint: 'Отбасылардың массалары қосылады. Нәтижеде жеке сапарларды бір ортақ сапармен салыстыруға болады.' }
  };

  App.ADVICE = {
    no_mass: 'Жиналған шикізаттың массасын енгізіңіз.',
    walk: 'Жанармай шығыны жоқ, бірақ бағдарлама уақыт пен күш шығынын есептемейді.',
    covers: 'Қазіргі жағдайда түсім жанармай шығынын өтейді — қазір өткізуге болады.',
    not_covers: 'Қазіргі жағдайда түсім бұл сапардың жанармай шығынын өтемейді. Көбірек жинауға немесе өткізуді басқа сапармен біріктіруге болады.'
  };

  // ---------- деректерге қатысты көмекшілер ----------
  App.matName = (id) => (st().materials.find((m) => m.id === id) || { name: id }).name;
  App.pointById = (id) => st().points.find((p) => p.id === id);
  App.isGroup = () => st().who !== 'family';
  App.participants = () => (App.isGroup() ? st().participants : st().participants.slice(0, 1));
  App.totalMasses = () => C.sumMasses(App.participants().map((p) => p.masses));
  App.sumKg = (masses) => Object.values(masses).reduce((s, v) => s + (Number(v) || 0), 0);
  App.listNames = (items) => items.map((i) => F.esc(App.matName(i.matId))).join(', ');
  App.sign = (n) => (n < 0 ? 'neg' : 'pos');
  App.comparedPoints = () => st().points.filter((p) => p.inCompare);
  App.mapQuery = (p) => p.mapQuery || `Кокшетау, ${p.address || p.name}`;

  App.transport = () => {
    const t = st().transport;
    return { mode: t.mode, consumption: Number(t.consumption) || 0, fuelPrice: Number(t.fuelPrice) || 0 };
  };

  App.inputErrors = () => {
    const errs = [];
    for (const p of App.participants()) {
      for (const m of st().materials) {
        const e = C.validateMass(p.masses[m.id]);
        if (e) errs.push({ kind: 'mass', pid: p.id, mid: m.id, text: `${p.name}, ${m.name}: ${e.toLowerCase()}` });
      }
    }
    if (st().transport.mode !== 'walk') {
      for (const [k, label] of [['consumption', 'Отын шығыны'], ['fuelPrice', 'Жанармай бағасы']]) {
        const e = C.validateNonNegative(st().transport[k], label);
        if (e) errs.push({ kind: 'car', text: e });
      }
    }
    for (const p of App.comparedPoints()) {
      for (const k of ['oneWayKm', 'detourKm']) {
        const e = C.validateNonNegative(p[k], `${p.name}, қашықтық`);
        if (e) errs.push({ kind: 'dist', text: e });
      }
    }
    return errs;
  };

  /** Ағымдағы деректер бойынша толық есеп. */
  App.evaluate = () => {
    const masses = App.totalMasses();
    const t = App.transport();
    const cmp = C.comparePoints(App.comparedPoints(), masses, t);
    const focus = cmp.evals.find((e) => e.pointId === st().focusId) || cmp.bestFull || cmp.bestAny || cmp.evals[0] || null;
    return { masses, t, cmp, focus, total: App.sumKg(masses) };
  };

  App.statusTag = (p) => (p.confirmed
    ? '<span class="status status--ok">расталған</span>'
    : '<span class="status status--warn">расталмаған</span>');

  App.directionsUrl = (p, from) => {
    const params = new URLSearchParams({ api: '1', destination: App.mapQuery(p), travelmode: 'driving' });
    if (from) params.set('origin', from);
    return 'https://www.google.com/maps/dir/?' + params.toString();
  };

  App.go = (view, extra) => {
    if (extra && extra.mapPointId) st().mapPointId = extra.mapPointId;
    App.save();
    location.hash = '#/' + view;
  };

  App.download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---------- пункт редакторы (Бағалар бетінен де, калькулятордан да ашылады) ----------
  const form = App.$('#pointForm');
  let editingId = null;
  let onSaved = null;

  App.openPoint = (id, callback) => {
    editingId = id;
    onSaved = callback || null;
    const p = id ? App.pointById(id) : { name: '', address: '', phone: '', hours: '', prices: {}, minBatch: {}, requirements: '', source: '', checkedAt: '', confirmed: false };
    App.$('#pointDlgTitle').textContent = id ? 'Қабылдау пункті' : 'Жаңа қабылдау пункті';
    form.ptName.value = p.name;
    form.address.value = p.address || '';
    form.phone.value = p.phone || '';
    form.hours.value = p.hours || '';
    form.requirements.value = p.requirements || '';
    form.source.value = p.source || '';
    form.checkedAt.value = p.checkedAt || '';
    form.confirmed.checked = !!p.confirmed;
    App.$('#deletePoint').hidden = !id;
    const rows = st().materials.map((m) => {
      const on = Object.prototype.hasOwnProperty.call(p.prices, m.id);
      const note = (p.priceNotes || {})[m.id];
      return `<div class="me">
        <input type="checkbox" data-acc="${m.id}"${on ? ' checked' : ''} aria-label="Қабылдайды: ${F.esc(m.name)}">
        <span>${F.esc(m.name)}${note ? `<small>${F.esc(note)}</small>` : ''}</span>
        <input type="number" min="0" step="0.1" inputmode="decimal" data-price="${m.id}" placeholder="нақтыланбаған" value="${on && p.prices[m.id] != null ? p.prices[m.id] : ''}" aria-label="${F.esc(m.name)}, баға">
        <input type="number" min="0" step="0.1" inputmode="decimal" data-batch="${m.id}" placeholder="жоқ" value="${(p.minBatch || {})[m.id] ?? ''}" aria-label="${F.esc(m.name)}, ең аз партия">
      </div>`;
    }).join('');
    App.$('#matEditor').innerHTML = `<div class="me me--head"><span></span><span>Материал</span><span>Баға, ₸/кг</span><span>Ең аз партия, кг</span></div>${rows}`;
    App.$('#pointDlg').showModal();
  };

  form.addEventListener('submit', (ev) => {
    if (!ev.submitter || ev.submitter.value !== 'save') return;
    if (!form.ptName.value.trim()) { ev.preventDefault(); form.ptName.focus(); return; }
    const prices = {};
    const minBatch = {};
    for (const m of st().materials) {
      if (!App.$(`[data-acc="${m.id}"]`, form).checked) continue;
      const price = App.$(`[data-price="${m.id}"]`, form).value;
      const batch = App.$(`[data-batch="${m.id}"]`, form).value;
      if ((price !== '' && Number(price) < 0) || (batch !== '' && Number(batch) < 0)) {
        ev.preventDefault();
        alert('Баға мен партия теріс бола алмайды.');
        return;
      }
      prices[m.id] = price === '' ? null : Number(price);
      if (Number(batch) > 0) minBatch[m.id] = Number(batch);
    }
    const data = {
      name: form.ptName.value.trim(),
      address: form.address.value.trim(),
      phone: form.phone.value.trim(),
      hours: form.hours.value.trim(),
      prices,
      minBatch,
      requirements: form.requirements.value.trim(),
      source: form.source.value.trim(),
      checkedAt: form.checkedAt.value,
      confirmed: form.confirmed.checked
    };
    if (editingId) {
      const p = App.pointById(editingId);
      if (p.address !== data.address) p.mapQuery = ''; // мекенжай өзгерсе, карта жаңа мекенжайды іздейді
      Object.assign(p, data);
    } else {
      st().points.push({ id: 'p_' + S.uid(), priceNotes: {}, links: [], note: '', mapQuery: '', inCompare: true, oneWayKm: '', detourKm: '', ...data });
    }
    App.save();
    if (onSaved) onSaved();
  });

  App.$('#deletePoint').addEventListener('click', () => {
    if (!editingId || !confirm('Пунктті өшіру керек пе?')) return;
    st().points = st().points.filter((p) => p.id !== editingId);
    App.$('#pointDlg').close();
    App.save();
    if (onSaved) onSaved();
  });

  // Баға енгізілгенде «қабылдайды» белгісі өзі қойылады
  App.$('#matEditor').addEventListener('input', (ev) => {
    const id = ev.target.dataset.price || ev.target.dataset.batch;
    if (id && ev.target.value !== '') App.$(`[data-acc="${id}"]`).checked = true;
  });
})();
