'use strict';
/* night.js — Hussainabad after dark, as the heritage-zone lighting has it: floodlit monuments, pools of lamplight on
   the paving and lit shopfronts. Two kinds of light are added to the lit materials' shaders:
   - a top-down light map of the street lamps, shop windows and floodlight fixtures. Whatever stands in it (paving,
     walls, trees, people, vehicles) is lit in proportion to its own colour, fading out above lamp height;
   - floodlights aimed at the monuments. Lights and monuments never move, so each floodlit vertex has its light
     worked out once at load (large wall faces are first split so a wash can grade across them) and carried in a
     small attribute; at night the shader only adds it. A per-pixel loop over the lights cost several milliseconds
     a frame on a laptop GPU in a close-up; this costs nothing measurable.
   Sources are placed from the monuments' own frames (src/core.js) and the 2026 night photos of the precinct. */

const NL = { map: { value: null }, box: { value: new THREE.Vector4() }, lamps: { value: 0 }, floodOn: { value: 0 } };
const LAMP_GAIN = 2.6, FLOOD_SCALE = 16;       // flood light is stored as sqrt(L / FLOOD_SCALE) in 8 bits
const FLOODS = [], FLOOD_K = [];

const NL_GLSL = /* glsl */`
uniform sampler2D nlMap;
uniform vec4 nlBox;
uniform float nlLamps;
varying vec3 vNlW;
varying vec3 vNlN;
#ifdef NL_FLOOD
uniform float nlFloodOn;
varying vec3 vNlF;
#endif
vec3 nightLight(vec3 p, vec3 n) {
  vec3 L = vec3(0.0);
  if (nlLamps > 0.002) {
    vec2 uv = (p.xz - nlBox.xy) * nlBox.zw;
    if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0)
      L += texture2D(nlMap, uv).rgb * (nlLamps * (1.0 - smoothstep(3.0, 10.0, p.y)) * (0.62 + 0.38 * max(n.y, 0.0)));
  }
#ifdef NL_FLOOD
  L += vNlF * nlFloodOn;
#endif
  return L;
}
`;
const NL_VERT = /* glsl */`
#include <fog_vertex>
{
  vec4 nlw = vec4(transformed, 1.0);
  vec3 nln = objectNormal;
  #ifdef USE_INSTANCING
    nlw = instanceMatrix * nlw;
    nln = mat3(instanceMatrix) * nln;
  #endif
  vNlW = (modelMatrix * nlw).xyz;
  vNlN = normalize(mat3(modelMatrix) * nln);
  #ifdef NL_FLOOD
    vNlF = nlF.rgb * nlF.rgb * ${FLOOD_SCALE.toFixed(1)};
  #endif
}
`;
const NL_FRAG = /* glsl */`
#include <emissivemap_fragment>
{
  vec3 nlN = normalize(vNlN);
  #ifdef DOUBLE_SIDED
    nlN *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  totalEmissiveRadiance += diffuseColor.rgb * nightLight(vNlW, nlN);
}
`;

/* ───────────── floodlights ───────────── */
const FL_AMBER = 0xffae55, FL_WARM = 0xffc684, FL_CREAM = 0xffdab0, FL_COOL = 0xdfe8ff;
/** a floodlight at (lx, y, lz) in frame f, aimed at the frame point (tx, ty, tz); cos is the half-angle of its beam */
function fl(f, lx, y, lz, tx, ty, tz, col, I, range, cos = 0.4, exp = 1) {
  const [x, z] = toWorld(f, lx, lz), [ax, az] = toWorld(f, tx, tz), d = new THREE.Vector3(ax - x, ty - y, az - z).normalize();
  return { p: [x, y, z], aim: [d.x, d.y, d.z], cos, range, col: new THREE.Color(col).multiplyScalar(I), exp };
}
/** one monument's lights, in clusters of sources that sit together: the bake tests each cluster's sphere once per
    vertex and only evaluates the sources of clusters the vertex is inside, so tight clusters keep loading quick */
