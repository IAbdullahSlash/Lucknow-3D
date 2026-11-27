'use strict';
/* festival.js — Muharram and Eid in Husainabad, by the Hijri date or as chosen in Options.

   Muharram (1–10 Muharram): Husainabad is the centre of Lucknow's azadari. Most people are in black, the bunting turns
   black, green and red, "Labbaik Ya Hussain" banners hang on the gateways, sabeels (stalls giving water to mourners)
   stand along the road, and the Imambaras and Rumi Darwaza are lit with strings of bulbs.
   On 1 Muharram the Shahi Zari procession, begun by Muhammad Ali Shah in 1837, goes from the Bara Imambara to the
   Chota Imambara in the evening: members of the royal family, shehnai players, an elephant and camels, children with
   flags, a band playing elegies, alams, sozkhwans, Duldul (a white horse in a red-stained cloth), Ali Asghar's cradle,
   the wax and mica zarihs and the 22-foot Shahi Zari, then anjumans of mourners in black beating their chests. The
   road is closed to traffic while it passes. (Hindustan Times, 27 June 2025; Times of India, June 2026.)

   Eid (1 Shawwal, 10 Dhul Hijjah): the Shia congregation prays at the Asfi Mosque in the Bara Imambara at 11 am, row
   on row on its platform; crowds are larger all day, in white kurtas and new clothes, and the lights are on at night.

   The date follows the arithmetic Hijri calendar, which matched six of the last eight Indian dates for these days
   exactly and the other two within a day (the moon sighting decides). */

const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabi ul-Awwal', 'Rabi us-Sani', 'Jumada al-Ula', 'Jumada al-Akhira', 'Rajab', 'Shaban', 'Ramzan', 'Shawwal', 'Zil Qada', 'Zil Hijja'];
/** Hijri date of a Lucknow civil day (days since 1970-01-01), arithmetic (Kuwaiti) calendar */
function hijriOf(day) {
  let l = day + 2440588 - 1948440 + 10632; const n = Math.floor((l - 1) / 10631); l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709), d = l - Math.floor((709 * m) / 24);
  return { y: 30 * n + j - 30, m, d };
}

const FEST = { key: '', f: null, kind: null, lights: false, groups: {}, built: {} };
const PROC_H0 = 19, PROC_H1 = 22.5;     // the head of the procession leaves the Bara Imambara gate, and reaches the Chota Imambara gate
const PRAYER_H = 11;                    // Eid prayer at the Asfi Mosque
function festivalFor(day) {
  const mode = OPT.festival || 'auto', h = hijriOf(day);
  if (mode === 'off') return null;
  if (mode === 'muharram') return { kind: 'muharram', d: 1, procession: true, chosen: true, h };
  if (mode === 'eid') return { kind: 'eid', name: 'Eid ul-Fitr', prayer: true, chosen: true, h };
  if (h.m === 1 && h.d <= 10) return { kind: 'muharram', d: h.d, procession: h.d === 1, h };
  if (h.m === 10 && h.d <= 3) return { kind: 'eid', name: 'Eid ul-Fitr', d: h.d, prayer: h.d === 1, h };
  if (h.m === 12 && h.d >= 10 && h.d <= 12) return { kind: 'eid', name: 'Eid ul-Adha', d: h.d - 9, prayer: h.d === 10, h };
  return null;
}
const hsh = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
/** a lit material added after the night pass has run gets the lamp light too */
function festMat(o) { const m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }); if (typeof nightPatch === 'function') nightPatch(m, false); return m; }

/* ───────────── figures: a small instanced crowd of its own (the procession and the sabeel staff) ───────────── */
function figPool(n) {
  const mat = festMat({ color: 0xffffff, roughness: 0.85 }), mk = (g, c, sh) => { const m = instanced(g, mat, c, sh); m.visible = false; return m; };
  return {
    n, list: [],
    torso: mk(new THREE.BoxGeometry(0.44, 0.58, 0.25), n, true), leg: mk(new THREE.BoxGeometry(0.16, 0.86, 0.18).translate(0, -0.43, 0), n * 2, false),
    arm: mk(new THREE.BoxGeometry(0.11, 0.6, 0.12).translate(0, -0.3, 0), n * 2, false), head: mk(new THREE.SphereGeometry(0.118, 7, 4), n, false),
    cap: mk(new THREE.CylinderGeometry(0.112, 0.12, 0.1, 8), n, false),
  };
}
const DRESS = {                         // body, legs, cap (null: bareheaded)
  black: i => [0x121214, hsh(i, 1) < 0.35 ? 0xe9e6de : 0x151517, hsh(i, 2) < 0.45 ? 0xf2f0ea : hsh(i, 2) < 0.75 ? 0x151517 : null],
  royal: () => [0x18181c, 0xf2efe6, 0x202024],
  white: () => [0xf2efe6, 0xf2efe6, 0xf4f4f0],
  band: () => [0x7b1e2b, 0xf2efe6, 0x7b1e2b],
  kid: i => [[0x121214, 0x1d4d2e, 0x121214][i % 3], 0x1c1c22, null],
};
function addFig(P, o) {
  if (P.list.length >= P.n) return null;
  const i = P.list.length, [body, legs, cap] = DRESS[o.dress || 'black'](i), skin = SKIN[(i * 7) % SKIN.length];
  const f = { i, x: 0, y: 0, z: 0, yaw: 0, ph: hsh(i, 3) * 6, beat: hsh(i, 4) * 0.08, sc: o.kid ? 0.66 : 0.95 + hsh(i, 5) * 0.1, tl: o.kid ? 1.2 : 1.45, cap: cap !== null, pose: 'walk', vis: false, ...o };
  P.torso.setColorAt(i, _c.set(body)); P.head.setColorAt(i, _c.set(skin)); P.cap.setColorAt(i, _c.set(cap === null ? 0 : cap));
  for (const k of [0, 1]) { P.leg.setColorAt(i * 2 + k, _c.set(legs)); P.arm.setColorAt(i * 2 + k, _c.set(body)); }
  P.list.push(f); return f;
}
function poseFig(P, f, t, moving) {
  const i = f.i, s = f.sc, cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), sw = moving ? Math.sin(f.ph) : 0, y = f.y + (moving ? Math.abs(sw) * 0.025 : 0);
  setLimb(P.torso.instanceMatrix.array, i, f.x, y, f.z, cy, sy, 0, (1.13 - (f.tl - 1) * 0.29) * s, 0, 0, s, s * f.tl, s);
  setLimb(P.leg.instanceMatrix.array, i * 2, f.x, y, f.z, cy, sy, -0.1 * s, 0.86 * s, 0, sw * 0.5, s, s, s);
  setLimb(P.leg.instanceMatrix.array, i * 2 + 1, f.x, y, f.z, cy, sy, 0.1 * s, 0.86 * s, 0, -sw * 0.5, s, s, s);
  let aL = -sw * 0.4, aR = sw * 0.4;
  if (f.pose === 'matam') {               // seenazani: the right hand goes up and comes down on the chest, in time with the anjuman
    const u = (t * 1.15 + f.beat) % 1, k = moving ? 0.6 : 1;
    aR = u < 0.72 ? -0.7 - 2.1 * k * (u / 0.72) : -0.7 - 2.1 * k * (1 - (u - 0.72) / 0.28); aL = -0.25;
  } else if (f.pose === 'carry') aL = aR = -2.55;
  else if (f.pose === 'hold') { aR = -2.75; aL = -1.25; }
  else if (f.pose === 'play') aL = aR = -1.75;
  else if (f.pose === 'lamp') aR = -2.95;
  else if (f.pose === 'serve') { aR = -1.2 - 0.3 * Math.sin(t * 1.3 + f.ph); aL = -0.9; }
  setLimb(P.arm.instanceMatrix.array, i * 2, f.x, y, f.z, cy, sy, -0.28 * s, 1.4 * s, 0, aL, s, s, s);
  setLimb(P.arm.instanceMatrix.array, i * 2 + 1, f.x, y, f.z, cy, sy, 0.28 * s, 1.4 * s, 0, aR, s, s, s);
  setLimb(P.head.instanceMatrix.array, i, f.x, y, f.z, cy, sy, 0, 1.58 * s, 0, 0, s, s, s);
  if (f.cap) setLimb(P.cap.instanceMatrix.array, i, f.x, y, f.z, cy, sy, 0, 1.68 * s, -0.01 * s, 0, s, s, s); else hideInst(P.cap.instanceMatrix.array, i);
}
function hideFig(P, f) { const i = f.i; for (const m of [P.torso, P.head, P.cap]) hideInst(m.instanceMatrix.array, i); for (const k of [0, 1]) { hideInst(P.leg.instanceMatrix.array, i * 2 + k); hideInst(P.arm.instanceMatrix.array, i * 2 + k); } }
function poolDirty(P, colours) { for (const m of [P.torso, P.leg, P.arm, P.head, P.cap]) { m.instanceMatrix.needsUpdate = true; if (colours && m.instanceColor) m.instanceColor.needsUpdate = true; m.count = m === P.leg || m === P.arm ? P.list.length * 2 : P.list.length; } }
const poolShow = (P, on) => { for (const m of [P.torso, P.leg, P.arm, P.head, P.cap]) m.visible = on; };

