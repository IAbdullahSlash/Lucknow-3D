'use strict';
/* crowd.js — people on foot go somewhere instead of wandering: to the monuments' gates, the shops, the food
   court, or home down a lane, alone or in small family groups. They keep to the pavement, go round street
   corners, cross only at junctions after waiting for a gap in the traffic (drivers wait for them too), stop a
   while where they were going, then set off again. People strolling in the squares pick spots they can
   actually reach and stop to look at the monument. Nobody appears or vanishes where the camera can see. */

const CROWD = { groups: [], pois: [], homes: [], nodes: new Map(), cursor: 0, edgePick: null, ready: false };
const W_EDGE = 0, W_PTS = 1, W_NODE = 2, W_DWELL = 3;
const pedOk = e => e.ped && !e.bridge && e.k !== 'primary' && e.a !== e.b;
const pedO = (e, j) => Math.abs(pedOffset(e, 1, j));
const _wp = [0, 0, 0, 0], _wq = [0, 0, 0, 0], _wr = [0, 0, 0, 0];
const solidAt = (x, z) => { const gx = Math.floor(x - NAV.x0), gz = Math.floor(z - NAV.z0); return insideWalkGrid(gx, gz) && NAV.grid[gz * NAV.W + gx] === 1; };
/** a point on edge e at distance s, `o` metres to physical side ps (+1 = left of a→b) */
function edgePt(e, s, ps, o, out = _wp) { polyAt(e.pl, s, out); out[0] += out[3] * ps * o; out[1] -= out[2] * ps * o; return out; }
/** which pavements a street has: on a dual carriageway, not the median side that runs into the other carriageway */
function inCarriageway(x, z, skip) {
  for (const e of NET.edges) {
    if (!e.veh || e === skip) continue;
    const p = e.pl.p, hw = (e.main && !e.one ? mainHalfAt(e) : e.w / 2) + 0.3;
    for (let i = 0; i < p.length - 2; i += 2) {
      if (Math.min(p[i], p[i + 2]) > x + hw || Math.max(p[i], p[i + 2]) < x - hw || Math.min(p[i + 1], p[i + 3]) > z + hw || Math.max(p[i + 1], p[i + 3]) < z - hw) continue;
      if (segDist(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) < hw) return true;
    }
  }
  return false;
}
function pedSides(e) {
  if (e.sides) return e.sides;
  e.sides = [true, true];
  if (e.veh && e.one) {
    for (const [k, ps] of [[0, 1], [1, -1]]) {
      let bad = 0; for (const f of [0.25, 0.5, 0.75]) { const q = edgePt(e, e.len * f, ps, pedO(e, 0.5), [0, 0, 0, 0]); if (inCarriageway(q[0], q[1], e)) bad++; }
      if (bad >= 2) e.sides[k] = false;
    }
    if (!e.sides[0] && !e.sides[1]) e.sides = [true, true];
  }
  return e.sides;
}
const sideOk = (e, ps) => pedSides(e)[ps > 0 ? 0 : 1];
/** height of the ground underfoot: the heritage road's raised pavements stand 16 cm above the carriageway */
function footY(x, z) {
  const mp = mainProject(x, z);
  if (mp.s <= S_PARK0 + 2 || (mp.s > S_DUAL1 - 8 && mp.s < S_RUMI1 + 6)) return 0;
  const h = mainHalf(mp.s); return mp.d > h + 0.05 && mp.d < h + 3.3 ? 0.16 : 0;
}

