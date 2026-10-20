/* Сандар мен мәтінді пішімдеу */
(function () {
  'use strict';
  // Қазақстанда бөлшек бөлігі үтірмен, разрядтар бос орынмен бөлінеді.
  // Кейбір браузерлерде kk-KZ локалі жоқ, сондықтан дәл осындай ережесі бар ru-RU қолданылады.
  const LOCALE = 'ru-RU';
  const cache = {};
  const pad = (n) => String(n).padStart(2, '0');
  const nf = (digits) => (cache[digits] ||= new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }));
  // Теріс сандар үшін типографиялық минус
  const minus = (s) => s.replace(/^[-−]/, '−');

  const num = (n, d = 2) => minus(nf(d).format(Math.abs(n) < 1e-9 ? 0 : n));

  window.Fmt = {
    num,
    money: (n) => num(Math.abs(n) < 0.05 ? 0 : n, 1) + '\u00a0₸',
    kg: (n) => num(n) + '\u00a0кг',
    km: (n) => num(n, 1) + '\u00a0км',
    lit: (n) => num(n) + '\u00a0л',
    pct: (n) => num(n, 1) + '\u00a0%',
    date: (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    },
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  };
})();
