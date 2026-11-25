'use strict';
/* traffic.js — vehicles make real trips across the street graph instead of turning at random.
   Each one drives from where it enters the map to where it leaves (or to a lane in the old city), keeps
   left, follows the vehicle ahead with the Intelligent Driver Model, changes lanes or overtakes slow carts,
   turns along smooth curves, takes its turn at junctions (bigger road first, then first come), stops at
   auto, bus and tonga stands, waits for people crossing, and only appears or leaves out of the camera's view. */

const TR = {
  links: [], junctions: [], stands: [], exits: [], locals: [], corridor: [], pool: [], hpool: [],
  clock: 0, spawnAt: 0, hspawnAt: 0, cursor: 0, target: 0, htarget: 0, active: 0,
  crossers: [],                         // people on a carriageway, as x, z pairs; written by crowd.js each frame
  frustum: new THREE.Frustum(), _m: new THREE.Matrix4(), _s: new THREE.Sphere(),
};
const DRIVE = 0, DWELL = 1, UTURN = 2, VEH_FAR = 300, PED_FAR = 170;   // beyond these distances (m) coming and going is not noticed
const GATES = [FRAME.gateE, FRAME.gateW];
const MIX_MAIN = ['hatch', 'hatch', 'hatch', 'hatch', 'sedan', 'sedan', 'suv', 'suv', 'auto', 'auto', 'auto', 'auto', 'tempo', 'tempo', 'tempo', 'erick', 'erick', 'erick', 'erick', 'erick', 'erick', 'bike', 'bike', 'bike', 'bike', 'bike', 'bike', 'bike', 'bike', 'scooter', 'scooter', 'scooter', 'scooter', 'scooter', 'scooter', 'cycle', 'cycle', 'rick', 'rick', 'bus', 'citybus', 'traveller', 'loader', 'loader', 'thela'];
const MIX_LANE = ['bike', 'bike', 'bike', 'bike', 'scooter', 'scooter', 'scooter', 'scooter', 'erick', 'erick', 'erick', 'auto', 'auto', 'cycle', 'cycle', 'cycle', 'rick', 'rick', 'hatch', 'thela'];

/* how each kind of vehicle drives: a = comfortable acceleration (m/s²), T = time gap kept to the vehicle ahead (s),
   s0 = gap left when standing (m), r = turning radius (m) */
const KIND = {
  car: { a: 2.0, T: 1.1, s0: 1.8, r: 4.5 }, para: { a: 1.4, T: 0.9, s0: 1.2, r: 3.4 }, two: { a: 2.6, T: 0.7, s0: 1.0, r: 2.8 },
  cycle: { a: 0.8, T: 0.9, s0: 0.8, r: 2.4 }, slow: { a: 0.6, T: 1.2, s0: 1.2, r: 4.2 }, heavy: { a: 1.1, T: 1.5, s0: 2.4, r: 7 },
};
const VKIND = { hatch: 'car', sedan: 'car', suv: 'car', auto: 'para', tempo: 'para', erick: 'para', rick: 'slow', bike: 'two', scooter: 'two', cycle: 'cycle',
  tonga: 'slow', baggi: 'slow', bus: 'heavy', citybus: 'heavy', traveller: 'heavy', loader: 'heavy', thela: 'slow', horse: 'slow' };
const VWID = { hatch: 1.6, sedan: 1.66, suv: 1.82, auto: 1.3, tempo: 1.5, erick: 1.06, rick: 1.0, bike: 0.7, scooter: 0.62, cycle: 0.5,
  tonga: 1.5, baggi: 1.5, bus: 2.5, citybus: 2.5, traveller: 1.95, loader: 1.5, thela: 1.1, horse: 0.6 };
const LOCAL_TYPES = new Set(['bike', 'scooter', 'cycle', 'erick', 'auto', 'rick', 'thela']);   // these also run errands into the lanes
// [chance of calling at a stand on a trip, shortest and longest stop in seconds]
const STAND_USE = { auto: [0.5, 10, 28], erick: [0.55, 10, 28], tempo: [0.45, 12, 24], bus: [0.9, 30, 55], traveller: [0.7, 25, 45], citybus: [0.9, 14, 24], tonga: [1, 25, 80], baggi: [1, 30, 90] };
const ROAD_CLASS = {
  primary: { rank: 4, limit: 12, cf: 0.8 }, secondary: { rank: 3, limit: 11, cf: 0.85 }, main: { rank: 2.5, limit: 7.5, cf: 0.75 },
  tertiary: { rank: 2, limit: 9, cf: 1.05 }, residential: { rank: 1, limit: 5.5, cf: 3 }, minor: { rank: 0, limit: 4.5, cf: 4 },
};
const roadClass = e => e.main ? 'main' : /primary/.test(e.k) ? 'primary' : /secondary/.test(e.k) ? 'secondary' : /tertiary/.test(e.k) ? 'tertiary' : e.k === 'residential' || e.k === 'living_street' ? 'residential' : 'minor';

/* ───────────── links: one direction of travel along a drivable street ───────────── */
const _la = [0, 0, 0, 0], _lb = [0, 0, 0, 0], _lc = [0, 0, 0, 0];
function linkAt(L, s, out = _la) {
  polyAt(L.e.pl, L.d > 0 ? s : L.len - s, out);
  if (L.d < 0) { out[2] = -out[2]; out[3] = -out[3]; }
  return out;
}
/** the point `lat` metres to the left of a link's centre line (traffic keeps left) */
function lanePoint(L, s, lat, out = _la) { linkAt(L, s, out); out[0] += out[3] * lat; out[1] -= out[2] * lat; return out; }
/** lane 1 is the kerb lane for slow vehicles, lane 0 the faster one nearer the middle */
function laneLat(L, lane, wid) {
  const w = L.e.w;
  if (L.e.one) return (lane ? 0.22 : -0.22) * w;
  if (w >= 9) return (lane ? 0.36 : 0.13) * w;
  return Math.min(0.25 * w, w / 2 - 0.3 - wid / 2);
}
const kerbLat = (L, wid) => L.e.w / 2 - wid / 2 - 0.35;
function turnInfo(A, B) {
  let t = A.turns.get(B.id);
  if (!t) {
    const dot = clamp(A.t1[0] * B.t0[0] + A.t1[1] * B.t0[1], -1, 1), th = Math.acos(dot);
    t = { th, dot, tanH: Math.tan(Math.min(th, 2.3) / 2), cross: A.t1[0] * B.t0[1] - A.t1[1] * B.t0[0] };   // cross > 0: a right turn
    A.turns.set(B.id, t);
  }
  return t;
}