/* ───────────── street corners: the edges meeting at a node, in order round it ───────────── */
function nodeInfo(n) {
  let info = CROWD.nodes.get(n);
  if (info) return info;
  const nd = NET.nodes[n], list = [];
  for (const ei of nd.e) {
    const e = NET.edges[ei]; if (!pedOk(e)) continue;
    const atA = e.a === n, q = polyAt(e.pl, atA ? Math.min(4, e.len) : Math.max(0, e.len - 4), [0, 0, 0, 0]);
    let ux = q[0] - nd.x, uz = q[1] - nd.z; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    list.push({ e, atA, ux, uz, ang: Math.atan2(uz, ux) });
  }
  list.sort((a, b) => a.ang - b.ang);
  for (const it of list) {                      // keep back from the junction by the width of the roads crossing it
    let r = 0; for (const o of list) if (o !== it && o.e.veh) r = Math.max(r, o.e.main ? mainHalfAt(o.e) : o.e.w / 2);
    it.c = Math.min(Math.max(1.5, r + 1.0), it.e.len * 0.45);
  }
  info = { n, x: nd.x, z: nd.z, list }; CROWD.nodes.set(n, info);
  return info;
}
const crossCost = it => it.e.veh ? 4 + it.e.w * (it.e.main ? 1.2 : 0.8) : 0.4;
const sectorOf = (info, i, ps) => { const s = info.list[i].atA ? -ps : ps; return s > 0 ? i : (i - 1 + info.list.length) % info.list.length; };
/** cheapest way round a node from edge i (side psi) to edge j (side psj): which roads must be crossed, and which way round */
function cornerPlan(info, i, psi, j, psj) {
  const n = info.list.length, si = sectorOf(info, i, psi), so = sectorOf(info, j, psj), ccw = (so - si + n) % n, cw = (si - so + n) % n;
  const a = [], b = []; let ca = 0, cb = 0;
  for (let s = 1; s <= ccw; s++) { const k = (si + s) % n; a.push(k); ca += crossCost(info.list[k]); }
  for (let s = 0; s < cw; s++) { const k = (si - s + n) % n; b.push(k); cb += crossCost(info.list[k]); }
  return ca < cb || (ca === cb && a.length <= b.length) ? { cost: ca, dir: 1, edges: a, si } : { cost: cb, dir: -1, edges: b, si };
}
const itemIndex = (info, e) => info.list.findIndex(it => it.e === e);
const setback = (e, n) => { const info = nodeInfo(n), k = itemIndex(info, e); return k >= 0 ? info.list[k].c : 1.5; };
function sidePt(it, sgn, o) { const ps = it.atA ? -sgn : sgn; return edgePt(it.e, it.atA ? it.c : it.e.len - it.c, ps, o, [0, 0, 0, 0]); }
/** waypoints round a node, with the road crossings marked */
function cornerPath(info, i, psi, j, psj, j0, x0, z0, next) {
  if (i < 0 || j < 0) return { t: W_PTS, pts: [x0, z0, ...next], cross: [], k: 0, u: 0, wait: 0 };   // not a mapped corner: straight on
  const plan = cornerPlan(info, i, psi, j, psj), n = info.list.length, pts = [x0, z0], cross = [];
  const corner = s => {
    const a = info.list[s], b = info.list[(s + 1) % n]; let ang = n === 1 ? TAU : b.ang - a.ang; while (ang <= 0) ang += TAU;
    if (ang < 3.5) return;                                       // an ordinary corner: walk straight across it
    const h = ang / 2, dx = a.ux * Math.cos(h) - a.uz * Math.sin(h), dz = a.ux * Math.sin(h) + a.uz * Math.cos(h), r = Math.max(pedO(a.e, j0), pedO(b.e, j0));
    pts.push(info.x + dx * r, info.z + dz * r);
  };
  let sec = plan.si;
  for (const k of plan.edges) {
    corner(sec);
    const it = info.list[k], o = pedO(it.e, j0), from = plan.dir > 0 ? -1 : 1, p1 = sidePt(it, from, o), p2 = sidePt(it, -from, o);
    pts.push(p1[0], p1[1]); if (it.e.veh) cross.push({ k: pts.length / 2 - 1, e: it.e, s: it.atA ? it.c : it.e.len - it.c }); pts.push(p2[0], p2[1]);
    sec = plan.dir > 0 ? k : (k - 1 + n) % n;
  }
  corner(sec);
  const out = info.list[j], b = sidePt(out, out.atA ? -psj : psj, pedO(out.e, j0));
  pts.push(b[0], b[1]);
  return { t: W_PTS, pts, cross, k: 0, u: 0, wait: 0 };
}