function floodGroup(...parts) {
  for (const list of parts) {
    const start = FLOODS.length, c = [0, 0, 0];
    for (const s of list) { FLOODS.push(s); for (let i = 0; i < 3; i++) c[i] += s.p[i] / list.length; }
    let r = 0; for (const s of list) r = Math.max(r, Math.hypot(s.p[0] - c[0], s.p[1] - c[1], s.p[2] - c[2]) + s.range);
    FLOOD_K.push({ c, r, start, n: list.length });
  }
}
const FACES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function defineFloodlights() {
  const P = FRAME.park, R = FRAME.rumi, C = FRAME.chota, B = FRAME.bara, A = FRAME.asfi;
  // Clock Tower: washed amber from the plaza, with uplights on the balcony, the clock stage and the belfry
  // that make the bright bands seen in night photos
  floodGroup(FACES.map(([u, v]) => fl(P, u * 13, 0.5, v * 13, u * 3.5, 18, v * 3.5, FL_AMBER, 4.2, 80, 0.25)));
  floodGroup(
    FACES.map(([u, v]) => fl(P, u * 5.4, 10.3, v * 5.4, u * 3.2, 25, v * 3.2, FL_AMBER, 2.6, 18, 0.3, 1.3)),
    FACES.map(([u, v]) => fl(P, u * 5.0, 45, v * 5.0, u * 3.0, 56, v * 3.0, FL_AMBER, 2.4, 14, 0.3, 1.2)),
    FACES.map(([u, v]) => fl(P, u * 4.6, 56.6, v * 4.6, u * 2.5, 62, v * 2.5, FL_AMBER, 2.6, 9, 0.2)),
  );
  // Picture Gallery: the arcaded front over the tank and the east side
  floodGroup([fl(P, -96, 1.4, -55, -88.5, 7, -65, FL_WARM, 2.4, 22, 0.45), fl(P, -81, 1.4, -55, -88.5, 7, -65, FL_WARM, 2.4, 22, 0.45), fl(P, -64, 0.5, -80.5, -75, 7, -80.5, FL_WARM, 2.2, 20, 0.45)]);
  // Rumi Darwaza, west face: the half-dome glows amber from inside the arch, the frame and wings are washed cream
  floodGroup(
    [fl(R, 0, 1.0, 7.0, 0, 12, 1.5, 0xff8a30, 7.0, 20, 0.2, 1.1), fl(R, 0, 21.0, 4.6, 0, 23, 1.6, FL_AMBER, 2.4, 5, 0.1)],
    [-1, 1].map(s => fl(R, s * 7, 0.4, 17, 0, 11, 5, 0xfff0dc, 1.8, 34, 0.5)),
    ...[-1, 1].map(s => [fl(R, s * 11.2, 0.4, 7.5, s * 11.2, 14, 4.3, FL_WARM, 2.6, 24, 0.4), fl(R, s * 16.5, 0.4, 4.5, s * 16.5, 8, 0, FL_WARM, 2.4, 16, 0.3)]),
    ...[-1, 1].map(s => [fl(R, s * 28.5, 0.4, 4.5, s * 28.5, 8, 0, FL_WARM, 2.4, 16, 0.3), fl(R, s * 36.3, 0.4, 5.5, s * 36.3, 9, 3, FL_WARM, 2.4, 18, 0.35)]),
  );
  // Rumi Darwaza, east face toward the Bara Imambara
  floodGroup(
    [...[-1, 1].map(s => fl(R, s * 7, 0.4, -21, 0, 9, -11.2, FL_CREAM, 3.0, 32, 0.5)), fl(R, 0, 0.5, -14, 0, 6, -6, FL_AMBER, 2.5, 14, 0.3)],
    ...[-1, 1].map(s => [16.5, 28.5].map(x => fl(R, s * x, 0.4, -15.5, s * x, 8, -11, FL_WARM, 2.2, 16, 0.3))),
  );
  // Chota Imambara: the gateway from the street and from the garden, then the hall, its gilded dome, the two
  // Taj replicas, the mosque and the hammam
  floodGroup([
    ...[-1, 1].map(s => fl(C, s * 6.5, 0.4, -12, 0, 8, -3, 0xffc070, 3.0, 28, 0.45)),
    fl(C, 0, 17, -3.5, 0, 20, 0, FL_AMBER, 2.2, 6, 0.1),
    fl(C, 0, 0.4, 13, 0, 8, 3, 0xffc070, 2.6, 22, 0.45),
  ]);
  floodGroup(
    [...[-13, 0, 13].map(x => fl(C, x, 0.6, x ? 104 : 105, x * 0.6, 8, 119, 0xffc27a, 3.2, 34, 0.45)), fl(C, 0, 12, 106, 0, 21, 129, 0xffc27a, 2.6, 32, 0.6)],
    ...[-1, 1].map(s => [fl(C, s * 42, 0.4, 49, s * 42, 7, 62, 0xffe6c8, 2.4, 22, 0.45)]),
    [fl(C, -31, 0.4, 24, -42.5, 6, 24, FL_WARM, 2.4, 22, 0.45)], [fl(C, 31, 0.4, 28, 38.5, 4, 28, FL_WARM, 2.0, 18, 0.45)],
  );
  // Bara Imambara: outer gate, the Naubat Khana across the road, the second gate, then the hall and its towers
  floodGroup(
    [-1, 1].map(s => fl(B, s * 7, 0.4, -10, 0, 8, -1, FL_WARM, 3.0, 26, 0.45)),
    [fl(B, 46, 0.4, -16, 46, 7, -26, FL_WARM, 2.6, 24, 0.4)],
    [fl(B, 0, 0.4, 84, 0, 9, 95.5, FL_WARM, 3.0, 28, 0.45)],
    [-30, 0, 30].map(x => fl(B, x, 0.5, x ? 236 : 234, x * 0.7, 14, 252, 0xffd6a0, 4.2, 52, 0.45)),
    [-1, 1].map(s => fl(B, s * 51, 5.4, 244, s * 51, 22, 253, FL_WARM, 2.4, 30, 0.4)),
  );
  // Asfi Mosque on its plinth, and its two minarets
  floodGroup(
    [-17, 0, 17].map(x => fl(A, x, 3.4, x ? 22 : 24, x * 0.6, 11, 7, FL_CREAM, 3.2, 36, 0.45)),
    [-1, 1].map(s => fl(A, s * 33, 3.4, 12, s * 33, 30, 6.4, FL_WARM, 2.4, 40, 0.6)),
  );
  // Satkhanda is lit cool white, unlike the amber monuments around it
  const SK = { x: -211.1, z: -97.7, rot: 0.2 };
  floodGroup([0, 1, 2].map(i => { const a = i * TAU / 3 + 0.4; return fl(SK, Math.sin(a) * 16, 0.6, Math.cos(a) * 16, 0, 10, 0, FL_COOL, 2.8, 36, 0.5); }));
  // the two Husainabad gateways over the road
  for (const G of [FRAME.gateE, FRAME.gateW]) floodGroup([-1, 1].flatMap(s => [-1, 1].map(t => fl(G, s * 5.5, 0.4, t * 10, 0, 8, t * 2.5, 0xffcf8a, 2.6, 24, 0.45))));
}
/** the flood light at a point with normal (nx, ny, nz), from the sources of the clusters it lies in */
function floodAt(ks, x, y, z, nx, ny, nz, out) {
  out[0] = out[1] = out[2] = 0;
  for (const k of ks) {
    const dx = x - k.c[0], dy = y - k.c[1], dz = z - k.c[2]; if (dx * dx + dy * dy + dz * dz > k.r * k.r) continue;
    for (let i = k.start; i < k.start + k.n; i++) {
      const s = FLOODS[i], lx = s.p[0] - x, ly = s.p[1] - y, lz = s.p[2] - z, r2 = lx * lx + ly * ly + lz * lz;
      if (r2 >= s.range * s.range) continue;
      const r = Math.sqrt(r2) || 0.001, lam = (nx * lx + ny * ly + nz * lz) / r; if (lam <= 0) continue;
      const t = -(s.aim[0] * lx + s.aim[1] * ly + s.aim[2] * lz) / r, e0 = s.cos, e1 = e0 + (1 - e0) * 0.3;
      if (t <= e0) continue;
      const u = Math.min(1, (t - e0) / (e1 - e0)), f = lam * u * u * (3 - 2 * u) * Math.pow(1 - r / s.range, s.exp);
      out[0] += s.col.r * f; out[1] += s.col.g * f; out[2] += s.col.b * f;
    }
  }
}
/** Give a baked monument mesh its flood light from the clusters ks that reach it. A plain triangle soup is refined
    where the light bends across a face: a large triangle is split along its longest edge while the light at that
    edge's middle or at its centre strays from what its corners would interpolate to, so a wall keeps its four
    corners unless a floodlight paints a pool or a sharp gradient on it. */
