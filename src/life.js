'use strict';
/* life.js — traffic on the real road graph, horses and carriages, people, stray animals, street vendors, birds, kites, fountains */

const GLASS = 0x263640, GOLDC = 0xd9a63f, SKIN = [0xc68642, 0x8d5524, 0xe0ac69, 0xa9713f, 0xd9a066];
const R = BENCHMARK ? seededRandom(3821) : Math.random, rpick = a => a[(R() * a.length) | 0];
const LIFE = { player: null, vehicles: [], people: [], nVeh: 0, nPeople: 0 };

/* ───────────── instanced wheels and animal legs shared by everything that rolls or trots ───────────── */
const tyreGeo = (() => { const p = painter(); p.cyl(1, 1, 1, 0, 0, 0, 0x17171a, 'x', 14); p.cyl(0.6, 0.6, 1.06, 0, 0, 0, 0x8b9094, 'x', 10); p.box(1.1, 1.05, 0.2, 0, 0, 0, 0x4d5357); p.box(1.1, 0.2, 1.05, 0, 0, 0, 0x4d5357); return p.done(); })();
const spokeGeo = (() => { const p = painter(), t = new THREE.TorusGeometry(1, 0.075, 5, 18); t.rotateY(Math.PI / 2); p.geo(t, 0xffffff); for (let k = 0; k < 4; k++) { const b = new THREE.BoxGeometry(0.12, 1.95, 0.05); b.rotateX(k * Math.PI / 4); p.geo(b, 0xffffff); } p.cyl(0.13, 0.13, 0.5, 0, 0, 0, 0xffffff, 'x', 6); return p.done(); })();
const TYRE = instanced(tyreGeo, propMat, 1700), SPOKE = instanced(spokeGeo, M(0xffffff, { roughness: 0.6 }), 800), ALEG = instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0), M(0xffffff), 420);
let nTyre = 0, nSpoke = 0, nLeg = 0;
const _c = new THREE.Color();

/* ───────────── little figures and horses used inside vehicle models ───────────── */
const SHIRTS = [0xf2f0ea, 0xe9e4d6, 0x4f6d8f, 0x7a8b99, 0x2f4858, 0x8c2f39, 0xd9b44a, 0x3d7a5a, 0xc9d6df, 0x5b5f97, 0xb0413e, 0x222222], BRIGHT = [0xd7263d, 0xf49d37, 0x1b998b, 0x7b2d8b, 0xe85d75, 0xf2c14e, 0x2e86ab, 0xc2185b, 0x00897b, 0xff7043, 0x8e24aa, 0x43a047];
function fig(p, x, y, z, shirt, o = {}) {      // seated mini-figure; y = hip height
  p.box(0.4, 0.5, 0.24, x, y + 0.27, z, shirt); p.sph(0.115, x, y + 0.66, z, o.skin || rpick(SKIN));
  if (o.helmet) p.sph(0.14, x, y + 0.69, z - 0.01, o.helmet, 1, 0.95, 1.05); else p.sph(0.126, x, y + 0.7, z - 0.03, o.hair || 0x1a1410, 1, 0.82, 1);
  if (o.legs) { for (const s of [-0.1, 0.1]) { p.box(0.15, 0.14, 0.42, x + s, y + 0.05, z + 0.2, o.legs); p.box(0.14, 0.42, 0.14, x + s, y - 0.2, z + 0.38, o.legs); } }
}
function standing(p, x, z, shirt, legs = 0x2b2b33) { p.box(0.42, 0.56, 0.24, x, 1.14, z, shirt); p.sph(0.115, x, 1.57, z, rpick(SKIN)); p.sph(0.126, x, 1.61, z - 0.03, 0x1a1410, 1, 0.82, 1); for (const s of [-0.1, 0.1]) p.box(0.15, 0.86, 0.17, x + s, 0.43, z, legs); }
function horse(p, z0, col, deco) {
  p.sph(0.43, 0, 1.3, z0, col, 0.82, 0.92, 2.05); p.box(0.3, 0.8, 0.36, 0, 1.78, z0 + 0.82, col, 0, 0.62); p.box(0.24, 0.3, 0.64, 0, 2.16, z0 + 1.26, col, 0, 0.45);
  p.box(0.08, 0.7, 0.3, 0, 1.92, z0 + 0.66, 0x1c1410, 0, 0.62); p.box(0.1, 0.78, 0.1, 0, 1.2, z0 - 0.96, 0x1c1410, 0, -0.22);
  p.cone(0.05, 0.14, -0.08, 2.4, z0 + 1.05, col, 4); p.cone(0.05, 0.14, 0.08, 2.4, z0 + 1.05, col, 4); p.box(0.52, 0.5, 0.1, 0, 1.52, z0 + 0.6, 0x1a1a1a);
  if (deco) { p.box(0.92, 0.42, 1.0, 0, 1.42, z0 - 0.05, 0xa81c1c); p.box(0.94, 0.06, 1.02, 0, 1.2, z0 - 0.05, GOLDC); p.cone(0.07, 0.34, 0, 2.52, z0 + 1.2, 0xd62828, 5); }
}
let PARK_MODE = 0;      // 1 while building parked models
const drv = (...a) => fig(...a), pax = (...a) => { if (!PARK_MODE) fig(...a); }, rider = (...a) => { if (!PARK_MODE) fig(...a); };
const HORSE_COLS = [0x5a3a22, 0x3b2a1e, 0xd8d2c8, 0x6e4a2e, 0x2a211c, 0x8a6a48];

