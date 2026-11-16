'use strict';
/* ui.js — explore / walk / tour, labels, minimap, options, sound and the main loop */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.07; controls.maxPolarAngle = Math.PI * 0.492; controls.minDistance = 12; controls.maxDistance = 1150;
controls.screenSpacePanning = false; controls.zoomSpeed = 1.4; controls.panSpeed = 1.15; controls.rotateSpeed = 0.7;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };   // Shift or Ctrl + drag also turns
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.target.set(-20, 20, -10);
const UI = { mode: 'orbit', fly: null, tour: null, T: 0, frame: 0, card: null };
const el = id => document.getElementById(id), KEYS = {};
const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0; if (TOUCH) document.body.classList.add('touch');
function toast(msg, ms = 2800) { const t = el('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); }

/* ───────────── walkable-space map: a 1 m grid of blockers plus stepped platforms ───────────── */
const NAV = { x0: MAP.bounds[0], z0: MAP.bounds[2], W: Math.ceil(MAP.bounds[1] - MAP.bounds[0]), H: Math.ceil(MAP.bounds[3] - MAP.bounds[2]), grid: null }, STEP = 0.6;
const inObb = (o, x, z, m = 0) => { const dx = x - o.x, dz = z - o.z; return Math.abs(dx * o.ax + dz * o.az) <= o.hw + m && Math.abs(dx * o.bx + dz * o.bz) <= o.hd + m; };
function buildNav() {
  const g = NAV.grid = new Uint8Array(NAV.W * NAV.H), pb = PLATFORMS.map(p => { const r = Math.hypot(p.hw, p.hd); return [p.x - r, p.x + r, p.z - r, p.z + r]; });
  for (const c of COLLIDERS) {
    const m = Math.max(0.4, 0.74 - Math.min(c.hw, c.hd)), r = Math.hypot(c.hw, c.hd) + m + 0.5;
    let near = null; for (let i = 0; i < pb.length; i++) { const b = pb[i]; if (c.x + r > b[0] && c.x - r < b[1] && c.z + r > b[2] && c.z - r < b[3]) (near || (near = [])).push(PLATFORMS[i]); }
    if (!near && !(c.yb < 1.9 && c.yt > 0.45)) continue;
    const x0 = Math.max(0, Math.floor(c.x - r - NAV.x0)), x1 = Math.min(NAV.W - 1, Math.ceil(c.x + r - NAV.x0)), z0 = Math.max(0, Math.floor(c.z - r - NAV.z0)), z1 = Math.min(NAV.H - 1, Math.ceil(c.z + r - NAV.z0));
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const px = gx + 0.5 + NAV.x0, pz = gz + 0.5 + NAV.z0; if (!inObb(c, px, pz, m)) continue;
      let fl = 0; if (near) for (const p of near) if (p.yt > fl && inObb(p, px, pz)) fl = p.yt;
      if (c.yb < fl + 1.9 && c.yt > fl + 0.45) g[gz * NAV.W + gx] = 1;
    }
  }
}
/** floor height a walker standing at `feet` would find at (x,z), or null when the way is blocked */
function floorAt(x, z, feet) {
  const gx = Math.floor(x - NAV.x0), gz = Math.floor(z - NAV.z0);
  if (gx < 3 || gz < 3 || gx >= NAV.W - 3 || gz >= NAV.H - 3 || NAV.grid[gz * NAV.W + gx]) return null;
  let fl = 0; const td = talabDepthAt(x, z); if (td !== null) { if (td === -99) return null; fl = td; }
  for (const p of PLATFORMS) if (inObb(p, x, z)) { if (p.yt <= feet + STEP) { if (p.yt > fl) fl = p.yt; } else if (p.yb < feet + 1.7) return null; }
  return fl - feet > STEP ? null : fl;
}
/** true when no wall cell of the walk grid lies between two ground points */
function lineOfSight(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0)); for (let i = 2; i < n - 3; i++) { const t = i / n, gx = Math.floor(x0 + (x1 - x0) * t - NAV.x0), gz = Math.floor(z0 + (z1 - z0) * t - NAV.z0); if (gx >= 0 && gz >= 0 && gx < NAV.W && gz < NAV.H && NAV.grid[gz * NAV.W + gx]) return false; } return true;
}
function findFree(x, z) { for (let r = 0; r < 40; r += 0.8) for (let k = 0; k < (r ? 14 : 1); k++) { const a = k * TAU / 14 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, f = floorAt(px, pz, 200); if (f !== null && f < 9) return [px, pz, f]; } return [x, z, 0]; }

