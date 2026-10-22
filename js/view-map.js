/* Карта мен маршрут: Google Maps (кілтсіз ендіру) және маршрут сілтемесі */
(function () {
  'use strict';
  const App = window.App;
  const { F, $, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="map"]');
  let geoFrom = ''; // «Менің орным» координаттары тек жадта сақталады
  let filter = '';

  const from = () => geoFrom || st().route.from.trim();

  function embedUrl(p) {
    const dest = App.mapQuery(p);
    const start = from();
    const params = start
      ? new URLSearchParams({ saddr: start, daddr: dest, hl: 'kk', output: 'embed' })
      : new URLSearchParams({ q: dest, hl: 'kk', z: '15', output: 'embed' });
    return 'https://maps.google.com/maps?' + params.toString();
  }

  function visiblePoints() {
    return st().points.filter((p) => !filter || Object.prototype.hasOwnProperty.call(p.prices || {}, filter));
  }

  function accepted(p) {
    const ids = Object.keys(p.prices || {});
    if (!ids.length) return '<span class="hint">материалдар белгісіз</span>';
    return ids.map((id) => {
      const price = p.prices[id];
      return `<span class="chip">${esc(App.matName(id))}${price == null ? '' : ` · ${F.num(price)} ₸`}</span>`;
    }).join('');
  }

  function renderList() {
    const pts = visiblePoints();
    if (!pts.some((p) => p.id === st().mapPointId)) st().mapPointId = pts[0] ? pts[0].id : null;
    $('#mapPoints').innerHTML = pts.map((p) => `
      <button type="button" class="map-item" data-pick="${p.id}" aria-pressed="${p.id === st().mapPointId}">
        <b>${esc(p.name)}</b>
        <span class="map-item__addr">${esc(p.address || '')}</span>
        <span class="chips">${accepted(p)}</span>
      </button>`).join('') || '<p class="hint">Бұл материалды қабылдайтын пункт тізімде жоқ.</p>';
  }

  function renderMap() {
    const p = App.pointById(st().mapPointId);
    const frame = $('#mapFrame');
    if (!p) {
      frame.innerHTML = '<p class="hint pad">Пунктті таңдаңыз.</p>';
      $('#mapDetail').innerHTML = '';
      return;
    }
    const src = embedUrl(p);
    const iframe = frame.querySelector('iframe');
    if (iframe) { if (iframe.src !== src) iframe.src = src; }
    else frame.innerHTML = `<iframe title="Google Maps картасы" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;

    const mode = st().transport.mode;
    const key = mode === 'onway' ? 'detourKm' : 'oneWayKm';
    const label = mode === 'onway' ? 'Жолға қосымша, км (жол-жөнекей соққанда)' : 'Пунктке дейінгі қашықтық бір бағытқа, км';
    const rows = [
      p.org && ['Ұйым', esc(p.org)],
      p.phone && ['Телефон', `<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a>`],
      p.hours && ['Жұмыс уақыты', esc(p.hours)],
      p.requirements && ['Талаптар', esc(p.requirements)],
      p.note && ['Ескерту', esc(p.note)],
      ['Дереккөз', esc(p.source || '—')]
    ].filter(Boolean);
    $('#mapDetail').innerHTML = `<div class="panel pad map-card">
      <div class="panel__head"><h2 class="h3">${esc(p.name)}</h2>${App.statusTag(p)}</div>
      <p>${esc(p.address || '')}</p>
      <dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="actions">
        <a class="btn btn--primary" href="${esc(App.directionsUrl(p, from()))}" target="_blank" rel="noopener">Google Maps-та маршрут ашу ↗</a>
        <a class="btn" href="#/prices" data-editpt="${p.id}">Бағасын өзгерту</a>
      </div>
      <div class="dist-save">
        <label class="field"><span>${label}</span>
          <input type="number" min="0" step="0.1" inputmode="decimal" id="mapDist" data-key="${key}" value="${esc(p[key] ?? '')}" placeholder="маршруттағы км"></label>
        <label class="check"><input type="checkbox" id="mapInclude"${p.inCompare ? ' checked' : ''}><span>Калькуляторда салыстыру</span></label>
      </div>
      <p class="hint">Google Maps маршрутында көрсетілген километрді жазыңыз — калькулятор оны бірден қолданады.${mode === 'separate' ? ' Арнайы сапарда калькулятор бұл санды екіге көбейтеді (бару-қайту).' : ''}</p>
    </div>`;
  }

  function render() {
    const options = st().materials.map((m) => `<option value="${m.id}"${filter === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
    $('#mapFilter').innerHTML = `<option value="">Барлық пункттер</option>${options}`;
    $('#routeFrom').value = geoFrom ? 'Менің орным' : st().route.from;
    renderList();
    renderMap();
  }

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button, a');
    if (!el) return;
    if (el.dataset.pick) {
      st().mapPointId = el.dataset.pick;
      App.save();
      renderList();
      renderMap();
      if (window.innerWidth < 900) $('#mapFrame').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (el.dataset.editpt) {
      ev.preventDefault();
      App.openPoint(el.dataset.editpt, () => { render(); });
    } else if (el.id === 'geoBtn') {
      if (!navigator.geolocation) { alert('Браузер орынды анықтай алмайды.'); return; }
      el.disabled = true;
      navigator.geolocation.getCurrentPosition((pos) => {
        geoFrom = `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`;
        el.disabled = false;
        render();
      }, () => {
        el.disabled = false;
        alert('Орынды анықтау мүмкін болмады. Мекенжайды қолмен жазыңыз.');
      }, { timeout: 10000 });
    }
  });

  let typing = null;
  root.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.id === 'routeFrom') {
      geoFrom = '';
      st().route.from = el.value;
      App.save();
      clearTimeout(typing);
      typing = setTimeout(renderMap, 700); // әр әріптен кейін картаны қайта жүктемеу үшін
    } else if (el.id === 'mapDist') {
      const p = App.pointById(st().mapPointId);
      p[el.dataset.key] = el.value;
      App.save();
    }
  });

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'mapFilter') { filter = el.value; renderList(); renderMap(); }
    else if (el.id === 'mapInclude') { App.pointById(st().mapPointId).inCompare = el.checked; App.save(); }
  });

  App.views.map = { title: 'Карта мен маршрут', render };
})();
