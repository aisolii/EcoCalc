/* Күйді сақтау: енгізілген деректер тек пайдаланушының браузерінде (localStorage) */
(function () {
  'use strict';
  const KEY = 'ecoesep.v3';
  const OLD_KEY = 'ecoesep.v2';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Math.random().toString(36).slice(2, 9);

  function defaults() {
    const D = window.EcoData;
    return {
      who: 'family',
      materials: clone(D.materials),
      participants: [{ id: uid(), name: '1-отбасы', masses: {}, distanceKm: '' }],
      transport: { mode: 'separate', consumption: '8', fuelPrice: '' },
      points: clone(D.points),
      focusId: null,
      joint: { pointId: null, distanceKm: '' },
      route: { from: '' },
      mapPointId: null,
      step: 1,
      resultTab: 'compare',
      notes: [],
      journal: []
    };
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function load() {
    const s = read(KEY);
    if (s && Array.isArray(s.points) && Array.isArray(s.participants)) return Object.assign(defaults(), s);
    // Алдыңғы нұсқадағы тексеру журналын сақтап қалу
    const fresh = defaults();
    const old = read(OLD_KEY);
    if (old && Array.isArray(old.journal)) fresh.journal = old.journal;
    return fresh;
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* жеке режимде сақталмайды */ }
  }

  window.Store = { load, save, defaults, clone, uid };
})();