/* ───────────── camera: explore (orbit) ───────────── */
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function flyTo(p, dur = 2.2) { if (UI.mode !== 'orbit') setMode('orbit', true); UI.fly = { t: 0, dur, c0: camera.position.clone(), t0: controls.target.clone(), c1: new THREE.Vector3(...p.cam), t1: new THREE.Vector3(...p.tgt) }; }
/** glide the camera without turning it: zoom by a factor about the centre of view, or slide to a ground point */
function glide(offset, target, dur) { stopTour(); ZOOM.v = 0; UI.fly = { t: 0, dur, c0: camera.position.clone(), t0: controls.target.clone(), c1: target.clone().add(offset), t1: target }; }
function zoomBy(f) { if (UI.mode !== 'orbit') return; const o = camera.position.clone().sub(controls.target); o.setLength(clamp(o.length() * f, controls.minDistance, controls.maxDistance)); glide(o, controls.target.clone(), 0.35); }
function panTo(x, z) { if (UI.mode !== 'orbit') return; const o = camera.position.clone().sub(controls.target); glide(o, new THREE.Vector3(x, controls.target.y, z), 0.9); }
/** wheel zoom: the ground under the cursor stays under the cursor and the view never turns */
const ZOOM = { v: 0, at: new THREE.Vector3(), ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) };
function wheelZoom(e) {
  const t = controls.target, dist = camera.position.distanceTo(t);
  ZOOM.ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera); ZOOM.plane.constant = -t.y;
  if (!ZOOM.ray.ray.intersectPlane(ZOOM.plane, ZOOM.at) || ZOOM.at.distanceTo(camera.position) > dist * 3) ZOOM.at.copy(t);   // aimed at the sky or the far horizon: zoom on the centre of view
  ZOOM.v = clamp(ZOOM.v + clamp(e.deltaY * (e.deltaMode ? 33 : 1), -300, 300) * 0.0017, -1.3, 1.3);
}
function updateZoom(dt) {
  if (Math.abs(ZOOM.v) < 0.002) { ZOOM.v = 0; return; }
  const step = ZOOM.v * Math.min(1, dt * 11); ZOOM.v -= step;
  const t = controls.target, d = camera.position.distanceTo(t), s = clamp(d * Math.exp(step), controls.minDistance, controls.maxDistance) / d;
  if (s === 1) { ZOOM.v = 0; return; }
  camera.position.sub(ZOOM.at).multiplyScalar(s).add(ZOOM.at); t.sub(ZOOM.at).multiplyScalar(s).add(ZOOM.at);
}
function selectPlace(p, fly = true) {
  document.querySelectorAll('#places button').forEach(b => b.classList.toggle('on', b.dataset.id === p.id));
  if (UI.mode === 'walk' && p.walk) { teleport(p.walk[0], p.walk[1], p.walk[2], p.walk[3]); showCard(p); return; }
  if (fly && p.cam) flyTo(p); showCard(p);
}
function showCard(p) {
  const c = el('card'); UI.card = p && p.text ? p : null;
  if (!UI.card) { c.classList.remove('show'); document.body.classList.remove('card-open'); return; }
  c.querySelector('.hi').textContent = OPT.labels === 'ur' ? p.ur : p.hi; c.querySelector('.hi').dir = OPT.labels === 'ur' ? 'rtl' : 'ltr'; c.querySelector('h2').textContent = p.en; c.querySelector('.yr').textContent = p.yr || ''; c.querySelector('p').textContent = p.text;
  el('cardWalk').style.display = p.walk ? '' : 'none'; c.classList.add('show'); document.body.classList.add('card-open');
}
const TOUR = ['clock', 'talab', 'gallery', 'satkhanda', 'chota', 'rumi', 'bara', 'food', 'all'];
function stopTour() { if (!UI.tour) return; UI.tour = null; controls.autoRotate = false; el('bTour').classList.remove('on'); el('bTour').textContent = 'Tour'; }
function tourStep() { const p = LABELS.find(l => l.id === TOUR[UI.tour.i % TOUR.length]); UI.tour.i++; UI.tour.left = 12; selectPlace(p); UI.fly.dur = 3.2; }
function startTour() { setMode('orbit', true); UI.tour = { i: 0, left: 0 }; controls.autoRotate = true; controls.autoRotateSpeed = 0.7; el('bTour').classList.add('on'); el('bTour').textContent = '■ Stop'; tourStep(); }