function prepTraffic() {
  for (const e of NET.edges) {                    // tertiary streets that run along the heritage road are part of it
    let near = true;
    for (let i = 0; i < e.pl.p.length; i += 2) if (mainProject(e.pl.p[i], e.pl.p[i + 1]).d > 16) { near = false; break; }
    if (near && /tertiary/.test(e.k) && e.veh) { e.main = true; if (!e.one) e.w = 14; }
  }
  for (const nd of NET.nodes) { nd.out = []; nd.inn = []; nd.J = null; }
  for (const e of NET.edges) {
    if (!e.veh) continue;
    e.lk = [null, null];
    for (const d of [1, -1]) {
      if (e.one && d < 0) continue;
      const c = roadClass(e), k = ROAD_CLASS[c];
      const L = { id: TR.links.length, e, d, from: d > 0 ? e.a : e.b, to: d > 0 ? e.b : e.a, len: e.len, q: [], cls: c, rank: k.rank, limit: k.limit, cf: k.cf,
        wide: e.one ? e.w >= 6 : e.w >= 9, opp: null, turns: new Map(), t0: [0, 0], t1: [0, 0] };
      const h = Math.min(4, L.len), a = linkAt(L, 0, _lb), b = linkAt(L, h, _lc);
      let dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; L.t0 = [dx / l, dz / l];
      const c1 = linkAt(L, L.len - h, _lb), c2 = linkAt(L, L.len, _lc);
      dx = c2[0] - c1[0]; dz = c2[1] - c1[1]; l = Math.hypot(dx, dz) || 1; L.t1 = [dx / l, dz / l];
      e.lk[d > 0 ? 0 : 1] = L; TR.links.push(L);
      NET.nodes[L.from].out.push(L); NET.nodes[L.to].inn.push(L);
    }
    if (e.lk[0] && e.lk[1]) { e.lk[0].opp = e.lk[1]; e.lk[1].opp = e.lk[0]; }
  }
  NET.nodes.forEach((nd, n) => {
    const edges = new Set([...nd.out, ...nd.inn].map(L => L.e));
    if (edges.size >= 3) { let r = 0; for (const e of edges) r = Math.max(r, e.w / 2); nd.J = { n, x: nd.x, z: nd.z, r: r + 1, occ: [], appr: [], cache: new Map(), paths: new Map() }; TR.junctions.push(nd.J); }
    const weight = L => ({ primary: 5, secondary: 4, main: 3, tertiary: 3, residential: 0.8, minor: 0.4 })[L.cls];
    if (nd.exit && (nd.out.length || nd.inn.length)) TR.exits.push({ n, out: nd.out, w: weight(nd.out[0] || nd.inn[0]) });
    else if (!nd.exit && nd.out.length && nd.inn.length && nd.inn.some(L => L.cls === 'residential') && inFocus(nd.x, nd.z, -20)) TR.locals.push(n);
  });
  TR.corridor = TR.links.filter(L => L.e.main && L.len > 20);       // the heritage road, which most trips pass along
  buildStands();
}

/* auto, bus and tonga stands at the kerb outside the places visitors come for */
function standSites() {
  const label = id => LABELS.find(l => l.id === id), walk = id => { const l = label(id); return l && l.walk ? [l.walk[0], l.walk[1]] : l ? [l.pos[0], l.pos[2]] : null; };
  const place = id => { const p = PLACE_CATALOG[id]; return toWorld(FRAME[p.frame], p.walk[0], p.walk[1]); };
  return [
    { id: 'bara', p: [FRAME.bara.x, FRAME.bara.z], heritage: true, w: 3, users: 'auto erick tempo bus traveller tonga baggi' },   // outside the outer gate
    { id: 'clock', p: place('clock'), heritage: true, w: 3, users: 'auto erick tempo bus traveller tonga baggi' },
    { id: 'chota', p: walk('chota'), heritage: true, w: 2, users: 'auto erick tempo citybus tonga baggi' },
    { id: 'rumi', p: place('rumi'), w: 1.5, users: 'auto erick' },
    { id: 'satkhanda', p: walk('satkhanda'), w: 1, users: 'auto erick tempo citybus' },
    { id: 'food', p: walk('food'), w: 1.5, users: 'auto erick bus traveller' },
  ];
}
function buildStands() {
  for (const site of standSites()) {
    if (!site.p) continue;
    const [px, pz] = site.p;
    let best = null, bd = 90;
    for (const L of TR.links) {
      if (!L.wide || L.len < 34 || (site.heritage && !(L.e.main && L.opp))) continue;
      const p = L.e.pl.p, cum = L.e.pl.cum; let dmin = 1e9, se = 0;
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1), d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
        if (d < dmin) { dmin = d; se = cum[i / 2] + Math.sqrt(l2) * t; }
      }
      const s = clamp(L.d > 0 ? se : L.len - se, 14, L.len - 16), c = linkAt(L, s, _lb);
      if (GATES.some(g => Math.hypot(c[0] - g.x, c[1] - g.z) < 48)) continue;
      const left = (px - c[0]) * c[3] - (pz - c[1]) * c[2] > 0;
      const score = dmin + (left ? 0 : L.e.one ? 10 : 1e3);
      if (score < bd) { bd = score; best = { L, s }; }
    }
    if (!best) continue;
    const at = lanePoint(best.L, best.s, kerbLat(best.L, 1.5), _lb);
    TR.stands.push({ id: site.id, L: best.L, s: best.s, x: at[0], z: at[1], heritage: !!site.heritage, w: site.w, users: new Set(site.users.split(' ')) });
    if (site.heritage && best.L.opp) {           // carriages also wait across the road, so they can ply both ways along it
      const O = best.L.opp, s2 = O.len - best.s, b = lanePoint(O, s2, kerbLat(O, 1.5), _lb);
      TR.stands.push({ id: site.id, L: O, s: s2, x: b[0], z: b[1], heritage: true, w: site.w, users: new Set(['tonga', 'baggi']) });
    }
  }
}
const standLoad = st => { let m = 0; for (const u of st.L.q) if (u.mode === DWELL && u.stand === st) m += u.len + 1.2; return m; };

