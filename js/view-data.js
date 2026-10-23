/* Деректер: апталық өлшемдерді енгізу, Google Forms кестесінен жүктеу, кесте */
(function () {
  'use strict';
  const App = window.App;
  const K = window.EcoCampaign;
  const { F, $, $$, esc } = App;
  const root = $('[data-view="data"]');
  const st = () => App.state;

  const mats = () => App.CAMP_MATS.map((id) => st().materials.find((m) => m.id === id)).filter(Boolean);

  function render() {
    const c = App.camp();
    const codes = Array.from(new Set(c.entries.map((e) => e.code))).sort();
    const spots = c.route.spots.map((s) => s.name).filter(Boolean);
    const last = c.entries.slice().sort((a, b) => (b.date + b.code).localeCompare(a.date + a.code));
    root.querySelector('#dataBody').innerHTML = `${App.demoBanner()}
      <header class="page-head"><h1>Өлшемдер</h1>
        <p>Әр отбасы апта сайын үйде жиналған шикізаттың <b>жалпы</b> массасын өлшейді (бұрынғы өлшемге қосып емес, бәрін қайта өлшеп). Отбасылар аты-жөнімен емес, кодпен жазылады.</p></header>

      <form class="panel pad entry-form" id="entryForm">
        <h2 class="h3">Өлшем қосу</h2>
        <div class="pair">
          <label class="field"><span>Отбасы коды</span><input name="code" list="codeList" required placeholder="10А-01" autocomplete="off"></label>
          <label class="field"><span>Өлшеу күні</span><input name="date" type="date" required value="${App.today()}"></label>
        </div>
        <datalist id="codeList">${codes.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="mat-grid">${mats().map((m) => `<label class="field"><span>${esc(m.name)}</span><span class="with-unit"><input name="m_${m.id}" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"><span class="unit">кг</span></span></label>`).join('')}</div>
        <label class="field"><span>Жинау нүктесі <small>Көлік шикізатты осы жерден алады. Нүктелер «Маршрут» бетінде қосылады.</small></span>
          <select name="spot"><option value="">— мектеп —</option>${spots.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
        <p class="error" id="entryError" hidden></p>
        <div class="actions"><button class="btn btn--primary btn--big" type="submit">Сақтау</button></div>
      </form>

      <details class="panel pad import" ${c.csvUrl ? 'open' : ''}>
        <summary><b>Google Forms арқылы жинау</b> — отбасылар өздері телефоннан толтырады</summary>
        <ol class="limits">
          <li>Google Forms-та жаңа сауалнама жасаңыз. Сұрақтар (дәл осы атаулармен):
            <ul class="qlist">${App.D.formQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></li>
          <li>«Ответы» → «Связать с Таблицами» — жауаптар Google кестесіне түседі.</li>
          <li>Кестеде: «Файл» → «Поделиться» → «Опубликовать в интернете» → парақты таңдап, <b>CSV</b> пішімін таңдаңыз → сілтемені көшіріңіз.</li>
          <li>Сілтемені төменге қойып, «Жүктеу» батырмасын басыңыз. Әр жолы жаңарту үшін тағы басыңыз.</li>
        </ol>
        <div class="url-row">
          <label class="field"><span>Жарияланған CSV сілтемесі</span><input id="csvUrl" type="url" value="${esc(c.csvUrl)}" placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv"></label>
          <button class="btn btn--primary" type="button" id="csvLoad">Жүктеу</button>
        </div>
        <p class="hint">Немесе кестені CSV файл ретінде жүктеп алып, осы жерге беріңіз: <label class="link">файлды таңдау<input type="file" accept=".csv,text/csv" id="csvFile" hidden></label></p>
        <p class="hint" id="csvStatus"></p>
      </details>

      <details class="panel pad">
        <summary><b>Акция параметрлері</b></summary>
        <div class="pair">
          <label class="field"><span>Акция атауы</span><input id="campName" value="${esc(c.name)}"></label>
          <label class="field"><span>Басталған күні <small>бос болса — алғашқы өлшем күні</small></span><input id="campStart" type="date" value="${esc(c.start)}"></label>
          <label class="field"><span>Шикізатты өткізу мерзімі <small>осы күнге дейін жинау күні таңдалады</small></span><input id="campDeadline" type="date" value="${esc(c.deadline || App.campDeadline())}"></label>
        </div>
      </details>

      <div class="row-head"><h2 class="h2">Барлық өлшемдер (${c.entries.length})</h2>
        <div class="actions">${c.entries.length ? '<button class="btn" type="button" id="exportCsv">CSV-ге сақтау</button><button class="btn btn--ghost" type="button" id="clearAll">Барлығын өшіру</button>' : ''}</div></div>
      ${c.entries.length ? `<div class="scroll panel"><table class="tbl entries"><thead><tr><th>Күні</th><th>Код</th>${mats().map((m) => `<th class="num">${esc(m.name)}</th>`).join('')}<th class="num">Барлығы</th><th>Нүкте</th><th></th></tr></thead>
        <tbody>${last.map((e) => `<tr><td>${F.date(e.date)}</td><th scope="row">${esc(e.code)}</th>${mats().map((m) => `<td class="num">${e.masses[m.id] ? F.num(e.masses[m.id], 1) : '—'}</td>`).join('')}<td class="num"><b>${F.num(K.total(e.masses), 1)}</b></td><td>${esc(e.spot || '')}</td><td><button type="button" class="del" data-del-entry="${esc(e.code)}|${e.date}" aria-label="Өшіру">×</button></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="hint">Әзірге өлшем жоқ.</p>'}`;
  }

  function addEntries(list, replace) {
    const c = App.camp();
    const key = (e) => `${e.code}|${e.date}`;
    const map = new Map((replace ? [] : c.entries).map((e) => [key(e), e]));
    for (const e of list) map.set(key(e), e); // бір отбасының бір күнгі өлшемі жаңасымен ауыстырылады
    c.entries = Array.from(map.values());
    if (c.demo) { c.demo = false; }
    App.save();
  }

  function importText(text, source) {
    const rows = K.parseCSV(text);
    const r = K.entriesFromRows(rows, st().materials.map((m) => m.id));
    if (!r.entries.length) throw new Error('кестеде «Отбасы коды» және «Өлшеу күні» бағандары табылмады');
    const c = App.camp();
    if (c.demo) App.clearDemo();
    addEntries(r.entries, true);
    render();
    const found = Object.keys(r.columns).filter((k) => r.columns[k] >= 0).map((k) => (k === 'code' ? 'код' : k === 'date' ? 'күн' : k === 'spot' ? 'нүкте' : App.matName(k)));
    $('#csvStatus').textContent = `${source}: ${r.entries.length} өлшем жүктелді${r.skipped ? `, ${r.skipped} жол өткізілді (код немесе күн жоқ)` : ''}. Табылған бағандар: ${found.join(', ')}.`;
    App.toast(`${r.entries.length} өлшем жүктелді`);
  }

  root.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'entryForm') return;
    ev.preventDefault();
    const f = ev.target;
    const code = f.code.value.trim().toUpperCase();
    const masses = {};
    let sum = 0;
    for (const m of mats()) {
      const v = f[`m_${m.id}`].value;
      if (v !== '' && Number(v) < 0) { $('#entryError').hidden = false; $('#entryError').textContent = 'Масса теріс бола алмайды.'; return; }
      if (v !== '') { masses[m.id] = Number(v); sum += Number(v); }
    }
    if (!code || !f.date.value) return;
    addEntries([{ code, date: f.date.value, spot: f.spot.value, masses }]);
    App.toast(`${code}: ${F.kg(sum)} сақталды`);
    const date = f.date.value;
    render();
    $('#entryForm').date.value = date;
    $('#entryForm').code.focus();
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    const c = App.camp();
    if (el.dataset.delEntry) {
      const [code, date] = el.dataset.delEntry.split('|');
      c.entries = c.entries.filter((e) => !(e.code === code && e.date === date));
      App.save(); render();
    } else if (el.id === 'csvLoad') {
      const url = $('#csvUrl').value.trim();
      c.csvUrl = url; App.save();
      if (!url) return;
      $('#csvStatus').textContent = 'Жүктелуде…';
      fetch(url).then((r) => { if (!r.ok) throw new Error('сервер ' + r.status + ' қайтарды'); return r.text(); })
        .then((text) => importText(text, 'Google кестесі'))
        .catch((e) => { $('#csvStatus').textContent = 'Жүктеу мүмкін болмады: ' + e.message + '. Сілтеме «CSV» пішімінде жарияланғанын тексеріңіз немесе файлды қолмен беріңіз.'; });
    } else if (el.id === 'exportCsv') {
      const head = ['Отбасы коды', 'Өлшеу күні', ...mats().map((m) => `${m.name}, кг`), 'Жинау нүктесі'];
      const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = c.entries.map((e) => [e.code, e.date, ...mats().map((m) => e.masses[m.id] ?? ''), e.spot].map(cell).join(','));
      App.download('ecoesep-olshemder.csv', '﻿' + [head.map(cell).join(','), ...lines].join('\r\n'), 'text/csv');
    } else if (el.id === 'clearAll') {
      if (!confirm('Барлық өлшемді өшіру керек пе? Алдымен CSV-ге сақтап алыңыз.')) return;
      c.entries = []; App.save(); render();
    }
  });

  root.addEventListener('change', (ev) => {
    const el = ev.target;
    const c = App.camp();
    if (el.id === 'csvFile' && el.files[0]) {
      el.files[0].text().then((t) => importText(t, 'Файл')).catch((e) => { $('#csvStatus').textContent = 'Файлды оқу мүмкін болмады: ' + e.message; });
    } else if (el.id === 'campName') { c.name = el.value; App.save(); }
    else if (el.id === 'campStart') { c.start = el.value; App.save(); }
    else if (el.id === 'campDeadline') { c.deadline = el.value; App.save(); }
  });

  App.views.data = { title: 'Деректер', render };
})();