/* ───────────── camera: walk (first person) ───────────── */
const WALK = { x: 0, y: 0, z: 0, vy: 0, floor: 0, yaw: 0, pitch: 0, eye: 1.66, bob: 0, onGround: true, run: false, joy: { x: 0, y: 0 }, locked: false, drag: null, step: 0, fov: 72, go: 0 };
LIFE.player = { x: 0, z: 0, active: false };
function teleport(x, z, lookX, lookZ) { const f = findFree(x, z); WALK.x = f[0]; WALK.z = f[1]; WALK.y = WALK.floor = f[2]; WALK.vy = 0; if (lookX !== undefined) { WALK.yaw = Math.atan2(-(lookX - f[0]), -(lookZ - f[1])); WALK.pitch = 0.04; } }
function enterWalk(x, z, lookX, lookZ) {
  stopTour(); UI.fly = null;
  if (x === undefined) { x = controls.target.x; z = controls.target.z; lookX = x + (controls.target.x - camera.position.x); lookZ = z + (controls.target.z - camera.position.z); }
  teleport(x, z, lookX, lookZ); setMode('walk', true);
  if (!TOUCH) lockPointer();
}
function lockPointer() { try { const r = renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { /* the browser wants a click first */ } }
function updateWalk(dt) {
  const W = WALK, K = KEYS;
  W.yaw += ((K.ArrowLeft || K.KeyQ ? 1 : 0) - (K.ArrowRight || K.KeyE ? 1 : 0)) * 1.9 * dt;
  let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0) - W.joy.y + W.go, r = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + W.joy.x;
  const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l; }
  const sp = (K.ShiftLeft || K.ShiftRight || W.run ? 5.4 : 1.75) * OPT.walkSpeed, sn = Math.sin(W.yaw), cs = Math.cos(W.yaw), dx = (-sn * f + cs * r) * sp * dt, dz = (-cs * f - sn * r) * sp * dt;
  if (l > 0.01) {
    let fl = floorAt(W.x + dx, W.z + dz, W.y);
    if (fl !== null) { W.x += dx; W.z += dz; } else if ((fl = floorAt(W.x + dx, W.z, W.y)) !== null) W.x += dx; else if ((fl = floorAt(W.x, W.z + dz, W.y)) !== null) W.z += dz;
    if (fl !== null) { W.floor = fl; W.bob += Math.hypot(dx, dz) * 3.3; if (W.onGround && Math.floor(W.bob / Math.PI) !== W.step) { W.step = Math.floor(W.bob / Math.PI); SND.step(); } }
  }
  if (K.Space && W.onGround) { W.vy = 4.6; W.onGround = false; }
  if (W.y > W.floor + 0.002 || W.vy > 0) { W.vy -= 18 * dt; W.y += W.vy * dt; W.onGround = false; if (W.y <= W.floor) { W.y = W.floor; W.vy = 0; W.onGround = true; } }
  else { W.y = Math.min(W.floor, W.y + 5 * dt); W.onGround = true; }
  camera.position.set(W.x, W.y + W.eye + (l > 0.01 && W.onGround ? Math.sin(W.bob * 2) * 0.022 : 0), W.z);
  camera.rotation.set(W.pitch, W.yaw, 0, 'YXZ');
  if (Math.abs(camera.fov - W.fov) > 0.05) { camera.fov += (W.fov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
  LIFE.player.x = W.x; LIFE.player.z = W.z;
}
function lookBy(mx, my, k = 0.0023) { if (UI.mode === 'walk') { k *= camera.fov / 72; WALK.yaw -= mx * k; WALK.pitch = clamp(WALK.pitch - my * k, -1.45, 1.45); } }

/* ───────────── mode switching ───────────── */
function setMode(m, quiet) {
  if (m === UI.mode) return;
  const from = UI.mode; stopTour(); UI.fly = null; ZOOM.v = 0;
  if (from === 'walk' && document.pointerLockElement) document.exitPointerLock();
  if (m === 'walk' && !quiet) return enterWalk();
  UI.mode = m; document.body.classList.toggle('walk', m === 'walk'); LIFE.player.active = m === 'walk';
  document.querySelectorAll('#modes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  controls.enabled = m === 'orbit';
  if (m === 'orbit') {
    camera.near = 2; camera.fov = FOV; camera.updateProjectionMatrix();
    if (from !== 'orbit') { const p = new THREE.Vector3(WALK.x, WALK.y, WALK.z), d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); controls.target.copy(p).setY(p.y + 4); camera.position.copy(p).addScaledVector(d, -46).setY(p.y + 30); camera.rotation.order = 'XYZ'; controls.update(); }
  } else { camera.near = 0.14; camera.fov = WALK.fov = 72; WALK.go = 0; camera.updateProjectionMatrix(); setHot(null); }
  if (m === 'walk') { el('keys').innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> hop<br><kbd>Mouse</kbd> look · hold <kbd>Left button</kbd> walk · <kbd>Wheel</kbd> zoom · <kbd>M</kbd> map · <kbd>Esc</kbd> release, <kbd>Esc</kbd> again to leave'; if (!TOUCH && !quiet) toast('Click the view to look around with the mouse'); }
}

/* ───────────── labels and the places list ───────────── */
function buildLabels() {
  const list = el('places');
  for (const p of LABELS) {
    if (p.cam && !p.small && !p.road) { const b = document.createElement('button'); b.dataset.id = p.id; b.innerHTML = `${p.en}<small>${p.hi}</small>`; b.onclick = () => { stopTour(); selectPlace(p); el('placesWrap').classList.remove('open'); }; list.append(b); }
    if (p.nolabel) continue;
    const d = document.createElement('div'); d.className = 'lbl' + (p.small ? ' small' : '') + (p.road ? ' road' : '') + (p.poi ? ' poi' : ''); d.innerHTML = `<span class="hi"></span><span class="en">${p.en.toUpperCase()}</span>`;
    p.dom = d; p.obj = new CSS2DObject(d); p.obj.position.set(...p.pos); scene.add(p.obj);
  }
  applyLabelLang();
}
function labelAt(x, y) {
  if (OPT.labels === 'off' || document.body.classList.contains('photo')) return null;
  for (const p of LABELS) if (p.dom && !p.road && !p.poi && p.obj.visible && p.dom.style.display !== 'none') { const r = p.dom.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return p; }
  return null;
}
function setHot(p) { if (UI.hot === p) return; if (UI.hot) UI.hot.dom.classList.remove('hot'); UI.hot = p; if (p) p.dom.classList.add('hot'); renderer.domElement.style.cursor = p ? 'pointer' : ''; }
function applyLabelLang() {
  document.body.classList.toggle('nolabels', OPT.labels === 'off'); document.body.classList.toggle('lang-en', OPT.labels === 'en');
  for (const p of LABELS) { if (p.dom) { const s = p.dom.firstChild; s.textContent = OPT.labels === 'ur' ? p.ur : p.hi; s.dir = OPT.labels === 'ur' ? 'rtl' : 'ltr'; } }
  document.querySelectorAll('#places button').forEach(b => { const p = LABELS.find(l => l.id === b.dataset.id); b.querySelector('small').textContent = OPT.labels === 'ur' ? p.ur : p.hi; });
  if (UI.card) showCard(UI.card);
}
function updateLabels() {
  const cp = camera.position, far = UI.mode === 'orbit' ? Math.max(450, cp.distanceTo(controls.target) * 3.2) : 520;
  for (const p of LABELS) if (p.obj) { const d = Math.hypot(p.pos[0] - cp.x, p.pos[2] - cp.z); if (p.poi) { p.obj.visible = false; continue; } p.obj.visible = d < (p.small || p.road ? far * 0.42 : far) && !(UI.mode !== 'orbit' && d < 14); }
  // shop-name tags: nearest first, skip any hidden behind walls or overlapping a tag already shown
  if (OPT.shopTags && OPT.labels !== 'off') {
    const lim = UI.mode === 'orbit' ? 150 : 70, cand = [], v = new THREE.Vector3(), boxes = [];
    if (UI.mode === 'orbit' && cp.y > 110) return;
    for (const p of LABELS) if (p.poi) { const d = Math.hypot(p.pos[0] - cp.x, p.pos[2] - cp.z); if (d < lim) cand.push([d, p]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [d, p] of cand) {
      if (UI.mode !== 'orbit' && !lineOfSight(cp.x, cp.z, p.pos[0], p.pos[2])) continue;
      v.set(...p.pos).project(camera); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const x = (v.x + 1) * innerWidth / 2, y = (1 - v.y) * innerHeight / 2, w = Math.max(70, p.en.length * 6.2) / 2, h = 15;
      if (boxes.some(b => Math.abs(b[0] - x) < b[2] + w && Math.abs(b[1] - y) < h * 2)) continue;
      boxes.push([x, y, w]); p.obj.visible = true; if (boxes.length > 14) break;
    }
  }
  if (UI.mode === 'walk') { let best = null, bd = 1e9; for (const p of LABELS) if (p.pos && !p.road && !p.poi) { const d = Math.hypot(p.pos[0] - WALK.x, p.pos[2] - WALK.z); if (d < bd) { bd = d; best = p; } } el('where').innerHTML = best && bd < 400 ? `Near <b>${best.en}</b> · ${Math.round(bd)} m` : 'Old city lanes'; }
}

/* ───────────── minimap ───────────── */
const MM = { s: 0.5, base: null };
function buildMinimap() {
  const B = MAP.bounds, c = document.createElement('canvas'); c.width = (B[1] - B[0]) * MM.s; c.height = (B[3] - B[2]) * MM.s; const g = c.getContext('2d'), X = x => (x - B[0]) * MM.s, Z = z => (z - B[2]) * MM.s;
  const path = (p, close) => { g.beginPath(); for (let i = 0; i < p.length; i += 2) i ? g.lineTo(X(p[i]), Z(p[i + 1])) : g.moveTo(X(p[i]), Z(p[i + 1])); if (close) g.closePath(); };
  g.fillStyle = '#dccfb4'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#a8cc8c'; for (const a of MAP.green) { path(a.p, true); g.fill(); }
  g.fillStyle = '#c9bca2'; for (const h of HOUSES) { g.save(); g.translate(X(h.x), Z(h.z)); g.rotate(-h.rot); g.fillRect(-h.hw * MM.s, -h.hd * MM.s, h.hw * 2 * MM.s, h.hd * 2 * MM.s); g.restore(); }
  g.fillStyle = '#74b3d8'; for (const a of MAP.water) { path(a.p, true); g.fill(); }
  g.lineCap = g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of MAP.roads) { const foot = /footway|path|steps/.test(r.k); if (foot) continue; path(r.p); g.strokeStyle = pass ? (r._main ? '#fff7df' : '#f4efe2') : '#a99c84'; g.lineWidth = Math.max(1, r._w * MM.s) + (pass ? 0 : 1.4); g.stroke(); }
  path(MAIN.p); g.strokeStyle = '#fff3c8'; g.lineWidth = 7; g.stroke();
  g.fillStyle = '#b5533c'; for (const b of MAP.buildings) if (b.n && /Rumi|Asfi|Bara|Jama|Clock/.test(b.n)) { path(b.p, true); g.fill(); }
  for (const a of MAP.areas) if (/Chhota|Picture/.test(a.n || '')) { path(a.p, true); g.fillStyle = 'rgba(181,83,60,.45)'; g.fill(); }
  MM.base = c; MM.B = B;
}
function drawMinimap() {
  const g = el('minimap').getContext('2d'), S = 200, o = UI.mode === 'orbit';
  const sx = o ? controls.target.x : camera.position.x, sz = o ? controls.target.z : camera.position.z;
  const mpp = o ? clamp(camera.position.distanceTo(controls.target) / 80, 1.2, 8) : 1.05, half = S / 2 * mpp * MM.s, cx = (sx - MM.B[0]) * MM.s, cz = (sz - MM.B[2]) * MM.s;
  g.fillStyle = '#cdbfa3'; g.fillRect(0, 0, S, S); g.drawImage(MM.base, cx - half, cz - half, half * 2, half * 2, 0, 0, S, S);
  g.font = '600 10px "Segoe UI",sans-serif'; g.textAlign = 'center';
  for (const p of LABELS) if (p.pos && p.cam && !p.small) { const x = S / 2 + (p.pos[0] - sx) / mpp, y = S / 2 + (p.pos[2] - sz) / mpp; if (x < 4 || y < 4 || x > S - 4 || y > S - 4) continue; g.fillStyle = '#7a1f12'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); if (mpp < 3.2) { g.fillStyle = '#3a2416'; g.fillText(p.en, x, y - 6); } }
  const d = new THREE.Vector3(); camera.getWorldDirection(d); const a = Math.atan2(d.x, -d.z);
  g.save(); g.translate(S / 2, S / 2); g.rotate(a); g.fillStyle = 'rgba(231,180,90,.35)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 46, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.fill(); g.fillStyle = '#c0392b'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3.5); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
}

/* ───────────── sound: everything is synthesised, nothing is downloaded ───────────── */
const SND = {
  ctx: null, out: null, hum: null, crowd: null, rainG: null, next: 0, hoof: 0, hour: -1,
  noise(sec, brown) { const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; },
  loop(buf, type, freq, q) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = buf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0; s.connect(f).connect(g).connect(this.out); s.start(); return g; },
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C(); this.out = this.ctx.createGain(); this.out.gain.value = OPT.volume; this.out.connect(this.ctx.destination);
    const br = this.noise(3, true), wh = this.noise(2, false);
    this.hum = this.loop(br, 'lowpass', 380, 0.5); this.crowd = this.loop(wh, 'bandpass', 950, 0.7); this.rainG = this.loop(wh, 'highpass', 2600, 0.4); this.wh = wh;
  },
  stop() { if (this.ctx) this.ctx.suspend(); },
  tone(type, f0, f1, dur, vol, at = 0) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05); },
  burst(freq, dur, vol, at = 0) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at; s.buffer = this.wh; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.02); },
  step() { if (this.ctx && OPT.sound) this.burst(520, 0.07, 0.12); },
  bell(n, vol) { for (let k = 0; k < n; k++) for (const [m, a] of [[1, 1], [2, 0.5], [2.76, 0.3], [5.4, 0.16]]) this.tone('sine', 196 * m, 196 * m * 0.995, 3.2, vol * a, k * 1.9); },
  tick(dt) {
    if (!this.ctx || !OPT.sound || this.ctx.state !== 'running') return;
    const cp = camera.position, near = clamp(1 - cp.y / 260, 0, 1), road = clamp(1 - mainProject(cp.x, cp.z).d / 180, 0, 1), day = 1 - TIME.night, busy = busyAt('traffic', TIME.hour), t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(OPT.volume, t, 0.2); this.hum.gain.setTargetAtTime(0.5 * near * (0.35 + 0.65 * road) * (0.3 + 0.7 * busy), t, 0.4);
    this.crowd.gain.setTargetAtTime(0.045 * near * road * busyAt('crowd', TIME.hour), t, 0.4); this.rainG.gain.setTargetAtTime(0.11 * wx.rain, t, 0.5);
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 0.5 + Math.random() * 2.6; const r = Math.random(), v = near * (0.25 + 0.75 * road);
      if (r < 0.42 * busy) { const f = 380 + Math.random() * 170, n = Math.random() < 0.35 ? 2 : 1; for (let k = 0; k < n; k++) this.tone(Math.random() < 0.5 ? 'square' : 'sawtooth', f, f * 0.98, 0.12 + Math.random() * 0.22, 0.035 * v, k * 0.22); }
      else if (r < 0.55) { this.tone('sine', 2300, 2250, 0.5, 0.05 * v); this.tone('sine', 2300, 2250, 0.5, 0.04 * v, 0.16); }
      else if (r < 0.8 && day > 0.5) { const f = 2400 + Math.random() * 1500; for (let k = 0; k < 3; k++) this.tone('sine', f, f * 1.35, 0.07, 0.03 * near, k * 0.11); }
      else if (TIME.night > 0.7) for (let k = 0; k < 5; k++) this.tone('sine', 4300, 4300, 0.04, 0.012 * near, k * 0.07);
    }
    this.hoof -= dt;
    if (this.hoof <= 0) { let bd = 60; for (const v of LIFE.vehicles) if (v.on && v.horse && v.v > 0.5) { const d = Math.hypot(v.x - cp.x, v.z - cp.z) + cp.y * 0.5; if (d < bd) bd = d; } this.hoof = 0.34; if (bd < 60) { const vv = 0.2 * (1 - bd / 60); this.burst(1500, 0.045, vv); this.burst(1150, 0.05, vv * 0.8, 0.13); } }
    const h = Math.floor(TIME.hour); if (h !== this.hour) { if (this.hour >= 0) this.bell(TIME.mode === 'live' ? (h % 12 || 12) : 2, 0.16 * clamp(1 - Math.hypot(cp.x, cp.z, cp.y) / 700, 0.08, 1)); this.hour = h; }
  },
};