/* ───────────── routes: cheapest way along the links, with a little personal preference per driver ───────────── */
const RT = { dist: null, prev: null, stamp: null, gen: 0, heap: [] };
const canUse = (v, L) => L.e.w >= v.def.minW;
function linkCost(v, L) {
  const h = Math.sin(v.id * 12.9898 + L.id * 78.233) * 43758.5453;
  return L.len * L.cf * (v.local && L.cls === 'residential' ? 0.75 : 1) * (v.heritage && !L.e.main ? 5 : 1) * (0.85 + 0.35 * (h - Math.floor(h)));   // carriages keep to the heritage road where they can
}
/** cheapest route from link `start` to link `goalLink`, or to any link that ends at node `goalNode` */
function findRoute(v, start, goalLink, goalNode = -1) {
  const n = TR.links.length;
  if (!RT.dist) { RT.dist = new Float64Array(n); RT.prev = new Int32Array(n); RT.stamp = new Int32Array(n); }
  const gen = ++RT.gen, H = RT.heap, D = RT.dist, PV = RT.prev, ST = RT.stamp; H.length = 0;
  const push = (c, i) => { H.push(c, i); let k = H.length / 2 - 1; while (k > 0) { const p = (k - 1) >> 1; if (H[p * 2] <= H[k * 2]) break; const c0 = H[p * 2], i0 = H[p * 2 + 1]; H[p * 2] = H[k * 2]; H[p * 2 + 1] = H[k * 2 + 1]; H[k * 2] = c0; H[k * 2 + 1] = i0; k = p; } };
  const pop = () => {
    const c = H[0], i = H[1], lc = H[H.length - 2], li = H[H.length - 1]; H.length -= 2;
    if (H.length) { H[0] = lc; H[1] = li; let k = 0; const m = H.length / 2; for (;;) { const a = 2 * k + 1, b = a + 1; let s = k; if (a < m && H[a * 2] < H[s * 2]) s = a; if (b < m && H[b * 2] < H[s * 2]) s = b; if (s === k) break; const c0 = H[s * 2], i0 = H[s * 2 + 1]; H[s * 2] = H[k * 2]; H[s * 2 + 1] = H[k * 2 + 1]; H[k * 2] = c0; H[k * 2 + 1] = i0; k = s; } }
    _pop[0] = c; _pop[1] = i; return _pop;
  };
  ST[start.id] = gen; D[start.id] = 0; PV[start.id] = -1; push(0, start.id);
  while (H.length) {
    const [c, i] = pop(); if (c > D[i]) continue;
    const L = TR.links[i];
    if (L === goalLink || L.to === goalNode) { const path = []; for (let k = i; k >= 0; k = PV[k]) path.push(TR.links[k]); return path.reverse(); }
    for (const M of NET.nodes[L.to].out) {
      if (M.e === L.e || !canUse(v, M)) continue;
      const t = turnInfo(L, M); if (t.dot < -0.6) continue;
      const nc = c + linkCost(v, M) + 8 * (1 - t.dot);
      if (ST[M.id] !== gen || nc < D[M.id]) { ST[M.id] = gen; D[M.id] = nc; PV[M.id] = i; push(nc, M.id); }
    }
  }
  return null;
}
const _pop = [0, 0];
function pickWeighted(list, wfn) { let tot = 0; for (const x of list) tot += wfn(x); let r = R() * tot; for (const x of list) { r -= wfn(x); if (r <= 0) return x; } return list[list.length - 1]; }
/** choose where this vehicle is going from (start, s0), maybe calling at a stand on the way */
function planTrip(v, start, s0) {
  v.stand = null; v.served = false;
  const passed = st => st.L === start && s0 > st.s - 4;
  if (v.heritage) {                              // tongas and baggis ply between the monuments' stands
    const opts = TR.stands.filter(st => st.heritage && st.id !== (v.lastStand && v.lastStand.id) && st.users.has(v.type) && !passed(st));
    for (let k = 0; k < 4 && opts.length; k++) {
      const st = rpick(opts), r = findRoute(v, start, st.L);
      if (r) { v.route = r; v.ri = 0; v.stand = st; return true; }
    }
    return false;
  }
  const use = STAND_USE[v.type];
  let st = null;
  if (use && R() < use[0]) { const opts = TR.stands.filter(q => q.users.has(v.type) && !passed(q)); if (opts.length) st = pickWeighted(opts, q => q.w); }
  for (let k = 0; k < 6; k++) {
    const dest = v.local && TR.locals.length && R() < 0.3 ? rpick(TR.locals) : pickWeighted(TR.exits, x => x.w).n;
    if (dest === start.from) continue;
    let r = null;
    const via = st ? st.L : R() < 0.7 && TR.corridor.length ? pickWeighted(TR.corridor, L => L.len) : null;   // visitors and errands along the heritage road
    if (via && via !== start) { const a = findRoute(v, start, via), b = a && findRoute(v, via, null, dest); if (a && b) r = a.concat(b.slice(1)); else st = null; }
    if (!r) r = findRoute(v, start, null, dest);
    if (r) { v.route = r; v.ri = 0; v.stand = st; v.dest = dest; return true; }
  }
  return false;
}

/* ───────────── what the camera can see: vehicles appear and leave only outside it ───────────── */
function viewUpdate() {
  camera.updateMatrixWorld();
  TR._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  TR.frustum.setFromProjectionMatrix(TR._m);
}
/** out of the camera's view, or far enough away that coming and going cannot be noticed */
function unseen(x, z, r = 4, far = 520) {
  const c = camera.position;
  if (!(Math.hypot(x - c.x, z - c.z) <= far)) return true;                   // far away (or no camera yet)
  TR._s.center.set(x, 1.2, z); TR._s.radius = r;
  return !TR.frustum.intersectsSphere(TR._s);
}