function* lightMesh(o, ks) {
  const g = o.geometry, two = o.material.side === THREE.DoubleSide, ta = [0, 0, 0], tb = [0, 0, 0];
  const at = (x, y, z, nx, ny, nz) => {
    floodAt(ks, x, y, z, nx, ny, nz, ta);
    if (two) { floodAt(ks, x, y, z, -nx, -ny, -nz, tb); ta[0] = Math.max(ta[0], tb[0]); ta[1] = Math.max(ta[1], tb[1]); ta[2] = Math.max(ta[2], tb[2]); }
    return ta;
  };
  const light = v => { if (!v.f) { const f = at(v[0], v[1], v[2], v[3], v[4], v[5]); v.f = [f[0], f[1], f[2]]; } return v.f; };
  const lum = f => f[0] + f[1] + f[2];
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null, n0 = P.length / 3;
  const enc = v => Math.min(255, Math.round(Math.sqrt(v / FLOOD_SCALE) * 255));
  const plain = !g.index && !g.groups.length && Object.keys(g.attributes).every(k => k === 'position' || k === 'normal' || k === 'uv' || k === 'nlF');
  if (!plain) {
    const out = new Uint8Array(n0 * 4);
    for (let i = 0; i < n0; i++) { if ((i & 4095) === 4095) yield; const f = at(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); out[i * 4] = enc(f[0]); out[i * 4 + 1] = enc(f[1]); out[i * 4 + 2] = enc(f[2]); }
    g.setAttribute('nlF', new THREE.Uint8BufferAttribute(out, 4, true)); return;
  }
  const op = [], on = [], ou = [], of = [];
  const raw = (v, f) => { op.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); on.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); ou.push(U ? U[v * 2] : 0, U ? U[v * 2 + 1] : 0); of.push(f[0], f[1], f[2]); };
  const rec = v => { const f = light(v); op.push(v[0], v[1], v[2]); on.push(v[3], v[4], v[5]); ou.push(v[6], v[7]); of.push(f[0], f[1], f[2]); };
  const vx = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U ? U[i * 2] : 0, U ? U[i * 2 + 1] : 0];
  const mix = vs => { const r = [0, 0, 0, 0, 0, 0, 0, 0]; for (const v of vs) for (let j = 0; j < 8; j++) r[j] += v[j] / vs.length; const l = Math.hypot(r[3], r[4], r[5]) || 1; r[3] /= l; r[4] /= l; r[5] /= l; return r; };
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const emit = (a, b, c, deep) => {
    const ab = d2(a, b), bc = d2(b, c), ca = d2(c, a), m = Math.max(ab, bc, ca);
    if (m > 2.25 && deep < 11) {
      const [e0, e1, opp] = m === ab ? [a, b, c] : m === bc ? [b, c, a] : [c, a, b];
      const q = mix([e0, e1]), ce = mix([a, b, c]), fa = lum(light(a)), fb = lum(light(b)), fc = lum(light(c));
      const fq = lum(light(q)), fce = lum(light(ce)), tol = 0.06 + 0.12 * Math.max(fa, fb, fc);
      if (Math.abs(fq - (lum(e0.f) + lum(e1.f)) / 2) > tol || Math.abs(fce - (fa + fb + fc) / 3) > tol) { emit(e0, q, opp, deep + 1); emit(q, e1, opp, deep + 1); return; }
    }
    rec(a); rec(b); rec(c);
  };
  const kc = ks.map(k => [k.c[0], k.c[1], k.c[2], k.r]), zero = [0, 0, 0];
  for (let i = 0; i + 2 < n0; i += 3) {
    if (i % 6000 === 5997) yield;                                  // big meshes are baked across several frames
    const j = i * 3, cx = (P[j] + P[j + 3] + P[j + 6]) / 3, cy = (P[j + 1] + P[j + 4] + P[j + 7]) / 3, cz = (P[j + 2] + P[j + 5] + P[j + 8]) / 3;
    let rr = 0; for (let t = 0; t < 9; t += 3) rr = Math.max(rr, (P[j + t] - cx) ** 2 + (P[j + t + 1] - cy) ** 2 + (P[j + t + 2] - cz) ** 2);
    const r = Math.sqrt(rr); let reach = false;
    for (const k of kc) { const dx = cx - k[0], dy = cy - k[1], dz = cz - k[2], R = k[3] + r; if (dx * dx + dy * dy + dz * dz < R * R) { reach = true; break; } }
    if (!reach) { raw(i, zero); raw(i + 1, zero); raw(i + 2, zero); continue; }
    if (r < 0.87) { for (let t = 0; t < 3; t++) { const v = i + t; raw(v, at(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], N[v * 3], N[v * 3 + 1], N[v * 3 + 2])); } continue; }   // small: no split can be needed
    emit(vx(i), vx(i + 1), vx(i + 2), 0);
  }
  const n = op.length / 3, out = new Uint8Array(n * 4);
  if (n !== n0) {
    g.setAttribute('position', new THREE.Float32BufferAttribute(op, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(on, 3));
    if (U) g.setAttribute('uv', new THREE.Float32BufferAttribute(ou, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
  }
  for (let i = 0; i < n; i++) { out[i * 4] = enc(of[i * 3]); out[i * 4 + 1] = enc(of[i * 3 + 1]); out[i * 4 + 2] = enc(of[i * 3 + 2]); }
  g.setAttribute('nlF', new THREE.Uint8BufferAttribute(out, 4, true));
}

/* ───────────── the lamp light map ───────────── */
const LAMP_LOOK = {        // by lamp kind (city.js LAMPS): pool radius on the ground, colour, strength
  0: [11, [1, 0.8, 0.58], 0.5],          // heritage swan-neck: warm
  1: [11, [0.86, 0.92, 1], 0.55],        // double-arm LED in the plazas: cool white
  2: [30, [0.9, 0.94, 1], 0.6],          // high masts
  3: [6, [1, 0.78, 0.5], 0.45],          // garden posts
  4: [12, [1, 0.86, 0.66], 0.55],        // the avenue lamps on their granite pedestals
};
function buildLampMap() {
  const pools = [];      // [x, z, rx, rz, rot, rgb, strength]
  for (const l of lampSpots) { const [r, c, a] = LAMP_LOOK[l[4]] || LAMP_LOOK[0], k = l[5] || 1; pools.push([l[0], l[2], r * k, r * k, 0, c, a]); }
  // shop windows: a lit band on the pavement in front of every shop face
  for (const h of HOUSES) {
    if (!h.shop) continue;
    const sx = Math.sin(h.rot), sz = Math.cos(h.rot), d = h.hd + 1.5;
    pools.push([h.x + sx * d, h.z + sz * d, h.hw + 1.2, 3.4, h.rot, [1, 0.93, 0.8], 0.42]);
  }
  // the floodlight fixtures themselves leave a small bright patch on the ground
  for (const s of FLOODS) if (s.p[1] < 2 && s.range >= 14) pools.push([s.p[0], s.p[2], 2.2, 2.2, 0, [1, 0.82, 0.6], 0.2]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pools) { const r = Math.max(p[2], p[3]); x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); z0 = Math.min(z0, p[1] - r); z1 = Math.max(z1, p[1] + r); }
  const W = OPT.quality === 'low' ? 1024 : 2048, H = W / 2, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'lighter';
  x.setTransform(W / (x1 - x0), 0, 0, H / (z1 - z0), -x0 * W / (x1 - x0), -z0 * H / (z1 - z0));
  const PROFILE = [[0, 1], [0.15, 0.9], [0.3, 0.62], [0.45, 0.36], [0.6, 0.18], [0.8, 0.06], [1, 0]];
  for (const [px, pz, rx, rz, rot, c, a] of pools) {
    x.save(); x.translate(px, pz); x.rotate(-rot); x.scale(rx, rz);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1), rgb = c.map(v => Math.round(v * 255)).join(',');
    for (const [t, v] of PROFILE) g.addColorStop(t, `rgba(${rgb},${(v * a).toFixed(3)})`);
    x.fillStyle = g; x.fillRect(-1, -1, 2, 2); x.restore();
  }
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.anisotropy = 4;
  NL.map.value = t; NL.box.value.set(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0));
}

