/* Aegis seed data: the one place for rooms, extras, menus, treatments and availability.
 * Everything here is invented for the prototype (see docs/DESIGN-NOTES.md). Guest data never lives here:
 * bookings, tables and spa slots are kept in sessionStorage by js/site.js.
 * Sold-out nights are relative to today so the calendar always has some to show. */
window.AEGIS_DATA = (() => {
  'use strict';
  const img = (file, w, h, alt) => ({ src: `img/alpine/${file}`, w, h, alt });

  const rooms = [
    {
      id: 'village', name: 'Village Room', price: 210, size: 24, beds: 'Double bed', sleeps: 2, view: 'village',
      summary: 'A snug room under the eaves, looking over the chalet roofs to the far end of the valley.',
      amenities: ['Shower room with heated floor', 'Writing desk', 'Wool blankets and down duvet', 'Tea and coffee tray', 'Fast wifi'],
      gallery: [
        img('chalets.jpg', 1800, 1013, 'Wooden chalet roofs below the hotel, the valley opening toward distant mountains'),
        img('hall-3.jpg', 1800, 1013, 'The far end of the hall, columns receding toward a doorway'),
        img('valley.jpg', 1800, 1350, 'View from the terrace balustrade over the village to green slopes and snow-streaked peaks'),
      ],
    },
    {
      id: 'cliff', name: 'Cliff Room', price: 240, size: 26, beds: 'Queen bed or two singles', sleeps: 2, view: 'cliffs',
      summary: 'Faces the limestone wall above the hotel; the rock turns gold in the last hour of light.',
      amenities: ['Shower room', 'Window seat', 'Twin or queen set-up', 'Tea and coffee tray', 'Fast wifi'],
      gallery: [
        img('hero.jpg', 1800, 1013, 'A green mountain valley under high limestone cliffs'),
        img('morning-fog.jpg', 1800, 1013, 'Early morning mist over the valley, a tall fir in the foreground'),
        img('hall-1.jpg', 1800, 1013, 'Arcaded hall with pink marble columns, black chairs and a grand piano'),
      ],
    },
    {
      id: 'valley', name: 'Valley Room', price: 280, size: 28, beds: 'Queen bed', sleeps: 2, view: 'valley',
      summary: 'Our classic room: a window seat over the meadows and the whole valley floor below.',
      amenities: ['Bath and separate shower', 'Window seat over the meadows', 'Wool blankets and down duvet', 'Minibar with valley cheeses', 'Fast wifi'],
      gallery: [
        img('morning-clear.jpg', 1800, 1013, 'The valley in clear morning light, forest and meadows under the cliffs'),
        img('balcony.jpg', 1800, 1013, 'A balcony lined with red geraniums above a valley of meadows and forest'),
        img('hall-2.jpg', 1800, 1013, 'Lounge under lit vaults, leather armchairs gathered around low tables'),
      ],
    },
    {
      id: 'balcony', name: 'Balcony Room', price: 360, size: 34, beds: 'King bed', sleeps: 3, view: 'valley',
      summary: 'A king bed and a balcony with flower boxes, wide enough for breakfast for two.',
      amenities: ['Balcony with two chairs', 'Bath and separate shower', 'Sofa bed for a third guest', 'Minibar with valley cheeses', 'Fast wifi'],
      gallery: [
        img('balcony.jpg', 1800, 1013, 'A balcony lined with red geraniums above a valley of meadows and forest under morning cloud'),
        img('valley.jpg', 1800, 1350, 'View over the village to green slopes and snow-streaked peaks'),
        img('morning-clear.jpg', 1800, 1013, 'The valley in clear morning light'),
      ],
    },
    {
      id: 'family', name: 'Chalet Family Room', price: 440, size: 46, beds: 'King bed and two singles', sleeps: 4, view: 'village',
      summary: 'Two rooms joined by a short corridor, so parents and children each get a door to close.',
      amenities: ['Two connected rooms', 'Bath and separate shower', 'Board games and a reading corner', 'Cot on request', 'Fast wifi'],
      gallery: [
        img('valley.jpg', 1800, 1350, 'View over the village to green slopes and snow-streaked peaks'),
        img('chalets.jpg', 1800, 1013, 'Wooden chalet roofs below the hotel'),
        img('hall-2.jpg', 1800, 1013, 'Lounge under lit vaults, leather armchairs around low tables'),
      ],
    },
    {
      id: 'tower', name: 'Tower Suite', price: 620, size: 56, beds: 'King bed and sitting room', sleeps: 3, view: 'valley',
      summary: 'The top of the old tower: windows on three sides, a sitting room and a deep bath under the roof beams.',
      amenities: ['Separate sitting room', 'Windows on three sides', 'Freestanding bath', 'Whisky from the library on arrival', 'Fast wifi'],
      gallery: [
        img('morning-fog.jpg', 1800, 1013, 'Early morning mist over the valley seen from high up'),
        img('whisky.jpg', 1200, 1600, 'Floor-to-ceiling shelves of whisky bottles around a small tasting table'),
        img('hero.jpg', 1800, 1013, 'The valley under high limestone cliffs'),
      ],
    },
  ];

  const views = [
    { id: 'valley', name: 'Valley' },
    { id: 'cliffs', name: 'Cliffs' },
    { id: 'village', name: 'Village' },
  ];

  /* unit: 'guest-night' | 'guest' | 'stay' */
  const extras = [
    { id: 'dinner', name: 'Dinner each evening', price: 58, unit: 'guest-night' },
    { id: 'spa', name: 'Spa day pass', price: 45, unit: 'guest' },
    { id: 'transfer', name: 'Station transfer, both ways', price: 60, unit: 'stay' },
    { id: 'late', name: 'Late check-out until 2pm', price: 40, unit: 'stay' },
  ];

  const taxPerGuestNight = 4;
  const maxNights = 14;
  const maxGuests = 4;

  /* Hotel-wide sold-out nights: 24 and 31 December every year, plus a few nights relative to today. */
  const soldOutOffsets = [4, 5, 16, 17, 30];
  /* Single rooms already taken on some nights (offset from today). */
  const roomTaken = { tower: [21, 22, 23], family: [25, 26] };

  const menus = [
    {
      id: 'breakfast', name: 'Breakfast', hours: '7–10:30am',
      sections: [
        { name: 'From the buffet', items: [['Valley cheeses and cured meats', 'Included'], ['Bircher muesli with mountain berries', 'Included'], ['Breads from the village bakery', 'Included']] },
        { name: 'Cooked to order', items: [['Eggs any way, with rösti', 'Included'], ['Buckwheat pancakes, sour cream, apple', 'Included']] },
      ],
    },
    {
      id: 'dinner', name: 'Dinner', hours: '6:30–9:30pm',
      sections: [
        { name: 'To start', items: [['Barley soup with smoked ham', '€14'], ['Trout from the lake, horseradish, dill', '€19'], ['Beetroot, goat’s curd, walnut', '€16']] },
        { name: 'Mains', items: [['Venison, red cabbage, spätzle', '€42'], ['Char, brown butter, alpine herbs', '€38'], ['Mushroom ragout, polenta, mountain cheese', '€31']] },
        { name: 'To finish', items: [['Chocolate plate with a dram pairing', '€18'], ['Apricot tart, cream', '€13']] },
      ],
    },
    {
      id: 'bar', name: 'The bar', hours: '4pm–1am',
      sections: [
        { name: 'At the glass', items: [['Pine gin and tonic', '€15'], ['Valley spritz', '€13'], ['Hot apple and rye', '€12']] },
        { name: 'From the library', items: [['Peated, from the islands', '€16'], ['Sherry cask, from Speyside', '€17'], ['Rye, from down the valley', '€14']] },
      ],
    },
  ];

  const tableSlots = ['18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
  const maxParty = 8;

  const treatments = [
    { id: 'massage', kind: 'Treatment', name: 'Mountain hay massage', mins: 60, price: 120, max: 1, slots: ['10:00', '11:30', '14:00', '15:30', '17:00'] },
    { id: 'stone', kind: 'Treatment', name: 'Warm stone massage', mins: 90, price: 165, max: 1, slots: ['10:00', '13:00', '16:00'] },
    { id: 'facial', kind: 'Treatment', name: 'Alpine herb facial', mins: 50, price: 95, max: 1, slots: ['09:30', '11:00', '14:30', '16:00'] },
    { id: 'sauna', kind: 'Treatment', name: 'Private sauna for two', mins: 75, price: 80, max: 2, slots: ['16:00', '17:30', '19:00', '20:30'] },
    { id: 'walk', kind: 'Experience', name: 'Guided meadow walk', mins: 150, price: 35, max: 4, slots: ['08:30', '14:00'] },
    { id: 'glacier', kind: 'Experience', name: 'Glacier day hike', mins: 420, price: 140, max: 4, slots: ['07:30'] },
    { id: 'tasting', kind: 'Experience', name: 'Whisky library tasting', mins: 60, price: 45, max: 4, slots: ['21:00'] },
  ];

  const hotel = {
    phone: '+41 41 000 12 00',
    email: 'stay@aegis-hotel.example',
    checkIn: '3pm', checkOut: '11am',
  };

  return { rooms, views, extras, taxPerGuestNight, maxNights, maxGuests, soldOutOffsets, roomTaken, menus, tableSlots, maxParty, treatments, hotel };
})();
