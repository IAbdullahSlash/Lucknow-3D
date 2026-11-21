'use strict';
/* monuments.js — the heritage buildings, each in its surveyed position and orientation (see FRAME in core.js) */

const FOUNTAINS = [], VENDORS = [], PARKED = [], SEATS = [], ZONES = [], CLOCK_HANDS = [], FESTIVE = [], RIDE_LOOPS = [], MARKET_STALLS = [];
const WORLD = { x: 0, z: 0, rot: 0 };
const zone = (f, x0, z0, x1, z1, n, y = 0) => ZONES.push({ f, x0, z0, x1, z1, n, y });
const seatAt = (f, lx, lz, y, yaw) => { const w = toWorld(f, lx, lz); SEATS.push([w[0], y, w[1], yaw + f.rot]); };
const vendor = (f, lx, lz, yaw, type) => { const w = toWorld(f, lx, lz); VENDORS.push([w[0], w[1], yaw + f.rot, type]); };
const parkAt = (f, lx, lz, yaw, type) => { const w = toWorld(f, lx, lz); PARKED.push([w[0], w[1], yaw + f.rot, type]); };
const lampAt = (f, lx, lz, kind, yaw = 0) => { const w = toWorld(f, lx, lz); LAMPS.push([w[0], w[1], yaw + f.rot, kind]); };
const treeAt = (f, lx, lz, kind = 0, s = 1) => { const w = toWorld(f, lx, lz); treeSpots.push([w[0], w[1], kind, s]); };
const jet = (f, lx, lz, y, h, spread, n = 36) => { const w = toWorld(f, lx, lz); FOUNTAINS.push({ x: w[0], y, z: w[1], h, spread, n, ph: rnd() * TAU }); };
/** string of festive bulbs along a polyline given in a frame's coordinates: [[x, y, z], …] */
function lights(f, pts, step = 0.75) {
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step)); for (let k = 0; k < n; k++) { const t = k / n, w = toWorld(f, lerp(a[0], b[0], t), lerp(a[2], b[2], t)); FESTIVE.push(w[0], lerp(a[1], b[1], t), w[1]); } }
}
const boxLights = (f, cx, cz, w, d, y) => lights(f, [[cx - w / 2, y, cz - d / 2], [cx + w / 2, y, cz - d / 2], [cx + w / 2, y, cz + d / 2], [cx - w / 2, y, cz + d / 2], [cx - w / 2, y, cz - d / 2]]);
function wallRun(p, mat, x0, z0, x1, z1, h, t = 0.9, crenel = true) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 0.5) return;
  const g = grp(p, (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-dz, dx)); B(g, mat, len, h, t, 0, 0, 0);
  if (crenel) merlons(g, mat, -len / 2, len / 2, h, 0, Math.max(2, Math.round(len / 1.7)), 0.85, 0.6, t);
}
function signBoard(p, w, x, y, z, cell = genericCell(), material = signMats[0]) {
  const g = new THREE.PlaneGeometry(w, w / 4), q = signUV(cell), uv = g.attributes.uv;
  uv.setXY(0, q[0], q[3]); uv.setXY(1, q[2], q[3]); uv.setXY(2, q[0], q[1]); uv.setXY(3, q[2], q[1]);
  const m = new THREE.Mesh(g, material); m.position.set(x, y + w / 8, z + 0.12); p.add(m); return m;
}
/** a board with its own lettering (used for the few big named signs) */
const BOARD_MATS = [];
function textBoard(p, lines, w, h, x, y, z, bg = '#14553a', fg = '#ffffff') {
  const tex = canvasTex(512, Math.max(32, Math.round(512 * h / w)), (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H); c.strokeStyle = fg; c.lineWidth = 4; c.strokeRect(5, 5, W - 10, H - 10); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((t, i) => { c.font = `bold ${Math.round(H / (lines.length + 0.5) * (i ? 0.66 : 0.82))}px "Segoe UI","Nirmala UI",sans-serif`; c.fillText(t, W / 2, H * (i + 0.5) / lines.length + (i ? -2 : 2), W - 28); });
  }, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7 }), m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y + h / 2, z + 0.09); p.add(m); BOARD_MATS.push(mat); return m;
}
/** The peach heritage-style kiosks of the Nagar Nigam food zone round the Clock Tower. */
function heritageKiosk(g, x, z, rot, cell) {
  const k = grp(g, x, z, rot);
  B(k, MAT.surkhiL, 3.2, 3.0, 2.4, 0, 0, 0);
  B(k, MAT.surkhi, 3.5, 0.2, 2.7, 0, 3.0, 0, true);
  for (const mz of [1.2, -1.2]) merlons(k, MAT.surkhiL, -1.5, 1.5, 3.2, mz, 5, 0.36, 0.38, 0.26);
  decal(k, 2.0, 1.9, 0, 0.55, 1.2, { cusps: 3, trim: MAT.trimW, mat: MAT.recessLit });
  B(k, MAT.stone, 2.4, 0.08, 0.42, 0, 0.98, 1.42, true);
  signBoard(k, 2.6, 0, 2.47, 1.3, cell);
}
function kiosk(g, x, z, rot, cell) {
  if (Math.hypot(x, z) < 175) return heritageKiosk(g, x, z, rot, cell);
  const k = grp(g, x, z, rot), c = pick([MAT.teal, MAT.concrete, MAT.pink, MAT.woodL, MAT.cream, MAT.whiteD]);
  B(k, c, 3.2, 2.5, 2.2, 0, 0, 0); rectDecal(k, MAT.recessLit, 2.5, 1.25, 0, 1.0, 1.1); B(k, MAT.wood, 2.9, 0.08, 0.5, 0, 0.95, 1.32, true);
  const a = B(k, pick([MAT.cloth, MAT.fabricG, MAT.gold]), 3.4, 0.06, 1.3, 0, 2.3, 1.75, true); a.rotation.x = 0.25;
  B(k, MAT.black, 3.3, 0.86, 0.08, 0, 2.5, 1.0, true); signBoard(k, 3.2, 0, 2.53, 0.95, cell);
}
function signPost(g, x, z, rot, lines, bg = '#5a3418') {
  const k = grp(g, x, z, rot); for (const sx of [-1.3, 1.3]) C(k, MAT.iron, 0.06, 0.07, 3.3, sx, 0, 0, 6, false, true);
  textBoard(k, lines, 3.0, 1.1, 0, 2.2, 0, bg, '#fff3d6'); textBoard(grp(k, 0, 0, Math.PI), lines, 3.0, 1.1, 0, 2.2, 0, bg, '#fff3d6');
}
/** kiosks for the named stalls, wayfinding boards, and a small label for every named business */
function buildKiosks() {
  const g = new THREE.Group();
  SHOPS.forEach((q, i) => {
    if (q[4] === 1) {
      const mp = mainProject(q[2], q[3]), l = toLocal(FRAME.park, q[2], q[3]); let rot;
      if (l[0] > -160 && l[0] < 100 && l[1] > -110 && l[1] < 86) rot = FRAME.park.rot + (l[0] < -100 || (l[0] > -60 && l[0] < -40) ? Math.PI / 2 : 0);
      else { const a = polyAt(MAIN, mp.s); rot = Math.atan2(-a[3] * mp.side, a[2] * mp.side); }
      kiosk(g, q[2], q[3], rot, i); q[5] = [q[2] + Math.sin(rot) * 1.4, q[3] + Math.cos(rot) * 1.4]; VENDORS.push([q[2] + Math.sin(rot), q[3] + Math.cos(rot), rot + Math.PI, 'cook']);
    }
    if (q[5]) LABELS.push({ id: 'poi' + i, poi: true, en: q[0], hi: q[1], pos: [q[5][0], q[4] === 0 ? 5.3 : 4.5, q[5][1]] });
  });
  const along = (s, side, off) => { const a = polyAt(MAIN, s); return [a[0] + a[3] * side * off, a[1] - a[2] * side * off, Math.atan2(a[2], a[3])]; };
  [[S_PARK0 + 12, 1, ['HUSAINABAD HERITAGE ZONE', 'हुसैनाबाद हेरिटेज ज़ोन']], [mainProject(...toWorld(FRAME.park, 9, 82)).s, 1, ['CLOCK TOWER  ↑', 'घंटाघर · तालाब · पिक्चर गैलरी']], [S_DUAL0 - 14, -1, ['FRAGRANCE PARK', 'फ़्रेगरेंस पार्क']],
    [S_DUAL1 - 26, 1, ['RUMI DARWAZA', 'No vehicles beyond the bollards']], [S_RUMI1 + 46, -1, ['BARA IMAMBARA', 'बड़ा इमामबाड़ा · भूल-भुलैया']], [S_PARK0 - 26, -1, ['CHOTA IMAMBARA', 'छोटा इमामबाड़ा']]]
    .forEach(q => { const w = along(q[0], q[1], mainHalf(q[0]) + 2.2); signPost(g, w[0], w[1], w[2], q[2]); });
  bake(g);
  NIGHTFX.push(n => { for (const m of BOARD_MATS) m.emissiveIntensity = n * 0.6; });
}
function crownFinials(p, Wd, H, mat, z, tip = mat) {
  const { pts, hs } = archHead(Wd, H, 12);
  pts.forEach(q => { if (q[1] < hs + 0.6) return; const ang = Math.atan2(q[0], q[1] - hs * 0.7), m = cone(p, mat, 0.22, 1.35, q[0], q[1] - 0.15, z, 5); m.rotation.z = -ang; S(p, tip, 0.2, q[0] + Math.sin(ang) * 0.75, q[1] + 0.5 + Math.cos(ang) * 0.75, z); });
}
const RDm = M(0xd7352c, { roughness: 0.5 }), YLm = M(0xf0b90b, { roughness: 0.5 }), BLm = M(0x2f6fc4, { roughness: 0.5 });
function bench(g, f, x, z, rot) { const b = grp(g, x, z, rot); B(b, MAT.pink, 2.3, 0.12, 0.62, 0, 0.36, 0, true); B(b, MAT.pinkD, 0.3, 0.36, 0.55, -0.85, 0, 0, true); B(b, MAT.pinkD, 0.3, 0.36, 0.55, 0.85, 0, 0, true); seatAt(f, x + Math.sin(rot) * 0.1, z + Math.cos(rot) * 0.1, 0.48, rot); }
const tuft = (g, x, y, z, s = 1) => { S(g, MAT.hedge, 0.55 * s, x, y + 0.2, z, 0.8); S(g, MAT.lawn, 0.4 * s, x + 0.5 * s, y + 0.15, z + 0.2, 0.9); };
const festiveOutline = (f, Wd, H, z, x = 0, y0 = 0) => lights(f, archHead(Wd, H, 14).pts.map(q => [x + q[0], y0 + q[1] + 0.3, z]));