/* ───────────── patching the materials ───────────── */
function nightPatch(m, flood) {
  m.onBeforeCompile = sh => {
    sh.uniforms.nlMap = NL.map; sh.uniforms.nlBox = NL.box; sh.uniforms.nlLamps = NL.lamps;
    if (flood) sh.uniforms.nlFloodOn = NL.floodOn;
    const def = flood ? '#define NL_FLOOD\n' : '';
    sh.vertexShader = def + (flood ? 'attribute vec4 nlF;\nvarying vec3 vNlF;\n' : '') + 'varying vec3 vNlW;\nvarying vec3 vNlN;\n' + sh.vertexShader.replace('#include <fog_vertex>', NL_VERT);
    sh.fragmentShader = def + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NL_GLSL).replace('#include <emissivemap_fragment>', NL_FRAG);
  };
  m.customProgramCacheKey = () => flood ? 'nl-flood' : 'nl';
  m.needsUpdate = true;
}
const IDENTITY = new THREE.Matrix4();
/** Called once the whole scene is built. Every lit material gets the lamp map. Meshes a floodlight cluster reaches
    get the flood variant, and every mesh drawn with one of those materials starts with zero flood light; the real
    values are then baked a few meshes per frame (more at night), so loading is not held up and the floodlights
    come on within a moment or two of the scene appearing. */