/* ───────────── the vehicle catalogue (forward = +z, metres) ───────────── */
const car4 = (x, z, r, w) => [[-x, z, r, w, 0], [x, z, r, w, 0], [-x, -z, r, w, 0], [x, -z, r, w, 0]];
const VDEF = {
  hatch: { name: 'Car', len: 3.7, v: 8.5, lane: 0, minW: 4.4, shiny: 1, colors: [0xf1f1f1, 0xf1f1f1, 0xbfc3c7, 0x8c1c13, 0x1d3557, 0x2b2b2b, 0xd9d2c5, 0x9aa5ad],
    make(c, p) { p.box(1.6, 0.6, 3.7, 0, 0.62, 0, c); p.box(1.44, 0.5, 1.95, 0, 1.17, -0.2, GLASS); p.box(1.46, 0.07, 1.75, 0, 1.45, -0.2, c); p.box(1.5, 0.12, 0.8, 0, 0.95, 1.25, c, 0, 0.1); p.box(1.62, 0.18, 0.14, 0, 0.4, 1.86, 0x1e1e1e); p.box(1.62, 0.18, 0.14, 0, 0.4, -1.86, 0x1e1e1e); p.box(0.5, 0.12, 0.04, 0, 0.5, 1.94, 0xf0f0f0); return { wheels: car4(0.76, 1.15, 0.3, 0.2), lights: [1.87, 0.72, 0.55] }; } },
  sedan: { name: 'Car', len: 4.3, v: 9, lane: 0, minW: 4.4, shiny: 1, colors: [0xf1f1f1, 0xc9ccd0, 0x30343a, 0x6b705c, 0x7b1e1e, 0x23395d],
    make(c, p) { p.box(1.66, 0.6, 4.3, 0, 0.62, 0, c); p.box(1.46, 0.5, 2.1, 0, 1.17, -0.2, GLASS); p.box(1.48, 0.07, 1.9, 0, 1.45, -0.2, c); p.box(1.56, 0.1, 0.95, 0, 0.95, 1.5, c, 0, 0.08); p.box(1.56, 0.1, 0.8, 0, 0.95, -1.7, c, 0, -0.06); p.box(1.68, 0.18, 0.14, 0, 0.4, 2.16, 0x1e1e1e); p.box(1.68, 0.18, 0.14, 0, 0.4, -2.16, 0x1e1e1e); return { wheels: car4(0.78, 1.38, 0.31, 0.2), lights: [2.17, 0.72, 0.58] }; } },
  suv: { name: 'SUV', len: 4.5, v: 9, lane: 0, minW: 5, shiny: 1, colors: [0xf4f4f2, 0x1f1f21, 0x4b4f52, 0x6d1f1f, 0xc8ccd0],
    make(c, p) { p.box(1.82, 0.85, 4.4, 0, 0.92, 0, c); p.box(1.68, 0.6, 2.9, 0, 1.64, -0.35, GLASS); p.box(1.72, 0.08, 3.0, 0, 1.97, -0.35, c); p.box(1.84, 0.25, 0.16, 0, 0.55, 2.22, 0x1c1c1c); p.box(1.84, 0.25, 0.16, 0, 0.55, -2.22, 0x1c1c1c); p.cyl(0.36, 0.36, 0.2, 0, 1.1, -2.32, 0x1a1a1a, 'z', 12); p.box(1.4, 0.05, 2.2, 0, 2.06, -0.4, 0x333333); return { wheels: car4(0.86, 1.4, 0.38, 0.26), lights: [2.23, 0.95, 0.62] }; } },
  auto: { name: 'Auto-rickshaw', len: 2.8, v: 7, lane: 1, minW: 3, colors: [0x2f7d32, 0x2f7d32, 0x1c1c1c],
    make(c, p) { const Y = 0xf2c200; p.box(1.3, 0.5, 1.7, 0, 0.62, -0.4, c); p.box(1.3, 0.6, 0.08, 0, 1.15, -1.22, c); p.box(0.9, 0.8, 0.55, 0, 0.78, 0.85, c); p.box(0.5, 0.3, 0.3, 0, 0.55, 1.25, c); p.box(1.0, 0.62, 0.05, 0, 1.42, 0.92, GLASS, 0, -0.15); p.box(1.36, 0.08, 2.3, 0, 1.76, -0.12, Y); p.box(1.36, 0.16, 0.06, 0, 1.66, -1.24, Y);
      for (const s of [-0.66, 0.66]) p.box(0.05, 0.55, 1.5, s, 1.45, -0.45, 0x1b1b1b); p.box(1.1, 0.12, 0.5, 0, 0.95, -0.75, 0x5a3a2a); drv(p, 0, 0.92, 0.3, rpick(SHIRTS)); if (R() < 0.8) pax(p, -0.3, 1.0, -0.75, rpick(BRIGHT)); if (R() < 0.5) pax(p, 0.3, 1.0, -0.75, rpick(SHIRTS));
      return { wheels: [[0, 1.2, 0.22, 0.14, 0], [-0.56, -0.85, 0.22, 0.16, 0], [0.56, -0.85, 0.22, 0.16, 0]], lights: [1.42, 0.78, 0] }; } },
  tempo: { name: 'Vikram tempo', len: 3.5, v: 6.4, lane: 1, minW: 4, colors: [0x1f5fa8, 0x1f5fa8, 0x2f7d32],
    make(c, p) { p.box(1.5, 0.6, 2.3, 0, 0.72, -0.5, c); p.box(1.3, 0.95, 0.7, 0, 0.9, 1.0, c); p.box(1.2, 0.6, 0.05, 0, 1.6, 1.12, GLASS, 0, -0.12); p.box(1.56, 0.08, 3.0, 0, 1.96, -0.25, 0xf2f2f2); for (const s of [-0.75, 0.75]) for (const z of [0.7, -1.6]) p.box(0.05, 0.95, 0.05, s, 1.48, z, 0x9a9a9a); for (const s of [-0.75, 0.75]) p.box(0.04, 0.3, 2.2, s, 1.15, -0.5, c);
      drv(p, 0, 1.0, 0.35, rpick(SHIRTS)); for (const [x, z] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, -1.1], [0.4, -1.1]]) if (R() < 0.7) pax(p, x, 1.05, z, rpick(R() < 0.5 ? BRIGHT : SHIRTS));
      return { wheels: [[0, 1.35, 0.26, 0.16, 0], [-0.62, -1.0, 0.26, 0.18, 0], [0.62, -1.0, 0.26, 0.18, 0]], lights: [1.36, 0.85, 0] }; } },
  erick: { name: 'E-rickshaw', len: 2.8, v: 5, lane: 1, minW: 2.6, colors: [0xc62828, 0x1565c0, 0x2e7d32, 0xef6c00, 0xf2f2f2, 0x6a1b9a, 0x00838f],
    make(c, p) { const c2 = rpick([0xf2f2f2, 0xe53935, 0x1e88e5, 0xfdd835, 0x43a047]); p.box(0.95, 0.16, 2.5, 0, 0.42, 0, 0x3a3a3a); p.box(0.9, 0.75, 0.07, 0, 0.85, 1.22, c); p.box(0.86, 0.55, 0.04, 0, 1.5, 1.2, GLASS, 0, -0.1); p.box(1.06, 0.07, 2.4, 0, 1.78, -0.05, c2);
      for (const s of [-0.48, 0.48]) for (const z of [1.15, -1.15]) p.box(0.04, 1.3, 0.04, s, 1.12, z, 0x8a8a8a); p.box(0.7, 0.1, 0.38, 0, 0.88, 0.55, 0x222222); drv(p, 0, 0.9, 0.55, rpick(SHIRTS), { legs: 0x2b2b33 });
      p.box(0.9, 0.12, 0.42, 0, 0.82, -0.35, 0xb02a2a); p.box(0.9, 0.5, 0.06, 0, 1.1, -0.58, 0xb02a2a); p.box(0.9, 0.12, 0.4, 0, 0.82, -0.95, 0xb02a2a); for (const s of [-0.5, 0.5]) p.box(0.03, 0.5, 0.9, s, 1.5, -0.55, 0x2f6fc4);
      if (R() < 0.75) pax(p, -0.22, 0.86, -0.3, rpick(BRIGHT)); if (R() < 0.55) pax(p, 0.22, 0.86, -0.3, rpick(SHIRTS)); if (R() < 0.3) pax(p, 0, 0.86, -0.95, 0x1a1a1a, { hair: 0x111111 });
      return { wheels: [[0, 1.12, 0.2, 0.1, 0], [-0.46, -0.95, 0.2, 0.12, 0], [0.46, -0.95, 0.2, 0.12, 0]], lights: [1.26, 0.75, 0] }; } },
  rick: { name: 'Cycle rickshaw', len: 2.5, v: 2.6, lane: 1, minW: 2.2, spoke: 0x4a4a4a, colors: [0x1565c0, 0xc62828, 0x00695c, 0xf9a825, 0x6a1b9a],
    make(c, p) { p.box(0.05, 0.05, 1.9, 0, 0.62, 0.1, 0x333333); p.box(1.0, 0.05, 0.05, 0, 0.36, -0.7, 0x333333); p.box(0.86, 0.14, 0.5, 0, 0.82, -0.7, 0xb02a2a); p.box(0.86, 0.45, 0.06, 0, 1.1, -0.95, c); p.box(0.9, 0.06, 0.62, 0, 1.66, -0.72, c); p.box(0.9, 0.5, 0.05, 0, 1.42, -1.02, c); p.box(0.8, 0.05, 0.4, 0, 0.5, -0.3, 0x555555);
      p.box(0.5, 0.04, 0.04, 0, 1.02, 0.75, 0x999999); p.box(0.2, 0.06, 0.28, 0, 0.98, 0.25, 0x222222); drv(p, 0, 1.0, 0.25, rpick(SHIRTS), { legs: 0x4a4a4a }); pax(p, R() < 0.5 ? -0.2 : 0, 0.9, -0.68, rpick(BRIGHT)); if (R() < 0.4) pax(p, 0.22, 0.9, -0.68, rpick(SHIRTS));
      return { wheels: [[0, 0.95, 0.34, 0.05, 1], [-0.5, -0.7, 0.34, 0.05, 1], [0.5, -0.7, 0.34, 0.05, 1]] }; } },
  bike: { name: 'Motorbike', len: 2.0, v: 9.5, lane: 0, minW: 1.8, shiny: 1, colors: [0x202020, 0xb71c1c, 0x1a237e, 0x424242, 0x0d47a1],
    make(c, p) { p.box(0.2, 0.28, 1.15, 0, 0.62, 0, 0x2a2a2a); p.box(0.3, 0.22, 0.5, 0, 0.88, 0.22, c); p.box(0.28, 0.1, 0.72, 0, 0.88, -0.35, 0x161616); p.box(0.32, 0.3, 0.4, 0, 0.45, 0.05, 0x5d6266); p.box(0.6, 0.05, 0.05, 0, 1.08, 0.55, 0x999999); p.sph(0.1, 0, 0.95, 0.72, 0xfff3c4); p.box(0.14, 0.08, 0.04, 0, 0.8, -0.74, 0xb01010); p.cyl(0.05, 0.05, 0.7, 0.2, 0.38, -0.4, 0x888888, 'z', 6);
      rider(p, 0, 0.92, -0.1, rpick(SHIRTS), { helmet: R() < 0.45 ? rpick([0x111111, 0xb71c1c, 0x1565c0]) : 0, legs: rpick([0x1f2a44, 0x2b2b33, 0x5a5346]) }); if (R() < 0.38) rider(p, 0, 0.94, -0.52, rpick(R() < 0.6 ? BRIGHT : SHIRTS), { hair: R() < 0.4 ? 0x111111 : 0x1a1410 });
      return { wheels: [[0, 0.7, 0.31, 0.12, 0], [0, -0.68, 0.31, 0.13, 0]], lights: [0.76, 0.95, 0] }; } },
  scooter: { name: 'Scooter', len: 1.8, v: 8, lane: 0, minW: 1.8, shiny: 1, colors: [0xf2f2f2, 0x9e9e9e, 0x1b1b1b, 0xb71c1c, 0x1565c0, 0x7b6d5c],
    make(c, p) { p.box(0.42, 0.45, 0.85, 0, 0.62, -0.35, c); p.box(0.4, 0.07, 0.5, 0, 0.36, 0.22, 0x333333); p.box(0.44, 0.7, 0.08, 0, 0.78, 0.52, c); p.box(0.55, 0.05, 0.05, 0, 1.12, 0.5, 0x999999); p.box(0.34, 0.08, 0.7, 0, 0.88, -0.35, 0x1b1b1b); p.sph(0.08, 0, 0.95, 0.58, 0xfff3c4);
      const lady = R() < 0.4; rider(p, 0, 0.9, -0.15, lady ? rpick([0x111111, ...BRIGHT]) : rpick(SHIRTS), { helmet: !lady && R() < 0.4 ? 0x111111 : 0, hair: 0x15100c, legs: lady ? 0x111111 : 0x2b2b33 }); if (R() < 0.3) rider(p, 0, 0.92, -0.5, rpick(BRIGHT));
      return { wheels: [[0, 0.62, 0.21, 0.12, 0], [0, -0.6, 0.21, 0.13, 0]], lights: [0.6, 0.95, 0] }; } },
  cycle: { name: 'Bicycle', len: 1.7, v: 3.6, lane: 1, minW: 1.5, spoke: 0x3a3a3a, colors: [0x2d5fa8, 0x1b1b1b, 0x8c2f39, 0x2e7d32],
    make(c, p) { p.box(0.04, 0.04, 0.95, 0, 0.72, 0.02, c, 0, 0.35); p.box(0.04, 0.04, 0.75, 0, 0.6, -0.2, c, 0, -0.5); p.box(0.04, 0.55, 0.04, 0, 0.7, 0.42, c, 0, 0.25); p.box(0.45, 0.04, 0.04, 0, 1.02, 0.42, 0x999999); p.box(0.16, 0.05, 0.26, 0, 0.98, -0.28, 0x1b1b1b); p.box(0.3, 0.3, 0.5, 0, 0.78, -0.62, 0x8a5a33);
      rider(p, 0, 0.98, -0.22, rpick(SHIRTS), { legs: 0x3a3a44 }); return { wheels: [[0, 0.55, 0.33, 0.04, 1], [0, -0.52, 0.33, 0.04, 1]] }; } },
  tonga: { name: 'Tonga', len: 5.2, v: 3.2, lane: 1, minW: 3.2, heritage: 1, spoke: 0xb3261e, colors: [0xb22222, 0x1b5e20, 0x0d47a1, 0x8e24aa],
    make(c, p) { const zc = -1.05, wd = 0x6e4526; p.box(1.3, 0.1, 1.9, 0, 1.02, zc, wd); p.box(1.3, 0.45, 0.1, 0, 1.28, zc, 0x8a5a33); p.box(1.3, 0.35, 0.06, 0, 1.2, zc + 0.95, 0x8a5a33); p.box(1.3, 0.35, 0.06, 0, 1.2, zc - 0.95, 0x8a5a33); p.box(1.46, 0.06, 2.0, 0, 2.38, zc, c); p.box(1.5, 0.14, 2.04, 0, 2.3, zc, GOLDC);
      for (const s of [-0.62, 0.62]) { for (const z of [0.9, -0.9]) p.box(0.05, 1.3, 0.05, s, 1.7, zc + z, 0x5a3a22); p.box(0.05, 0.05, 2.3, s * 0.65, 1.08, 0.75, 0x5a3a22); }
      drv(p, 0.25, 1.1, zc + 0.6, 0xf2f0ea, { legs: 0xf2f0ea, hair: 0xe8e8e8 }); if (R() < 0.8) pax(p, -0.3, 1.1, zc - 0.5, rpick(BRIGHT)); if (R() < 0.6) pax(p, 0.3, 1.1, zc - 0.5, rpick(SHIRTS)); if (R() < 0.4) pax(p, -0.28, 1.1, zc + 0.55, rpick(BRIGHT));
      const hc = rpick(HORSE_COLS); horse(p, 1.75, hc, false); return { wheels: [[-0.8, zc, 0.72, 0.07, 1], [0.8, zc, 0.72, 0.07, 1]], horse: [1.75, hc] }; } },
  baggi: { name: 'Baggi carriage', len: 5.7, v: 2.8, lane: 1, minW: 3.4, heritage: 1, spoke: 0xd9a63f, colors: [0x4a1212, 0x161616, 0x0d2b45, 0xf4f1e8],
    make(c, p) { const zc = -1.3; p.box(1.3, 0.5, 2.0, 0, 1.0, zc, c); p.box(1.34, 0.05, 2.04, 0, 1.25, zc, GOLDC); p.box(1.34, 0.05, 2.04, 0, 0.78, zc, GOLDC); p.box(1.1, 0.14, 0.45, 0, 1.3, zc - 0.55, 0xa81c1c); p.box(1.1, 0.14, 0.45, 0, 1.3, zc + 0.5, 0xa81c1c); p.box(1.1, 0.45, 0.07, 0, 1.55, zc - 0.8, 0xa81c1c); p.box(1.3, 0.45, 0.35, 0, 1.68, zc - 0.98, 0x151515);
      p.box(0.95, 0.5, 0.5, 0, 1.35, 0, c); drv(p, 0, 1.62, 0, 0xf2f0ea, { helmet: 0xc0392b, legs: 0xf2f0ea }); for (const s of [-0.62, 0.62]) { p.sph(0.09, s, 1.58, -0.32, GOLDC); for (let i = 0; i < 7; i++) p.sph(0.06, s * 1.06, 1.3 - Math.sin(i / 6 * Math.PI) * 0.12, zc - 0.9 + i * 0.3, i % 2 ? 0xf39c12 : 0xfdd835); p.box(0.05, 0.05, 2.4, s * 0.62, 1.1, 1.0, 0x2a1a12); }
      if (R() < 0.8) pax(p, -0.25, 1.36, zc - 0.5, rpick(BRIGHT)); if (R() < 0.7) pax(p, 0.25, 1.36, zc - 0.5, rpick(SHIRTS)); if (R() < 0.35) pax(p, 0, 1.36, zc + 0.45, rpick(BRIGHT));
      const hc = rpick([0xd8d2c8, 0xd8d2c8, 0x5a3a22, 0x2a211c]); horse(p, 1.95, hc, true);
      return { wheels: [[-0.66, -0.15, 0.42, 0.07, 1], [0.66, -0.15, 0.42, 0.07, 1], [-0.72, zc - 0.5, 0.6, 0.07, 1], [0.72, zc - 0.5, 0.6, 0.07, 1]], horse: [1.95, hc] }; } },
  bus: { name: 'Tourist bus', len: 10.4, v: 6.5, lane: 0, minW: 8, shiny: 1, colors: [0x2e9e4f, 0x1f6fb5, 0xe07a1f, 0xb23a2e],
    make(c, p) { p.box(2.5, 2.35, 10.2, 0, 1.78, 0, 0xf3f3f0); p.box(2.52, 0.5, 10.22, 0, 1.05, 0, c); p.box(2.52, 0.22, 10.22, 0, 1.52, 0, rpick([0x1f6fb5, 0xf2c200, 0x2e9e4f])); p.box(2.54, 0.8, 8.6, 0, 2.4, -0.3, GLASS); p.box(2.3, 1.15, 0.06, 0, 2.2, 5.1, GLASS); p.box(2.1, 0.8, 0.06, 0, 2.4, -5.1, GLASS); p.box(1.6, 0.25, 2.4, 0, 3.08, -1, 0xdcdcdc); p.box(2.52, 0.28, 0.14, 0, 0.72, 5.12, 0x222222);
      return { wheels: car4(1.12, 3.2, 0.5, 0.3), lights: [5.14, 1.0, 0.95] }; } },
  citybus: { name: 'City bus', len: 10.6, v: 6.5, lane: 0, minW: 8, shiny: 1, colors: [0xc0392b, 0xd35400],
    make(c, p) { p.box(2.5, 2.45, 10.5, 0, 1.72, 0, c); p.box(2.52, 0.3, 10.52, 0, 1.25, 0, 0xf2c200); p.box(2.54, 0.9, 9.2, 0, 2.25, -0.2, GLASS); p.box(2.3, 1.3, 0.06, 0, 2.1, 5.26, GLASS); p.box(2.1, 0.9, 0.06, 0, 2.3, -5.26, GLASS); p.box(1.4, 0.2, 0.08, 0, 2.86, 5.27, 0xffb300); p.box(2.52, 0.28, 0.14, 0, 0.65, 5.27, 0x222222);
      return { wheels: car4(1.12, 3.3, 0.5, 0.3), lights: [5.29, 0.95, 0.95] }; } },
  traveller: { name: 'Tempo traveller', len: 5.7, v: 7.5, lane: 0, minW: 6, shiny: 1, colors: [0xf2f2f2, 0xf2f2f2, 0xe6e6e6],
    make(c, p) { p.box(1.95, 1.9, 5.6, 0, 1.45, 0, c); p.box(1.97, 0.6, 4.4, 0, 1.85, -0.3, GLASS); p.box(1.8, 0.8, 0.06, 0, 1.75, 2.8, GLASS); p.box(1.97, 0.12, 5.62, 0, 1.1, 0, rpick([0xc62828, 0x1565c0, 0xef6c00])); p.box(1.97, 0.22, 0.12, 0, 0.6, 2.82, 0x222222); return { wheels: car4(0.88, 1.75, 0.36, 0.24), lights: [2.84, 0.9, 0.7] }; } },
  loader: { name: 'Mini truck', len: 3.9, v: 7, lane: 0, minW: 5, colors: [0xf2f2f2, 0xf2f2f2, 0xe9d8a6],
    make(c, p) { p.box(1.5, 1.15, 1.25, 0, 1.15, 1.25, c); p.box(1.4, 0.5, 0.06, 0, 1.45, 1.88, GLASS); p.box(1.5, 0.12, 2.4, 0, 0.72, -0.7, 0x7d7d7d); for (const s of [-0.74, 0.74]) p.box(0.05, 0.45, 2.4, s, 1.0, -0.7, c); p.box(1.5, 0.45, 0.05, 0, 1.0, -1.9, c);
      if (R() < 0.5) p.box(1.42, 0.7, 2.3, 0, 1.3, -0.7, 0x2f6fc4); else for (let i = 0; i < 6; i++) p.box(0.6, 0.45, 0.6, -0.36 + (i % 2) * 0.72, 1.02 + ((i / 4) | 0) * 0.45, -0.1 - ((i / 2) | 0) % 2 * 0.9, rpick([0x8a5a33, 0xd9b44a, 0xc0392b, 0x2e7d32]));
      return { wheels: car4(0.68, 1.2, 0.3, 0.2), lights: [1.9, 0.8, 0.55] }; } },
  thela: { name: 'Fruit cart', len: 2.6, v: 1.15, lane: 1, minW: 2.2, spoke: 0x3a3a3a, colors: [0],
    make(c, p) { p.box(1.0, 0.08, 1.6, 0, 0.82, 0.5, 0x8a5a33); for (const s of [-0.45, 0.45]) p.box(0.05, 0.14, 1.6, s, 0.9, 0.5, 0x6e4526); const fr = rpick([[0xf28c28, 0xf5a623], [0xf1c40f, 0xe2b007], [0xc0392b, 0xd35400], [0x7cb342, 0x9ccc65]]); for (let i = 0; i < 22; i++) p.sph(0.1, -0.36 + (i % 5) * 0.18, 0.96 + ((i / 15) | 0) * 0.14, -0.1 + ((i / 5) | 0) % 3 * 0.42 + (i % 2) * 0.08, fr[i % 2]);
      standing(p, 0, -0.62, rpick(SHIRTS)); return { wheels: [[-0.52, 0.95, 0.33, 0.04, 1], [0.52, 0.95, 0.33, 0.04, 1], [-0.52, 0.05, 0.33, 0.04, 1], [0.52, 0.05, 0.33, 0.04, 1]] }; } },
  horse: { name: 'Horse', len: 2.4, v: 1.6, lane: 1, minW: 2, colors: HORSE_COLS,
    make(c, p) { horse(p, 0, c, R() < 0.5); p.box(0.5, 0.1, 0.6, 0, 1.72, -0.05, 0x3a2416); return { wheels: [], horse: [0, c] }; } },
};
const _vcache = {};
function vehicleModel(type, color) {
  const key = type + color + PARK_MODE; if (_vcache[key] && R() < 0.75) return _vcache[key];
  const def = VDEF[type], p = painter(), spec = def.make(color, p), m = { geo: p.done(), wheels: spec.wheels || [], horse: spec.horse || null, lights: null };
  if (spec.lights) { const q = painter(), [fz, y, hw] = spec.lights; for (const s of hw ? [-1, 1] : [0]) { q.box(0.22, 0.14, 0.06, s * hw, y, fz + 0.02, 0xfff3c4); q.box(0.2, 0.12, 0.06, s * (hw || 0.25), y, -fz - 0.02, 0xff2a1a); } m.lights = q.done(); }
  return (_vcache[key] = m);
}
const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/* traffic itself (routes, lanes, junctions, stands) lives in traffic.js */
const _pp = [0, 0, 0, 0];
function quadLegs(i0, px, py, pz, cy, sy, zc, ph, amp, sc = 1, fat = 1) {
  const a = ALEG.instanceMatrix.array;
  for (let k = 0; k < 4; k++) { const fx = (k & 1 ? 0.2 : -0.2) * sc, fz = zc + (k < 2 ? 0.62 : -0.6) * sc, phase = ph + ((k === 0 || k === 3) ? 0 : Math.PI); setLimb(a, i0 + k, px, py, pz, cy, sy, fx, 1.04 * sc, fz, Math.sin(phase) * amp, 0.13 * sc * fat, 1.04 * sc, 0.15 * sc * fat); }
}