/* ═════════════ Clock Tower, Talab and Picture Gallery (the park north of the road) ═════════════ */
function clockTower(g) {
  P(g, MAT.stone, 15, 0.45, 15, 0, 0, 0); P(g, MAT.stone, 12.6, 0.45, 12.6, 0, 0.45, 0); P(g, MAT.stoneD, 10.2, 0.45, 10.2, 0, 0.9, 0);
  let y = 1.35;
  taper(g, MAT.brick, 7.7, 7.0, 7.9, 0, y, 0); B(g, MAT.stone, 7.55, 0.35, 7.55, 0, y + 4.1, 0, true);
  for (let k = 0; k < 4; k++) decal(grp(g, 0, 0, k * Math.PI / 2), 2.3, 3.8, 0, y + 0.1, 3.74, { mat: k % 2 ? MAT.recess : MAT.door, trim: MAT.trim });
  y = 9.25; B(g, MAT.stone, 8.8, 0.5, 8.8, 0, y, 0, true);                                    // corbelled balcony
  for (const [bx, bz, w, d] of [[0, 4.25, 8.8, 0.25], [0, -4.25, 8.8, 0.25], [4.25, 0, 0.25, 8.8], [-4.25, 0, 0.25, 8.8]]) B(g, MAT.brickD, w, 1.1, d, bx, y + 0.5, bz, true);
  arcadeBox(g, 0, 0, 8.76, 8.76, y + 0.62, 0.85, 7, 7, { mat: MAT.trim, fill: 0.5 });
  taper(g, MAT.brick, 6.7, 6.4, 4.5, 0, y + 0.5, 0);
  for (let k = 0; k < 4; k++) decal(grp(g, 0, 0, k * Math.PI / 2), 1.7, 3.2, 0, y + 1.0, 3.32, { trim: MAT.trimW });
  y = 14.25; B(g, MAT.stone, 7.1, 0.35, 7.1, 0, y, 0, true);
  taper(g, MAT.brick, 6.3, 5.7, 29.8, 0, y + 0.35, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, MAT.brickD, 0.8, 29.8, 0.8, sx * 2.82, y + 0.35, sz * 2.82, true);
  for (const yy of [19, 27, 35]) for (let k = 0; k < 4; k++) decal(grp(g, 0, 0, k * Math.PI / 2), 0.75, 2.5, 0, yy, 3.16 - 0.3 * (yy - 14.6) / 29.8, { trim: MAT.trimW });
  y = 44.4; B(g, MAT.stone, 6.5, 0.35, 6.5, 0, y, 0, true); B(g, MAT.brick, 6.0, 3.3, 6.0, 0, y + 0.35, 0, true);
  for (let k = 0; k < 4; k++) rectDecal(grp(g, 0, 0, k * Math.PI / 2), MAT.diaper, 5.0, 2.5, 0, y + 0.75, 3.0);
  B(g, MAT.stone, 6.6, 0.4, 6.6, 0, y + 3.65, 0, true);
  y = 48.45; B(g, MAT.brick, 6.6, 7.4, 6.6, 0, y, 0, true);
  for (let k = 0; k < 4; k++) {
    const face = grp(g, 0, 0, k * Math.PI / 2);
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 5.7), MAT.dial);
    dial.position.set(0, y + 3.7, 3.37);
    face.add(dial);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.04, 6, 48), MAT.copper);
    rim.position.set(0, y + 3.7, 3.405);
    face.add(rim);
  }
  B(g, MAT.stone, 7.5, 0.5, 7.5, 0, y + 7.4, 0, true);
  y = 56.35;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { C(g, MAT.brickD, 0.5, 0.62, 2.4, sx * 3.2, y, sz * 3.2, 8, true, true); dome(g, MAT.copper, 0.75, sx * 3.2, y + 2.4, sz * 3.2); }
  B(g, MAT.brick, 5.0, 4.6, 5.0, 0, y, 0, true); arcadeBox(g, 0, 0, 5.0, 5.0, y + 0.5, 3.3, 3, 3, { trim: MAT.trimW, fill: 0.6 });
  B(g, MAT.stone, 5.8, 0.4, 5.8, 0, y + 4.6, 0, true);
  y = 61.35; C(g, MAT.brick, 2.0, 2.2, 2.3, 0, y, 0, 8, true, true);
  for (let k = 0; k < 8; k++) decal(grp(g, 0, 0, (k + 0.5) * Math.PI / 4), 0.8, 1.6, 0, y + 0.35, 2.0 * Math.cos(Math.PI / 8), { trim: MAT.trimW });
  C(g, MAT.stone, 2.5, 2.5, 0.25, 0, y + 2.3, 0, 8, true, true);
  const top = dome(g, MAT.copper, 2.35, 0, y + 2.55, 0, 0.95);
  B(g, MAT.gold, 1.2, 0.06, 0.06, 0, top + 0.15, 0, true); cone(g, MAT.gold, 0.16, 0.7, 0.42, top + 0.06, 0, 5).rotation.z = -Math.PI / 2; S(g, MAT.gold, 0.2, -0.3, top + 0.4, 0, 0.7);
  lights(FRAME.park, [[3.4, 1.4, 3.4], [3.0, 44, 3.0]], 1); lights(FRAME.park, [[-3.4, 1.4, 3.4], [-3.0, 44, 3.0]], 1); lights(FRAME.park, [[3.4, 1.4, -3.4], [3.0, 44, -3.0]], 1); lights(FRAME.park, [[-3.4, 1.4, -3.4], [-3.0, 44, -3.0]], 1);
  boxLights(FRAME.park, 0, 0, 7.6, 7.6, 56); boxLights(FRAME.park, 0, 0, 6.7, 6.7, 48.3); boxLights(FRAME.park, 0, 0, 9, 9, 9.9);
}
function gallery(g) {
  const F = FRAME.park, T = { trim: MAT.trim, lit: 0.45 };
  P(g, MAT.pink, 54, 1.3, 42, -90, 0, -81);                                                   // terrace overlooking the tank
  stairs(g, MAT.pink, 18, 4, 0.325, 0.5, -90, 0, -58);
  B(g, MAT.red, 27, 11.6, 23, -88.5, 1.3, -82.5); B(g, MAT.red, 27, 11.6, 6, -88.5, 1.3, -68);
  const f = grp(g, -88.5, -65); arcade(f, 7, -13, 13, 1.6, 0, 4.4, T); arcade(f, 7, -13, 13, 7.5, 0, 3.9, T);
  arcade(grp(g, -75, -79.5, Math.PI / 2), 6, -14, 14, 1.6, 0, 4.4, T); arcade(grp(g, -75, -79.5, Math.PI / 2), 6, -14, 14, 7.5, 0, 3.9, T);
  arcade(grp(g, -88.5, -94, Math.PI), 7, -13, 13, 1.6, 0, 4.4, T); arcade(grp(g, -88.5, -94, Math.PI), 7, -13, 13, 7.5, 0, 3.9, T);
  for (const yy of [6.9, 12.9]) B(g, MAT.cream, 27.6, 0.4, 29.6, -88.5, yy, -79.5, true);
  merlons(g, MAT.cream, -102, -75, 13.3, -65.2, 16, 0.7, 0.55, 0.35);
  B(g, MAT.redD, 11, 14.6, 19, -107.5, 1.3, -79.5);                                           // taller west wing
  const fw = grp(g, -107.5, -70); arcade(fw, 3, -5, 5, 1.6, 0, 4.2, T); arcade(fw, 3, -5, 5, 7.5, 0, 3.6, T); arcade(fw, 3, -5, 5, 12.3, 0, 2.6, T);
  const fs = grp(g, -113, -79.5, -Math.PI / 2); arcade(fs, 5, -9, 9, 1.6, 0, 4.2, T); arcade(fs, 5, -9, 9, 7.5, 0, 3.6, T); arcade(fs, 5, -9, 9, 12.3, 0, 2.6, T);
  B(g, MAT.cream, 11.6, 0.4, 19.6, -107.5, 15.9, -79.5, true);
  const pr = cone(g, MAT.tin, 8.2, 3.4, -107.5, 16.3, -79.5, 4); pr.rotation.y = Math.PI / 4; pr.scale.z = 1.55;
  B(g, MAT.red, 9.6, 8.6, 15, -70.2, 1.3, -80.5); arcade(grp(g, -70.2, -73), 3, -4.2, 4.2, 1.6, 0, 4.2, T); arcade(grp(g, -65.4, -80.5, Math.PI / 2), 4, -7, 7, 1.6, 0, 4.2, T);
  B(g, MAT.cream, 10.2, 0.4, 15.6, -70.2, 9.9, -80.5, true);
  for (const x of [-96.5, -88.5, -80.5]) { B(g, MAT.red, 5, 1.4, 5, x, 13.3, -80, true); cone(g, MAT.tin, 4.2, 2.3, x, 14.7, -80, 4).rotation.y = Math.PI / 4; }
  [[-118, -57], [-122, -53], [-115, -52], [-62, -56]].forEach(q => treeAt(F, q[0], q[1], 2, 1.1));
  zone(F, -112, -64.4, -66, -60.6, 8, 1.3);
  boxLights(F, -88.5, -79.5, 27.6, 29.6, 13.4); lights(F, [[-102, 7.3, -65], [-75, 7.3, -65]]);
}
function buildPark() {
  setLoad('Raising the Clock Tower and digging the talab…');
  const F = FRAME.park, g = frameGroup(F), T = TALAB, cx = T.cx, cz = T.cz, off = a => a.map(q => [q[0] + cx, q[1] + cz]);
  { // paved "pond square" with the tank cut out
    const s = new THREE.Shape(); [[-140, -60], [-40.5, -60], [-40.5, 82], [-140, 82]].forEach((q, i) => i ? s.lineTo(q[0], -q[1]) : s.moveTo(q[0], -q[1]));
    const h = new THREE.Path(); off(talabOct(-0.7)).forEach((q, i) => i ? h.lineTo(q[0], -q[1]) : h.moveTo(q[0], -q[1])); s.holes.push(h);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), GM.herring); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = true; g.add(m);
  }
  flatRect(g, GM.herring, 46, 46, 0, 0, 0.012); flatRect(g, GM.herring, 10, 60, 0, 52, 0.012); flatRect(g, GM.herring, 14, 9, -29, 0, 0.012);
  // Stone apron at the south opening, aligned with the walk down the ghats.
  flatRect(g, GM.pathTop, 8, 5.5, cx, cz + T.b + 3.3, 0.018);
  // the stepped tank: ghats descend on all eight sides to the water
  for (let i = 0; i <= T.n; i++) g.add(ringPoly(i % 4 === 0 ? MAT.pinkD : MAT.pink, off(talabOct(i === 0 ? -0.7 : (i - 1) * T.tread)), off(talabOct(i * T.tread)), i === 0 ? 0.03 : -i * T.rise, i === T.n ? 2.4 : T.rise + 0.06));
  const yW = -(T.n * T.rise) - 0.25;
  flatPoly(g, talabWater, off(talabOct(T.n * T.tread)), yW);
  const R = off(talabOct(-0.35));
  for (let i = 0; i < 8; i++) {
    const p = R[i], q = R[(i + 1) % 8];
    if (i % 2 === 0) { const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, l = Math.hypot(q[0] - p[0], q[1] - p[1]), gx = (q[0] - p[0]) / l * 4.5, gz = (q[1] - p[1]) / l * 4.5; railing(g, p[0], p[1], mx - gx, mz - gz); railing(g, mx + gx, mz + gz, q[0], q[1]); }
    else railing(g, p[0], p[1], q[0], q[1]);
  }
  B(g, MAT.stoneD, 21, 0.6, 6.4, cx, yW - 0.2, cz, true);                                    // fountain deck in the water
  for (let k = -4; k <= 4; k++) jet(F, cx + k * 2.3, cz, yW + 0.45, k === 0 ? 11 : 4.5 + (k % 2 ? 2 : 0), 1.3, 30);
  chhatri(g, MAT.pink, MAT.pink, 4.2, cx - 44, 0, cz - 8); chhatri(g, MAT.pink, MAT.pink, 4.2, cx + 6, 0, cz + 46);
  for (let i = 0; i < 46; i++) {              // people sit on the ghats
    const e = ri(0, 7), lvl = ri(1, 6), O = off(talabOct((lvl - 0.45) * T.tread)), a = O[e], b = O[(e + 1) % 8], t = rr(0.1, 0.9), x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
    seatAt(F, x, z, -lvl * T.rise + 0.42, Math.atan2(cx - x, cz - z));
  }
  [[-134, 30], [-134, -40], [-42, 68], [-46, -52], [22, 30], [20, -28]].forEach(q => lampAt(F, q[0], q[1], 2));
  [[-126, 46, 0], [-108, 60, 0], [-88, 62, 0], [-66, 60, 0], [-126, -20, Math.PI / 2], [-126, 10, Math.PI / 2], [-44, 20, -Math.PI / 2], [-44, -20, -Math.PI / 2], [-100, -54, 0], [-76, -54, 0], [12, 16, Math.PI], [-12, 16, Math.PI]].forEach(q => bench(g, F, q[0], q[1], q[2]));
  // Play area and bandstand.
  const toy = c => M(c, { roughness: 0.5 }), RD = toy(0xd7352c), YL = toy(0xf0b90b), BL = toy(0x2f6fc4), GR = toy(0x3d9a4c);
  { const pa = grp(g, 39, -47); B(pa, BL, 2, 0.1, 2, -8, 2.2, 0, true); for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(pa, YL, 0.07, 0.07, 2.2, -8 + sx * 0.9, 0, sz * 0.9, 6, false, true);
    const sl = B(pa, RD, 0.9, 0.08, 4.4, -8, 1.1, 2.9, true); sl.rotation.x = 0.52; cone(pa, GR, 1.6, 1.1, -8, 2.9, 0, 4).rotation.y = Math.PI / 4;
    for (const x of [-1.6, 1.6]) { const a = C(pa, BL, 0.06, 0.06, 2.9, x, 0, 0.7, 6, false, true); a.rotation.x = -0.28; const b = C(pa, BL, 0.06, 0.06, 2.9, x, 0, -0.7, 6, false, true); b.rotation.x = 0.28; }
    B(pa, YL, 3.4, 0.08, 0.08, 0, 2.72, 0, true); for (const x of [-0.7, 0.7]) { B(pa, RD, 0.45, 0.05, 0.25, x, 0.55, 0, true); B(pa, MAT.iron, 0.02, 2.2, 0.02, x - 0.2, 0.55, 0, true); B(pa, MAT.iron, 0.02, 2.2, 0.02, x + 0.2, 0.55, 0, true); }
    C(pa, GR, 1.7, 1.7, 0.2, 7, 0.3, 2, 14, false, true); for (let i = 0; i < 6; i++) C(pa, YL, 0.04, 0.04, 0.9, 7 + Math.cos(i) * 1.5, 0.5, 2 + Math.sin(i) * 1.5, 5, false, true);
    const ss = B(pa, RD, 3.2, 0.08, 0.3, 6, 0.7, -5, true); ss.rotation.z = 0.2; B(pa, BL, 0.2, 0.6, 0.4, 6, 0, -5, true); }
  { const bs = grp(g, 30, -25); C(bs, MAT.pink, 7, 7.3, 0.5, 0, 0, 0, 20, false, true); addPlat(bs, 0, 0, 6.2, 6.2, 0, 0.5); for (let i = 0; i < 10; i++) { const a = i * TAU / 10; C(bs, MAT.cream, 0.16, 0.2, 3.1, Math.cos(a) * 6, 0.5, Math.sin(a) * 6, 8, false, true); const b = B(bs, MAT.woodL, 6.2, 0.14, 0.2, Math.cos(a) * 3, 3.6, Math.sin(a) * 3, true); b.rotation.y = -a; }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.16, 6, 28), MAT.cream); ring.rotation.x = Math.PI / 2; ring.position.y = 3.65; bs.add(ring); }
  [[-128, 70], [-100, 76], [-62, 77], [-136, -52], [-132, 6], [24, 60], [-24, 62], [30, -62], [62, 6], [70, 44], [48, 70], [-18, -40]].forEach(q => treeAt(F, q[0], q[1], 0, rr(1, 1.4)));
  clockTower(g); gallery(g);
  bake(g);
  for (let k = 0; k < 4; k++) {               // the hands stay live
    const w = toWorld(F, Math.sin(k * Math.PI / 2) * 3.47, Math.cos(k * Math.PI / 2) * 3.47), hd = new THREE.Group(); hd.position.set(w[0], 52.15, w[1]); hd.rotation.y = F.rot + k * Math.PI / 2;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.9, 0.06).translate(0, 0.75, 0), MAT.black), m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.55, 0.06).translate(0, 1.05, 0.05), MAT.black);
    hd.add(h, m); scene.add(hd); CLOCK_HANDS.push({ h, m });
  }
  // life in the square
  zone(F, -134, 45, -57, 79, 55); zone(F, -138, -40, -127, 40, 12); zone(F, -44, -58, -33, 79, 24); zone(F, -120, -58, -52, -43, 14);
  zone(F, -22, 9, 22, 21, 9); zone(F, -22, -21, 22, -9, 5); zone(F, 9, -9, 21, 9, 3); zone(F, -21, -9, -9, 9, 3); zone(F, -5, 22, 5, 78, 12); zone(F, 26, -58, 60, -36, 10);
  const stalls = ['chaat', 'fruit', 'juice', 'icecream', 'corn', 'chaat', 'toys', 'fruit', 'tea', 'chaat', 'candy'];
  stalls.forEach((t, i) => vendor(F, -132 + i * 8.4, 75.5, 0, t));
  [[14, 30, 'balloon'], [-9, 26, 'candy'], [10, 40, 'icecream'], [-30, 40, 'corn'], [-38, 22, 'chaat'], [-36, -30, 'tea'], [-124, -50, 'chaat'], [-60, -50, 'icecream'], [32, -40, 'balloon'], [40, 60, 'chaat'], [-134, 60, 'toys']].forEach(q => vendor(F, q[0], q[1], rr(0, TAU), q[2]));
  RIDE_LOOPS.push([[30, 12], [72, 22], [86, 58], [44, 74], [18, 50]].flatMap(q => toWorld(F, q[0], q[1])));
  [[20, 74, 'baggi'], [29, 74, 'tonga'], [38, 74, 'baggi'], [-18, 74, 'erick'], [-24, 74, 'erick'], [-30, 74, 'auto'], [24, 36, 'horse'], [27.5, 38, 'horse']].forEach(q => parkAt(F, q[0], q[1], q[2] === 'horse' ? 0.6 : Math.PI / 2, q[2]));
  for (let i = 0; i < 9; i++) parkAt(F, -150, -44 + i * 6.2, 0, pick(['hatch', 'sedan', 'suv', 'hatch']));
  const gw = toWorld(F, -90, -80);
  LABELS.push({ id: 'gallery', en: 'Picture Gallery', hi: 'पिक्चर गैलरी', ur: 'تصویر گیلری', pos: [gw[0], 22, gw[1]], cam: [-54, 16, -49], tgt: [gw[0], 6, gw[1]], walk: [...toWorld(F, -90, -50), gw[0], gw[1]], yr: 'Baradari · c. 1838',
    text: 'A deep-red baradari built by Muhammad Ali Shah as a summer house on the north bank of the tank. It now holds life-size portraits of the Nawabs of Awadh.' });
}

