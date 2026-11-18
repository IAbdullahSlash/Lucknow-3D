'use strict';
/* core.js — renderer, scene, options, textures, materials and the geometry helpers every other file builds on.
   World frame: x = east, z = south, y = up, metres. Origin = Husainabad Clock Tower. */

const { OrbitControls, CSS2DRenderer, CSS2DObject, mergeGeometries } = window.ADDONS;
const MAP = window.MAPDATA;
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;

/* ───────────── user options (persisted) ───────────── */
const OPT = {
  quality: 'medium', shadows: true, labels: 'hi', shopTags: true, minimap: true, weather: 'haze',
  festive: false, sound: false, volume: 0.6, walkSpeed: 1,
};
let _saved = {}; try { _saved = JSON.parse(localStorage.getItem('hussainabad-options') || '{}'); } catch (e) { /* private mode */ } Object.assign(OPT, _saved);
for (const k of ['traffic', 'crowd', 'carriages', 'kites', 'birds', 'fov', 'cycleMin', 'lookSens']) delete OPT[k];   // settings that were retired
// a phone with little memory or few cores starts light; whatever the user picks afterwards is kept
if (!_saved.quality && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820 && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4)) OPT.quality = 'low';
const BENCHMARK = window.LUCKNOW_BENCHMARK;
if (BENCHMARK) Object.assign(OPT, { quality: BENCHMARK.quality, shadows: true, sound: false, weather: 'clear', festive: false, minimap: true, labels: 'en', shopTags: true, walkSpeed: 1 });
const FOV = 42;
function saveOptions() { if (!BENCHMARK) try { localStorage.setItem('hussainabad-options', JSON.stringify(OPT)); } catch (e) { /* ignore */ } }
const QUALITY = {
  low: { pr: 1, shadow: 0, people: 0.45, cars: 0.6, houses: 0.7 },
  medium: { pr: 1.25, shadow: 2048, people: 0.8, cars: 0.85, houses: 1 },
  high: { pr: 2, shadow: 4096, people: 1, cars: 1, houses: 1 },
};
const Q = QUALITY[OPT.quality] || QUALITY.medium;

/* ───────────── renderer / scene ───────────── */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  throw new Error('WebGL is unavailable in this browser. You can still read the itinerary or open the 2D map.');
}
renderer.domElement.addEventListener('webglcontextlost', () => {
  window.dispatchEvent(new CustomEvent('scene-unavailable', { detail: new Error('The browser lost its connection to 3D rendering.') }));
});
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !!Q.shadow && OPT.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('stage').append(renderer.domElement);
const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
labelRenderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe4f5, 500, 1700);
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 2, 9000);
camera.position.set(420, 380, 620);

const hemi = new THREE.HemisphereLight(0xcfe4f5, 0x8a7a60, 1);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow || 512, Q.shadow || 512);
Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 1900 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(hemi, sun, sun.target);