/* ───────────── options panel ───────────── */
function buildOptions() {
  const box = el('options'); box.innerHTML = '';
  const h = t => { const e = document.createElement('h3'); e.textContent = t; box.append(e); };
  const row = (label, node) => { const r = document.createElement('div'); r.className = 'row'; const s = document.createElement('span'); s.textContent = label; r.append(s, node); box.append(r); return r; };
  const seg = (label, opts, get, set) => { const w = document.createElement('div'); w.className = 'seg'; for (const [v, t] of opts) { const b = document.createElement('button'); b.textContent = t; b.classList.toggle('on', get() === v); b.onclick = () => { set(v); saveOptions(); w.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }; w.append(b); } return row(label, w); };
  const range = (label, min, max, step, get, set) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = get(); i.setAttribute('aria-label', label); i.oninput = () => { set(+i.value); saveOptions(); }; return row(label, i); };
  const check = (label, get, set) => { const l = document.createElement('label'); l.className = 'sw'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = get(); i.onchange = () => { set(i.checked); saveOptions(); }; l.append(i); const r = row(label, l); return r; };
  const note = t => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; box.append(p); };
  const btn = (label, text, fn) => { const b = document.createElement('button'); b.className = 'mini'; b.textContent = text; b.onclick = fn; return row(label, b); };

  h('Labels & view');
  seg('Labels', [['hi', 'हिंदी'], ['ur', 'اردو'], ['en', 'English'], ['off', 'Off']], () => OPT.labels, v => { OPT.labels = v; applyLabelLang(); });
  check('Shop name tags', () => OPT.shopTags, v => { OPT.shopTags = v; });
  check('Minimap', () => OPT.minimap, v => { OPT.minimap = v; el('mapWrap').classList.toggle('show', v); });
  btn('Photo mode', 'Hide interface (H)', () => togglePhoto());

  h('Sky & weather');
  seg('Weather', Object.entries(WEATHER).map(([k, w]) => [k, w.name]), () => OPT.weather, v => setWeather(v));
  check('Festive illumination at night', () => OPT.festive, v => { OPT.festive = v; if (v && TIME.night < 0.3) toast('The lights come on after dark. Try the Night button.'); });

  note('Crowds and traffic follow the clock: near-empty before dawn, busiest in the evening.');

  h('Walking');
  seg('Walking pace', [[0.65, 'Stroll'], [1, 'Walk'], [1.6, 'Brisk']], () => OPT.walkSpeed, v => { OPT.walkSpeed = v; });
  note('Walk: double-click any spot on the ground, press 2, or use “Walk here” on a place card. Vehicles stop for you.');

  h('Sound');
  check('Street ambience', () => OPT.sound, v => { OPT.sound = v; if (v) SND.start(); else SND.stop(); });
  range('Volume', 0, 1, 0.05, () => OPT.volume, v => { OPT.volume = v; });

  h('Graphics');
  seg('Quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], () => OPT.quality, v => { if (v === OPT.quality) return; OPT.quality = v; saveOptions(); toast('Reloading with ' + v + ' quality…'); setTimeout(() => location.reload(), 500); });
  check('Shadows', () => OPT.shadows, v => { OPT.shadows = v; renderer.shadowMap.enabled = v && !!Q.shadow; scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); }); });
  note('Streets, river, parks and landmark positions come from OpenStreetMap; houses are generated along the real lanes. Monuments are modelled by hand from current satellite and street-level views.');
}
function togglePhoto() { const on = document.body.classList.toggle('photo'); if (on) toast('Press H to bring the interface back'); }
function screenshot() { renderer.render(scene, camera); renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hussainabad-' + Date.now() + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); }

/* ───────────── time bar ───────────── */
function setTime(kind, hour) {
  if (kind === 'live') { TIME.mode = 'live'; UI.preset = null; } else { TIME.mode = 'fixed'; TIME.hour = hour !== undefined ? hour : presetHour(kind); UI.preset = hour !== undefined ? null : kind; }
  document.querySelectorAll('#timebar button').forEach(b => b.classList.toggle('on', (TIME.mode === 'live' && b.dataset.t === 'live') || (TIME.mode === 'fixed' && UI.preset === b.dataset.t)));
}

/* ───────────── input wiring ───────────── */
function wire() {
  document.querySelectorAll('#modes [data-mode]').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
  el('bTour').onclick = () => UI.tour ? stopTour() : startTour();
  el('bOptions').onclick = () => { const o = el('options').classList.toggle('show'); el('bOptions').classList.toggle('on', o); el('bOptions').setAttribute('aria-expanded', o); };
  el('bPlaces').onclick = () => el('placesWrap').classList.toggle('open');
  el('card').querySelector('.x').onclick = () => showCard(null);
  el('cardWalk').onclick = () => { const p = UI.card; if (p && p.walk) enterWalk(p.walk[0], p.walk[1], p.walk[2], p.walk[3]); };
  document.querySelectorAll('#timebar button').forEach(b => { b.onclick = () => setTime(b.dataset.t); });
  el('tExit').onclick = () => setMode('orbit'); el('tRun').onclick = () => { WALK.run = !WALK.run; el('tRun').classList.toggle('on', WALK.run); };
  el('zIn').onclick = () => zoomBy(0.6); el('zOut').onclick = () => zoomBy(1 / 0.6);
  el('minimap').onclick = e => { if (UI.mode !== 'orbit') return; const r = e.currentTarget.getBoundingClientRect(), mpp = clamp(camera.position.distanceTo(controls.target) / 80, 1.2, 8) * 200 / r.width; panTo(controls.target.x + (e.clientX - r.left - r.width / 2) * mpp, controls.target.z + (e.clientY - r.top - r.height / 2) * mpp); };
  const cv = renderer.domElement; let press = null, hoverT = 0;
  cv.addEventListener('pointerdown', e => {
    stopTour(); UI.fly = null; ZOOM.v = 0; press = [e.clientX, e.clientY, performance.now(), e.button];
    if (UI.mode === 'orbit') document.body.classList.add('grabbing');
    else if (document.pointerLockElement === cv) WALK.go = e.button === 2 ? -1 : e.button === 0 ? 1 : WALK.go;      // hold left to walk on, right to step back
    else if (!TOUCH && e.button === 0) lockPointer();
    if (UI.mode !== 'orbit') WALK.drag = [e.clientX, e.clientY, e.pointerId];
  });
  cv.addEventListener('pointerup', e => {      // a click that did not drag: was it on a place label?
    if (!press || UI.mode !== 'orbit' || press[3] !== 0 || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 5 || performance.now() - press[2] > 500) return;
    const p = labelAt(e.clientX, e.clientY); if (p) selectPlace(p);
  });
  cv.addEventListener('pointermove', e => { if (UI.mode !== 'orbit' || e.buttons || e.timeStamp - hoverT < 50) return; hoverT = e.timeStamp; setHot(labelAt(e.clientX, e.clientY)); });
  cv.addEventListener('pointerleave', () => setHot(null));
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('pointermove', e => { if (document.pointerLockElement === cv) lookBy(e.movementX, e.movementY); else if (WALK.drag && UI.mode !== 'orbit' && e.pointerId === WALK.drag[2]) { lookBy(-(e.clientX - WALK.drag[0]) * 1.6, -(e.clientY - WALK.drag[1]) * 1.6); WALK.drag[0] = e.clientX; WALK.drag[1] = e.clientY; } });
  const release = () => { WALK.drag = null; WALK.go = 0; document.body.classList.remove('grabbing'); };
  addEventListener('pointerup', release); addEventListener('pointercancel', release);
  // caught on the way down to the canvas, so the wheel is ours alone (OrbitControls still handles pinch and middle-drag zoom)
  el('stage').addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); UI.fly = null; stopTour(); if (UI.mode === 'walk') WALK.fov = clamp(WALK.fov * (e.deltaY > 0 ? 1.15 : 1 / 1.15), 20, 72); else wheelZoom(e); }, { capture: true, passive: false });
  cv.addEventListener('dblclick', e => {
    if (UI.mode !== 'orbit' || labelAt(e.clientX, e.clientY)) return;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const hit = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
    const d = new THREE.Vector3(); camera.getWorldDirection(d); enterWalk(hit.x, hit.z, hit.x + d.x, hit.z + d.z);
  });
  document.addEventListener('pointerlockchange', () => { WALK.locked = document.pointerLockElement === cv; if (!WALK.locked) WALK.go = 0; if (!WALK.locked && UI.mode === 'walk') toast('Click the view to look around again · Esc to leave walk mode', 3600); });
  // touch joystick
  const joy = el('joy'), knob = joy.firstElementChild; let jid = null;
  const jmove = e => { const r = joy.getBoundingClientRect(), x = clamp((e.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1), y = clamp((e.clientY - r.top - r.height / 2) / (r.height / 2), -1, 1); WALK.joy.x = x; WALK.joy.y = y; knob.style.transform = `translate(${x * 30}px,${y * 30}px)`; };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
  const jend = () => { jid = null; WALK.joy.x = WALK.joy.y = 0; knob.style.transform = ''; }; joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    KEYS[e.code] = true;
    if (UI.mode === 'walk' && /Arrow|Space/.test(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Digit1') setMode('orbit'); else if (e.code === 'Digit2') setMode('walk');
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomBy(0.6); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomBy(1 / 0.6);
    else if (e.code === 'KeyO') el('bOptions').click(); else if (e.code === 'KeyH') togglePhoto(); else if (e.code === 'KeyP') screenshot(); else if (e.code === 'KeyT' && UI.mode === 'orbit') el('bTour').click();
    else if (e.code === 'KeyM') { OPT.minimap = !OPT.minimap; el('mapWrap').classList.toggle('show', OPT.minimap); saveOptions(); buildOptions(); }
    else if (e.code === 'KeyL') { const o = ['hi', 'ur', 'en', 'off']; OPT.labels = o[(o.indexOf(OPT.labels) + 1) % 4]; applyLabelLang(); saveOptions(); buildOptions(); }
    else if (e.code === 'Escape') { if (document.body.classList.contains('photo')) togglePhoto(); else if (el('options').classList.contains('show')) el('bOptions').click(); else if (UI.mode !== 'orbit') setMode('orbit'); else showCard(null); }
  });
  addEventListener('keyup', e => { KEYS[e.code] = false; });
  addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; release(); });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight); });
}