/* ═════════════ Satkhanda ═════════════ */
function buildSatkhanda() {
  const F = { x: -203, z: -88, rot: 0.2 }, g = frameGroup(F);
  flatPoly(g, GM.paver, circlePoly(0, 0, 17, 16).reduce((a, v, i, arr) => (i % 2 ? a : a.concat([[v, arr[i + 1]]])), []), 0.012);
  C(g, MAT.pinkD, 11.6, 12, 0.6, 0, 0, 0, 8, true, true); addPlat(g, 0, 0, 10.4, 10.4, 0, 0.6);
  const R = [9.2, 8.3, 7.4, 6.5], H = [5.6, 5.2, 5.0, 4.8]; let y = 0.6;
  R.forEach((r, i) => {
    C(g, i ? MAT.red : MAT.redD, r, r, H[i], 0, y, 0, 8, true); C(g, MAT.redD, r + 0.8, r + 0.25, 0.3, 0, y + H[i], 0, 8, true, true);
    const ap = r * Math.cos(Math.PI / 8), fw = 2 * r * Math.sin(Math.PI / 8);
    for (let k = 0; k < 8; k++) { const f = grp(g, 0, 0, (k + 0.5) * Math.PI / 4); if (i === 0) decal(f, 2.7, 4.2, 0, y + 0.1, ap, { trim: MAT.trimW, mat: k % 2 ? MAT.door : MAT.recessLit }); else for (const dx of [-0.3, 0, 0.3]) decal(f, fw * 0.2, H[i] * 0.62, dx * fw, y + 0.85, ap, { trim: MAT.trimW, mat: MAT.recessLit, cusps: 3 }); }
    lights(F, Array.from({ length: 9 }, (_, k) => [Math.sin(k * Math.PI / 4) * (r + 0.6), y + H[i] + 0.35, Math.cos(k * Math.PI / 4) * (r + 0.6)]));
    y += H[i] + 0.3;
  });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; C(g, MAT.iron, 0.08, 0.08, 3, Math.sin(a) * 5.6, y, Math.cos(a) * 5.6, 5, false, true); const b = B(g, MAT.iron, 4.4, 0.1, 0.1, Math.sin(a + Math.PI / 8) * 5.2, y + 2.9, Math.cos(a + Math.PI / 8) * 5.2, true); b.rotation.y = a + Math.PI / 8; }
  C(g, MAT.iron, 5.9, 5.9, 0.08, 0, y + 3, 0, 8, true, true);
  // garden to the east, hedge and lamps
  flatRect(g, GM.lawnTop, 34, 40, 34, -6, 0.008); for (const [x, z, w, d] of [[34, -26.2, 34, 0.5], [34, 14.2, 34, 0.5], [16.8, -6, 0.5, 40], [51.2, -6, 0.5, 40]]) B(g, MAT.hedge, w, 0.7, d, x, 0, z, true);
  [[24, -18], [44, -18], [24, 6], [44, 6], [34, -6]].forEach(q => treeAt(F, q[0], q[1], q[0] === 34 ? 2 : 0, 1.1)); [[-14, 12], [14, 14], [0, -17]].forEach(q => lampAt(F, q[0], q[1], 3));
  { const m = grp(g, -24, 5, Math.PI / 2 - 0.2), gr = M(0x2f7d4f, { roughness: 0.6 }); B(m, MAT.white, 9, 5, 7, 0, 0, 0); arcade(m, 3, -4, 4, 0.2, 3.5, 3.4, { cusps: 3, trim: MAT.trimW, lit: 0.5 }); B(m, M(0x9c3b2e), 9.6, 0.3, 7.6, 0, 5, 0, true); dome(m, gr, 1.9, 0, 5.3, 0); for (const sx of [-4.2, 4.2]) { C(m, MAT.white, 0.3, 0.38, 8.5, sx, 0, 3.3, 8, true, true); dome(m, gr, 0.5, sx, 8.5, 3.3); } const w = toWorld(F, -24, 5); LABELS.push({ id: 'hamza', poi: true, en: 'Masjid Hamza', hi: 'मस्जिद हमज़ा', ur: 'مسجد حمزہ', pos: [w[0], 10, w[1]] }); }
  bake(g);
  zone(F, -15, 11, 15, 22, 10); zone(F, 12, -14, 16, 12, 4);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) if (chance(0.8)) PARKED.push([-196 + c * 3.1 - r * 4.6, -44 + r * 6.2 - c * 1.5, 0.46 + (r % 2 ? Math.PI : 0), pick(['hatch', 'sedan', 'suv', 'hatch', 'hatch'])]);
  LABELS.push({ id: 'satkhanda', en: 'Satkhanda', hi: 'सतखंडा', ur: 'ست کھنڈا', pos: [-203, 29, -88], cam: [-158, 22, -44], tgt: [-203, 11, -88], walk: [-184, -66, -203, -88], yr: 'Unfinished watch-tower · 1837–42',
    text: '“Sat-khanda” means seven storeys, but only four were raised before Muhammad Ali Shah died in 1842 and the work stopped for good. Tradition says it was meant for sighting the Eid moon. The red tower has been refurbished and is lit from inside after dark.' });
}

