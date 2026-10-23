/* Бөлімдер арасында ауысу (hash-маршрутизация) және хабарламалар */
(function () {
  'use strict';
  const App = window.App;
  const { $, $$ } = App;
  // Мәзір тармақтары және олардың ішкі беттері
  const GROUPS = {
    dash: [['dash', 'Панель']],
    data: [['data', 'Өлшемдер'], ['notes', 'Жазбалар мен журнал']],
    plan: [['plan', 'Жинау күні'], ['route', 'Маршрут'], ['prices', 'Пункттер мен бағалар'], ['map', 'Карта']],
    science: [['analysis', 'Деректер талдауы'], ['model', 'Математикалық модель'], ['calc', 'Отбасы калькуляторы'], ['method', 'Әдістеме']]
  };
  const groupOf = (view) => Object.keys(GROUPS).find((g) => GROUPS[g].some(([v]) => v === view)) || 'dash';

  function route() {
    const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const view = App.views[name] ? name : 'dash';
    const group = groupOf(view);
    const subs = GROUPS[group];
    $('#subnav').hidden = subs.length < 2;
    $('#subnav').innerHTML = subs.map(([v, label]) => `<a href="#/${v}"${v === view ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === group) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `${App.views[view].title} — EcoEsep`;
    App.views[view].render();
    window.scrollTo(0, 0);
  }

  App.toast = (text, href, linkText) => {
    let box = $('#toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast';
      box.className = 'toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.innerHTML = App.esc(text) + (href ? ` <a href="${href}">${App.esc(linkText)}</a>` : '');
    box.classList.add('is-on');
    clearTimeout(App.toast.timer);
    App.toast.timer = setTimeout(() => box.classList.remove('is-on'), 3500);
  };

  // Пункт редакторы жабылғанда калькуляторды жаңарту
  $('#pointDlg').addEventListener('close', () => {
    const name = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dash';
    if (App.views[name]) App.views[name].render();
  });

  const p = App.D.project || {};
  $('#projectMeta').innerHTML = [
    p.author && `Авторы: ${App.esc(p.author)}`,
    p.school && App.esc(p.school),
    p.supervisor && `Ғылыми жетекшісі: ${App.esc(p.supervisor)}`,
    [p.city, p.year].filter(Boolean).map(App.esc).join(', ')
  ].filter(Boolean).join(' · ');

  window.addEventListener('beforeprint', () => { $('#main').dataset.printed = App.F.date(new Date().toISOString()); });
  window.addEventListener('hashchange', route);
  route();
})();