/* ───────────── where people go ───────────── */
function attachPoint(x, z) {                    // the pavement spot nearest a place, from which it can be walked to
  let best = null, bd = 46;
  for (const e of footEdges) {
    const p = e.pl.p, cum = e.pl.cum;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d > bd + 12) continue;
      const s = cum[i / 2] + Math.sqrt(l2) * t;
      for (const ps of [1, -1]) {
        if (!sideOk(e, ps)) continue;
        const q = edgePt(e, s, ps, pedO(e, 0.5), _wq), dd = Math.hypot(q[0] - x, q[1] - z);
        if (dd < bd && (dd < 1.5 || walkableLeg([q[0], q[1], x, z]))) { bd = dd; best = { e, s, ps, x: q[0], z: q[1] }; }
      }
    }
  }
  return best;
}
function buildPois() {
  for (const l of LABELS) {
    if (!l.walk || l.road) continue;
    const at = attachPoint(l.walk[0], l.walk[1]); if (!at) continue;
    const landmark = !l.shop;
    CROWD.pois.push({ id: l.id, x: l.walk[0], z: l.walk[1], look: [l.pos[0], l.pos[2]], at, landmark, shop: l.shop ? SHOP_SITES.get(l.id) : null, food: l.id === 'food', w: landmark ? (l.small ? 1.2 : 3) : 1 });
  }
  for (const e of footEdges) {                   // homes and errands down the side lanes
    if (e.main || e.prom || e.veh && e.w >= 9) continue;
    const mid = polyAt(e.pl, e.len / 2, _wq), mp = mainProject(mid[0], mid[1]);
    if (mp.d > 35 && mp.d < 260 && inFocus(mid[0], mid[1], -10)) CROWD.homes.push(e);
  }
  const ws = []; let acc = 0;                   // where walkers are found when they set out: mostly near the heritage road
  for (const e of footEdges) { const mp = mainProject(e.pl.p[0], e.pl.p[1]); acc += e.len * (e.main ? 7 : e.prom ? 6 : mp.d < 160 ? 1.6 : mp.d < 420 ? 0.55 : 0.2); ws.push(acc); }
  CROWD.edgePick = () => { const r = R() * acc; let lo = 0, hi = ws.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ws[m] < r) lo = m + 1; else hi = m; } return footEdges[lo]; };
}
function poiWeight(q) {
  const h = TIME.hour;
  if (q.shop) return q.shop.activity > 0.3 ? 1.2 : 0;
  if (q.food) return 2 * (0.4 + marketActivity(h) * 1.6);
  return q.w * (h > 6 && h < 20.5 ? 1 : 0.35);
}

