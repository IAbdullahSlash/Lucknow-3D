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
};

const SHOP_COPY = {
  title: { en: 'Street shops', hi: 'सड़क की दुकानें', ur: 'سڑک کی دکانیں' },
  interpreted: { en: 'Illustrated storefront', hi: 'दुकान का कल्पित रूप', ur: 'دکان کی تخیّلی جھلک' },
  mapped: { en: 'Mapped location · illustrated storefront', hi: 'नक्शे का स्थान · दुकान का कल्पित रूप', ur: 'نقشے کا مقام · دکان کی تخیّلی جھلک' },
  photographed: { en: 'Listed location · storefront from photos', hi: 'सूचीबद्ध स्थान · तस्वीरों से बनी दुकान', ur: 'درج شدہ مقام · تصاویر سے بنی دکان' },
  service: { en: 'At the counter', hi: 'काउंटर के पास', ur: 'کاؤنٹر کے پاس' },
  approach: { en: 'From the street', hi: 'सड़क से', ur: 'سڑک سے' },
};

// Anchors are metres in the given frame (world when no frame is named). A bay
// uses its zero-based slot on the Chota wall. `style` picks the builder in
// src/shops.js. Hours drive the scene in IST; sources are in
// docs/astra-6.2/shop-references.md.
const SHOP_CATALOG = {
  'tunday-kababi': {
    name: { en: 'Tunday Kababi', hi: 'टुंडे कबाबी', ur: 'ٹنڈے کبابی' },
    aliases: ['Tunde Ke Kabab', 'Tunday Kababi Hussainabad'],
    description: {
      en: 'The Clock Tower outlet, Shop No 5 in the Nagar Nigam food safety zone at the south-east corner of the Talab. A single-storey dining room sits behind a full-width glass front under a long charcoal fascia with the TK emblem, the branch list and “Since 1905”. Takeaway is from the door at the east end, beside a peach heritage pavilion. It stays open until 2 AM. The original 1905 shop is at Akbari Gate in Chowk.',
      hi: 'घंटाघर वाली दुकान, तालाब के दक्षिण-पूर्वी कोने पर नगर निगम फ़ूड सेफ़्टी ज़ोन की दुकान नंबर 5। एक मंज़िला हॉल, सामने पूरा शीशा और ऊपर TK निशान व “सिन्स 1905” वाला लंबा स्लेटी बोर्ड। पूर्वी दरवाज़े से टेकअवे, रात 2 बजे तक खुली। मूल दुकान चौक के अकबरी गेट पर है।',
      ur: 'گھنٹہ گھر والی دکان، تالاب کے جنوب مشرقی کونے پر نگر نگم فوڈ سیفٹی زون کی دکان نمبر 5۔ ایک منزلہ ہال، سامنے پورا شیشہ اور اوپر TK نشان اور “سنس 1905” والا لمبا سلیٹی بورڈ۔ مشرقی دروازے سے ٹیک اوے، رات 2 بجے تک کھلی۔ اصل دکان چوک کے اکبری گیٹ پر ہے۔',
    },
    placement: 'photographed', style: 'tunday', kind: 'frontage', frame: 'park', anchor: [-50, 41.8], facing: 0,
    area: 'Talab square, south-east corner (Nagar Nigam food safety zone)', sign: ['#2c2e30', '#f2f2f2'], width: 9.0, depth: 6.6, kerb: 0.03,
    arrival: [2.4, 3.6], reserve: [5.6, -0.5, 4.4], hours: [11, 26],
  },
  'globe-cafe': {
    name: { en: 'Globe Cafe 24x7', hi: 'ग्लोब कैफ़े 24x7', ur: 'گلوب کیفے 24x7' },
    aliases: ['Globe', 'Globe Cafe'],
    description: {
      en: 'Open round the clock opposite the Ghanta Ghar. Look for the black fascia with lit “GLOBE CAFE” letters and the “Open 24x7” globe badge, a strip of round menu pictures, and a bright counter with tea urns and drinks coolers.',
      hi: 'घंटाघर के सामने चौबीसों घंटे खुला। रोशन “GLOBE CAFE” अक्षरों वाला काला बोर्ड, “ओपन 24x7” वाला ग्लोब निशान, गोल तस्वीरों वाली मेन्यू पट्टी और चाय के बर्तनों व ठंडे पेयों वाला चमकता काउंटर देखें।',
      ur: 'گھنٹہ گھر کے سامنے چوبیس گھنٹے کھلا۔ روشن “GLOBE CAFE” حروف والا کالا بورڈ، “اوپن 24x7” والا گلوب نشان، گول تصویروں والی مینیو پٹی اور چائے کے برتنوں اور ٹھنڈے مشروبات والا روشن کاؤنٹر دیکھیے۔',
    },
    placement: 'photographed', style: 'globe', kind: 'frontage', anchor: [-98.20, 64.40], facing: 2.69274,
    area: 'Opposite Ghanta Ghar, Husainabad', sign: ['#111111', '#f7ebcd'], width: 6.2, depth: 7.6,
    arrival: [-0.45, 2.65], reserve: [4.5, -0.5, 4.7], hours: [-1, 25],
  },
  'turkish-cafe': {
    name: { en: 'Turkish Cafe & Food Junction', hi: 'टर्किश कैफ़े', ur: 'ٹرکش کیفے' },
    description: {
      en: 'A small café opposite the Ghanta Ghar with a charcoal fascia in cream-gold lettering. Out front, a printed counter cart serves tea and coffee under a big four-colour umbrella, beside a red jali screen.',
      hi: 'घंटाघर के सामने छोटा कैफ़े, गहरे सलेटी बोर्ड पर सुनहरी लिखावट। सामने छपे हुए ठेले से चाय-कॉफ़ी मिलती है, बड़ी चौरंगी छतरी के नीचे और लाल जाली के पास।',
      ur: 'گھنٹہ گھر کے سامنے چھوٹا کیفے، گہرے سرمئی بورڈ پر سنہری حروف۔ سامنے چھپے ہوئے ٹھیلے سے چائے اور کافی ملتی ہے، بڑی چورنگی چھتری کے نیچے اور سرخ جالی کے پاس۔',
    },
    placement: 'photographed', style: 'turkish', kind: 'frontage', anchor: [-63.97, 80.89], facing: 2.69274,
    area: 'Opposite Ghanta Ghar, Husainabad', sign: ['#353430', '#e3c78a'], width: 4.6, depth: 6.6,
    arrival: [0.4, 3.4], reserve: [3.6, -0.5, 4.9], hours: [9, 24],
  },
  'kebabchi-lucknow': {
    name: { en: 'Kebabchi Lucknow', hi: 'कबाबची लखनऊ', ur: 'کبابچی لکھنؤ' },
    description: {
      en: 'Shop 38 on Husainabad Main Road, across the chowk from the Chota Imambara gate. A white backlit fascia with an orange K roundel sits over arched glass doors into a chandelier-lit dining room, with a seekh grill at the pavement edge.',
      hi: 'हुसैनाबाद मेन रोड की दुकान 38, छोटे इमामबाड़े के दरवाज़े के सामने चौक के पार। नारंगी “K” वाला सफ़ेद रोशन बोर्ड, नीचे मेहराबदार शीशे के दरवाज़े और अंदर झाड़-फ़ानूस, सामने सीख कबाब की अंगीठी।',
      ur: 'حسین آباد مین روڈ کی دکان 38، چھوٹے امام باڑے کے دروازے کے سامنے چوک کے پار۔ نارنجی “K” والا سفید روشن بورڈ، نیچے محراب دار شیشے کے دروازے اور اندر جھاڑ فانوس، سامنے سیخ کباب کی انگیٹھی۔',
    },
    placement: 'photographed', style: 'kebabchi', kind: 'frontage', frame: 'chota', anchor: [39.4, -61.6], facing: 0,
    area: 'Opposite Chota Imambara, Husainabad Main Road', sign: ['#f7f4ee', '#cf5a1b'], width: 7.0, depth: 7.0, kerb: 0.03,
    arrival: [-0.6, 3.4], reserve: [4.8, -0.5, 4.6], hours: [12, 23.5],
  },
  'irani-chai': {
    name: { en: 'Irani Chai', hi: 'ईरानी चाय', ur: 'ایرانی چائے' },
    description: {
      en: 'A narrow stall on the Chota Imambara row. The black board glows with yellow “IRANI CHAI” and a second board reads “SULEMANI CHAI”. Inside: a big aluminium pot on the stove, stacked clay kulhads and a red drinks fridge.',
      hi: 'छोटे इमामबाड़े की कतार में पतली सी दुकान। काले बोर्ड पर पीले अक्षरों में “ईरानी चाय” और नीचे दूसरा बोर्ड “सुलेमानी चाय”। अंदर चूल्हे पर बड़ा एल्युमिनियम का पतीला, मिट्टी के कुल्हड़ों के ढेर और लाल फ़्रिज।',
      ur: 'چھوٹے امام باڑے کی قطار میں پتلی سی دکان۔ کالے بورڈ پر پیلے حروف میں “ایرانی چائے” اور نیچے دوسرا بورڈ “سلیمانی چائے”۔ اندر چولہے پر بڑا المونیم کا پتیلا، مٹی کے کلہڑوں کے ڈھیر اور سرخ فریج۔',
    },
    placement: 'photographed', style: 'iraniChai', kind: 'bay', frame: 'chota', bay: 6, facing: Math.PI,
    area: 'Husainabad Trust Road, Chota Imambara row', sign: ['#141414', '#f7c51e'],
    arrival: [-0.45, 4.7], reserve: [2.05, -0.55, 5.6], hours: [6, 24],
  },
  'irani-dum-tea': {
    name: { en: 'Irani Dum Tea', hi: 'ईरानी दम टी', ur: 'ایرانی دم چائے' },
    description: {
      en: 'The open-air tea stall on the Chota Imambara wall. Red, white-edged letters on a black board, a sagging black tarpaulin, and bell-shaped aluminium dum pots simmering on a soot-dark brick hearth. Tea is served in kulhads at the benches.',
      hi: 'छोटे इमामबाड़े की दीवार के पास खुली चाय की दुकान। काले बोर्ड पर सफ़ेद किनारे वाले लाल अक्षर, झूलता काला तिरपाल और कालिख लगे ईंटों के चूल्हे पर घंटी जैसे एल्युमिनियम के दम वाले बर्तन। चाय बेंचों पर कुल्हड़ में मिलती है।',
      ur: 'چھوٹے امام باڑے کی دیوار کے پاس کھلی چائے کی دکان۔ کالے بورڈ پر سفید کنارے والے سرخ حروف، جھولتا کالا ترپال اور کالک لگے اینٹوں کے چولہے پر گھنٹی نما المونیم کے دم والے برتن۔ چائے بنچوں پر کلہڑ میں ملتی ہے۔',
    },
    placement: 'photographed', style: 'iraniDum', kind: 'bay', frame: 'chota', bay: 3, facing: Math.PI,
    area: 'Chota Imambara wall', sign: ['#121212', '#d0141b'],
    arrival: [0.6, 4.6], reserve: [1.95, -0.55, 5.2], hours: [5.6, 23],
  },
  'irani-fast-food': {
    name: { en: 'Irani Fast Food', hi: 'ईरानी फ़ास्ट फ़ूड', ur: 'ایرانی فاسٹ فوڈ' },
    description: {
      en: 'Next to Irani Dum Tea on the same wall: red “IRANI FAST FOOD” on black under a row of round dish pictures, with a steel griddle counter for rolls and kebabs.',
      hi: 'उसी दीवार पर ईरानी दम टी के बगल में: काले बोर्ड पर लाल “ईरानी फ़ास्ट फ़ूड”, ऊपर गोल पकवानों की तस्वीरें, और रोल व कबाब के लिए स्टील के तवे वाला काउंटर।',
      ur: 'اسی دیوار پر ایرانی دم ٹی کے برابر: کالے بورڈ پر سرخ “ایرانی فاسٹ فوڈ”، اوپر گول پکوانوں کی تصویریں، اور رول اور کباب کے لیے اسٹیل کے توے والا کاؤنٹر۔',
    },
    placement: 'photographed', style: 'iraniFast', kind: 'bay', frame: 'chota', bay: 4, facing: Math.PI,
    area: 'Chota Imambara wall', sign: ['#111111', '#d0141b'],
    arrival: [-0.3, 4.5], reserve: [1.95, -0.55, 5.2], hours: [12, 23.5],
  },
  'chai-mahal': {
    name: { en: 'Chai Mahal', hi: 'चाय महल', ur: 'چائے محل' },
    description: {
      en: 'The bundled OpenStreetMap extract marks Chai Mahal at the west edge of the Talab square. Find the blue-green kiosk with a kettle and cups.',
      hi: 'बंडल के ओपनस्ट्रीटमैप में तालाब चौक के पश्चिमी किनारे पर चाय महल दर्ज है। केतली और प्यालों वाली नीली-हरी दुकान देखें।',
      ur: 'ساتھ دیے گئے اوپن اسٹریٹ میپ میں چائے محل تالاب کے چوک کے مغربی کنارے پر درج ہے۔ کیتلی اور پیالیوں والی نیلگوں دکان دیکھیں۔',
    },
    placement: 'mapped', style: 'kiosk', kind: 'kiosk', frame: 'park', anchor: [-142, 4], facing: Math.PI / 2,
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
    placement: 'interpreted', style: 'kiosk', kind: 'kiosk', frame: 'park', anchor: [-17, 15], facing: 0,
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