/* ───────────── models: elephant, camel, Duldul, the cradle and the zarihs ───────────── */
const AU = 0xd4a63a;
function elephantGeo() {
  const p = painter(), G = 0x77706b, B = 0x141414;
  p.sph(1, 0, 2.15, 0, G, 1.2, 1.05, 1.75); p.sph(0.78, 0, 2.6, 1.7, G, 0.95, 1.05, 0.9);
  for (const s of [-1, 1]) p.box(0.1, 1.15, 0.95, s * 0.8, 2.55, 1.45, G, s * 0.35);
  p.cyl(0.18, 0.3, 1.7, 0, 1.55, 2.35, G); for (const s of [-1, 1]) p.cyl(0.05, 0.07, 0.7, s * 0.3, 2.0, 2.45, 0xf2ead8, 'z');
  for (const [x, z] of [[-0.6, 0.95], [0.6, 0.95], [-0.6, -0.95], [0.6, -0.95]]) p.cyl(0.32, 0.36, 1.55, x, 0.78, z, G);
  p.cyl(0.04, 0.05, 1.0, 0, 1.75, -1.85, G);
  p.box(2.5, 1.25, 2.3, 0, 2.45, -0.05, B); p.box(2.52, 0.12, 2.32, 0, 1.85, -0.05, AU);              // black caparison, gold hem
  p.box(1.0, 0.85, 0.06, 0, 2.75, 2.42, B); p.box(1.02, 0.08, 0.07, 0, 2.35, 2.42, AU);
  p.box(1.2, 0.45, 1.3, 0, 3.3, -0.2, 0x7a1424); p.box(1.24, 0.06, 1.34, 0, 3.08, -0.2, AU);
  fig(p, 0, 3.2, 1.05, 0xf2f0ea);
  return p.done();
}
function camelGeo() {
  const p = painter(), T = 0xb88a5a;
  p.sph(0.62, 0, 1.75, 0, T, 0.75, 0.6, 1.35); p.sph(0.42, 0, 2.2, -0.1, T, 0.85, 0.9, 1.1);
  for (const [x, z] of [[-0.28, 0.65], [0.28, 0.65], [-0.28, -0.65], [0.28, -0.65]]) p.cyl(0.09, 0.12, 1.5, x, 0.75, z, T);
  p.box(0.26, 1.0, 0.3, 0, 2.15, 1.05, T, 0, 0.55); p.box(0.26, 0.28, 0.6, 0, 2.65, 1.5, T);
  p.box(1.0, 0.55, 1.2, 0, 1.85, -0.05, 0x8b1a1a); p.box(1.02, 0.08, 1.22, 0, 1.6, -0.05, AU);
  return p.done();
}
function duldulGeo() {                    // Imam Hussain's horse: white, under a white cloth stained red
  const p = painter();
  horse(p, 0, 0xece8e0, false);
  p.box(0.98, 0.6, 1.3, 0, 1.45, -0.05, 0xf4f1ea); p.box(0.7, 0.04, 1.32, 0, 1.76, -0.05, 0xf4f1ea);
  for (let k = 0; k < 12; k++) { const s = k % 2 ? 1 : -1; p.box(0.03, 0.08 + (k % 3) * 0.06, 0.1 + (k % 4) * 0.05, s * 0.5, 1.22 + ((k * 5) % 7) * 0.06, -0.62 + k * 0.11, 0xa3121a); }
  for (let k = 0; k < 5; k++) p.box(0.12 + k % 2 * 0.08, 0.02, 0.1, -0.2 + k * 0.1, 1.77, -0.5 + k * 0.22, 0xa3121a);
  return p.done();
}
function jhulaGeo() {                     // Ali Asghar's cradle on its carrying poles
  const p = painter(), G = 0x1f6b3a, Wd = 0x5a3a22;
  for (const s of [-1, 1]) p.cyl(0.04, 0.04, 3.4, s * 0.55, 1.4, 0, Wd, 'z');
  p.box(0.9, 0.3, 1.2, 0, 1.62, 0, G); p.box(0.92, 0.05, 1.22, 0, 1.78, 0, AU);
  for (const [x, z] of [[-0.4, -0.55], [0.4, -0.55], [-0.4, 0.55], [0.4, 0.55]]) p.box(0.05, 0.75, 0.05, x, 2.12, z, AU);
  p.box(1.0, 0.06, 1.3, 0, 2.5, 0, G); p.box(1.02, 0.18, 1.32, 0, 2.4, 0, AU);
  return p.done();
}
/** a zarih: platform, an enclosure with grilles, corner minarets, an octagonal tier with mirror bands, dome, crown and
    chand-taara. Built 6.3 m high; `col` picks the palette (the Shahi Zari's colours, or the white wax or the mica one) */