/* ───────────── routes along the streets on foot ───────────── */
const PR = { dist: new Map(), prev: new Map(), heap: [] };
function pedCost(e, g) {
  const f = e.main ? 1 : e.prom || e.foot ? 0.9 : e.veh ? (e.w >= 9 ? 1.45 : 1.15) : e.k === 'service' ? 1.3 : 1.1, h = Math.sin(g.seed + e.id * 3.7) * 9137.31;
  return e.len * f * (0.9 + 0.25 * (h - Math.floor(h)));
}
/** edges walked from (e0 at s0) to (e1 at s1): [{ e, from, to }] after the first edge, or [] if both are on one edge */
function pedRoute(g, e0, s0, e1, s1) {
  if (e0 === e1) return [];
  const D = PR.dist, P = PR.prev, H = PR.heap; D.clear(); P.clear(); H.length = 0;
  const push = (c, n) => { H.push([c, n]); let k = H.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (H[q][0] <= H[k][0]) break; [H[q], H[k]] = [H[k], H[q]]; k = q; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let s = k; if (a < H.length && H[a][0] < H[s][0]) s = a; if (b < H.length && H[b][0] < H[s][0]) s = b; if (s === k) break; [H[s], H[k]] = [H[k], H[s]]; k = s; } } return top; };
  D.set(e0.a, s0); P.set(e0.a, null); push(s0, e0.a);
  if (!D.has(e0.b) || e0.len - s0 < D.get(e0.b)) { D.set(e0.b, e0.len - s0); P.set(e0.b, null); push(e0.len - s0, e0.b); }
  let best = 1e9, end = -1;
  while (H.length) {
    const [c, n] = pop(); if (c > D.get(n) || c >= best) continue;
    if (n === e1.a && c + s1 < best) { best = c + s1; end = n; }
    if (n === e1.b && c + e1.len - s1 < best) { best = c + e1.len - s1; end = n; }
    for (const ei of NET.nodes[n].e) {
      const e = NET.edges[ei]; if (!pedOk(e) || e === e0 || e === e1) continue;
      const m = e.a === n ? e.b : e.a, nc = c + pedCost(e, g);
      if (!D.has(m) || nc < D.get(m)) { D.set(m, nc); P.set(m, [n, e]); push(nc, m); }
    }
  }
  if (end < 0) return null;
  const path = []; for (let n = end, q = P.get(n); q; n = q[0], q = P.get(n)) path.push({ e: q[1], from: q[0], to: n });
  path.reverse();
  path.first = path.length ? path[0].from : end;    // the node where the first edge is left
  path.last = end;                                  // the node where the final edge is joined
  return path;
}
function edgeLeg(e, s0, s1, ps, j) { return { t: W_EDGE, e, s0, s1, ps, j, s: s0 }; }
/** the legs of a walk from (e0, s0, ps0) to a destination on the pavement (e1, s1, ps1) */
function walkLegs(g, e0, s0, ps0, e1, s1, ps1) {
  const j = g.lead.j, legs = [], route = pedRoute(g, e0, s0, e1, s1);
  if (!route) return null;
  if (e0 === e1) {
    legs.push(edgeLeg(e0, s0, s1, ps0, j));
    if (ps0 !== ps1) legs.push({ t: W_PTS, mid: { e: e0, s: s1, ps0, ps1 } });          // across the street where it is
    return legs;
  }
  const chain = [e0, ...route.map(r => r.e), e1], nodes = [route.first, ...route.map(r => r.to)];
  // which side of each street to walk, so as to cross as few roads as possible
  const m = chain.length - 1, cost = [[ps0 > 0 ? 0 : 1e9, ps0 < 0 ? 0 : 1e9]], from = [[0, 0]];
  for (let k = 1; k <= m; k++) {
    const info = nodeInfo(nodes[k - 1]), a = itemIndex(info, chain[k - 1]), b = itemIndex(info, chain[k]); cost.push([1e9, 1e9]); from.push([0, 0]);
    for (const sa of [0, 1]) for (const sb of [0, 1]) {
      if (cost[k - 1][sa] >= 1e9) continue;
      const c = cost[k - 1][sa] + (a < 0 || b < 0 ? 0 : cornerPlan(info, a, sa ? -1 : 1, b, sb ? -1 : 1).cost) + (k === m && (sb ? -1 : 1) !== ps1 ? 1e6 : 0) + (sideOk(chain[k], sb ? -1 : 1) ? 0 : 1e5);
      if (c < cost[k][sb]) { cost[k][sb] = c; from[k][sb] = sa; }
    }
  }
  const side = new Array(m + 1); side[m] = cost[m][0] <= cost[m][1] ? 0 : 1;
  for (let k = m; k > 0; k--) side[k - 1] = from[k][side[k]];
  const ps = side.map(s => s ? -1 : 1);
  const startAt = (e, n) => n === e.a ? setback(e, n) : e.len - setback(e, n), endAt = (e, n) => n === e.b ? e.len - setback(e, n) : setback(e, n);
  const e0end = endAt(e0, nodes[0]);                                   // leave the first street towards the junction, never away from it
  legs.push(edgeLeg(e0, s0, nodes[0] === e0.b ? Math.max(s0, e0end) : Math.min(s0, e0end), ps[0], j));
  for (let k = 1; k <= m; k++) {
    const e = chain[k], n0 = nodes[k - 1];
    legs.push({ t: W_NODE, n: n0, ei: chain[k - 1], psi: ps[k - 1], ej: e, psj: ps[k] });
    const a = startAt(e, n0); let b = k === m ? s1 : endAt(e, nodes[k]);
    if (k < m && (n0 === e.a) !== (b >= a)) b = a;                      // a short street that is all junction
    legs.push(edgeLeg(e, a, b, ps[k], j));
  }
  return legs;
}
/** where to next: a monument, a shop, the food court, or home down a lane */
function planWalk(g, e0, s0, ps0) {
  for (let k = 0; k < 5; k++) {
    let dest;
    if (R() < 0.22 && CROWD.homes.length) { const e = rpick(CROWD.homes); let ps = R() < 0.5 ? 1 : -1; if (!sideOk(e, ps)) ps = -ps; dest = { at: { e, s: R() * e.len, ps }, home: true }; }
    else { dest = pickWeighted(CROWD.pois, poiWeight); if (dest === g.poi && CROWD.pois.length > 1) continue; }
    if (!dest) continue;
    const at = dest.at, legs = walkLegs(g, e0, s0, ps0, at.e, at.s, at.ps);
    if (!legs) continue;
    if (!dest.home) {
      const j = g.lead.j, q = edgePt(at.e, at.s, at.ps, pedO(at.e, j), [0, 0, 0, 0]);
      legs.push({ t: W_PTS, pts: [q[0], q[1], dest.x, dest.z], cross: [], k: 0, u: 0, wait: 0, free: true });
      const shop = !!dest.shop;
      legs.push({ t: W_DWELL, time: shop ? 10 + R() * 30 : 18 + R() * 70, look: dest.look, photo: dest.landmark && !shop });
    } else legs.push({ t: W_DWELL, time: 4 + R() * 8, look: null, home: true });
    g.legs = legs; g.li = 0; g.dest = dest;
    return true;
  }
  return false;
}