/* ───────────── random ───────────── */
function seededRandom(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
const rnd = seededRandom(1881);
const rr = (a, b) => a + (b - a) * rnd();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ───────────── local frames (true orientations taken from the map) ───────────── */
const FRAME = {
  park: { x: 0, z: 0, rot: -0.4534 },                 // tower, talab, gallery share the road's 26° skew
  chota: { x: -327.5, z: -37.1, rot: -0.4556 },       // origin = main gate, +z runs into the complex
  bara: { x: 547.5, z: 357, rot: -0.314 },            // origin = outer gate, +z runs into the complex
  rumi: { x: 413.5, z: 307.5, rot: -1.8755 },         // wall along local x, grand arch faces +z (west-north-west)
  asfi: { x: 398.5, z: 497, rot: 1.713 },             // Asfi mosque, front (+z) faces east
  jama: { x: -700, z: 121, rot: Math.PI / 2 },        // Jama Masjid, front faces east
  food: { x: 190, z: 80, rot: 0.231 },                 // +z runs along Durgadevi Marg
  gateE: { x: -246, z: -22, rot: 1.134 },             // Husainabad gateways straddle the road
  gateW: { x: -384, z: -88, rot: 1.134 },
};
function frameGroup(f) { const g = new THREE.Group(); g.position.set(f.x, 0, f.z); g.rotation.y = f.rot; return g; }
function toWorld(f, lx, lz) { const c = Math.cos(f.rot), s = Math.sin(f.rot); return [f.x + c * lx + s * lz, f.z - s * lx + c * lz]; }
function toLocal(f, x, z) { const c = Math.cos(f.rot), s = Math.sin(f.rot), dx = x - f.x, dz = z - f.z; return [c * dx - s * dz, s * dx + c * dz]; }

/* the sunken stepped tank (talab), described once so the ground hole, the steps and walking all agree */
const TALAB = { cx: -85.7, cz: 1.7, a: 33.5, b: 37, c: 11.5, tread: 0.62, rise: 0.42, n: 13 };
function octPts(a, b, c) { return [[-a + c, -b], [a - c, -b], [a, -b + c], [a, b - c], [a - c, b], [-a + c, b], [-a, b - c], [-a, -b + c]]; }
function talabOct(inset) { return octPts(TALAB.a - inset, TALAB.b - inset, Math.max(0.4, TALAB.c - inset * 0.586)); }
function talabDepthAt(wx, wz) {            // null = outside the pit, -99 = water, otherwise floor height
  const l = toLocal(FRAME.park, wx, wz), u = Math.abs(l[0] - TALAB.cx), v = Math.abs(l[1] - TALAB.cz);
  const d = Math.min(TALAB.a - u, TALAB.b - v, (TALAB.a + TALAB.b - TALAB.c - u - v) / Math.SQRT2);
  if (d < 0) return null;
  const lvl = Math.floor(d / TALAB.tread) + 1;
  return lvl > TALAB.n ? -99 : -lvl * TALAB.rise;
}

/* ───────────── 2D helpers ───────────── */
function pointInPoly(x, z, p) {            // p = flat [x,z,...]
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function featureContains(x, z, feature) {
  return pointInPoly(x, z, feature.p) && !feature.holes?.some(hole => pointInPoly(x, z, hole));
}
function isTalabWater(feature) {
  const [x, z] = toWorld(FRAME.park, TALAB.cx, TALAB.cz);
  return feature.k === 'basin' && featureContains(x, z, feature);
}
function polyBounds(p) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); c = Math.min(c, p[i + 1]); d = Math.max(d, p[i + 1]); } return [a, b, c, d]; }
function polyCentroid(p) { let x = 0, z = 0; for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; } return [x / (p.length / 2), z / (p.length / 2)]; }
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
function polyline(flat) {                  // cumulative lengths for arc-length sampling
  const cum = [0]; for (let i = 2; i < flat.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]));
  return { p: flat, cum, len: cum[cum.length - 1] };
}
const _pa = [0, 0, 1, 0];
function polyAt(pl, d, out = _pa) {        // → [x, z, tx, tz] at distance d
  const c = pl.cum, p = pl.p; d = clamp(d, 0, pl.len);
  let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
  const seg = c[hi] - c[lo] || 1, t = (d - c[lo]) / seg, i = lo * 2, dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l = Math.hypot(dx, dz) || 1;
  out[0] = p[i] + dx * t; out[1] = p[i + 1] + dz * t; out[2] = dx / l; out[3] = dz / l; return out;
}