/* ───────────── parked vehicles, standing horses and vendor carts (all static, merged) ───────────── */
const CART = {
  chaat(p) { p.box(1.9, 0.8, 1.0, 0, 0.95, 0, 0x8a5a33); p.box(1.95, 0.06, 1.05, 0, 1.38, 0, 0xd9c9a8); p.box(1.0, 0.45, 0.7, -0.4, 1.63, 0, 0xcfe6ee); for (let i = 0; i < 4; i++) p.cyl(0.14, 0.12, 0.16, 0.25 + (i % 2) * 0.36, 1.49, -0.2 + ((i / 2) | 0) * 0.4, 0xb7bcc0); for (const x of [-0.7, 0.7]) for (const z of [-0.5, 0.5]) p.cyl(0.4, 0.4, 0.06, x, 0.4, z, 0x2b2b2b, 'x', 10); p.cyl(0.03, 0.03, 2.2, 0, 2.4, 0, 0x555555); p.cone(1.5, 0.55, 0, 3.6, 0, rpick([0xd62828, 0xf4a300, 0x1d7874, 0xe76f51]), 8); },
  fruit(p) { p.box(2.0, 0.08, 1.2, 0, 0.9, 0, 0x8a5a33); for (const x of [-0.75, 0.75]) for (const z of [-0.62, 0.62]) p.cyl(0.36, 0.36, 0.05, x, 0.36, z, 0x3a3a3a, 'x', 10); const cols = [[0xf28c28, 0xf5a623], [0xf1c40f, 0xe2b007], [0xc0392b, 0xa93226], [0x7cb342, 0x9ccc65], [0xe91e63, 0xf06292]]; for (let s = 0; s < 4; s++) { const c = rpick(cols); for (let i = 0; i < 12; i++) p.sph(0.085, -0.72 + s * 0.48 + (i % 3) * 0.13, 1.0 + ((i / 9) | 0) * 0.12, -0.3 + ((i / 3) | 0) % 3 * 0.3, c[i % 2]); } p.cyl(0.03, 0.03, 1.9, 0.9, 1.85, -0.5, 0x555555); p.box(2.2, 0.05, 1.5, 0, 2.8, 0, rpick([0x2f6fc4, 0xf2c200, 0x2e7d32])); p.cyl(0.03, 0.03, 1.9, -0.9, 1.85, -0.5, 0x555555); },
  juice(p) { p.box(1.6, 0.9, 0.9, 0, 0.95, 0, 0x1f5fa8); p.box(0.5, 0.5, 0.4, -0.3, 1.65, 0, 0x9aa0a3); p.cyl(0.28, 0.28, 0.08, -0.3, 1.7, 0.26, 0x5d6266, 'z', 10); for (let i = 0; i < 6; i++) p.cyl(0.03, 0.03, 1.9, 0.55 + i * 0.05, 1.8, -0.3, 0xb7c96a); for (const x of [-0.6, 0.6]) p.cyl(0.36, 0.36, 0.05, x, 0.36, 0.5, 0x3a3a3a, 'x', 10); for (const x of [-0.78, 0.78]) p.cyl(0.03, 0.03, 1.5, x, 2.1, -0.4, 0x555555); p.box(1.8, 0.05, 1.3, 0, 2.86, 0, 0x2e9e4f); p.box(1.8, 0.4, 0.04, 0, 2.62, 0.64, 0xc62828); },
  icecream(p) { p.box(1.2, 0.85, 0.8, 0, 0.9, 0, 0xf5f5f5); p.box(1.22, 0.14, 0.82, 0, 1.05, 0, 0xd62828); p.box(1.22, 0.1, 0.82, 0, 0.7, 0, 0x1565c0); for (const x of [-0.45, 0.45]) p.cyl(0.32, 0.32, 0.05, x, 0.32, 0.44, 0x3a3a3a, 'x', 10); p.cyl(0.03, 0.03, 1.5, 0, 2.05, 0, 0x555555); p.cone(1.1, 0.45, 0, 3.0, 0, rpick([0xf06292, 0x4fc3f7, 0xfff176]), 8); },
  corn(p) { p.box(1.1, 0.75, 0.8, 0, 0.8, 0, 0x6e4526); p.box(0.6, 0.12, 0.5, -0.15, 1.24, 0, 0x2b2b2b); for (let i = 0; i < 9; i++) p.cyl(0.05, 0.04, 0.3, 0.2 + (i % 3) * 0.11, 1.22 + ((i / 3) | 0) * 0.07, -0.2 + (i % 2) * 0.2, 0xf1c40f, 'z', 6); for (const x of [-0.42, 0.42]) p.cyl(0.3, 0.3, 0.05, x, 0.3, 0.44, 0x3a3a3a, 'x', 10); p.sph(0.07, -0.15, 1.33, 0, 0xff5722); },
  tea(p) { p.box(1.5, 0.05, 0.8, 0, 0.85, 0, 0x8a5a33); for (const x of [-0.7, 0.7]) for (const z of [-0.35, 0.35]) p.box(0.05, 0.85, 0.05, x, 0.42, z, 0x5a3a22); p.cyl(0.16, 0.2, 0.26, -0.35, 1.02, 0, 0xb7bcc0); p.cone(0.1, 0.12, -0.35, 1.2, 0, 0xb7bcc0, 8); p.box(0.4, 0.2, 0.3, 0.3, 0.98, 0, 0x2b2b2b); for (let i = 0; i < 6; i++) p.cyl(0.04, 0.03, 0.08, 0.1 + (i % 3) * 0.1, 0.92, 0.25 - ((i / 3) | 0) * 0.1, 0xd7ccc8); p.box(1.4, 0.06, 0.3, 0, 0.45, 1.1, 0x6e4526); for (const x of [-0.6, 0.6]) p.box(0.06, 0.45, 0.28, x, 0.22, 1.1, 0x5a3a22); },
  candy(p) { p.cyl(0.03, 0.03, 2.4, 0.35, 1.3, 0.1, 0x8a5a33); for (let i = 0; i < 9; i++) p.sph(0.17, 0.35 + Math.cos(i * 2.4) * 0.26, 1.7 + (i % 5) * 0.2, 0.1 + Math.sin(i * 2.4) * 0.26, i % 3 ? 0xf8a5c2 : 0xffd1dc); },
  balloon(p) { p.cyl(0.02, 0.02, 2.2, 0.35, 1.2, 0.1, 0x8a5a33); for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 0.25 + (i % 4) * 0.12; p.sph(0.17, 0.35 + Math.cos(a) * r, 2.3 + (i % 5) * 0.22, 0.1 + Math.sin(a) * r, rpick([0xe53935, 0xfdd835, 0x1e88e5, 0x43a047, 0xfb8c00, 0x8e24aa, 0xf06292]), 1, 1.2, 1); } },
  toys(p) { p.box(1.6, 0.05, 0.7, 0, 0.8, 0, 0x8a5a33); for (const x of [-0.75, 0.75]) p.box(0.05, 2.0, 0.05, x, 1.0, 0, 0x5a3a22); p.box(1.6, 0.05, 0.05, 0, 2.0, 0, 0x5a3a22); for (let i = 0; i < 14; i++) p.box(0.14, 0.2, 0.1, -0.68 + (i % 7) * 0.22, 1.72 - ((i / 7) | 0) * 0.42, 0, rpick(BRIGHT)); for (let i = 0; i < 8; i++) p.sph(0.09, -0.6 + i * 0.17, 0.92, 0.1, rpick(BRIGHT)); },
  cook() { },
};
function buildStaticProps() {
  const flat = [], shiny = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
  const place = (geo, x, z, yaw, list) => { const g = geo.clone(); m4.compose(pos.set(x, 0, z), q.setFromAxisAngle(up, yaw), one); g.applyMatrix4(m4); list.push(g); };
  for (const [x, z, yaw, type] of PARKED) {
    const def = VDEF[type];
    if (!def) continue;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    if (nearShopEntrance(x, z, def.len / 2)
        || blocksPilotTrail({ x, z, hw: 0.75, hd: def.len / 2, ux: c, uz: -s, vx: s, vz: c })) continue;
    PARK_MODE = 1; const model = vehicleModel(type, rpick(def.colors)), p = painter(); PARK_MODE = 0;
    for (const w of model.wheels) { if (w[4]) { const g = spokeGeo.clone(); g.scale(w[3], w[2], w[2]); g.translate(w[0], w[2], w[1]); const c = g.attributes.color, cc = _c.set(def.spoke || 0x444444); for (let i = 0; i < c.count; i++) c.setXYZ(i, cc.r, cc.g, cc.b); p.geo(g, def.spoke || 0x444444); } else { const g = tyreGeo.clone(); g.scale(w[3], w[2], w[2]); g.translate(w[0], w[2], w[1]); const keep = g.attributes.color.array.slice(); p.geo(g, 0); g.attributes.color.array.set(keep); } }
    if (model.horse) for (let k = 0; k < 4; k++) p.box(0.13, 1.04, 0.15, k & 1 ? 0.2 : -0.2, 0.52, model.horse[0] + (k < 2 ? 0.62 : -0.6), _c.set(model.horse[1]).multiplyScalar(0.8).getHex());
    if (p.count) place(p.done(), x, z, yaw, flat); place(model.geo, x, z, yaw, def.shiny ? shiny : flat);
    COLLIDERS.push({ x, z, ax: Math.cos(yaw), az: -Math.sin(yaw), bx: Math.sin(yaw), bz: Math.cos(yaw), hw: 0.75, hd: def.len / 2, yb: 0, yt: 1.6 });
  }
  for (const [x, z, yaw, type] of VENDORS) { const p = painter(); CART[type](p); if (p.count) { place(p.done(), x, z, yaw, flat); COLLIDERS.push({ x, z, ax: Math.cos(yaw), az: -Math.sin(yaw), bx: Math.sin(yaw), bz: Math.cos(yaw), hw: 0.9, hd: 0.55, yb: 0, yt: 1.5 }); } }
  // a few cattle and goats, as on any old-city street
  for (let i = 0; i < 9; i++) {
    const e = rpick(NET.edges.filter(e => e.ped && (e.k === 'residential' || e.k === 'service'))), a = polyAt(e.pl, R() * e.len), yaw = R() * TAU, p = painter(), cow = i < 4, s = cow ? 1 : 0.5, c = cow ? rpick([0xe9e4d8, 0x5a3a22, 0x2b2b2b, 0xc9b79c]) : rpick([0x2b2b2b, 0xe9e4d8, 0x8a6a48]);
    p.sph(0.48 * s, 0, 1.05 * s, 0, c, 0.85, 0.85, 2.0); p.box(0.3 * s, 0.4 * s, 0.6 * s, 0, 1.2 * s, 1.15 * s, c, 0, 0.3); for (let k = 0; k < 4; k++) p.box(0.14 * s, 0.8 * s, 0.14 * s, (k & 1 ? 0.22 : -0.22) * s, 0.4 * s, (k < 2 ? 0.6 : -0.6) * s, c); if (cow) { p.cone(0.04, 0.2, -0.12, 1.5, 1.2, 0xd8d0c0, 4); p.cone(0.04, 0.2, 0.12, 1.5, 1.2, 0xd8d0c0, 4); }
    place(p.done(), a[0] + a[3] * (e.w / 2 - 0.3), a[1] - a[2] * (e.w / 2 - 0.3), yaw, flat);
  }
  if (flat.length) { const m = new THREE.Mesh(mergeGeometries(flat), propMat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); }
  if (shiny.length) { const m = new THREE.Mesh(mergeGeometries(shiny), propMatShiny); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); }
}