/* ───────────── vehicles ───────────── */
function makeVehicle(type, heritage) {
  const def = VDEF[type], color = rpick(def.colors), model = vehicleModel(type, color), mesh = new THREE.Mesh(model.geo, def.shiny ? propMatShiny : propMat);
  mesh.castShadow = true; mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  let lm = null;
  if (model.lights) { lm = new THREE.Mesh(model.lights, lightMat); lm.matrixAutoUpdate = false; lm.frustumCulled = false; lm.visible = false; scene.add(lm); }
  const v = {
    type, def, mesh, lm, wheels: model.wheels, w0: [], horse: model.horse, l0: -1, len: def.len, wid: VWID[type] || 1.5, k: KIND[VKIND[type]],
    lane: def.lane, pref: def.lane, vmax: def.v * (0.85 + R() * 0.3), v: 0, x: 0, z: 0, yaw: 0, ph: R() * 6, roll: 0, on: false, id: LIFE.vehicles.length,
    heritage, local: LOCAL_TYPES.has(type), route: null, ri: 0, L: null, s: 0, lat: 0, latT: 0, latV: 0, cv: null,
    jg: null, jmv: null, jgB: null, mv: null, arr: -1, wait: 0, mode: DRIVE, timer: 0, stand: null, served: false, lastStand: null,
    ot: null, ghost: null, ut: null, think: R(), snap: true, stuck: 0, dest: -1,
  };
  for (const w of model.wheels) {
    if (w[4]) { v.w0.push(nSpoke); SPOKE.setColorAt(nSpoke, _c.set(def.spoke || 0x444444)); hideInst(SPOKE.instanceMatrix.array, nSpoke++); }
    else { v.w0.push(nTyre); hideInst(TYRE.instanceMatrix.array, nTyre++); }
  }
  if (model.horse) { v.l0 = nLeg; for (let k = 0; k < 4; k++) { ALEG.setColorAt(nLeg + k, _c.set(model.horse[1]).multiplyScalar(0.8)); hideInst(ALEG.instanceMatrix.array, nLeg + k); } nLeg += 4; }
  LIFE.vehicles.push(v); (heritage ? TR.hpool : TR.pool).push(v);
  return v;
}
function joinLink(v, L, s) { v.L = L; v.s = s; L.q.push(v); }
function quitLink(v) { if (!v.L) return; const q = v.L.q, i = q.indexOf(v); if (i >= 0) q.splice(i, 1); }
function release(v) { if (!v.jg) return; const o = v.jg.occ, i = o.indexOf(v); if (i >= 0) o.splice(i, 1); v.jg = null; v.jmv = null; v.jgB = null; }
function dropGhost(v) { if (!v.ghost) return; const q = v.ut.O.q, i = q.indexOf(v.ghost); if (i >= 0) q.splice(i, 1); v.ghost = null; }
function spotFree(L, s, v) { for (const u of L.q) if (Math.abs(u.s - s) < (u.len + v.len) / 2 + 3) return false; return true; }
function vehicleOn(v, L, s, lat) {
  Object.assign(v, { on: true, mode: DRIVE, cv: null, mv: null, arr: -1, wait: 0, ot: null, snap: true, stuck: 0, lat, latT: lat, latV: 0 });
  v.v = Math.min(v.vmax, L.limit) * 0.6; v.mesh.visible = true; joinLink(v, L, s);
}
function vehicleOff(v) {
  if (!v.on) return;
  quitLink(v); release(v); dropGhost(v);
  v.on = false; v.mesh.visible = false; v.L = null; v.cv = null; v.ut = null; v.mode = DRIVE;
  if (v.lm) v.lm.visible = false;
  v.w0.forEach((w, k) => hideInst(v.wheels[k][4] ? SPOKE.instanceMatrix.array : TYRE.instanceMatrix.array, w));
  if (v.l0 >= 0) for (let k = 0; k < 4; k++) hideInst(ALEG.instanceMatrix.array, v.l0 + k);
}
/** enter at the edge of the map (or out of a lane in the old city), somewhere the camera is not looking */
function startFromOrigin(v) {
  for (let k = 0; k < 8; k++) {
    const L = v.local && TR.locals.length && R() < 0.3 ? rpick(NET.nodes[rpick(TR.locals)].out) : pickWeighted(TR.exits, x => x.out.length ? x.w : 0).out[0];
    if (!L || !canUse(v, L)) continue;
    const p = linkAt(L, 2, _lb);
    if (!unseen(p[0], p[1], 6, VEH_FAR) || !spotFree(L, 2, v) || !planTrip(v, L, 0)) continue;
    vehicleOn(v, L, Math.min(2, L.len * 0.3), laneLat(L, v.lane, v.wid));
    return true;
  }
  return false;
}
/** drop the vehicle somewhere along a fresh trip, as if it had been driving for a while */
function startMidRoute(v, anywhere) {
  for (let k = 0; k < 8; k++) {
    const L0 = v.local && TR.locals.length && R() < 0.25 ? rpick(NET.nodes[rpick(TR.locals)].out) : pickWeighted(TR.exits, x => x.out.length ? x.w : 0).out[0];
    if (!L0 || !canUse(v, L0) || !planTrip(v, L0, 0)) continue;
    let tot = 0; for (const L of v.route) tot += L.len;
    let r = R() * tot, i = 0; while (i < v.route.length - 1 && r > v.route[i].len) r -= v.route[i++].len;
    const L = v.route[i], s = clamp(r, 1, L.len - 1);
    if (NET.nodes[L.to].J && s > L.len - stopBack(L) - v.len) continue;            // not in the queue for a junction
    if (v.stand) { const j = v.route.indexOf(v.stand.L); if (j < i || (j === i && s > v.stand.s - 4)) v.stand = null; }
    const p = linkAt(L, s, _lb);
    if ((!anywhere && !unseen(p[0], p[1], 6, VEH_FAR)) || !spotFree(L, s, v)) continue;
    v.ri = i; vehicleOn(v, L, s, laneLat(L, v.lane, v.wid));
    return true;
  }
  return false;
}
/** a tonga or baggi waiting its turn at one of the monuments' stands */
function startAtStand(v, anywhere) {
  const opts = TR.stands.filter(st => st.heritage && st.users.has(v.type)); if (!opts.length) return false;
  for (let k = 0; k < 4; k++) {
    const st = rpick(opts), s = st.s - standLoad(st) - v.len / 2 - R() * 2;
    if (s < 4 || !spotFree(st.L, s, v)) continue;
    const p = linkAt(st.L, s, _lb); if (!anywhere && !unseen(p[0], p[1], 6, VEH_FAR)) continue;
    v.route = [st.L]; v.ri = 0; v.stand = st; v.lastStand = st;
    vehicleOn(v, st.L, s, kerbLat(st.L, v.wid)); v.v = 0; v.mode = DWELL; v.served = true; v.timer = 4 + R() * 60;
    return true;
  }
  return false;
}
/** a tonga or baggi somewhere between two stands, or waiting at one */
function startHeritage(v, anywhere) {
  if (R() < 0.35 && startAtStand(v, anywhere)) return true;
  const hs = TR.stands.filter(st => st.heritage && st.users.has(v.type));
  for (let k = 0; k < 6 && hs.length; k++) {
    const a = rpick(hs); v.lastStand = a;
    if (!planTrip(v, a.L, a.s)) continue;
    let tot = 0; for (const L of v.route) tot += L.len;
    let r = a.s + R() * (tot - a.s), i = 0; while (i < v.route.length - 1 && r > v.route[i].len) r -= v.route[i++].len;
    const L = v.route[i], s = clamp(r, 1, L.len - 1);
    if (L === v.stand.L && s > v.stand.s - 6) continue;
    const p = linkAt(L, s, _lb);
    if ((!anywhere && !unseen(p[0], p[1], 6, VEH_FAR)) || !spotFree(L, s, v)) continue;
    v.ri = i; vehicleOn(v, L, s, laneLat(L, L.wide ? v.lane : 0, v.wid)); v.v = 1;
    return true;
  }
  return false;
}

/* keep the hour's number of vehicles on the road without anyone popping in or out in view */
function balanceTraffic(first) {
  const busy = busyAt('traffic', TIME.hour), N = TR.pool.length;
  TR.target = Math.round(N * busy); TR.htarget = Math.round(TR.hpool.length * Math.min(1, busyAt('crowd', TIME.hour) * 1.4));
  let act = 0; for (const v of TR.pool) if (v.on) act++;
  let hact = 0; for (const v of TR.hpool) if (v.on) hact++;
  const nextOff = pool => { for (let k = 0; k < pool.length; k++) { const v = pool[(pool.cursor = ((pool.cursor || 0) + 1) % pool.length)]; if (!v.on) return v; } return null; };
  if (TR.target - act > N * 0.12 || first) {           // after a jump in time: fill the streets out of sight
    for (let n = 0; n < (first ? N : 14) && act < TR.target; n++) { const v = nextOff(TR.pool); if (v && startMidRoute(v, first)) act++; }
  } else if (act < TR.target && TR.clock >= TR.spawnAt) {
    const v = nextOff(TR.pool); if (v && startFromOrigin(v)) act++;
    TR.spawnAt = TR.clock + 0.15;
  } else if (act > TR.target + N * 0.12) {
    for (const v of TR.pool) if (v.on && act > TR.target + N * 0.06 && unseen(v.x, v.z, 6, VEH_FAR)) { vehicleOff(v); act--; }
  }
  if (hact < TR.htarget && (first || TR.clock >= TR.hspawnAt)) {
    const n0 = first ? TR.hpool.length : TR.htarget - hact > 4 ? 3 : 1;
    for (let n = 0; n < n0 && hact < TR.htarget; n++) { const v = nextOff(TR.hpool); if (v && startHeritage(v, first)) hact++; }
    TR.hspawnAt = TR.clock + (n0 > 1 ? 0.2 : 1.5);
  } else if (hact > TR.htarget + 2) {                      // evening over: carriages go home out of sight
    for (const v of TR.hpool) if (v.on && v.mode !== UTURN && hact > TR.htarget && unseen(v.x, v.z, 6, VEH_FAR)) { vehicleOff(v); hact--; }
  }
  TR.active = act; TR.hactive = hact;
}

