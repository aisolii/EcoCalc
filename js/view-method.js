/* Әдістеме: оқу мысалы калькулятордың өз функцияларымен есептеледі, пайдаланушы деректері өзгермейді */
(function () {
  'use strict';
  const App = window.App;
  const { C, F, $ } = App;

  function render() {
    const ex = App.D.example;
    const e = C.evaluatePoint(ex.point, ex.masses, ex.transport);
    const th = e.thresholds.find((x) => x.matId === 'paper');
    const t = ex.transport;
    $('#exampleCard').innerHTML = `<h2 class="h3">Оқу мысалы (шартты деректер)</h2>
      <p class="hint">Қағаз ${F.kg(ex.masses.paper)}, бағасы ${ex.point.prices.paper} ₸/кг; жолға қосымша ${F.km(ex.point.detourKm)}; отын шығыны ${t.consumption} л/100 км; жанармай ${t.fuelPrice} ₸/л. Сандар калькулятордың өзімен есептелген.</p>
      <ol class="steps">
        <li><span>Түсім</span><code>R = 5 кг × 40 ₸/кг = <b>${F.money(e.revenue)}</b></code></li>
        <li><span>Отын</span><code>Q = ${F.num(e.distanceKm)} × ${t.consumption} / 100 = <b>${F.lit(e.liters)}</b></code></li>
        <li><span>Жанармай шығыны</span><code>C = ${F.num(e.liters)} л × ${t.fuelPrice} ₸/л = <b>${F.money(e.fuelCost)}</b></code></li>
        <li><span>Нәтиже</span><code>B = ${F.num(e.revenue)} − ${F.num(e.fuelCost)} = <b class="${App.sign(e.result)}">${F.money(e.result)}</b></code></li>
        <li><span>Жинақтау шегі</span><code>m<sub>min</sub> = ${F.num(e.fuelCost)} / 40 = <b>${F.kg(th.mMin)}</b></code></li>
      </ol>
      <p>Қорытынды: 5 кг қағаз үшін арнайы бару тиімсіз; кемінде ${F.kg(th.mMin)} жинау немесе басқа сапармен біріктіру керек.</p>`;
  }

  App.views.method = { title: 'Әдістеме', render };
  App.views.help = { title: 'Нұсқаулық', render() {} };
})();