/* horse rides in the clock-tower ground: a few ponies led round a loop */
const RIDERS = [];
function spawnRiders() {
  for (const loop of RIDE_LOOPS) { const pl = polyline(loop.concat(loop.slice(0, 2))); for (let i = 0; i < 4; i++) { const c = rpick(HORSE_COLS), p = painter(); horse(p, 0, c, i % 2 === 0); p.box(0.5, 0.1, 0.6, 0, 1.72, -0.05, 0x3a2416); fig(p, 0, 1.78, -0.05, rpick(BRIGHT), { legs: 0x2b2b33 }); const mesh = new THREE.Mesh(p.done(), propMat); mesh.castShadow = true; mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; scene.add(mesh); for (let k = 0; k < 4; k++) ALEG.setColorAt(nLeg + k, _c.set(c).multiplyScalar(0.8)); RIDERS.push({ pl, s: i / 4 * pl.len, mesh, l0: nLeg, sp: 1.3 + R() * 0.4, ph: R() * 6, yaw: 0 }); nLeg += 4; } }
  if (ALEG.instanceColor) ALEG.instanceColor.needsUpdate = true;
}
function updateRiders(dt, t) {
  for (const r of RIDERS) { r.s = (r.s + r.sp * dt) % r.pl.len; const a = polyAt(r.pl, r.s, _pp); let dy = Math.atan2(a[2], a[3]) - r.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; r.yaw += dy * Math.min(1, dt * 3); const cy = Math.cos(r.yaw), sy = Math.sin(r.yaw), bob = Math.abs(Math.sin(r.s * 2.6 + r.ph)) * 0.04, m = r.mesh.matrix.elements; m[0] = cy; m[2] = -sy; m[8] = sy; m[10] = cy; m[12] = a[0]; m[13] = bob; m[14] = a[1]; r.mesh.matrixWorld.copy(r.mesh.matrix); quadLegs(r.l0, a[0], bob, a[1], cy, sy, 0, r.s * 2.6 + r.ph, 0.45); }
}

