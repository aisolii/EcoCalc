/*
 * Бастапқы деректер: Көкшетау қаласындағы қайталама шикізат қабылдау пункттері.
 *
 * Мәліметтер ашық дереккөздерден жиналды (LS Ecolife сайты, 2ГИС және spravker.ru каталогтары, 22.10.2026).
 * Бірде-бір баға пункттің өзімен телефон арқылы расталмаған, сондықтан барлығы confirmed: false.
 * Сайттағы бағаларда күні көрсетілмеген және олар көлемге байланысты өзгереді, сондықтан price өрісіне
 * шағын көлемге арналған ЕҢ ТӨМЕНГІ баға жазылды, ал толық аралық priceNotes өрісінде көрсетілген.
 * Бағасы белгісіз материал — null («нақтыланбаған»), ол түсімге кірмейді.
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

  foundAt: '2026-10-22',

  // Атаулар пункттердің қабылдау шарттарына сәйкес келеді — жалпы «пластик» емес
  materials: [
    { id: 'paper', name: 'Макулатура', hint: 'газеттер, кітаптар, дәптерлер, кеңсе қағазы' },
    { id: 'cardboard', name: 'Картон', hint: 'гофрокартон, қораптар' },
    { id: 'pet', name: 'ПЭТ бөтелкелер', hint: '1 таңбалы, сусын бөтелкелері' },
    { id: 'hdpe', name: 'ПНД пластик', hint: 'канистрлер, тұрмыстық химия флакондары, 2 таңбалы' },
    { id: 'film', name: 'Полиэтилен үлдір', hint: 'орам үлдірі, пакеттер' },
    { id: 'alu', name: 'Алюминий банкалар', hint: 'сусын банкалары' },
    { id: 'glass', name: 'Шыны', hint: 'бөтелкелер, шыны сынығы' }
  ],

  points: [
    {
      id: 'ls-ualikhanov',
      name: 'LS Kokshetau — бас пункт',
      org: 'LS Ecolife',
      address: 'Ш. Уәлиханов көшесі, 183Б',
      mapQuery: 'Кокшетау, улица Шокана Уалиханова, 183Б',
      phone: '+7 701 503 38 48',
      hours: '',
      prices: { paper: 15, cardboard: 8, pet: 35, hdpe: null, film: null, alu: 100, glass: 12 },
      priceNotes: {
        paper: 'сайтта 15–60 ₸/кг; журнал, кітап, газет 36–50 ₸/кг',
        cardboard: 'сайтта 8–35 ₸/кг, көлемге байланысты',
        pet: 'сайтта 35–140 ₸/кг, көлемге байланысты',
        hdpe: 'қабылданады, бағасы сайтта анық емес',
        film: 'қабылданады, бағасы сайтта анық емес',
        alu: 'сайтта 100–280 ₸/кг',
        glass: 'түссіз шыны сынығы 12 ₸/кг'
      },
      minBatch: {},
      requirements: 'макулатура құрғақ және таза, пластик түптеусіз және файлсыз; бөтелкелердегі сұйықтықты төгу; скотчты барынша алып тастау',
      source: 'ls.com.kz сайты (Көкшетау прайсы, күні көрсетілмеген), 2ГИС',
      links: [
        { title: 'LS Ecolife — Көкшетау прайсы', url: 'https://ls.com.kz/pages/price.html' },
        { title: 'LS Ecolife — қабылдау пункттерінің картасы', url: 'https://ls.com.kz/maps' },
        { title: '2ГИС карточкасы', url: 'https://2gis.kz/kokshetau/firm/70000001034624912' }
      ],
      checkedAt: '',
      confirmed: false,
      inCompare: true,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'ls-abylai',
      name: 'LS Kokshetau — Абылай хан даңғылы',
      org: 'LS Ecolife',
      address: 'Абылай хан даңғылы, 30А',
      mapQuery: 'Кокшетау, проспект Абылай хана, 30А',
      phone: '+7 701 503 38 48',
      hours: '',
      prices: { paper: null, cardboard: null, pet: null, glass: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: 'Каталогта LS желісінің пункті ретінде көрсетілген (шыны қабылдау). Материалдар тізімі мен бағаларын телефонмен нақтылау керек.',
      source: '2ГИС, kokshetaumaps.ru каталогтары',
      links: [],
      checkedAt: '',
      confirmed: false,
      inCompare: true,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'ls-zhibek',
      name: 'LS Kokshetau — «Жібек» базары',
      org: 'LS Ecolife',
      address: 'Төлеу Сүлейменов көшесі, 2А/10',
      mapQuery: 'Кокшетау, улица Толеу Сулейменова, 2А',
      phone: '+7 701 503 38 48',
      hours: '',
      prices: { paper: null, cardboard: null, pet: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: '2ГИС тізімінде LS желісінің пункті. Жұмыс істейтінін алдын ала тексеріңіз.',
      source: '2ГИС каталогы',
      links: [],
      checkedAt: '',
      confirmed: false,
      inCompare: false,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'ls-osipenko',
      name: 'Қабылдау пункті — Осипенко көшесі',
      org: '',
      address: 'Полина Осипенко көшесі, 12',
      mapQuery: 'Кокшетау, улица Полины Осипенко, 12',
      phone: '',
      hours: '',
      prices: { paper: null, cardboard: null, pet: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: 'Каталогтарда вторшикізат қабылдау пункті ретінде көрсетілген; 2ГИС-те бір пункт «жабық» деп белгіленген — жұмыс істейтінін тексеріңіз.',
      source: '2ГИС, spravker.ru каталогтары',
      links: [],
      checkedAt: '',
      confirmed: false,
      inCompare: false,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'ls-abai',
      name: 'LS Kokshetau — Абай көшесі',
      org: 'LS Ecolife',
      address: 'Абай Құнанбаев көшесі, 51Д',
      mapQuery: 'Кокшетау, улица Абая Кунанбаева, 51Д',
      phone: '+7 701 503 38 48',
      hours: '',
      prices: { paper: null, cardboard: null, pet: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: '2ГИС тізімінде LS желісінің пункті.',
      source: '2ГИС каталогы',
      links: [],
      checkedAt: '',
      confirmed: false,
      inCompare: false,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'abulkasymov',
      name: 'Картон мен макулатура қабылдау пункті',
      org: '',
      address: 'Мағзи Әбілқасымов көшесі, 61',
      mapQuery: 'Кокшетау, улица Магзи Абулкасымова, 61',
      phone: '',
      hours: '',
      prices: { paper: null, cardboard: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: 'Каталогта картон мен макулатура қабылдау пункті ретінде көрсетілген.',
      source: 'spravker.ru каталогы',
      links: [{ title: 'spravker.ru: стеклотара қабылдау пункттері', url: 'https://koshketau.spravker.ru/priemnyie-punktyi-steklotaryi/' }],
      checkedAt: '',
      confirmed: false,
      inCompare: true,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'saryarka',
      name: 'Қайталама шикізат қабылдау пункті — Сарыарқа',
      org: '',
      address: 'Сарыарқа шағын ауданы, 15/5',
      mapQuery: 'Кокшетау, микрорайон Сарыарка, 15/5',
      phone: '',
      hours: '',
      prices: { paper: null, cardboard: null, pet: null, glass: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: 'Каталогтарда «пункт приёма вторсырья» ретінде көрсетілген; нақты қандай материал қабылданатыны белгісіз.',
      source: 'spravker.ru, 2ГИС каталогтары',
      links: [{ title: 'spravker.ru: металл сынығын қабылдау', url: 'https://koshketau.spravker.ru/priyom-metalloloma/' }],
      checkedAt: '',
      confirmed: false,
      inCompare: true,
      oneWayKm: '',
      detourKm: ''
    },
    {
      id: 'vasilkovsky',
      name: 'Қабылдау пункті — Васильковский',
      org: '',
      address: 'Васильковский шағын ауданы, 34/1',
      mapQuery: 'Кокшетау, микрорайон Васильковский, 34/1',
      phone: '',
      hours: 'күн сайын 09:00–23:00 (каталог бойынша)',
      prices: { pet: null, glass: null, cardboard: null },
      priceNotes: {},
      minBatch: {},
      requirements: '',
      note: 'Каталог деректері бойынша; кімге тиесілі және не қабылдайтынын нақтылау керек.',
      source: '2ГИС каталогы',
      links: [],
      checkedAt: '',
      confirmed: false,
      inCompare: false,
      oneWayKm: '',
      detourKm: ''
    }
  ],

  // Қорғауға арналған оқу мысалы (ШАРТТЫ деректер, нақты пункттерге қатысы жоқ)
  example: {
    masses: { paper: 5 },
    point: {
      id: 'example', name: 'Оқу мысалындағы пункт (шартты)', address: '—', mapQuery: '', phone: '', hours: '',
      prices: { paper: 40 }, priceNotes: {}, minBatch: {}, requirements: '', note: '', links: [],
      checkedAt: '', source: 'шартты деректер', confirmed: false, inCompare: true, oneWayKm: 5, detourKm: 10
    },
    transport: { mode: 'onway', consumption: 10, fuelPrice: 300 }
  },

  // Пункттерге қоңырау шалғанда сұралатын сұрақтар
  callScript: [
    'Сәлеметсіз бе! Мен мектеп оқушысымын, қайталама шикізатты өткізу туралы ғылыми жоба жасап жатырмын.',
    'Сіздер қандай материалдарды қабылдайсыздар: макулатура, картон, ПЭТ бөтелке, ПНД канистр, үлдір, алюминий банка, шыны?',
    'Әр материалдың 1 килограмы қанша тұрады? Аз көлемге (10–50 кг) баға қандай?',
    'Ең аз партия бар ма?',
    'Қандай талаптар бар: тазалығы, құрғақтығы, сұрыптау, қақпақтар?',
    'Жұмыс уақыттарыңыз қандай?',
    'Рақмет! Бағаларды жобада сіздің атыңызбен және бүгінгі күнмен көрсетуге бола ма?'
  ]
};
