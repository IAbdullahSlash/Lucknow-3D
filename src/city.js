'use strict';
/* city.js — ground, the real street network (OpenStreetMap), river, parks, old-city houses, trees, lamps and wires */

/* the heritage road, west gateway → Rumi Darwaza bypass → Bara Imambara, chained by hand from the map */
const MAIN = polyline([-408, -99, -380, -86, -361, -77, -256, -28, -250, -25, -238, -19, -230, -16, -195, 0, -183, 6, -118, 43, -71, 65, -35, 83, -14, 93, 9, 104, 84, 140, 118, 156, 158, 171, 178, 182, 264, 225, 273, 229, 348, 262, 358, 268, 375, 266, 397, 263, 412, 260, 433, 265, 455, 277, 466, 289, 477, 306, 488, 324, 526, 337, 551, 345, 683, 388, 693, 389]);
function mainProject(x, z) {              // nearest point on the heritage road → distance, arc length, side (+1 = north/left)
  let best = 1e9, bs = 0, side = 1; const p = MAIN.p, c = MAIN.cum;
  for (let i = 0; i < p.length - 2; i += 2) {
    const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; bs = c[i / 2] + Math.sqrt(l2) * t; side = dz * (x - ax) - dx * (z - az) > 0 ? 1 : -1; }
  }
  return { d: best, s: bs, side };
}
const S_GATE_E = mainProject(-246, -22).s, S_PARK0 = mainProject(-195, 0).s, S_DUAL0 = mainProject(158, 171).s, S_DUAL1 = mainProject(358, 268).s, S_RUMI1 = mainProject(488, 324).s;
const mainHalf = s => 7 + 4.5 * smooth((s - S_DUAL0) / 25) * (1 - smooth((s - S_DUAL1 + 20) / 20));

/* only the heritage corridor is built out in full; Daulatganj and everything west of the Chota Imambara are left as open ground */
const focusLimit = mp => mp.s < 2 ? 115 : mp.s > MAIN.len - 2 ? 210 : (mp.s < S_PARK0 && mp.side > 0) ? 125 : mp.s > S_DUAL1 ? 380 : 245;
function inFocus(x, z, pad = 0) { const mp = mainProject(x, z); return mp.d < focusLimit(mp) + pad; }
// Approximate extent of the built-out scenery, drawn as a dashed line on the minimap.
const DETAILED_CORRIDOR = [-516, -155, -375, -222, -198, -192, -20, -207, 216, -108, 450, 5, 690, 128, 810, 334, 715, 652, 446, 712, 212, 509, -84, 310, -368, 168];
const pilotArrivals = PILOT_STOPS.map(id => {
  const place = PLACE_CATALOG[id];
  return toWorld(FRAME[place.frame], place.walk[0], place.walk[1]);
});
const pilotTrails = PILOT_WAYPOINTS.map((points, i) => [...pilotArrivals[i], ...points, ...pilotArrivals[i + 1]]);
const pilotClearance = pilotTrails.flatMap(trail => {
  const strips = [];
  for (let i = 0; i + 3 < trail.length; i += 2) {
    const [ax, az, bx, bz] = trail.slice(i, i + 4);
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    strips.push({ x: (ax + bx) / 2, z: (az + bz) / 2, ux, uz, vx: -uz, vz: ux, hw: len / 2 + 1.5, hd: 1.5 });
  }
  return strips;
});

function nearPilotTrail(x, z, clearance) {
  for (const trail of pilotTrails) {
    for (let i = 0; i + 3 < trail.length; i += 2) {
      const ax = trail[i], az = trail[i + 1], bx = trail[i + 2], bz = trail[i + 3];
      if (x < Math.min(ax, bx) - clearance || x > Math.max(ax, bx) + clearance
          || z < Math.min(az, bz) - clearance || z > Math.max(az, bz) + clearance) continue;
      if (segDist(x, z, ax, az, bx, bz) < clearance) return true;
    }
  }
  return false;
}
function blocksPilotTrail(box) {
  const { x, z, hw, hd } = box;
  return nearPilotTrail(x, z, Math.hypot(hw, hd) + 2.2) && pilotClearance.some(strip => obbHit(box, strip));
}

/* Existing precinct boards. Kind 0 = nearby shopfront, 1 = kiosk,
   2 = Chota Imambara wall bay, 4 = public signboard. Featured fronts use SHOP_CATALOG. */
const _pk = (u, v) => toWorld(FRAME.park, u, v);
const SHOPS = [
  ['Naval Medical Store', 'नवल मेडिकल स्टोर', -214, 6, 0], ['Pizza Cave', 'पिज़्ज़ा केव', -131, 40, 0],
  ['Azhar Muradabadi Chicken Biryani', 'अज़हर मुरादाबादी चिकन बिरयानी', -82, 66, 0], ['Mehfil Cool Corner', 'महफ़िल कूल कॉर्नर', -68, 72, 0], ['Huzoor', 'हुज़ूर', -58, 78, 0],
  ['Rajwadi Chai', 'रजवाड़ी चाय', -46, 84, 0], ['SK Wrap Lucknow', 'एसके रैप लखनऊ', -40, 108, 0], ['Rais Manzil', 'रईस मंज़िल', -154, 94, 0],
  ['Zaika Biryani', 'ज़ायक़ा बिरयानी', -286, -80, 0], ['Kunafa Day', 'कुनाफ़ा डे', -248, -58, 0], ['Cafe Dubai', 'कैफ़े दुबई', -258, -64, 0],
  ['Gulf Abaya Mart', 'गल्फ़ अबाया मार्ट', -214, -66, 0], ['Chaurasiya Bakery', 'चौरसिया बेकरी', -238, -86, 0], ['A.M. Medicals', 'ए.एम. मेडिकल्स', -244, -94, 0],
  ['Stoles Collection', 'स्टोल्स कलेक्शन', -252, -74, 0], ['Irshad Communication', 'इरशाद कम्युनिकेशन', -256, -84, 0], ['Style Garments', 'स्टाइल गारमेंट्स', -262, -96, 0],
  ['Shalimar Batteries', 'शालीमार बैटरीज़', -258, -104, 0], ['Khalid Auto Parts', 'ख़ालिद ऑटो पार्ट्स', -216, -120, 0],
  ['Route 32', 'रूट 32', 207, 218, 0], ['Khalsa Service Centre', 'खालसा सर्विस सेंटर', 64, 212, 0], ['Mahalaxmi Travels', 'महालक्ष्मी ट्रैवल्स', 145, -6, 0],
  ['Ibrahim’s Kitchen', 'इब्राहिम्स किचन', 116, -80, 0], ['Zaalim Chai', 'ज़ालिम चाय', 4, -146, 0], ['Tafree Coffee & Tea', 'तफ़री कॉफ़ी एंड टी', 300, 46, 0],
  ['Haideri Perfumes', 'हैदरी परफ़्यूम्स', ..._pk(-134, 50), 1], ['Vishal Kachaudi Bhandar', 'विशाल कचौड़ी भंडार', ..._pk(-134, 58), 1], ['Abbas Pan Shop', 'अब्बास पान शॉप', ..._pk(-134, 66), 1],
  ['OK OK Chinese', 'ओके ओके चाइनीज़', ..._pk(-45.5, 16), 1], ['Zayka-e-Ghanta Ghar', 'ज़ायक़ा-ए-घंटाघर', ..._pk(-17, -13), 1],
  ['Rehan Toys Shop', 'रेहान टॉयज़ शॉप', ..._pk(-12, 56), 1], ['Motu Ke Momos', 'मोटू के मोमोज़', ..._pk(-12, 66), 1], ['Govind Pani Puri Center', 'गोविंद पानी पूरी सेंटर', ..._pk(20, -52), 1],
  ['Shree Shyam Fast Food Corner', 'श्री श्याम फ़ास्ट फ़ूड कॉर्नर', ..._pk(45, -29), 1], ['The Pizza Centre', 'द पिज़्ज़ा सेंटर', ..._pk(64, -52), 1], ['Z A Bangles', 'ज़ेड ए बैंगल्स', ..._pk(58, -72), 1],
  ['Apna Cafe', 'अपना कैफ़े', ..._pk(-148, 32), 1], ['Cafe Awadh Darbar', 'कैफ़े अवध दरबार', ..._pk(-148, 22), 1], ['Yadav Doodh Corner', 'यादव दूध कॉर्नर', ..._pk(-150, 44), 1], ['Aur Theek Tea Point', 'और ठीक टी पॉइंट', ..._pk(-150, -40), 1],
  ['Patiyala Pahalwan', 'पटियाला पहलवान', 349, 281, 1], ['Anand Ki Chai', 'आनंद की चाय', 256, 201, 1], ['Hans Bus Service', 'हंस बस सर्विस', 211, 180, 1],
  ['Zaika', 'ज़ायक़ा', 0, 0, 2],
  ['Lucknow Ka Mashhoor Khichda & Burger', 'लखनऊ का मशहूर खिचड़ा', 0, 0, 2], ['SK Chikan Art', 'एसके चिकन आर्ट', 0, 0, 2], ['The Gulf Shawarma', 'द गल्फ़ शावरमा', 0, 0, 2],
  ['HUSAINABAD HERITAGE ZONE', 'हुसैनाबाद हेरिटेज ज़ोन', 0, 0, 4], ['PARKING', 'पार्किंग', 0, 0, 4], ['PUBLIC TOILET', 'शौचालय', 0, 0, 4], ['TICKETS', 'टिकट घर', 0, 0, 4],
];
const SHOP_IDS = Object.keys(SHOP_CATALOG);
const SIGN_ROWS = 32;
const shopCell = name => SHOPS.findIndex(shop => shop[0] === name);
const genericCell = () => ri(SHOPS.length + SHOP_IDS.length + FRONT_SIGNS.length, SIGN_ROWS * 4 - 1);
const signUV = c => { const u0 = (c % 4) / 4, v1 = 1 - ((c / 4) | 0) / SIGN_ROWS; return [u0, v1 - 1 / SIGN_ROWS, u0 + 0.25, v1]; };
/** give the real names to the house fronts nearest to where those businesses stand */
function nameShops() {
  const front = h => [h.x + h.vx * (h.hd + 0.4), h.z + h.vz * (h.hd + 0.4)], surveyed = new Map(HOUSES.filter(h => h.poi).map(h => [h.poi, h]));
  SHOPS.forEach((q, i) => {
    if (q[4] !== 0) return;
    if (surveyed.has(q[0])) { q[5] = front(surveyed.get(q[0])); return; }     // found on Street View: its label goes on that front
    let best = null, bd = 48;
    for (const h of HOUSES) { if (h.inst || h.real || h.sign !== undefined) continue; const d = Math.hypot(h.x - q[2], h.z - q[3]) + (h.shop ? 0 : 6); if (d < bd) { bd = d; best = h; } }
    if (best) { best.shop = true; best.sign = i; q[5] = front(best); } else q[4] = 1;
  });
  for (const h of HOUSES) for (const [en, hi, y] of h.labels || []) { const [x, z] = front(h); LABELS.push({ id: 'front' + LABELS.length, poi: true, en, hi, pos: [x, y, z] }); }
}

/* ground layers: same plane, separated by polygon offset so nothing shimmers */
const GM = {
  dirt: groundMat(0xffffff, TEX.dirt, 0), lawn: groundMat(0xffffff, TEX.grass, 1), herring: groundMat(0xffffff, TEX.herring, 2), paver: groundMat(0xffffff, TEX.paver, 2), sand: groundMat(0xe3cfa6, TEX.dirt, 2),
  lane: groundMat(0xffffff, TEX.lane, 3), asphalt: groundMat(0xffffff, TEX.asphalt, 4), cobble: groundMat(0xffffff, TEX.cobble, 5), path: groundMat(0xf0c4ae, TEX.paver, 6), kerb: M(0xc79d8b, { map: TEX.paver }),
  lawnTop: groundMat(0xffffff, TEX.grass, 7), pathTop: groundMat(0xf0c4ae, TEX.paver, 8),
};
const GY = { dirt: 0, lawn: 0.004, herring: 0.008, paver: 0.008, sand: 0.008, lane: 0.012, asphalt: 0.016, cobble: 0.02, path: 0.024, kerb: 0 };
['cobble', 'asphalt', 'lane', 'herring', 'paver', 'path'].forEach(k => { GM[k].envMap = ENV; GM[k].envMapIntensity = 0; WET.push({ mat: GM[k], rough: 1 }); });

