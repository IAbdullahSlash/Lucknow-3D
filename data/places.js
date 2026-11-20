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

const SHOP_COPY = {
  title: { en: 'Street shops', hi: 'सड़क की दुकानें', ur: 'سڑک کی دکانیں' },
  landmarks: { en: 'Landmarks', hi: 'दर्शनीय स्थल', ur: 'اہم مقامات' },
  interpreted: { en: 'Illustrated storefront', hi: 'दुकान का कल्पित रूप', ur: 'دکان کی تخیّلی جھلک' },
  mapped: { en: 'Mapped location · illustrated storefront', hi: 'नक्शे का स्थान · दुकान का कल्पित रूप', ur: 'نقشے کا مقام · دکان کی تخیّلی جھلک' },
  service: { en: 'At the counter', hi: 'काउंटर के पास', ur: 'کاؤنٹر کے پاس' },
  approach: { en: 'From the street', hi: 'सड़क से', ur: 'سڑک سے' },
  opposite: { en: 'From the square', hi: 'चौक से', ur: 'چوک سے' },
};

// Anchors are metres in the given frame. A bay uses its zero-based slot on
// the Chota wall. Service hours drive the scene in IST and are illustrative.
const SHOP_CATALOG = {
  'tunday-kababi': {
    name: { en: 'Tunday Kababi', hi: 'टुंडे कबाबी', ur: 'ٹنڈے کبابی' },
    aliases: ['Tunde Ke Kabab'],
    description: {
      en: 'This park stall depicts galawati kebabs cooked on a broad iron tawa. Watch the cook on the left and collect plates at the right-hand end. The stall is an illustration of the dish and its service in Lucknow.',
      hi: 'इस कल्पित स्टॉल में गलावटी कबाब लोहे के चौड़े तवे पर बनते हैं। बाईं ओर तवा देखें और दाईं ओर परोसने की जगह।',
      ur: 'اس تخیّلی اسٹال میں گلاوٹی کباب چوڑے لوہے کے توے پر بنتے ہیں۔ بائیں جانب توا اور دائیں جانب کھانا لینے کی جگہ دیکھیں۔',
    },
    placement: 'interpreted', frame: 'park', anchor: [-52, 60], facing: 0, kind: 'stall',
    area: 'Clock Tower and Talab square', sign: ['#711f22', '#ffedc5'],
    arrival: [0, 8.1], reserve: [4.2, -3.8, 9.0], hours: [10.75, 23.1],
  },
  'globe-cafe': {
    name: { en: 'Globe Cafe 24x7', hi: 'ग्लोब कैफ़े 24x7', ur: 'گلوب کیفے 24x7' },
    aliases: ['Globe', 'Globe Cafe'],
    description: {
      en: 'Look for the striped awning, recessed entrance and a window seat. “24x7” is the name on the model’s sign. Opening and closing here follow the scene’s clock.',
      hi: 'धारीदार शामियाना, अंदर की ओर बना प्रवेश और खिड़की के पास बैठने की जगह देखें। यहाँ दुकान का खुलना और बंद होना दृश्य के समय के अनुसार है।',
      ur: 'دھاری دار سائبان، اندر کی طرف بنا دروازہ اور کھڑکی کے پاس نشست دیکھیں۔ یہاں دکان کا کھلنا اور بند ہونا منظر کے وقت کے مطابق ہے۔',
    },
    placement: 'interpreted', anchor: [-98.20, 64.40], facing: 2.69274, kind: 'frontage',
    area: 'Husainabad Trust Road', sign: ['#213b42', '#fff1c8'], width: 6.2, depth: 7.6,
    arrival: [-0.45, 2.65], reserve: [4.5, -0.5, 4.7], hours: [8.0, 23.85],
  },
  'irani-chai': {
    name: { en: 'Irani Chai', hi: 'ईरानी चाय', ur: 'ایرانی چائے' },
    description: {
      en: 'Find the tea counter beside Zaika on the Chota Imambara wall. The metal urn, glasses and serving ledge mark this bay.',
      hi: 'छोटे इमामबाड़े की दीवार पर ज़ायक़ा के पास चाय का काउंटर देखें। धातु की केतली, गिलास और परोसने की चौकी से इसे पहचानें।',
      ur: 'چھوٹے امام باڑے کی دیوار کے ساتھ ذائقہ کے پاس چائے کا کاؤنٹر دیکھیں۔ دھات کی کیتلی، گلاس اور اونچی چوکی اس کی پہچان ہیں۔',
    },
    placement: 'interpreted', frame: 'chota', bay: 6, facing: Math.PI, kind: 'bay',
    area: 'Chota Imambara wall', sign: ['#164942', '#fff4d6'],
    arrival: [-0.45, 4.7], reserve: [2.05, -0.55, 5.6], hours: [6, 22.1],
  },
  'irani-dum-tea': {
    name: { en: 'Irani Dum Tea', hi: 'ईरानी दम टी', ur: 'ایرانی دم چائے' },
    description: {
      en: 'The copper-coloured tea urn and biscuit jars sit near the east end of the Chota Imambara shop row. Continue along the wall for the other tea counter beside Zaika.',
      hi: 'छोटे इमामबाड़े की दुकानों की कतार के पूर्वी छोर के पास चाय का तांबे रंग का बर्तन और बिस्कुट की बरनियाँ देखें।',
      ur: 'چھوٹے امام باڑے کی دکانوں کی قطار کے مشرقی سرے کے پاس تانبئی چائے دان اور بسکٹ کی برنیاں دیکھیں۔',
    },
    placement: 'interpreted', frame: 'chota', bay: 3, facing: Math.PI, kind: 'bay',
    area: 'Chota Imambara wall', sign: ['#603927', '#ffefd1'],
    arrival: [0, 4.4], reserve: [1.95, -0.55, 5.2], hours: [5.6, 21.2],
  },
  'chai-mahal': {
    name: { en: 'Chai Mahal', hi: 'चाय महल', ur: 'چائے محل' },
    description: {
      en: 'The bundled OpenStreetMap extract marks Chai Mahal at the west edge of the Talab square. Find the blue-green kiosk with a kettle and cups.',
      hi: 'बंडल के ओपनस्ट्रीटमैप में तालाब चौक के पश्चिमी किनारे पर चाय महल दर्ज है। केतली और प्यालों वाली नीली-हरी दुकान देखें।',
      ur: 'ساتھ دیے گئے اوپن اسٹریٹ میپ میں چائے محل تالاب کے چوک کے مغربی کنارے پر درج ہے۔ کیتلی اور پیالیوں والی نیلگوں دکان دیکھیں۔',
    },
    placement: 'mapped', frame: 'park', anchor: [-142, 4], facing: Math.PI / 2, kind: 'kiosk',
    source: 'https://www.openstreetmap.org/?mlat=26.87453&mlon=80.90671#map=19/26.87453/80.90671',
    area: 'Talab square, west edge', sign: ['#17484b', '#fff1c4'],
    arrival: [0, 4.6], reserve: [2.4, -1.5, 5.2], hours: [5.4, 21],
  },
  'kamar-sheermal': {
    name: { en: 'Kamar Sheermal Shop', hi: 'क़मर शीरमाल शॉप', ur: 'قمر شیرمال شاپ' },
    description: {
      en: 'Look for the amber bread rounds stacked at the counter. The kiosk depicts sheermal, the lightly sweet flatbread made and sold in Lucknow.',
      hi: 'काउंटर पर रखी सुनहरी गोल रोटियाँ देखें। यह दुकान लखनऊ की हल्की मीठी रोटी शीरमाल दिखाती है।',
      ur: 'کاؤنٹر پر رکھی سنہری گول روٹیاں دیکھیں۔ یہاں لکھنؤ کی ہلکی میٹھی روٹی شیرمال دکھائی گئی ہے۔',
    },
    placement: 'interpreted', frame: 'park', anchor: [-17, 15], facing: 0, kind: 'kiosk',
    area: 'Clock Tower square', sign: ['#55331f', '#ffe1a1'],
    arrival: [0, 4.6], reserve: [2.4, -1.5, 5.2], hours: [8.5, 21.8],
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

function renderPlaceList(list, records, locale) {
  list.replaceChildren();
  for (const place of records) {
    const item = document.createElement('li');
    const name = document.createElement('h3');
    const description = document.createElement('p');
    writeVisitorText(name, place.name, locale);
    writeVisitorText(description, place.description, locale);
    item.append(name);
    if (place.placement) {
      const note = document.createElement('small');
      writeVisitorText(note, SHOP_COPY[place.placement], locale);
      item.append(note);
    }
    item.append(description);
    list.append(item);
  }
}

function renderItinerary(list, locale) {
  renderPlaceList(list, PILOT_STOPS.map(id => PLACE_CATALOG[id]), locale);
}
