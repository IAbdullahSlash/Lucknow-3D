'use strict';
/* traffic.js — vehicles make real trips across the street graph instead of turning at random.
   Each one drives from where it enters the map to where it leaves (or to a lane in the old city), keeps
   left, follows the vehicle ahead with the Intelligent Driver Model, changes lanes or overtakes slow carts,
   turns along smooth curves, takes its turn at junctions (bigger road first, then first come), stops at
   auto, bus and tonga stands, waits for people crossing, and only appears or leaves out of the camera's view. */

const TR = {
  links: [], junctions: [], stands: [], exits: [], locals: [], corridor: [], pool: [], hpool: [],
  clock: 0, frame: 0, K: 1, jamAt: 0, jamM: 12, courtesy: 20, spawnAt: 0, hspawnAt: 0, cursor: 0, target: 0, htarget: 0, active: 0,
  crossers: [],                         // people on a carriageway, as x, z pairs; written by crowd.js each frame
  blockers: [],                         // a procession on the road, as x, z pairs; written by festival.js each frame
  closedOn: false,                      // the heritage road is shut to vehicles (the Muharram procession)
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
  if (L.sh0 || L.sh1) {                                        // a dual carriageway's branch, moved over to its own side where it meets the single road
    const sh = L.sh0 * Math.max(0, 1 - s / SPLIT_BLEND) + L.sh1 * Math.max(0, 1 - (L.len - s) / SPLIT_BLEND);
    out[0] += out[3] * sh; out[1] -= out[2] * sh;
  }
  return out;
}
const SPLIT_BLEND = 15;
/** ...and its two lanes drawn closer together there, so the outer one stays on the road */
const latK = (L, s) => 1 - 0.4 * (Math.max(0, 1 - s / SPLIT_BLEND) * (L.sh0 ? 1 : 0) + Math.max(0, 1 - (L.len - s) / SPLIT_BLEND) * (L.sh1 ? 1 : 0));
/** the point `lat` metres to the left of a link's centre line (traffic keeps left) */
function lanePoint(L, s, lat, out = _la) { linkAt(L, s, out); if (L.sh0 || L.sh1) lat *= latK(L, s); out[0] += out[3] * lat; out[1] -= out[2] * lat; return out; }
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
        wide: e.one ? e.w >= 6 : e.w >= 9, opp: null, turns: new Map(), t0: [0, 0], t1: [0, 0], jam: 0, closed: false, stop: undefined, sh0: 0, sh1: 0 };
      const h = Math.min(4, L.len), a = linkAt(L, 0, _lb), b = linkAt(L, h, _lc);
      let dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; L.t0 = [dx / l, dz / l];
      const c1 = linkAt(L, L.len - h, _lb), c2 = linkAt(L, L.len, _lc);
      dx = c2[0] - c1[0]; dz = c2[1] - c1[1]; l = Math.hypot(dx, dz) || 1; L.t1 = [dx / l, dz / l];
      e.lk[d > 0 ? 0 : 1] = L; TR.links.push(L);
      NET.nodes[L.from].out.push(L); NET.nodes[L.to].inn.push(L);
    }
    if (e.lk[0] && e.lk[1]) { e.lk[0].opp = e.lk[1]; e.lk[1].opp = e.lk[0]; }
  }
  // Where a dual carriageway meets a single road, the map joins both branches' centre lines to the road's at one point,
  // so each branch's inner lane crossed the centre line there and the two streams ran through each other for 12 m (the
  // food court junction worked like a scissors crossing). Near that point each branch moves over to its own half.
  for (const L of TR.links) {
    if (!L.e.one) continue;
    for (const atEnd of [false, true]) {
      const n = atEnd ? L.to : L.from, nd = NET.nodes[n];
      const C = (atEnd ? nd.out : nd.inn).find(M => !M.e.one && M.wide && M.e !== L.e && (atEnd ? turnInfo(L, M) : turnInfo(M, L)).th < 0.7);   // the single road, carrying on (wide enough for a lane each way)
      const pair = (atEnd ? nd.out : nd.inn).some(M => M.e.one && M.e !== L.e && (atEnd ? L.t1[0] * M.t0[0] + L.t1[1] * M.t0[1] : M.t1[0] * L.t0[0] + M.t1[1] * L.t0[1]) < -0.3);   // the other branch, going the other way
      if (C && pair) L[atEnd ? 'sh1' : 'sh0'] = 0.245 * C.e.w;
    }
  }
  NET.nodes.forEach((nd, n) => {
    const edges = new Set([...nd.out, ...nd.inn].map(L => L.e));
    if (edges.size >= 3) { let r = 0; for (const e of edges) r = Math.max(r, e.w / 2); nd.r = r + 1; nd.isJ = true; }
    const weight = L => ({ primary: 5, secondary: 4, main: 3, tertiary: 3, residential: 0.8, minor: 0.4 })[L.cls];
    if (nd.exit && (nd.out.length || nd.inn.length)) TR.exits.push({ n, out: nd.out, w: weight(nd.out[0] || nd.inn[0]) });
    else if (!nd.exit && nd.out.length && nd.inn.length && nd.inn.some(L => L.cls === 'residential') && inFocus(nd.x, nd.z, -20)) TR.locals.push(n);
  });
  // junction points joined by short links (the mapped corners of one crossing) act as a single junction:
  // a vehicle takes the whole cluster at once and holds it until it has driven out of the far side
  const up = new Map(), root = n => { while (up.get(n) !== n) { up.set(n, up.get(up.get(n))); n = up.get(n); } return n; };
  NET.nodes.forEach((nd, n) => { if (nd.isJ) up.set(n, n); });
  const members = n => [...up.keys()].filter(k => root(k) === root(n));
  for (const L of TR.links) {
    if (L.len > 20 || !up.has(L.from) || !up.has(L.to) || root(L.from) === root(L.to)) continue;
    const all = [...members(L.from), ...members(L.to)]; let span = 0;
    for (const a of all) for (const b of all) span = Math.max(span, Math.hypot(NET.nodes[a].x - NET.nodes[b].x, NET.nodes[a].z - NET.nodes[b].z));
    if (span < 45) up.set(root(L.from), root(L.to));
  }
  const groups = new Map();
  for (const n of up.keys()) { const r = root(n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(n); }
  for (const list of groups.values()) {
    const J = { n: list[0], nodes: new Set(list), x: 0, z: 0, r: 0, occ: [], appr: [], cache: new Map(), paths: new Map(), clear: new Map(), enter: new Map() };
    for (const n of list) { const nd = NET.nodes[n]; J.x += nd.x / list.length; J.z += nd.z / list.length; J.r = Math.max(J.r, nd.r); nd.J = J; }
    TR.junctions.push(J);
  }
  TR.K = TR.links.length + 1;                                   // for numeric cache keys of link pairs
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
/* A stand needs its waiting line to fit on its own link: the line runs back from the stand and must stop short of the
   junction the link leaves, and the stand itself must stay clear of the queue for the junction ahead. A stand squeezed
   between two junctions parks carriages in the crossing and blocks it (the Clock Tower junction did, every evening). */
const STAND_ROOM = { heritage: 20, other: 12 };          // metres of waiting line wanted behind the stand: three carriages, three autos
const boxEnd = L => { const nd = NET.nodes[L.from]; return nd.J ? nd.r + 7 : 4; };
function buildStands() {
  for (const site of standSites()) {
    if (!site.p) continue;
    const [px, pz] = site.p, room = site.heritage ? STAND_ROOM.heritage : STAND_ROOM.other;
    let best = null, bd = 90;
    for (const L of TR.links) {
      if (!L.wide || L.len < 34 || (site.heritage && !(L.e.main && L.opp))) continue;
      let lo = boxEnd(L) + room, hi = L.len - stopBack(L) - 6;
      if (site.heritage) { const O = L.opp; lo = Math.max(lo, stopBack(O) + 6); hi = Math.min(hi, O.len - boxEnd(O) - room); }   // and across the road
      if (lo > hi) continue;
      const p = L.e.pl.p, cum = L.e.pl.cum; let dmin = 1e9, se = 0;
      for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1), d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
        if (d < dmin) { dmin = d; se = cum[i / 2] + Math.sqrt(l2) * t; }
      }
      const s0 = L.d > 0 ? se : L.len - se, s = clamp(s0, lo, hi), c = linkAt(L, s, _lb);
      if (GATES.some(g => Math.hypot(c[0] - g.x, c[1] - g.z) < 48)) continue;
      const left = (px - c[0]) * c[3] - (pz - c[1]) * c[2] > 0;
      const score = dmin + Math.abs(s - s0) + (left ? 0 : L.e.one ? 10 : 1e3);
      if (score < bd) { bd = score; best = { L, s }; }
    }
    if (!best) continue;
    const cap = (L, s) => Math.min(site.heritage ? 46 : 26, s - boxEnd(L));
    const at = lanePoint(best.L, best.s, kerbLat(best.L, 1.5), _lb);
    TR.stands.push({ id: site.id, L: best.L, s: best.s, cap: cap(best.L, best.s), x: at[0], z: at[1], heritage: !!site.heritage, w: site.w, users: new Set(site.users.split(' ')) });
    if (site.heritage && best.L.opp) {           // carriages also wait across the road, so they can ply both ways along it
      const O = best.L.opp, s2 = O.len - best.s, b = lanePoint(O, s2, kerbLat(O, 1.5), _lb);
      TR.stands.push({ id: site.id, L: O, s: s2, cap: cap(O, s2), x: b[0], z: b[1], heritage: true, w: site.w, users: new Set(['tonga', 'baggi']) });
    }
  }
}
const standLoad = st => { let m = 0; for (const u of st.L.q) if (u.mode === DWELL && u.stand === st) m += u.len + 1.2; return m; };
const standFull = (st, v) => standLoad(st) + v.len + 1.2 > st.cap;
/** a vehicle parked at a stand on M between s0 and s1, in the way of lane position `lat`, that `v` is not queuing for */
function parkedOn(v, M, lat, s0, s1) {
  for (const u of M.q) if (u.mode === DWELL && u.s + u.len / 2 > s0 && u.s - u.len / 2 < s1 && Math.abs(u.lat - lat) < (u.wid + v.wid) / 2 + 0.35 && !(u.stand === v.stand && !v.served)) return u;
  return null;
}

