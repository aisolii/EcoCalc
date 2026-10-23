/* Бірлесіп өткізу: бірнеше жеке сапар және бір ортақ сапар */
(function () {
  'use strict';
  const App = window.App;
  const { C, F, $, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="joint"]');

  function group() {
    st().group = Object.assign({ members: [], distanceKm: '', pointId: null }, st().group || {});
    const g = st().group;
    while (g.members.length < 2) g.members.push({ id: App.S.uid(), name: `${g.members.length + 1}-отбасы`, masses: {}, distanceKm: '' });
    return g;
  }

  function mats() {
    const sel = (st().wiz || {}).mats || [];
    return sel.length ? st().materials.filter((m) => sel.includes(m.id)) : st().materials.slice(0, 3);
  }

  function point() {
    const g = group();
    return App.pointById(g.pointId) || App.pointById((st().wiz || {}).pointId) || st().points[0];
  }

  function render() {
    const g = group();
    const ms = mats();
    const members = g.members.map((m) => `<div class="member">
        <div class="member__head">
          <input class="member__name" data-mname="${m.id}" value="${esc(m.name)}" aria-label="Атауы">
          ${g.members.length > 2 ? `<button type="button" class="del" data-delm="${m.id}" aria-label="Өшіру">×</button>` : ''}
        </div>
        <div class="member__grid">
          ${ms.map((mat) => `<label class="field"><span>${esc(mat.name)}</span><span class="with-unit"><input type="number" min="0" step="0.1" inputmode="decimal" data-mm="${m.id}" data-mat="${mat.id}" value="${esc(m.masses[mat.id] ?? '')}" placeholder="0"><span class="unit">кг</span></span></label>`).join('')}
          <label class="field"><span>Жеке барса, жол (бару-қайту)</span><span class="with-unit"><input type="number" min="0" step="0.1" inputmode="decimal" data-mkm="${m.id}" value="${esc(m.distanceKm)}" placeholder="0"><span class="unit">км</span></span></label>
        </div>
      </div>`).join('');
    const options = st().points.map((p) => `<option value="${p.id}"${p.id === point().id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    $('#jointBody').innerHTML = `
      <div class="members">${members}</div>
      <div class="actions"><button class="btn" type="button" id="addMember">+ Отбасы қосу</button></div>
      <div class="panel pad joint-common">
        <h2 class="h3">Ортақ сапар</h2>
        <div class="pair">
          <label class="field"><span>Қай пунктке апарасыздар?</span><select id="jointPoint">${options}</select></label>
          <label class="field"><span>Ортақ сапардың жолы: барлығын жинап, пунктке апарып, қайту</span><span class="with-unit"><input type="number" min="0" step="0.1" inputmode="decimal" id="jointKm" value="${esc(g.distanceKm)}" placeholder="0"><span class="unit">км</span></span></label>
          <label class="field"><span>1 литр бензин бағасы</span><span class="with-unit"><input type="number" min="0" step="1" inputmode="decimal" id="jFuel" value="${esc(st().transport.fuelPrice)}" placeholder="бекеттегі баға"><span class="unit">₸</span></span></label>
          <label class="field"><span>Көлік 100 км-ге неше литр жұмсайды</span><span class="with-unit"><input type="number" min="0" step="0.1" inputmode="decimal" id="jCons" value="${esc(st().transport.consumption)}"><span class="unit">л</span></span></label>
        </div>
      </div>
      <div id="jointOut"></div>
      <details class="math"><summary>Математикасы</summary>
        <p>Жеке сапарлар: B<sub>жеке</sub> = Σ<sub>k</sub> (R<sub>k</sub> − d<sub>k</sub>·c·p<sub>ж</sub>/100). Ортақ сапар: B<sub>ортақ</sub> = R(Σ m<sub>k</sub>) − d<sub>ортақ</sub>·c·p<sub>ж</sub>/100.</p>
        <p>Ортақ сапардың жолы бір отбасының жолымен бірдей емес: шикізатты жинауға айналып өту жолы қосылады. Бірігудің тағы бір пайдасы — пункттің ең аз партиясын бірге жинауға болады: R(Σm) ≥ Σ R(m<sub>k</sub>).</p>
      </details>`;
    update();
  }

  function update() {
    const g = group();
    const p = point();
    const t = { consumption: Number(st().transport.consumption) || 0, fuelPrice: Number(st().transport.fuelPrice) || 0 };
    const people = g.members.map((m) => ({ name: m.name, masses: m.masses, distanceKm: Number(m.distanceKm) || 0 }));
    const r = C.compareJoint(p, people, t, Number(g.distanceKm) || 0);
    const out = $('#jointOut');
    if (!r.joint.hasMass) { out.innerHTML = '<div class="qa"><p class="qa__a">Әр отбасының массасын жазыңыз — нәтиже осында шығады.</p></div>'; return; }
    if (!(r.joint.revenue > 0)) { out.innerHTML = `<div class="qa"><p class="qa__a">«${esc(p.name)}» пунктінің бұл материалдарға бағасы белгісіз. Басқа пунктті таңдаңыз немесе бағасын «Бағалар» бетіне жазыңыз.</p></div>`; return; }
    const s = r.separateTotal;
    const win = r.gain > 1e-6 ? 'joint' : r.gain < -1e-6 ? 'separate' : 'equal';
    const title = { joint: 'Бірге апарған тиімді', separate: 'Әркім жеке апарғаны тиімді', equal: 'Айырмашылық жоқ' }[win];
    const text = {
      joint: `Бір ортақ сапар <b>${F.money(r.gain)}</b> артық береді және ${F.km(Math.max(0, s.distanceKm - r.joint.distanceKm))} жолды үнемдейді.`,
      separate: `Жеке сапарлар <b>${F.money(-r.gain)}</b> артық береді — жинауға айналып өту жолы тым ұзақ.`,
      equal: 'Екі нұсқаның ақшалай нәтижесі бірдей.'
    }[win];
    const col = (label, v, on) => `<div class="vs__col${on ? ' is-win' : ''}"><p class="vs__title">${label}</p>
      <p class="figure figure--sm ${App.sign(v.result)}">${F.money(v.result)}</p>
      <dl class="kv"><div><dt>Пункт төлейді</dt><dd>${F.money(v.revenue)}</dd></div><div><dt>Жол</dt><dd>${F.km(v.distanceKm)}</dd></div><div><dt>Бензин</dt><dd>${F.money(v.fuelCost)}</dd></div></dl></div>`;
    out.innerHTML = `<div class="verdict-card verdict-card--${win === 'joint' ? 'good' : win === 'separate' ? 'bad' : 'neutral'}">
        <p class="verdict-card__kicker">${esc(p.name)} · барлығы ${F.kg(App.sumKg(r.totalMasses))}</p>
        <h2>${title}</h2><p class="verdict-card__text">${text}</p></div>
      ${!st().transport.fuelPrice ? '<p class="soft-warn">Бензин бағасы жазылмаған — шығын 0 деп алынды.</p>' : ''}
      <div class="vs">${col(`Әркім жеке (${s.trips} сапар)`, s, win === 'separate')}${col('Бір ортақ сапар', r.joint, win === 'joint')}</div>
      ${r.joint.revenue > s.revenue + 1e-6 ? '<p class="hint">Ортақ сапарда пункт көбірек төлейді: бірге жинап, ең аз партияға жеттіңіздер.</p>' : ''}`;
  }

  root.addEventListener('input', (ev) => {
    const el = ev.target;
    const d = el.dataset;
    const g = group();
    const byId = (id) => g.members.find((m) => m.id === id);
    if (d.mm) byId(d.mm).masses[d.mat] = el.value;
    else if (d.mkm) byId(d.mkm).distanceKm = el.value;
    else if (d.mname) byId(d.mname).name = el.value;
    else if (el.id === 'jointKm') g.distanceKm = el.value;
    else if (el.id === 'jFuel') st().transport.fuelPrice = el.value;
    else if (el.id === 'jCons') st().transport.consumption = el.value;
    else return;
    App.save();
    update();
  });

  root.addEventListener('change', (ev) => {
    if (ev.target.id === 'jointPoint') { group().pointId = ev.target.value; App.save(); update(); }
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    const g = group();
    if (el.id === 'addMember') {
      g.members.push({ id: App.S.uid(), name: `${g.members.length + 1}-отбасы`, masses: {}, distanceKm: '' });
      App.save(); render();
    } else if (el.dataset.delm) {
      g.members = g.members.filter((m) => m.id !== el.dataset.delm);
      App.save(); render();
    }
  });

  App.views.joint = { title: 'Бірлесіп өткізу', render };
})();