/* ═════════════ Husainabad gateways ═════════════ */
function buildHGate(F, id) {
  const g = frameGroup(F), m = MAT.whiteW;
  gateSlab(g, m, 11.9, 15.6, 5, [{ x: 0, w: 7.5, h: 11, cusps: 5 }], { outline: true });
  for (const s of [-1, 1]) {
    const b = grp(g, s * 9.05, 0); gateSlab(b, m, 6.2, 12, 5, [{ x: -s * 0.7, w: 4.3, h: 8, cusps: 4 }], { outline: true });
    for (const z of [-2.5, 2.5]) crownFinials(b, 6.2, 12, m, z);
    for (const z of [-2.75, 2.75]) { C(g, m, 0.42, 0.52, 16.6, s * 5.95, 0, z, 8, true, true); dome(g, m, 0.66, s * 5.95, 16.6, z); C(g, m, 0.4, 0.5, 13.2, s * 12.15, 0, z, 8, true, true); dome(g, m, 0.62, s * 12.15, 13.2, z); }
    const wl = 9, wx = s * (12.15 + wl / 2);                                                       // two-storey arcaded wing
    B(g, m, wl, 8.6, 5.5, wx, 0, 0); arcadeBox(g, wx, 0, wl, 5.5, 0.3, 3.7, 2, 0, { cusps: 3 }); arcadeBox(g, wx, 0, wl, 5.5, 4.9, 2.9, 3, 0, { cusps: 3, lit: 0.3 });
    B(g, MAT.whiteD, wl + 0.5, 0.35, 6, wx, 4.4, 0, true); merlons(g, m, wx - wl / 2, wx + wl / 2, 8.6, 2.5, 6, 0.7, 0.6, 0.4); merlons(g, m, wx - wl / 2, wx + wl / 2, 8.6, -2.5, 6, 0.7, 0.6, 0.4);
    for (let i = 0; i < 4; i++) tuft(g, wx + rr(-4, 4), 8.6, rr(-2, 2), rr(0.7, 1.2));
  }
  for (const z of [-2.5, 2.5]) crownFinials(g, 11.9, 15.6, m, z);
  chhatri(g, m, m, 2.7, 0, 15.3, 0, 8); tuft(g, 3.5, 13.6, 0.6); tuft(g, -4.2, 12.9, -0.4, 0.8);
  bake(g);
  festiveOutline(F, 11.9, 15.6, 2.7); festiveOutline(F, 6.2, 12, 2.7, 9.05); festiveOutline(F, 6.2, 12, 2.7, -9.05);
  LABELS.push({ id, small: true, en: 'Husainabad Gate', hi: 'हुसैनाबाद दरवाज़ा', ur: 'حسین آباد دروازہ', pos: [F.x, 22, F.z] });
}

/* ═════════════ Chota Imambara ═════════════ */
function tajReplica(g, F, x, z) {
  const t = grp(g, x, z), w = MAT.white;
  P(t, w, 17, 1.1, 17); B(t, w, 11.5, 8, 11.5, 0, 1.1, 0);
  for (let k = 0; k < 4; k++) { const f = grp(t, 0, 0, k * Math.PI / 2); decal(f, 4.2, 6.3, 0, 1.25, 5.75, { trim: MAT.trimW, cusps: 4, mat: MAT.recessLit }); for (const sx of [-4.1, 4.1]) { decal(f, 1.5, 2.5, sx, 1.4, 5.75, { trim: MAT.trimW }); decal(f, 1.5, 2.4, sx, 5.2, 5.75, { trim: MAT.trimW }); } }
  B(t, MAT.whiteD, 12.3, 0.45, 12.3, 0, 9.1, 0, true); C(t, w, 3.9, 4.1, 1.8, 0, 9.55, 0, 16, false, true); dome(t, w, 4.3, 0, 11.35, 0, 1.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { chhatri(t, w, w, 2.2, sx * 4.5, 9.55, sz * 4.5); minaret(t, w, w, 10.5, 0.7, sx * 7.7, 1.1, sz * 7.7, 2); }
  boxLights(F, x, z, 12.3, 12.3, 9.7);
}
function buildChota() {
  setLoad('Gilding the Chota Imambara…');
  const F = FRAME.chota, g = frameGroup(F), Wd = 64.5, D = 150, w = MAT.white;
  flatRect(g, GM.paver, Wd * 2, D, 0, D / 2, 0.012);
  wallRun(g, MAT.aged, -Wd, 0, -11, 0, 5.6); wallRun(g, MAT.aged, 11, 0, Wd, 0, 5.6);
  wallRun(g, MAT.whiteD, -Wd, 0, -Wd, D, 5); wallRun(g, MAT.whiteD, Wd, 0, Wd, D, 5); wallRun(g, MAT.whiteD, -Wd, D, Wd, D, 5);
  for (const [x, z] of [[-Wd, 0], [Wd, 0], [-Wd, D], [Wd, D]]) { C(g, MAT.aged, 3.4, 3.6, 5.6, x, 0, z, 8, true); C(g, MAT.aged, 3.9, 3.9, 0.4, x, 5.6, z, 8, true, true); chhatri(g, MAT.cream, MAT.cream, 5.2, x, 6, z, 8); }
  const rowCells = SHOPS.flatMap((shop, i) => shop[4] === 2 ? [i] : []);
  const { centre, edge, first, step, count } = CHOTA_SHOP_ROW;
  const namedBays = [5, 7, 8, 9];   // Zaika, Khichda & Burger, SK Chikan Art, Gulf Shawarma; featured bays are in SHOP_CATALOG
  const featuredBays = new Set(Object.values(SHOP_CATALOG).filter(shop => shop.kind === 'bay').map(shop => shop.bay));
  for (const side of [-1, 1]) {
    const row = grp(g, side * centre, edge, Math.PI);
    for (let i = 0; i < count; i++) {
      if (side > 0 && featuredBays.has(i)) continue;
      const x = first + i * step;
      const namedIndex = side > 0 ? namedBays.indexOf(i) : -1;
      B(row, MAT.whiteD, step, 3.3, 3.2, x, 0, -1.6);
      const serving = side > 0 && (i === 5 || i === 8);
      rectDecal(row, serving || chance(0.3) ? MAT.recess : MAT.shutter, 3.3, 2.25, x, 0.07, 0);
      signBoard(row, 3.7, x, 2.40, 0.02, namedIndex >= 0 ? rowCells[namedIndex] : genericCell());
      if (serving) {
        B(row, MAT.woodL, 2.7, 0.10, 0.43, x, 0.87, 0.22, true);
        for (let j = 0; j < 3; j++) {
          if (i === 5) C(row, MAT.copper, 0.14, 0.13, 0.18, x + (j - 1) * 0.52, 0.97, 0.22, 8, false, true);
          else B(row, [MAT.teal, MAT.fabricG, MAT.cream][j], 0.5, 0.12, 0.34, x + (j - 1) * 0.68, 0.97, 0.24, true);
        }
      }
      if (serving || chance(0.4)) {
        const awning = B(row, pick([MAT.cloth, MAT.fabricG, MAT.teal, MAT.gold]), 3.55, 0.06, 1.25, x, 2.27, 0.65, true);
        awning.rotation.x = 0.24;
      }
    }
    for (let i = 0; i < 16; i++) {
      const x = side * (13 + i * 3.1);
      if (!nearShopEntrance(...toWorld(F, x, -5.4), 0.12)) C(g, MAT.wood, 0.11, 0.13, 0.75, x, 0, -5.4, 6, false, true);
    }
  }
  // main gateway, white with gilded pinnacles
  gateSlab(g, w, 22, 12.5, 6, [{ x: 0, w: 6.4, h: 9, cusps: 5 }, { x: -7.4, w: 3.2, h: 5.8, cusps: 4 }, { x: 7.4, w: 3.2, h: 5.8, cusps: 4 }]);
  B(g, MAT.whiteD, 23, 0.6, 6.8, 0, 12.5, 0, true); B(g, w, 12, 3, 5, 0, 13.1, 0, true); arcadeBox(g, 0, 0, 12, 5, 13.4, 2.1, 5, 0, { cusps: 3, trim: MAT.trimW, lit: 0.6 }); B(g, MAT.whiteD, 12.8, 0.4, 5.6, 0, 16.1, 0, true);
  for (const x of [-10.4, -4.4, 4.4, 10.4]) for (const z of [-2.7, 2.7]) { C(g, w, 0.34, 0.46, x * x > 50 ? 4.2 : 5.4, x, 12.5, z, 8, true, true); dome(g, MAT.gold, 0.72, x, 12.5 + (x * x > 50 ? 4.2 : 5.4), z); }
  chhatri(g, w, MAT.gold, 3.3, 0, 16.5, 0, 8); S(g, MAT.gold, 0.45, 0, 21.9, 0, 0.55).scale.z = 0.3; cone(g, MAT.gold, 0.3, 0.6, 0.55, 21.6, 0, 4).rotation.z = Math.PI / 2;
  guldastas(g, w, -10.5, 10.5, 13.1, 3.1, 8, 0.85, MAT.gold); guldastas(g, w, -10.5, 10.5, 13.1, -3.1, 8, 0.85, MAT.gold);
  // Husainabad mosque (north-west corner) and the Shahi Hammam facing it
  { const m = grp(g, -46, 24, Math.PI / 2); P(m, MAT.stone, 28, 1, 16); B(m, w, 23, 7.4, 10, 0, 1, -1.5); arcade(m, 5, -11, 11, 1.2, 3.5, 5.5, { cusps: 4, trim: MAT.trimW, lit: 0.5 }); B(m, MAT.whiteD, 24, 0.5, 11, 0, 8.4, -1.5, true);
    C(m, w, 2.9, 3, 0.9, 0, 8.9, -1.5, 14, false, true); dome(m, w, 3.1, 0, 9.8, -1.5); for (const x of [-7.6, 7.6]) { C(m, w, 2.1, 2.2, 0.7, x, 8.9, -1.5, 14, false, true); dome(m, w, 2.3, x, 9.6, -1.5); }
    for (const x of [-12, 12]) minaret(m, w, w, 16.5, 0.9, x, 1, 3.3, 3); guldastas(m, w, -10.8, 10.8, 8.9, 3.4, 9, 0.8, MAT.gold); }
  { const h = grp(g, 44, 28, -Math.PI / 2); B(h, w, 23, 6, 11, 0, 0, 0); arcade(h, 5, -11, 11, 0.3, 5.5, 4.6, { cusps: 3, trim: MAT.trimW }); B(h, MAT.whiteD, 24, 0.45, 12, 0, 6, 0, true); for (const x of [-7.5, -2.5, 2.5, 7.5]) dome(h, w, 1.7, x, 6.45, 0, 0.8); guldastas(h, w, -11, 11, 6.45, 5.3, 8, 0.7); }
  // garden: long water channel, bridge, lawns
  for (const x of [-4.75, 4.75]) B(g, MAT.stone, 0.5, 0.55, 69, x, 0, 66); for (const z of [31.75, 100.25]) B(g, MAT.stone, 10, 0.55, 0.5, 0, 0, z);
  flatRect(g, waterMat, 9, 68, 0, 66, 0.3);
  P(g, w, 12.4, 0.95, 3.2, 0, 0, 66); for (const s of [-1, 1]) { P(g, w, 1.1, 0.5, 3.2, s * 6.75, 0, 66); for (const z of [64.5, 67.5]) B(g, w, 12.4, 0.5, 0.16, 0, 0.95, z, true); }
  for (const z of [38, 50, 82, 94]) jet(F, 0, z, 0.35, 4.2, 1.5, 34); jet(F, 0, 59.5, 0.35, 2.6, 1, 20); jet(F, 0, 72.5, 0.35, 2.6, 1, 20);
  for (const s of [-1, 1]) for (const z of [43, 66, 89]) { const x = s * 18.5; flatRect(g, GM.lawnTop, 19, 19, x, z, 0.02); for (const [dx, dz, ww, dd] of [[0, -9.7, 19.6, 0.5], [0, 9.7, 19.6, 0.5], [-9.7, 0, 0.5, 19.6], [9.7, 0, 0.5, 19.6]]) B(g, MAT.hedge, ww, 0.6, dd, x + dx, 0, z + dz, true); treeAt(F, x - 6, z - 6, 3, 0.9); treeAt(F, x + 6, z + 6, 3, 0.9); treeAt(F, x + 6, z - 6, 3, 0.7); }
  for (const z of [36, 54, 78, 96]) for (const x of [-6.6, 6.6]) lampAt(F, x, z, 3);
  tajReplica(g, F, -42, 62); tajReplica(g, F, 42, 62);
  // the Imambara itself (front looks back toward the gate)
  const h = grp(g, 0, 129, Math.PI), HF = { x: F.x + Math.sin(F.rot) * 129, z: F.z + Math.cos(F.rot) * 129, rot: F.rot + Math.PI };
  P(h, MAT.stone, 62, 1.5, 32, 0, 0, 1); stairs(h, MAT.stone, 22, 5, 0.3, 0.45, 0, 0, 19.25);
  B(h, w, 46, 10.2, 20, 0, 1.5, 0); B(h, MAT.cloth, 3, 0.05, 8.6, 0, 1.5, 14.4, true);
  for (const [x, ww, hh] of [[0, 5.6, 7.2], [-9.2, 4.6, 6.4], [9.2, 4.6, 6.4], [-18.4, 4.6, 6.4], [18.4, 4.6, 6.4]]) { decal(h, ww, hh, x, 1.7, 10, { cusps: 5, trim: MAT.trimW, mat: MAT.recessLit }); rectDecal(h, MAT.calli, 5.4, 1.35, x, 9.4, 10.02); }
  for (const x of [-22.9, -13.8, -4.6, 4.6, 13.8, 22.9]) { B(h, MAT.whiteD, 0.55, 10.2, 0.4, x, 1.5, 10.15, true); if (Math.abs(x) > 5) rectDecal(h, MAT.black, 1.3, 4.6, x > 0 ? x - 2.3 : x + 2.3, 3.2, 10.01); }
  arcade(grp(h, 23, 0, Math.PI / 2), 4, -9, 9, 1.8, 0, 6.2, { cusps: 4, trim: MAT.trimW, mat: MAT.stain }); arcade(grp(h, -23, 0, -Math.PI / 2), 4, -9, 9, 1.8, 0, 6.2, { cusps: 4, trim: MAT.trimW, mat: MAT.stainR });
  B(h, MAT.whiteD, 48.6, 0.25, 22.8, 0, 11.7, 0, true); B(h, w, 46.4, 1.5, 20.4, 0, 11.95, 0, true); arcadeBox(h, 0, 0, 46.4, 20.4, 12.1, 1.1, 23, 10, { fill: 0.55 });
  guldastas(h, w, -22.6, 22.6, 13.45, 10, 17, 1.05, MAT.gold); guldastas(h, w, -22.6, 22.6, 13.45, -10, 17, 1.05, MAT.gold);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) minaret(h, w, w, 7.4, 0.55, sx * 23.3, 11.95, sz * 10.3, 2);
  C(h, w, 6.3, 6.6, 3.0, 0, 13.45, 0, 16, false, true); arcadeBox(h, 0, 0, 9, 9, 13.9, 1.8, 0, 0); C(h, MAT.gold, 6.75, 6.75, 0.3, 0, 16.45, 0, 16, false, true);
  const top = dome(h, MAT.gold, 6.4, 0, 16.75, 0, 1.0);
  { const cr = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 14, Math.PI * 1.45), MAT.gold); cr.position.set(0, top + 0.5, 0); cr.rotation.z = Math.PI * 0.78; h.add(cr); }
  for (const x of [-12.5, 12.5]) { C(h, w, 1.5, 1.6, 1, x, 13.45, 0, 10, false, true); dome(h, MAT.gold, 1.6, x, 14.45, 0); }
  for (const s of [-1, 1]) { B(h, w, 8, 7.4, 16, s * 27, 1.5, 0); for (const x of [-2, 2]) decal(h, 2.1, 4.4, s * 27 + x, 2.2, 8, { cusps: 4, trim: MAT.trimW, mat: x * s > 0 ? MAT.stain : MAT.stainR }); B(h, MAT.whiteD, 8.6, 0.4, 16.6, s * 27, 8.9, 0, true); guldastas(h, w, s * 23.6, s * 30.4, 9.3, 8, 4, 0.8, MAT.gold); }
  [[38, 18, 1.3], [54, 44, 1.2], [-54, 96, 1.2], [54, 100, 1.3], [-56, 140, 1.1], [56, 142, 1.2], [40, 124, 1.1], [-40, 122, 1.0], [-58, 60, 1.2]].forEach(q => treeAt(F, q[0], q[1], 1, q[2]));
  bake(g);
  boxLights(HF, 0, 0, 46.4, 20.4, 13.6); boxLights(HF, 0, 0, 48.6, 22.8, 11.95); for (let k = 0; k < 8; k++) { const a = k * TAU / 8; lights(HF, Array.from({ length: 9 }, (_, i) => { const t = i / 8 * 1.45, r = 6.5 * Math.cos(t - 0.3) / Math.cos(-0.3); return [Math.sin(a) * Math.max(0.2, r), 16.8 + i * 1.25, Math.cos(a) * Math.max(0.2, r)]; }), 0.9); }
  for (const x of [-18.4, -9.2, 0, 9.2, 18.4]) festiveOutline(HF, x ? 4.6 : 5.6, x ? 6.4 : 7.2, 10.3, x, 1.7);
  boxLights(F, 0, 0, 23, 6.8, 12.9); festiveOutline(F, 6.4, 9, -3.2);
  zone(F, -30, 4, 30, 27, 16); zone(F, 6, 30, 9.6, 101, 9); zone(F, -9.6, 30, -6, 101, 9); zone(F, -28, 102, 28, 109, 12); zone(F, -20, 113, 20, 118.5, 8, 1.5); zone(F, -60, -22, 60, -6, 26);
  [[-50, -9, 'tea'], [-30, -8.5, 'chaat'], [22, -9, 'fruit'], [44, -8.5, 'juice'], [56, -10, 'chaat'], [-16, -20, 'candy'], [14, -24, 'balloon']].forEach(q => vendor(F, q[0], q[1], Math.PI, q[2]));
  [[-34, -30, 'auto'], [-28, -31, 'erick'], [-22, -30, 'erick'], [30, -32, 'tonga'], [38, -32, 'baggi']].forEach(q => parkAt(F, q[0], q[1], -Math.PI / 2 + rr(-0.15, 0.15), q[2]));
  for (let i = 0; i < 14; i++) parkAt(F, -58 + i * 2.1 + (i > 6 ? 70 : 0), -8.2, Math.PI + rr(-0.2, 0.2), pick(['scooter', 'bike', 'scooter', 'cycle']));
  const hw = toWorld(F, 0, 129);
  LABELS.push({ id: 'chota', en: 'Chota Imambara', hi: 'छोटा इमामबाड़ा', ur: 'چھوٹا امام باڑہ', pos: [hw[0], 40, hw[1]], cam: [-324, 15, -10], tgt: [-380, 9, 72], walk: [...toWorld(F, 0, 14), hw[0], hw[1]], yr: 'Imambara Husainabad Mubarak · 1838',
    text: 'Built by Muhammad Ali Shah, third King of Awadh, as a congregation hall and his own mausoleum. Black calligraphy panels band the white facade under a gilded dome; chandeliers inside earned it the name “Palace of Lights”. Across the water channel two small Taj-inspired tombs face each other, with the Husainabad mosque and the royal hammam by the gate.' });
  LABELS.push({ id: 'chowk', small: true, en: 'Husainabad Chowk', hi: 'हुसैनाबाद चौक', ur: 'حسین آباد چوک', pos: [...toWorld(F, 0, -26).slice(0, 1), 5, toWorld(F, 0, -26)[1]] });
  for (const index of [0, 3]) {
    const cell = rowCells[index];
    const [x, z] = toWorld(F, centre - first - namedBays[index] * step, edge - 0.95);
    LABELS.push({ id: 'poi' + cell, poi: true, en: SHOPS[cell][0], hi: SHOPS[cell][1], pos: [x, 4.4, z] });
  }
  // Naubat Khana across the open ground, facing the gate
  const n = frameGroup({ x: toWorld(F, 0, -66)[0], z: toWorld(F, 0, -66)[1], rot: F.rot });
  B(n, MAT.stone, 31, 0.7, 14); B(n, MAT.whiteW, 28, 5.4, 12, 0, 0.7, 0); arcadeBox(n, 0, 0, 28, 12, 0.9, 4, 5, 2, { cusps: 3, lit: 0.4 }); B(n, MAT.whiteD, 29, 0.45, 13, 0, 6.1, 0, true);
  B(n, MAT.whiteW, 19, 4.6, 9.5, 0, 6.55, 0, true); arcadeBox(n, 0, 0, 19, 9.5, 6.9, 3.4, 3, 1, { cusps: 3, lit: 0.5 }); B(n, MAT.whiteD, 20, 0.45, 10.5, 0, 11.15, 0, true);
  for (const s of [-1, 1]) { chhatri(n, MAT.whiteW, MAT.whiteW, 2.6, s * 11.5, 6.55, 3.5); chhatri(n, MAT.whiteW, MAT.whiteW, 2.2, s * 7.5, 11.6, 0); } tuft(n, 4, 11.6, 2); tuft(n, -12, 6.6, -3, 0.8);
  bake(n);
  LABELS.push({ id: 'naubatC', small: true, en: 'Naubat Khana', hi: 'नौबत ख़ाना', ur: 'نوبت خانہ', pos: [n.position.x, 16, n.position.z] });
}