/* ───────────── routes: cheapest way along the links, with a little personal preference per driver ───────────── */
const RT = { dist: null, prev: null, stamp: null, gen: 0, heap: [] };
const canUse = (v, L) => L.e.w >= v.def.minW && !L.closed;
function linkCost(v, L) {
  const h = Math.sin(v.id * 12.9898 + L.id * 78.233) * 43758.5453;
  return L.len * L.cf * (v.local && L.cls === 'residential' ? 0.75 : 1) * (v.heritage && !L.e.main ? 5 : 1) * (0.85 + 0.35 * (h - Math.floor(h)))   // carriages keep to the heritage road where they can
    + L.jam;                                                     // and drivers keep off a road they can see is queued
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
/** does route r come back along a road it has already driven, the other way? (a loop to turn round) */
const backtracks = r => { const seen = new Set(); for (const L of r) { if (L.opp && seen.has(L.opp)) return true; seen.add(L); } return false; };
const routeCost = (v, r) => { let c = 0; for (let i = 1; i < r.length; i++) c += linkCost(v, r[i]) + 8 * (1 - turnInfo(r[i - 1], r[i]).dot); return c; };
function pickWeighted(list, wfn) { let tot = 0; for (const x of list) tot += wfn(x); let r = R() * tot; for (const x of list) { r -= wfn(x); if (r <= 0) return x; } return list[list.length - 1]; }
/** choose where this vehicle is going from (start, s0), maybe calling at a stand on the way */
function planTrip(v, start, s0) {
  v.stand = null; v.served = false;
  const passed = st => st.L === start && s0 > st.s - 4;
  if (v.heritage) {                              // tongas and baggis ply between the monuments' stands
    const opts = TR.stands.filter(st => st.heritage && !st.L.closed && st.id !== (v.lastStand && v.lastStand.id) && st.users.has(v.type) && !passed(st));
    for (let k = 0; k < 4 && opts.length; k++) {
      const st = rpick(opts), r = findRoute(v, start, st.L);
      if (r) { v.route = r; v.ri = 0; v.stand = st; return true; }
    }
    return false;
  }
  const use = STAND_USE[v.type];
  let st = null;
  if (use && R() < use[0]) { const opts = TR.stands.filter(q => q.users.has(v.type) && !q.L.closed && !passed(q)); if (opts.length) st = pickWeighted(opts, q => q.w); }
  for (let k = 0; k < 6; k++) {
    const dest = v.local && TR.locals.length && R() < 0.3 ? rpick(TR.locals) : pickWeighted(TR.exits, x => x.w).n;
    if (dest === start.from) continue;
    let r = null;
    if (st && st.L !== start) { const a = findRoute(v, start, st.L), b = a && findRoute(v, st.L, null, dest); if (a && b) r = a.concat(b.slice(1)); else st = null; }
    else if (!st && R() < 0.7 && TR.corridor.length && !TR.closedOn) {
      // visitors and errands along the heritage road, but only on the way: going back for it meant looping round the
      // one-way Khun Khun Ji Road and through the Clock Tower junction, which jammed it
      const d = findRoute(v, start, null, dest), cd = d ? routeCost(v, d) : 0;
      for (let t = 0; t < 3 && !r; t++) {
        const via = pickWeighted(TR.corridor, L => L.len); if (via === start) continue;
        const a = findRoute(v, start, via), b = a && findRoute(v, via, null, dest), c = a && b ? a.concat(b.slice(1)) : null;
        if (c && !backtracks(c) && (!d || routeCost(v, c) <= cd * 1.4 + 100)) r = c;
      }
      if (!r) r = d;
    }
    if (!r) r = findRoute(v, start, null, dest);
    if (r && !st && k < 4 && backtracks(r)) continue;            // somewhere that needs no loop round the block to reach (those loops fed the Clock Tower junction)
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
    ot: null, pk: null, ghost: null, ut: null, utWait: 0, think: R(), snap: true, stuck: 0, stall: 0, dest: -1,
    head: true, jgAt: 0, arcF: -1, arcM: null, arcJ: null, arcV: 0,   // declared up front: fields added later change the object's shape and slow every lookup
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
  Object.assign(v, { on: true, mode: DRIVE, cv: null, mv: null, arr: -1, wait: 0, ot: null, pk: null, utWait: 0, snap: true, stuck: 0, stall: 0, lat, latT: lat, latV: 0 });
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
    if (!L || !canUse(v, L) || (NET.nodes[L.to].J && inJ(NET.nodes[L.to].J, L.from))) continue;   // not out of a lane straight into a junction's middle
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
    const Jl = NET.nodes[L.to].J;
    if (Jl && (inJ(Jl, L.from) || s > L.len - stopBack(L) - v.len)) continue;      // not inside a junction or queuing for one
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
  const opts = TR.stands.filter(st => st.heritage && !st.L.closed && st.users.has(v.type)); if (!opts.length) return false;
  for (let k = 0; k < 4; k++) {
    const st = rpick(opts), s = st.s - standLoad(st) - v.len / 2 - R() * 0.6;
    if (standFull(st, v) || !spotFree(st.L, s, v)) continue;
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
  const hs = TR.stands.filter(st => st.heritage && !st.L.closed && st.users.has(v.type));
  for (let k = 0; k < 6 && hs.length; k++) {
    const a = rpick(hs); v.lastStand = a;
    if (!planTrip(v, a.L, a.s)) continue;
    let tot = 0; for (const L of v.route) tot += L.len;
    let r = a.s + R() * (tot - a.s), i = 0; while (i < v.route.length - 1 && r > v.route[i].len) r -= v.route[i++].len;
    const L = v.route[i], s = clamp(r, 1, L.len - 1), Jl = NET.nodes[L.to].J;
    if (L === v.stand.L && s > v.stand.s - 6) continue;
    if (Jl && (inJ(Jl, L.from) || s > L.len - stopBack(L) - v.len)) continue;      // not inside a junction or queuing for one
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

/** Shut the heritage road between the two Imambaras to vehicles, as the police do for the Muharram procession.
    New trips route round it; vehicles already on it leave once out of sight, and those in view stop for the
    procession (TR.blockers). */
function setRoadClosed(on, s0 = 80, s1 = 1100) {
  if (TR.closedOn === on) return;
  TR.closedOn = on;
  for (const L of TR.links) {
    if (!L.e.main) { L.closed = false; continue; }
    const a = linkAt(L, L.len / 2, _lb), m = mainProject(a[0], a[1]);
    L.closed = on && m.s > s0 && m.s < s1 && m.d < 25;
  }
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
const inJ = (J, n) => J.nodes.has(n);
/** the movement v is about to make through junction J: from its link to the first link that leaves J */
function moveOf(v, J) {
  let k = v.ri + 1; while (k < v.route.length - 1 && inJ(J, v.route[k].to)) k++;
  const B = v.route[Math.min(k, v.route.length - 1)];
  if (v.mv && v.mv.A === v.L && v.mv.B === B) return v.mv;
  return { A: v.L, B, via: v.route.slice(v.ri + 1, k) };
}
/** the path a typical car takes through junction J for movement m, as points */
function movePath(J, m) {
  const { A, B } = m, key = A.id * TR.K + B.id; let pts = J.paths.get(key);
  if (pts) return pts;
  if (m.via && m.via.length) {                     // through a cluster: along the lanes of the links inside it
    const q = [0, 0, 0, 0]; pts = [];
    for (let s0 = Math.max(0, A.len - 6); s0 <= A.len; s0 += 3) pts.push(...lanePoint(A, s0, laneLat(A, 0, 1.7), q).slice(0, 2));
    for (const I of m.via) for (let s0 = 0; s0 <= I.len; s0 += 3) pts.push(...lanePoint(I, s0, laneLat(I, 0, 1.7), q).slice(0, 2));
    for (let s0 = 0; s0 <= Math.min(6, B.len); s0 += 3) pts.push(...lanePoint(B, s0, laneLat(B, 0, 1.7), q).slice(0, 2));
    J.paths.set(key, pts);
    return pts;
  }
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
  const key = pairKey(m1, m2); let c = J.cache.get(key);
  if (c === undefined) {
    const a = movePath(J, m1), b = movePath(J, m2); c = false;
    for (let i = 0; i + 3 < a.length && !c; i += 2) for (let j = 0; j + 3 < b.length; j += 2) if (segSeg(a[i], a[i + 1], a[i + 2], a[i + 3], b[j], b[j + 1], b[j + 2], b[j + 3]) < 1.8) { c = true; break; }
    J.cache.set(key, c); J.cache.set(pairKey(m2, m1), c);
  }
  return c;
}
/** a number naming the pair of movements (m, n), for the junction caches (string keys were a large part of the cost) */
const pairKey = (m, n) => ((m.A.id * TR.K + m.B.id) * TR.K + n.A.id) * TR.K + n.B.id;
/** how far vehicle u has got along movement m's path through J, worked out once a frame */
function arcOf(J, u, m) {
  if (u.arcF !== TR.frame || u.arcM !== m || u.arcJ !== J) { u.arcF = TR.frame; u.arcM = m; u.arcJ = J; u.arcV = arcOn(movePath(J, m), u.x, u.z); }
  return u.arcV;
}
/** how far along movement m's path (metres) its vehicle must get before it is out of the way of movement `other`:
    past the last place their paths cross or touch, or, for two movements into the same lane, past where they merge */
function clearArc(J, m, other) {
  const key = pairKey(m, other); let c = J.clear.get(key);
  if (c !== undefined) return c;
  const a = movePath(J, m), b = movePath(J, other), merge = m.B === other.B; let arc = 0; c = -1;
  for (let i = 0; i + 3 < a.length; i += 2) {
    const l = Math.hypot(a[i + 2] - a[i], a[i + 3] - a[i + 1]);
    for (let j = 0; j + 3 < b.length; j += 2) if (segSeg(a[i], a[i + 1], a[i + 2], a[i + 3], b[j], b[j + 1], b[j + 2], b[j + 3]) < 1.8) { c = arc + l; break; }
    arc += l;
    if (merge && c >= 0) break;
  }
  if (c < 0) c = merge ? arc : 0;
  J.clear.set(key, c);
  return c;
}
/** how far along its junction path (metres) a vehicle at x, z has got: negative before the path starts, beyond its
    length after it ends */
function arcOn(pts, x, z) {
  let best = 1e9, at = 0, arc = 0; const last = pts.length - 4;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az, l2 = dx * dx + dz * dz || 1e-6, l = Math.sqrt(l2);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, i === 0 ? -1e3 : 0, i === last ? 1e3 : 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; at = arc + t * l; }
    arc += l;
  }
  return at;
}
/** how far along movement m's path its vehicle can get before it reaches the space it shares with movement `other` */
function enterArc(J, m, other) {
  const key = pairKey(m, other); let c = J.enter.get(key);
  if (c !== undefined) return c;
  const a = movePath(J, m), b = movePath(J, other); let arc = 0; c = 0;
  outer: for (let i = 0; i + 3 < a.length; i += 2) {
    for (let j = 0; j + 3 < b.length; j += 2) if (segSeg(a[i], a[i + 1], a[i + 2], a[i + 3], b[j], b[j + 1], b[j + 2], b[j + 3]) < 1.8) { c = arc; break outer; }
    arc += Math.hypot(a[i + 2] - a[i], a[i + 3] - a[i + 1]);
  }
  J.enter.set(key, c);
  return c;
}
/** seconds to cover `d` metres from speed `v`, accelerating at `a` */
const reachTime = (d, v, a) => d <= 0 ? 0 : (-v + Math.sqrt(v * v + 2 * a * d)) / a;
/** must v, about to enter junction J, wait for vehicle o already in it? Not once o is past every point where they meet,
    nor while o is still far enough from the space they share that v can be through it first (with a margin): drivers
    judge the gap. A vehicle used to hold a big junction from 13 m before its line until it was out of the far side,
    and a side street could wait minutes for a moment when no one held it. */
function mustYield(J, v, o) {
  if (pastConflict(J, o, v.mv)) return false;
  const aO = arcOf(J, o, o.jmv), aV = arcOf(J, v, v.mv), merge = v.mv.B === o.jmv.B;
  if (merge && o.v > 1) {                       // into the same lane behind o, while it moves: fine if its tail is past the merge before v's nose gets there (a zip)
    const tTail = reachTime(clearArc(J, o.jmv, v.mv) + 1 - (aO - o.len / 2), o.v, o.k.a), tNose = reachTime(enterArc(J, v.mv, o.jmv) - (aV + v.len / 2), v.v, v.k.a);
    if (tNose > tTail + 0.6) return false;
  }
  const dO = enterArc(J, o.jmv, v.mv) - (aO + o.len / 2);
  if (dO < 1) return true;                                                     // in the shared space, or at its edge
  if (o.stall > 3 && TR.clock - o.jgAt > 3 && o.v < 0.3 && o.L === o.jmv.A && stopGap(o) > -0.5) return false;   // held up at its line (people crossing, say) since its go: it will stop for us
  // ahead of o into its lane, v need only be in it (o then follows); crossing o's path, v must be through it
  const dV = (merge ? enterArc(J, v.mv, o.jmv) + v.len : clearArc(J, v.mv, o.jmv) + v.len / 2 + 1) - aV;
  const tO = reachTime(dO, o.v, o.k.a), tV = reachTime(dV, v.v, v.k.a);
  if (tO > tV + 1.2) return false;                                                 // a clear gap
  if (v.wait > TR.courtesy && dO > o.v * o.v / 6 + 3 && tO > 0.5 * tV + 0.5) return false;   // a long wait at the line: nose in, where the one coming has room to slow
  return true;
}
/** a vehicle inside junction J whose tail is already past every point where it could meet movement m: it is no
    longer in the way (if both join the same lane, the one behind simply follows). A big cluster used to stay shut to
    crossing traffic until each vehicle had driven right out of it, which a hand cart at walking pace took 20 s to do. */
const pastConflict = (J, o, m) => arcOf(J, o, o.jmv) - o.len / 2 > clearArc(J, o.jmv, m) + 1;
/** how far before its junction a link's traffic must wait: clear of the junction, and back where it still runs apart
    from any other road coming in (two one-way roads merging at a shallow angle meet well before the node) */
function stopBack(L) {
  if (L.stop !== undefined) return L.stop;
  const nd = NET.nodes[L.to], J = nd.J; let d = J ? nd.r + 0.4 : 0;
  if (J && inJ(J, L.from)) return (L.stop = Math.min(nd.r * 0.5, L.len * 0.5));   // inside a cluster
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
  let k0 = v.ri + 1; while (k0 < v.route.length && inJ(J, v.route[k0].to)) k0++;
  if (k0 >= v.route.length) return true;
  if (!laneRoom(v, k0, v.lane)) {
    if (v.L.wide || !v.route[k0].wide || !laneRoom(v, k0, 1 - v.lane)) return false;
    v.lane = 1 - v.lane;                     // out of a side street: take whichever lane of the road ahead has room
  }
  // people crossing just beyond it: wait for them at the line, not stopped in the middle of the junction holding up
  // everyone else (a carriage waiting there for the food court's evening crowd shut the crossing for minutes)
  const M = v.route[k0], reach = Math.min(M.len, NET.nodes[M.from].r + v.len + 2), la = laneLat(M, M.wide ? v.lane : 0, v.wid), p = _xr, r2 = v.wid / 2 + 0.9;
  lanePoint(M, 0, la, p); const x0 = p[0], z0 = p[1];
  for (const C of [TR.crossers, TR.blockers]) for (let i = 0; i < C.length; i += 2) {
    if (Math.abs(C[i] - x0) > reach + 3 || Math.abs(C[i + 1] - z0) > reach + 3) continue;
    for (let s = 0; s <= reach; s += 2) { lanePoint(M, s, la, p); if (Math.abs(C[i] - p[0]) < r2 && Math.abs(C[i + 1] - p[1]) < r2 && Math.hypot(C[i] - p[0], C[i + 1] - p[1]) < r2) return false; }
  }
  return true;
}
const _xr = [0, 0, 0, 0];
/** room in `lane` of the road beyond the junction for v to get clear of it */
function laneRoom(v, k0, lane) {
  let need = NET.nodes[v.route[k0].from].r + v.len + 2;
  for (let k = k0; k < v.route.length && need > 0; k++) {
    const M = v.route[k], la = laneLat(M, M.wide ? lane : 0, v.wid);
    for (const u of M.q) {
      if (u === v || u.v >= 1.5 || u.s - u.len / 2 >= need) continue;
      if (u.mode === DWELL && M.wide && !(u.stand === v.stand && !v.served)) continue;     // parked at a stand: there is a lane to go round it
      if (u.mode === UTURN || Math.abs(u.lat - la) < (u.wid + v.wid) / 2 + 0.35) return false;
    }
    need -= M.len;
  }
  return true;
}
/** may `v` enter junction J now? Not while a crossing movement is inside, nor ahead of someone with right of way */
function canGo(v, J) {
  for (const o of J.occ) if (o !== v && o.jmv && conflict(J, v.mv, o.jmv) && mustYield(J, v, o)) return false;
  if (!exitRoom(v, J)) return false;
  for (const u of J.appr) {
    if (u === v || !u.on || !u.L || !u.head || !conflict(J, v.mv, u.mv)) continue;            // (someone retired earlier this frame is skipped)
    const ut = Math.max(0, stopGap(u)) / Math.max(u.v, 0.8);
    if (ut > 4 && (u.wait <= 0 || stopGap(u) > 6)) continue;                  // far off, or standing well back from its line (held up by something else)
    // the bigger road goes first; after a long wait, nose in when it is held up itself or, longer still, into a shorter gap
    if (u.L.rank > v.L.rank + 0.1) { if (v.wait > 12 && (ut > 1.6 || (u.v < 0.3 && u.wait > 1.5) || (v.wait > 25 && ut > 1.2))) continue; return false; }
    if (u.L.rank < v.L.rank - 0.1) { if (u.wait > TR.courtesy && u.v < 0.3 && stopGap(u) < 3 && (v.v < 0.5 || stopGap(v) > v.v * v.v / 4 + 2)) return false; continue; }   // standing, or able to stop easily: let in a side street that has waited long
    if (u.arr >= 0 && (v.arr < 0 || u.arr < v.arr - 0.05 || (Math.abs(u.arr - v.arr) <= 0.05 && u.id < v.id))) { if (v.wait > 14) continue; return false; }   // then first come, first served
  }
  return true;
}
function grant(v, J) { if (v.jg === J) return; release(v); J.occ.push(v); v.jg = J; v.jmv = v.mv; v.jgB = v.mv.B; v.wait = 0; v.jgAt = TR.clock; }

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
      if (ah <= -u.len / 2 || ah > look + u.len / 2) continue;
      const ux = Math.sin(u.yaw), uz = Math.cos(u.yaw), c = Math.abs(ux * fx + uz * fz), sn = Math.sqrt(Math.max(0, 1 - c * c));
      // a standoff (nose to nose, or across each other's path, both standing): the one with right of way goes, rather
      // than each waiting on the other for ever; one simply queued behind another is not a standoff
      if (v.stall > 2.5 && u.stall > 2.5 && u.mode === DRIVE && ux * fx + uz * fz < 0.7 && precedence(v) > precedence(u)) continue;
      if (ux * fx + uz * fz > 0.7 && ah < 0) continue;                 // going our way with its middle behind ours: it waits for us, not we for it (two bikes overlapping each braked for the other for 17 min)
      const side = ux * fx + uz * fz < -0.7 ? 0.05 : 0.3;            // oncoming traffic passes close on a narrow street
      // nearest part of u's body ahead: its middle, nose or tail (a long carriage can sit beside us with its nose in front)
      let near = 1e9;
      for (const k of [0, 0.45, -0.45]) {
        const px = dx + ux * u.len * k, pz = dz + uz * u.len * k, a2 = px * fx + pz * fz;
        if (a2 > 0 && Math.abs(px * fz - pz * fx) < v.wid / 2 + u.wid / 2 * c + u.len * 0.05 * sn + side) near = Math.min(near, a2);
      }
      if (near > 1e8) continue;
      const bh = -dx * ux - dz * uz;                                   // does u have v in front too? Then whoever is further into the other's path goes first
      if (bh > 0 && bh < u.len / 2 + 2.5 + u.v * 1.2 + v.len / 2 && Math.abs(dx * uz - dz * ux) < u.wid / 2 + v.len / 2 * sn + v.wid / 2 * c + 0.25
          && (bh > ah + 1 || (Math.abs(bh - ah) <= 1 && precedence(u) < pv))) continue;
      term(Math.max(0.05, Math.min(ah - v.len / 2 - (u.len / 2 * c + u.wid / 2 * sn), near - v.len / 2 - 0.3)), Math.max(0, u.v * (ux * fx + uz * fz)));
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
/** may a vehicle at a stand pull out into lane position `lat`? Not across one coming up behind; one standing behind it,
    waiting for it to go, lets it out (it used to wait for the queue that was waiting for it) */
function pullOutClear(v, L, lat) {
  for (const u of L.q) {
    if (u === v || u.s > v.s || u.mode === DWELL || (u.mode !== UTURN && Math.abs(u.lat - lat) > (u.wid + v.wid) / 2 + 0.35)) continue;
    const gap = v.s - u.s - (u.len + v.len) / 2;
    if (gap < 0.3 || (u.v > 0.8 && gap < u.v * 1.6 + 2)) return false;
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
  // carriages and autos waiting at a stand, ahead on this link or just round the corner on the next
  const parkedIn = k => parkedOn(v, L, laneLat(L, k, v.wid), v.s, v.s + 45) || (next && next.wide && toEnd < 45 && parkedOn(v, next, laneLat(next, k, v.wid), 0, 20));
  let want;
  if (parkedIn(v.lane)) {                                       // go round them, even if the turn ahead wants this lane
    want = !parkedIn(other);
    if (!want && !v.pk && L.opp) {                               // a bus fills both lanes of a narrow two-way street: edge round it when nothing is coming
      const u = parkedOn(v, L, laneLat(L, v.lane, v.wid), v.s, v.s + 25);
      if (u && u.s > v.s && oncomingClear(L, v.s, 40)) { v.pk = u; v.cv = null; }
    }
  }
  else if (parkedIn(other)) want = false;
  else if (need >= 0) want = other === need;
  else {
    const lo = leaderOf(v, latO, _lo);
    want = (ld.gap < 22 && ld.v < v0 - 1.2 && (lo.gap > ld.gap + 10 || lo.v > ld.v + 1.5)) || (other === v.pref && lo.gap > 35 && (ld.gap > 35 || lo.v >= ld.v));
  }
  if (!want || leaderOf(v, latO, _lo).gap < 3 + v.v * 0.4 || !rearClear(v, L, latO)) return;
  v.lane = other; v.cv = null;
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
  if (st && st.s - v.s < 75 && standFull(st, v)) v.served = true;   // stand full: drive on
  const ld = leaderOf(v, v.lat, _ld);
  if (ld.gap < 1e8) term(ld.gap, ld.v);
  safety(v, term);
  if (!v.cv || (v.L === v.cv.B && v.stall > 1.5)) {               // (also when stopped at the end of a turn, behind something)
    if (L.wide) laneChoice(v, L, next, ld, v0, st, dt);
    else {
      overtake(v, L, ld, v0);
      if (next && next.wide && L.len - v.s < 30 && parkedOn(v, next, laneLat(next, v.lane, v.wid), 0, 20) && !parkedOn(v, next, laneLat(next, 1 - v.lane, v.wid), 0, 20)) v.lane = 1 - v.lane;   // turn in clear of a stand
    }
  }
  // where across the road to be
  let latT = laneLat(L, L.wide ? v.lane : 0, v.wid);
  if (st && !v.served && st.s - v.s < 55) latT = kerbLat(L, v.wid);
  if (v.ot) latT = Math.max(-L.e.w / 2 + v.wid / 2 + 0.2, laneLat(L, 0, v.wid) - (v.ot.wid + v.wid) / 2 - 0.45);
  if (v.pk) {                                                       // edging round a bus or carriage parked at a stand
    const u = v.pk;
    if (!u.on || u.L !== L || u.mode !== DWELL || v.s > u.s + (u.len + v.len) / 2 + 1.5 || L.len - v.s < 8) v.pk = null;
    else latT = Math.max(-L.e.w / 2 + v.wid / 2 + 0.2, Math.min(latT, u.lat - (u.wid + v.wid) / 2 - 0.45));
  }
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
  // given the go but held up before getting into the junction (people crossing, say): others now go past (mustYield),
  // so give it back and look again before moving, rather than drive in later across whoever went
  if (v.jg && v.jg === J && v.stall > 3 && TR.clock - v.jgAt > 3 && v.v < 0.3 && v.jmv && v.jmv.A === L && stopGap(v) > -0.5) release(v);   // (not once over the line: it is in the junction then, and others would wait on it while it waited on them)
  if (J && v.jg !== J) {
    v.mv = moveOf(v, J);
    const g = stopGap(v);
    // waiting counts only at the front of the queue: a platoon that had all "waited" far back in line used to take
    // its long-wait licence to stream through, while the front car on the other road never got a go
    if (g < 25 && v.arr < 0) v.arr = TR.clock;
    if (g < 30) {
      if (canGo(v, J)) { if (g < v.v * v.v / 5.2 + 4) grant(v, J); }
      else { term(Math.max(g, 0.05), 0); if (v.v < 0.4 && v.head !== false && g < 4) v.wait += dt; }
    }
  }
  // pull in at the stand
  if (st && !v.served) {
    const g = st.s - (v.s + v.len / 2);
    if (g < -2) v.served = true;
    else {
      term(Math.max(g + 0.6, 0.05), 0);
      // arrived: within the gap this kind of vehicle keeps when standing (a bus stopped 1.8 m short and waited for ever)
      if (v.v < 0.3 && (g < Math.max(1.5, K.s0 + 0.3) || (ld.u && ld.u.mode === DWELL && ld.gap < 3 && g < 30))) { v.mode = DWELL; v.v = 0; v.served = true; v.lastStand = st; const use = STAND_USE[v.type]; v.timer = lerp(use[1], use[2], R()); }
    }
  }
  // people on the carriageway, and the visitor on foot
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), reach = v.len / 2 + 7 + v.v * 2;
  for (const C of [TR.crossers, TR.blockers]) for (let i = 0; i < C.length; i += 2) {
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
  v.stall = v.v < 0.5 ? v.stall + dt : 0;                        // at a crawl or standing (creeping a few centimetres does not reset it)
  advance(v);
}
function advance(v) {
  while (v.on && v.s >= v.L.len) {
    const A = v.L, B = v.route[v.ri + 1];
    if (!B) { if (!endOfRoute(v)) return; continue; }
    const J = NET.nodes[A.to].J;
    if (J && v.jg !== J) { v.mv = moveOf(v, J); grant(v, J); }
    const over = v.s - A.len; quitLink(v); v.ri++; joinLink(v, B, Math.min(over, B.len - 0.01));
    v.lat = v.latT = v.cv && v.cv.B === B ? v.cv.latB : laneLat(B, B.wide ? v.lane : 0, v.wid);
    v.mv = null; v.arr = -1; v.wait = 0; v.ot = null; v.pk = null;
    replan(v);
  }
  if (!v.on) return;
  if (v.jg) { const J = v.jg, f = inJ(J, v.L.from), t = inJ(J, v.L.to); if (!t && (!f || v.s > NET.nodes[v.L.from].r + v.len / 2 + 0.5)) release(v); }   // out of the far side
  if (v.cv) { const c = v.cv, u = (v.L === c.A ? v.s - c.s0 : c.A.len - c.s0 + v.s) / c.D; if (u >= 1 || (v.L !== c.A && v.L !== c.B)) v.cv = null; }
}
/** turning into a road with a queue showing on the next few ahead: think again from here, as drivers do when they see
    the jam (routes were only chosen at the start of a trip, so the queue for the food court kept growing) */
function replan(v) {
  if (v.heritage || v.dest < 0 || (v.stand && !v.served) || v.L.len < 15 || NET.nodes[v.L.to].out.length < 2) return;
  let jam = 0; for (let k = v.ri + 1; k < Math.min(v.route.length, v.ri + 4); k++) jam += v.route[k].jam;
  if (jam < TR.jamM * 6) return;                                   // fewer than about six standing: carry on
  const r = findRoute(v, v.L, null, v.dest);
  if (r && routeCost(v, r) < routeCost(v, v.route.slice(v.ri)) - 30) { v.route = r; v.ri = 0; }
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
    if (L.opp && oncomingClear(L, v.s, 34)) {
      const c = linkAt(L, v.s, [0, 0, 0, 0]); v.utWait = 0;
      v.ut = { O: L.opp, s2: L.len - v.s, cx: c[0], cz: c[1], tx: c[2], tz: c[3], r: Math.max(2.5, Math.abs(v.lat)), phi: 0 };
      v.ghost = { s: v.ut.s2, len: v.len + 2, v: 0, lat: 0, wid: 9, mode: UTURN, on: true };
      L.opp.q.push(v.ghost); v.mode = UTURN; v.cv = null;
      return;
    }
    if (L.opp && (v.utWait += 1) < 20) { v.timer = 1; return; }     // no gap in the oncoming traffic to turn in: after a while, drive on round the block
    const lat = laneLat(L, L.wide ? v.lane : 0, v.wid);
    if (!pullOutClear(v, L, lat)) { v.timer = 0.4; return; }
    if (planTrip(v, L, v.s)) { v.mode = DRIVE; v.latT = lat; v.utWait = 0; } else v.timer = 5;
    return;
  }
  const lat = laneLat(v.L, v.L.wide ? v.lane : 0, v.wid);
  if (!pullOutClear(v, v.L, lat)) { v.timer = 0.4; return; }
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
    const lt = L.sh0 || L.sh1 ? v.lat * latK(L, v.s) : v.lat;
    x = cx + tz * lt; z = cz - tx * lt;
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
  dt = Math.min(dt, 0.1); TR.clock += dt; TR.frame++;
  if (TR.clock >= TR.jamAt) {                                   // how queued each road is, for planning new trips: about 12 m of detour per vehicle standing
    TR.jamAt = TR.clock + 1;
    for (const L of TR.links) { let n = 0; for (const u of L.q) if (u.mode === DRIVE && u.v < 1) n++; L.jam = n * TR.jamM; }
  }
  viewUpdate();
  balanceTraffic(false);
  const V = LIFE.vehicles, P = LIFE.player, pa = !!(P && P.active), ta = TYRE.instanceMatrix.array, sa = SPOKE.instanceMatrix.array, lit = TIME.night > 0.35;
  for (const J of TR.junctions) J.appr.length = 0;
  for (const v of V) {                                         // who is coming up to each junction
    if (!v.on || v.mode !== DRIVE) continue;
    const next = v.route[v.ri + 1], J = next && NET.nodes[v.L.to].J;
    if (J && v.jg !== J && stopGap(v) < 30) { v.mv = moveOf(v, J); J.appr.push(v); }
  }
  // only the front vehicle in each lane takes its turn: one queued behind it cannot go first, so it holds no one up
  for (const J of TR.junctions) {
    const A = J.appr; if (!A.length) continue;
    if (A.length === 1) { A[0].head = true; continue; }
    for (const u of A) u.head = true;
    for (let i = 0; i < A.length; i++) { const u = A[i]; for (let j = i + 1; j < A.length; j++) { const w = A[j]; if (w.L !== u.L || Math.abs(w.lat - u.lat) >= (w.wid + u.wid) / 2 + 0.35) continue; if (w.s > u.s) u.head = false; else w.head = false; } }
  }
  gridBuild(V);
  let n = 0;
  for (const v of V) {
    if (!v.on) continue;
    if (v.mode === DWELL) dwell(v, dt); else if (v.mode === UTURN) uturn(v, dt); else drive(v, dt, P, pa);
    if (!v.on) continue;
    if (v.stuck > 45 && unseen(v.x, v.z, 6, VEH_FAR)) { vehicleOff(v); continue; }     // a rare tangle clears itself out of sight
    if (TR.closedOn && v.L && (v.L.closed || (v.route[v.ri + 1] && v.route[v.ri + 1].closed)) && unseen(v.x, v.z, 6, VEH_FAR)) { vehicleOff(v); continue; }   // diverted
    poseVehicle(v, dt, t, lit, ta, sa); n++;
  }
  LIFE.nVeh = n;
}
