'use strict';

// Visitor text can load without WebGL. Pose and arrival coordinates for the
// pilot are local to the matching model frame unless a world pose is marked.
const PILOT_STOPS = ['clock', 'talab', 'rumi'];
const GUIDE_COPY = {
  title: { en: 'Hussainabad heritage walk', hi: 'हुसैनाबाद की विरासत यात्रा', ur: 'حسین آباد کی ورثہ سیر' },
  back: { en: 'Previous', hi: 'पिछला', ur: 'پچھلا' },
  next: { en: 'Next', hi: 'अगला', ur: 'اگلا' },
  play: { en: 'Play', hi: 'चलाएँ', ur: 'چلائیں' },
  pause: { en: 'Pause', hi: 'रोकें', ur: 'روکیں' },
  walk: { en: 'Walk here', hi: 'यहाँ से पैदल चलें', ur: 'یہاں سے پیدل چلیں' },
  itinerary: { en: 'Itinerary', hi: 'यात्रा क्रम', ur: 'سیر کا راستہ' },
  return: { en: 'Back to the scene', hi: 'दृश्य पर लौटें', ur: 'منظر پر واپس جائیں' },
  onFoot: { en: 'Next on foot', hi: 'पैदल अगला पड़ाव', ur: 'اگلا پیدل پڑاؤ' },
  mapOnly: { en: 'Map location', hi: 'नक्शे पर स्थान', ur: 'نقشے پر مقام' },
};
// Waypoints along the modeled plazas and north-side path. Arrival anchors
// and navigation are checked in the scene before a leg is shown.
const PILOT_WAYPOINTS = [
  [-54.5, 26.5, -70.5, 14.5],
  [
    -109.5, 31.5, -107.5, 36.5, -104.5, 39.5, -87.5, 48.5, -51.5, 64.5,
    -32.5, 75.5, 3.5, 91.5, 39.5, 109.5, 53.5, 116.5, 89.5, 132.5,
    90.5, 133.5, 106.5, 141.5, 138.5, 154.5, 157.5, 162.5, 181.5, 169.5,
    213.5, 185.5, 249.5, 202.5, 264.5, 211.5, 296.5, 225.5, 324.5, 238.5,
    345.5, 246.5, 363.5, 261.5, 364.5, 274.5, 367.5, 283.5, 366.5, 292.5, 372.5, 300.5,
  ],
];
const PLACE_CATALOG = {
  clock: {
    name: { en: 'Clock Tower', hi: 'हुसैनाबाद घंटाघर', ur: 'حسین آباد گھنٹہ گھر' },
    description: {
      en: 'Look for the red-brick shaft, the flower-shaped dials and the small domed pavilion at the top. The OpenStreetMap footprint records a height of 67 m. In the model, the clock shows the Lucknow time selected below.',
      hi: 'लाल ईंटों की मीनार, फूल के आकार वाली घड़ियाँ और ऊपर की छोटी गुंबददार छतरी देखें। ओपनस्ट्रीटमैप में इसकी ऊँचाई 67 मीटर दर्ज है। मॉडल की घड़ी नीचे चुना हुआ लखनऊ का समय दिखाती है।',
      ur: 'سرخ اینٹوں کے مینار، پھول کی شکل والے گھڑی کے ڈائل اور اوپر چھوٹی گنبد دار چھتری کو دیکھیے۔ اوپن اسٹریٹ میپ میں اس کی بلندی 67 میٹر درج ہے۔ ماڈل کی گھڑی نیچے منتخب کیا ہوا لکھنؤ کا وقت دکھاتی ہے۔',
    },
    source: 'https://www.openstreetmap.org/?mlat=26.874&mlon=80.90801#map=19/26.874/80.90801',
    frame: 'park', position: [0, 69, 0],
    views: [
      { name: { en: 'From the square', hi: 'चौक से', ur: 'چوک سے' }, cam: [-77, 31, 86], tgt: [-4, 32, 0] },
      { name: { en: 'Clock dial', hi: 'घड़ी का मुख', ur: 'گھڑی کا ڈائل' }, cam: [-13, 54, 25], tgt: [0, 52.15, 0] },
    ],
    walk: [0, 68, 0, 0, 30],
  },
  talab: {
    name: { en: 'Husainabad Talab', hi: 'हुसैनाबाद तालाब', ur: 'حسین آباد تالاب' },
    description: {
      en: 'Eight banks of stone steps lead down to the water in the model. Start at the opening in the south railing and look across the tank to the Picture Gallery.',
      hi: 'मॉडल में आठ ओर की पत्थर की सीढ़ियाँ पानी तक जाती हैं। दक्षिणी रेलिंग के खुले हिस्से से शुरू करें और तालाब के पार पिक्चर गैलरी देखें।',
      ur: 'ماڈل میں آٹھ سمتوں سے پتھر کی سیڑھیاں پانی تک اترتی ہیں۔ جنوبی ریلنگ کے کھلے حصے سے شروع کریں اور تالاب کے پار تصویر گیلری کو دیکھیے۔',
    },
    source: 'https://www.openstreetmap.org/?mlat=26.87432&mlon=80.90725#map=19/26.87432/80.90725',
    frame: 'park', position: [-85.7, 7, 1.7],
    views: [
      { name: { en: 'Across the tank', hi: 'तालाब के पार', ur: 'تالاب کے پار' }, cam: [-51, 35, 72], tgt: [-85.7, 0, -17] },
    ],
    walk: [-85.7, 42, -85.7, 0, 0],
  },
  rumi: {
    name: { en: 'Rumi Darwaza', hi: 'रूमी दरवाज़ा', ur: 'رومی دروازہ' },
    description: {
      en: 'Compare the two faces in the model. The west face frames the passage with a broad scalloped arch and a half-dome. The Bara Imambara side has tiers of smaller arches. The same pavilion crowns both views.',
      hi: 'मॉडल में दरवाज़े के दोनों मुख देखें। पश्चिम में रास्ते को कंगूरेदार बड़ी मेहराब और अर्धगुंबद घेरते हैं। बड़े इमामबाड़े की ओर छोटी मेहराबों की कतारें हैं। दोनों ओर से ऊपर वही छतरी दिखती है।',
      ur: 'ماڈل میں دروازے کے دونوں رخ دیکھیے۔ مغرب میں چوڑی کنگرہ دار محراب اور نیم گنبد گزرگاہ کو گھیرتے ہیں۔ بڑے امام باڑے کی جانب چھوٹی محرابوں کی قطاریں ہیں۔ دونوں رخوں سے اوپر وہی چھتری نظر آتی ہے۔',
    },
    source: 'https://www.openstreetmap.org/?mlat=26.87122&mlon=80.91217#map=19/26.87122/80.91217',
    frame: 'rumi', position: [0, 31, 0],
    views: [
      { name: { en: 'West face', hi: 'पश्चिमी मुख', ur: 'مغربی رخ' }, cam: [18, 13, 61], tgt: [0, 14, 0] },
      { name: { en: 'East face', hi: 'पूर्वी मुख', ur: 'مشرقی رخ' }, cam: [4, 14, -64], tgt: [0, 14, 0] },
    ],
    walk: [9, 39, 0, 0, 16],
  },
  jama: {
    name: { en: 'Jama Masjid', hi: 'जामा मस्जिद', ur: 'جامع مسجد' },
    description: {
      en: 'The OpenStreetMap footprint marks Jama Masjid west of the detailed heritage corridor. It can be located on the map.',
      hi: 'ओपनस्ट्रीटमैप में जामा मस्जिद विस्तृत विरासत क्षेत्र के पश्चिम में दर्ज है। उसका स्थान नक्शे पर देख सकते हैं।',
      ur: 'اوپن اسٹریٹ میپ میں جامع مسجد تفصیلی ورثہ گزرگاہ کے مغرب میں درج ہے۔ اس کا مقام نقشے پر دیکھا جا سکتا ہے۔',
    },
    source: 'https://www.openstreetmap.org/?mlat=26.87289&mlon=80.9011#map=19/26.87289/80.9011',
    mapOnly: true, frame: 'jama', position: [0, 0, 0],
  },
};

function visitorText(values, locale) {
  const lang = Object.hasOwn(values, locale) && values[locale] ? locale : 'en';
  return { text: values[lang], lang, dir: lang === 'ur' ? 'rtl' : 'ltr' };
}

function writeVisitorText(element, values, locale) {
  const { text, lang, dir } = visitorText(values, locale);
  element.textContent = text;
  element.lang = lang;
  element.dir = dir;
}

function renderItinerary(list, locale) {
  list.replaceChildren();
  for (const id of PILOT_STOPS) {
    const place = PLACE_CATALOG[id];
    const item = document.createElement('li');
    const name = document.createElement('h3');
    const description = document.createElement('p');
    writeVisitorText(name, place.name, locale);
    writeVisitorText(description, place.description, locale);
    item.append(name, description);
    list.append(item);
  }
}
