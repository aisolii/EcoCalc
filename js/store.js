/* Күйді сақтау: енгізілген деректер тек пайдаланушының браузерінде (localStorage) */
(function () {
  'use strict';
  const KEY = 'ecoesep.v2';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Math.random().toString(36).slice(2, 9);

  function defaults() {
    const D = window.EcoData;
    return {
      who: 'family',
      materials: clone(D.materials),
      participants: [{ id: uid(), name: '1-отбасы', masses: { paper: '12', cardboard: '6', pet_clear: '3' }, distanceKm: '10' }],
      transport: { mode: 'separate', consumption: '9', fuelPrice: '300' },
      points: clone(D.points),
      focusId: null,
      joint: { pointId: null, distanceKm: '14' },
      journal: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.points) || !Array.isArray(s.participants)) return defaults();
      return Object.assign(defaults(), s);
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* жеке режимде сақталмайды */ }
  }

  window.Store = { load, save, defaults, clone, uid };
})();