const GB = {};
const gBucket = n => GB[n] || (GB[n] = { pos: [], uv: [], nor: [] });
function gTri(b, ax, az, bx, bz, cx, cz, y) {
  if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) { let t = bx; bx = cx; cx = t; t = bz; bz = cz; cz = t; }
  b.pos.push(ax, y, az, bx, y, bz, cx, y, cz); b.uv.push(ax, az, bx, bz, cx, cz); b.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
}
function gPoly(name, flat, holes) {
  const b = gBucket(name), y = GY[name], pts = [], all = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  const hs = (holes || []).map(ringVectors);
  all.push(...pts); hs.forEach(h => all.push(...h));
  for (const t of THREE.ShapeUtils.triangulateShape(pts, hs)) gTri(b, all[t[0]].x, all[t[0]].y, all[t[1]].x, all[t[1]].y, all[t[2]].x, all[t[2]].y, y);
}
function gQuad(b, ax, az, bx, bz, cx, cz, dx, dz, y) { gTri(b, ax, az, bx, bz, cx, cz, y); gTri(b, ax, az, cx, cz, dx, dz, y); }
function gDisc(b, x, z, r, y) { for (let i = 0; i < 10; i++) { const a0 = i * TAU / 10, a1 = (i + 1) * TAU / 10; gTri(b, x, z, x + Math.cos(a0) * r, z + Math.sin(a0) * r, x + Math.cos(a1) * r, z + Math.sin(a1) * r, y); } }
function gRibbon(name, p, hw) {
  const b = gBucket(name), y = GY[name], n = p.length / 2, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const x = p[i * 2], z = p[i * 2 + 1]; let ax = 0, az = 0, bx = 0, bz = 0;
    if (i > 0) { ax = x - p[i * 2 - 2]; az = z - p[i * 2 - 1]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; }
    if (i < n - 1) { bx = p[i * 2 + 2] - x; bz = p[i * 2 + 3] - z; const l = Math.hypot(bx, bz) || 1; bx /= l; bz /= l; }
    if (i === 0) { ax = bx; az = bz; } if (i === n - 1) { bx = ax; bz = az; }
    let tx = ax + bx, tz = az + bz; const tl = Math.hypot(tx, tz); if (tl < 1e-4) { tx = bx; tz = bz; } else { tx /= tl; tz /= tl; }
    const m = hw / Math.max(0.55, tx * bx + tz * bz);
    L.push(x + tz * m, z - tx * m); R.push(x - tz * m, z + tx * m);
    if (i === 0 || i === n - 1 || tx * bx + tz * bz < 0.96) gDisc(b, x, z, hw, y);
  }
  for (let i = 0; i < n - 1; i++) gQuad(b, L[i * 2], L[i * 2 + 1], R[i * 2], R[i * 2 + 1], R[i * 2 + 2], R[i * 2 + 3], L[i * 2 + 2], L[i * 2 + 3], y);
}
function gFlush() {
  for (const n in GB) {
    const b = GB[n]; if (!b.pos.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    const m = new THREE.Mesh(g, GM[n]); m.receiveShadow = true; m.matrixAutoUpdate = false; m.renderOrder = -5; scene.add(m); delete GB[n];
  }
}

/* water */
const waterNormal = (() => {
  const N = 128, hgt = new Float32Array(N * N);
  for (let k = 0; k < 9; k++) { const fx = ri(1, 6), fz = ri(1, 6), ph = rnd() * TAU, a = 1 / (fx + fz); for (let i = 0; i < N * N; i++) hgt[i] += Math.sin((i % N) / N * TAU * fx + ((i / N) | 0) / N * TAU * fz + ph) * a; }
  return canvasTex(N, N, x => { const im = x.createImageData(N, N); for (let i = 0; i < N * N; i++) { const X = i % N, Y = (i / N) | 0, dx = hgt[Y * N + (X + 1) % N] - hgt[Y * N + (X + N - 1) % N], dy = hgt[((Y + 1) % N) * N + X] - hgt[((Y + N - 1) % N) * N + X]; im.data[i * 4] = 128 + dx * 420; im.data[i * 4 + 1] = 128 + dy * 420; im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = 255; } x.putImageData(im, 0, 0); }, 14);
})();
waterNormal.colorSpace = THREE.NoColorSpace;
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2d6068, roughness: 0.16, metalness: 0.4, normalMap: waterNormal, normalScale: new THREE.Vector2(0.22, 0.22), envMap: ENV, transparent: true, opacity: 0.94, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -5 });
const talabWater = waterMat.clone(); talabWater.color.set(0x3d6a4a); talabWater.metalness = 0.22; talabWater.roughness = 0.24; talabWater.normalMap = waterNormal;
ENVMATS.push(waterMat, talabWater);
const riverTint = waterMat.color.clone(), talabTint = talabWater.color.clone();
UPDATERS.push((dt, t) => {
  waterNormal.offset.set(t * 0.012, t * 0.007);
  waterNormal.repeat.setScalar(1 + 0.55 * wx.rain);
  waterMat.roughness = 0.16 + 0.15 * wx.rain;
  talabWater.roughness = 0.24 + 0.13 * wx.rain;
  waterMat.color.copy(riverTint).lerp(skyU.hor.value, 0.14);
  talabWater.color.copy(talabTint).lerp(skyU.hor.value, 0.19);
});
function ringVectors(ring) {
  const points = [];
  for (let i = 0; i < ring.length; i += 2) points.push(new THREE.Vector2(ring[i], ring[i + 1]));
  return points;
}
function waterPoly(feature, y) {
  const ring = ringVectors(feature.p), holes = (feature.holes || []).map(ringVectors);
  const pts = ring.concat(...holes);
  const pos = [], uv = [], nor = [];
  for (const t of THREE.ShapeUtils.triangulateShape(ring, holes)) { let a = pts[t[0]], b = pts[t[1]], c = pts[t[2]]; if ((b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y) < 0) { const q = b; b = c; c = q; } for (const q of [a, b, c]) { pos.push(q.x, y, q.y); uv.push(q.x, q.y); nor.push(0, 1, 0); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(g, waterMat); m.receiveShadow = true; scene.add(m);
}

/* ───────────── places where no ordinary house may stand ───────────── */
const OPEN = [];
function addOpen(flat, name, soft = false, holes) { OPEN.push({ p: flat, bb: polyBounds(flat), name, soft, holes }); }
function inOpen(x, z, soft = false) { for (const o of OPEN) { if (soft && o.soft) continue; const b = o.bb; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue; if (featureContains(x, z, o)) return true; } return false; }
function inflate(p, m) { const c = polyCentroid(p), o = []; for (let i = 0; i < p.length; i += 2) { const dx = p[i] - c[0], dz = p[i + 1] - c[1], l = Math.hypot(dx, dz) || 1; o.push(p[i] + dx / l * m, p[i + 1] + dz / l * m); } return o; }
const rectWorld = (f, x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].flatMap(q => toWorld(f, q[0], q[1]));
const circlePoly = (x, z, r, n = 12) => { const o = []; for (let i = 0; i < n; i++) o.push(x + Math.cos(i * TAU / n) * r, z + Math.sin(i * TAU / n) * r); return o; };
// Food court, museum and the square between them: OpenStreetMap ways
// 1582317775, 1366159503 and 1582317782 (mapped November 2026), in world metres.
const FOOD_COURT = [[147.1, 30.3], [154.8, 28.8], [154.2, 25.7], [176.8, 20.9], [182.0, 41.9], [175.9, 43.1], [177.8, 50.2], [151.6, 55.7]];
const MUSEUM = [[160.9, 89.6], [189.5, 83.6], [182.8, 58.9], [183.0, 56.3], [184.8, 55.6], [208.2, 78.3], [230.2, 72.9], [234.1, 89.0], [220.0, 92.6],
  [256.2, 131.2], [256.3, 132.8], [221.2, 118.3], [201.9, 97.1], [171.8, 103.9], [169.7, 92.9], [166.6, 96.7], [160.1, 97.9], [159.6, 91.8], [161.1, 91.6]];
const FOOD_SQUARE = [[157.6, 67.7], [181.5, 62.2], [187.2, 82.0], [158.4, 88.6], [155.4, 76.3]];
/** Durgadevi Marg's centre line beside the food court, from the same map. */
const durgadeviX = z => 127.4 + (z - 8.9) * 0.2414;

const CHOWK = [-229, -56, -368, -124, -398, -74, -256, -4];
// The strip of low shops on the far side of Husainabad Chowk, facing the Chota Imambara gate (Chota frame, metres),
// measured on Google zoom-20 imagery: fronts on z = -45, about 7 m deep, from x -20 to 86. Kebabchi stands in it.
const CHOWK_ROW = { x0: -20, x1: 86, z: -45, d: 7 };                      // the open ground between the two Husainabad gateways
const SATK_BLOCK = [-224, -24, -216, -46, -224, -66, -241, -88, -252, -106, -205, -110, -188, -118, -150, -140, -138, -100, -158, -62, -177, -37, -196, -12];
/** a point on the south side of the heritage road, `off` metres from its centre line */
const southAt = (s, off) => { const a = polyAt(MAIN, s); return [a[0] - a[3] * off, a[1] + a[2] * off]; };
/** a band along the south side of the heritage road from s0 to s1, o0 to o1 metres beyond the road edge */
function southBand(s0, s1, o0, o1) {
  const near = [], far = [];
  for (let s = s0; ; s = Math.min(s + 4, s1)) { const h = mainHalf(s); near.push(...southAt(s, h + o0)); far.unshift(...southAt(s, h + o1)); if (s >= s1) break; }
  return near.concat(far);
}
{
  const OPENK = /college|education|hospital|Mosque|worship|monument|museum|grass|meadow|farmland|fountain|toilets|water_tower|wastewater/i, SOFT = /college|education|hospital/i;
  MAP.green.forEach(g => addOpen(g.p, g.n, false, g.holes)); MAP.water.forEach(w => addOpen(w.p, w.n, false, w.holes));
  MAP.areas.forEach(a => { if (OPENK.test(a.k)) addOpen(a.p, a.n, SOFT.test(a.k), a.holes); });
  MAP.buildings.forEach(b => addOpen(inflate(b.p, 3), b.n));
  addOpen(CHOWK, 'chowk'); addOpen(SATK_BLOCK, 'satkhanda');
  addOpen([330, 262, 372, 252, 414, 252, 440, 258, 462, 276, 478, 300, 494, 326, 470, 330, 430, 326, 404, 350, 376, 356, 342, 334, 328, 290], 'rumi');
  addOpen([130, 12, 216, 36, 268, 124, 304, 220, 262, 216, 178, 170, 158, 150], 'foodcourt');
  addOpen(inflate(FOOD_COURT.flat(), 4), 'food-court-hall'); addOpen(inflate(MUSEUM.flat(), 3), 'museum');
  addOpen(circlePoly(FRAME.gateE.x, FRAME.gateE.z, 24), 'gateE'); addOpen(circlePoly(FRAME.gateW.x, FRAME.gateW.z, 24), 'gateW');
  addOpen([520, 300, 668, 348, 660, 376, 512, 330], 'naubat-bara');
  addOpen(rectWorld(FRAME.chota, -17, -76, 17, -56), 'naubat-chota');
  addOpen(rectWorld(FRAME.chota, CHOWK_ROW.x0 - 2, CHOWK_ROW.z - CHOWK_ROW.d - 1.5, CHOWK_ROW.x1 + 2, CHOWK_ROW.z + 1.5), 'chowk-row');
  for (const [s0, s1, depth, kind] of FRONT_GROUNDS) addOpen(southBand(s0, s1, 0.3, depth), kind);   // walled grounds on Hussainabad Trust Road
}

/* ───────────── roads ───────────── */
const NET = { nodes: [], edges: [] };
const SEGH = new Map();                    // spatial hash of road segments for clearance queries
function roadGap(x, z) {                   // metres from the nearest road edge (negative = on the carriageway)
  const list = SEGH.get(Math.floor(x / 30) * 4096 + Math.floor(z / 30)); let best = 99; if (!list) return best;
  for (const s of list) { const d = segDist(x, z, s[0], s[1], s[2], s[3]) - s[4]; if (d < best) best = d; }
  return best;
}
function buildRoads() {
  const HERITAGE = /Hussainabad Trust Road|Azadari Road/;
  for (const r of MAP.roads) {
    const n = r.p.length / 2, mp = mainProject(r.p[((n >> 1) * 2)], r.p[((n >> 1) * 2) + 1]);
    let allNear = true; for (let i = 0; i < r.p.length; i += 2) if (mainProject(r.p[i], r.p[i + 1]).d > 16) { allNear = false; break; }
    r._main = (HERITAGE.test(r.n || '') || (allNear && /tertiary/.test(r.k)));
    const foot = /footway|path|steps/.test(r.k);
    r._w = foot ? 2.6 : r._main ? (r.o ? 9.5 : 14) : /primary|secondary/.test(r.k) ? Math.max(r.w, 9) : r.k === 'tertiary' ? 9 : r.k === 'tertiary_link' ? 7 : r.k === 'residential' ? 5.2 : r.k === 'living_street' ? 4.4 : 3.3;
    r._mat = foot ? 'path' : r._main || (/tertiary/.test(r.k) && mp.d < 200 && !r.n) || /paving_stones|sett/.test(r.s || '') ? 'cobble' : /primary|secondary|tertiary/.test(r.k) ? 'asphalt' : 'lane';
    let nearGate = false, prom = false; for (let i = 0; i < r.p.length; i += 2) { if (Math.hypot(r.p[i] - 413.5, r.p[i + 1] - 307.5) < 35 || Math.hypot(r.p[i] - 470, r.p[i + 1] - 318) < 6) nearGate = true; if (Math.hypot(r.p[i] - 11, r.p[i + 1] + 110) < 6) prom = true; }
    r._veh = !foot && r.k !== 'service' && !nearGate && !prom;     // Rumi Darwaza has been closed to traffic since its restoration
    r._prom = prom;
    if (prom) { r._mat = 'herring'; r._w = 9; }
    r._in = !!r.b; for (let i = 0; i < r.p.length; i += 2) if (inFocus(r.p[i], r.p[i + 1], 70)) { r._in = true; break; }
    if (!r._in) { r._veh = false; continue; }
    gRibbon(r._mat, r.p, r._w / 2);
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3], seg = [ax, az, bx, bz, r._w / 2];
      for (let cx = Math.floor((Math.min(ax, bx) - 22) / 30); cx <= Math.floor((Math.max(ax, bx) + 22) / 30); cx++) for (let cz = Math.floor((Math.min(az, bz) - 22) / 30); cz <= Math.floor((Math.max(az, bz) + 22) / 30); cz++) { const k = cx * 4096 + cz; let l = SEGH.get(k); if (!l) SEGH.set(k, l = []); l.push(seg); }
    }
  }
  gRibbon('cobble', MAIN.p, 7);
  for (let i = 0; i < MAIN.p.length - 2; i += 2) {
    const ax = MAIN.p[i], az = MAIN.p[i + 1], bx = MAIN.p[i + 2], bz = MAIN.p[i + 3], seg = [ax, az, bx, bz, 7];
    for (let cx = Math.floor((Math.min(ax, bx) - 22) / 30); cx <= Math.floor((Math.max(ax, bx) + 22) / 30); cx++) for (let cz = Math.floor((Math.min(az, bz) - 22) / 30); cz <= Math.floor((Math.max(az, bz) + 22) / 30); cz++) { const k = cx * 4096 + cz; let l = SEGH.get(k); if (!l) SEGH.set(k, l = []); l.push(seg); }
  }
  // the wide cobbled ground between the gateways, and the plazas either side of Rumi Darwaza
  const flat = a => a; gPoly('cobble', flat(CHOWK));
  gPoly('paver', SATK_BLOCK); gPoly('paver', circlePoly(FRAME.gateE.x, FRAME.gateE.z, 27, 16)); gPoly('paver', circlePoly(FRAME.gateW.x, FRAME.gateW.z, 27, 16));
  gPoly('cobble', [338, 264, 372, 256, 398, 262, 392, 290, 390, 314, 392, 340, 372, 350, 346, 332, 334, 292]);
  gPoly('cobble', [430, 264, 458, 280, 474, 304, 490, 326, 468, 328, 436, 322, 432, 300, 436, 284]);

  // graph for traffic and for people on foot
  const key = (x, z) => Math.round(x * 10) + '_' + Math.round(z * 10), use = new Map(), idx = new Map();
  for (const r of MAP.roads) { const n = r.p.length / 2; for (let i = 0; i < n; i++) { const k = key(r.p[i * 2], r.p[i * 2 + 1]); use.set(k, (use.get(k) || 0) + (i === 0 || i === n - 1 ? 2 : 1)); } }
  const node = (x, z) => { const k = key(x, z); let i = idx.get(k); if (i === undefined) { i = NET.nodes.length; idx.set(k, i); NET.nodes.push({ x, z, e: [], nveh: 0 }); } return i; };
  for (const r of MAP.roads) {
    if (!r._in) continue;
    const n = r.p.length / 2; let start = 0;
    for (let i = 1; i < n; i++) {
      if (i !== n - 1 && use.get(key(r.p[i * 2], r.p[i * 2 + 1])) < 2) continue;
      const pts = r.p.slice(start * 2, i * 2 + 2), pl = polyline(pts); start = i;
      if (pl.len < 0.6) continue;
      const a = node(pts[0], pts[1]), b = node(pts[pts.length - 2], pts[pts.length - 1]);
      const mid = polyAt(pl, pl.len / 2), near = inFocus(mid[0], mid[1], 12);
      const e = { id: NET.edges.length, a, b, pl, len: pl.len, w: r._w, k: r.k, main: r._main, one: !!r.o, veh: r._veh && near, ped: near, foot: /footway|path|steps/.test(r.k), prom: r._prom, bridge: !!r.b, q: [[], []] };
      NET.nodes[a].e.push(e.id); NET.nodes[b].e.push(e.id); if (e.veh) { NET.nodes[a].nveh++; NET.nodes[b].nveh++; }
      NET.edges.push(e);
    }
  }
  const B = MAP.bounds;
  for (const nd of NET.nodes) { nd.exit = nd.nveh === 1 && (!inFocus(nd.x, nd.z, -34) || nd.x < B[0] + 14 || nd.x > B[1] - 14 || nd.z < B[2] + 14 || nd.z > B[3] - 14); nd.major = nd.e.some(i => NET.edges[i].veh && (NET.edges[i].main || /primary|secondary|tertiary/.test(NET.edges[i].k))); }
}

