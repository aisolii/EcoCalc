/* Бөлімдер арасында ауысу (hash-маршрутизация), бүйірлік мәзір және хабарламалар */
(function () {
  'use strict';
  const App = window.App;
  const { $, $$ } = App;
  const side = $('#sidebar');
  const scrim = $('#scrim');
  const menuBtn = $('#menuBtn');

  function setMenu(open) {
    side.classList.toggle('is-open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  }

  function route() {
    const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const view = App.views[name] ? name : 'calc';
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('#topTitle').textContent = App.views[view].title;
    document.title = `${App.views[view].title} — EcoEsep`;
    App.views[view].render();
    setMenu(false);
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

  // Пункт редакторы сақталғанда ағымдағы бөлімді жаңарту
  $('#pointDlg').addEventListener('close', () => {
    const name = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'calc';
    if (name === 'calc' && App.views.calc) App.views.calc.render();
  });

  menuBtn.addEventListener('click', () => setMenu(!side.classList.contains('is-open')));
  scrim.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') setMenu(false); });

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