function spawnVehicles() {
  prepTraffic();
  const N = Math.round(250 * Q.cars);
  for (let i = 0; i < N; i++) makeVehicle(R() < 0.8 ? rpick(MIX_MAIN) : rpick(MIX_LANE), false);
  if (TR.stands.filter(st => st.heritage).length >= 2) for (let i = 0; i < 26; i++) makeVehicle(i % 5 < 3 ? 'tonga' : 'baggi', true);   // the heritage road's horse carriages
  balanceTraffic(true);
  if (SPOKE.instanceColor) SPOKE.instanceColor.needsUpdate = true; if (ALEG.instanceColor) ALEG.instanceColor.needsUpdate = true;
}

/* ───────────── junctions: one movement at a time through any crossing paths ───────────── */
function curveGeom(A, B, latA, latB, r, maxIn) {
  const t = turnInfo(A, B), rr = Math.min(r, Math.max(1.2, t.th * r * 0.9)), shift = Math.abs(latA - latB) * 0.8;
  const aIn = Math.min(maxIn, A.len * 0.5, rr + Math.abs(latA) * t.tanH + 0.4 + shift), aOut = Math.min(B.len * 0.5, rr + Math.abs(latB) * t.tanH + 0.4 + shift);
  const p0 = lanePoint(A, A.len - aIn, latA, [0, 0, 0, 0]), p3 = lanePoint(B, aOut, latB, [0, 0, 0, 0]), k = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) * 0.4;
  const radius = Math.max(2.2, Math.min(aIn, aOut) / Math.max(t.tanH, 0.06));
  return { A, B, latB, aIn, aOut, s0: A.len - aIn, D: aIn + aOut, vmax: Math.sqrt(2 * radius), P: [p0[0], p0[1], p0[0] + p0[2] * k, p0[1] + p0[3] * k, p3[0] - p3[2] * k, p3[1] - p3[3] * k, p3[0], p3[1]] };
}
function bez(P, u, out) {
  const a = 1 - u, b0 = a * a * a, b1 = 3 * a * a * u, b2 = 3 * a * u * u, b3 = u * u * u;
  out[0] = b0 * P[0] + b1 * P[2] + b2 * P[4] + b3 * P[6]; out[1] = b0 * P[1] + b1 * P[3] + b2 * P[5] + b3 * P[7];
  out[2] = 3 * a * a * (P[2] - P[0]) + 6 * a * u * (P[4] - P[2]) + 3 * u * u * (P[6] - P[4]);
  out[3] = 3 * a * a * (P[3] - P[1]) + 6 * a * u * (P[5] - P[3]) + 3 * u * u * (P[7] - P[5]);
  return out;
}
/** the path a typical car takes through junction J from link A to link B, as points */
function movePath(J, A, B) {
  const key = A.id + '>' + B.id; let pts = J.paths.get(key);
  if (pts) return pts;
  const t = turnInfo(A, B), lane = t.th > 0.5 && t.cross < 0 ? 1 : 0, latA = laneLat(A, A.wide ? lane : 0, 1.7), latB = laneLat(B, B.wide ? lane : 0, 1.7);
  const g = curveGeom(A, B, latA, latB, 4.5, A.len * 0.5), q = [0, 0, 0, 0];
  pts = [...lanePoint(A, Math.max(0, g.s0 - 3), latA, q).slice(0, 2)];
  for (let i = 0; i <= 8; i++) { bez(g.P, i / 8, q); pts.push(q[0], q[1]); }
  pts.push(...lanePoint(B, Math.min(B.len, g.aOut + 3), latB, q).slice(0, 2));
  J.paths.set(key, pts);
  return pts;
}
function segSeg(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx), d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx), d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
  return Math.min(segDist(ax, az, cx, cz, dx, dz), segDist(bx, bz, cx, cz, dx, dz), segDist(cx, cz, ax, az, bx, bz), segDist(dx, dz, ax, az, bx, bz));
}
function conflict(J, m1, m2) {
  if (m1.A === m2.A) return false;                 // one behind the other: the vehicle ahead is simply followed
  if (m1.B === m2.B) return true;                  // both joining the same lane
  const key = m1.A.id + ',' + m1.B.id + ',' + m2.A.id + ',' + m2.B.id; let c = J.cache.get(key);
  if (c === undefined) {
    const a = movePath(J, m1.A, m1.B), b = movePath(J, m2.A, m2.B); c = false;
    for (let i = 0; i + 3 < a.length && !c; i += 2) for (let j = 0; j + 3 < b.length; j += 2) if (segSeg(a[i], a[i + 1], a[i + 2], a[i + 3], b[j], b[j + 1], b[j + 2], b[j + 3]) < 1.8) { c = true; break; }
    J.cache.set(key, c); J.cache.set(m2.A.id + ',' + m2.B.id + ',' + m1.A.id + ',' + m1.B.id, c);
  }
  return c;
}
/** how far before its junction a link's traffic must wait: clear of the junction, and back where it still runs apart
    from any other road coming in (two one-way roads merging at a shallow angle meet well before the node) */
function stopBack(L) {
  if (L.stop !== undefined) return L.stop;
  const J = NET.nodes[L.to].J; let d = J ? J.r + 0.4 : 0;
  if (J) {
    const la = laneLat(L, 0, 1.7), a = [0, 0, 0, 0], b = [0, 0, 0, 0];
    for (const M of NET.nodes[L.to].inn) {
      if (M === L || M.e === L.e) continue;
      const lm = laneLat(M, 0, 1.7);
      for (let k = 0; k < 30; k++) {
        const back = d + k; if (back > Math.min(L.len, M.len) * 0.8) break;
        lanePoint(L, L.len - back, la, a); lanePoint(M, M.len - back, lm, b);
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 3.4) { d = Math.max(d, back); break; }
      }
    }
  }
  return (L.stop = Math.min(d, L.len * 0.8));
}
const stopGap = v => v.L.len - stopBack(v.L) - (v.s + v.len / 2);
/** is there room beyond the junction to get clear of it? Don't block the box. */
function exitRoom(v, J) {
  let need = J.r + v.len + 2;
  for (let k = v.ri + 1; k < v.route.length && need > 0; k++) {
    const M = v.route[k], la = laneLat(M, M.wide ? v.lane : 0, v.wid);
    for (const u of M.q) if (u !== v && u.v < 1.5 && u.s - u.len / 2 < need && (u.mode === UTURN || Math.abs(u.lat - la) < (u.wid + v.wid) / 2 + 0.35)) return false;
    need -= M.len;
  }
  return true;
}
/** may `v` enter junction J now? Not while a crossing movement is inside, nor ahead of someone with right of way */
function canGo(v, J) {
  for (const o of J.occ) if (o !== v && conflict(J, v.mv, o.jmv)) return false;
  if (!exitRoom(v, J)) return false;
  for (const u of J.appr) {
    if (u === v || !conflict(J, v.mv, u.mv)) continue;
    const ut = Math.max(0, stopGap(u)) / Math.max(u.v, 0.8);
    if (ut > 4 && u.wait <= 0) continue;
    if (u.L.rank > v.L.rank + 0.1) { if (v.wait > 12 && ut > 1.6) continue; return false; }     // the bigger road goes first
    if (u.L.rank < v.L.rank - 0.1) continue;
    if (u.arr >= 0 && (v.arr < 0 || u.arr < v.arr - 0.05 || (Math.abs(u.arr - v.arr) <= 0.05 && u.id < v.id))) { if (v.wait > 14) continue; return false; }   // then first come, first served
  }
  return true;
}
function grant(v, J) { if (v.jg === J) return; release(v); J.occ.push(v); v.jg = J; v.jmv = v.mv; v.jgB = v.mv.B; v.wait = 0; }