/* raised footpaths either side of the heritage road, with gaps where side streets come in */
function buildSidewalks() {
  const gaps = [];
  NET.nodes.forEach((nd, ni) => {
    const mp = mainProject(nd.x, nd.z); if (mp.d > 11) return;
    for (const ei of nd.e) { const e = NET.edges[ei]; if (e.main || e.foot) continue; const far = e.a === ni ? polyAt(e.pl, Math.min(e.len, 14)) : polyAt(e.pl, Math.max(0, e.len - 14)); const fp = mainProject(far[0], far[1]); gaps.push([mp.s, e.w / 2 + 2.2, fp.d > 4 ? fp.side : 0]); }
  });
  const pos = [], uv = [], nor = [], quad = (a, b, c, d, n) => { for (const q of [a, b, c, a, c, d]) { pos.push(q[0], q[1], q[2]); uv.push(q[0] + q[1], q[2] + q[1]); nor.push(n[0], n[1], n[2]); } };
  const H = 0.16, step = 2.5, a = [0, 0, 0, 0], b = [0, 0, 0, 0];
  const cafe = SHOP_SITES.get('globe-cafe').frame;
  const cut = mainProject(cafe.x, cafe.z);
  const curbHeight = (s, side) => side === cut.side ? H * smooth(Math.abs(s - cut.s) / 3.6) : H;
  for (const side of [1, -1]) for (let s = S_PARK0; s < MAIN.len - step; s += step) {
    if (s > S_DUAL1 - 6 && s < S_RUMI1 + 4) continue;
    if (gaps.some(g => (g[2] === 0 || g[2] === side) && Math.abs(s + step / 2 - g[0]) < g[1])) continue;
    polyAt(MAIN, s, a); polyAt(MAIN, s + step, b);
    const h0 = mainHalf(s), h1 = mainHalf(s + step), w = 3.3;
    const p = (q, off, y) => [q[0] + q[3] * side * off, y, q[1] - q[2] * side * off];
    const A0 = p(a, h0, curbHeight(s, side)), A1 = p(a, h0 + w, H);
    const B0 = p(b, h1, curbHeight(s + step, side)), B1 = p(b, h1 + w, H);
    if (side > 0) { quad(A0, B0, B1, A1, [0, 1, 0]); quad(p(a, h0, 0), p(b, h1, 0), B0, A0, [-a[3], 0, a[2]]); quad(A1, B1, p(b, h1 + w, 0), p(a, h0 + w, 0), [a[3], 0, -a[2]]); }
    else { quad(A0, A1, B1, B0, [0, 1, 0]); quad(A0, B0, p(b, h1, 0), p(a, h0, 0), [a[3], 0, -a[2]]); quad(p(a, h0 + w, 0), p(b, h1 + w, 0), B1, A1, [-a[3], 0, a[2]]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(g, GM.kerb); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
}

function buildGround() {
  const hole = []; talabOct(0).forEach(q => { const w = toWorld(FRAME.park, q[0] + TALAB.cx, q[1] + TALAB.cz); hole.push(w[0], w[1]); });
  gPoly('dirt', [-5200, -5200, 5200, -5200, 5200, 5200, -5200, 5200], [hole]);
  for (const g of MAP.green) {
    const holes = [...(g.holes || [])];
    if (featureContains(hole[0], hole[1], g) && hole.every((x, i) => i % 2 || featureContains(x, hole[i + 1], g))) holes.push(hole);
    gPoly(g.k === 'pitch' ? 'sand' : 'lawn', g.p, holes);
  }
  for (const a of MAP.areas) if (/grass|meadow|farmland/.test(a.k)) gPoly('lawn', a.p, a.holes);
  for (const w of MAP.water) if (!isTalabWater(w)) waterPoly(w, 0.006);
}

/* ───────────── the old city: houses grown along the real lanes ───────────── */
const HOUSES = [], HGRID = new Map();
function obbHit(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (let k = 0; k < 4; k++) {
    const ex = k === 0 ? a.ux : k === 1 ? a.vx : k === 2 ? b.ux : b.vx, ez = k === 0 ? a.uz : k === 1 ? a.vz : k === 2 ? b.uz : b.vz;
    const ra = (a.hw - 0.12) * Math.abs(a.ux * ex + a.uz * ez) + (a.hd - 0.12) * Math.abs(a.vx * ex + a.vz * ez), rb = (b.hw - 0.12) * Math.abs(b.ux * ex + b.uz * ez) + (b.hd - 0.12) * Math.abs(b.vx * ex + b.vz * ez);
    if (Math.abs(dx * ex + dz * ez) > ra + rb) return false;
  }
  return true;
}
function addHouse(h) {
  const k = Math.floor(h.x / 16) * 4096 + Math.floor(h.z / 16); let l = HGRID.get(k); if (!l) HGRID.set(k, l = []); l.push(h); HOUSES.push(h);
  COLLIDERS.push({ x: h.x, z: h.z, ax: h.ux, az: h.uz, bx: h.vx, bz: h.vz, hw: h.hw, hd: h.hd, yb: 0, yt: h.h });
  return h;
}
function tryHouse(x, z, w, d, rot, cfg) {
  if (!inFocus(x, z) || (cfg.main && inFrontage(x, z))) return null;
  const c = Math.cos(rot), s = Math.sin(rot), h = { x, z, hw: w / 2, hd: d / 2, ux: c, uz: -s, vx: s, vz: c, rot };
  if (blocksPilotTrail(h) || SHOP_PLOTS.some(plot => obbHit(h, plot))) return null;
  const Bd = MAP.bounds;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const px = x + h.ux * h.hw * i + h.vx * h.hd * j, pz = z + h.uz * h.hw * i + h.vz * h.hd * j;
    if (px < Bd[0] + 6 || px > Bd[1] - 6 || pz < Bd[2] + 6 || pz > Bd[3] - 6) return null;
    if (roadGap(px, pz) < 0.3 || inOpen(px, pz, cfg.soft) || talabDepthAt(px, pz) !== null) return null;
  }
  const gx = Math.floor(x / 16), gz = Math.floor(z / 16);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = HGRID.get((gx + i) * 4096 + gz + j); if (l) for (const o of l) if (obbHit(h, o)) return null; }
  h.floors = pick(cfg.floors); h.h = h.floors * 3.15 + 0.95 + rr(0, 0.35); h.shop = chance(cfg.shop); h.style = chance(0.2) ? 1 : chance(0.16) ? 2 : 0;
  h.front = cfg.main ? 2 : cfg.shop > 0.5 ? 1 : 0;
  return addHouse(h);
}

/* ───────────── Hussainabad Trust Road as surveyed (data/frontage.js) ───────────── */
const FRONT_SIGNS = [];                     // sign cells after SHOPS and the featured shops
const FRONT_SPAN = [FRONTAGE[0][0] - 1, FRONTAGE[FRONTAGE.length - 1][1] + 1];
const FRONT_SET = 3.35;                     // shop fronts stand at the back of the 3.3 m footpath
/** inside the surveyed row: procedural main-road houses stay out */
function inFrontage(x, z) { const mp = mainProject(x, z); return mp.side < 0 && mp.s > FRONT_SPAN[0] && mp.s < FRONT_SPAN[1] && mp.d < mainHalf(mp.s) + 24; }
const frontSign = sign => { FRONT_SIGNS.push(sign); return SHOPS.length + SHOP_IDS.length + FRONT_SIGNS.length - 1; };
const titleCase = t => t.split(' ').map(w => w.length <= 2 || w.includes('.') ? w : w[0] + w.slice(1).toLowerCase()).join(' ');
/** is the ground t metres behind the shop-front line at s free of roads and the featured shops? */
function frontClear(s, t) {
  const [x, z] = southAt(s, mainHalf(s) + FRONT_SET + t);
  return roadGap(x, z) > 0.3 && !SHOP_PLOTS.some(p => Math.abs((x - p.x) * p.ux + (z - p.z) * p.uz) < p.hw && Math.abs((x - p.x) * p.vx + (z - p.z) * p.vz) < p.hd);
}
/** a block from s0 to s1 along the road and t0 to t1 behind the shop-front line, facing the road */
function frontBlock(s0, s1, t0, t1, props) {
  const sc = (s0 + s1) / 2, a = polyAt(MAIN, sc), rot = Math.atan2(a[3], -a[2]), [x, z] = southAt(sc, mainHalf(sc) + FRONT_SET + (t0 + t1) / 2);
  const h = { x, z, hw: (s1 - s0) / 2 - 0.06, hd: (t1 - t0) / 2, ux: Math.cos(rot), uz: -Math.sin(rot), vx: Math.sin(rot), vz: Math.cos(rot), rot, real: true, front: 0, style: 0, shop: false, ...props };
  h.h = h.floors * 3.15 + 0.95;
  return addHouse(h);
}
function buildFrontage() {
  const tint = c => c === 'brick' ? 0xffffff : parseInt(c.slice(1), 16), named = new Set();
  const fascia = new Set(FRONTAGE.filter(r => r[4]).map(r => titleCase(r[4][0])));
  const label = (h, board, y) => { const en = titleCase(board[0]); if (!named.has(en)) { named.add(en); h.labels.push([en, board[1], y]); } };
  for (const [a0, a1, floors, wall, sign, x = {}] of FRONTAGE) {
    let s0 = a0, s1 = a1;
    // the map draws some lanes wider than they are: give way to them rather than lose the plot
    const ok = s => frontClear(s, 0.4) && frontClear(s, 4);
    for (let k = 0; k < 10 && s1 - s0 > 1.4 && !ok(s0 + 0.3); k++) s0 += 0.4;
    for (let k = 0; k < 10 && s1 - s0 > 1.4 && !ok(s1 - 0.3); k++) s1 -= 0.4;
    const across = [s0 + 0.3, (s0 + s1) / 2, s1 - 0.3];
    if (!across.every(s => frontClear(s, 0.4))) { console.warn('frontage plot blocked by the map', a0, a1); continue; }
    let depth = 1; while (depth < 16 && across.every(s => frontClear(s, depth + 0.5))) depth += 0.5;
    const split = x.back && depth >= 7.5, d0 = split ? Math.min(5.5, depth * 0.45) : depth;
    const front = frontBlock(s0, s1, 0, d0, { floors, style: wall === 'brick' ? 1 : 0, tint: tint(wall), shop: true, front: 2, awn: x.awn, poi: x.poi, labels: [] });
    if (sign) { front.sign = frontSign(sign); if (!x.poi) label(front, sign, 5.3); }
    const top = split ? frontBlock(s0, s1, d0 + 0.25, depth, { floors: x.back, style: 1, tint: 0xffffff }) : front;
    if (x.roof) { top.roofSign = frontSign(x.roof); if (!x.poi && !fascia.has(titleCase(x.roof[0]))) label(front, x.roof, top.h + 2); }   // a roof board for a shop further on is not its label
  }
  // buildings standing inside the walled grounds
  frontBlock(484, 499, 18, 26, { floors: 1, tint: 0xf3efe6 });       // the zonal office
  frontBlock(726, 742, 3, 10, { floors: 1, tint: 0xf6f4ee });        // the campus office on the road
  frontBlock(760, 767, 0.4, 8, { floors: 2, tint: 0xe7a3c4 });       // the pink house at the corner of Nimbu Park
}
function rowAlong(pl, side, setback, cfg) {
  let s = rr(0.5, 4); const a = [0, 0, 0, 0];
  while (s < pl.len - 3) {
    const fw = rr(cfg.w0, cfg.w1); if (s + fw > pl.len + 1) break;
    polyAt(pl, s + fw / 2, a);
    const nx = a[3] * side, nz = -a[2] * side, rot = Math.atan2(-nx, -nz);
    let dp = rr(cfg.d0, cfg.d1), off = setback + dp / 2, h = tryHouse(a[0] + nx * off, a[1] + nz * off, fw - 0.2, dp, rot, cfg);
    if (!h) { s += 2.6; continue; }
    for (let r = 1, far = setback + dp; r < cfg.rows; r++) { const d2 = rr(cfg.d0, cfg.d1), hh = tryHouse(a[0] + nx * (far + 0.25 + d2 / 2), a[1] + nz * (far + 0.25 + d2 / 2), fw - 0.2, d2, rot, { ...cfg, shop: 0, main: false }); if (!hh) break; far += d2 + 0.25; }
    s += fw + rr(0.05, 0.5);
  }
}
function buildHouses() {
  const order = { main: 0, primary: 1, secondary: 1, tertiary: 1, tertiary_link: 1, primary_link: 1, secondary_link: 1, residential: 2, living_street: 2, service: 3 };
  const roads = MAP.roads.filter(r => r._in && !/footway|path|steps/.test(r.k) && !r.b && !r._prom).sort((a, b) => (a._main ? 0 : order[a.k]) - (b._main ? 0 : order[b.k]));
  const rows = Q.houses >= 1 ? 3 : 2;
  buildFrontage();
  // shops facing the open ground between the gateways
  rowAlong(polyline([-231, -57, -368, -125]), -1, 0.5, { w0: 4.5, w1: 8, d0: 7, d1: 10, rows: 2, floors: [1, 2, 2, 3], shop: 1, main: true });
  for (const r of roads) {
    const pl = polyline(r.p), big = /primary|secondary|tertiary/.test(r.k);
    const cfg = r._main ? { w0: 4.6, w1: 8.5, d0: 7, d1: 10.5, rows, floors: [1, 2, 2, 2, 3], shop: 0.92, main: true }
      : big ? { w0: 5.5, w1: 10, d0: 8, d1: 12, rows, floors: [2, 2, 3, 3, 4], shop: 0.7, main: false }
        : r.k === 'service' ? { w0: 5.5, w1: 9.5, d0: 7, d1: 11.5, rows: 2, floors: [1, 2, 2, 3, 3, 4], shop: 0.06, main: false }
          : { w0: 5.5, w1: 10, d0: 7.5, d1: 12, rows, floors: [2, 2, 3, 3, 4], shop: 0.28, main: false };
    const sb = r._w / 2 + (r._main ? 3.9 : big ? 1.6 : 0.45);
    rowAlong(pl, 1, sb, cfg); rowAlong(pl, -1, sb, cfg);
  }
  // back-fill the block interiors so the fabric is as tight as the real old city
  const Bd = MAP.bounds;
  for (let i = 0, n = Math.round(22000 * Q.houses); i < n; i++) {
    const x = rr(Bd[0] + 10, Bd[1] - 10), z = rr(Bd[2] + 10, Bd[3] - 10); if (roadGap(x, z) < 3.2) continue;
    let rot = 0, bd = 1e9; const gx = Math.floor(x / 16), gz = Math.floor(z / 16);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = HGRID.get((gx + a) * 4096 + gz + b); if (l) for (const h of l) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; rot = h.rot; } } }
    if (bd > 34) continue;
    tryHouse(x, z, rr(6, 9.5), rr(6.5, 10.5), rot + (chance(0.5) ? 0 : Math.PI / 2), { floors: [1, 2, 2, 3, 3, 4], shop: 0, main: false });
  }
  // colleges and the medical university: fewer, larger blocks
  for (const o of OPEN) if (o.soft) for (let x = o.bb[0] + 16; x < o.bb[1] - 8; x += 46) for (let z = o.bb[2] + 14; z < o.bb[3] - 8; z += 36) {
    const px = x + rr(-9, 9), pz = z + rr(-7, 7); if (!pointInPoly(px, pz, o.p)) continue;
    const h = tryHouse(px, pz, rr(24, 38), rr(11, 15), (chance(0.5) ? 0 : Math.PI / 2) + rr(-0.12, 0.12), { floors: [2, 3, 3, 4], shop: 0, main: false, soft: true }); if (h) h.inst = true;
  }
}