function zariParts(col) {
  const m = painter(), s = painter(), b = painter(), C = { white: 0xf3efe6, green: 0x1d7a46, red: 0x9c1c2a, paper: [0xd62839, 0xf4c430, 0xe75480, 0x1e88e5], ...col };
  m.box(3.0, 0.4, 3.0, 0, 0.2, 0, C.red); s.box(3.04, 0.08, 3.04, 0, 0.42, 0, AU);
  m.box(2.3, 1.9, 2.3, 0, 1.4, 0, C.white);
  for (let k = 0; k < 4; k++) {
    const r = k * Math.PI / 2, ox = Math.sin(r) * 1.16, oz = Math.cos(r) * 1.16;
    m.box(1.7, 1.45, 0.05, ox, 1.35, oz, C.green, r);
    for (let q = 0; q < 5; q++) m.box(0.04, 1.4, 0.06, ox + Math.cos(r) * (q - 2) * 0.32, 1.35, oz - Math.sin(r) * (q - 2) * 0.32, AU, r);   // grille bars
    for (let q = 0; q < 7; q++) m.box(0.16, 0.16, 0.04, ox * 1.04 + Math.cos(r) * (q - 3) * 0.3, 2.22, oz * 1.04 - Math.sin(r) * (q - 3) * 0.3, C.paper[(q + k) % 4], r);   // coloured paper
  }
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { m.box(0.28, 2.0, 0.28, x, 1.4, z, C.white); m.cyl(0.11, 0.14, 2.1, x, 3.55, z, C.white, 'y', 8); s.sph(0.19, x, 4.65, z, AU); s.cone(0.05, 0.3, x, 4.95, z, AU, 6); b.box(0.07, 0.07, 0.07, x, 2.55, z, 0xfff1b8); b.box(0.07, 0.07, 0.07, x, 4.45, z, 0xfff1b8); }
  s.box(2.9, 0.22, 2.9, 0, 2.47, 0, AU);
  for (let k = 0; k < 24; k++) { const q = (k % 6) - 2.5, side = (k / 6) | 0, r = side * Math.PI / 2; b.box(0.06, 0.06, 0.06, Math.sin(r) * 1.47 + Math.cos(r) * q * 0.48, 2.36, Math.cos(r) * 1.47 - Math.sin(r) * q * 0.48, 0xfff1b8); }
  m.cyl(1.0, 1.1, 1.5, 0, 3.33, 0, C.white, 'y', 8); s.cyl(1.12, 1.12, 0.16, 0, 2.75, 0, C.mirror || 0xdfe6ea, 'y', 8); s.cyl(1.04, 1.04, 0.14, 0, 3.95, 0, C.mirror || 0xdfe6ea, 'y', 8);
  for (let k = 0; k < 8; k++) { const r = (k + 0.5) * Math.PI / 4; m.box(0.32, 0.6, 0.04, Math.sin(r) * 1.05, 3.35, Math.cos(r) * 1.05, k % 2 ? C.green : C.red, r); }
  m.cyl(0.85, 0.9, 0.35, 0, 4.25, 0, C.green, 'y', 12); s.sph(0.92, 0, 4.48, 0, C.dome || AU, 1, 1.12, 1);
  s.cone(0.22, 0.55, 0, 5.68, 0, AU, 8);
  s.geo(new THREE.TorusGeometry(0.2, 0.035, 6, 14, Math.PI * 1.45).rotateZ(Math.PI * 0.78).translate(0, 6.15, 0), AU); s.sph(0.06, 0.07, 6.17, 0, AU);
  return [m, s, b];
}
function zariMesh(kind) {
  const g = new THREE.Group(), pal = kind === 'mom' ? { white: 0xf4ecd8, green: 0xe8dcc0, red: 0xd9c9a6, paper: [0xf6efe0, 0xead9b5, 0xf6efe0, 0xead9b5], mirror: 0xf3e7cc, dome: 0xf1e3c4 }
    : kind === 'abraq' ? { white: 0xd9dee2, green: 0xbcc6cc, red: 0xaab4bb, paper: [0xe8eef2, 0xc9d3da, 0xe8eef2, 0xc9d3da], mirror: 0xf4f8fa, dome: 0xe9eef1 } : {};
  const [m, s, b] = zariParts(pal), big = kind === 'zari';
  const lift = big ? 0.75 : 1.5, k = big ? 1.0 : 0.52;
  const geos = [m.done(), s.done(), b.done()].map(x => x.scale(k, k, k).translate(0, lift, 0));
  const matte = festMat({ vertexColors: true, roughness: kind === 'mom' ? 0.6 : 0.75 }), shiny = festMat({ vertexColors: true, roughness: 0.22, metalness: kind === 'abraq' ? 0.85 : 0.65 });
  shiny.envMap = ENV; ENVMATS.push(shiny);
  g.add(new THREE.Mesh(geos[0], kind === 'abraq' ? shiny : matte), new THREE.Mesh(geos[1], shiny), new THREE.Mesh(geos[2], new THREE.MeshBasicMaterial({ vertexColors: true })));
  const base = painter();
  if (big) { base.box(3.4, 0.35, 3.6, 0, 0.55, 0, 0x4a3020); for (const [x, z] of [[-1.6, 1.2], [1.6, 1.2], [-1.6, -1.2], [1.6, -1.2]]) base.cyl(0.32, 0.32, 0.18, x, 0.32, z, 0x1a1a1a, 'x', 12); }
  else { base.box(1.8, 0.12, 1.8, 0, 1.44, 0, 0x4a3020); for (const sx of [-1, 1]) base.cyl(0.045, 0.045, 4.0, sx * 1.05, 1.4, 0, 0x5a3a22, 'z'); }
  g.add(new THREE.Mesh(base.done(), festMat({ vertexColors: true })));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.matrixAutoUpdate = true; } });
  return g;
}
/** an alam: a tall standard with the panja on top and a long drape, held up by its bearer */
function alamGeo(drape) {
  const p = painter();
  p.cyl(0.03, 0.035, 4.6, 0, 1.95, 0, 0xb9bec2);                          // origin: the holder at the bearer's waist
  p.box(0.34, 0.42, 0.03, 0, 4.45, 0, AU); for (let q = 0; q < 5; q++) p.box(0.05, 0.16 + (q === 0 ? 0 : 0.06), 0.03, -0.13 + q * 0.065, 4.73 + (q === 0 ? -0.06 : 0), 0, AU);
  p.box(0.9, 0.04, 0.04, 0, 4.1, 0, AU); p.box(0.84, 1.9, 0.02, 0, 3.12, 0.03, drape);
  p.box(0.86, 0.08, 0.025, 0, 2.17, 0.03, AU); for (let q = 0; q < 6; q++) p.box(0.04, 0.22, 0.025, -0.35 + q * 0.14, 2.02, 0.03, AU);
  return p.done();
}
function bannerTex(urdu, english, bg, fg, edge) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 192); x.strokeStyle = edge; x.lineWidth = 10; x.strokeRect(9, 9, 1006, 174);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 70px "Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI",serif'; x.fillText(urdu, 512, 70);
  x.font = '600 44px Georgia,serif'; x.fillText(english, 512, 146);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ───────────── Muharram dressing: banners on the gateways and sabeels along the road ───────────── */