/* ───────────── main loop ───────────── */
const _clock = new THREE.Clock(), _foc = new THREE.Vector3(); let _shadowHalf = 300, _slow = 0, _warned = false, _lastClock = '';
function frame() {
  requestAnimationFrame(frame);
  const raw = _clock.getDelta(), dt = Math.min(raw, 0.05); UI.T += dt; UI.frame++;
  if (TIME.mode === 'live') TIME.hour = istHour();
  // camera first, so the sky and shadows follow it without lag
  if (UI.mode === 'orbit') {
    if (UI.fly) { const f = UI.fly; f.t += Math.min(raw, 0.3) / f.dur; const k = ease(Math.min(f.t, 1)); camera.position.lerpVectors(f.c0, f.c1, k); controls.target.lerpVectors(f.t0, f.t1, k); if (f.t >= 1) UI.fly = null; }
    if (UI.tour && !UI.fly) { UI.tour.left -= dt; if (UI.tour.left <= 0) tourStep(); }
    if (!UI.fly) updateZoom(dt);
    controls.update();
    { const t = controls.target, B = MAP.bounds, x = clamp(t.x, B[0] + 80, B[1] - 80), z = clamp(t.z, B[2] + 80, B[3] - 80); if (x !== t.x || z !== t.z) { camera.position.x += x - t.x; camera.position.z += z - t.z; t.x = x; t.z = z; } }
    if (camera.position.y < 2.2) camera.position.y = 2.2;
    const dist = camera.position.distanceTo(controls.target); FOG_SCALE = clamp(dist / 330, 1, 4.2); _foc.copy(controls.target).setY(0);
    const half = clamp(dist * 0.72, 110, 430); if (Math.abs(half - _shadowHalf) > _shadowHalf * 0.12) { _shadowHalf = half; const sc = sun.shadow.camera; sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.updateProjectionMatrix(); }
  } else {
    updateWalk(dt);
    FOG_SCALE = 1; _foc.set(camera.position.x, 0, camera.position.z); if (_shadowHalf !== 95) { _shadowHalf = 95; const sc = sun.shadow.camera; sc.left = sc.bottom = -95; sc.right = sc.top = 95; sc.updateProjectionMatrix(); }
  }
  applyTime(dt, UI.T);
  for (const u of UPDATERS) u(dt, UI.T);
  updateLife(dt, UI.T);
  sun.target.position.copy(_foc); sun.position.copy(_foc).addScaledVector(lightDir, 900);
  const hr = -(TIME.hour % 12) / 12 * TAU, mn = -(TIME.hour % 1) * TAU; for (const c of CLOCK_HANDS) { c.h.rotation.z = hr; c.m.rotation.z = mn; }
  const hh = Math.floor(TIME.hour), mm = Math.floor((TIME.hour % 1) * 60), s = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  if (s !== _lastClock) { _lastClock = s; el('clock').firstChild.textContent = s; }
  if (UI.frame % 6 === 0) updateLabels();
  if (OPT.minimap && UI.frame % 4 === 0) drawMinimap();
  SND.tick(dt);
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  if (!_warned && UI.T > 6) { _slow = raw > 0.045 ? _slow + raw : Math.max(0, _slow - raw * 0.5); if (_slow > 5 && OPT.quality !== 'low') { _warned = true; toast('Running slowly? Options → Graphics → Low will lighten the scene.', 6000); } }
}