/* facade textures: a small family of old-Lucknow house fronts drawn once, tinted per house */
const SHUT_COLS = ['#8d9499', '#6f7f8f', '#7a4a3c', '#3f6a8a', '#8a8f6a', '#9c3b34', '#4f7a5c', '#a3a7a9'];
const LEAF_COLS = ['#2f6a55', '#3b6f9a', '#7a4a2a', '#1f5a7a', '#5a3a26', '#3f7a4a', '#8a6a3a'];
function makeFacade(style, floors, shop) {
  const W = 256, FH = 72, PH = 22, H = floors * FH + PH, items = [], R = tr, pk = a => a[(R() * a.length) | 0];
  const cols = style === 2 ? 3 : 3 + ((R() * 2) | 0), cw = (W - 28) / cols;
  for (let f = 0; f < floors; f++) {
    const y0 = PH + f * FH, ground = f === floors - 1;
    if (ground && shop) { const n = R() < 0.45 ? 3 : 2, sw = (W - 12) / n; for (let i = 0; i < n; i++) items.push({ t: 'shut', x: 6 + i * sw + 3, y: y0 + 19, w: sw - 6, h: FH - 20, open: R() < 0.62, c: pk(SHUT_COLS) }); }
    else if (ground) { const dx = 16 + R() * 170; items.push({ t: 'door', x: dx, y: y0 + 22, w: 34, h: FH - 23, c: pk(LEAF_COLS) }); for (let i = 0; i < cols; i++) { const x = 14 + i * cw + (cw - 30) / 2; if (x + 30 < dx - 6 || x > dx + 40) items.push({ t: 'win', x, y: y0 + 22, w: 30, h: 30, c: pk(LEAF_COLS), lit: R() < 0.4 }); } }
    else { for (let i = 0; i < cols; i++) items.push({ t: 'win', x: 14 + i * cw + (cw - 32) / 2, y: y0 + 15, w: 32, h: 38, c: pk(LEAF_COLS), lit: R() < 0.5, arch: style === 2, ac: R() < 0.12 }); if (R() < 0.34) items.push({ t: 'bal', y: y0 + 52 }); }
  }
  const pipe = 6 + R() * 240;
  const day = canvasTex(W, H, x => {
    if (style === 1) { x.fillStyle = '#b6a08c'; x.fillRect(0, 0, W, H); for (let r = 0; r * 6 < H; r++) for (let c = -1; c < 15; c++) { const v = 0.8 + R() * 0.32; x.fillStyle = `rgb(${(172 * v) | 0},${(88 * v) | 0},${(62 * v) | 0})`; x.fillRect(c * 19 + (r % 2 ? 9 : 0) + 0.6, r * 6 + 0.6, 18, 5); } }
    else { x.fillStyle = style === 2 ? '#f1ead9' : '#f5f2ea'; x.fillRect(0, 0, W, H); blotches(x, W, H, 60, ['#d9d2c4', '#ffffff', '#c8c0b0'], 6, 30, 0.25); }
    streaks(x, W, H, 16, 'rgba(60,54,48,.9)', 0.3);
    x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, PH - 3, W, 3); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, W, 3);
    for (let f = 1; f < floors; f++) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, PH + f * FH - 2, W, 2); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, PH + f * FH, W, 2); }
    if (style === 2) { x.strokeStyle = 'rgba(120,90,60,.5)'; x.lineWidth = 2; for (let f = 0; f < floors; f++) x.strokeRect(5, PH + f * FH + 5, W - 10, FH - 9); }
    x.fillStyle = 'rgba(40,40,44,.75)'; x.fillRect(pipe, PH, 3, H - PH);
    for (const it of items) {
      if (it.t === 'win') {
        x.fillStyle = '#6b5e50'; x.fillRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4);
        if (it.arch) { x.beginPath(); x.ellipse(it.x + it.w / 2, it.y, it.w / 2 + 2, 9, 0, Math.PI, 0); x.fill(); }
        x.fillStyle = '#39454f'; x.fillRect(it.x, it.y, it.w, it.h); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(it.x + it.w / 2 - 1, it.y, 2, it.h); x.fillRect(it.x, it.y + it.h * 0.42, it.w, 2);
        x.fillStyle = it.c; x.fillRect(it.x - 7, it.y, 6, it.h); x.fillRect(it.x + it.w + 1, it.y, 6, it.h);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(it.x - 4, it.y + it.h + 2, it.w + 8, 3);
        if (it.ac) { x.fillStyle = '#d9dcdc'; x.fillRect(it.x + 4, it.y + it.h + 5, 20, 9); x.fillStyle = '#8a8f90'; x.fillRect(it.x + 6, it.y + it.h + 7, 9, 5); }
      } else if (it.t === 'door') {
        x.fillStyle = '#4a3d32'; x.fillRect(it.x - 3, it.y - 3, it.w + 6, it.h + 3); x.fillStyle = it.c; x.fillRect(it.x, it.y, it.w, it.h);
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(it.x + it.w / 2 - 1, it.y, 2, it.h); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; x.strokeRect(it.x + 3, it.y + 4, it.w / 2 - 6, it.h - 8); x.strokeRect(it.x + it.w / 2 + 3, it.y + 4, it.w / 2 - 6, it.h - 8);
      } else if (it.t === 'shut') {
        if (it.open) { x.fillStyle = '#2a211b'; x.fillRect(it.x, it.y, it.w, it.h); for (let r = 0; r < 3; r++) for (let c = 0; c * 9 < it.w - 8; c++) { x.fillStyle = `hsl(${(R() * 360) | 0},${55 + R() * 30}%,${40 + R() * 25}%)`; x.fillRect(it.x + 4 + c * 9, it.y + 5 + r * 11, 7, 8); } x.fillStyle = '#7a5a3a'; x.fillRect(it.x, it.y + it.h - 12, it.w, 12); x.fillStyle = it.c; x.fillRect(it.x, it.y, it.w, 5); }
        else { x.fillStyle = it.c; x.fillRect(it.x, it.y, it.w, it.h); x.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = it.y; yy < it.y + it.h; yy += 4) x.fillRect(it.x, yy, it.w, 1.5); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(it.x, it.y, it.w, 2); }
      } else { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(4, it.y + 12, W - 8, 4); x.fillStyle = 'rgba(40,36,34,.8)'; x.fillRect(4, it.y, W - 8, 2); for (let bx = 6; bx < W - 6; bx += 6) x.fillRect(bx, it.y, 1.5, 12); }
    }
  }, 0);
  const lit = canvasTex(W, H, x => {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    for (const it of items) { if (it.t === 'win' && it.lit) { x.fillStyle = R() < 0.7 ? '#ffc56a' : '#ffe2a8'; x.fillRect(it.x, it.y, it.w, it.h); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(it.x + it.w / 2 - 1, it.y, 2, it.h); } else if (it.t === 'shut' && it.open) { x.fillStyle = '#ffd590'; x.fillRect(it.x, it.y + 5, it.w, it.h - 5); x.fillStyle = 'rgba(90,50,20,.5)'; for (let r = 0; r < 3; r++) x.fillRect(it.x, it.y + 14 + r * 11, it.w, 2); } }
  }, 0);
  return [day, lit];
}
const HOUSE_TINTS = [0xf6f1e6, 0xf6f1e6, 0xf1e6cc, 0xebdfc4, 0xf2e4ba, 0xd9e5ec, 0xd1e2ea, 0xeccfc6, 0xe9c5c2, 0xd8e6d1, 0xe8ca90, 0xd1cabe, 0xc1dad4, 0xe4b9a2, 0xcab8d8, 0xa1cbc6, 0xf3c7d0, 0xbcd0e6];
const houseMats = [], signMats = [];
let signAtlas = null;
function drawSigns() {
  const NAMES = ['कबाब पराठा|KABAB PARATHA', 'लखनवी बिरयानी|LUCKNOWI BIRYANI', 'چکن کاری|CHIKAN KARI', 'CHIKAN EMPORIUM|चिकन एम्पोरियम', 'शीरमाल हाउस|SHEERMAL HOUSE', 'कुल्फ़ी फ़ालूदा|KULFI FALOODA', 'पान भंडार|PAAN BHANDAR', 'मिठाई वाला|SWEETS & NAMKEEN', 'लस्सी कॉर्नर|LASSI CORNER', 'इत्र हाउस|ITTAR & PERFUMES', 'MEDICAL STORE|मेडिकल स्टोर', 'मोबाइल रिपेयर|MOBILE REPAIR', 'नवाब टेलर्स|NAWAB TAILORS', 'GENERAL STORE|जनरल स्टोर', 'फोटो स्टूडियो|PHOTO STUDIO', 'चूड़ी घर|BANGLES', 'ज़री ज़रदोज़ी|ZARI ZARDOZI', 'निहारी कुलचा|NIHARI KULCHA', 'चाट हाउस|CHAAT HOUSE', 'चाय नाश्ता|TEA STALL', 'अवध बेकरी|AWADH BAKERY', 'किताब घर|BOOK DEPOT', 'ऑटो पार्ट्स|AUTO PARTS', 'गारमेंट्स|GARMENTS', 'गन्ना जूस|JUICE CORNER', 'दूध दही|DAIRY', 'खिलौने|TOYS & GIFTS', 'पतंग वाला|KITE SHOP', 'ट्रैवल्स|TOURS & TRAVELS', 'क्लिनिक|CLINIC', 'हार्डवेयर|HARDWARE', 'सैलून|HAIR SALOON', 'किराना|KIRANA STORE', 'دوا خانہ|DAWAKHANA', 'पानी पूरी|PANI PURI', 'कचौड़ी भंडार|KACHORI BHANDAR', 'खीर मलाई|MALAI MAKHAN', 'टोपी हाउस|CAP HOUSE', 'ज्वैलर्स|JEWELLERS', 'इलेक्ट्रिकल्स|ELECTRICALS', 'टेंट हाउस|TENT HOUSE', 'आटा चक्की|FLOUR MILL', 'प्रिंटिंग प्रेस|PRINTING PRESS', 'साइकिल स्टोर|CYCLE STORE'];
  const BG = [['#b3261e', '#fff7d6'], ['#1d4f91', '#ffffff'], ['#1c6b3a', '#fff3b0'], ['#f2c200', '#1b1b1b'], ['#111111', '#ffd23f'], ['#f4f1e8', '#b3261e'], ['#7a1f5c', '#ffe9a8'], ['#e8611a', '#ffffff'], ['#0f6e73', '#ffffff'], ['#f4f1e8', '#1d4f91']];
  signAtlas = canvasTex(1024, 64 * SIGN_ROWS, x => {
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < SIGN_ROWS * 4; i++) {
      const cx = (i % 4) * 256, cy = ((i / 4) | 0) * 64;
      const real = SHOPS[i], feature = SHOP_CATALOG[SHOP_IDS[i - SHOPS.length]], surveyed = FRONT_SIGNS[i - SHOPS.length - SHOP_IDS.length];
      let a, b, bg, fg;
      if (feature) {
        [a, b] = [feature.name.en, feature.name.hi];
        [bg, fg] = feature.sign;
      } else if (surveyed) {
        [a, b, bg, fg] = surveyed;
      } else if (real) {
        [a, b] = real;
        [bg, fg] = real[4] === 4 ? ['#14553a', '#ffffff'] : BG[(i * 3 + 1) % BG.length];
      } else {
        [a, b] = NAMES[(i * 5) % NAMES.length].split('|');
        [bg, fg] = BG[(i * 7 + ((i / 4) | 0)) % BG.length];
      }
      x.fillStyle = bg; x.fillRect(cx, cy, 256, 64); x.strokeStyle = fg; x.lineWidth = 2; x.strokeRect(cx + 3, cy + 3, 250, 58);
      x.fillStyle = fg; x.font = 'bold 25px "Nirmala UI","Urdu Typesetting","Segoe UI",sans-serif'; x.fillText(a, cx + 128, cy + 24, 238);
      x.font = 'bold 15px "Nirmala UI","Segoe UI",sans-serif'; x.fillText(b, cx + 128, cy + 49, 238);
    }
  }, 0);
}
function buildHouseMeshes() {
  drawSigns();
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), ix = box.index.array, order = [0, 1, 5, 2, 3, 4], ni = [];
  for (const f of order) for (let i = 0; i < 6; i++) ni.push(ix[f * 6 + i]);
  box.setIndex(ni); box.clearGroups(); box.addGroup(0, 18, 0); box.addGroup(18, 12, 1); box.addGroup(30, 6, 2);
  const roof = M(0xbdb4a6, { map: canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#cfc8bb'; x.fillRect(0, 0, w, h); blotches(x, w, h, 40, ['#aaa296', '#e2dbcf', '#8f887c'], 3, 12, 0.4); x.strokeStyle = '#8c8377'; x.lineWidth = 5; x.strokeRect(0, 0, w, h); }, 0) });
  const buckets = new Map(), tex = new Map();
  const facade = (st, fl, sh) => { const k = st + '-' + fl + '-' + (sh ? 1 : 0); if (!tex.has(k)) { const [d, l] = makeFacade(st, fl, sh); const m = new THREE.MeshStandardMaterial({ map: d, emissiveMap: l, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.93 }); houseMats.push(m); tex.set(k, m); } return tex.get(k); };
  for (const h of HOUSES) { if (h.inst) continue; const k = h.style * 100 + h.floors * 10 + (h.shop ? 1 : 0); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(h); }
  const o = new THREE.Object3D(), col = new THREE.Color();
  for (const [k, list] of buckets) {
    const st = (k / 100) | 0, fl = ((k % 100) / 10) | 0, sh = k % 10;
    const im = new THREE.InstancedMesh(box, [facade(st, fl, false), roof, facade(st, fl, sh)], list.length);
    list.forEach((h, i) => { o.position.set(h.x, 0, h.z); o.rotation.y = h.rot; o.scale.set(h.hw * 2, h.h, h.hd * 2); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (h.tint === undefined) h.tint = st === 1 ? pick([0xffffff, 0xf2e6dc, 0xe6d6cc]) : pick(HOUSE_TINTS); im.setColorAt(i, col.set(h.tint)); });
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  }
  NIGHTFX.push(n => { for (const m of houseMats) m.emissiveIntensity = n * 0.95; });

  // rooftop clutter: stair-head rooms, black and white water tanks, blue tarpaulins
  const mum = [], tank = [], tankW = [], tarp = [];
  for (const h of HOUSES) {
    if (h.inst) continue;
    const cx = (lx, lz) => [h.x + h.ux * lx + h.vx * lz, h.z + h.uz * lx + h.vz * lz];
    if (chance(0.42)) { const p = cx(-h.hw + 1.6, -h.hd + 1.6); mum.push([p[0], h.h, p[1], h.rot, h.tint]); if (chance(0.7)) tank.push([p[0], h.h + 2.35, p[1]]); }
    else if (chance(0.5)) { const p = cx(rr(-h.hw + 1.2, h.hw - 1.2), rr(-h.hd + 1.2, h.hd - 1.2)); (chance(0.2) ? tankW : tank).push([p[0], h.h, p[1]]); }
    if (chance(0.09)) { const p = cx(h.hw * 0.25, h.hd * 0.2); tarp.push([p[0], h.h + 1.9, p[1], h.rot, h.hw, h.hd]); }
  }
  const mm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 2.35, 2.6).translate(0, 1.175, 0), M(0xffffff, { map: TEX.plaster }), mum.length);
  mum.forEach((q, i) => { o.position.set(q[0], q[1], q[2]); o.rotation.y = q[3]; o.scale.set(1, 1, 1); o.updateMatrix(); mm.setMatrixAt(i, o.matrix); mm.setColorAt(i, col.set(q[4])); }); mm.castShadow = true; mm.frustumCulled = false; scene.add(mm);
  const tg = new THREE.CylinderGeometry(0.62, 0.66, 1.25, 10).translate(0, 0.625, 0);
  for (const [list, c] of [[tank, 0x1d1d20], [tankW, 0xe9e9e6]]) { const tm = new THREE.InstancedMesh(tg, M(c, { roughness: 0.5 }), list.length); o.rotation.y = 0; list.forEach((q, i) => { o.position.set(q[0], q[1], q[2]); o.updateMatrix(); tm.setMatrixAt(i, o.matrix); }); tm.castShadow = true; tm.frustumCulled = false; scene.add(tm); }
  const tp = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), M(0x2f6fc4, { roughness: 0.6 }), tarp.length);
  tarp.forEach((q, i) => { o.position.set(q[0], q[1], q[2]); o.rotation.set(0.08, q[3], 0.05); o.scale.set(q[4] * 1.1, 1, q[5] * 0.9); o.updateMatrix(); tp.setMatrixAt(i, o.matrix); }); o.rotation.set(0, 0, 0); tp.castShadow = true; tp.frustumCulled = false; scene.add(tp);

  // signboards and awnings on shop fronts
  const pos = [], uv = [], nor = [], awn = [], goods = [], AWN = [0xb3261e, 0x1f7a8c, 0xe2a400, 0x2e7d4f, 0xd35400, 0x1b6ca8, 0xe9e2d0, 0x8a2f4f];
  const board = (h, hw, y0, off, cell) => { const fx = h.x + h.vx * (h.hd + off), fz = h.z + h.vz * (h.hd + off), q = signUV(cell), y1 = y0 + hw * 0.5, c = [[-hw, y0, q[0], q[1]], [hw, y0, q[2], q[1]], [hw, y1, q[2], q[3]], [-hw, y1, q[0], q[3]]]; for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(fx + h.ux * c[i][0], c[i][1], fz + h.uz * c[i][0]); uv.push(c[i][2], c[i][3]); nor.push(h.vx, 0, h.vz); } };
  for (const h of HOUSES) {
    if (h.roofSign !== undefined) board(h, Math.min(h.hw * 0.95, 2.3), h.h + 0.2, -0.15, h.roofSign);     // boards standing on the roof, as surveyed
    if (!h.shop) continue;
    const goodsOut = () => { for (let k = 0, n = ri(1, 4); k < n; k++) goods.push([h.x + h.vx * (h.hd + 0.5 + rr(0, 0.5)) + h.ux * rr(-h.hw * 0.8, h.hw * 0.8), h.z + h.vz * (h.hd + 0.5 + rr(0, 0.5)) + h.uz * rr(-h.hw * 0.8, h.hw * 0.8), h.rot, h.front === 2 ? 0.16 : 0]); };
    if (h.real) {                         // the surveyed row: only the boards and awnings seen on Street View
      if (h.sign !== undefined) board(h, Math.min(h.hw * 0.95, 2.4), 2.95, 0.14, h.sign);
      if (h.awn) awn.push([h, parseInt(h.awn.slice(1), 16)]);
      if (chance(0.5)) goodsOut();
      continue;
    }
    board(h, Math.min(h.hw * 0.9, 2.6), 2.95, 0.14, h.sign !== undefined ? h.sign : genericCell());
    if (h.front === 2 && h.floors < 4 && chance(0.2)) board(h, Math.min(h.hw * 0.95, 3.2), h.h + 0.25, -0.2, h.sign !== undefined ? h.sign : genericCell());      // rooftop hoarding
    if (chance(h.front === 2 ? 0.75 : 0.4)) awn.push([h, pick(AWN)]);
    if (chance(h.front === 2 ? 0.6 : 0.3)) goodsOut();
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const signMat = new THREE.MeshStandardMaterial({ map: signAtlas, emissiveMap: signAtlas, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7 });
  const sm = new THREE.Mesh(sg, signMat); sm.matrixAutoUpdate = false; scene.add(sm); signMats.push(signMat);
  NIGHTFX.push(n => { signMat.emissiveIntensity = n * 0.12; });
  const am = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 1.9), M(0xffffff, { roughness: 0.8 }), awn.length);
  awn.forEach(([h, c], i) => { o.position.set(h.x + h.vx * (h.hd + 0.9), 2.62, h.z + h.vz * (h.hd + 0.9)); o.rotation.set(0.26, h.rot, 0, 'YXZ'); o.scale.set(h.hw * 1.8, 1, 1); o.updateMatrix(); am.setMatrixAt(i, o.matrix); am.setColorAt(i, col.set(c)); });
  o.rotation.set(0, 0, 0, 'XYZ'); am.castShadow = true; am.frustumCulled = false; scene.add(am);
  // crates, sacks and tins set out in front of the shops
  const gm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), M(0xffffff, { roughness: 0.9 }), goods.length), GC = [0x8a5a33, 0xd9b44a, 0xc0392b, 0x2e7d4f, 0x2f6fc4, 0xcfc6ba, 0xa9713f, 0xe07a1f];
  goods.forEach((q, i) => { o.position.set(q[0], q[3], q[1]); o.rotation.y = q[2] + rr(-0.3, 0.3); o.scale.set(rr(0.45, 0.8), rr(0.35, 0.75), rr(0.4, 0.7)); o.updateMatrix(); gm.setMatrixAt(i, o.matrix); gm.setColorAt(i, col.set(pick(GC))); });
  o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); gm.castShadow = true; gm.frustumCulled = false; scene.add(gm);
}