/* ───────────── strays: cows, dogs and goats ambling along the lanes ─────────────
   bodies are modelled at horse scale (legs 1.04 tall, 1.2 apart) and shrunk by `sc`, so they share the horses' leg instances */
const STRAYS = [], STRAY = {
  cow: { n: 9, sc: 0.74, v: 0.45, rest: [8, 45], lazy: 0.14, fat: 2, swing: 0.28, cols: [0xe8e2d4, 0xd9cdb8, 0x6b4a32, 0x2a2420, 0xb9a78c, 0xe8e2d4],
    build(p, c) { p.sph(0.6, 0, 1.5, 0, c, 0.95, 0.95, 1.9); p.sph(0.26, 0, 2.06, 0.62, c, 1, 0.8, 1.25); p.sph(0.34, 0, 1.72, 1.12, c, 1, 1.05, 1.35); p.box(0.4, 0.44, 0.7, 0, 1.72, 1.6, c, 0, 0.45); p.box(0.32, 0.26, 0.2, 0, 1.52, 1.93, 0x3a2e28);
      for (const s of [-1, 1]) { p.cone(0.06, 0.36, s * 0.2, 2.12, 1.4, 0xd8d0c0, 5); p.box(0.26, 0.09, 0.14, s * 0.32, 1.9, 1.38, c); } p.box(0.07, 0.95, 0.07, 0, 1.35, -1.17, c, 0, -0.1); p.box(0.12, 0.2, 0.12, 0, 0.84, -1.22, 0x1c1410); } },
  dog: { n: 14, sc: 0.36, v: 1.25, rest: [2, 14], lazy: 0.1, fat: 1.6, swing: 0.34, cols: [0xb98a56, 0x8a6a48, 0x2a211c, 0xd8c9a8, 0x6e5a48, 0xb98a56],
    build(p, c) { p.sph(0.42, 0, 1.15, 0, c, 0.8, 0.85, 1.75); p.sph(0.32, 0, 1.58, 0.95, c, 0.9, 0.95, 1.05); p.box(0.22, 0.2, 0.4, 0, 1.5, 1.34, c); p.box(0.12, 0.1, 0.08, 0, 1.54, 1.55, 0x151210);
      for (const s of [-1, 1]) p.cone(0.1, 0.26, s * 0.17, 1.94, 0.9, c, 4); p.box(0.1, 0.62, 0.1, 0, 1.56, -0.86, c, 0, -0.6); } },
  goat: { n: 9, sc: 0.46, v: 0.8, rest: [3, 18], lazy: 0.12, fat: 1.4, swing: 0.32, cols: [0x1c1a18, 0xe8e2d4, 0x7a5a3c, 0x4a3b2e, 0xe8e2d4],
    build(p, c) { p.sph(0.45, 0, 1.24, 0, c, 0.85, 0.9, 1.65); p.box(0.26, 0.62, 0.32, 0, 1.68, 0.78, c, 0, 0.45); p.box(0.22, 0.26, 0.48, 0, 2.02, 1.1, c, 0, 0.3); p.box(0.06, 0.2, 0.06, 0, 1.8, 1.24, c);
      for (const s of [-1, 1]) { p.cone(0.04, 0.28, s * 0.08, 2.28, 0.98, 0x3a3028, 4); p.box(0.16, 0.06, 0.1, s * 0.17, 2.08, 0.96, c); } p.box(0.08, 0.2, 0.08, 0, 1.52, -0.78, c); } },
};
function spawnStrays() {
  const lanes = footEdges.filter(e => e.len > 14 && !e.prom && mainProject(e.pl.p[0], e.pl.p[1]).d < 330), close = lanes.filter(e => mainProject(e.pl.p[0], e.pl.p[1]).d < 110); if (!lanes.length) return;
  for (const def of Object.values(STRAY)) for (let i = 0; i < def.n; i++) {
    const c = rpick(def.cols), p = painter(); def.build(p, c); const mesh = new THREE.Mesh(p.done(), propMat); mesh.castShadow = true; mesh.matrixAutoUpdate = false; scene.add(mesh);
    for (let k = 0; k < 4; k++) ALEG.setColorAt(nLeg + k, _c.set(c).multiplyScalar(0.85));
    const e = rpick(close.length && R() < 0.5 ? close : lanes), side = R() < 0.5 ? 1 : -1;
    STRAYS.push({ def, mesh, l0: nLeg, e, off: pedOffset(e, side, 0.6 + R() * 0.4), s: R() * e.len, d: R() < 0.5 ? 1 : -1, wait: R() * def.rest[1], ph: R() * 6, yaw: R() * TAU, x: 0, y: 0, z: 0, snap: true }); nLeg += 4;
  }
  if (ALEG.instanceColor) ALEG.instanceColor.needsUpdate = true;
}
function updateStrays(dt, t) {
  const P = LIFE.player, pa = !!(P && P.active);
  for (const q of STRAYS) {
    const def = q.def, sc = def.sc, walking = q.wait <= 0;
    if (!walking) q.wait -= dt;
    else { q.s += def.v * dt; q.ph += def.v * dt * 2.6 / sc; if (q.s >= q.e.len) { q.s = 0; q.d = -q.d; q.off = -q.off; } if (R() < dt * def.lazy) q.wait = lerp(def.rest[0], def.rest[1], R()); }     // turn back at the end of the lane; stop to stand about now and then
    const a = polyAt(q.e.pl, q.d > 0 ? q.s : q.e.len - q.s, _pp), tx = a[2] * q.d, tz = a[3] * q.d, gx = a[0] + tz * q.off, gz = a[1] - tx * q.off;
    if (q.snap) { q.x = gx; q.z = gz; q.snap = false; } else if (walking) { const k = Math.min(1, dt * 2); q.x += (gx - q.x) * k; q.z += (gz - q.z) * k; }
    q.y = Math.abs(q.off) > 7.2 && hasFootpath(q.e) ? 0.16 : 0; const shy = pa && giveWay(q, P, 1.5, dt);
    if (walking) { let dy = Math.atan2(tx, tz) - q.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; q.yaw += dy * Math.min(1, dt * 2.5); } else if (shy) q.ph += dt * 5;
    const cy = Math.cos(q.yaw), sy = Math.sin(q.yaw), m = q.mesh.matrix.elements;
    m[0] = cy * sc; m[2] = -sy * sc; m[5] = sc; m[8] = sy * sc; m[10] = cy * sc; m[12] = q.x; m[13] = q.y; m[14] = q.z; q.mesh.matrixWorld.copy(q.mesh.matrix);
    quadLegs(q.l0, q.x, q.y, q.z, cy, sy, 0, q.ph, walking || shy ? def.swing : 0, sc, def.fat);
  }
}