/* ───────────── groups ───────────── */
const GROUP_SLOTS = [[], [[0.62, 0.05]], [[0.6, 0.15], [-0.6, 0.15]], [[0.6, 0.1], [-0.6, 0.1], [0, 0.85]]];
function spawnWalkers(scale) {
  const n = Math.round(800 * scale);
  for (let made = 0; made < n;) {
    const r = R(), size = r < 0.5 ? 1 : r < 0.76 ? 2 : r < 0.9 ? 3 : 4, members = [];
    for (let k = 0; k < size && made < n; k++, made++) {
      const kind = size > 2 && k >= 2 && R() < 0.7 ? 5 : undefined, p = newPerson(kind); if (!p) break;
      Object.assign(p, { walker: true, mode: 1, moving: true, on: false, j: R() }); hidePerson(p); members.push(p);
    }
    if (!members.length) break;
    const lead = members[0], g = { lead, members, slots: GROUP_SLOTS[members.length - 1], on: false, seed: R() * 100, sp: Math.min(...members.map(p => p.k === 5 ? 1.05 + R() * 0.2 : p.sp)) * 0.92, legs: null, li: 0, poi: null };
    members.forEach((p, k) => { p.group = g; p.slot = k ? g.slots[k - 1] : null; });
    CROWD.groups.push(g);
  }
  for (let i = CROWD.groups.length - 1; i > 0; i--) { const k = (R() * (i + 1)) | 0; [CROWD.groups[i], CROWD.groups[k]] = [CROWD.groups[k], CROWD.groups[i]]; }
}
/** first frame, when the walkable map exists: find the places people go, set everyone off, and stand strollers on open ground */
function crowdReady() {
  CROWD.ready = true;
  buildPois();
  balanceWalkers(true);
  for (const p of LIFE.people) {
    if (p.mode !== 2) continue;
    const ok = (x, z) => { const f = floorAt(x, z, p.zone.y); return f !== null && Math.abs(f - p.zone.y) < 0.6; };
    if (ok(p.x, p.z)) continue;
    for (let k = 0; k < 12; k++) { const zn = p.zone, w = toWorld(zn.f, lerp(zn.x0, zn.x1, R()), lerp(zn.z0, zn.z1, R())); if (ok(w[0], w[1])) { p.x = p.tx = w[0]; p.z = p.tz = w[1]; p.dirty = true; break; } }
  }
}
function groupOn(g, anywhere) {
  for (let k = 0; k < 6; k++) {
    const e = CROWD.edgePick(), s = R() * e.len; let ps = R() < 0.5 ? 1 : -1; if (!sideOk(e, ps)) ps = -ps;
    const q = edgePt(e, s, ps, pedO(e, g.lead.j), _wq);
    if (!anywhere && !unseen(q[0], q[1], 4, PED_FAR)) continue;
    g.poi = null;
    if (!planWalk(g, e, s, ps)) continue;
    g.on = true;
    for (const p of g.members) { p.on = true; p.x = q[0]; p.z = q[1]; p.y = footY(q[0], q[1]); p.snap = true; p.photo = false; }
    return true;
  }
  return false;
}
function groupOff(g) { g.on = false; for (const p of g.members) { p.on = false; p.photo = false; hidePerson(p); } }
/** keep the hour's number of people out walking, switching groups on and off only out of sight */
function balanceWalkers(first) {
  const G = CROWD.groups, want = Math.round(G.length * busyAt('crowd', TIME.hour));
  for (let n = 0; n < (first ? G.length : 24); n++) {
    const i = first ? n : (CROWD.cursor = (CROWD.cursor + 1) % G.length), g = G[i], on = i < want;
    if (on && !g.on) groupOn(g, first);
    else if (!on && g.on && unseen(g.lead.x, g.lead.z, 4, PED_FAR)) groupOff(g);
  }
}