/* mapped institutional buildings (colleges, hospital blocks) as simple extrusions */
// Site boundaries for hand-built complexes.
// These remain tied to the model when an upstream display name changes.
const RESERVED_BUILDING_SITES = {
  clock: circlePoly(FRAME.park.x, FRAME.park.z, 10),
  chota: [-337.6, 123.2, -279, -2.7, -273.4, -0.2, -268.8, -10.2, -386.1, -64, -449.4, 71.9],
  eastGateway: circlePoly(FRAME.gateE.x, FRAME.gateE.z, 40),
  rumi: rectWorld(FRAME.rumi, -40, -8, 40, 8),
  bara: [367.9, 626.2, 394.9, 550.1, 378.8, 353.2, 426.5, 319.6, 724.6, 423.5, 696.2, 515.5, 584.2, 582.7, 507.5, 669.7],
  baraEntrance: [520, 300, 668, 348, 660, 376, 512, 330],
  food: rectWorld(FRAME.food, -40, -65, 56, 60),
};
const MAPPED_SOLIDS = [];
// Mapped blocks whose height and colour were read off Street View (October 2025): the grey campus on Hussainabad Trust Road.
const MAPPED_LOOK = { 'way/1469979488': { levels: 3, grey: true }, 'way/1469979489': { levels: 3, grey: true }, 'way/1469979490': { levels: 3, grey: true } };
function buildMappedBuildings() {
  const reserved = Object.values(RESERVED_BUILDING_SITES);
  const wall = M(0xe6dcc4, { map: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#efe9db'; x.fillRect(0, 0, w, h); x.fillStyle = '#4a5560'; x.fillRect(22, 30, 36, 52); x.fillRect(74, 30, 36, 52); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, w, 5); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(39, 30, 2, 52); x.fillRect(91, 30, 2, 52); }, 6.4, 3.3) });
  const roofFlat = M(0xb9b1a3);
  const distantWall = M(0xc2b8a3);
  const greyWall = wall.clone(); greyWall.color.set(0x8f9398);
  const cg = new THREE.Group();
  for (const h of HOUSES) if (h.inst) { _box(cg, wall, h.hw * 2, h.h, h.hd * 2, h.x, 0, h.z).rotation.y = h.rot; _box(cg, roofFlat, h.hw * 2 + 0.6, 0.45, h.hd * 2 + 0.6, h.x, h.h, h.z).rotation.y = h.rot; }
  bake(cg);
  for (const b of MAP.buildings) {
    const [x0, x1, z0, z1] = polyBounds(b.p);
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    if (Math.max(x1 - x0, z1 - z0) < 9 || reserved.some(p => pointInPoly(x, z, p))) continue;
    const detailed = inFocus(x, z, 30);
    const shape = new THREE.Shape(ringVectors(b.p));
    shape.holes = (b.holes || []).map(hole => new THREE.Path(ringVectors(hole)));
    const mappedHeight = /^\d+(\.\d+)?\s*m?$/.test(b.h || '') ? parseFloat(b.h) : 0;
    const look = MAPPED_LOOK[b.osm] || {};
    const levels = look.levels || Number(b.l) || (detailed ? ri(2, 4) : 2);
    const height = clamp(mappedHeight || levels * 3.3 + 1, 2.5, 60);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); geo.translate(0, height, 0);
    const mesh = new THREE.Mesh(geo, detailed ? [roofFlat, look.grey ? greyWall : wall] : distantWall);
    mesh.castShadow = detailed;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    MAPPED_SOLIDS.push({ feature: b, height });
  }
}

/* ───────────── trees ───────────── */
function houseNear(x, z, m) {
  const gx = Math.floor(x / 16), gz = Math.floor(z / 16);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const h of HGRID.get((gx + i) * 4096 + gz + j) || []) if (Math.abs((x - h.x) * h.ux + (z - h.z) * h.uz) < h.hw + m && Math.abs((x - h.x) * h.vx + (z - h.z) * h.vz) < h.hd + m) return true;
  return false;
}
function scatterTrees() {
  const noTree = (x, z) => {
    if (roadGap(x, z) < 1.6 || talabDepthAt(x, z) !== null) return true;
    const l = toLocal(FRAME.park, x, z);
    if (l[0] > -140 && l[0] < -28 && l[1] > -112 && l[1] < 86) return true;                // tank, gallery terrace and the plaza in front
    if (Math.hypot(l[0], l[1]) < 25 || (Math.abs(l[0]) < 8 && l[1] > 18 && l[1] < 86) || (l[0] > -42 && l[0] < -20 && Math.abs(l[1]) < 8)) return true;   // tower court and its paved approaches
    if (l[0] > 12 && l[0] < 92 && l[1] > 4 && l[1] < 80 && chance(0.55)) return true;        // keep the riding ground fairly open
    if (l[0] > 22 && l[0] < 62 && l[1] > -62 && l[1] < -10) return true;                   // play area
    return false;
  };
  for (const g of MAP.green) {
    if (g.k === 'pitch') continue;
    const bb = polyBounds(g.p), n = Math.round((bb[1] - bb[0]) * (bb[3] - bb[2]) / (g.n === 'Gulab Vatika' ? 420 : 300));
    for (let i = 0; i < n; i++) { const x = rr(bb[0], bb[1]), z = rr(bb[2], bb[3]); if (featureContains(x, z, g) && inFocus(x, z, 90) && !noTree(x, z)) treeSpots.push([x, z, chance(g.n ? 0.2 : 0.1) ? 2 : chance(0.3) ? 1 : 0, rr(0.85, 1.45)]); }
  }
  // the walled grounds on Hussainabad Trust Road are full of trees on the imagery
  for (const [s0, s1, depth, kind] of FRONT_GROUNDS) {
    const n = Math.round((s1 - s0) * depth / (kind === 'park' ? 260 : 120));
    for (let i = 0; i < n; i++) {
      const s = rr(s0 + 2, s1 - 2), [x, z] = southAt(s, mainHalf(s) + FRONT_SET + rr(2.5, depth - 4));
      if (roadGap(x, z) > 2.2 && !houseNear(x, z, 1.8) && !MAP.buildings.some(b => featureContains(x, z, b))) treeSpots.push([x, z, chance(0.3) ? 1 : 0, rr(0.95, 1.5)]);
    }
  }
  for (const a of MAP.areas) if (/college|education|hospital|Mosque|worship|wastewater/.test(a.k)) {
    const bb = polyBounds(a.p), n = Math.round((bb[1] - bb[0]) * (bb[3] - bb[2]) / 900);
    for (let i = 0; i < n; i++) { const x = rr(bb[0], bb[1]), z = rr(bb[2], bb[3]); if (featureContains(x, z, a) && inFocus(x, z, 40) && roadGap(x, z) > 2 && !MAP.buildings.some(b => featureContains(x, z, b))) treeSpots.push([x, z, chance(0.3) ? 1 : 0, rr(0.9, 1.5)]); }
  }
  // street trees and palms along the heritage road
  const a = [0, 0, 0, 0];
  for (let s = S_PARK0 + 10; s < MAIN.len - 10; s += 19) for (const side of [1, -1]) {
    if ((s > S_DUAL1 - 10 && s < S_RUMI1 + 6) || chance(0.3)) continue;
    const st = s + rr(-3, 3); polyAt(MAIN, st, a); const off = mainHalf(s) + 2.6, x = a[0] + a[3] * side * off, z = a[1] - a[2] * side * off;
    if (side < 0 && (Math.abs(st - FRONT_FEATURES.kiosk) < 4.5 || Math.abs(st - FRONT_FEATURES.gate) < 4.5)) continue;   // keep clear of the corner kiosk and the lane gate
    if (roadGap(x, z) > 1.2) treeSpots.push([x, z, chance(0.22) ? 2 : 0, rr(0.8, 1.15)]);
  }
  // a few courtyard trees in the dense fabric
  for (let i = 0; i < 520; i++) { const x = rr(-880, 880), z = rr(-450, 800); if (roadGap(x, z) > 2.5 && inFocus(x, z) && !inOpen(x, z)) { let free = true; const l = HGRID.get(Math.floor(x / 16) * 4096 + Math.floor(z / 16)); if (l) for (const h of l) if (Math.abs((x - h.x) * h.ux + (z - h.z) * h.uz) < h.hw + 1.5 && Math.abs((x - h.x) * h.vx + (z - h.z) * h.vz) < h.hd + 1.5) free = false; if (free) treeSpots.push([x, z, chance(0.4) ? 1 : 0, rr(0.8, 1.3)]); } }
}
function buildTrees() {
  const o = new THREE.Object3D(), col = new THREE.Color();
  // Leave room for the trunk, the walker's clearance and the 1 m collision cells.
  const trees = treeSpots.filter(t => !nearPilotTrail(t[0], t[1], 1.9) && !nearShopEntrance(t[0], t[1], 1.6));
  const broad = trees.filter(t => t[2] < 2), palms = trees.filter(t => t[2] === 2), small = trees.filter(t => t[2] === 3);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.4, 3.8, 6).translate(0, 1.9, 0), M(0x5a4636), broad.length);
  const ico = (r, x, y, z) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
  const ico0 = (r, x, y, z) => new THREE.IcosahedronGeometry(r, 0).translate(x, y, z);
  const crown = new THREE.InstancedMesh(mergeGeometries([ico(3.1, 0, 6.1, 0), ico0(2.4, 1.9, 5, 0.9), ico0(2.3, -1.7, 5.2, -1.2), ico0(2.1, 0.3, 4.9, -2), ico0(2.0, -0.6, 7.6, 0.5)]), M(0xffffff, { flatShading: true, roughness: 1 }), broad.length);
  broad.forEach((t, i) => { const s = t[3] * (t[2] === 1 ? 1.25 : 1); o.position.set(t[0], 0, t[1]); o.scale.set(s, s * rr(0.9, 1.15), s); o.rotation.y = rr(0, TAU); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix); crown.setMatrixAt(i, o.matrix); crown.setColorAt(i, col.setHSL(t[2] === 1 ? rr(0.27, 0.33) : rr(0.22, 0.3), rr(0.35, 0.52), t[2] === 1 ? rr(0.2, 0.28) : rr(0.27, 0.38))); COLLIDERS.push({ x: t[0], z: t[1], ax: 1, az: 0, bx: 0, bz: 1, hw: 0.3, hd: 0.3, yb: 0, yt: 3 }); });
  trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true; trunk.frustumCulled = crown.frustumCulled = false; scene.add(trunk, crown);
  // royal palms
  const fr = [];
  for (let k = 0; k < 11; k++) { const g = new THREE.PlaneGeometry(0.95, 3.9, 1, 5); g.translate(0, 1.95, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 3.9; p.setXYZ(i, p.getX(i) * (1 - v * 0.75), Math.sin(v * 1.9) * 1.25 - v * v * 2.1, v * 3.6); } g.computeVertexNormals(); g.rotateY(k * TAU / 11 + (k % 2) * 0.2); g.translate(0, 10.6 + (k % 3) * 0.12, 0); fr.push(g); }
  fr.push(new THREE.SphereGeometry(0.42, 8, 6).translate(0, 10.5, 0));
  const pt = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.3, 10.6, 7).translate(0, 5.3, 0), M(0xa39a86, { roughness: 1 }), palms.length);
  const pc = new THREE.InstancedMesh(mergeGeometries(fr.map(g => g.index ? g.toNonIndexed() : g)), M(0x55863a, { side: THREE.DoubleSide, roughness: 1 }), palms.length);
  palms.forEach((t, i) => { const s = t[3] * rr(0.85, 1.05); o.position.set(t[0], 0, t[1]); o.scale.set(s, s, s); o.rotation.y = rr(0, TAU); o.updateMatrix(); pt.setMatrixAt(i, o.matrix); pc.setMatrixAt(i, o.matrix); });
  pt.castShadow = pc.castShadow = true; pt.frustumCulled = pc.frustumCulled = false; scene.add(pt, pc);
  // clipped garden shrubs
  const sh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.95, 1.9, 8).translate(0, 0.95, 0), M(0x3f6b33, { flatShading: true, roughness: 1 }), small.length);
  small.forEach((t, i) => { o.position.set(t[0], 0, t[1]); o.scale.setScalar(t[3]); o.rotation.y = 0; o.updateMatrix(); sh.setMatrixAt(i, o.matrix); }); sh.castShadow = true; sh.frustumCulled = false; scene.add(sh);
}