/* ───────────── canvas textures ───────────── */
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
function canvasTex(w, h, draw, sizeX = 1, sizeY = sizeX) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (sizeX) t.repeat.set(1 / sizeX, 1 / sizeY);
  return t;
}
const tr = BENCHMARK ? seededRandom(903) : Math.random;
function blotches(x, w, h, n, cols, s0, s1, a) {
  for (let i = 0; i < n; i++) { x.globalAlpha = a * (0.4 + tr() * 0.6); x.fillStyle = cols[(tr() * cols.length) | 0]; const s = s0 + tr() * (s1 - s0); x.beginPath(); x.ellipse(tr() * w, tr() * h, s, s * (0.5 + tr()), tr() * 3, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
}
function streaks(x, w, h, n, col, a) {
  for (let i = 0; i < n; i++) { const sx = tr() * w, len = h * (0.2 + tr() * 0.7), g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a * tr(); x.fillStyle = g; x.fillRect(sx, 0, 2 + tr() * 7, len); }
  x.globalAlpha = 1;
}
const TEX = {
  plaster: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h); blotches(x, w, h, 260, ['#d8d2c6', '#fff', '#c9c2b4', '#e8e2d6'], 4, 26, 0.22); streaks(x, w, h, 26, 'rgba(70,62,54,.9)', 0.16); blotches(x, w, h, 500, ['#8a8176', '#fff'], 0.4, 1.3, 0.25); }, 5),
  weathered: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e6e0d4'; x.fillRect(0, 0, w, h); blotches(x, w, h, 300, ['#b5ac9e', '#fff', '#9a9184', '#d2cabc'], 4, 30, 0.22); streaks(x, w, h, 48, 'rgba(40,36,32,.95)', 0.24); blotches(x, w, h, 40, ['#5d6b4a', '#474035'], 2, 8, 0.16); blotches(x, w, h, 700, ['#6c6359', '#fff'], 0.4, 1.4, 0.3); }, 5),
  brick: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b29a86'; x.fillRect(0, 0, w, h);
    const bw = 32, bh = 256 / 24;
    for (let r = 0; r < 24; r++) for (let c = -1; c < 9; c++) { const v = 0.82 + tr() * 0.3; x.fillStyle = `rgb(${(150 * v) | 0},${(66 * v) | 0},${(46 * v) | 0})`; x.fillRect(c * bw + (r % 2 ? bw / 2 : 0) + 0.8, r * bh + 0.8, bw - 1.6, bh - 1.6); }
    blotches(x, w, h, 40, ['#3a241c', '#d8b9a0'], 6, 22, 0.12);
  }, 1.92),
  cobble: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#4f4840'; x.fillRect(0, 0, w, h);
    const sw = 256 / 14, sh = 256 / 11;
    for (let r = 0; r < 11; r++) for (let c = -1; c < 15; c++) { const v = 0.78 + tr() * 0.4, k = tr(); x.fillStyle = `rgb(${(128 * v + k * 14) | 0},${(116 * v + k * 4) | 0},${(104 * v) | 0})`; x.beginPath(); x.roundRect(c * sw + (r % 2 ? sw / 2 : 0) + 1, r * sh + 1, sw - 2, sh - 2, 3); x.fill(); }
    blotches(x, w, h, 30, ['#2f2a25', '#b7aa98'], 8, 30, 0.1);
  }, 2.6),
  herring: canvasTex(256, 256, (x, w, h) => {      // "fish-tail" sandstone flooring of the clock-tower compound
    x.fillStyle = '#b98c78'; x.fillRect(0, 0, w, h);
    const cols = ['#c9957f', '#b3a39a', '#d0a18c', '#ab9d95', '#c08d79'];
    for (let b = -2; b < 18; b++) { x.fillStyle = cols[((b % 5) + 5) % 5]; x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(i * 32, b * 16 + (i % 2 ? 16 : 0)); for (let i = 8; i >= 0; i--) x.lineTo(i * 32, b * 16 + 16 + (i % 2 ? 16 : 0)); x.fill(); }
    x.strokeStyle = 'rgba(60,45,40,.35)'; x.lineWidth = 1;
    for (let b = -2; b < 18; b++) { x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(i * 32, b * 16 + (i % 2 ? 16 : 0)); x.stroke(); }
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); }
    blotches(x, w, h, 60, ['#6d5a52', '#e6c9b8'], 5, 20, 0.12);
  }, 4.2),
  paver: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#9d7f72'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const v = 0.85 + tr() * 0.25; x.fillStyle = `rgb(${(198 * v) | 0},${(150 * v) | 0},${(132 * v) | 0})`; if ((r + c) % 2) x.fillRect(c * 16 + 1, r * 16 + 1, 14, 6), x.fillRect(c * 16 + 1, r * 16 + 9, 14, 6); else x.fillRect(c * 16 + 1, r * 16 + 1, 6, 14), x.fillRect(c * 16 + 9, r * 16 + 1, 6, 14); } }, 1.6),
  dirt: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#b5a486'; x.fillRect(0, 0, w, h); blotches(x, w, h, 240, ['#a39274', '#c6b698', '#9a8a6e', '#bfae90'], 6, 40, 0.3); blotches(x, w, h, 900, ['#7d705a', '#d8cbb0'], 0.4, 1.6, 0.4); }, 14),
  grass: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#6a9447'; x.fillRect(0, 0, w, h); blotches(x, w, h, 300, ['#5c863d', '#7ba552', '#8aa85a', '#557c38'], 5, 30, 0.35); blotches(x, w, h, 40, ['#a89a62'], 6, 22, 0.25); blotches(x, w, h, 1400, ['#4d7534', '#93b866'], 0.4, 1.4, 0.5); }, 9),
  asphalt: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#55545a'; x.fillRect(0, 0, w, h); blotches(x, w, h, 200, ['#4a494e', '#626168', '#3f3e43'], 6, 36, 0.35); blotches(x, w, h, 1500, ['#2f2e32', '#7c7a80'], 0.4, 1.2, 0.45); }, 7),
  lane: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#8f887c'; x.fillRect(0, 0, w, h); blotches(x, w, h, 220, ['#7d766b', '#a19a8e', '#6f695f'], 6, 34, 0.35); blotches(x, w, h, 1200, ['#55504a', '#b5ad9f'], 0.4, 1.3, 0.45); }, 6),
  jaali: canvasTex(128, 128, (x, w, h) => {      // pierced sandstone screen
    x.fillStyle = '#c9907c'; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'destination-out';
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) { x.beginPath(); const cx = 15 + c * 16.4 + (r % 2 ? 8.2 : 0), cy = 16 + r * 16; x.moveTo(cx, cy - 5.5); x.lineTo(cx + 5.5, cy); x.lineTo(cx, cy + 5.5); x.lineTo(cx - 5.5, cy); x.fill(); }
    x.globalCompositeOperation = 'source-over';
  }, 1.4),
  calli: canvasTex(512, 128, (x, w, h) => {      // black calligraphy panels of the Chota Imambara ("Husainabad Mubarak")
    x.fillStyle = '#131212'; x.fillRect(0, 0, w, h); x.strokeStyle = '#efe9da'; x.lineWidth = 3; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#f3eee0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '62px "Urdu Typesetting","Arabic Typesetting","Traditional Arabic","Segoe UI",serif';
    x.fillText('حسین آباد مبارک', w / 2, h / 2 + 4);
    x.lineWidth = 1.5; for (const sx of [34, w - 34]) { x.beginPath(); x.arc(sx, h / 2, 16, 0, TAU); x.stroke(); x.beginPath(); x.arc(sx, h / 2, 8, 0, TAU); x.stroke(); }
  }, 6, 1.5),
  diaper: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#93412f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#efe6d4'; x.lineWidth = 3; for (let i = -8; i < 16; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i * 16 + 128, 0); x.lineTo(i * 16, 128); x.stroke(); } x.lineWidth = 7; x.strokeRect(0, 0, w, h); }, 3.2),
  dial: canvasTex(512, 512, (x, w) => {          // the tower's dial: a twelve-petalled flower
    const c = w / 2; x.clearRect(0, 0, w, w);
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; x.beginPath(); x.arc(c + Math.sin(a) * 178, c - Math.cos(a) * 178, 62, 0, TAU); x.fillStyle = '#f6f1e3'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#b08a2e'; x.stroke(); }
    x.beginPath(); x.arc(c, c, 182, 0, TAU); x.fillStyle = '#fbf8ee'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#2b2622'; x.stroke();
    x.beginPath(); x.arc(c, c, 120, 0, TAU); x.lineWidth = 3; x.stroke();
    x.fillStyle = '#1d1a18'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 40px Georgia,serif';
    ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, k) => { const a = k * TAU / 12; x.fillText(n, c + Math.sin(a) * 150, c - Math.cos(a) * 150); });
    for (let k = 0; k < 60; k++) { const a = k * TAU / 60, r0 = k % 5 ? 112 : 104; x.beginPath(); x.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); x.lineTo(c + Math.sin(a) * 119, c - Math.cos(a) * 119); x.lineWidth = k % 5 ? 2 : 5; x.stroke(); }
  }, 0),
  shutter: canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#9aa0a3'; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#7f8588' : '#b3b8ba'; x.fillRect(0, i * 4, w, 2); } x.fillStyle = 'rgba(60,50,40,.35)'; x.fillRect(0, h - 6, w, 6); }, 2.6, 2.6),
};
TEX.dial.wrapS = TEX.dial.wrapT = THREE.ClampToEdgeWrapping;