function ensureMuharram() {
  if (FEST.built.muharram) return; FEST.built.muharram = true;
  const g = FEST.groups.muharram = new THREE.Group(); scene.add(g);
  const tex = bannerTex('لبیک یا حسینؑ', 'LABBAIK YA HUSSAIN', '#0d0d0f', '#f4f1ea', '#1d7a46'), mat = festMat({ map: tex, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
  NIGHTFX.push(() => { mat.emissiveIntensity = TIME.lamps * 0.18; });
  const banner = (f, x, y, z, w, back) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.1875), mat); const [wx, wz] = toWorld(f, x, z); m.position.set(wx, y, wz); m.rotation.y = f.rot + (back ? Math.PI : 0); g.add(m); };
  banner(FRAME.bara, 0, 10.8, -1.08, 9, true); banner(FRAME.chota, 0, 10.6, -3.08, 8, true);
  for (const G of [FRAME.gateE, FRAME.gateW]) { banner(G, 0, 12.7, 2.58, 6.4, false); banner(G, 0, 12.7, -2.58, 6.4, true); }
  banner(FRAME.rumi, 0, 9.6, 5.25, 11.5, false);
  // sabeels: water and sherbet for the mourners, on the footpath facing the road
  const p = painter(), tops = painter(), spots = [];
  for (const [s0, side] of [[1048, -1], [800, 1], [705, -1], [598, 1], [486, -1], [392, 1], [300, -1], [214, 1], [128, -1]]) {
    for (let k = 0; k < 8; k++) {
      const s = s0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3.5, a = polyAt(MAIN, s), off = mainHalf(s) + (side > 0 ? 2.3 : 1.7), x = a[0] + a[3] * side * off, z = a[1] - a[2] * side * off;
      if (roadGap(x, z) < 1.4 || nearShopEntrance(x, z, 1.6) || LAMPS.some(l => Math.hypot(l[0] - x, l[1] - z) < 2.8)) continue;
      spots.push([x, z, Math.atan2(-a[3] * side, a[2] * side)]); break;
    }
  }
  const sTex = bannerTex('سبیلِ حسینؑ', 'SABEEL-E-HUSSAIN', '#14532d', '#ffffff', '#d4a63a'), sMat = festMat({ map: sTex, roughness: 0.9 });
  FEST.sabeels = spots;
  for (const [x, z, r] of spots) {
    const L = (lx, lz) => [x + Math.cos(r) * lx + Math.sin(r) * lz, z - Math.sin(r) * lx + Math.cos(r) * lz];
    const at = (w, h, d, lx, y, lz, c, P = p) => { const [wx, wz] = L(lx, lz); P.box(w, h, d, wx, y, wz, c, r); };
    at(2.4, 0.08, 0.8, 0, 0.88, 0, 0xf2f0ea); at(2.4, 0.78, 0.03, 0, 0.47, 0.39, 0x1d7a46);
    for (const lx of [-0.7, 0.7]) { const [wx, wz] = L(lx, -0.08); p.cyl(0.27, 0.27, 0.68, wx, 1.26, wz, 0xc9d0d4, 'y', 12); }
    for (let q = 0; q < 10; q++) { const [wx, wz] = L(-0.9 + q * 0.2, 0.28); p.cyl(0.035, 0.03, 0.1, wx, 0.97, wz, 0xd8dee2, 'y', 6); }
    for (const [lx, lz] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]]) at(0.05, 2.5, 0.05, lx, 1.25, lz, 0x5a3a22);
    at(2.8, 0.04, 1.5, 0, 2.52, 0, 0x121212, tops); at(2.8, 0.26, 0.02, 0, 2.38, 0.75, 0x1d7a46, tops);
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.43), sMat); const [bx, bz] = L(0, 0.77); bm.position.set(bx, 2.0, bz); bm.rotation.y = r; g.add(bm);
  }
  if (p.count) { const m = new THREE.Mesh(p.done(), festMat({ vertexColors: true, roughness: 0.55 })); m.castShadow = true; g.add(m); }
  if (tops.count) { const m = new THREE.Mesh(tops.done(), festMat({ vertexColors: true, side: THREE.DoubleSide })); m.castShadow = true; g.add(m); }
  // the figures' pool: two men at each sabeel for all ten days, and the procession on the first
  PROC.pool = figPool(580);
  for (const [x, z, r] of spots) for (const lx of [-0.75, 0.75]) { const f = addFig(PROC.pool, { dress: 'black', pose: 'serve' }); if (!f) break; f.x = x + Math.cos(r) * lx - Math.sin(r) * 1.0; f.z = z - Math.sin(r) * lx - Math.cos(r) * 1.0; f.yaw = r; PROC.staff.push(f); }
  poolDirty(PROC.pool, true);
}