/* ═════════════ Rumi Darwaza ═════════════ */
function buildRumi() {
  setLoad('Restoring Rumi Darwaza…');
  const F = FRAME.rumi, g = frameGroup(F), m = MAT.surkhi, L = MAT.surkhiL, T = { trim: L, lit: 0.25 };
  // east half: a three-storey front toward the Bara Imambara
  gateSlab(g, m, 21, 13, 5, [{ x: 0, w: 5.4, h: 8.2, cusps: 4 }, { x: -6.6, w: 3.2, h: 5.8, cusps: 4 }, { x: 6.6, w: 3.2, h: 5.8, cusps: 4 }], { z: -2.5 });
  B(g, L, 21.6, 0.4, 5.6, 0, 13, -2.5, true); B(g, m, 17, 4.6, 4.2, 0, 13.4, -2.9, true); B(g, L, 17.6, 0.35, 4.8, 0, 18, -2.9, true);
  const fe = grp(g, 0, -5, Math.PI); arcade(fe, 9, -9.8, 9.8, 9.3, 0, 2.9, T); arcade(fe, 7, -8, 8, 13.8, 0, 3.3, T); merlons(g, m, -8.3, 8.3, 18.35, -4.8, 13, 0.7, 0.6, 0.35);
  for (const s of [-1, 1]) { C(g, m, 0.6, 0.72, 6.2, s * 10.1, 13.4, -4.6, 8, true, true); dome(g, m, 0.95, s * 10.1, 19.6, -4.6); C(g, m, 0.5, 0.6, 3, s * 8.3, 18.35, -1, 8, true, true); dome(g, m, 0.8, s * 8.3, 21.35, -1); }
  // west half: the great arch with its half-dome and radiating leaves
  gateSlab(g, m, 21, 20.5, 2.2, [{ x: 0, w: 14.4, h: 16.2, cusps: 6 }], { outline: true, z: 3.9 });
  gateSlab(g, L, 16.6, 17.6, 0.5, [{ x: 0, w: 12.6, h: 15, cusps: 6 }], { outline: true, z: 2.6, free: true });
  // A shallow rim catches light at walking distance. The opening stays the
  // same size and the original masonry collider still governs the passage.
  gateSlab(g, L, 15.1, 16.4, 0.11, [{ x: 0, w: 14.4, h: 16.2, cusps: 6 }], { outline: true, z: 5.03, free: true });
  for (const s of [-1, 1]) B(g, m, 1.3, 13, 2.9, s * 9.85, 0, 1.4);
  { const sh = new THREE.Mesh(new THREE.SphereGeometry(7.3, 20, 10, Math.PI, Math.PI, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xead2b2, map: TEX.plaster, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffb774, emissiveMap: TEX.plaster })); sh.scale.set(1, 1, 0.4); sh.position.set(0, 9.3, 2.85); sh.receiveShadow = true; g.add(sh); FLOOD.push(sh.material); }
  arcade(g, 7, -6.6, 6.6, 9.2, 0, 2.5, { trim: L, lit: 0.5 });
  crownFinials(g, 21, 20.5, m, 4.4, L); crownFinials(g, 21, 20.5, m, 3.4, L);
  C(g, m, 1.75, 1.95, 1.5, 0, 19.9, 1.6, 8, true, true); chhatri(g, m, m, 3.5, 0, 21.4, 1.6, 8);
  for (const s of [-1, 1]) { C(g, m, 0.62, 0.8, 19.6, s * 11.2, 0, 4, 8, true); for (const yy of [7, 13, 19.2]) C(g, L, 0.95, 0.75, 0.3, s * 11.2, yy, 4, 8, true, true); dome(g, m, 0.95, s * 11.2, 19.6, 4); }
  // two-storey arcaded wings ending in octagonal bastions
  for (const s of [-1, 1]) {
    const cx = s * 20.75; B(g, m, 20.5, 6.6, 7, cx, 0, 0); arcadeBox(g, cx, 0, 20.5, 7, 0.3, 4.7, 5, 0, T); B(g, L, 21, 0.35, 7.6, cx, 6.6, 0, true);
    B(g, m, 20.5, 3.8, 6, cx, 6.95, 0, true); arcadeBox(g, cx, 0, 20.5, 6, 7.3, 2.6, 12, 0, { trim: L, fill: 0.6, lit: 0.3 }); B(g, L, 21, 0.3, 6.5, cx, 10.75, 0, true);
    merlons(g, m, cx - 10, cx + 10, 11.05, 2.8, 16, 0.6, 0.55, 0.35); merlons(g, m, cx - 10, cx + 10, 11.05, -2.8, 16, 0.6, 0.55, 0.35);
    const bx = s * 34.4; C(g, m, 4.2, 4.4, 12.6, bx, 0, 0, 8, true); C(g, L, 4.7, 4.7, 0.45, bx, 12.6, 0, 8, true, true); C(g, m, 4.5, 4.5, 0.9, bx, 13.05, 0, 8, true, true);
    for (let k = 0; k < 8; k++) { const f = grp(g, bx, 0, (k + 0.5) * Math.PI / 4); for (const yy of [0.5, 4.6, 8.7]) decal(f, 1.9, 2.9, 0, yy, 4.2 * Math.cos(Math.PI / 8), T); }
  }
  bake(g);
  festiveOutline(F, 21, 20.5, 5.1); festiveOutline(F, 14.4, 16.2, 5.1); lights(F, [[-31, 11.2, 3.6], [-10.6, 11.2, 3.6]]); lights(F, [[10.6, 11.2, 3.6], [31, 11.2, 3.6]]); lights(F, [[-31, 11.2, -3.6], [31, 11.2, -3.6]]);
  // bollards keeping traffic out, parked cars to the west, rows of motorbikes to the east
  const bol = new THREE.Group(), bp = MAP.barriers.find(b => b.k === 'bollard'), bl = polyline(bp ? bp.p : [414, 263, 391, 335]);
  for (let s = 0; s < bl.len; s += 1.7) { const a = polyAt(bl, s); C(bol, MAT.iron, 0.16, 0.19, 0.95, a[0], 0, a[1], 8, false, true); S(bol, MAT.gold, 0.2, a[0], 1, a[1]); }
  for (let i = 0; i < 12; i++) { const w = toWorld(F, -6 + i * 1.1, -9.5); C(bol, MAT.iron, 0.15, 0.18, 0.9, w[0], 0, w[1], 8, false, true); }
  bake(bol);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if (chance(0.85)) parkAt(F, -22 + c * 3 + r * 0, 34 + r * 6.5, Math.PI + rr(-0.06, 0.06), pick(['hatch', 'sedan', 'suv', 'hatch']));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 22; c++) if (chance(0.9)) parkAt(F, -24 + c * 1.15, -17 - r * 2.6, rr(-0.2, 0.2), pick(['bike', 'scooter', 'bike']));
  [[16, -20, 'baggi'], [24, -21, 'tonga'], [32, -20, 'baggi'], [-30, 26, 'erick'], [-34, 30, 'auto']].forEach(q => parkAt(F, q[0], q[1], Math.PI / 2 + rr(-0.2, 0.2), q[2]));
  zone(F, -30, 8, 30, 30, 26); zone(F, -30, -28, 30, -7, 22); zone(F, -2.2, -4, 2.2, 4, 4);
  [[-14, 12, 'candy'], [12, 14, 'balloon'], [-22, 22, 'chaat'], [20, 24, 'corn'], [-16, -12, 'fruit'], [8, -12, 'icecream'], [26, -12, 'tea'], [0, 26, 'toys']].forEach(q => vendor(F, q[0], q[1], rr(0, TAU), q[2]));
  [[-36, 14], [36, 16], [-38, -12], [38, -12], [-26, 44], [0, 50], [26, 46]].forEach(q => treeAt(F, q[0], q[1], 2, 1.05));
}