/* ───────────── driving ───────────── */
const GRID = new Map(), CELL = 12;
const cellKey = (x, z) => Math.floor(x / CELL) * 8192 + Math.floor(z / CELL);
function gridBuild(V) {
  for (const list of GRID.values()) list.length = 0;
  for (const v of V) { if (!v.on) continue; const k = cellKey(v.x, v.z); let l = GRID.get(k); if (!l) GRID.set(k, l = []); l.push(v); }
}
// who goes first when two vehicles each have the other in front: one already in a junction, a U-turn under way, the bigger road
const precedence = v => (v.mode === UTURN ? 40 : 0) + (v.jg ? 20 : 0) + (v.L ? v.L.rank : 0) - v.id * 1e-4;
/** brake for any vehicle close in front, including ones on other links (junction clusters, merges, curves) */
function safety(v, term) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), look = v.len / 2 + 2.5 + v.v * 1.2, cx = Math.floor(v.x / CELL), cz = Math.floor(v.z / CELL), pv = precedence(v);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = GRID.get((cx + i) * 8192 + cz + j); if (!list) continue;
    for (const u of list) {
      if (u === v || !u.on) continue;
      if (v.jg && v.stuck > 3 && !u.jg && u.mode === DRIVE && u.v < 0.3 && u.mv && NET.nodes[u.L.to].J === v.jg && stopGap(u) > -0.5) continue;   // they wait for us: no deadlock
      const dx = u.x - v.x, dz = u.z - v.z, ah = dx * fx + dz * fz;
      if (ah <= 0 || ah > look + u.len / 2) continue;
      const ux = Math.sin(u.yaw), uz = Math.cos(u.yaw), c = Math.abs(ux * fx + uz * fz), sn = Math.sqrt(Math.max(0, 1 - c * c));
      if (Math.abs(dx * fz - dz * fx) > v.wid / 2 + u.len / 2 * sn + u.wid / 2 * c + 0.25) continue;
      const bh = -dx * ux - dz * uz;                                   // does u have v in front too? Then whoever is further into the other's path goes first
      if (bh > 0 && bh < u.len / 2 + 2.5 + u.v * 1.2 + v.len / 2 && Math.abs(dx * uz - dz * ux) < u.wid / 2 + v.len / 2 * sn + v.wid / 2 * c + 0.25
          && (bh > ah + 1 || (Math.abs(bh - ah) <= 1 && precedence(u) < pv))) continue;
      term(Math.max(0.05, ah - v.len / 2 - (u.len / 2 * c + u.wid / 2 * sn)), Math.max(0, u.v * (ux * fx + uz * fz)));
    }
  }
}
const _ld = { gap: 0, v: 0, u: null }, _lo = { gap: 0, v: 0, u: null };
/** nearest vehicle ahead whose body overlaps lateral position `lat` (looking on along the route) */
function leaderOf(v, lat, out) {
  let gap = 1e9, sp = 0, who = null; const L = v.L, w2 = v.wid / 2 + 0.35;
  for (const u of L.q) {
    if (u === v || u.s <= v.s) continue;
    if (u.mode !== UTURN && Math.abs(u.lat - lat) > u.wid / 2 + w2) continue;
    const g = u.s - v.s - (u.len + v.len) / 2; if (g < gap) { gap = g; sp = u.v; who = u; }
  }
  let ahead = L.len - v.s; const look = 25 + v.v * 3;
  for (let k = v.ri + 1; k < v.route.length && ahead < look && ahead < gap; k++) {
    const M = v.route[k], la = laneLat(M, M.wide ? v.lane : 0, v.wid);
    for (const u of M.q) {
      if (u === v || (u.mode !== UTURN && Math.abs(u.lat - la) > u.wid / 2 + w2)) continue;
      const g = ahead + u.s - (u.len + v.len) / 2; if (g < gap) { gap = g; sp = u.v; who = u; }
    }
    ahead += M.len;
  }
  out.gap = gap; out.v = sp; out.u = who; return out;
}
function rearClear(v, L, lat) {
  for (const u of L.q) {
    if (u === v || u.s > v.s || (u.mode !== UTURN && Math.abs(u.lat - lat) > (u.wid + v.wid) / 2 + 0.35)) continue;
    if (v.s - u.s - (u.len + v.len) / 2 < Math.max(2.5, u.v * 1.0 - v.v * 0.5)) return false;
  }
  return true;
}
const oncomingClear = (L, s, dist) => { for (const u of L.opp.q) { const p = L.len - u.s; if (p > s - 4 && p < s + dist) return false; } return true; };
const nearGate = (v, r) => GATES.some(g => Math.abs(v.x - g.x) < r && Math.abs(v.z - g.z) < r && Math.hypot(v.x - g.x, v.z - g.z) < r);
/** on a two-lane carriageway: pass slow vehicles, keep left when free, and get into lane for a turn or a stand */
function laneChoice(v, L, next, ld, v0, st, dt) {
  if ((v.think -= dt) > 0) return;
  v.think = 0.6 + R() * 0.5;
  if (L.len - v.s < 12 || nearGate(v, 42)) return;
  const other = 1 - v.lane, latO = laneLat(L, other, v.wid), t = next && turnInfo(L, next), toEnd = L.len - v.s;
  const need = st && st.s - v.s < 90 ? 1 : t && t.th > 0.5 && toEnd < 70 ? (t.cross < 0 ? 1 : 0) : -1;   // left turns and stands from the kerb lane
  let want;
  if (need >= 0) want = other === need;
  else {
    const lo = leaderOf(v, latO, _lo);
    want = (ld.gap < 22 && ld.v < v0 - 1.2 && (lo.gap > ld.gap + 10 || lo.v > ld.v + 1.5)) || (other === v.pref && lo.gap > 35 && (ld.gap > 35 || lo.v >= ld.v));
  }
  if (!want || leaderOf(v, latO, _lo).gap < 3 + v.v * 0.4 || !rearClear(v, L, latO)) return;
  v.lane = other;
}
/** on a narrow two-way street: go round a slow cart when nothing is coming the other way */
function overtake(v, L, ld, v0) {
  if (v.ot) { const o = v.ot; if (o.L !== L || !o.on || v.s > o.s + (o.len + v.len) / 2 + 2.5 || L.len - v.s < 10 || !oncomingClear(L, v.s, 22)) v.ot = null; return; }
  const u = ld.u;
  if (!L.opp || !u || u.L !== L || u.mode !== DRIVE || ld.gap > 9 || u.vmax > v0 * 0.55 || L.len - v.s < 45 || L.e.w < 4.5 || !oncomingClear(L, v.s, 75)) return;
  v.ot = u;
}
function drive(v, dt, P, pa) {
  const L = v.L, next = v.route[v.ri + 1] || null, K = v.k;
  let v0 = Math.min(v.vmax, L.limit), block = 0;
  const term = (gap, lv) => { const ss = K.s0 + Math.max(0, v.v * K.T + v.v * (v.v - lv) / (2 * Math.sqrt(K.a * 2.6))), q = ss / Math.max(gap, 0.05); if (q * q > block) block = q * q; };
  const st = v.stand && !v.served && v.stand.L === L ? v.stand : null;
  if (st && st.s - v.s < 75 && standLoad(st) > (v.heritage ? 46 : 26)) v.served = true;   // stand full: drive on
  const ld = leaderOf(v, v.lat, _ld);
  if (ld.gap < 1e8) term(ld.gap, ld.v);
  safety(v, term);
  if (!v.cv) { if (L.wide) laneChoice(v, L, next, ld, v0, st, dt); else overtake(v, L, ld, v0); }
  // where across the road to be
  let latT = laneLat(L, L.wide ? v.lane : 0, v.wid);
  if (st && !v.served && st.s - v.s < 55) latT = kerbLat(L, v.wid);
  if (v.ot) latT = Math.max(-L.e.w / 2 + v.wid / 2 + 0.2, laneLat(L, 0, v.wid) - (v.ot.wid + v.wid) / 2 - 0.45);
  if (L.e.main && !L.e.one) for (const g of GATES) {                                   // through the gateways' arches: the kerb lane takes a side arch
    const dd = Math.hypot(v.x - g.x, v.z - g.z); if (dd > 34) continue;
    const k = smooth(1 - dd / 34); latT = latT > 3.2 ? lerp(latT, 8.3, k) : lerp(latT, Math.min(latT, 3.75 - v.wid / 2 - 0.3), k);
  }
  v.latT = latT;
  // slow for the turn ahead, then hold the curve's speed through it
  if (v.cv) v0 = Math.min(v0, v.cv.vmax);
  else if (next) {
    const t = turnInfo(L, next), latB = laneLat(next, next.wide ? v.lane : 0, v.wid), rr = Math.min(K.r, Math.max(1.2, t.th * K.r * 0.9));
    const aIn = Math.min(L.len * 0.5, rr + Math.abs(v.lat) * t.tanH + 0.4 + Math.abs(v.lat - latB) * 0.8);
    if (t.th > 0.2) { const vc = Math.sqrt(2 * Math.max(2.2, rr / Math.max(t.tanH, 0.06))); v0 = Math.min(v0, Math.sqrt(vc * vc + 4 * Math.max(0, L.len - aIn - v.s))); }
    if (L.len - v.s <= aIn) v.cv = curveGeom(L, next, v.lat, latB, K.r, L.len - v.s);
  }
  // junction: wait at the line until it is our turn
  const J = next && NET.nodes[L.to].J;
  if (J && v.jg !== J) {
    if (!v.mv || v.mv.A !== L || v.mv.B !== next) v.mv = { A: L, B: next };
    const g = stopGap(v);
    if (g < 25 && v.arr < 0) v.arr = TR.clock;
    if (g < 30) {
      if (canGo(v, J)) { if (g < v.v * v.v / 5.2 + 4) grant(v, J); }
      else { term(Math.max(g, 0.05), 0); if (v.v < 0.4) v.wait += dt; }
    }
  }
  // pull in at the stand
  if (st && !v.served) {
    const g = st.s - (v.s + v.len / 2);
    if (g < -2) v.served = true;
    else {
      term(Math.max(g + 0.6, 0.05), 0);
      if (v.v < 0.3 && (g < 1.5 || (ld.u && ld.u.mode === DWELL && ld.gap < 3 && g < 30))) { v.mode = DWELL; v.v = 0; v.served = true; v.lastStand = st; const use = STAND_USE[v.type]; v.timer = lerp(use[1], use[2], R()); }
    }
  }
  // people on the carriageway, and the visitor on foot
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), C = TR.crossers, reach = v.len / 2 + 7 + v.v * 2;
  for (let i = 0; i < C.length; i += 2) {
    const dx = C[i] - v.x, dz = C[i + 1] - v.z, ah = dx * fx + dz * fz;
    if (ah > 0 && ah < reach && Math.abs(dx * fz - dz * fx) < v.wid / 2 + 0.9) term(Math.max(0.05, ah - v.len / 2 - 1.0), 0);
  }
  if (pa) { const dx = P.x - v.x, dz = P.z - v.z, ah = dx * fx + dz * fz; if (ah > 0 && ah < v.len / 2 + 6.5 && Math.abs(dx * fz - dz * fx) < 1.7) term(Math.max(0.05, ah - v.len / 2 - 1.2), 0); }
  // accelerate or brake (Intelligent Driver Model), then move
  const free = v.v <= v0 ? K.a * (1 - Math.pow(v.v / Math.max(v0, 0.3), 4)) : -Math.min(4, 1.5 * (v.v - v0));
  v.v = Math.max(0, v.v + clamp(free - K.a * block, -9, K.a) * dt);
  v.s += v.v * dt;
  if (!v.cv) { const step = clamp((v.latT - v.lat) * (1 - Math.exp(-dt * 2.2)), -1.4 * dt, 1.4 * dt); v.lat += step; v.latV = step / dt; } else v.latV = 0;
  v.stuck = v.v < 0.05 ? v.stuck + dt : 0;
  advance(v);
}
function advance(v) {
  while (v.on && v.s >= v.L.len) {
    const A = v.L, B = v.route[v.ri + 1];
    if (!B) { if (!endOfRoute(v)) return; continue; }
    const J = NET.nodes[A.to].J;
    if (J && v.jg !== J) { v.mv = { A, B }; grant(v, J); }
    const over = v.s - A.len; quitLink(v); v.ri++; joinLink(v, B, Math.min(over, B.len - 0.01));
    v.lat = v.latT = v.cv && v.cv.B === B ? v.cv.latB : laneLat(B, B.wide ? v.lane : 0, v.wid);
    v.mv = null; v.arr = -1; v.wait = 0; v.ot = null;
  }
  if (!v.on) return;
  if (v.jg) { const onB = v.L === v.jgB; if ((onB && v.s > v.jg.r + v.len / 2 + 0.5) || (!onB && v.L !== v.jmv.A)) release(v); }
  if (v.cv) { const c = v.cv, u = (v.L === c.A ? v.s - c.s0 : c.A.len - c.s0 + v.s) / c.D; if (u >= 1 || (v.L !== c.A && v.L !== c.B)) v.cv = null; }
}
/** at the end of the route: leave the map, or (in view, in the old city) carry on to somewhere else */
function endOfRoute(v) {
  const nd = NET.nodes[v.L.to];
  if (nd.exit || unseen(v.x, v.z, 5, VEH_FAR)) { vehicleOff(v); return false; }
  const outs = nd.out.filter(M => M.e !== v.L.e && canUse(v, M)), M = outs.length ? rpick(outs) : null;
  if (!M || !planTrip(v, M, 0)) { vehicleOff(v); return false; }
  v.route.unshift(v.L); v.ri = 0;
  return true;
}
function dwell(v, dt) {
  v.v = 0; v.timer -= dt; v.stuck = 0;
  const step = clamp((v.latT - v.lat) * (1 - Math.exp(-dt * 2.2)), -1.4 * dt, 1.4 * dt); v.lat += step; v.latV = step / dt;
  if (v.timer > 0) return;
  if (v.heritage) {
    if (TR.hactive > TR.htarget && unseen(v.x, v.z, 6, VEH_FAR)) { vehicleOff(v); return; }
    const L = v.L;
    if (L.opp) {
      if (!oncomingClear(L, v.s, 34)) { v.timer = 1; return; }
      const c = linkAt(L, v.s, [0, 0, 0, 0]);
      v.ut = { O: L.opp, s2: L.len - v.s, cx: c[0], cz: c[1], tx: c[2], tz: c[3], r: Math.max(2.5, Math.abs(v.lat)), phi: 0 };
      v.ghost = { s: v.ut.s2, len: v.len + 2, v: 0, lat: 0, wid: 9, mode: UTURN, on: true };
      L.opp.q.push(v.ghost); v.mode = UTURN; v.cv = null;
      return;
    }
    if (planTrip(v, L, v.s)) { v.mode = DRIVE; v.latT = laneLat(L, L.wide ? v.lane : 0, v.wid); } else v.timer = 5;
    return;
  }
  const lat = laneLat(v.L, v.L.wide ? v.lane : 0, v.wid);
  if (!rearClear(v, v.L, lat)) { v.timer = 0.4; return; }
  v.mode = DRIVE; v.latT = lat;
}
function uturn(v, dt) {
  const u = v.ut, arc = Math.PI * u.r * 0.85;
  v.v = 1.6; u.phi += v.v * dt / arc * Math.PI;
  if (u.phi < Math.PI) return;
  dropGhost(v); quitLink(v); joinLink(v, u.O, u.s2);
  v.lat = u.r; v.mode = DRIVE; v.cv = null; v.v = 0.8;
  if (!planTrip(v, u.O, u.s2)) { v.route = [u.O]; v.ri = 0; }
  v.ut = null; v.latT = laneLat(v.L, v.L.wide ? v.lane : 0, v.wid);
}