/* ───────────── materials ───────────── */
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
const decalMat = (color, k, o = {}) => M(color, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k * 3, ...o });
const groundMat = (color, map, k, o = {}) => M(color, { map, roughness: 1, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k * 5, ...o });
const MAT = {
  brick: M(0xffffff, { map: TEX.brick }), brickD: M(0xc9c0b8, { map: TEX.brick }), brickM: M(0xe8c8b0, { map: TEX.brick }),
  cream: M(0xe2cf9e, { map: TEX.plaster }), creamD: M(0xc9b282, { map: TEX.plaster }), aged: M(0xb8a284, { map: TEX.weathered }),
  surkhi: M(0xcf987a, { map: TEX.plaster }), surkhiL: M(0xecd3b4, { map: TEX.plaster }), surkhiD: M(0xb07e62, { map: TEX.weathered }),
  white: M(0xf6f2e8, { map: TEX.plaster }), whiteD: M(0xdcd6c8, { map: TEX.plaster }), whiteW: M(0xe9e4d8, { map: TEX.weathered }),
  red: M(0x9a3a2c, { map: TEX.plaster }), redD: M(0x7b2c22, { map: TEX.weathered }),
  pink: M(0xd29a86, { map: TEX.plaster }), pinkD: M(0xb7806e, { map: TEX.weathered }), herring: M(0xffffff, { map: TEX.herring }),
  stone: M(0xb3aa9a, { map: TEX.plaster }), stoneD: M(0x8f877a, { map: TEX.weathered }), concrete: M(0xe6e1d6, { map: TEX.plaster }),
  gold: M(0xdba63f, { metalness: 0.85, roughness: 0.28 }), copper: M(0x8a5234, { metalness: 0.6, roughness: 0.45 }), tin: M(0x7f8f88, { metalness: 0.4, roughness: 0.6 }),
  black: M(0x1b1a19), iron: M(0x242b2d, { roughness: 0.55, metalness: 0.4 }), wood: M(0x5c3f29), woodL: M(0x9a7044), teal: M(0x49a79a),
  lawn: M(0xffffff, { map: TEX.grass, roughness: 1 }), hedge: M(0x3d6a33, { roughness: 1 }), soil: M(0x6b5136, { roughness: 1 }),
  glass: M(0x2a3b44, { roughness: 0.15, metalness: 0.7 }), cloth: M(0xa2231d), fabricG: M(0x2e6b4a),
  jaali: M(0xffffff, { map: TEX.jaali, alphaTest: 0.5, side: THREE.DoubleSide }),
  calli: M(0xffffff, { map: TEX.calli }), diaper: M(0xffffff, { map: TEX.diaper }), shutter: M(0xffffff, { map: TEX.shutter, metalness: 0.3, roughness: 0.6 }),
  recess: decalMat(0x33261f, 3), recessLit: decalMat(0x3d2c22, 3), door: decalMat(0x4a3323, 3), doorG: decalMat(0x2f5a49, 3),
  trim: decalMat(0xf1e7cf, 2), trimW: decalMat(0xf8f5ee, 2), stain: decalMat(0x2b6f7c, 3), stainR: decalMat(0xa83a2e, 3),
  dial: new THREE.MeshStandardMaterial({ map: TEX.dial, transparent: true, alphaTest: 0.5, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 }),
};
/* night behaviour: flood-lit monument skins, glowing windows, gilding */
const FLOOD = ['brick', 'brickD', 'cream', 'creamD', 'aged', 'surkhi', 'surkhiL', 'surkhiD', 'white', 'whiteD', 'whiteW', 'red', 'redD', 'pink', 'pinkD', 'stone'].map(k => MAT[k]);
FLOOD.forEach(m => { m.emissive.set(0xffb774); m.emissiveMap = m.map; m.emissiveIntensity = 0; });
MAT.recessLit.emissive.set(0xff9a3c); MAT.gold.emissive.set(0xffb640); MAT.dial.emissive.set(0xfff0c4); MAT.dial.emissiveMap = TEX.dial;
MAT.stain.emissive.set(0x2b9fb4); MAT.stainR.emissive.set(0xd9523f); MAT.glass.emissive.set(0xffd9a0);