/* ═════════════ Bara Imambara and the Asfi Mosque ═════════════ */
function buildAsfi() {
  const F = FRAME.asfi, m = frameGroup(F), c = MAT.cream;
  P(m, MAT.creamD, 88, 3, 54, 0, 0, 16); stairs(m, MAT.stoneD, 44, 10, 0.3, 0.55, 0, 0, 48.5);
  flatRect(m, GM.herring, 86, 34, 0, 26, 3.02);
  B(m, c, 62, 12.5, 16, 0, 3, -1); arcade(m, 11, -30, 30, 3.3, 7, 8.6, { cusps: 5, trim: MAT.surkhiL, lit: 0.3 });
  B(m, c, 13, 16.2, 1.2, 0, 3, 7.4, true); decal(m, 7.6, 11.8, 0, 3.3, 8, { cusps: 6, trim: MAT.surkhiL }); guldastas(m, c, -6, 6, 19.2, 7.4, 5, 1);
  B(m, MAT.creamD, 63.5, 0.6, 17.5, 0, 15.5, -1, true); guldastas(m, c, -30.5, -8, 16.1, 6.6, 9, 1.1); guldastas(m, c, 8, 30.5, 16.1, 6.6, 9, 1.1); merlons(m, c, -31, 31, 16.1, -8.6, 30, 0.8, 0.7, 0.4);
  C(m, c, 6.8, 7, 2.2, 0, 16.1, -1, 20, false, true); dome(m, MAT.creamD, 7.2, 0, 18.3, -1, 1.0);
  for (const s of [-1, 1]) { C(m, c, 5.6, 5.8, 1.9, s * 19.5, 16.1, -1, 20, false, true); dome(m, MAT.creamD, 6, s * 19.5, 18, -1, 1.0); minaret(m, c, MAT.aged, 40, 2.2, s * 33, 3, 6.4, 4); C(m, c, 1, 1.2, 15, s * 31.4, 3, -8.4, 8, true, true); dome(m, MAT.aged, 1.5, s * 31.4, 18, -8.4); }
  for (const [x, z, ww, dd] of [[0, 23.2, 6.4, 0.4], [0, 29.2, 6.4, 0.4], [-3.2, 26.2, 0.4, 6.4], [3.2, 26.2, 0.4, 6.4]]) B(m, MAT.stone, ww, 0.55, dd, x, 3, z); flatRect(m, waterMat, 6, 5.6, 0, 26.2, 3.3);
  bake(m);
  boxLights(F, 0, -1, 63.5, 17.5, 16.3); festiveOutline(F, 7.6, 11.8, 8.3, 0, 3.3); lights(F, [[-33, 3.5, 6.4], [-33, 43, 6.4]], 1); lights(F, [[33, 3.5, 6.4], [33, 43, 6.4]], 1);
  zone(F, -38, 9.5, 38, 41, 16, 3);
  LABELS.push({ id: 'asfi', small: true, en: 'Asfi Mosque', hi: 'आसफ़ी मस्जिद', ur: 'آصفی مسجد', pos: [F.x, 50, F.z], cam: [504, 24, 522], tgt: [F.x, 15, F.z] });
}
function buildBara() {
  setLoad('Vaulting the Bara Imambara…');
  const F = FRAME.bara, g = frameGroup(F), c = MAT.cream, A = MAT.aged, T = { cusps: 3, trim: MAT.creamD, lit: 0.2 };
  flatRect(g, GM.paver, 122, 92, 0, 51, 0.012); flatRect(g, GM.lawnTop, 118, 86, 0, 51, 0.016); flatRect(g, GM.pathTop, 7, 90, 0, 51, 0.03);
  { const r = new THREE.Mesh(new THREE.RingGeometry(27, 31.5, 48), GM.pathTop); r.rotation.x = -Math.PI / 2; r.position.set(1.4, 0.03, 44.8); r.receiveShadow = true; g.add(r); }
  C(g, MAT.stone, 4.2, 4.6, 0.6, 1.4, 0, 44.8, 16); jet(F, 1.4, 44.8, 0.6, 3.6, 1.6, 30);
  // street range with its row of little domes, and the first gateway
  for (const s of [-1, 1]) {
    const cx = s * 36.5; B(g, c, 46, 7.2, 6, cx, 0, 3); arcadeBox(g, cx, 3, 46, 6, 0.4, 4.8, 9, 0, T); B(g, MAT.creamD, 46.6, 0.4, 6.6, cx, 7.2, 3, true);
    for (let i = 0; i < 8; i++) { const x = cx - 19.6 + i * 5.6; C(g, c, 1.25, 1.35, 0.7, x, 7.6, 3, 10, false, true); dome(g, c, 1.4, x, 8.3, 3, 0.9); }
    merlons(g, c, cx - 23, cx + 23, 7.6, 0.3, 30, 0.7, 0.6, 0.35); C(g, c, 1.6, 1.8, 16, s * 13.6, 0, 3, 8, true); dome(g, c, 2, s * 13.6, 16, 3);
    wallRun(g, A, s * 59.5, 1, s < 0 ? -126 : 173, 1, 4.6);
  }
  gateSlab(g, c, 27, 14, 8, [{ x: 0, w: 6.4, h: 9.6, cusps: 5 }, { x: -8.6, w: 4.2, h: 7, cusps: 4 }, { x: 8.6, w: 4.2, h: 7, cusps: 4 }], { z: 3 });
  B(g, MAT.creamD, 28, 0.6, 8.8, 0, 14, 3, true); for (const x of [-9, 0, 9]) chhatri(g, c, c, 3.3, x, 14.6, 3); guldastas(g, c, -13, 13, 14.6, -0.6, 12, 1); guldastas(g, c, -13, 13, 14.6, 6.6, 12, 1);
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.3; treeAt(F, 1.4 + Math.cos(a) * 36, 44.8 + Math.sin(a) * 36, 2, 1.05); } for (let i = 0; i < 14; i++) { const a = i * TAU / 14; treeAt(F, 1.4 + Math.cos(a) * 22, 44.8 + Math.sin(a) * 22, 3, 1); }
  // second gateway range
  for (const s of [-1, 1]) { const cx = s * 32; B(g, A, 36, 10, 10, cx, 0, 101); arcadeBox(g, cx, 101, 36, 10, 0.4, 4.3, 8, 0, T); arcadeBox(g, cx, 101, 36, 10, 5.6, 3.5, 8, 0, T); B(g, MAT.creamD, 36.6, 0.4, 10.6, cx, 10, 101, true); for (let i = 0; i < 4; i++) chhatri(g, A, A, 2.8, cx - 12 + i * 8, 10.4, 101); }
  gateSlab(g, c, 28, 15.5, 11, [{ x: 0, w: 6.6, h: 10.2, cusps: 5 }, { x: -9, w: 4.4, h: 7.4, cusps: 4 }, { x: 9, w: 4.4, h: 7.4, cusps: 4 }], { z: 101 });
  B(g, MAT.creamD, 29, 0.6, 11.8, 0, 15.5, 101, true); for (const x of [-9.5, 0, 9.5]) chhatri(g, c, c, 3.4, x, 16.1, 101); guldastas(g, c, -13.5, 13.5, 16.1, 96, 12, 1); guldastas(g, c, -13.5, 13.5, 16.1, 106, 12, 1);
  // main court
  flatRect(g, GM.paver, 104, 128, 0, 169, 0.012); for (const [x, z, ww, dd] of [[24, 135, 40, 44], [24, 198, 40, 56], [-14, 204, 22, 44]]) { flatRect(g, GM.lawnTop, ww, dd, x, z, 0.02); for (let i = 0; i < 5; i++) treeAt(F, x + rr(-ww / 2 + 2, ww / 2 - 2), z + rr(-dd / 2 + 2, dd / 2 - 2), 3, 1); }
  [[40, 120], [44, 180], [8, 226], [-44, 228], [46, 228]].forEach(q => treeAt(F, q[0], q[1], 2, 1.1)); [[30, 150, 1.2], [36, 214, 1.3]].forEach(q => treeAt(F, q[0], q[1], 1, q[2]));
  // the great steps, plinth and hall
  stairs(grp(g, 0, 248, Math.PI), MAT.stoneD, 96, 20, 0.25, 0.8, 0, 0, 16);
  P(g, MAT.creamD, 106, 5, 52, 0, 0, 274);
  B(g, c, 99, 12, 42, 0, 5, 273);
  const hf = grp(g, 0, 252, Math.PI);
  for (let i = 0; i < 9; i++) { const x = -42.4 + i * 10.6; decal(hf, 7.2, 9.4, x, 5.2, 0, { cusps: 5, trim: MAT.surkhiL, mat: i % 2 ? MAT.recess : MAT.recessLit }); if (i < 8) decal(hf, 1.2, 1.9, x + 5.3, 9.4, 0, { trim: MAT.surkhiL }); }
  arcade(hf, 19, -47.5, 47.5, 15, 0, 1.5, { fill: 0.4 });
  for (const x of [-26.5, 26.5]) { B(hf, c, 3, 0.3, 1.6, x, 11.2, 0.8, true); B(hf, c, 2.6, 2.6, 1.3, x, 11.5, 0.65, true); dome(hf, c, 1.35, x, 14.1, 0.65, 0.8); }
  for (const s of [-1, 1]) arcade(grp(g, s * 49.5, 273, s * Math.PI / 2), 4, -19, 19, 5.3, 0, 9.4, { cusps: 5, trim: MAT.surkhiL, fill: 0.6 });
  B(g, MAT.creamD, 100.6, 0.7, 43.6, 0, 17, 273, true);
  B(g, A, 95, 6.6, 38, 0, 17.7, 273, true); arcadeBox(g, 0, 273, 95, 38, 18.4, 4.4, 27, 10, { fill: 0.58 });      // the labyrinth storey
  B(g, A, 95.6, 1.6, 38.6, 0, 24.3, 273, true); arcadeBox(g, 0, 273, 95.6, 38.6, 24.5, 1.1, 40, 16, { fill: 0.5 });
  for (let i = 0; i < 9; i++) chhatri(g, A, A, 2.5, -44 + i * 11, 25.9, 256.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { C(g, c, 3.6, 3.9, 22.5, sx * 51, 5, 273 + sz * 20, 8, true); C(g, MAT.creamD, 4.3, 4.3, 0.5, sx * 51, 27.5, 273 + sz * 20, 8, true, true); chhatri(g, c, A, 6, sx * 51, 28, 273 + sz * 20, 8); }
  // Shahi Baoli
  B(g, A, 16, 9, 42, 97, 0, 172); const bf = grp(g, 89, 172, -Math.PI / 2); arcade(bf, 6, -20, 20, 0.4, 0, 3.9, T); arcade(bf, 6, -20, 20, 5.1, 0, 3.2, T); B(g, MAT.creamD, 16.6, 0.4, 42.6, 97, 9, 172, true);
  for (const [x, z, ww, dd] of [[81, 155.4, 15, 0.6], [81, 188.6, 15, 0.6], [73.5, 172, 0.6, 33.8]]) B(g, A, ww, 1.1, dd, x, 0, z); flatRect(g, talabWater, 14, 32.6, 81, 172, 0.25);
  B(g, A, 1, 3, 1, 73.5, 0, 172, true);
  // Naubat Khana across the road
  const nk = grp(g, 46, -33); B(nk, A, 124, 8.6, 12, 0, 0, 0); arcadeBox(nk, 0, 0, 124, 12, 0.4, 3.6, 22, 0, T); arcadeBox(nk, 0, 0, 124, 12, 4.9, 2.9, 22, 0, T); B(nk, MAT.creamD, 124.6, 0.4, 12.6, 0, 8.6, 0, true);
  B(nk, c, 16, 13.5, 14, 0, 0, 1); arcade(grp(nk, 0, 8), 3, -7, 7, 0.5, 0, 5, T); arcade(grp(nk, 0, 8), 3, -7, 7, 7.2, 0, 4.2, T); C(nk, c, 4.6, 4.8, 9, 0, 0, 8.4, 12); dome(nk, c, 4.4, 0, 9, 8.4, 0.7);
  for (const x of [-5.5, 0, 5.5]) chhatri(nk, c, c, 2.8, x, 13.5, 1); merlons(nk, A, -62, 62, 9, 5.8, 70, 0.7, 0.6, 0.35);
  // boundary walls from the survey (the street side is handled above)
  const poly = (MAP.areas.find(a => /Naubatkhana/.test(a.n || '')) || { p: [] }).p, wg = new THREE.Group();
  for (let i = 0; i < poly.length; i += 2) { const j = (i + 2) % poly.length, a = toLocal(F, poly[i], poly[i + 1]), b = toLocal(F, poly[j], poly[j + 1]); if (a[1] < 8 && b[1] < 8) continue; const wa = toLocal(FRAME.asfi, poly[i], poly[i + 1]), wb = toLocal(FRAME.asfi, poly[j], poly[j + 1]); if (Math.abs(wa[0]) < 46 && Math.abs(wb[0]) < 46 && wa[1] < 0 && wb[1] < 0) continue; wallRun(wg, A, poly[i], poly[i + 1], poly[j], poly[j + 1], 4.4, 0.9, false); }
  bake(g); bake(wg);
  boxLights(F, 0, 273, 95.6, 38.6, 26); boxLights(F, 0, 273, 100.6, 43.6, 17.8); for (let i = 0; i < 9; i++) festiveOutline({ x: F.x, z: F.z, rot: F.rot }, 7.2, 9.4, 251.6, -42.4 + i * 10.6, 5.2);
  boxLights(F, 0, 3, 28, 8.8, 14.7); boxLights(F, 0, 101, 29, 11.8, 16.2);
  zone(F, -40, 10, 40, 92, 26); zone(F, -44, 110, 44, 228, 34); zone(F, -44, 248.5, 44, 251.4, 14, 5); zone(F, -30, -6, 30, -1, 12);
  for (let i = 0; i < 26; i++) { const st = ri(2, 16); seatAt(F, rr(-44, 44), 232 + (st + 0.75) * 0.8, (st + 2) * 0.25, Math.PI); }
  [[-22, -4, 'chaat'], [-14, -5, 'fruit'], [16, -4.5, 'icecream'], [24, -5, 'candy'], [34, -4, 'toys'], [-34, -4.5, 'juice'], [6, 14, 'balloon']].forEach(q => vendor(F, q[0], q[1], Math.PI, q[2]));
  [[-50, -5, 'tonga'], [-58, -5, 'baggi'], [-66, -5, 'tonga'], [50, -5, 'erick'], [56, -5, 'auto'], [62, -5, 'erick']].forEach(q => parkAt(F, q[0], q[1], Math.PI / 2, q[2]));
  const hw = toWorld(F, 0, 273);
  LABELS.push({ id: 'bara', en: 'Bara Imambara', hi: 'बड़ा इमामबाड़ा', ur: 'بڑا امام باڑہ', pos: [hw[0], 44, hw[1]], cam: [540, 48, 478], tgt: [hw[0], 12, hw[1] - 14], walk: [...toWorld(F, 0, 122), hw[0], hw[1]], yr: 'Asafi Imambara · 1784',
    text: 'Commissioned by Nawab Asaf-ud-Daula in the famine of 1784 to give the city work. Two gateways and a garden court lead to a full-width flight of steps; the central hall behind the nine arches, about 50 m long and 15 m high, is vaulted without a single beam, and the Bhul-Bhulaiya labyrinth threads the storey above. The Asfi Mosque stands askew on the west, the Shahi Baoli stepwell on the east.' });
  LABELS.push({ id: 'baoli', small: true, en: 'Shahi Baoli', hi: 'शाही बावली', ur: 'شاہی باؤلی', pos: [...toWorld(F, 90, 172).slice(0, 1), 14, toWorld(F, 90, 172)[1]] });
  const nw = toWorld(F, 46, -33); LABELS.push({ id: 'naubatB', small: true, en: 'Naubat Khana', hi: 'नौबत ख़ाना', ur: 'نوبت خانہ', pos: [nw[0], 19, nw[1]] });
  buildAsfi();
}