async function main() {
  const step = async (msg, fn) => { setLoad(msg); await new Promise(r => setTimeout(r, 30)); fn(); };
  await step('Laying out the real street map of Lucknow…', () => { buildGround(); buildRoads(); buildSidewalks(); });
  await step('Growing the old city along its lanes…', () => { buildHouses(); nameShops(); buildHouseMeshes(); buildMappedBuildings(); });
  await step('Raising the monuments…', buildMonuments);
  await step('Planting trees and lighting the lamps…', () => { gFlush(); scatterTrees(); buildTrees(); planStreetFurniture(); buildStreetDetail(); buildLamps(); buildWires(); });
  await step('Calling out the tongas, rickshaws and crowds…', buildLife);
  await step('Opening the gates…', () => { buildNav(); buildMinimap(); buildLabels(); buildOptions(); wire(); });
  el('mapWrap').classList.toggle('show', OPT.minimap);
  setTime('live'); applyTime(0.016, 0);
  if (OPT.sound) { const go = () => { SND.start(); removeEventListener('pointerdown', go); }; addEventListener('pointerdown', go); }
  camera.fov = FOV; camera.updateProjectionMatrix();
  UI.fly = { t: 0, dur: 5, c0: camera.position.clone(), t0: controls.target.clone(), c1: new THREE.Vector3(-176, 44, 52), t1: new THREE.Vector3(-34, 14, -24) };
  frame();
  const ld = el('load'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 900);
  window.HUSSAINABAD = { scene, camera, controls, renderer, UI, WALK, TIME, OPT, LIFE, setMode, enterWalk, flyTo, zoomBy, panTo, setTime, setWeather, floorAt, look: (a, b, c, d, e, f) => { UI.fly = null; camera.position.set(a, b, c); controls.target.set(d, e, f); controls.update(); } };
}
main();