/* ───────────── geometry helpers ───────────── */
function uvBox(g, w, h, d) { const uv = g.attributes.uv; for (let i = 0; i < 24; i++) { const f = i >> 2; uv.setXY(i, uv.getX(i) * (f < 2 ? d : w), uv.getY(i) * (f === 2 || f === 3 ? d : h)); } }
function _box(p, mat, w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); uvBox(g, w, h, d); const m = new THREE.Mesh(g, mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; p.add(m); return m; }
/** solid box sitting on y; blocks walkers unless opts.free */
function B(p, mat, w, h, d, x = 0, y = 0, z = 0, free = false) { const m = _box(p, mat, w, h, d, x, y, z); if (!free && Math.max(w, d) >= 0.4) m.userData.col = [w / 2, d / 2, h]; return m; }
/** platform box: its top can be walked on (plinths, steps, terraces) */
function P(p, mat, w, h, d, x = 0, y = 0, z = 0) { const m = _box(p, mat, w, h, d, x, y, z); m.userData.plat = [w / 2, d / 2, h]; return m; }
function C(p, mat, rt, rb, h, x = 0, y = 0, z = 0, seg = 16, flat = false, free = false) {
  let g = new THREE.CylinderGeometry(rt, rb, h, seg); const uv = g.attributes.uv, circ = TAU * Math.max(rt, rb);
  for (let i = 0; i < (seg + 1) * 2; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  if (flat) { g = g.toNonIndexed(); g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; p.add(m);
  const r = Math.max(rt, rb); if (!free && r >= 0.35) m.userData.col = [r * 0.92, r * 0.92, h];
  return m;
}
/** tapered square shaft (width wb at the base, wt at the top) */
function taper(p, mat, wb, wt, h, x = 0, y = 0, z = 0) { const m = C(p, mat, wt / Math.SQRT2, wb / Math.SQRT2, h, x, y, z, 4, true); m.rotation.y = Math.PI / 4; m.userData.col = [wb / 2, wb / 2, h]; m.userData.colRot = -Math.PI / 4; return m; }
function S(p, mat, r, x, y, z, sy = 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat); m.scale.y = sy; m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; }
function cone(p, mat, r, h, x, y, z, seg = 8) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; p.add(m); return m; }
function grp(p, x = 0, z = 0, rotY = 0, y = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; p.add(g); return g; }
/** invisible blocker for things that are not boxes (gate piers, railings) */
function addCol(p, x, z, hw, hd, yb, yt, rotY = 0) { const o = new THREE.Object3D(); o.position.set(x, (yb + yt) / 2, z); o.rotation.y = rotY; o.userData.col = [hw, hd, yt - yb]; p.add(o); return o; }
function addPlat(p, x, z, hw, hd, yb, yt, rotY = 0) { const o = new THREE.Object3D(); o.position.set(x, (yb + yt) / 2, z); o.rotation.y = rotY; o.userData.plat = [hw, hd, yt - yb]; p.add(o); return o; }