/* ═════════════ Teele Wali Masjid ═════════════ */
function mosque(F, o) {
  const j = frameGroup(F), w = o.mat, hw = o.w / 2;
  if (o.plinth) { P(j, MAT.creamD, o.w + 12, o.plinth, o.court + o.d + 4, 0, 0, o.court / 2); stairs(j, MAT.stone, o.w * 0.4, Math.round(o.plinth / 0.3), 0.3, 0.5, 0, 0, o.court + o.d / 2 + 2 + Math.round(o.plinth / 0.3) * 0.5); }
  const y = o.plinth || 0;
  B(j, w, o.w, o.h, o.d, 0, y, 0); arcade(j, o.n, -hw + 1, hw - 1, y + 0.3, o.d / 2, o.h * 0.68, { cusps: 5, trim: MAT.trimW, lit: 0.3 });
  B(j, w, o.w * 0.2, o.h * 1.4, 1.2, 0, y, o.d / 2 + 0.4, true); decal(j, o.w * 0.12, o.h * 1.05, 0, y + 0.3, o.d / 2 + 1, { cusps: 6, trim: MAT.trimW });
  B(j, MAT.whiteD, o.w + 1.4, 0.6, o.d + 1.4, 0, y + o.h, 0, true); guldastas(j, w, -hw, hw, y + o.h + 0.6, o.d / 2, Math.round(o.w / 3.4), 1.1, MAT.gold);
  const r = o.d * 0.42; C(j, w, r * 0.95, r, 2, 0, y + o.h + 0.6, 0, 20, false, true); dome(j, w, r, 0, y + o.h + 2.6, 0, 1);
  for (const s of [-1, 1]) { C(j, w, r * 0.76, r * 0.8, 1.7, s * o.w * 0.31, y + o.h + 0.6, 0, 20, false, true); dome(j, w, r * 0.8, s * o.w * 0.31, y + o.h + 2.3, 0, 1); minaret(j, w, w, o.min, o.w * 0.031, s * (hw + 1.4), y, o.d / 2 - 0.4, 4); }
  bake(j);
  boxLights(F, 0, 0, o.w + 1.4, o.d + 1.4, y + o.h + 0.8);
}
function buildOuterMosques() {
  const TF = { x: 640, z: 268, rot: Math.PI / 2 }, mg = new THREE.Group();
  { const md = new THREE.Mesh(new THREE.SphereGeometry(48, 24, 10, 0, TAU, 0, Math.PI / 2), MAT.lawn); md.scale.y = 0.15; md.position.set(640, 0, 268); md.receiveShadow = true; mg.add(md); }
  bake(mg);
  const tf = { x: 640, z: 268, rot: Math.PI / 2 }, t = frameGroup(tf); t.position.y = 6.6;
  B(t, MAT.white, 36, 9, 12, 0, 0, 0, true); arcade(t, 7, -17, 17, 0.3, 6, 6.2, { cusps: 5, trim: MAT.trimW, lit: 0.3 }); B(t, MAT.whiteD, 37, 0.5, 13, 0, 9, 0, true);
  C(t, MAT.white, 4.6, 4.8, 1.6, 0, 9.5, 0, 18, false, true); dome(t, MAT.white, 5, 0, 11.1, 0); for (const s of [-1, 1]) { C(t, MAT.white, 3.6, 3.8, 1.3, s * 11.5, 9.5, 0, 18, false, true); dome(t, MAT.white, 3.9, s * 11.5, 10.8, 0); minaret(t, MAT.white, MAT.white, 26, 1.3, s * 19, 0, 5.4, 3); }
  bake(t);
  LABELS.push({ id: 'teele', small: true, en: 'Teele Wali Masjid', hi: 'टीले वाली मस्जिद', ur: 'ٹیلے والی مسجد', pos: [640, 46, 268] });
}