/* ───────────── walking ───────────── */
/** is it safe to step off the kerb across edge e at distance s (edge metres)? */
function trafficClear(e, s, x, z, patience) {
  const horizon = patience > 25 ? 1.6 : patience > 12 ? 2.6 : 4.2;
  for (const L of e.lk || []) {
    if (!L) continue;
    const sc = L.d > 0 ? s : L.len - s;
    for (const u of L.q) {
      if (!u.on && !u.ghost) continue;
      const ahead = sc - u.s;
      if (Math.abs(ahead) < u.len / 2 + 2.2) return false;                         // right there
      if (u.mode === DRIVE && u.stall > 4 && ahead > 0 && ahead < u.len / 2 + 9) return false;   // a driver waiting just short of the crossing gets a turn (a stream of people kept one standing for minutes)
      if (ahead > 0 && ahead < 40 && (ahead - u.len / 2) / Math.max(u.v, 0.1) < horizon) return false;
    }
  }
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);                       // anything turning in from another road
  for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) for (const u of GRID.get((cx + i) * 8192 + cz + k) || []) if (u.on && u.v > 0.6 && Math.hypot(u.x - x, u.z - z) < 7) return false;
  return true;
}
function stepGroup(g, dt) {
  const p = g.lead;
  if (!g.legs || g.li >= g.legs.length) {          // arrived somewhere with nothing planned: set off again from the pavement
    const at = g.dest && g.dest.at; g.poi = g.dest && !g.dest.home ? g.dest : null;
    if (g.dest && g.dest.home && unseen(p.x, p.z, 4, PED_FAR)) { groupOff(g); return; }
    if (!at || !planWalk(g, at.e, at.s, at.ps)) { groupOff(g); return; }
    if (g.poi) g.legs.unshift({ t: W_PTS, pts: [p.x, p.z, at.x, at.z], cross: [], k: 0, u: 0, wait: 0, free: true });   // back to the pavement first
  }
  let leg = g.legs[g.li];
  if (leg.t === W_NODE) {
    const info = nodeInfo(leg.n), nx = g.legs[g.li + 1], q = nx && nx.t === W_EDGE ? edgePt(nx.e, nx.s0, nx.ps, pedO(nx.e, nx.j), _wq) : [p.x, p.z];
    leg = g.legs[g.li] = cornerPath(info, itemIndex(info, leg.ei), leg.psi, itemIndex(info, leg.ej), leg.psj, p.j, p.x, p.z, [q[0], q[1]]);
  }
  if (leg.t === W_PTS && leg.mid) {
    const { e, s, ps0, ps1 } = leg.mid, o = pedO(e, p.j), a = edgePt(e, s, ps0, o, [0, 0, 0, 0]), b = edgePt(e, s, ps1, o, [0, 0, 0, 0]);
    leg = g.legs[g.li] = { t: W_PTS, pts: [p.x, p.z, a[0], a[1], b[0], b[1]], cross: e.veh ? [{ k: 1, e, s }] : [], k: 0, u: 0, wait: 0 };
  }
  p.photo = false; g.crossing = false;
  if (leg.t === W_EDGE) {
    const dir = leg.s1 >= leg.s0 ? 1 : -1;
    leg.s += dir * g.sp * dt;
    const done = dir > 0 ? leg.s >= leg.s1 : leg.s <= leg.s1; if (done) leg.s = leg.s1;
    const o = pedO(leg.e, leg.j); let q = edgePt(leg.e, leg.s, leg.ps, o, _wq);
    if (solidAt(q[0], q[1])) for (const dd of [-0.7, 0.7, -1.4, 1.4]) { const r = edgePt(leg.e, leg.s, leg.ps, Math.max(0, o + dd), _wr); if (!solidAt(r[0], r[1])) { q = r; break; } }   // step round a parked scooter, a cart or a house front
    moveTo(p, q[0], q[1], Math.atan2(q[2] * dir, q[3] * dir), dt, o > 7.2 && hasFootpath(leg.e) ? 0.16 : 0);
    g.out = [q[3] * leg.ps, -q[2] * leg.ps];                  // away from the road, for the others in the group
    if (done) g.li++;
  } else if (leg.t === W_PTS) {
    const P = leg.pts, n = P.length / 2 - 1;
    if (leg.k >= n) { g.li++; return; }
    const ax = P[leg.k * 2], az = P[leg.k * 2 + 1], bx = P[leg.k * 2 + 2], bz = P[leg.k * 2 + 3], L = Math.hypot(bx - ax, bz - az), cr = leg.cross.find(c => c.k === leg.k);
    if (cr && leg.u === 0) {                                  // at the kerb: look both ways and wait for a gap
      if (!trafficClear(cr.e, cr.s, (ax + bx) / 2, (az + bz) / 2, leg.wait)) { leg.wait += dt; p.moving = false; p.yaw = Math.atan2(bx - ax, bz - az); g.waiting = true; return; }
    }
    g.waiting = false;
    leg.u += g.sp * (cr ? 1.15 : 1) * dt;                     // a brisker step across the road
    const u = L > 0.01 ? Math.min(1, leg.u / L) : 1, x = lerp(ax, bx, u), z = lerp(az, bz, u);
    if (cr) { g.crossing = true; TR.crossers.push(x, z); }
    moveTo(p, x, z, L > 0.01 ? Math.atan2(bx - ax, bz - az) : p.yaw, dt, cr ? 0 : leg.free ? floorAt(x, z, p.y) ?? p.y : footY(x, z));
    g.out = null;
    if (u >= 1) { leg.k++; leg.u = 0; leg.wait = 0; }
  } else if (leg.t === W_DWELL) {
    leg.time -= dt; p.moving = false;
    if (leg.look) { let dy = Math.atan2(leg.look[0] - p.x, leg.look[1] - p.z) - p.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; p.yaw += dy * Math.min(1, dt * 2.5); }
    if (leg.photo && leg.time > 4 && (p.i % 3 === 0)) p.photo = true;
    if (leg.time <= 0) g.li++;
  }
}
function moveTo(p, x, z, yaw, dt, y) {
  if (p.snap) { p.x = x; p.z = z; p.snap = false; }
  else { const k = Math.min(1, dt * 6); p.x += (x - p.x) * k; p.z += (z - p.z) * k; }
  p.y = y; p.moving = true; p.ph += p.sp * dt * 4.6;
  let dy = yaw - p.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; p.yaw += dy * Math.min(1, dt * 8);
}
/** the rest of a group keeps beside or just behind the one leading, on the side away from the traffic */
function followGroup(g, dt) {
  const L = g.lead, fx = Math.sin(L.yaw), fz = Math.cos(L.yaw), leg = g.legs && g.legs[g.li], dwell = leg && leg.t === W_DWELL;
  for (let k = 1; k < g.members.length; k++) {
    const p = g.members[k], [sl, sb] = p.slot;
    let tx, tz;
    if (dwell) { const a = L.yaw + Math.PI / 2 + (k - 1.5) * 0.9; tx = L.x + Math.sin(a) * 0.9; tz = L.z + Math.cos(a) * 0.9; }
    else {
      let nx = fz, nz = -fx; const lat = g.out ? Math.abs(sl) * (k % 2 ? 1 : 0.4) : sl;
      if (g.out && nx * g.out[0] + nz * g.out[1] < 0) { nx = -nx; nz = -nz; }
      tx = L.x + nx * lat - fx * sb; tz = L.z + nz * lat - fz * sb;
    }
    if (p.snap) { p.x = tx; p.z = tz; p.snap = false; }
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), k2 = Math.min(1, dt * 4);
    p.x += dx * k2; p.z += dz * k2; p.y = L.y;
    p.moving = L.moving || d > 0.25;
    let yaw = dwell && leg.look ? Math.atan2(leg.look[0] - p.x, leg.look[1] - p.z) : L.moving ? L.yaw : p.yaw; if (!L.moving && d > 0.25) yaw = Math.atan2(dx, dz);
    let dy = yaw - p.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; p.yaw += dy * Math.min(1, dt * 6);
    if (p.moving) p.ph += p.sp * dt * 4.6;
    p.photo = dwell && leg.photo && leg.time > 4 && p.i % 4 === 1;
    if (g.crossing) TR.crossers.push(p.x, p.z);
  }
}
let _wf = 0;
function updateWalkers(dt, t) {
  TR.crossers.length = 0; _wf++;
  if (!(dt > 0)) return;
  if (!CROWD.ready) crowdReady();
  balanceWalkers(false);
  const cx = camera.position.x, cz = camera.position.z, ok = Number.isFinite(cx);
  for (let i = 0; i < CROWD.groups.length; i++) {
    const g = CROWD.groups[i]; if (!g.on) continue;
    const far = ok && Math.abs(g.lead.x - cx) + Math.abs(g.lead.z - cz) > 420; if (far && (i + _wf) % 4) continue;
    const d = far ? dt * 4 : dt;
    stepGroup(g, d);
    if (!g.on) continue;
    if (g.members.length > 1) followGroup(g, d);
    for (const p of g.members) posePerson(p, t);
  }
}