/* ───────────── pose: position on the road, wheels and hooves ───────────── */
const _pq = [0, 0, 0, 0];
function poseVehicle(v, dt, t, lit, ta, sa) {
  let x, z, hx, hz;
  if (v.mode === UTURN) {
    const u = v.ut, nx = u.tz, nz = -u.tx, c = Math.cos(u.phi), s = Math.sin(u.phi), f = 0.7;
    x = u.cx + nx * u.r * c + u.tx * u.r * f * s; z = u.cz + nz * u.r * c + u.tz * u.r * f * s;
    hx = -nx * s + u.tx * f * c; hz = -nz * s + u.tz * f * c;
  } else if (v.cv && (v.L === v.cv.B || v.s >= v.cv.s0)) {
    const c = v.cv, u = clamp((v.L === c.A ? v.s - c.s0 : c.A.len - c.s0 + v.s) / c.D, 0, 1);
    bez(c.P, u, _pq); x = _pq[0]; z = _pq[1]; hx = _pq[2]; hz = _pq[3];
  } else {
    const L = v.L, w = Math.max(2.5, Math.abs(v.lat) + 1), a = linkAt(L, v.s, _pq), cx = a[0], cz = a[1];
    let tx = a[2], tz = a[3];
    const b = linkAt(L, v.s - w, _lb), c = linkAt(L, v.s + w, _lc), dx = c[0] - b[0], dz = c[1] - b[1], l = Math.hypot(dx, dz);
    if (l > 0.5) { tx = dx / l; tz = dz / l; }
    x = cx + tz * v.lat; z = cz - tx * v.lat;
    hx = v.v * tx + v.latV * tz; hz = v.v * tz - v.latV * tx;                     // steer into a lane change
    if (Math.hypot(hx, hz) < 0.05) { hx = tx; hz = tz; }
  }
  const yaw = Math.atan2(hx, hz);
  if (v.snap || !Number.isFinite(v.yaw)) { v.yaw = yaw; v.snap = false; }
  else { let dy = yaw - v.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; v.yaw += dy * (1 - Math.exp(-dt * 10)); }
  v.x = x; v.z = z;
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), bob = v.horse ? Math.abs(Math.sin(t * 7.5 + v.ph)) * 0.035 * Math.min(1, v.v) : 0, m = v.mesh.matrix.elements;
  m[0] = cy; m[2] = -sy; m[8] = sy; m[10] = cy; m[12] = x; m[13] = bob; m[14] = z; v.mesh.matrixWorld.copy(v.mesh.matrix);
  if (v.lm) { v.lm.visible = lit; if (lit) { v.lm.matrix.copy(v.mesh.matrix); v.lm.matrixWorld.copy(v.mesh.matrix); } }
  v.roll += v.v * dt;
  for (let k = 0; k < v.wheels.length; k++) { const w = v.wheels[k]; setLimb(w[4] ? sa : ta, v.w0[k], x, 0, z, cy, sy, w[0], w[2], w[1], v.roll / w[2], w[3], w[2], w[2]); }
  if (v.l0 >= 0) quadLegs(v.l0, x, bob, z, cy, sy, v.horse[0], v.roll * 2.6 + v.ph, 0.5 * Math.min(1, v.v / 1.5));
}