/* ───────────── the Shahi Zari procession ───────────── */
const PROC = { route: null, len: 0, colLen: 0, pool: null, figs: [], props: [], att: [], pinch: [], shown: false, lamps: null, halo: null, staff: [] };
const _ra = [0, 0, 0, 0];
const PROC_T = (PROC_H1 - PROC_H0) * 3600, PROC_W = TAU / 240;        // it halts for noha every four minutes or so
function headDist(h) { const t = (h - PROC_H0) * 3600; if (t <= 0) return t * 0.08; return PROC.len / PROC_T * (t - Math.sin(PROC_W * t) / PROC_W); }
function headMoving(h) { const t = (h - PROC_H0) * 3600; return t > 0 && 1 - Math.cos(PROC_W * t) > 0.3; }
/** is the procession out on the road (or about to be) at hour h? */
function processionOn(h) { const d = headDist(h); return d > -40 && d - PROC.colLen < PROC.len + 4; }
function ensureProcession() {
  if (FEST.built.proc) return; FEST.built.proc = true;
  ensureMuharram();
  // the route: out of the Bara Imambara's outer gate, west along the road through Rumi Darwaza and the east gateway,
  // and in at the Chota Imambara's gate
  const pts = [], add = q => pts.push(q[0], q[1]);
  add(toWorld(FRAME.bara, 0, 14)); add(toWorld(FRAME.bara, 0, -6));
  const sA = mainProject(...toWorld(FRAME.bara, 0, -1)).s, sB = mainProject(...toWorld(FRAME.chota, 0, -4)).s;
  // vehicles now loop round Rumi Darwaza, but the procession goes through the gate itself
  const rE = toWorld(FRAME.rumi, 0, -34), rW = toWorld(FRAME.rumi, 0, 30), sE = mainProject(...rE).s, sW = mainProject(...rW).s;
  let gate = false;
  for (let s = sA - 6; s > sB + 6; s -= 4) {
    if (s < sE && s > sW) { if (!gate) { gate = true; for (const z of [-34, -20, -11, 6, 18, 30]) add(toWorld(FRAME.rumi, 0, z)); } continue; }
    const a = polyAt(MAIN, s); pts.push(a[0], a[1]);
  }
  add(toWorld(FRAME.chota, 0, -9)); add(toWorld(FRAME.chota, 0, 14));
  PROC.route = polyline(pts); PROC.len = PROC.route.len;
  const near = (x, z) => { let best = 0, bd = 1e9; for (let d = 0; d < PROC.len; d += 1) { const a = polyAt(PROC.route, d, _ra), q = Math.hypot(a[0] - x, a[1] - z); if (q < bd) { bd = q; best = d; } } return best; };
  PROC.pinch = [[near(FRAME.gateE.x, FRAME.gateE.z), 10, 3.0], [near(FRAME.rumi.x, FRAME.rumi.z), 13, 2.1], [near(...toWorld(FRAME.bara, 0, 0)), 6, 2.6], [near(...toWorld(FRAME.chota, 0, 0)), 6, 2.6]];
  // the order of march, from the head
  const P = PROC.pool, U = [
    { rows: 2, cols: 3, gap: 1.7, dress: 'royal' }, { rows: 2, cols: 3, gap: 1.4, dress: 'white', pose: 'play' },
    { prop: 'elephant', len: 6.5 }, { prop: 'camel', len: 4.6 }, { prop: 'camel', len: 4.6 }, { prop: 'camel', len: 4.6 },
    { rows: 6, cols: 4, gap: 1.1, dress: 'kid', pose: 'hold', kid: true, flag: true }, { rows: 3, cols: 4, gap: 1.4, dress: 'band', pose: 'play' },
    { rows: 6, cols: 5, gap: 2.8, dress: 'black', pose: 'matam', alam: true }, { rows: 3, cols: 5, gap: 1.2, dress: 'black' },
    { prop: 'duldul', len: 4.2 }, { prop: 'jhula', len: 4 }, { prop: 'mom', len: 5.5 }, { prop: 'abraq', len: 5.5 }, { prop: 'zari', len: 6.5 },
    { rows: 18, cols: 6, gap: 1.15, dress: 'black', pose: 'matam', banner: true }, { rows: 18, cols: 6, gap: 1.15, dress: 'black', pose: 'matam', banner: true },
    { rows: 16, cols: 6, gap: 1.15, dress: 'black', pose: 'matam', banner: true },
  ];
  const geos = { elephant: elephantGeo(), camel: camelGeo(), duldul: duldulGeo(), jhula: jhulaGeo() }, vmat = festMat({ vertexColors: true, roughness: 0.8 });
  const alamGeos = [0x1d7a46, 0x121212, 0x8b1a1a].map(alamGeo), flagGeo = (() => { const p = painter(); p.cyl(0.012, 0.012, 1.0, 0, 0.5, 0, 0x8a6a48, 'y', 5); p.box(0.02, 0.32, 0.5, 0, 0.82, 0.25, 0xffffff); return p.done(); })();
  const bannerTx = bannerTex('یا حسینؑ', 'YA HUSSAIN', '#0d0d0f', '#f4f1ea', '#1d7a46');
  let ds = 0, beat = 0;
  for (const u of U) {
    if (u.prop) {
      const mid = ds + u.len / 2;
      const obj = u.prop === 'mom' || u.prop === 'abraq' || u.prop === 'zari' ? zariMesh(u.prop) : new THREE.Mesh(geos[u.prop], vmat);
      obj.visible = false; obj.castShadow = true; scene.add(obj); PROC.props.push({ obj, ds: mid, lat: 0, kind: u.prop });
      const bearers = u.prop === 'jhula' ? [[-0.55, -1.3], [0.55, -1.3], [-0.55, 1.3], [0.55, 1.3]] : u.prop === 'mom' || u.prop === 'abraq' ? [[-1.05, -1.6], [1.05, -1.6], [-1.05, 0], [1.05, 0], [-1.05, 1.6], [1.05, 1.6]] : u.prop === 'zari' ? [[-2.1, -1.5], [2.1, -1.5], [-2.1, 0.5], [2.1, 0.5], [-1.1, 3.0], [1.1, 3.0], [0, 3.4]] : u.prop === 'duldul' ? [[-0.9, 1.2]] : u.prop === 'elephant' ? [[-1.9, 1.5]] : [[-0.9, 1.1]];
      for (const [lat, dz] of bearers) { const f = addFig(P, { dress: 'black', pose: u.prop === 'jhula' || u.prop === 'mom' || u.prop === 'abraq' ? 'carry' : 'walk', ds: mid - dz, lat0: lat, half: 2.2 }); if (f) PROC.figs.push(f); }
      ds += u.len + 2.5; continue;
    }
    const half = (u.cols - 1) * 1.35 / 2; beat = hsh(ds, 9);
    for (let r = 0; r < u.rows; r++) for (let c = 0; c < u.cols; c++) {
      const centre = u.alam && c === (u.cols - 1) / 2, flagger = u.banner && r === 0 && (c === 0 || c === u.cols - 1);
      const f = addFig(P, { dress: u.dress, kid: u.kid, pose: centre || flagger ? 'hold' : u.pose || 'walk', ds: ds + r * u.gap, lat0: (c - (u.cols - 1) / 2) * 1.35, half: Math.max(half, 0.1), beat: beat + hsh(r * 31 + c, 6) * 0.06 });
      if (!f) continue; PROC.figs.push(f);
      if (centre) PROC.att.push({ f, geo: alamGeos[r % 3], kind: 'alam' });
      if (u.flag) PROC.att.push({ f, geo: flagGeo, kind: 'flag', col: [0x121212, 0x1d7a46, 0x9c1c2a][(r + c) % 3] });
    }
    if (u.banner) {                       // the anjuman's banner, carried at the front by two men
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), festMat({ map: bannerTx, side: THREE.DoubleSide, roughness: 0.9 }));
      m.visible = false; scene.add(m); PROC.props.push({ obj: m, ds, lat: 0, y: 2.25, flat: true });
    }
    ds += (u.rows - 1) * u.gap + 3;
  }
  PROC.colLen = ds;
  // gas lamps carried on the head down both sides of the column
  const lampsAt = [];
  for (let d = 4; d < ds; d += 21) for (const side of [-1, 1]) { const f = addFig(P, { dress: 'black', pose: 'lamp', ds: d + (side > 0 ? 9 : 0), lat0: side * 4.6, half: 4.6, edge: true }); if (f) { PROC.figs.push(f); lampsAt.push(f); } }
  const lg = new THREE.CylinderGeometry(0.11, 0.09, 0.26, 8).translate(0, 0.13, 0), lm = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
  PROC.lamps = new THREE.InstancedMesh(lg, lm, lampsAt.length); PROC.lamps.frustumCulled = false; PROC.lamps.visible = false; scene.add(PROC.lamps); PROC.lampFigs = lampsAt;
  PROC.halo = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lampsAt.length * 3), 3)), new THREE.PointsMaterial({ map: glowTex, size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b0, opacity: 0.8 }));
  PROC.halo.frustumCulled = false; PROC.halo.visible = false; scene.add(PROC.halo);
  // alams and children's flags as instanced meshes, one per geometry
  const byGeo = new Map(); for (const a of PROC.att) { if (!byGeo.has(a.geo)) byGeo.set(a.geo, []); byGeo.get(a.geo).push(a); }
  PROC.attMeshes = [...byGeo].map(([geo, list]) => { const m = new THREE.InstancedMesh(geo, festMat({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), list.length); m.frustumCulled = false; m.castShadow = true; m.visible = false; list.forEach((a, i) => { a.mi = i; if (a.col) m.setColorAt(i, _c.set(a.col)); }); scene.add(m); return { m, list }; });
  poolDirty(P, true);
}
function pinchAt(d) { let hw = 4.6; for (const [pd, r, w] of PROC.pinch) if (Math.abs(d - pd) < r) hw = Math.min(hw, w); return hw; }
const _fo3 = new THREE.Object3D(), _fpp = { x: 0, z: 0, yaw: 0 };
function updateProcession(h, dt, t) {
  const P = PROC.pool, on = processionOn(h), hd = headDist(h), mv = headMoving(h);
  TR.blockers.length = 0;
  if (!on) { if (PROC.shown) { hideProcession(); poolDirty(P); } return; }
  PROC.shown = true;
  const place = (d, lat, out) => { const a = polyAt(PROC.route, d, _ra); out.x = a[0] + a[3] * lat; out.z = a[1] - a[2] * lat; out.yaw = Math.atan2(a[2], a[3]); return out; };
  for (const f of PROC.figs) {
    const d = hd - f.ds;
    if (d < 0 || d > PROC.len) { if (f.vis) { hideFig(P, f); f.vis = false; } continue; }
    f.vis = true;
    const hw = pinchAt(d), lat = Math.abs(f.lat0) > 0.01 ? f.lat0 * Math.min(1, hw / Math.max(f.half, hw)) : 0;
    place(d, f.edge ? Math.sign(f.lat0) * Math.min(Math.abs(f.lat0), hw) : lat, f);
    if (mv) f.ph += dt * 2.6;
    poseFig(P, f, t, mv);
    if ((f.i & 3) === 0) TR.blockers.push(f.x, f.z);
  }
  for (const p of PROC.props) {
    const d = hd - p.ds, vis = d >= 0 && d <= PROC.len; p.obj.visible = vis; if (!vis) continue;
    place(d, p.lat, _fpp);
    p.obj.position.set(_fpp.x, (p.y || 0) + (p.flat ? 0 : mv ? Math.abs(Math.sin(t * 2.2)) * 0.02 : 0), _fpp.z); p.obj.rotation.set(0, _fpp.yaw, 0);
    TR.blockers.push(p.obj.position.x, p.obj.position.z);
  }
  for (const { m, list } of PROC.attMeshes) {
    m.visible = true;
    for (const a of list) {
      const f = a.f; if (!f.vis) { _fo3.position.set(0, -500, 0); _fo3.scale.setScalar(0.001); _fo3.updateMatrix(); m.setMatrixAt(a.mi, _fo3.matrix); continue; }
      const s = f.sc, cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), hx = (a.kind === 'alam' ? 0.12 : 0.28) * s, up = (a.kind === 'alam' ? 0.95 : 1.75) * s;
      _fo3.position.set(f.x + cy * hx + sy * 0.2 * s, up, f.z - sy * hx + cy * 0.2 * s); _fo3.rotation.set(0, f.yaw, Math.sin(t * 1.3 + f.ph) * 0.04); _fo3.scale.setScalar(1); _fo3.updateMatrix(); m.setMatrixAt(a.mi, _fo3.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }
  const lit = TIME.lamps > 0.05, hp = PROC.halo.geometry.attributes.position;
  PROC.lamps.visible = true; PROC.halo.visible = lit;
  PROC.lampFigs.forEach((f, i) => {
    if (!f.vis) { _fo3.position.set(0, -500, 0); _fo3.updateMatrix(); PROC.lamps.setMatrixAt(i, _fo3.matrix); hp.setXYZ(i, 0, -500, 0); return; }
    _fo3.position.set(f.x, 1.74 * f.sc, f.z); _fo3.rotation.set(0, 0, 0); _fo3.scale.setScalar(1); _fo3.updateMatrix(); PROC.lamps.setMatrixAt(i, _fo3.matrix); hp.setXYZ(i, f.x, 1.95 * f.sc, f.z);
  });
  PROC.lamps.instanceMatrix.needsUpdate = true; hp.needsUpdate = true;
  poolDirty(P);
  // a vehicle caught inside the column (the clock jumped into the procession) leaves at once
  const B = TR.blockers;
  for (const v of LIFE.vehicles) {
    if (!v.on || !v.L || !v.L.closed) continue;
    for (let i = 0; i < B.length; i += 16) if (Math.abs(B[i] - v.x) < 6 && Math.abs(B[i + 1] - v.z) < 6) { vehicleOff(v); break; }
  }
}
function poseStaff(t, on) {
  if (!PROC.pool) return;
  for (const f of PROC.staff) { if (on) { f.vis = true; poseFig(PROC.pool, f, t, false); } else if (f.vis) { hideFig(PROC.pool, f); f.vis = false; } }
}

/* ───────────── Eid: the congregation at the Asfi Mosque ───────────── */
const PRAY = { poses: {}, n: 0, mats: null, held: false };
function prayerGeo(pose) {               // about a hundred triangles each: two thousand of them share the platform
  const p = painter(), K = 0xffffff, T = 0xe7e3da, S = 0xc68642, C = 0xffffff;
  const head = (y, z) => p.geo(new THREE.SphereGeometry(0.118, 6, 4).translate(0, y, z), S);
  const cap = (y, z, axis) => p.cyl(0.112, 0.12, 0.1, 0, y, z, C, axis, 5);
  if (pose === 'qiyam') {
    p.box(0.34, 0.6, 0.18, 0, 0.3, 0, T); p.box(0.46, 0.92, 0.27, 0, 1.02, 0, K);
    for (const x of [-0.27, 0.27]) p.box(0.11, 0.58, 0.12, x, 1.13, 0.05, K);
    head(1.58, 0); cap(1.68, -0.01, 'y');
  } else if (pose === 'ruku') {
    p.box(0.34, 0.6, 0.18, 0, 0.3, 0, T); p.box(0.46, 0.4, 0.27, 0, 0.78, 0, K); p.box(0.46, 0.27, 0.62, 0, 1.0, 0.3, K);
    for (const x of [-0.25, 0.25]) p.box(0.11, 0.55, 0.12, x, 0.74, 0.42, K, 0, -0.25);
    head(1.02, 0.7); cap(1.03, 0.8, 'z');
  } else if (pose === 'sujud') {
    p.box(0.34, 0.14, 0.5, 0, 0.07, -0.2, T); p.box(0.34, 0.5, 0.18, 0, 0.33, 0.02, K, 0, 0.35);
    p.box(0.46, 0.27, 0.62, 0, 0.42, 0.42, K, 0, 0.5); for (const x of [-0.25, 0.25]) p.box(0.11, 0.08, 0.42, x, 0.05, 0.72, K);
    head(0.15, 0.82); cap(0.16, 0.93, 'z');
  } else {                                // jalsa: sitting back on the heels
    p.box(0.34, 0.14, 0.5, 0, 0.07, -0.08, T); p.box(0.34, 0.17, 0.46, 0, 0.24, 0.14, K);
    p.box(0.46, 0.6, 0.27, 0, 0.62, 0, K); for (const x of [-0.26, 0.26]) p.box(0.11, 0.42, 0.12, x, 0.5, 0.16, K, 0, -0.55);
    head(1.06, 0); cap(1.16, -0.01, 'y');
  }
  return p.done();
}
function ensureEid() {
  if (FEST.built.eid) return; FEST.built.eid = true;
  const g = FEST.groups.eid = new THREE.Group(); scene.add(g);
  const tex = bannerTex('عید مبارک', 'EID MUBARAK', '#14532d', '#ffffff', '#d4a63a'), mat = festMat({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
  const banner = (f, x, y, z, w, back) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.1875), mat); const [wx, wz] = toWorld(f, x, z); m.position.set(wx, y, wz); m.rotation.y = f.rot + (back ? Math.PI : 0); g.add(m); };
  banner(FRAME.bara, 0, 10.8, -1.08, 9, true); banner(FRAME.chota, 0, 10.6, -3.08, 8, true); for (const G of [FRAME.gateE, FRAME.gateW]) { banner(G, 0, 12.7, 2.58, 6.4, false); banner(G, 0, 12.7, -2.58, 6.4, true); }
  // rows on the mosque's platform, facing the mosque (and so the qibla), front rows first
  const F = FRAME.asfi, spots = [], mats = painter();
  for (let z = 10.5, r = 0; z <= 41; z += 1.42, r++) {
    for (let x = -38; x <= 38; x += 0.84) spots.push([x + (hsh(spots.length, 1) - 0.5) * 0.12, z + (hsh(spots.length, 2) - 0.5) * 0.1]);
    const [mx, mz] = toWorld(F, 0, z + 0.25); mats.box(77.5, 0.02, 1.2, mx, 3.035, mz, [0x9c1c2a, 0x1d6b3a, 0xe9e2d0][r % 3], F.rot);
  }
  PRAY.mats = new THREE.Mesh(mats.done(), festMat({ vertexColors: true, roughness: 1 })); PRAY.mats.receiveShadow = true; PRAY.mats.visible = false; g.add(PRAY.mats);
  PRAY.n = spots.length;
  const vmat = festMat({ vertexColors: true, roughness: 0.85 }), o = new THREE.Object3D(), tints = [0xffffff, 0xffffff, 0xfbf6ea, 0xf3efe6, 0xe5eef3, 0xe8f0e2, 0xdedede, 0xf6ead6, 0xffffff, 0xf3efe6, 0xe9e2f0, 0xfbf6ea, 0x3a3a42, 0xffffff, 0xece6d8, 0xe5eef3, 0x6b5a48, 0xffffff];
  for (const pose of ['qiyam', 'ruku', 'sujud', 'jalsa']) {
    const m = new THREE.InstancedMesh(prayerGeo(pose), vmat, spots.length);
    spots.forEach(([lx, lz], i) => { const [x, z] = toWorld(F, lx, lz); o.position.set(x, 3.02, z); o.rotation.set(0, F.rot + Math.PI + (hsh(i, 3) - 0.5) * 0.06, 0); o.scale.setScalar(0.94 + hsh(i, 4) * 0.12); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, _c.set(tints[(i * 13 + (i >> 3)) % tints.length])); });
    m.computeBoundingSphere(); m.castShadow = false; m.visible = false; m.count = 0; g.add(m); PRAY.poses[pose] = m;
  }
}
const RAKAT = [['qiyam', 3], ['ruku', 0.4], ['qiyam', 0.3], ['sujud', 0.45], ['jalsa', 0.3], ['sujud', 0.45]];   // minutes
/** who is in the rows at hour h, and in which posture: gathering, two rak'at together, the sermon, then going home */
function prayerState(h) {
  const m = (h - PRAYER_H) * 60;
  if (m < -80 || m > 75) return null;
  if (m < -2) return { n: smooth((m + 80) / 70), pose: 'jalsa' };
  if (m < 0) return { n: 1, pose: 'qiyam' };
  let t = m; for (let r = 0; r < 2; r++) for (const [pose, d] of RAKAT) { if (t < d) return { n: 1, pose }; t -= d; }
  if (m < 40) return { n: 1, pose: 'jalsa' };
  return { n: 1 - smooth((m - 40) / 35), pose: 'qiyam' };
}
function updatePrayer(h) {
  const st = FEST.f && FEST.f.prayer ? prayerState(h) : null;
  if (!!st !== PRAY.held) {                // people idling on the mosque's platform make way for the rows
    PRAY.held = !!st;
    for (const p of LIFE.people) if (p.zone && p.zone.f === FRAME.asfi) p.held = PRAY.held;
  }
  PRAY.mats.visible = !!st;
  for (const [pose, m] of Object.entries(PRAY.poses)) { const on = !!st && st.pose === pose; m.visible = on; if (on) m.count = Math.round(PRAY.n * st.n); }
}