/* ───────────── strolling in the squares ───────────── */
function walkableSeg(x0, z0, x1, z1, y) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
  for (let i = 1; i <= n; i++) { const f = floorAt(lerp(x0, x1, i / n), lerp(z0, z1, i / n), y); if (f === null || Math.abs(f - y) > 0.6) return false; }
  return true;
}
/** a spot in the zone the stroller can walk to in a straight line, or null */
function strollTarget(p) {
  const zn = p.zone;
  for (let k = 0; k < 6; k++) {
    const w = toWorld(zn.f, lerp(zn.x0, zn.x1, R()), lerp(zn.z0, zn.z1, R()));
    if (walkableSeg(p.x, p.z, w[0], w[1], p.y)) return w;
  }
  return null;
}
/** what a zone's visitors turn to look at: the nearest named monument */
function zoneLook(zn) {
  if (zn.look !== undefined) return zn.look;
  const c = toWorld(zn.f, (zn.x0 + zn.x1) / 2, (zn.z0 + zn.z1) / 2); let best = null, bd = 160;
  for (const l of LABELS) { if (!l.cam || l.road || l.shop || l.nolabel) continue; const d = Math.hypot(l.pos[0] - c[0], l.pos[2] - c[1]); if (d < bd) { bd = d; best = [l.pos[0], l.pos[2]]; } }
  return (zn.look = best);
}
