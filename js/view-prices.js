/* Бағалар мен пункттер */
(function () {
  'use strict';
  const App = window.App;
  const { F, $, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="prices"]');

  function priceCell(p, matId) {
    if (!Object.prototype.hasOwnProperty.call(p.prices || {}, matId)) return '<td class="num muted">—</td>';
    const price = p.prices[matId];
    const note = (p.priceNotes || {})[matId];
    const title = note ? ` title="${esc(note)}"` : '';
    return price == null
      ? `<td class="num unk"${title}>?</td>`
      : `<td class="num"${title}>${F.num(price)}${note ? '<sup>*</sup>' : ''}</td>`;
  }

  function renderMatrix() {
    const pts = st().points;
    const head = pts.map((p) => `<th class="num"><span class="vhead">${esc(p.name)}</span>${p.confirmed ? '' : '<span class="sub">расталмаған</span>'}</th>`).join('');
    const rows = st().materials.map((m) => `<tr><th scope="row">${esc(m.name)}</th>${pts.map((p) => priceCell(p, m.id)).join('')}</tr>`).join('');
    $('#priceMatrix').innerHTML = `<thead><tr><th>Материал</th>${head}</tr></thead><tbody>${rows}</tbody>
      <caption>«?» — пункт қабылдайды, бірақ бағасы белгісіз; «—» — қабылдамайды немесе мәлімет жоқ; * — сайттағы баға көлемге қарай өзгереді (курсорды апарыңыз).</caption>`;
  }

  function renderCards() {
    $('#pointCards').innerHTML = st().points.map((p) => {
      const prices = Object.keys(p.prices || {}).map((mid) => {
        const price = p.prices[mid];
        const batch = (p.minBatch || {})[mid];
        const note = (p.priceNotes || {})[mid];
        return `<li><span>${esc(App.matName(mid))}${note ? `<small>${esc(note)}</small>` : ''}</span>
          <span class="num${price == null ? ' unk' : ''}">${price == null ? 'белгісіз' : F.num(price) + ' ₸/кг'}${batch ? `, ${F.num(batch)} кг-нан` : ''}</span></li>`;
      }).join('');
      const links = (p.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)} ↗</a>`).join(' · ');
      const meta = [
        p.phone && `<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a>`,
        p.hours && esc(p.hours),
        p.checkedAt && `тексерілді: ${esc(F.date(p.checkedAt))}`
      ].filter(Boolean).join(' · ');
      return `<article class="pcard">
        <header class="pcard__head">
          <div>
            <h3>${esc(p.name)} ${App.statusTag(p)}</h3>
            <p class="pcard__addr">${esc(p.address || 'мекенжайы көрсетілмеген')}</p>
            ${meta ? `<p class="pcard__meta">${meta}</p>` : ''}
          </div>
        </header>
        ${prices ? `<ul class="pcard__prices">${prices}</ul>` : '<p class="hint">Материалдар көрсетілмеген.</p>'}
        ${p.requirements ? `<p class="pcard__meta"><b>Талаптар:</b> ${esc(p.requirements)}</p>` : ''}
        ${p.note ? `<p class="pcard__meta">${esc(p.note)}</p>` : ''}
        <p class="pcard__meta"><b>Дереккөз:</b> ${esc(p.source || '—')}${links ? `<br>${links}` : ''}</p>
        <footer class="pcard__foot">
          <label class="check"><input type="checkbox" data-include="${p.id}"${p.inCompare ? ' checked' : ''}><span>Калькуляторда салыстыру</span></label>
          <span class="grow"></span>
          <button class="btn btn--ghost" type="button" data-mappt="${p.id}">Картадан</button>
          <button class="btn btn--primary" type="button" data-edit="${p.id}">Бағаны өзгерту</button>
        </footer>
      </article>`;
    }).join('') || '<p class="hint">Пункттер жоқ. «+ Пункт қосу» батырмасын басыңыз.</p>';
  }

  function render() {
    const D = App.D;
    $('#callScript').innerHTML = `<summary>Пунктке қоңырау шалғанда не сұрау керек?</summary>
      <ol>${D.callScript.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
      <p class="hint">Жауаптарды «Жазбалар» бетіне «Қоңырау» үлгісімен жазып алыңыз, бағаларды осы беттегі «Бағаны өзгерту» арқылы жаңартыңыз.</p>`;
    renderMatrix();
    renderCards();
  }

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    if (el.dataset.edit) App.openPoint(el.dataset.edit, render);
    else if (el.dataset.mappt) App.go('map', { mapPointId: el.dataset.mappt });
    else if (el.id === 'addPoint') App.openPoint(null, render);
    else if (el.id === 'exportBtn') exportPoints();
    else if (el.id === 'resetPoints') {
      if (confirm('Пункттер мен бағаларды бастапқы (интернеттен жиналған) деректерге қайтару керек пе? Сіз енгізген өзгерістер өшеді.')) {
        st().points = App.S.clone(App.D.points);
        st().materials = App.S.clone(App.D.materials);
        App.save();
        render();
      }
    }
  });

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.include) { App.pointById(el.dataset.include).inCompare = el.checked; App.save(); }
    else if (el.id === 'importInput') importFile(el.files[0]);
  });

  function exportPoints() {
    const payload = { app: 'EcoEsep', version: 3, savedAt: new Date().toISOString(), materials: st().materials, points: st().points };
    App.download('ecoesep-punktter.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  function importFile(file) {
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text);
      if (!Array.isArray(data.points)) throw new Error('пункттер тізімі жоқ');
      if (Array.isArray(data.materials)) st().materials = data.materials;
      st().points = data.points;
      App.save();
      render();
      App.toast('Пункттер жүктелді');
    }).catch((e) => alert('Файлды оқу мүмкін болмады: ' + e.message));
  }

  App.views.prices = { title: 'Бағалар мен пункттер', render };
})();