/* ───────────── lamps, masts, poles and wires ───────────── */
const BUNTING = { normal: null, muharram: null };
const LAMPS = [];        // [x, z, rotY, kind]  kind 0 heritage swan-neck, 1 double, 2 high mast, 3 garden post, 4 avenue lamp on a granite pedestal
function planStreetFurniture() {
  const a = [0, 0, 0, 0];
  for (let s = S_PARK0 + 6, i = 0; s < MAIN.len - 6; s += 15, i++) {
    if (s > S_DUAL1 - 4 && s < S_RUMI1) continue;
    const side = i % 2 ? 1 : -1; if (side > 0 && s < S_DUAL1) continue;      // the park side of the avenue has the pedestal lamps below
    polyAt(MAIN, s, a); const off = mainHalf(s) + 0.7, x = a[0] + a[3] * side * off, z = a[1] - a[2] * side * off;
    if (roadGap(x, z) > 0.2 && !nearShopEntrance(x, z, 0.65)) LAMPS.push([x, z, Math.atan2(-a[3] * side, a[2] * side), i % 5 === 0 ? 1 : 0]);
  }
  // The heritage-zone street lamp (Archohm's design, 2016): two bronze arms on a 2.25 m red granite pedestal, curving
  // like halves of the Rumi Darwaza arch, the taller over the road and the shorter over the footpath. They line the
  // park side of the avenue from the Clock Tower park to the gate.
  for (let s = S_PARK0 + 16; s < S_DUAL1 - 4; s += 24) {
    polyAt(MAIN, s, a); const off = mainHalf(s) + 0.9, x = a[0] + a[3] * off, z = a[1] - a[2] * off;
    if (roadGap(x, z) < 0.3 || nearShopEntrance(x, z, 0.8) || COLLIDERS.some(c => Math.abs((x - c.x) * c.ax + (z - c.z) * c.az) < c.hw + 0.9 && Math.abs((x - c.x) * c.bx + (z - c.z) * c.bz) < c.hd + 0.9)) continue;
    LAMPS.push([x, z, Math.atan2(-a[3], a[2]), 4]);
  }
  for (const q of [[-250, -50], [-300, -76], [-352, -104], [-376, -74], [-320, -46], [-272, -22]]) LAMPS.push([q[0], q[1], rr(0, TAU), 1]);
  for (const q of [[352, 300], [376, 330], [444, 296], [462, 316]]) LAMPS.push([q[0], q[1], rr(0, TAU), 1]);
}
/** the surveyed south side of Hussainabad Trust Road: kerb screens, the lane gate, the corner kiosk and the walls of the grounds */
function buildFrontageDetail(g) {
  const at = (s, off) => southAt(s, mainHalf(s) + off);
  const facing = s => { const a = polyAt(MAIN, s); return Math.atan2(a[3], -a[2]); };       // local +z toward the road
  const { gate, kiosk, jali } = FRONT_FEATURES;
  // low sandstone lattice screens on the kerb, a short run between each pair of shop doors
  for (let s = jali[0]; s < jali[1] - 2.6; s += 6.2) {
    const m = s + 1.3; if (Math.abs(m - gate) < 4.5 || Math.abs(m - kiosk) < 4.5) continue;
    const [x0, z0] = at(s, 0.32), [x1, z1] = at(s + 2.6, 0.32), [xm, zm] = at(m, 0.32);
    if (roadGap(x0, z0) < 0.1 || roadGap(x1, z1) < 0.1 || nearShopEntrance(xm, zm, 0.6) || LAMPS.some(l => Math.hypot(l[0] - xm, l[1] - zm) < 2)) continue;
    railing(g, x0, z0, x1, z1, 0.92, true);
  }
  // the white gate over the lane at s 323: a cusped arch, two small minarets and the pair of fish of the Awadh crest
  {
    const [x, z] = at(gate, FRONT_SET + 0.45), k = grp(g, x, z, facing(gate));
    gateSlab(k, MAT.white, 5.6, 5.3, 0.9, [{ x: 0, w: 3.3, h: 4.3, cusps: 3 }]);
    B(k, MAT.whiteD, 6.0, 0.32, 1.1, 0, 5.3, 0, true);
    merlons(k, MAT.white, -2.5, 2.5, 5.62, 0, 7, 0.42, 0.5, 0.6);
    for (const sx of [-2.6, 2.6]) minaret(k, MAT.white, MAT.white, 1.5, 0.24, sx, 5.62, 0, 1);
    const fish = new THREE.Shape(); fish.moveTo(-0.5, 0); fish.quadraticCurveTo(-0.1, 0.26, 0.32, 0.05); fish.lineTo(0.55, 0.2); fish.lineTo(0.5, 0); fish.lineTo(0.55, -0.2); fish.lineTo(0.32, -0.05); fish.quadraticCurveTo(-0.1, -0.26, -0.5, 0);
    const fg = new THREE.ShapeGeometry(fish, 6);
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(fg, MAT.stone); f.position.set(sx * 2.05, 4.6, 0.47); f.scale.set(-sx * 0.95, 0.95, 1); f.rotation.z = sx * 0.12; k.add(f); }
  }
  // the octagonal sandstone kiosk with jali windows and a dome, on the corner of Khun Khun Ji Road
  {
    const [x, z] = at(kiosk, 1.75), k = grp(g, x, z, facing(kiosk));
    C(k, MAT.pinkD, 1.62, 1.68, 0.3, 0, 0, 0, 8, true);
    C(k, MAT.pink, 1.3, 1.3, 2.7, 0, 0.3, 0, 8, true);
    for (let i = 0; i < 8; i++) decal(grp(k, 0, 0, Math.PI / 8 + i * TAU / 8), 0.66, 1.75, 0, 0.62, 1.15, { mat: MAT.jaali, trim: MAT.trim, cusps: 3 });
    C(k, MAT.pinkD, 1.55, 1.42, 0.24, 0, 3.0, 0, 8, true, true);
    C(k, MAT.pink, 1.02, 1.08, 0.36, 0, 3.24, 0, 8, true, true);
    dome(k, MAT.pink, 1.02, 0, 3.6, 0, 1.05, MAT.pinkD);
  }
  // the walls of the grounds behind the footpath: murals on yellow at the zonal office, cream and railings at the campus, red lattice at Nimbu Park
  const yellow = M(0xe5bf48, { map: TEX.plaster }), mural = new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(1024, 128, (x, w, h) => {
    const bg = ['#7cc2ea', '#f3a3a3', '#9fd89a', '#f7d774', '#c2a6e8', '#f5b27a', '#8fd6c9', '#f0c1d9'];
    for (let i = 0; i < 8; i++) {
      const x0 = i * 128; x.fillStyle = bg[i]; x.fillRect(x0, 0, 128, h);
      x.fillStyle = '#2f5e8f'; x.fillRect(x0, h - 10, 128, 10);
      for (let k = 0; k < 2; k++) { const cx = x0 + 34 + k * 56; x.fillStyle = ['#c0392b', '#1f6fb5', '#27885a', '#8e44ad'][(i + k) % 4]; x.fillRect(cx - 9, 52, 18, 40); x.fillStyle = '#e0b48a'; x.beginPath(); x.arc(cx, 42, 9, 0, TAU); x.fill(); }
      x.fillStyle = '#2e7d4f'; x.fillRect(x0 + 100, 70, 14, 22); x.fillStyle = '#1b1b1b'; x.font = 'bold 16px "Nirmala UI","Segoe UI",sans-serif'; x.textAlign = 'center'; x.fillText(i % 2 ? 'स्वच्छ लखनऊ' : 'स्वच्छता ही सेवा', x0 + 64, 22);
    }
  }, 0) });
  for (const [s0, s1, , kind] of FRONT_GROUNDS) {
    const opening = { office: [474, 6], campus: [683, 6], park: [792, 3] }[kind], from = kind === 'park' ? 768 : s0;
    for (let s = from, i = 0; s < s1 - 0.5; s += 3, i++) {
      const e = Math.min(s + 3, s1); if (e > opening[0] - opening[1] / 2 && s < opening[0] + opening[1] / 2) continue;
      const [x0, z0] = at(s, FRONT_SET + 0.15), [x1, z1] = at(e, FRONT_SET + 0.15);
      if (roadGap(x0, z0) < 0.4 || roadGap(x1, z1) < 0.4) continue;
      if (kind === 'park') { railing(g, x0, z0, x1, z1, 1.15, true); continue; }
      const len = Math.hypot(x1 - x0, z1 - z0), w = grp(g, (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0));
      if (kind === 'office') {
        B(w, yellow, len + 0.02, 1.6, 0.25, 0, 0, 0); B(w, MAT.whiteD, len + 0.04, 0.1, 0.32, 0, 1.6, 0, true);
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.3, 1.05), mural), uvs = pm.geometry.attributes.uv, u0 = (i % 4) / 4;
        for (let j = 0; j < 4; j++) uvs.setX(j, u0 + uvs.getX(j) * 0.25);
        pm.position.set(0, 0.85, -0.14); pm.rotation.y = Math.PI; w.add(pm);      // the murals face the road
      } else {
        B(w, MAT.whiteD, len + 0.02, 0.9, 0.25, 0, 0, 0); B(w, MAT.iron, len, 0.05, 0.05, 0, 1.85, 0, true); B(w, MAT.iron, len, 0.04, 0.04, 0, 1.3, 0, true);
        for (let q = 0; q < 2; q++) B(w, MAT.iron, 0.05, 0.95, 0.05, -len / 2 + 0.1 + q * len / 2, 0.9, 0, true);
      }
    }
    for (const d of [-1, 1]) { const s = opening[0] + d * (opening[1] / 2 + 0.3), [x, z] = at(s, FRONT_SET + 0.15); if (roadGap(x, z) > 0.4) B(grp(g, x, z, facing(s)), kind === 'office' ? yellow : MAT.pink, 0.6, 2.2, 0.6, 0, 0, 0); }
  }
}
/** low sandstone wall on the park side, bunting, benches, bins and kerbside two-wheelers along the Rumi Darwaza – Chota Imambara road */
function buildStreetDetail() {
  const g = new THREE.Group(), a = [0, 0, 0, 0], b = [0, 0, 0, 0], bin = M(0x2e7d4f, { roughness: 0.6 });
  for (let s = S_PARK0 + 6; s < S_DUAL0 - 8; s += 3) {                         // park-side wall with openings
    polyAt(MAIN, s, a); polyAt(MAIN, s + 3, b); const off = mainHalf(s) + 3.75, x0 = a[0] + a[3] * off, z0 = a[1] - a[2] * off, x1 = b[0] + b[3] * off, z1 = b[1] - b[2] * off, l = toLocal(FRAME.park, x0, z0);
    if (Math.floor(s / 3) % 11 > 8 || Math.abs(l[0]) < 9 || Math.abs(l[0] + 36) < 8 || roadGap(x0, z0) < 1.2 || roadGap(x1, z1) < 1.2) continue;
    const w = grp(g, (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)), len = Math.hypot(x1 - x0, z1 - z0);
    B(w, MAT.pink, len, 0.62, 0.34, 0, 0, 0); B(w, MAT.pinkD, len + 0.04, 0.1, 0.44, 0, 0.62, 0, true); if (Math.floor(s / 3) % 3 === 0) { B(w, MAT.pinkD, 0.46, 1.0, 0.46, -len / 2, 0, 0, true); cone(w, MAT.pink, 0.3, 0.3, -len / 2, 1.0, 0, 4).rotation.y = Math.PI / 4; }
  }
  for (let s = S_PARK0 + 14, i = 0; s < MAIN.len - 12; s += 21, i++) {          // benches, bins, kerbside scooters, extra carts
    if (s > S_DUAL1 - 8 && s < S_RUMI1 + 8) continue; polyAt(MAIN, s, a);
    for (const side of [1, -1]) {
      const h = mainHalf(s), px = (o2, ds = 0) => { polyAt(MAIN, s + ds, b); return [b[0] + b[3] * side * o2, b[1] - b[2] * side * o2, Math.atan2(-b[3] * side, b[2] * side)]; };
      const shopRow = side < 0 && s > FRONT_SPAN[0] - 4 && s < FRONT_SPAN[1] + 4;     // no benches against the surveyed shop fronts
      const q = px(h + 2.7, 3); if (!shopRow && roadGap(q[0], q[1]) > 1 && !nearShopEntrance(q[0], q[1], 1.15) && i % 2 === (side > 0 ? 0 : 1)) { const bg = grp(g, q[0], q[1], q[2]); B(bg, MAT.pink, 2.2, 0.12, 0.6, 0, 0.5, 0, true); B(bg, MAT.pinkD, 0.28, 0.36, 0.5, -0.8, 0.16, 0, true); B(bg, MAT.pinkD, 0.28, 0.36, 0.5, 0.8, 0.16, 0, true); SEATS.push([q[0], 0.62, q[1], q[2]]); }
      const d = px(h + 0.75, 9); if (roadGap(d[0], d[1]) > 0.3 && !nearShopEntrance(d[0], d[1], 0.35)) C(g, bin, 0.26, 0.22, 0.8, d[0], 0.16, d[1], 8, false, true);
      if (side < 0 || s > S_RUMI1) for (let k = 0, n = ri(1, 4); k < n; k++) { const v = px(h - 0.7, -6 + k * 1.1 + rr(-0.2, 0.2)); PARKED.push([v[0], v[1], v[2] + rr(-0.25, 0.25), pick(['scooter', 'bike', 'scooter', 'cycle'])]); }
      if (side < 0 && i % 3 === 1) { const v = px(h + 1.5, 12); if (roadGap(v[0], v[1]) > 0.8) VENDORS.push([v[0], v[1], v[2], pick(['fruit', 'chaat', 'juice', 'tea', 'corn'])]); }
    }
  }
  buildFrontageDetail(g);
  bake(g);
  // bunting strung across the road; Muharram replaces it with black, green and red pennants (festival.js)
  const bunting = FL => {
    const p = painter();
    for (let s = S_PARK0 + 22, i = 0; s < MAIN.len - 20; s += 34, i++) {
      if (s > S_DUAL0 - 10 && s < S_RUMI1 + 16) continue; polyAt(MAIN, s, a); const h = mainHalf(s) + 0.6, ry = Math.atan2(a[2], a[3]);
      for (let k = 0; k <= 22; k++) { const t = k / 22, off = (t * 2 - 1) * h, y = 6.3 - Math.sin(t * Math.PI) * 0.9, x = a[0] + a[3] * off, z = a[1] - a[2] * off; if (k < 22) p.box(h * 2 / 22 + 0.05, 0.03, 0.03, x + a[3] * h / 22, y - (Math.sin((t + 1 / 44) * Math.PI) - Math.sin(t * Math.PI)) * 0.9, z - a[2] * h / 22, 0x2a2a2a, ry); if (k > 0 && k < 22) p.box(0.36, 0.42, 0.02, x, y - 0.26, z, FL[(k + i) % FL.length], ry); }
    }
    if (!p.count) return null;
    const m = new THREE.Mesh(p.done(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })); m.castShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m;
  };
  BUNTING.normal = bunting([0x1c8a4a, 0xf39c12, 0xf4f4f0, 0xc0392b, 0x1f6fb5, 0x8e24aa]);
  BUNTING.muharram = bunting([0x121212, 0x14532d, 0x121212, 0x7f1d1d, 0x121212, 0x14532d, 0x121212]);
  if (BUNTING.muharram) BUNTING.muharram.visible = false;
  // carts and tea stalls where lanes meet, so the back streets are not empty
  NET.nodes.forEach((nd, ni) => { if (nd.e.length < 3 || !inFocus(nd.x, nd.z, -20) || mainProject(nd.x, nd.z).d < 22 || !chance(0.34)) return; const e = NET.edges[nd.e[0]], q = polyAt(e.pl, e.a === ni ? Math.min(5, e.len) : Math.max(0, e.len - 5)), off = e.w / 2 - 0.2; VENDORS.push([q[0] + q[3] * off, q[1] - q[2] * off, Math.atan2(-q[3], q[2]), pick(['tea', 'fruit', 'chaat', 'corn', 'juice'])]); if (chance(0.6)) PARKED.push([q[0] - q[3] * off, q[1] + q[2] * off, rr(0, TAU), pick(['scooter', 'bike', 'cycle'])]); });
}
function buildLamps() {
  const o = new THREE.Object3D();
  const arm = side => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 5.5, 0), new THREE.Vector3(0, 7.5, 0.25 * side), new THREE.Vector3(0, 6.55, 1.7 * side)), 8, 0.055, 5);
  const pole = (h, r) => new THREE.CylinderGeometry(r * 0.6, r, h, 7).translate(0, h / 2, 0), base = new THREE.CylinderGeometry(0.2, 0.28, 0.7, 7).translate(0, 0.35, 0);
  const ni = g => g.index ? g.toNonIndexed() : g;
  const lant = side => [new THREE.SphereGeometry(0.34, 9, 6).scale(1, 0.62, 1).translate(0, 6.2, 1.7 * side), new THREE.ConeGeometry(0.2, 0.35, 8).translate(0, 6.55, 1.7 * side)];
  const kinds = [
    { pole: [pole(5.6, 0.12), base, arm(1)], lamp: lant(1), pts: [[0, 6.1, 1.7]] },
    { pole: [pole(5.6, 0.12), base, arm(1), arm(-1)], lamp: [...lant(1), ...lant(-1)], pts: [[0, 6.1, 1.7], [0, 6.1, -1.7]] },
    { pole: [pole(13, 0.2), base, new THREE.BoxGeometry(1.8, 0.12, 0.12).translate(0, 12.9, 0)], lamp: [new THREE.BoxGeometry(0.5, 0.2, 0.4).translate(-0.7, 12.75, 0), new THREE.BoxGeometry(0.5, 0.2, 0.4).translate(0.7, 12.75, 0)], pts: [[0, 12.6, 0]] },
    { pole: [pole(2.9, 0.07), new THREE.CylinderGeometry(0.14, 0.2, 0.3, 6).translate(0, 0.15, 0)], lamp: [new THREE.SphereGeometry(0.22, 8, 6).translate(0, 3.05, 0)], pts: [[0, 3.05, 0]] },
    avenueLamp(),
  ];
  const lampMat = M(0xfff2d0, { emissive: 0xffc878, emissiveIntensity: 0 });
  kinds.forEach((k, ki) => {
    const list = LAMPS.filter(l => l[3] === ki); if (!list.length) return;
    const parts = [[k.pole, k.poleMat || MAT.iron, true], [k.lamp, lampMat, false], ...(k.extra || [])].map(([geos, mat, cast]) => { const m = new THREE.InstancedMesh(mergeGeometries(geos.map(ni)), mat, list.length); m.castShadow = cast; m.frustumCulled = false; scene.add(m); return m; });
    list.forEach((l, i) => {
      o.position.set(l[0], 0, l[1]); o.rotation.y = l[2]; o.updateMatrix(); for (const m of parts) m.setMatrixAt(i, o.matrix);
      const c = Math.cos(l[2]), s = Math.sin(l[2]);
      for (const q of k.pts) lampSpots.push([l[0] + s * q[2] + c * q[0], q[1], l[1] + c * q[2] - s * q[0], ki === 2 ? 2 : 1, ki, q[3] || 1]);
      if (k.col) COLLIDERS.push({ x: l[0], z: l[1], ax: c, az: -s, bx: s, bz: c, hw: k.col[0], hd: k.col[0], yb: 0, yt: k.col[1] });
    });
  });
  // a glow round each lamp head: warm for the heritage lamps, cool for the LED plaza lamps and masts
  const hc = lampSpots.flatMap(l => l[4] === 1 || l[4] === 2 ? [0.82, 0.9, 1] : [1, 0.84, 0.62]);
  const haloMat = new THREE.PointsMaterial({ map: glowTex, size: 7.5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true });
  const halo = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampSpots.flatMap(l => [l[0], l[1], l[2]]), 3)).setAttribute('color', new THREE.Float32BufferAttribute(hc, 3)), haloMat); halo.frustumCulled = false; scene.add(halo);
  NIGHTFX.push(() => {
    const light = TIME.lamps;
    lampMat.emissiveIntensity = light * 1.75;
    haloMat.opacity = light * 0.72;
    halo.visible = light > 0.02;
  });
}
/** the heritage-zone lamp: red granite pedestal, two bronze arms of unequal height ending in hanging jaali lanterns */
let lanternMat = null;
function avenueLamp() {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), granite = M(0x9c5045, { roughness: 0.42, metalness: 0.05 }), bronze = M(0x3b2f27, { roughness: 0.5, metalness: 0.55 });
  if (!lanternMat) {
    const dots = (bg, fg) => canvasTex(64, 64, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.beginPath(); x.arc(c * 16 + 8 + (r % 2) * 8, r * 16 + 8, 4.2, 0, TAU); x.fill(); } }, 0);
    const map = dots('#3b2f27', '#d9b27a'), glow = dots('#000000', '#ffffff'); map.repeat.set(6, 2); glow.repeat.set(6, 2);
    lanternMat = M(0xffffff, { map, emissiveMap: glow, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.55, metalness: 0.4 });
    NIGHTFX.push(() => { lanternMat.emissiveIntensity = TIME.lamps * 2.2; });
  }
  const bell = new THREE.LatheGeometry([[0.001, 0.08], [0.05, 0.06], [0.07, 0], [0.16, -0.08], [0.29, -0.24], [0.33, -0.38], [0.31, -0.48], [0.22, -0.53], [0.001, -0.54]].map(p => new THREE.Vector2(p[0], p[1])), 12);
  const pole = [], lamp = [], shell = [], pts = [];
  for (const [h, dir, dx, scale] of [[10.4, 1, 0.13, 1], [8.2, -1, -0.13, 0.8]]) {
    pole.push(new THREE.CylinderGeometry(0.075, 0.1, h - 3.85, 8).translate(dx, 2.25 + (h - 3.85) / 2, 0), new THREE.CylinderGeometry(0.13, 0.13, 0.25, 8).translate(dx, 2.37, 0));
    pole.push(new THREE.TubeGeometry(new THREE.CubicBezierCurve3(V(dx, h - 1.6, 0), V(dx, h - 0.2, 0), V(dx, h + 0.15, dir * 1.1), V(dx, h - 0.35, dir * 1.75)), 10, 0.07, 6));
    shell.push(bell.clone().translate(dx, h - 0.4, dir * 1.75));
    lamp.push(new THREE.CircleGeometry(0.22, 10).rotateX(Math.PI / 2).translate(dx, h - 0.93, dir * 1.75));
    pts.push([dx, h - 0.8, dir * 1.75, scale]);
  }
  const ped = [new THREE.BoxGeometry(0.92, 0.12, 0.92).translate(0, 0.06, 0), new THREE.BoxGeometry(0.74, 2.0, 0.74).translate(0, 1.12, 0), new THREE.BoxGeometry(0.86, 0.13, 0.86).translate(0, 2.185, 0)];
  return { pole, poleMat: bronze, lamp, pts, col: [0.46, 2.25], extra: [[ped, granite, true], [shell, lanternMat, true]] };
}
function buildWires() {
  const poles = [], pos = [], a = [0, 0, 0, 0];
  const run = (pl, side, off, s0, s1) => { let prev = null; for (let s = s0; s < s1; s += 27) { polyAt(pl, s, a); const x = a[0] + a[3] * side * off, z = a[1] - a[2] * side * off; if (roadGap(x, z) < 0.3) { prev = null; continue; } const p = [x, z, Math.atan2(a[2], a[3])]; poles.push(p); if (prev) for (const dy of [0, -0.45, -0.9]) for (const dl of [-0.55, 0.55]) { const lx = Math.cos(p[2]) * dl, lz = -Math.sin(p[2]) * dl; for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, sag = t => 7.9 + dy - Math.sin(t * Math.PI) * 0.55; pos.push(lerp(prev[0], p[0], t0) + lx, sag(t0), lerp(prev[1], p[1], t0) + lz, lerp(prev[0], p[0], t1) + lx, sag(t1), lerp(prev[1], p[1], t1) + lz); } } prev = p; } };
  run(MAIN, -1, 10.4, S_PARK0 + 4, S_DUAL0 - 8);
  for (const e of NET.edges) if (!e.main && e.ped && e.len > 70 && /tertiary|residential/.test(e.k) && chance(0.55)) run(e.pl, chance(0.5) ? 1 : -1, e.w / 2 + 0.5, 6, e.len - 6);
  const o = new THREE.Object3D(), pm = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(0.11, 0.16, 8.3, 6).translate(0, 4.15, 0), new THREE.BoxGeometry(1.5, 0.1, 0.1).translate(0, 7.9, 0), new THREE.BoxGeometry(1.2, 0.1, 0.1).translate(0, 7.0, 0)].map(g => g.toNonIndexed())), M(0x8f8a80), poles.length);
  poles.forEach((p, i) => { o.position.set(p[0], 0, p[1]); o.rotation.y = p[2]; o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }); pm.castShadow = true; pm.frustumCulled = false; scene.add(pm);
  const w = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: 0x1c1c1c, transparent: true, opacity: 0.75 })); w.frustumCulled = false; scene.add(w);
}