/* ───────────── people ───────────── */
const NPMAX = 2300;
const PP = {
  torso: instanced(new THREE.BoxGeometry(0.44, 0.58, 0.25), M(0xffffff), NPMAX), robe: instanced(new THREE.CylinderGeometry(0.2, 0.3, 1, 8).translate(0, -0.5, 0), M(0xffffff), NPMAX),
  leg: instanced(new THREE.BoxGeometry(0.16, 0.86, 0.18).translate(0, -0.43, 0), M(0xffffff), NPMAX * 2, false), arm: instanced(new THREE.BoxGeometry(0.11, 0.6, 0.12).translate(0, -0.3, 0), M(0xffffff), NPMAX * 2, false),
  head: instanced(new THREE.SphereGeometry(0.118, 7, 4), M(0xffffff), NPMAX, false), hair: instanced(new THREE.SphereGeometry(0.13, 7, 4), M(0xffffff, { roughness: 1 }), NPMAX, false), bag: instanced(new THREE.BoxGeometry(0.3, 0.36, 0.15), M(0xffffff), 300, false),
};
const KURTA = [0xf5f2ea, 0xf5f2ea, 0xf5f2ea, 0xece5d2, 0xdfe9ee, 0xe2ecd9, 0xd9d9d9, 0xcfc3a8], PANTS = [0x1f2a44, 0x16161a, 0x4a4a52, 0x7a6f57, 0x34507a, 0x2b2b33], HAIRC = [0x15100c, 0x15100c, 0x2a1d14, 0x3b2a1e, 0x8f8f8f];
let nBag = 0;
function newPerson(kind) {
  const i = LIFE.people.length; if (i >= NPMAX) return null;
  const k = kind === undefined ? (R() < 0.3 ? 0 : R() < 0.31 ? 1 : R() < 0.29 ? 2 : R() < 0.4 ? 3 : R() < 0.33 ? 4 : 5) : kind;
  const p = { i, k, sc: (k === 5 ? 0.62 + R() * 0.16 : 0.93 + R() * 0.14) * (k === 2 || k === 3 || k === 4 ? 0.94 : 1), x: 0, y: 0, z: 0, yaw: 0, ph: R() * 6, sp: 1 + R() * 0.6, mode: 0, on: true, moving: false, sit: false, tx: 0, tz: 0, wait: 0, bag: -1, legs: !(k === 2 || k === 4), robe: k >= 1 && k <= 4, rl: k === 1 ? 0.8 : k === 3 ? 0.9 : 1.36, rw: k === 2 ? 1.25 : k === 4 ? 1.15 : k === 3 ? 1.05 : 1 };
  const skin = rpick(SKIN); let body, legc, hair, hs = 1;
  if (k === 0) { body = rpick(SHIRTS); legc = rpick(PANTS); hair = rpick(HAIRC); }
  else if (k === 1) { body = rpick(KURTA); legc = R() < 0.8 ? 0xf2efe6 : body; hair = R() < 0.45 ? 0xf4f4f0 : rpick(HAIRC); }
  else if (k === 2) { body = R() < 0.85 ? 0x141416 : rpick([0x2c2c54, 0x3d2c3e, 0x4a3b2a]); legc = body; hair = R() < 0.75 ? body : rpick(BRIGHT); hs = 1.14; }
  else if (k === 3) { body = rpick(BRIGHT); legc = R() < 0.5 ? body : rpick([0xf2efe6, 0x16161a, ...BRIGHT]); hair = R() < 0.5 ? rpick(BRIGHT) : 0x15100c; hs = R() < 0.5 ? 1.12 : 1.04; }
  else if (k === 4) { body = rpick(BRIGHT); legc = body; hair = 0x15100c; hs = 1.06; }
  else { body = R() < 0.6 ? 0xf5f5f5 : rpick(SHIRTS); legc = rpick([0x1f2a44, 0x4a4a52, 0x5d4037]); hair = 0x15100c; if (nBag < 300 && R() < 0.7) { p.bag = nBag++; PP.bag.setColorAt(p.bag, _c.set(rpick([0xe91e63, 0x1e88e5, 0xfdd835, 0x43a047, 0xd32f2f]))); } }
  p.hs = hs; p.col = [body, legc, k === 4 ? skin : body];
  (p.robe ? PP.robe : PP.torso).setColorAt(i, _c.set(body)); PP.leg.setColorAt(i * 2, _c.set(legc)); PP.leg.setColorAt(i * 2 + 1, _c.set(legc));
  const arm = k === 4 ? skin : body; PP.arm.setColorAt(i * 2, _c.set(arm)); PP.arm.setColorAt(i * 2 + 1, _c.set(arm)); PP.head.setColorAt(i, _c.set(skin)); PP.hair.setColorAt(i, _c.set(hair));
  LIFE.people.push(p); return p;
}
function posePerson(p, t) {
  const i = p.i, s = p.sc, cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), sw = p.moving ? Math.sin(p.ph) : 0, bob = p.moving ? Math.abs(sw) * 0.03 : 0;
  let y = p.y + bob, legA = sw * 0.62, armA = -sw * 0.5, legB = -legA;
  if (p.sit) { y = p.y - 0.84 * s + 0.06; legA = legB = -1.48; armA = -0.35; }
  if (p.robe) setLimb(PP.robe.instanceMatrix.array, i, p.x, y, p.z, cy, sy, 0, 1.42 * s, 0, 0, s * p.rw, s * (p.sit ? Math.min(p.rl, 0.72) : p.rl), s * p.rw);
  else setLimb(PP.torso.instanceMatrix.array, i, p.x, y, p.z, cy, sy, 0, 1.13 * s, 0, 0, s, s, s);
  if (p.legs) { setLimb(PP.leg.instanceMatrix.array, i * 2, p.x, y, p.z, cy, sy, -0.11 * s, 0.86 * s, 0, legA, s, s, s); setLimb(PP.leg.instanceMatrix.array, i * 2 + 1, p.x, y, p.z, cy, sy, 0.11 * s, 0.86 * s, 0, legB, s, s, s); }
  else if (p.sit) { setLimb(PP.leg.instanceMatrix.array, i * 2, p.x, y, p.z, cy, sy, -0.11 * s, 0.86 * s, 0, -1.48, s * 1.3, s * 0.9, s * 1.3); setLimb(PP.leg.instanceMatrix.array, i * 2 + 1, p.x, y, p.z, cy, sy, 0.11 * s, 0.86 * s, 0, -1.48, s * 1.3, s * 0.9, s * 1.3); }
  const shoulder = 0.28 * s * (p.robe ? p.rw * 0.92 : 1);
  if (p.photo) armA = -1.3;                                   // both hands up, holding a phone to the monument
  const rightArm = p.shop ? -0.86 + 0.23 * Math.sin(t * 2.7 + p.ph)
    : p.photo ? -1.45 : p.wave ? -2.6 + Math.sin(t * 9) * 0.3 : p.sit ? armA : -armA;
  setLimb(PP.arm.instanceMatrix.array, i * 2, p.x, y, p.z, cy, sy, -shoulder, 1.4 * s, 0, armA, s, s, s);
  setLimb(PP.arm.instanceMatrix.array, i * 2 + 1, p.x, y, p.z, cy, sy, shoulder, 1.4 * s, 0, rightArm, s, s, s);
  setLimb(PP.head.instanceMatrix.array, i, p.x, y, p.z, cy, sy, 0, 1.58 * s, 0, 0, s, s, s);
  setLimb(PP.hair.instanceMatrix.array, i, p.x, y, p.z, cy, sy, 0, (1.6 + (p.hs > 1.1 ? -0.015 : 0.012)) * s, -0.03 * s * p.hs, 0, s * p.hs, s * (p.hs > 1.1 ? p.hs : 0.86), s * p.hs);
  if (p.bag >= 0) setLimb(PP.bag.instanceMatrix.array, p.bag, p.x, y, p.z, cy, sy, 0, 1.16 * s, -0.2 * s, 0, s, s, s);
}
function hidePerson(p) { const i = p.i; hideInst(PP.robe.instanceMatrix.array, i); hideInst(PP.torso.instanceMatrix.array, i); for (const k of [0, 1]) { hideInst(PP.leg.instanceMatrix.array, i * 2 + k); hideInst(PP.arm.instanceMatrix.array, i * 2 + k); } hideInst(PP.head.instanceMatrix.array, i); hideInst(PP.hair.instanceMatrix.array, i); if (p.bag >= 0) hideInst(PP.bag.instanceMatrix.array, p.bag); }
/** Festival dress. In Muharram most grown-ups wear black; at Eid most men's shirts become white or pastel kurtas
    and children are in bright new clothes. null puts everyone back in their own clothes. */