/* ═════════════ Husainabad Food Court and the Lucknow Museum of Heritage and Arts ═════════════ */
// Footprints (FOOD_COURT, MUSEUM, FOOD_SQUARE) are defined in city.js. The facades follow
// listing photos: a two-storey red-brick hall with a double-height glass corner
// facing the Clock Tower, and a red sandstone museum behind a red jali wall.
function extrudeFootprint(pts, height, mat, y0 = 0) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); geo.translate(0, y0 + height, 0);
  const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true;
  return m;
}
/** Orientation of a footprint edge, with its normal pointing away from `centre`. */
function edgeFrame(a, b, centre) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  let nx = dz / len, nz = -dx / len;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  if ((mx - centre[0]) * nx + (mz - centre[1]) * nz < 0) { nx = -nx; nz = -nz; }
  return { nx, nz, mx, mz, len, rot: Math.atan2(nx, nz) };
}
const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function buildFoodCourt() {
  const g = new THREE.Group();
  const brick = M(0xd0694c, { map: TEX.brick }), sandstone = M(0xb35b43, { map: TEX.plaster });
  const glass = M(0x6f8790, { metalness: 0.5, roughness: 0.12, envMap: ENV, emissive: 0xffe2b0, emissiveIntensity: 0 });
  ENVMATS.push(glass);
  NIGHTFX.push(() => { glass.emissiveIntensity = 0.05 + TIME.lamps * 0.55; });
  const orange = M(0xe0682a, { roughness: 0.6 });
  // Forecourt paving round the food court, and the square to the south.
  flatPoly(g, GM.paver, [[138.5, 24], [178, 15.5], [188, 45], [183, 58], [146.5, 62]], 0.014);
  flatPoly(g, GM.paver, FOOD_SQUARE, 0.016);

  // The red-brick hall with a white coping.
  g.add(extrudeFootprint(FOOD_COURT, 10.6, brick));
  g.add(extrudeFootprint(FOOD_COURT, 0.3, MAT.whiteD, 10.6));
  MAPPED_SOLIDS.push({ feature: { p: FOOD_COURT.flat() }, height: 10.9 });
  const centre = [164, 38], A = [147.1, 30.3], NB = [154.8, 28.8], NC = [154.2, 25.7];
  const westEnd = [151.6, 55.7], northEnd = [176.8, 20.9];
  const W1 = along(A, westEnd, 9.5 / 25.8), N1 = along(NC, northEnd, 9 / 23.1);
  // Double-height glass round the north-west corner, under a deep white canopy.
  for (const [a, b] of [[A, W1], [A, NB], [NB, NC], [NC, N1]]) {
    const f = edgeFrame(a, b, centre);
    const pane = B(g, glass, f.len, 8.75, 0.06, f.mx + f.nx * 0.04, 0.25, f.mz + f.nz * 0.04, true); pane.rotation.y = f.rot;
    const n = Math.max(1, Math.round(f.len / 1.6));
    for (let i = 0; i <= n; i++) {
      const q = along(a, b, i / n);
      B(g, MAT.whiteW, 0.12, 8.75, 0.16, q[0] + f.nx * 0.1, 0.25, q[1] + f.nz * 0.1, true).rotation.y = f.rot;
    }
    B(g, MAT.whiteW, f.len, 0.14, 0.16, f.mx + f.nx * 0.1, 4.6, f.mz + f.nz * 0.1, true).rotation.y = f.rot;
    B(g, MAT.white, f.len + 0.7, 0.55, 2.3, f.mx + f.nx * 1.15, 9.0, f.mz + f.nz * 1.15, true).rotation.y = f.rot;
    P(g, MAT.stone, f.len, 0.25, 1.6, f.mx + f.nx * 0.8, 0, f.mz + f.nz * 0.8).rotation.y = f.rot;
  }
  // "HUSAINABAD FOOD COURT" along the parapet of both street faces.
  // Lettering starts near the glass corner, as in the photos.
  for (const [a, b] of [[A, westEnd], [NC, northEnd]]) {
    const f = edgeFrame(a, b, centre), q = along(a, b, 7.6 / f.len);
    litBoard(g, 'foodCourtWord', 13, 1.5, q[0] + f.nx * 0.14, 10.95, q[1] + f.nz * 0.14, { transparent: true, rotY: f.rot, glow: 1.0 });
  }
  // Outlet standee by the entrance.
  {
    const f = edgeFrame(A, westEnd, centre), st = grp(g, 143.2, 29.2, f.rot);
    B(st, MAT.iron, 1.6, 2.7, 0.1, 0, 0, -0.06, true);
    litBoard(st, 'outlets', 1.45, 2.2, 0, 0.35, 0.0, { glow: 0.45 });
  }
  // Brick planters, wooden bench boxes and café tables on the west forecourt.
  for (const z of [33, 40.5, 48, 55]) {
    const x = durgadeviX(z) + 9.3;
    B(g, brick, 1.0, 0.55, 2.6, x, 0, z); B(g, MAT.hedge, 0.8, 0.4, 2.4, x, 0.55, z, true);
  }
  for (const [x, z] of [[142.5, 36.5], [143.8, 44], [145.2, 51.5]]) {
    C(g, MAT.white, 0.55, 0.55, 0.05, x, 0.74, z, 12, false, true); C(g, MAT.iron, 0.05, 0.2, 0.74, x, 0, z, 6, false, true);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4, cx = x + Math.cos(a) * 0.95, cz = z + Math.sin(a) * 0.95;
      C(g, orange, 0.2, 0.2, 0.46, cx, 0, cz, 8, false, true);
      if (chance(0.6)) seatAt(WORLD, cx, cz, 0.48, Math.atan2(x - cx, z - cz));
    }
  }
  for (const z of [27.5, 58]) B(g, MAT.woodL, 2.6, 0.45, 0.6, durgadeviX(z) + 11, 0, z);

  // The museum: red sandstone block with a projecting upper box on white columns.
  g.add(extrudeFootprint(MUSEUM, 9.2, sandstone));
  g.add(extrudeFootprint(MUSEUM, 0.35, MAT.whiteD, 9.2));
  MAPPED_SOLIDS.push({ feature: { p: MUSEUM.flat() }, height: 9.55 });
  for (const z of [88.8, 92.6, 96.4, 100.2]) C(g, MAT.white, 0.26, 0.3, 3.6, 157.0, 0, z, 12);
  B(g, sandstone, 4.6, 3.7, 13.2, 157.9, 3.6, 94.5);
  B(g, glass, 0.06, 1.1, 10, 155.57, 5.1, 94.5, true);
  B(g, glass, 0.08, 3.0, 9.0, 159.55, 0.3, 94.5, true);
  litBoard(g, 'museumBanner', 9.5, 0.85, 155.5, 2.6, 94.5, { rotY: -Math.PI / 2, glow: 0.5 });
  // Red jali boundary wall along Durgadevi Marg, open at the museum gate.
  const jaliRot = Math.atan2(0.972, -0.2349);
  for (let z = 59; z < 106; z += 2.45) {
    if (z > 89 && z < 97) continue;
    const seg = grp(g, durgadeviX(z + 1.2) + 7.6, z + 1.2, jaliRot);
    B(seg, sandstone, 2.45, 0.45, 0.35, 0, 0, 0); B(seg, sandstone, 0.3, 1.65, 0.4, -1.22, 0, 0, true); B(seg, sandstone, 2.5, 0.1, 0.42, 0, 1.45, 0, true);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), SHOP_MAT.jali); screen.position.set(0, 0.95, 0); seg.add(screen);
  }
  // The square: benches, lamps and shade trees.
  for (const [x, z, r] of [[163, 71, 0.2], [176, 68, 0.2], [167, 82, Math.PI + 0.2], [180, 79, Math.PI + 0.2]]) bench(g, WORLD, x, z, r);
  for (const [x, z] of [[160, 74], [184, 70], [171, 86], [143, 30], [146, 58]]) lampAt(WORLD, x, z, 3);
  for (const [x, z] of [[158, 66], [186, 64], [190, 86], [196, 50], [205, 66]]) treeAt(WORLD, x, z, 0, 0.9);
  bake(g);

  zone(WORLD, 140, 30, 146, 57, 16); zone(WORLD, 161, 68, 182, 84, 8);
  // Customers queue at the glass doors, between the planters and the facade.
  for (const cz of [34.8, 43.2]) {
    const cx = durgadeviX(cz) + 12.2;
    MARKET_STALLS.push({ counter: [cx, cz], entry: [cx - 1.0, cz - 3.0], exit: [cx - 1.0, cz + 2.6] });
  }
  for (let i = 0; i < 5; i++) { const z = 30 + i * 5; parkAt(WORLD, durgadeviX(z) + 3.1, z, 0.237, pick(['auto', 'erick', 'erick'])); }
  vendor(WORLD, 143.5, 57, -1.4, 'balloon');
  LABELS.push({ id: 'food', en: 'Husainabad Food Court', hi: 'हुसैनाबाद फ़ूड कोर्ट', ur: 'حسین آباد فوڈ کورٹ', pos: [164, 16, 38], cam: [104, 30, 2], tgt: [160, 6, 36], walk: [141.5, 33, 150, 33], yr: 'Opened 2025',
    text: 'A two-storey red-brick food hall opposite the Clock Tower, across Durgadevi Marg. Its double-height glass corner faces the tower under a deep white canopy, with lit lettering along the parapet. Inside are outlets including Rumi Cafe, Kabeer’s, Tunday Kababi, EFC, HOCCO and Pista House round a seating hall. Outside, tables and brick planters line the forecourt.' });
  LABELS.push({ id: 'museum', small: true, en: 'Lucknow Museum of Heritage and Arts', hi: 'लखनऊ म्यूज़ियम ऑफ़ हेरिटेज एंड आर्ट्स', ur: 'لکھنؤ میوزیم آف ہیریٹیج اینڈ آرٹس', pos: [205, 14, 95] });
}

/* festive illumination: thousands of small bulbs tracing the monuments */
function buildFestive() {
  const mat = new THREE.PointsMaterial({ map: glowTex, size: 1.25, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd27a });
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(FESTIVE, 3)), mat); pts.frustumCulled = false; scene.add(pts);
  let tw = 0;
  UPDATERS.push((dt, t) => { tw = 0.82 + 0.18 * Math.sin(t * 3.1); });
  NIGHTFX.push(n => { const on = OPT.festive && n > 0.25; pts.visible = on; if (on) mat.opacity = Math.min(1, (n - 0.25) * 2.2) * tw; });
}
function buildMonuments() {
  buildPark(); buildSatkhanda(); buildHGate(FRAME.gateE, 'gateE'); buildHGate(FRAME.gateW, 'gateW'); buildChota(); buildRumi(); buildBara(); buildOuterMosques(); buildFoodCourt(); buildKiosks();
  buildShopFronts();
  for (const [id, place] of Object.entries(PLACE_CATALOG)) {
    const frame = FRAME[place.frame];
    const world = ([x, y, z]) => {
      const [wx, wz] = toWorld(frame, x, z);
      return [wx, y, wz];
    };
    const views = place.views?.map(view => ({ name: view.name, cam: world(view.cam), tgt: world(view.tgt) }));
    const walk = place.walk;
    LABELS.push({
      id, ...place.name, record: place, pos: world(place.position), views,
      cam: views?.[0].cam, tgt: views?.[0].tgt, text: place.description.en,
      walk: walk && [...toWorld(frame, walk[0], walk[1]), ...toWorld(frame, walk[2], walk[3]), walk[4]],
    });
  }
  LABELS.push({ id: 'all', en: 'Whole precinct', hi: 'पूरा इलाक़ा', ur: 'پورا علاقہ', cam: [150, 430, 640], tgt: [60, 0, 170], nolabel: true });
  [['Husainabad Trust Road', 'हुसैनाबाद ट्रस्ट रोड', 'حسین آباد ٹرسٹ روڈ', 60, 128], ['Gomti', 'गोमती', 'گومتی', 560, 30], ['Gulab Vatika', 'गुलाब वाटिका', 'گلاب واٹیکا', 450, 232], ['Fragrance Park', 'फ़्रेगरेंस पार्क', 'فریگرینس پارک', 86, 196], ['Nimbu Park', 'नींबू पार्क', 'نیبو پارک', 330, 440], ['Kudiya Ghat', 'कुड़िया घाट', 'کڑیا گھاٹ', 300, -40], ['Durgadevi Marg', 'दुर्गादेवी मार्ग', 'درگا دیوی مارگ', 118, -30]].forEach(q => LABELS.push({ id: 'r' + q[3], road: true, en: q[0], hi: q[1], ur: q[2], pos: [q[3], 3, q[4]] }));
  buildFestive();
}