function buildNight() {
  const t0 = performance.now();
  defineFloodlights(); buildLampMap();
  scene.updateMatrixWorld(true);
  const meshes = [], floodMats = new Set(), queue = [];
  scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const m = o.material; if (o.isInstancedMesh || Array.isArray(m) || !m || !m.isMeshStandardMaterial) continue;
    if (!o.matrixWorld.equals(IDENTITY)) continue;                  // monuments are baked in world space
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingSphere) g.computeBoundingSphere();
    if (g.boundingBox.max.y - g.boundingBox.min.y < 0.6) continue;  // paving, lawns and water take only the lamp map
    const bs = g.boundingSphere, ks = FLOOD_K.filter(k => Math.hypot(bs.center.x - k.c[0], bs.center.y - k.c[1], bs.center.z - k.c[2]) < k.r + bs.radius);
    if (ks.length) { floodMats.add(m); queue.push([o, ks]); }
  }
  const mats = new Set();
  for (const o of meshes) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (!m || !m.isMeshStandardMaterial) continue; mats.add(m);
    if (floodMats.has(m) && !o.geometry.attributes.nlF) o.geometry.setAttribute('nlF', new THREE.Uint8BufferAttribute(new Uint8Array(o.geometry.attributes.position.count * 4), 4, true));
  }
  for (const m of mats) nightPatch(m, floodMats.has(m));
  NIGHTFX.push(() => { NL.lamps.value = TIME.lamps * LAMP_GAIN; NL.floodOn.value = TIME.lamps; });
  // nearest first, so what the opening view shows is lit first
  queue.sort((a, b) => a[0].geometry.boundingSphere.center.distanceToSquared(camera.position) - b[0].geometry.boundingSphere.center.distanceToSquared(camera.position));
  NL.stats = { materials: mats.size, flood: floodMats.size, meshes: queue.length, sources: FLOODS.length, clusters: FLOOD_K.length, setupMs: Math.round(performance.now() - t0), bakeMs: 0, left: queue.length };
  let job = null;
  UPDATERS.push(() => {
    if (!job && !queue.length) return;
    const night = TIME.lamps > 0.01; if (!night && UI.T < 5) return;   // by day, let the opening flight finish first
    const start = performance.now(), budget = night ? 28 : 8;
    while (performance.now() - start < budget) {
      if (!job) { if (!queue.length) break; const [o, ks] = queue.shift(); job = lightMesh(o, ks); }
      if (job.next().done) job = null;
    }
    NL.stats.bakeMs += Math.round(performance.now() - start); NL.stats.left = queue.length + (job ? 1 : 0);
  });
  NL.finish = () => { while (job || queue.length) { if (!job) { const [o, ks] = queue.shift(); job = lightMesh(o, ks); } while (!job.next().done); job = null; } NL.stats.left = 0; };   // benchmarks and screenshots
  if (BENCHMARK) NL.finish();                                     // keep the measured frames free of baking
  return NL.stats;
}