/* arches --------------------------------------------------------------- */
function archHead(w, h, n = 9) {            // points of a pointed Awadhi arch from left spring to right spring
  const hs = Math.max(h - w * 0.7, h * 0.35), k = hs + (h - hs) * 0.8, L = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t); L.push([-(a + b) * w / 2, a * hs + b * k + t * t * h]); }
  const pts = L.slice(); for (let i = n - 1; i >= 0; i--) pts.push([-L[i][0], L[i][1]]);
  return { pts, hs };
}
/** points of an arch head; cusps > 0 gives the scalloped multifoil outline typical of Lucknow */
function archPoints(w, h, cusps = 0) {
  const { pts, hs } = archHead(w, h, cusps || 9);
  if (!cusps) return pts;
  const out = [pts[0]], bulge = w * 0.11;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ox = mx, oy = my - hs * 0.9, l = Math.hypot(ox, oy) || 1, cx = mx + ox / l * bulge, cy = my + oy / l * bulge;
    for (const t of [0.25, 0.5, 0.75]) { const u = 1 - t; out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]); }
    out.push(b);
  }
  return out;
}
/** adds an arch outline (springing from y0) to a Shape/Path */
function archPath(s, w, h, cx = 0, y0 = 0, cusps = 0, first = true) {
  const pts = archPoints(w, h, cusps);
  if (first) s.moveTo(cx - w / 2, y0); else s.lineTo(cx - w / 2, y0);
  for (const q of pts) s.lineTo(cx + q[0], y0 + q[1]);
  s.lineTo(cx + w / 2, y0);
  return s;
}
const _shapeCache = new Map();
function archGeo(w, h, cusps) {
  const key = w.toFixed(2) + '|' + h.toFixed(2) + '|' + cusps; let g = _shapeCache.get(key);
  if (!g) { const s = archPath(new THREE.Shape(), w, h, 0, 0, cusps); s.lineTo(-w / 2, 0); g = new THREE.ShapeGeometry(s, 4); _shapeCache.set(key, g); }
  return g;
}
/** arched recess on a wall facing +z. opts: mat, trim (material for a lighter surround), cusps */
function decal(p, w, h, x, y, z, o = {}) {
  if (o.trim) { const t = new THREE.Mesh(archGeo(w * 1.22, h + w * 0.13, o.cusps || 0), o.trim); t.position.set(x, y, z + 0.07); t.receiveShadow = true; p.add(t); }
  const m = new THREE.Mesh(archGeo(w, h, o.cusps || 0), o.mat || MAT.recess); m.position.set(x, y, z + 0.13); m.receiveShadow = true; p.add(m); return m;
}
function arcade(p, n, x0, x1, y, z, h, o = {}) {
  const step = (x1 - x0) / n, fill = o.fill || 0.66;
  for (let i = 0; i < n; i++) decal(p, step * fill, h, x0 + step * (i + 0.5), y, z, o.lit && chance(o.lit) ? { ...o, mat: MAT.recessLit } : o);
}
/** arcades on the four faces of a w×d block centred at (cx,cz); nF arches on the long faces, nS on the ends */
function arcadeBox(p, cx, cz, w, d, y, h, nF, nS, o = {}) {
  [[0, w, d, nF], [Math.PI, w, d, nF], [Math.PI / 2, d, w, nS], [-Math.PI / 2, d, w, nS]].forEach(([r, ww, dd, n]) => { if (n) arcade(grp(p, cx, cz, r), n, -ww / 2, ww / 2, y, dd / 2, h, o); });
}
function rectDecal(p, mat, w, h, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); const uv = m.geometry.attributes.uv; for (let i = 0; i < 4; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); m.position.set(x, y + h / 2, z + 0.1); m.receiveShadow = true; p.add(m); return m; }

/** wall slab pierced by arched openings; faces ±z. holes = [{x,w,h,cusps}]. outline:true gives an arch-shaped silhouette */
function gateSlab(p, mat, W, H, D, holes, o = {}) {
  const s = new THREE.Shape(), z = o.z || 0;
  if (o.outline) { const { pts } = archHead(W, H, 10); s.moveTo(-W / 2, 0); pts.forEach(q => s.lineTo(q[0], q[1])); s.lineTo(W / 2, 0); }
  else { s.moveTo(-W / 2, 0); s.lineTo(-W / 2, H); s.lineTo(W / 2, H); s.lineTo(W / 2, 0); }
  const sorted = [...holes].sort((a, b) => b.x - a.x);
  for (const q of sorted) {               // walk back along the base, detouring up and round each opening
    const pts = archPoints(q.w, q.h, q.cusps || 0); s.lineTo(q.x + q.w / 2, 0);
    for (let i = pts.length - 1; i >= 0; i--) s.lineTo(q.x + pts[i][0], pts[i][1]);
    s.lineTo(q.x - q.w / 2, 0);
  }
  s.lineTo(-W / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 6 }); g.translate(0, o.y || 0, -D / 2 + z);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; p.add(m);
  if (!o.free) { let x0 = -W / 2; for (const q of [...holes].sort((a, b) => a.x - b.x)) { const x1 = q.x - q.w / 2; if (x1 - x0 > 0.3) addCol(p, (x0 + x1) / 2, z, (x1 - x0) / 2, D / 2, o.y || 0, (o.y || 0) + H); x0 = q.x + q.w / 2; } if (W / 2 - x0 > 0.3) addCol(p, (x0 + W / 2) / 2, z, (W / 2 - x0) / 2, D / 2, o.y || 0, (o.y || 0) + H); }
  return m;
}