function updateTraffic(dt, t) {
  if (!(dt > 0)) return;                                       // a paused clock moves nothing
  dt = Math.min(dt, 0.1); TR.clock += dt;
  viewUpdate();
  balanceTraffic(false);
  const V = LIFE.vehicles, P = LIFE.player, pa = !!(P && P.active), ta = TYRE.instanceMatrix.array, sa = SPOKE.instanceMatrix.array, lit = TIME.night > 0.35;
  for (const J of TR.junctions) J.appr.length = 0;
  for (const v of V) {                                         // who is coming up to each junction
    if (!v.on || v.mode !== DRIVE) continue;
    const next = v.route[v.ri + 1], J = next && NET.nodes[v.L.to].J;
    if (J && v.jg !== J && stopGap(v) < 30) { if (!v.mv || v.mv.A !== v.L || v.mv.B !== next) v.mv = { A: v.L, B: next }; J.appr.push(v); }
  }
  gridBuild(V);
  let n = 0;
  for (const v of V) {
    if (!v.on) continue;
    if (v.mode === DWELL) dwell(v, dt); else if (v.mode === UTURN) uturn(v, dt); else drive(v, dt, P, pa);
    if (!v.on) continue;
    if (v.stuck > 45 && unseen(v.x, v.z, 6, VEH_FAR)) { vehicleOff(v); continue; }     // a rare tangle clears itself out of sight
    poseVehicle(v, dt, t, lit, ta, sa); n++;
  }
  LIFE.nVeh = n;
}
