/*
 * Бастапқы деректер.
 * НАЗАР АУДАРЫҢЫЗ: төмендегі пункттер — алгоритмді көрсету және тексеру үшін алынған ШАРТТЫ деректер.
 * Оларды тексерілген мәліметтермен (қоңырау, прайс, бару) интерфейс арқылы немесе осы файлда ауыстырыңыз.
 * Расталмаған бағаны null деп жазыңыз — калькулятор «нақтыланбаған» деп көрсетеді.
 */
window.EcoData = {
  // Жоба туралы мәлімет — төменгі деректемеде көрсетіледі (бос өрістер шықпайды)
  project: {
    author: '',
    school: '',
    supervisor: '',
    city: 'Көкшетау',
    year: '2026'
  },

  // Атаулар пункттердің қабылдау шарттарымен сәйкес келуі керек — жалпы «пластик» емес
  materials: [
    { id: 'paper', name: 'Қағаз', hint: 'газеттер, дәптерлер, кеңсе қағазы' },
    { id: 'cardboard', name: 'Картон', hint: 'гофрокартон, қораптар' },
    { id: 'pet_clear', name: 'Мөлдір ПЭТ бөтелкелер', hint: '1 таңбалы, қақпақсыз' },
    { id: 'pet_color', name: 'Түсті ПЭТ бөтелкелер', hint: '1 таңбалы' },
    { id: 'hdpe', name: 'HDPE пластик', hint: 'канистрлер, флакондар, 2 таңбалы' },
    { id: 'alu', name: 'Алюминий банкалар', hint: 'сусын банкалары' },
    { id: 'glass', name: 'Шыны ыдыс', hint: 'бөтелкелер, банкалар' }
  ],

  points: [
    {
      id: 'demo-a',
      name: 'А пункті',
      address: 'шартты мекенжай',
      prices: { paper: 40, cardboard: 35 },
      minBatch: {},
      requirements: 'құрғақ, скотчсыз және үлдірсіз',
      checkedAt: '',
      source: 'шартты деректер',
      confirmed: false,
      oneWayKm: 5,
      detourKm: 3
    },
    {
      id: 'demo-b',
      name: 'Б пункті',
      address: 'шартты мекенжай',
      prices: { pet_clear: 60, pet_color: 30, alu: 250, paper: 35 },
      minBatch: { pet_clear: 5 },
      requirements: 'бөтелкелерді жаныштап, қақпағын алу',
      checkedAt: '',
      source: 'шартты деректер',
      confirmed: false,
      oneWayKm: 8,
      detourKm: 4
    },
    {
      id: 'demo-c',
      name: 'В пункті',
      address: 'шартты мекенжай',
      prices: { paper: 30, cardboard: 30, pet_clear: 50, hdpe: null, glass: null },
      minBatch: { paper: 10 },
      requirements: 'түрлері бойынша сұрыптау',
      checkedAt: '',
      source: 'шартты деректер',
      confirmed: false,
      oneWayKm: 12,
      detourKm: 6
    }
  ],

  // Қорғауға арналған оқу мысалы (шартты деректер)
  example: {
    masses: { paper: 5 },
    point: {
      id: 'example', name: 'Оқу мысалындағы пункт', address: '—', prices: { paper: 40 }, minBatch: {},
      requirements: '', checkedAt: '', source: 'шартты деректер', confirmed: false, oneWayKm: 5, detourKm: 10
    },
    transport: { mode: 'onway', consumption: 10, fuelPrice: 300 }
  }
};