/* domes, kiosks, minarets ------------------------------------------------ */
function domeGeo(r, hs = 1, seg = 20) {
  const pts = [], N = 18;
  for (let i = 0; i <= N; i++) { const t = i / N, a = -0.45 + t * (Math.PI / 2 + 0.45); let y = (Math.sin(a) + Math.sin(0.45)) * r * hs; if (t > 0.72) { const k = (t - 0.72) / 0.28; y += k * k * r * 0.28; } pts.push(new THREE.Vector2(Math.max(Math.cos(a) * r, 0.001), y)); }
  const g = new THREE.LatheGeometry(pts, seg), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * r, uv.getY(i) * r * 1.9);
  return g;
}
function dome(p, mat, r, x, y, z, hs = 1, fin = MAT.gold) {
  const m = new THREE.Mesh(domeGeo(r, hs), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; p.add(m);
  const top = y + (1.435 * hs + 0.28) * r;
  C(p, fin, r * 0.03, r * 0.07, r * 0.7, x, top - r * 0.06, z, 6, false, true); S(p, fin, r * 0.14, x, top + r * 0.1, z); S(p, fin, r * 0.09, x, top + r * 0.38, z); S(p, fin, r * 0.05, x, top + r * 0.6, z);
  return top + r * 0.7;
}
function chhatri(p, mat, domeMat, s, x, y, z, posts = 4) {
  B(p, mat, s * 1.1, s * 0.12, s * 1.1, x, y, z, true);
  for (let i = 0; i < posts; i++) { const a = (i + 0.5) * TAU / posts, r = s * 0.56; C(p, mat, s * 0.055, s * 0.07, s * 0.8, x + Math.cos(a) * r, y + s * 0.12, z + Math.sin(a) * r, 6, false, true); }
  C(p, mat, s * 0.74, s * 0.8, s * 0.1, x, y + s * 0.92, z, posts === 4 ? 4 : 8, true, true).rotation.y = posts === 4 ? Math.PI / 4 : Math.PI / 8;
  return dome(p, domeMat, s * 0.5, x, y + s * 1.02, z);
}
function minaret(p, mat, domeMat, h, r, x, y, z, stages = 2) {
  C(p, mat, r * 0.7, r, h, x, y, z, 8, true);
  for (let i = 1; i <= stages; i++) { const yy = y + h * i / stages; C(p, mat, r * 1.38, r * 0.95, r * 0.42, x, yy - r * 0.2, z, 8, true, true); }
  return chhatri(p, mat, domeMat, r * 1.9, x, y + h + r * 0.22, z, 8);
}
function guldastas(p, mat, x0, x1, y, z, n, s = 1, tip = mat) {
  for (let i = 0; i < n; i++) { const x = n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1); C(p, mat, 0.15 * s, 0.26 * s, 1.5 * s, x, y, z, 6, false, true); S(p, tip, 0.34 * s, x, y + 1.72 * s, z); }
}
function merlons(p, mat, x0, x1, y, z, n, w = 0.6, h = 0.8, d = 0.4) { for (let i = 0; i < n; i++) B(p, mat, w, h, d, x0 + (x1 - x0) * (i + 0.5) / n, y, z, true); }
/** straight flight of steps climbing toward −z; every tread is walkable */
function stairs(p, mat, w, n, rise, tread, x, y, z) { for (let i = 0; i < n; i++) P(p, mat, w, (n - i) * rise, tread, x, y, z + (i + 0.5) * tread - n * tread); }
/** low pierced-stone railing between two local points */
function railing(p, x0, z0, x1, z1, h = 1.05, solid = true) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), g = grp(p, (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-dz, dx));
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, h - 0.22), MAT.jaali); const uv = pl.geometry.attributes.uv; for (let i = 0; i < 4; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * (h - 0.22)); pl.position.y = (h - 0.22) / 2 + 0.1; pl.castShadow = true; g.add(pl);
  B(g, MAT.pink, len, 0.14, 0.3, 0, h - 0.14, 0, true); B(g, MAT.pink, len, 0.12, 0.26, 0, 0, 0, true);
  const n = Math.max(1, Math.round(len / 2.2)); for (let i = 0; i <= n; i++) B(g, MAT.pink, 0.26, h + 0.12, 0.3, -len / 2 + len * i / n, 0, 0, true);
  if (solid) addCol(g, 0, 0, len / 2, 0.2, 0, h);
}
/** flat polygon lying on the ground; pts = [[x,z],…] in the parent's local frame */
function flatPoly(p, mat, pts, y = 0.02) {
  const s = new THREE.Shape(); pts.forEach((q, i) => i ? s.lineTo(q[0], -q[1]) : s.moveTo(q[0], -q[1]));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; p.add(m); return m;
}
const flatRect = (p, mat, w, d, x, z, y = 0.02) => flatPoly(p, mat, [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], y);
function ringPoly(mat, outer, inner, yTop, depth) {      // extruded ring (used for the tank's stepped terraces)
  const s = new THREE.Shape(); outer.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1]));
  if (inner) { const h = new THREE.Path(); inner.forEach((q, i) => i ? h.lineTo(q[0], q[1]) : h.moveTo(q[0], q[1])); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, yTop, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}

