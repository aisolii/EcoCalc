/* Жазбалар және тексеру журналы */
(function () {
  'use strict';
  const App = window.App;
  const { C, F, $, esc } = App;
  const st = () => App.state;
  const root = $('[data-view="notes"]');
  const form = $('#noteForm');
  let editingId = null;

  const TEMPLATES = {
    call: { title: 'Қоңырау: ', text: 'Пункт:\nТелефон:\nКіммен сөйлестім:\nҚабылдайтын материалдар:\nБағалар (₸/кг):\nЕң аз партия:\nТалаптар:\nЖұмыс уақыты:' },
    weigh: { title: 'Өлшеу: ', text: 'Кім жинады:\nҚанша уақыт жиналды:\nМакулатура, кг:\nКартон, кг:\nПЭТ бөтелкелер, кг:\nБасқа:\nҚалай өлшедім (таразы):' },
    visit: { title: 'Пунктке бару: ', text: 'Пункт:\nКүні:\nӨткізілген масса (пункт таразысы), кг:\nАлынған төлем, ₸:\nНе қабылданбады және неге:\nЖол, км:' }
  };

  function renderNotes() {
    const notes = st().notes.slice().sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));
    $('#notesList').innerHTML = notes.length ? notes.map((n) => `
      <article class="note">
        <header class="note__head"><h3>${esc(n.title || 'Атаусыз жазба')}</h3><span class="hint">${esc(F.date(n.date))}</span></header>
        <p class="note__text">${esc(n.text)}</p>
        <footer class="actions">
          <button class="link" type="button" data-editnote="${n.id}">Өзгерту</button>
          <button class="link link--danger" type="button" data-delnote="${n.id}">Өшіру</button>
        </footer>
      </article>`).join('') + '<div class="actions"><button class="btn btn--ghost" type="button" id="notesExport">Жазбаларды файлға сақтау (.txt)</button></div>'
      : '<p class="hint">Жазбалар әзірге жоқ. Жоғарыдағы үлгілердің бірін таңдап көріңіз.</p>';
  }

  function resetForm() {
    editingId = null;
    form.reset();
    $('#noteSave').textContent = 'Жазбаны сақтау';
    $('#noteCancel').hidden = true;
  }

  // ---------- тексеру журналы ----------
  function journalDiffCells(r) {
    const actual = r.actualPayment === '' ? NaN : Number(r.actualPayment);
    if (!Number.isFinite(actual)) return `<td class="num" data-jdiff="${r.id}">—</td><td class="num">—</td>`;
    const diff = actual - r.predictedRevenue;
    const rel = actual > 0 ? F.pct((diff / actual) * 100) : '—';
    return `<td class="num" data-jdiff="${r.id}"><span class="${App.sign(diff)}">${F.money(diff)}</span></td><td class="num">${rel}</td>`;
  }

  function journalStats() {
    const e = C.forecastError(st().journal);
    if (!e.n) return 'Өткізгеннен кейін нақты төлемді енгізіңіз — дәлдік автоматты түрде есептеледі.';
    return `Нақты деректері бар жағдайлар: <b>${e.n}</b> · орташа абсолют ауытқу (MAE): <b>${F.money(e.mae)}</b>` +
      (e.mape == null ? '' : ` · орташа салыстырмалы ауытқу (MAPE): <b>${F.pct(e.mape)}</b>`);
  }

  function renderJournal() {
    const box = $('#journalCard');
    if (!st().journal.length) {
      box.innerHTML = '<p class="hint">Журнал бос. Калькулятордың нәтиже бетінде «Болжамды журналға жазу» батырмасын басыңыз.</p><a class="btn" href="#/calc">Калькуляторға өту</a>';
      return;
    }
    const rows = st().journal.map((r) => `<tr>
        <td>${esc(F.date(r.date))}</td>
        <th scope="row">${esc(r.caseName)}</th>
        <td>${esc(r.pointName)}</td>
        <td class="num">${F.num(r.predictedKg)}</td>
        <td class="num">${F.money(r.predictedRevenue)}</td>
        <td class="num">${F.money(r.predictedResult)}</td>
        <td class="num"><input type="number" min="0" step="0.1" inputmode="decimal" data-jr="${r.id}" data-jkey="actualKg" value="${esc(r.actualKg)}" aria-label="Нақты масса, кг"></td>
        <td class="num"><input type="number" min="0" step="1" inputmode="decimal" data-jr="${r.id}" data-jkey="actualPayment" value="${esc(r.actualPayment)}" aria-label="Нақты төлем, ₸"></td>
        ${journalDiffCells(r)}
        <td><input data-jr="${r.id}" data-jkey="reason" value="${esc(r.reason)}" placeholder="—" aria-label="Себебі"></td>
        <td><button type="button" class="del" data-deljr="${r.id}" aria-label="Жазбаны өшіру">×</button></td>
      </tr>`).join('');
    box.innerHTML = `<div class="scroll"><table class="tbl journal">
        <thead><tr><th>Күні</th><th>Жағдай</th><th>Пункт</th><th class="num">Болжам: масса, кг</th><th class="num">Болжам: төлем</th><th class="num">Болжам: нәтиже</th>
        <th class="num">Нақты масса, кг</th><th class="num">Нақты төлем, ₸</th><th class="num">Айырма</th><th class="num">Айырма, %</th><th>Себебі</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="journal__stats" id="journalStats">${journalStats()}</p>
      <div class="actions"><button class="btn btn--ghost" type="button" id="csvBtn">CSV-ге экспорттау (Excel)</button></div>`;
  }

  function updateJournalRow(id) {
    const r = st().journal.find((x) => x.id === id);
    const cell = $(`[data-jdiff="${id}"]`);
    if (r && cell) {
      cell.nextElementSibling.remove();
      cell.outerHTML = journalDiffCells(r); // кестені қайта салмай, курсор орнында қалады
    }
    $('#journalStats').innerHTML = journalStats();
  }

  /** Калькулятордағы ағымдағы болжамды журналға жазады. */
  App.addJournalRecord = () => {
    const ev = App.evaluate();
    const best = ev.chosen && ev.chosen.revenue > 0 ? ev.chosen : ev.cmp.bestFull || ev.cmp.bestAny;
    if (!best) { alert('Болжамды сақтау үшін бағасы мен қашықтығы белгілі пункт керек.'); return false; }
    const caseName = App.participants().map((p) => p.name).join(', ');
    st().journal.push({
      id: App.S.uid(),
      date: new Date().toISOString(),
      caseName,
      pointName: App.pointById(best.pointId).name,
      mode: st().transport.mode,
      predictedKg: ev.total,
      predictedRevenue: best.revenue,
      predictedFuel: best.fuelCost,
      predictedResult: best.result,
      actualKg: '',
      actualPayment: '',
      reason: ''
    });
    App.save();
    return true;
  };

  function exportCsv() {
    const head = ['Күні', 'Жағдай', 'Пункт', 'Жеткізу тәсілі', 'Болжам: масса, кг', 'Болжам: төлем, ₸', 'Болжам: жанармай, ₸', 'Болжам: нәтиже, ₸', 'Нақты масса, кг', 'Нақты төлем, ₸', 'Себебі'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = st().journal.map((r) => [F.date(r.date), r.caseName, r.pointName, r.mode, r.predictedKg, r.predictedRevenue, r.predictedFuel, r.predictedResult, r.actualKg, r.actualPayment, r.reason].map(cell).join(';'));
    App.download('ecoesep-zhurnal.csv', '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n'), 'text/csv');
  }

  function exportNotes() {
    const text = st().notes.map((n) => `${n.title || 'Атаусыз жазба'} (${F.date(n.date)})\n${n.text}`).join('\n\n---\n\n');
    App.download('ecoesep-zhazbalar.txt', text, 'text/plain');
  }

  function render() {
    renderNotes();
    renderJournal();
  }

  // ---------- оқиғалар ----------
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const title = form.noteTitle.value.trim();
    const text = form.text.value.trim();
    if (!title && !text) { form.text.focus(); return; }
    const now = new Date().toISOString();
    if (editingId) Object.assign(st().notes.find((n) => n.id === editingId), { title, text, updated: now });
    else st().notes.push({ id: App.S.uid(), title, text, date: now });
    App.save();
    resetForm();
    renderNotes();
    App.toast('Жазба сақталды');
  });

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('button');
    if (!el) return;
    const d = el.dataset;
    if (d.tpl) {
      const t = TEMPLATES[d.tpl];
      if (!form.noteTitle.value) form.noteTitle.value = t.title;
      if (!form.text.value || confirm('Мәтінді үлгімен ауыстыру керек пе?')) form.text.value = t.text;
      form.text.focus();
    } else if (d.editnote) {
      const n = st().notes.find((x) => x.id === d.editnote);
      editingId = n.id;
      form.noteTitle.value = n.title;
      form.text.value = n.text;
      $('#noteSave').textContent = 'Өзгерісті сақтау';
      $('#noteCancel').hidden = false;
      form.scrollIntoView({ behavior: 'smooth' });
    } else if (d.delnote) {
      if (!confirm('Жазбаны өшіру керек пе?')) return;
      st().notes = st().notes.filter((n) => n.id !== d.delnote);
      App.save();
      renderNotes();
    } else if (d.deljr) {
      if (!confirm('Журнал жазбасын өшіру керек пе?')) return;
      st().journal = st().journal.filter((r) => r.id !== d.deljr);
      App.save();
      renderJournal();
    } else if (el.id === 'noteCancel') resetForm();
    else if (el.id === 'notesExport') exportNotes();
    else if (el.id === 'csvBtn') exportCsv();
  });

  root.addEventListener('input', (ev) => {
    const d = ev.target.dataset;
    if (!d.jr) return;
    st().journal.find((r) => r.id === d.jr)[d.jkey] = ev.target.value;
    updateJournalRow(d.jr);
    App.save();
  });

  App.views.notes = { title: 'Жазбалар мен журнал', render };
})();
