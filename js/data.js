/*
 * Исходные данные.
 * ВНИМАНИЕ: пункты ниже — УСЛОВНЫЕ данные для демонстрации и проверки алгоритма.
 * Замените их проверенными сведениями (звонок, прайс, визит) через интерфейс или этот файл.
 * Неподтверждённую цену записывайте как null — калькулятор покажет «уточняется».
 */
window.EcoData = {
  // Названия должны совпадать с условиями приёма пунктов, а не «пластик вообще»
  materials: [
    { id: 'paper', name: 'Бумага', hint: 'газеты, тетради, офисная' },
    { id: 'cardboard', name: 'Картон', hint: 'гофрокартон, коробки' },
    { id: 'pet_clear', name: 'ПЭТ-бутылки прозрачные', hint: 'маркировка 1, без крышек' },
    { id: 'pet_color', name: 'ПЭТ-бутылки цветные', hint: 'маркировка 1' },
    { id: 'hdpe', name: 'Пластик ПНД', hint: 'канистры, флаконы, маркировка 2' },
    { id: 'alu', name: 'Алюминиевые банки', hint: 'из-под напитков' },
    { id: 'glass', name: 'Стеклянная тара', hint: 'бутылки, банки' }
  ],

  points: [
    {
      id: 'demo-a',
      name: 'Пункт А',
      address: 'условный адрес',
      prices: { paper: 40, cardboard: 35 },
      minBatch: {},
      requirements: 'Сухая, без скотча и плёнки',
      checkedAt: '',
      source: 'условные данные',
      confirmed: false,
      oneWayKm: 5,
      detourKm: 3
    },
    {
      id: 'demo-b',
      name: 'Пункт Б',
      address: 'условный адрес',
      prices: { pet_clear: 60, pet_color: 30, alu: 250, paper: 35 },
      minBatch: { pet_clear: 5 },
      requirements: 'Бутылки сплющить, крышки снять',
      checkedAt: '',
      source: 'условные данные',
      confirmed: false,
      oneWayKm: 8,
      detourKm: 4
    },
    {
      id: 'demo-c',
      name: 'Пункт В',
      address: 'условный адрес',
      prices: { paper: 30, cardboard: 30, pet_clear: 50, hdpe: null, glass: null },
      minBatch: { paper: 10 },
      requirements: 'Разделить по видам',
      checkedAt: '',
      source: 'условные данные',
      confirmed: false,
      oneWayKm: 12,
      detourKm: 6
    }
  ],

  // Учебный пример для защиты (условные данные)
  example: {
    masses: { paper: 5 },
    point: { id: 'example', name: 'Учебный пункт', address: '—', prices: { paper: 40 }, minBatch: {},
      requirements: '', checkedAt: '', source: 'условные данные', confirmed: false, oneWayKm: 5, detourKm: 10 },
    transport: { mode: 'onway', consumption: 10, fuelPrice: 300 }
  }
};
