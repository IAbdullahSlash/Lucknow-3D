'use strict';

/* The buildings along Hussainabad Trust Road, surveyed in November 2026 from Google Street View
   (panoramas captured in October 2025) and Google zoom-20 imagery. See docs/frontage-survey.md.

   s is metres along the heritage road (MAIN in src/city.js) from the west gateway. Every plot here is on
   the south side and starts at the back of the footpath; its depth is whatever the map leaves before the
   next lane.

   Each row: [s0, s1, storeys, wall, sign, extras]
     wall    plaster colour, or 'brick' for unplastered brick
     sign    fascia board [English, Hindi, board colour, letter colour], or null
     extras  back: storeys of a block behind a low shop front (often bare brick)
             roof: a board standing on the roof [English, Hindi, board, letters]
             awn:  awning colour
             poi:  the name this business already has in SHOPS (src/city.js), so its map label moves here */
const FRONTAGE = [
  // east gateway to the first lane
  [190.5, 195.5, 1, '#efece4', null, { back: 2, roof: ['NEW KING SHAWARMA', 'न्यू किंग शावरमा', '#1c1a1a', '#ef4632'] }],
  [195.5, 201, 1, '#e4e2dc', null, { roof: ['ORHAN SHAWARMA HOUSE', 'ओरहान शावरमा हाउस', '#151515', '#f4f1ea'] }],
  [201, 205, 1, '#cfe2ec', null],
  [205, 209.5, 1, '#f1efe8', null, { back: 2 }],
  [209.5, 212.5, 3, '#f2f0ea', null, { roof: ['PRINCE TRADER', 'प्रिंस ट्रेडर', '#56635f', '#ffffff'] }],
  [212.5, 219.5, 1, '#d9d2c4', null, { back: 2, awn: '#4a6fa5' }],
  [219.5, 222, 1, '#e9e5dc', ['NEW KING SHAWARMA', 'न्यू किंग शावरमा', '#1c1a1a', '#ef4632'], { back: 2 }],
  [222, 227.5, 2, 'brick', null, { awn: '#d6b045' }],
  [227.5, 233, 1, '#efe9dd', ['HUMDAN SWEETS & NAMKEEN', 'हमदान स्वीट्स एंड नमकीन', '#c4161c', '#ffffff'], { back: 2, awn: '#c8372d' }],
  [233, 235.2, 1, '#bcd3e6', null],
  // the lane south, then Burger Bay to the Gulf Shawarma Point
  [237.6, 242.5, 2, '#f3f1ec', ['AB COOL CORNER', 'एबी कूल कॉर्नर', '#6a2c8e', '#ffffff']],
  [242.5, 247, 3, '#56595d', ['BURGER BAY', 'बर्गर बे', '#111111', '#f2c230']],
  [247, 251.5, 2, '#e6e2da', ['ROASTIES', 'रोस्टीज़', '#141414', '#ffffff']],
  [251.5, 253.5, 1, '#d8d2c4', null, { back: 2 }],
  [253.5, 257.5, 3, '#2f5fb3', ['ANGEL MOBILE', 'एंजेल मोबाइल', '#f7f7f2', '#1d3f99']],
  [257.5, 262.5, 3, 'brick', ['ORHAN SEEKH PARATHA', 'ओरहान सीख पराठा', '#141414', '#f4e9d0']],
  [262.5, 265, 1, '#ece8de', ['LIFE CARE MEDICOSE', 'लाइफ़ केयर मेडिकोज़', '#2c2e8c', '#ffffff'], { back: 3 }],
  [265, 267.5, 1, '#e6c75e', ['GOLDEN BAKERY', 'गोल्डन बेकरी', '#2a2016', '#f2c94c'], { back: 2 }],
  [267.5, 269.5, 1, '#ece7dc', null, { back: 2, awn: '#c8372d' }],
  [269.5, 274, 1, '#f4f2ec', ['BIRYANI HOUSE', 'बिरयानी हाउस', '#141414', '#ffffff'], { back: 2 }],
  [274, 276, 1, '#e3ddd0', null, { back: 3 }],
  [276, 280, 3, '#dcdad4', ['RAJ MOBILE & ELECTRONICS', 'राज मोबाइल एंड इलेक्ट्रॉनिक्स', '#1a1a1a', '#f2c230'], { roof: ['BAKER BOX', 'बेकर बॉक्स रेस्टोरेंट', '#141414', '#ffffff'] }],
  [280, 287, 2, '#ece8e0', ['TUNDAY KABABI', 'टुंडे कबाबी', '#c8161d', '#ffffff'], { back: 4, awn: '#d23b2a', roof: ['MULAQAAT', 'मुलाक़ात', '#1d2a3a', '#ffffff'] }],
  [287, 289, 1, '#e8e4da', null, { back: 2 }],
  [289, 293, 2, '#a9bccf', ['THE GULF SHAWARMA POINT', 'द गल्फ़ शावरमा पॉइंट', '#3b2318', '#f6e7c8']],
  [293, 297.5, 2, '#f0eee6', null],
  [297.5, 300, 1, '#e7e2d6', ['MUZAMMIL GENERAL STORE', 'मुज़म्मिल जनरल स्टोर', '#20302a', '#ffffff'], { back: 2 }],
  [300, 302, 1, '#ddd6c8', null, { back: 2 }],
  [302, 306.5, 3, '#d47a72', null, { roof: ['M.H. DIAGNOSTICS', 'एम.एच. डायग्नोस्टिक्स', '#f4f6f8', '#1d4f91'] }],
  [306.5, 308.5, 2, '#e8c45e', null],
  [308.5, 312.5, 3, '#f4f2ec', ['PIZZA CAVE', 'पिज़्ज़ा केव', '#d7262b', '#ffffff'], { poi: 'Pizza Cave' }],
  [312.5, 316.5, 2, '#e3c765', ['CHAI BAR', 'चाय बार', '#141414', '#ffffff']],
  [316.5, 319.5, 2, '#f2efe8', ['AALAM BIRYANI HOUSE', 'आलम बिरयानी हाउस', '#cf1f25', '#ffe14d']],
  [319.5, 320.8, 1, '#e9e3d6', null],
  // the arched gate over the lane at s 323 (FRONT_FEATURES), then on to the Globe Cafe
  [325.2, 327.5, 1, '#efe9dc', null, { back: 2 }],
  [327.5, 330.5, 2, '#7fcf93', null],
  [330.5, 332.5, 3, '#f3f1ea', null],
  [332.5, 334.5, 2, '#3f8fd8', null],
  [334.5, 336, 1, '#e2ddd2', ['KAMRU BIKE REPAIRING', 'कमरू बाइक रिपेयरिंग', '#2f5fa8', '#ffffff'], { back: 2 }],
  [336, 339.5, 2, '#d8d2c6', ['ROLLS & SHAWARMA', 'रोल्स एंड शावरमा', '#1d3a2c', '#f3c74a']],
  [339.5, 346.5, 1, '#dcd4c4', null, { back: 2, awn: '#3f7f5f', roof: ['RAJU FURNITURE', 'राजू फ़र्नीचर', '#141414', '#f2c230'] }],
  // Globe Cafe (src/shops.js) stands at s 347–353
  [353.6, 357.5, 2, '#f4f2ec', null],
  [357.5, 364.5, 3, '#f3f1ec', ['SHAMIYANA TENT HOUSE', 'शामियाना टेंट हाउस', '#f6f3ec', '#a3262b']],
  [364.5, 366, 1, '#e6dfd2', null, { back: 2 }],
  [366, 369.5, 1, '#e7b9ad', ['HUZOOR', 'हुज़ूर', '#1f4f9a', '#ffffff'], { back: 2, awn: '#c9473a', poi: 'Huzoor' }],
  [369.5, 373.5, 1, '#efe6dc', ['MEHFIL COOL CORNER', 'महफ़िल कूल कॉर्नर', '#141414', '#f2c230'], { back: 2, poi: 'Mehfil Cool Corner' }],
  [373.5, 377.5, 1, '#e9b2a8', ['MURADABADI HYDERABADI BIRYANI', 'मुरादाबादी हैदराबादी बिरयानी', '#c71f26', '#ffffff'], { back: 2, awn: '#c9473a' }],
  [377.5, 382, 2, '#d9d4ca', ['FEEL FRESH CAFE & RESTAURANT', 'फ़ील फ़्रेश कैफ़े एंड रेस्टोरेंट', '#151515', '#e8352b']],
  [382, 385, 1, '#eeb5a6', ['AZHAR MURADABADI CHICKEN BIRYANI', 'अज़हर मुरादाबादी चिकन बिरयानी', '#1d2a4a', '#ffd23f'], { back: 2, poi: 'Azhar Muradabadi Chicken Biryani' }],
  [385, 388, 1, '#e3dccd', null, { back: 2 }],
  [388, 391.2, 1, '#efe7d4', ['PIZZA HUB', 'पिज़्ज़ा हब', '#f2c230', '#1b1b1b'], { back: 2 }],
  // Turkish Cafe (src/shops.js) stands at s 391.6–396.2
  [396.5, 398.2, 2, '#e7e5e0', ['IRANI DUM TEA', 'ईरानी दम टी', '#141414', '#ffffff']],
  [398.2, 402.5, 1, '#f4f2ec', null, { roof: ['RAJWADI CHAI', 'रजवाड़ी चाय', '#1a1a1a', '#f2c230'], poi: 'Rajwadi Chai' }],
  [402.5, 404.5, 1, '#dcd8d0', null, { back: 2 }],
  [404.5, 407, 2, '#5fbf7c', null],
  [407, 410, 2, 'brick', null, { awn: '#2f6fc4' }],
  [410, 413, 1, '#e3ddcf', null, { back: 2 }],
  [413, 419, 2, '#eceae4', ['CLOCK CAFE', 'क्लॉक कैफ़े', '#141414', '#ffffff']],
];

/* Things along the same stretch that are not shops. */
const FRONT_FEATURES = {
  gate: 323,                 // white arched gate with two small minarets and the Lucknow fish over the lane
  kiosk: 415,                // octagonal sandstone kiosk with a dome on the corner of Khun Khun Ji Road
  jali: [188, 419],          // low sandstone lattice screens along the kerb, broken for every shop
};

/* Walled grounds on the south side that the old procedural houses filled in.
   [s0, s1, depth from the road edge, kind]; trees are planted inside, and the wall follows the footpath. */
const FRONT_GROUNDS = [
  [445, 507, 45, 'office'],  // the municipal zonal office: yellow wall with painted murals, a single-storey office among trees
  [664, 750, 72, 'campus'],  // walled government campus: grey three-storey block (OSM) behind trees, a white office on the road
  [759, 842, 42, 'park'],    // Nimbu Park: long red sandstone lattice wall
];