/* ───────────── baking, colliders, walkable platforms ───────────── */
const COLLIDERS = [], PLATFORMS = [];
function _obb(o, c) {
  const e = o.matrixWorld.elements; if (Math.abs(e[1]) > 0.25 || Math.abs(e[9]) > 0.25) return null;
  let ax = e[0], az = e[2], bx = e[8], bz = e[10]; const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
  if (o.userData.colRot) { const r = o.userData.colRot, cs = Math.cos(r), sn = Math.sin(r), nx = ax * cs + bx * sn, nz = az * cs + bz * sn, mx = -ax * sn + bx * cs, mz = -az * sn + bz * cs; ax = nx; az = nz; bx = mx; bz = mz; }
  return { x: e[12], z: e[14], ax, az, bx, bz, hw: c[0] * la, hd: c[1] * lb, yb: e[13] - c[2] / 2, yt: e[13] + c[2] / 2 };
}
/** merge every mesh of a group into one mesh per material, add it to the scene, and record its blockers */
function bake(g) {
  g.updateMatrixWorld(true);
  const by = new Map();
  g.traverse(o => {
    if (o.userData.col) { const b = _obb(o, o.userData.col); if (b) COLLIDERS.push(b); }
    if (o.userData.plat) { const b = _obb(o, o.userData.plat); if (b) PLATFORMS.push(b); }
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    const key = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!by.has(key)) by.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    by.get(key).list.push(geo);
  });
  const out = [];
  for (const { mat, cast, list } of by.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); out.push(m);
    list.forEach(x => x.dispose());
  }
  return out;
}

/* vertex-coloured merged props (vehicles, carts, animals) ----------------- */
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
const propMatShiny = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 });
function painter() {
  const list = [], col = new THREE.Color();
  const paint = (g, c) => { col.set(c); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g); return g; };
  return {
    box: (w, h, d, x, y, z, c, ry = 0, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, c); },
    cyl: (rt, rb, h, x, y, z, c, axis = 'y', seg = 10) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return paint(g, c); },
    sph: (r, x, y, z, c, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 10, 7); g.scale(sx, sy, sz); g.translate(x, y, z); return paint(g, c); },
    cone: (r, h, x, y, z, c, seg = 8) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(x, y, z); return paint(g, c); },
    geo: (g, c) => paint(g, c),
    get count() { return list.length; },
    done: () => { const g = mergeGeometries(list.map(q => q.index ? q.toNonIndexed() : q)); list.length = 0; return g; },
  };
}
/** write T(p)·Ry(yaw)·T(off)·Rx(phi)·S(sx,sy,sz) straight into an instance-matrix array (no Object3D churn) */
function setLimb(arr, i, px, py, pz, cy, sy, ox, oy, oz, phi, sx, syy, sz) {
  const cp = Math.cos(phi), sp = Math.sin(phi), o = i * 16;
  arr[o] = cy * sx; arr[o + 1] = 0; arr[o + 2] = -sy * sx; arr[o + 3] = 0;
  arr[o + 4] = sy * sp * syy; arr[o + 5] = cp * syy; arr[o + 6] = cy * sp * syy; arr[o + 7] = 0;
  arr[o + 8] = sy * cp * sz; arr[o + 9] = -sp * sz; arr[o + 10] = cy * cp * sz; arr[o + 11] = 0;
  arr[o + 12] = px + cy * ox + sy * oz; arr[o + 13] = py + oy; arr[o + 14] = pz - sy * ox + cy * oz; arr[o + 15] = 1;
}
function hideInst(arr, i) { const o = i * 16; arr[o] = arr[o + 5] = arr[o + 10] = 0; arr[o + 13] = -500; }
function instanced(geo, mat, n, shadow = true) { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = false; m.frustumCulled = false; for (let i = 0; i < n; i++) hideInst(m.instanceMatrix.array, i); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; }

/* things other files register for the per-frame update and the night/weather pass */
const UPDATERS = [];      // fn(dt, t)
const NIGHTFX = [];       // fn(night 0..1)
const treeSpots = [];     // [x, z, kind, scale]
const lampSpots = [];     // [x, y, z]
const LABELS = [];        // filled by monuments.js, shown by ui.js
function radialTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = radialTex('rgba(255,240,205,1)', 'rgba(255,176,84,.45)');
function setLoad(msg) { const e = document.getElementById('loadmsg'); if (e) e.textContent = msg; }