function dressPeople(kind) {
  for (const p of LIFE.people) {
    if (!p.col) continue;
    let [body, legc, arm] = p.col; const h = ((p.i * 2654435761) >>> 0) / 4294967296, kid = p.k === 5;
    if (kind === 'muharram' && h < (kid ? 0.45 : 0.8)) {
      body = h < 0.07 ? 0x1d2a22 : 0x121214; arm = body;
      if (p.legs && h < 0.55) legc = 0x141416;
    } else if (kind === 'eid') {
      if (p.k === 0 && h < 0.75) { body = KURTA[p.i % KURTA.length]; legc = 0xf2efe6; arm = body; }
      else if (kid) { body = BRIGHT[p.i % BRIGHT.length]; arm = body; }
    }
    (p.robe ? PP.robe : PP.torso).setColorAt(p.i, _c.set(body));
    for (const k of [0, 1]) { PP.leg.setColorAt(p.i * 2 + k, _c.set(legc)); PP.arm.setColorAt(p.i * 2 + k, _c.set(arm)); }
  }
  for (const im of [PP.robe, PP.torso, PP.leg, PP.arm]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
}
const footEdges = [];
const pedOffset = (e, side, j) => e.main ? side * ((e.one ? e.w / 2 : mainHalfAt(e)) + 1.2 + j * 1.4) : e.veh ? side * (e.w / 2 - 0.15 + j * 0.5) : side * e.w * 0.32 * j;
function hasFootpath(e) { if (e.fp === undefined) { const m = mainProject(e.pl.p[0], e.pl.p[1]).s; e.fp = !!e.main && m > S_PARK0 + 2 && !(m > S_DUAL1 - 8 && m < S_RUMI1 + 6); } return e.fp; }
const mainHalfAt = e => { const m = mainProject(e.pl.p[0], e.pl.p[1]); return mainHalf(m.s); };
function spawnPeople() {
  for (const e of NET.edges) if (e.ped && !e.bridge && e.k !== 'primary' && e.len > 6) footEdges.push(e);
  const scale = Q.people;
  spawnWalkers(scale);                                        // people going places on foot: crowd.js
  for (const zn of ZONES) for (let i = 0, n = Math.max(1, Math.round(zn.n * scale * 1.6)); i < n; i++) {   // moved onto open ground once the walkable map exists
    const p = newPerson(); if (!p) break;
    const w = toWorld(zn.f, lerp(zn.x0, zn.x1, R()), lerp(zn.z0, zn.z1, R()));
    p.mode = 2; p.zone = zn; p.y = zn.y; p.x = p.tx = w[0]; p.z = p.tz = w[1]; p.wait = R() < 0.45 ? R() * 12 : 0; p.yaw = R() * TAU; p.look = zoneLook(zn);
  }
  for (const st of SEATS) { if (R() > 0.55 + 0.4 * scale) continue; const p = newPerson(R() < 0.3 ? 2 : undefined); if (!p) break; p.mode = 3; p.sit = true; p.x = st[0]; p.y = st[1]; p.z = st[2]; p.yaw = st[3]; }
  for (const [x, z, yaw, type] of VENDORS) {
    const v = newPerson(R() < 0.75 ? (R() < 0.5 ? 0 : 1) : 3); if (!v) break; v.mode = 3; const back = type === 'candy' || type === 'balloon' ? 0 : -0.95; v.x = x + Math.sin(yaw) * back; v.z = z + Math.cos(yaw) * back; v.yaw = v.yaw0 = yaw; v.vend = true;
    for (let k = 0, n = R() < 0.35 ? 0 : R() < 0.6 ? 1 : 2; k < n; k++) { const c = newPerson(); if (!c) break; c.mode = 3; const a = yaw + (R() - 0.5) * 1.2, d = 1.3 + R() * 0.7; c.x = x + Math.sin(a) * d; c.z = z + Math.cos(a) * d; c.yaw = a + Math.PI; }
  }
  for (const shop of SHOP_SITES.values()) {
    const staff = newPerson(shop.id === 'tunday-kababi' ? 1 : 0);
    if (!staff) break;
    const { point, yaw, floor } = shop.staff;
    [staff.x, staff.z] = point;
    Object.assign(staff, { shop, yaw, y: floor });
  }
  for (const [i, stall] of MARKET_STALLS.entries()) {
    const person = newPerson();
    if (!person) break;
    person.market = stall.shop
      ? { stall, phase: (0.35 + i * 0.14) % 1, period: 18 + i % 3 * 4, threshold: 0.66 }
      : { stall, phase: 0.2 + i * 0.47, period: 24 + i * 10, threshold: 0.43 + i * 0.25 };
    person.y = stall.floor ?? 0;
    [person.x, person.z] = stall.entry;
  }
  for (const im of Object.values(PP)) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  const n = LIFE.people.length; PP.torso.count = PP.robe.count = PP.head.count = PP.hair.count = n; PP.leg.count = PP.arm.count = n * 2; PP.bag.count = Math.max(1, nBag);
}
/** shift someone out of the walker's way; true while they are giving way */
function giveWay(p, P, r, d) {
  const ax = p.x - P.x, az = p.z - P.z, q = ax * ax + az * az; if (q >= r * r || Math.abs(p.y - P.y) > 1.5) return false;
  const dd = Math.sqrt(q) || 0.01, k = Math.min(r - dd, 2.4 * d) / dd; p.x += ax * k; p.z += az * k; return true;
}
function updateMarketCustomer(person, dt, time) {
  const { stall, phase, period } = person.market;
  const t = (time / period + phase) % 1;
  let from, target, progress;
  if (t < 0.30) {
    from = stall.entry; target = stall.counter; progress = t / 0.30;
  } else if (t < 0.64) {
    from = target = stall.counter; progress = 0;
  } else if (t < 0.90) {
    from = stall.counter; target = stall.exit; progress = (t - 0.64) / 0.26;
  } else {
    from = stall.exit; target = stall.entry; progress = (t - 0.90) / 0.10;
  }
  person.x = lerp(from[0], target[0], progress);
  person.z = lerp(from[1], target[1], progress);
  person.moving = from !== target;
  if (person.moving) {
    person.yaw = Math.atan2(target[0] - from[0], target[1] - from[1]);
    person.ph += dt * 5;
  } else if (stall.shop) person.yaw = stall.shop.frame.rot + Math.PI;
  posePerson(person, time);
}
let _pf = 0;
function updatePeople(dt, t) {
  const A = LIFE.people, nOn = Math.round(A.length * busyAt('crowd', TIME.hour)), cx = camera.position.x, cz = camera.position.z, P = LIFE.player, pa = !!(P && P.active); _pf++;
  const market = marketActivity(TIME.hour);
  let shown = 0;
  for (let i = 0; i < A.length; i++) {
    const p = A[i];
    if (p.walker) continue;                                   // walkers are moved by crowd.js
    if (p.held) { if (p.on) { p.on = false; hidePerson(p); } continue; }   // cleared off ground a festival needs (the Eid rows)
    const on = p.market ? (p.market.stall.shop?.activity ?? market) > p.market.threshold
      : p.shop ? p.shop.activity > 0.36 : (i * 7919) % A.length < nOn;
    if (on !== p.on && (p.market || p.shop || unseen(p.x, p.z, 2, PED_FAR))) { p.on = on; if (!on) hidePerson(p); else p.dirty = true; }   // nobody pops up in view
    if (!p.on) continue;
    shown++;
    const far = Math.abs(p.x - cx) + Math.abs(p.z - cz) > 420; if (far && (i + _pf) % 4) continue; const d = far ? dt * 4 : dt;
    if (p.market) {
      updateMarketCustomer(p, d, t);
    } else if (p.shop) {
      posePerson(p, t);
    } else if (p.mode === 2) {
      if (p.wait > 0) {                                       // standing about: turn to look at the monument, maybe take a photo
        p.wait -= d;
        let turned = false;
        if (p.look) { let dy = Math.atan2(p.look[0] - p.x, p.look[1] - p.z) - p.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; if (Math.abs(dy) > 0.02) { p.yaw += dy * Math.min(1, d * 2); turned = true; } }
        if (p.wait <= 0 && p.photo) { p.photo = false; turned = true; }
        if (pa && giveWay(p, P, 1.25, d)) { p.ph += d * 6; p.moving = true; posePerson(p, t); } else if (p.moving || p.dirty || turned) { p.moving = false; p.dirty = false; posePerson(p, t); }
        continue;
      }
      const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz);
      if (dd < 0.35) {                                        // somewhere new that can be walked to in a straight line
        const w = strollTarget(p); if (w) { p.tx = w[0]; p.tz = w[1]; }
        if (!w || R() < 0.55) { p.wait = 3 + R() * 18; p.photo = !!p.look && R() < 0.22; }
      } else { p.x += dx / dd * p.sp * 0.8 * d; p.z += dz / dd * p.sp * 0.8 * d; p.yaw = Math.atan2(dx, dz); p.ph += p.sp * d * 4; p.moving = true; }
      if (pa) giveWay(p, P, 1.25, d);
      posePerson(p, t);
    } else {
      if (p.vend) {      // a stall-keeper turns to you and beckons for a moment when you come close
        const ax = P.x - p.x, az = P.z - p.z, near = pa && ax * ax + az * az < 30 && Math.abs(P.y - p.y) < 2; if (near && !p.near) p.wt = t; p.near = near;
        let dy = (near ? Math.atan2(ax, az) : p.yaw0) - p.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
        const wave = near && t - p.wt < 3.2; if (wave || wave !== p.wave || Math.abs(dy) > 0.02) { p.yaw += dy * Math.min(1, d * 5); p.wave = wave; p.dirty = true; }
      }
      if (p.dirty !== false) { p.dirty = false; posePerson(p, t); }
    }
  }
  updateWalkers(dt, t);
  for (const g of CROWD.groups) if (g.on) { shown += g.members.length; if (pa) for (const p of g.members) if (giveWay(p, P, 1.3, dt)) posePerson(p, t); }
  LIFE.nPeople = shown;
}