/* ───────────── switching festivals on and off ───────────── */
function festivalLine(f) {
  const h = f.h, date = f.chosen ? '' : `${h.d} ${HIJRI_MONTHS[h.m - 1]} ${h.y} · `;
  if (f.kind === 'muharram') return f.procession ? `${f.chosen ? '1 Muharram · ' : date}Shahi Zari procession, Bara to Chota Imambara, 7 pm to midnight` : `${date}Azadari: black flags, sabeels and the Imambaras lit`;
  return `${date}${f.name}${f.prayer ? ' · prayers at the Asfi Mosque, 11 am' : ''}`;
}
function applyFestival(f) {
  FEST.f = f; FEST.kind = f ? f.kind : null; FEST.lights = !!f;
  dressPeople(FEST.kind);
  if (BUNTING.normal) BUNTING.normal.visible = FEST.kind !== 'muharram';
  if (BUNTING.muharram) BUNTING.muharram.visible = FEST.kind === 'muharram';
  if (FEST.kind === 'muharram') ensureMuharram();
  if (f && f.procession) ensureProcession();
  if (FEST.kind === 'eid') ensureEid();
  if (FEST.groups.muharram) FEST.groups.muharram.visible = FEST.kind === 'muharram';
  if (FEST.groups.eid) FEST.groups.eid.visible = FEST.kind === 'eid';
  if (PROC.pool) { poolShow(PROC.pool, FEST.kind === 'muharram'); poseStaff(UI.T || 0, FEST.kind === 'muharram'); if (!(f && f.procession) && PROC.shown) hideProcession(); poolDirty(PROC.pool); }
  if (PRAY.mats && !(f && f.prayer)) updatePrayer(TIME.hour);
  const box = document.getElementById('festival'), go = document.getElementById('festGo');
  if (box) {
    box.hidden = !f;
    if (f) { document.getElementById('festText').textContent = festivalLine(f); go.hidden = !(f.procession || f.prayer); go.textContent = f.procession ? 'Go to the procession' : 'Go to the Asfi Mosque'; }
  }
}
function hideProcession() { const P = PROC.pool; PROC.shown = false; for (const f of PROC.figs) if (f.vis) { hideFig(P, f); f.vis = false; } for (const p of PROC.props) p.obj.visible = false; for (const a of PROC.attMeshes || []) a.m.visible = false; if (PROC.lamps) PROC.lamps.visible = PROC.halo.visible = false; TR.blockers.length = 0; }
function festivalGo() {
  const f = FEST.f; if (!f) return;
  let at, look;
  if (f.procession) {
    const zari = PROC.props.find(p => p.kind === 'zari');
    if (!processionOn(TIME.hour) || headDist(TIME.hour) < 80) setTime('fixed', 20.25);
    const a = polyAt(PROC.route, clamp(headDist(TIME.hour) - (zari ? zari.ds : 0), 30, PROC.len - 30), _ra);
    look = new THREE.Vector3(a[0], 3, a[1]); at = new THREE.Vector3(a[0] - a[2] * 22 + a[3] * 16, 12, a[1] - a[3] * 22 - a[2] * 16);
  } else {
    if (Math.abs(TIME.hour - PRAYER_H) > 1) setTime('fixed', PRAYER_H + 0.05);
    const [x, z] = toWorld(FRAME.asfi, 0, 78), [tx, tz] = toWorld(FRAME.asfi, 0, 22); at = new THREE.Vector3(x, 26, z); look = new THREE.Vector3(tx, 4, tz);
  }
  UI.anchor = null; moveCamera(at, look, 2.5);
}
function buildFestival() {
  festBusy = (kind, h, v) => {
    const f = FEST.f; if (!f) return v;
    if (kind === 'crowd') return Math.min(1, v * (f.kind === 'eid' ? (h > 7.5 && h < 23.5 ? 1.6 : 1) : h > 17 ? (f.procession ? 1.7 : 1.3) : 1.05));
    if (kind === 'traffic' && TR.closedOn) return v * 0.75;
    return v;
  };
  const go = document.getElementById('festGo'); if (go) go.onclick = festivalGo;
  UPDATERS.push((dt, t) => {
    const key = (OPT.festival || 'auto') + ':' + TIME.day;
    if (key !== FEST.key) { FEST.key = key; applyFestival(festivalFor(TIME.day)); }
    const f = FEST.f;
    if (f && f.procession && PROC.pool) { updateProcession(TIME.hour, dt, t); setRoadClosed(TIME.hour > PROC_H0 - 0.5 && processionOn(TIME.hour)); }
    else if (TR.closedOn) setRoadClosed(false);
    if (f && f.kind === 'muharram' && PROC.pool && (UI.frame % 3 === 0 || PROC.shown)) { poseStaff(t, true); poolDirty(PROC.pool); }
    if (PRAY.mats) updatePrayer(TIME.hour);
  });
}