/* ───────────── birds, kites, fountains, smoke ───────────── */
const BIRDS = []; let birdIM = null;
const KITES = []; let kiteLines = null;
function spawnSky() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.45, 0, 0, -0.35, 1.3, 0.1, -0.15, 0, 0, 0.45, -1.3, 0.1, -0.15, 0, 0, -0.35], 3)); g.computeVertexNormals();
  const tw = toWorld(FRAME.park, TALAB.cx, TALAB.cz), ch = toWorld(FRAME.chota, 0, 129), bh = toWorld(FRAME.bara, 0, 273);
  const flocks = [[0, 60, 0, 22, 1], [tw[0], 14, tw[1], 34, 1], [ch[0], 30, ch[1], 28, 1], [bh[0], 36, bh[1], 46, 1], [FRAME.rumi.x, 30, FRAME.rumi.z, 28, 1], [FRAME.asfi.x, 40, FRAME.asfi.z, 30, 1], [-211, 26, -98, 18, 1], [100, 120, 100, 260, 3.2], [-300, 140, 60, 220, 3.2]];
  for (let i = 0; i < 150; i++) { const f = flocks[i < 132 ? i % 7 : 7 + (i % 2)]; BIRDS.push({ f, r: f[3] * (0.5 + R() * 0.8), h: -5 + R() * 14, a: R() * TAU, w: (0.28 + R() * 0.22) * (i % 2 ? 1 : -1) / (f[4] > 1 ? 4 : 1), ph: R() * 6, s: f[4] }); }
  birdIM = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x70747c, side: THREE.DoubleSide }), BIRDS.length); birdIM.frustumCulled = false; scene.add(birdIM);
  const cols = [0xff3b3b, 0xffd60a, 0x2ec4b6, 0xff7b00, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xffffff, 0x70e000, 0xff006e], geo = new THREE.PlaneGeometry(2.6, 2.6).rotateZ(Math.PI / 4);
  const roofs = HOUSES.filter(h => Math.abs(h.x) < 520 && h.z > -330 && h.z < 520 && !h.inst);
  for (let i = 0; i < 22; i++) { const h = rpick(roofs), m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide })); scene.add(m); KITES.push({ m, a: [h.x, h.h + 1.6, h.z], dx: -30 + R() * 60, dz: -30 + R() * 60, h: 36 + R() * 36, ph: R() * 6, sp: 0.35 + R() * 0.35 }); }
  kiteLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(KITES.length * 6), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); kiteLines.frustumCulled = false; scene.add(kiteLines);
}
const _o3 = new THREE.Object3D();
function updateSky(dt, t) {
  birdIM.visible = TIME.night < 0.8;
  if (birdIM.visible) { BIRDS.forEach((b, i) => { b.a += b.w * dt; const r = b.r * (1 + 0.18 * Math.sin(t * 0.3 + b.ph)); _o3.position.set(b.f[0] + Math.cos(b.a) * r, b.f[1] + b.h + Math.sin(t * 0.7 + b.ph) * 2.5, b.f[2] + Math.sin(b.a) * r); _o3.rotation.set(0, -b.a + (b.w > 0 ? 0 : Math.PI), 0); _o3.scale.set((b.s > 1 ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + b.ph))) * b.s, 1, b.s); _o3.updateMatrix(); birdIM.setMatrixAt(i, _o3.matrix); }); birdIM.instanceMatrix.needsUpdate = true; }
  const kv = TIME.night < 0.6 && wx.rain < 0.3; kiteLines.visible = kv; const p = kiteLines.geometry.attributes.position;
  KITES.forEach((k, i) => { k.m.visible = kv; if (!kv) return; const x = k.a[0] + k.dx + Math.sin(t * k.sp + k.ph) * 7, y = k.a[1] + k.h + Math.sin(t * k.sp * 1.7 + k.ph) * 4, z = k.a[2] + k.dz + Math.cos(t * k.sp * 0.8 + k.ph) * 6; k.m.position.set(x, y, z); k.m.rotation.set(-0.6 + Math.sin(t * 2 + k.ph) * 0.15, t * 0.1 + k.ph, Math.sin(t * 1.3 + k.ph) * 0.35); p.setXYZ(i * 2, k.a[0], k.a[1], k.a[2]); p.setXYZ(i * 2 + 1, x, y, z); });
  if (kv) p.needsUpdate = true;
}
let jetPts = null, jetGlow = null, smoke = null; const SMOKE = [];
function spawnFx() {
  const n = FOUNTAINS.reduce((a, f) => a + f.n, 0);
  jetPts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)), new THREE.PointsMaterial({ color: 0xe9f7ff, size: 0.42, transparent: true, opacity: 0.85, depthWrite: false })); jetPts.frustumCulled = false; scene.add(jetPts);
  const gp = [], gc = [], pal = [[0.2, 1, 0.5], [1, 0.25, 0.9], [0.3, 0.6, 1], [1, 0.8, 0.3]]; FOUNTAINS.forEach((f, i) => { gp.push(f.x, f.y + 0.4, f.z); gc.push(...pal[i % 4]); });
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  const gm = new THREE.PointsMaterial({ map: glowTex, size: 6, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); jetGlow = new THREE.Points(gg, gm); jetGlow.frustumCulled = false; scene.add(jetGlow);
  NIGHTFX.push(nn => { gm.opacity = nn * 0.9; jetGlow.visible = nn > 0.05; });
  for (const [x, z, , type] of VENDORS) if (type === 'cook' || type === 'corn' || type === 'tea' || type === 'chaat') {
    for (let k = 0; k < 5; k++) SMOKE.push({ x, y: 1.6, z, phase: R() });
  }
  for (const shop of SHOP_SITES.values()) if (shop.steam) {
    const [x, y, z] = shop.steam;
    for (let k = 0; k < 5; k++) SMOKE.push({ x, y, z, phase: k / 5, shop });
  }
  const vapour = new THREE.BufferGeometry();
  vapour.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SMOKE.length * 3), 3));
  vapour.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(SMOKE.length * 4).fill(1), 4));
  smoke = new THREE.Points(vapour, new THREE.PointsMaterial({
    map: radialTex('rgba(235,235,235,.5)', 'rgba(200,200,200,.03)'), vertexColors: true,
    size: 0.85, transparent: true, opacity: 0.52, depthWrite: false,
  }));
  smoke.frustumCulled = false;
  scene.add(smoke);
}
function updateFx(dt, t) {
  const p = jetPts.geometry.attributes.position; let o = 0;
  for (const f of FOUNTAINS) { const dance = 0.62 + 0.38 * Math.sin(t * 0.9 + f.ph * 3 + f.x * 0.4); for (let i = 0; i < f.n; i++, o++) { const u = (t * 0.6 + i / f.n) % 1, a = i * 2.399, s = f.spread * (0.55 + 0.45 * ((i * 7) % 5) / 5) * u; p.setXYZ(o, f.x + Math.cos(a) * s, f.y + f.h * dance * 4 * u * (1 - u), f.z + Math.sin(a) * s); } }
  p.needsUpdate = true;
  const { position, color } = smoke.geometry.attributes;
  SMOKE.forEach(({ x, y, z, phase, shop }, i) => {
    const u = (t * 0.22 + phase) % 1;
    const spread = shop ? 0.32 : 1;
    position.setXYZ(i, x + (Math.sin(u * 5 + phase * 9) * 0.5 + 0.8) * u * spread,
      y + u * (shop ? 1.25 : 4.2), z + Math.cos(u * 4 + phase * 7) * 0.35 * u * spread);
    const activity = shop ? smooth((shop.activity - 0.12) / 0.72) : 1;
    color.setW(i, activity * (1 - u));
  });
  position.needsUpdate = color.needsUpdate = true;
}
const animatedInstances = [TYRE, SPOKE, ALEG, ...Object.values(PP)];
function buildLife() {
  for (let i = VENDORS.length - 1; i >= 0; i--) {
    if (nearShopEntrance(VENDORS[i][0], VENDORS[i][1], 0.65)) VENDORS.splice(i, 1);
  }
  buildStaticProps();
  spawnVehicles();
  spawnRiders();
  spawnPeople();
  spawnStrays();
  spawnSky();
  spawnFx();

  // Wheel and leg indices stay stable as traffic switches on and off by hour.
  TYRE.count = nTyre;
  SPOKE.count = nSpoke;
  ALEG.count = nLeg;
}
function updateLife(dt, t) {
  updateTraffic(dt, t);
  updateRiders(dt, t);
  updateStrays(dt, t);
  updatePeople(dt, t);
  updateSky(dt, t);
  updateFx(dt, t);
  for (const mesh of animatedInstances) {
    if (!mesh.count) continue;
    // Send the assigned matrix slots and skip the unused tail of each buffer.
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16);
    mesh.instanceMatrix.needsUpdate = true;
  }
}
