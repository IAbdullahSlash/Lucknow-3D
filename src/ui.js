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
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const placeById = id => LABELS.find(place => place.id === id);
const locale = () => OPT.labels === 'hi' || OPT.labels === 'ur' ? OPT.labels : 'en';
const placeName = p => p.record?.name || { en: p.en, hi: p.hi, ur: p.ur };
const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0; if (TOUCH) document.body.classList.add('touch');
/** the vertical field of view for the screen's shape: the desktop value on wide screens, opened up on tall phone screens so a street keeps some width */
const fovFor = (base, lim) => { const a = innerWidth / innerHeight; return a >= 1.3 ? base : Math.min(lim, base * Math.pow(1.3 / a, 0.55)); };
/** how much farther back a framed view sits on a tall screen, so what fits sideways on a desktop still fits */
const frameK = () => { const a = innerWidth / innerHeight; return a >= 1.3 ? 1 : Math.min(1.5, Math.pow(1.3 / a, 0.4)); };
const PHONE = () => innerWidth < 720 || innerHeight < 500;
function toast(msg, ms = 2800) { const t = el('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); }

/* ───────────── camera: explore (orbit) ───────────── */
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function moveCamera(position, target, duration) {
  if (REDUCED_MOTION.matches || duration <= 0) {
    UI.fly = null;
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    return;
  }
  UI.fly = { t: 0, dur: duration, c0: camera.position.clone(), t0: controls.target.clone(), c1: position, t1: target };
}
function flyTo(p, dur = 2.2) {
  if (UI.mode !== 'orbit') setMode('orbit', true, !!UI.tour);
  const target = new THREE.Vector3(...p.tgt);
  const position = target.clone().lerp(new THREE.Vector3(...p.cam), frameK());
  UI.anchor = p;
  moveCamera(position, target, dur);
}
/** Glide without turning to a point on the minimap or a new zoom distance. */
function glide(offset, target, duration) {
  pauseTour();
  UI.anchor = null;
  ZOOM.v = 0;
  moveCamera(target.clone().add(offset), target, duration);
}
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
function setPlaces(open) {
  el('placesWrap').classList.toggle('open', open);
  el('bPlaces').setAttribute('aria-expanded', open);
}

function selectPlace(p, duration = 2.2) {
  for (const button of el('places').querySelectorAll('button')) {
    button.classList.toggle('on', button.dataset.id === p.id);
    button.setAttribute('aria-pressed', button.dataset.id === p.id);
  }
  UI.view = 0;
  if (p.cam) flyTo(p, duration);
  showCard(p);
}

function showCard(p, restoreFocus = true) {
  const card = el('card');
  const hadFocus = card.contains(document.activeElement);
  UI.card = p?.text ? p : null;
  card.classList.toggle('show', !!UI.card);
  document.body.classList.toggle('card-open', !!UI.card);
  if (!UI.card) {
    if (hadFocus && restoreFocus) {
      const target = UI.cardOrigin;
      if (target?.getClientRects().length) target.focus();
      else if (el('bPlaces').getClientRects().length && UI.mode === 'orbit') el('bPlaces').focus();
      else renderer.domElement.focus({ preventScroll: true });
    }
    return;
  }
  writeVisitorText(el('placeTitle'), placeName(p), locale());
  const coverage = p.shop ? SHOP_COPY[p.record.placement] : { en: p.yr || '' };
  writeVisitorText(card.querySelector('.yr'), coverage, locale());
  writeVisitorText(el('cardWalk'), GUIDE_COPY.walk, locale());
  writeVisitorText(card.querySelector('p'), p.record?.description || { en: p.text }, locale());
  el('cardWalk').hidden = !p.walk || !!UI.tour;
  const source = el('cardSource');
  source.hidden = !p.record?.source;
  if (p.record?.source) source.href = p.record.source;
  const views = el('cardViews');
  views.replaceChildren();
  if (p.views?.length > 1) for (const [i, view] of p.views.entries()) {
    const button = document.createElement('button');
    button.className = 'mini';
    button.setAttribute('aria-pressed', i === UI.view);
    button.classList.toggle('on', i === UI.view);
    writeVisitorText(button, view.name, locale());
    button.onclick = () => {
      pauseTour();
      UI.view = i;
      for (const [index, control] of [...views.children].entries()) {
        control.classList.toggle('on', index === i);
        control.setAttribute('aria-pressed', index === i);
      }
      flyTo(view);
    };
    views.append(button);
  }
  setPlaces(false);
}

const PILOT_LEGS = [];
function buildPilotLegs() {
  const arrivals = PILOT_STOPS.map(id => findFree(...placeById(id).walk.slice(0, 2)));
  for (const [i, waypoints] of PILOT_WAYPOINTS.entries()) {
    const start = arrivals[i], end = arrivals[i + 1];
    if (!start || !end) continue;
    const points = [...start.slice(0, 2), ...waypoints, ...end.slice(0, 2)];
    if (walkableLeg(points)) PILOT_LEGS[i] = polyline(points);
  }
}
function updateTourControls() {
  const tour = UI.tour;
  el('tourPanel').hidden = !tour;
  el('bTour').classList.toggle('on', !!tour);
  el('bTour').setAttribute('aria-expanded', !!tour);
  document.body.classList.toggle('touring', !!tour);
  if (!tour) return;
  const place = placeById(PILOT_STOPS[tour.index]);
  const status = el('tourStatus');
  const destination = document.createElement('bdi');
  const goal = UI.mode === 'walk' && PILOT_LEGS[tour.index] ? placeById(PILOT_STOPS[tour.index + 1]) : null;
  writeVisitorText(destination, placeName(goal || place), locale());
  const lead = document.createElement('span');
  if (goal) writeVisitorText(lead, GUIDE_COPY.onFoot, locale());
  else lead.textContent = (tour.index + 1) + ' / ' + PILOT_STOPS.length;
  status.replaceChildren(lead, ' · ', destination);
  el('tourPrev').disabled = tour.index === 0;
  el('tourNext').disabled = tour.index === PILOT_STOPS.length - 1;
  for (const [id, copy] of [
    ['tourPrev', GUIDE_COPY.back], ['tourNext', GUIDE_COPY.next],
    ['tourPlay', tour.paused ? GUIDE_COPY.play : GUIDE_COPY.pause],
    ['tourWalk', GUIDE_COPY.walk], ['tourText', GUIDE_COPY.itinerary],
  ]) writeVisitorText(el(id), copy, locale());
  el('tourPlay').disabled = UI.mode === 'walk';
  el('tourWalk').hidden = UI.mode === 'walk';
}
function stopTour() {
  if (!UI.tour) return;
  const hadFocus = el('tourPanel').contains(document.activeElement);
  UI.tour = null;
  updateTourControls();
  if (hadFocus) el('bTour').focus();
}
function pauseTour() {
  if (!UI.tour || UI.tour.paused) return;
  UI.tour.paused = true;
  updateTourControls();
}
function seekTour(index) {
  if (!UI.tour || index < 0 || index >= PILOT_STOPS.length) return;
  if (UI.mode === 'walk') setMode('orbit', true, true);
  UI.tour.index = index;
  UI.tour.left = 18;
  UI.cardOrigin = el('bTour');
  selectPlace(placeById(PILOT_STOPS[index]), 3.2);
  updateTourControls();
}
function startTour() {
  UI.tour = { index: 0, left: 18, paused: REDUCED_MOTION.matches };
  seekTour(0);
}
function toggleTourPlayback() {
  if (!UI.tour || UI.mode === 'walk') return;
  UI.tour.paused = !UI.tour.paused;
  if (!UI.tour.paused && UI.tour.left <= 0) seekTour(0);
  updateTourControls();
}

/* ───────────── walk: a figure you steer, followed over the shoulder (wheel right in = first person) ───────────── */
const WALK = { x: 0, y: 0, z: 0, vy: 0, floor: 0, yaw: 0, pitch: 0, eye: 1.66, bob: 0, onGround: true, run: false, joy: { x: 0, y: 0 }, locked: false, drag: null, step: 0, go: 0, dist: 4.5, cam: 0, fp: false };
LIFE.player = { x: 0, y: 0, z: 0, active: false };
/** the walker: kurta, Nehru jacket and churidar, built facing +z with the feet at the origin */
const HERO = (() => {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.visible = false; g.rotation.order = 'YXZ';
  const mats = [], part = (geo, color, parent, x, y, z) => { const mt = M(color); mt.emissive.set(color); mt.emissiveIntensity = 0; mats.push(mt); const m = new THREE.Mesh(geo, mt); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), joint = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p); return p; };
  const KURTA = 0xf3efe4, JACKET = 0x2456c8, SKINC = 0xc68642;
  part(box(0.46, 0.42, 0.27), KURTA, body, 0, 0.8, 0); part(box(0.48, 0.56, 0.29), JACKET, body, 0, 1.15, 0);
  part(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), SKINC, body, 0, 1.47, 0); const head = new THREE.Group(); head.position.set(0, 1.6, 0); body.add(head);
  part(new THREE.SphereGeometry(0.125, 12, 9), SKINC, head, 0, 0, 0); part(new THREE.SphereGeometry(0.135, 12, 9), 0x15100c, head, 0, 0.035, -0.03).scale.y = 0.85;
  const arms = [-1, 1].map(k => { const p = joint(k * 0.3, 1.4); part(box(0.12, 0.56, 0.13), KURTA, p, 0, -0.28, 0); part(new THREE.SphereGeometry(0.06, 8, 6), SKINC, p, 0, -0.6, 0); return p; });
  const legs = [-1, 1].map(k => { const p = joint(k * 0.11, 0.86); part(box(0.16, 0.8, 0.18), KURTA, p, 0, -0.4, 0); part(box(0.17, 0.09, 0.28), 0x5d4037, p, 0, -0.815, 0.05); return p; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.52, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe7b45a, transparent: true, opacity: 0.6, depthWrite: false })); g.add(ring);   // marks you out in a crowd
  // a hand lantern, carried after dark, and the light it throws on the ground
  const lamp = new THREE.Group(); lamp.position.set(0, -0.76, 0.03); lamp.visible = false; arms[1].add(lamp);
  const flame = new THREE.Mesh(box(0.11, 0.15, 0.11), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb45a, emissiveIntensity: 2.4, roughness: 0.6 })); lamp.add(flame);
  for (const y of [-0.09, 0.09]) lamp.add(new THREE.Mesh(box(0.14, 0.03, 0.14), M(0x2a2420)).translateY(y)); lamp.add(new THREE.Mesh(box(0.02, 0.1, 0.02), M(0x2a2420)).translateY(0.15));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(1.1); lamp.add(halo);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb45a, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -40 }));
  glow.scale.set(13, 1, 13); glow.renderOrder = 2; glow.visible = false; scene.add(glow);
  scene.add(g);
  return { g, body, head, arms, legs, ring, lamp, glow, mats, yaw: 0, amp: 0, lean: 0, idle: 0, night: -1 };
})();
function poseHero(dt, moved, run, dx, dz) {
  const W = WALK, H = HERO, k = Math.min(1, dt * 12);
  if (moved) { let d = Math.atan2(dx, dz) - H.yaw; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; H.yaw += d * k; }     // turn to face the way you are going
  const night = TIME.night, lit = night > 0.3;
  H.glow.visible = lit; if (lit) { H.glow.position.set(W.x, W.floor + 0.07, W.z); H.glow.material.opacity = night * 0.42; }
  H.g.visible = W.cam > 0.7; if (!H.g.visible) return;
  if (Math.abs(night - H.night) > 0.02) { H.night = night; H.lamp.visible = lit; for (const m of H.mats) m.emissiveIntensity = night * 0.16; }      // the lantern's glow on its bearer
  H.idle = moved || !W.onGround ? 0 : H.idle + dt; H.head.rotation.y += ((H.idle > 2.5 ? Math.sin((H.idle - 2.5) * 0.7) * 0.6 : 0) - H.head.rotation.y) * Math.min(1, dt * 4);      // looks about when left standing
  H.amp += ((moved ? 1 : 0) - H.amp) * k; H.lean += ((moved && run ? 0.16 : 0) - H.lean) * Math.min(1, dt * 8);
  const sw = Math.sin(W.bob) * H.amp, air = !W.onGround, la = sw * (run ? 0.95 : 0.62), aa = sw * (run ? 0.9 : 0.5);
  H.legs[0].rotation.x = air ? -0.7 : la; H.legs[1].rotation.x = air ? 0.35 : -la; H.arms[0].rotation.x = air ? -0.9 : -aa; H.arms[1].rotation.x = air ? -0.9 : lit ? -0.5 + aa * 0.25 : aa;
  H.body.position.y = air ? 0 : Math.abs(sw) * 0.035 + Math.sin(UI.T * 1.8) * 0.006 * (1 - H.amp);
  H.g.position.set(W.x, W.y, W.z); H.g.rotation.set(H.lean, H.yaw, 0); H.ring.position.y = W.floor - W.y + 0.04;
}
/** how far back from the walker's head the camera can sit along a ray before a wall gets in the way */
function camReach(px, py, pz, dx, dy, dz, D) {
  for (let d = 0.5; d < D + 0.3; d += 0.25) {
    const gx = Math.floor(px + dx * d - NAV.x0), gz = Math.floor(pz + dz * d - NAV.z0); if (gx < 1 || gz < 1 || gx >= NAV.W - 1 || gz >= NAV.H - 1) return Math.max(0, d - 0.3);
    const i = gz * NAV.W + gx; if (NAV.grid[i] === 1 && NAV.top[i] / 8 > py + dy * d - 0.15) { D = Math.max(0, d - 0.3); break; }
  }
  // poles and tree trunks count only when one really stands between the camera and the walker
  const hl = Math.hypot(dx, dz); if (hl < 0.05) return D;
  const ex = px + dx * D, ez = pz + dz * D, bx0 = Math.floor(Math.min(px, ex) / 4 - 0.25), bx1 = Math.floor(Math.max(px, ex) / 4 + 0.25), bz0 = Math.floor(Math.min(pz, ez) / 4 - 0.25), bz1 = Math.floor(Math.max(pz, ez) / 4 + 0.25);
  for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) {
    const list = NAV.thin.get(bx + ',' + bz); if (!list) continue;
    for (const c of list) { const rx = c.x - px, rz = c.z - pz, t = (rx * dx + rz * dz) / (hl * hl), rad = Math.max(c.hw, c.hd) + 0.22; if (t < 0.2 || t > D + rad / hl || Math.abs(rx * dz - rz * dx) / hl > rad) continue; const y = py + dy * t; if (c.yt > y - 0.1 && c.yb < y + 0.1) D = Math.min(D, Math.max(0, t - rad / hl - 0.15)); }
  }
  return D;
}
function teleport(floor, lookX, lookZ, lookY) {
  [WALK.x, WALK.z, WALK.y] = floor;
  WALK.floor = WALK.y;
  WALK.vy = 0;
  WALK.onGround = true;
  WALK.dist = 4.5;
  WALK.cam = WALK.dist;
  const dx = lookX - WALK.x, dz = lookZ - WALK.z;
  WALK.yaw = Math.atan2(-dx, -dz);
  WALK.pitch = lookY === undefined ? -0.12 : Math.atan2(lookY - WALK.y - WALK.eye, Math.hypot(dx, dz));
  HERO.yaw = WALK.yaw + Math.PI;
}
function enterWalk(x, z, lookX, lookZ, lookY, keepTour = false) {
  const defaultArrival = x === undefined;
  if (defaultArrival) {
    x = controls.target.x;
    z = controls.target.z;
    lookX = x + (x - camera.position.x);
    lookZ = z + (z - camera.position.z);
  }
  let arrival = findFree(x, z);
  if (!arrival && defaultArrival) {
    const [ax, az, tx, tz, ty] = placeById('clock').walk;
    arrival = findFree(ax, az);
    [lookX, lookZ, lookY] = [tx, tz, ty];
  }
  if (!arrival) {
    toast('There’s no walkable ground there.');
    return false;
  }
  const view = renderer.domElement;
  const focused = document.activeElement;
  if (UI.mode !== 'walk') UI.walkOrigin = el('card').contains(focused) ? UI.cardOrigin : focused;
  UI.fly = null;
  if (keepTour) pauseTour();
  else stopTour();
  teleport(arrival, lookX ?? x, lookZ ?? z - 1, lookY);
  setMode('walk', true, keepTour);
  showCard(null, false);
  updateTourControls();
  view.focus({ preventScroll: true });
  if (!TOUCH && !BENCHMARK) lockPointer();
  else if (TOUCH && !UI.walkHinted) {
    UI.walkHinted = true;
    toast('Use the stick to walk. Drag the view to look around.', 4000);
  }
  return true;
}
function lockPointer() { try { const r = renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { /* the browser wants a click first */ } }
function updateWalk(dt) {
  const W = WALK, K = KEYS;
  W.yaw += ((K.ArrowLeft || K.KeyQ ? 1 : 0) - (K.ArrowRight || K.KeyE ? 1 : 0)) * 1.9 * dt;
  let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0) - W.joy.y + W.go, r = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + W.joy.x;
  const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l; }
  const run = !!(K.ShiftLeft || K.ShiftRight || W.run), sp = (run ? 5.4 : 1.75) * OPT.walkSpeed, sn = Math.sin(W.yaw), cs = Math.cos(W.yaw), dx = (-sn * f + cs * r) * sp * dt, dz = (-cs * f - sn * r) * sp * dt;
  let moved = false;
  if (l > 0.01) {
    let fl = floorAt(W.x + dx, W.z + dz, W.y);
    if (fl !== null) { W.x += dx; W.z += dz; } else if ((fl = floorAt(W.x + dx, W.z, W.y)) !== null) W.x += dx; else if ((fl = floorAt(W.x, W.z + dz, W.y)) !== null) W.z += dz;
    if (fl !== null) { moved = true; W.floor = fl; W.bob += Math.hypot(dx, dz) * 3.3; if (W.onGround && Math.floor(W.bob / Math.PI) !== W.step) { W.step = Math.floor(W.bob / Math.PI); SND.step(); } }
  }
  if (K.Space && W.onGround) { W.vy = 4.6; W.onGround = false; }
  if (W.y > W.floor + 0.002 || W.vy > 0) { W.vy -= 18 * dt; W.y += W.vy * dt; W.onGround = false; if (W.y <= W.floor) { W.y = W.floor; W.vy = 0; W.onGround = true; } }
  else { W.y = Math.min(W.floor, W.y + 5 * dt); W.onGround = true; }
  // camera: looks along (yaw, pitch) from behind the walker's head, pulled in when a wall is in the way
  const cp = Math.cos(W.pitch), fx = -sn * cp, fy = Math.sin(W.pitch), fz = -cs * cp, hy = W.y + W.eye;
  // Offset over the right shoulder so the walker leaves the sightline clear.
  const backX = -fx + cs * 0.2, backY = Math.max(-0.09, -fy), backZ = -fz - sn * 0.2;
  const reach = W.dist > 0 ? camReach(W.x, hy, W.z, backX, backY, backZ, W.dist) : 0;
  W.cam = reach < W.cam || REDUCED_MOTION.matches ? reach : W.cam + (reach - W.cam) * Math.min(1, dt * 4);
  const D = W.cam, fp = D <= 0.7;
  const cx = W.x + backX * D, cz = W.z + backZ * D;
  let cy = hy + backY * D + (fp ? (moved && W.onGround && !REDUCED_MOTION.matches ? Math.sin(W.bob * 2) * 0.022 : 0) : 0.12);
  if (!fp) {      // keep it above the ground and out of any plinth it has backed into
    const td = talabDepthAt(cx, cz); cy = Math.max(cy, (td === null ? Math.min(0, W.y) : td === -99 ? W.y : td) + 0.3);
    for (const p of platformsAt(cx, cz) || []) if (cy > p.yb - 0.2 && cy < p.yt + 0.3 && p.yt < W.y + 4 && inObb(p, cx, cz)) cy = p.yt + 0.3;
  }
  camera.position.set(cx, cy, cz); camera.rotation.set(W.pitch, W.yaw, 0, 'YXZ');
  const fov = fovFor(fp ? 72 : 62, fp ? 88 : 80); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
  if (fp !== W.fp) { W.fp = fp; document.body.classList.toggle('fp', fp); }
  poseHero(dt, moved, run, dx, dz);
  LIFE.player.x = W.x; LIFE.player.y = W.y; LIFE.player.z = W.z;
}
/** start walking at the ground point under a screen position */
function walkAt(x, y) {
  if (UI.mode !== 'orbit' || labelAt(x, y)) return;
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
  const d = new THREE.Vector3(); camera.getWorldDirection(d); enterWalk(hit.x, hit.z, hit.x + d.x, hit.z + d.z);
}
function lookBy(mx, my, k = 0.0023) { if (UI.mode === 'walk') { WALK.yaw -= mx * k; WALK.pitch = clamp(WALK.pitch - my * k, -1.45, WALK.fp ? 1.45 : 0.9); } }

/* ───────────── mode switching ───────────── */
function setMode(m, quiet, keepTour = false) {
  if (m === UI.mode) return;
  if (m === 'walk' && !quiet) return enterWalk();
  const from = UI.mode;
  if (!keepTour) stopTour();
  UI.fly = null; UI.anchor = null; ZOOM.v = 0;
  if (from === 'walk' && document.pointerLockElement) document.exitPointerLock();
  UI.mode = m; document.body.classList.toggle('walk', m === 'walk'); LIFE.player.active = m === 'walk';
  document.querySelectorAll('#modes [data-mode]').forEach(b => {
    b.classList.toggle('on', b.dataset.mode === m);
    b.setAttribute('aria-pressed', b.dataset.mode === m);
  });
  for (const code in KEYS) KEYS[code] = false;
  controls.enabled = m === 'orbit';
  if (m === 'orbit') {
    camera.near = 2; camera.fov = fovFor(FOV, 74); camera.updateProjectionMatrix(); HERO.g.visible = HERO.glow.visible = false; announce(null);
    if (from !== 'orbit') { const p = new THREE.Vector3(WALK.x, WALK.y, WALK.z), d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); controls.target.copy(p).setY(p.y + 4); camera.position.copy(p).addScaledVector(d, -46).setY(p.y + 30); camera.rotation.order = 'XYZ'; controls.update(); }
  } else { camera.near = 0.14; camera.fov = fovFor(72, 88); WALK.go = 0; UI.at = null; camera.updateProjectionMatrix(); setHot(null); updateLabels(); }      // the camera starts at the walker's eyes and drifts back
  if (m === 'walk') { el('keys').innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> hop<br><kbd>Mouse</kbd> look · hold <kbd>Left button</kbd> walk · <kbd>Wheel</kbd> camera<br><kbd>M</kbd> map · <kbd>Esc</kbd> release, <kbd>Esc</kbd> again to leave'; }
}

/* ───────────── labels and the places list ───────────── */
function buildLabels() {
  const list = el('places');
  const explore = LABELS.filter(p => p.cam && !p.small && !p.road && !p.shop);   // shops open from their tags in the scene
  const ordered = [...PILOT_STOPS.map(placeById), ...explore.filter(p => !PILOT_STOPS.includes(p.id))];
  for (const p of ordered) {
    const button = document.createElement('button');
    button.dataset.id = p.id;
    button.setAttribute('aria-pressed', 'false');
    p.listButton = button;
    button.onclick = () => {
      stopTour();
      UI.cardOrigin = button;
      selectPlace(p);
      if (UI.card) el('card').focus({ preventScroll: true });
      else if (el('bPlaces').getClientRects().length) el('bPlaces').focus();
    };
    list.append(button);
  }
  for (const p of LABELS) {
    if (p.nolabel) continue;
    const label = document.createElement('div');
    label.className = 'lbl' + (p.small ? ' small' : '') + (p.road ? ' road' : '') + (p.poi ? ' poi' : '');
    label.append(Object.assign(document.createElement('span'), { className: 'hi' }));
    const english = Object.assign(document.createElement('span'), { className: 'en', textContent: p.en.toUpperCase(), lang: 'en' });
    label.append(english);
    p.dom = label;
    p.obj = new CSS2DObject(label);
    p.obj.visible = false;
    p.obj.position.set(...p.pos);
    if (p.above) p.obj.center.set(0.5, 1);      // hang the tag above its point, not across it
    scene.add(p.obj);
  }
  applyLabelLang();
}
function labelAt(x, y) {
  if (OPT.labels === 'off' || document.body.classList.contains('photo')) return null;
  for (const p of LABELS) if (p.dom && !p.road && (!p.poi || p.shop) && p.obj.visible && p.dom.style.display !== 'none') { const r = p.dom.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return p; }
  return null;
}
function setHot(p) { if (UI.hot === p) return; if (UI.hot) UI.hot.dom.classList.remove('hot'); UI.hot = p; if (p) p.dom.classList.add('hot'); renderer.domElement.style.cursor = p ? 'pointer' : ''; }
function applyLabelLang() {
  document.body.classList.toggle('nolabels', OPT.labels === 'off');
  document.body.classList.toggle('lang-en', OPT.labels === 'en');
  for (const p of LABELS) {
    const name = placeName(p);
    if (p.dom) {
      const alternate = p.dom.firstChild;
      writeVisitorText(alternate, name, locale());
      alternate.hidden = alternate.lang === 'en';
    }
    if (p.listButton) writeVisitorText(p.listButton, name, locale());
  }
  if (UI.card) showCard(UI.card);
  if (UI.announcement) announce(UI.announcement);
  updateTourControls();
}
function announce(p) {
  const banner = el('approach');
  clearTimeout(announce.t);
  UI.announcement = p;
  if (!p) {
    banner.classList.remove('show');
    return;
  }
  banner.querySelector('.hi').hidden = true;
  writeVisitorText(banner.querySelector('b'), placeName(p), locale());
  writeVisitorText(banner.querySelector('small'), p.shop ? SHOP_COPY[p.record.placement] : { en: p.yr || '' }, locale());
  const text = visitorText(p.record?.description || { en: p.text }, locale());
  const firstSentence = text.text.match(/^[^.!?।۔]+[.!?।۔]/)?.[0] || text.text;
  writeVisitorText(banner.querySelector('p'), { en: firstSentence, [text.lang]: firstSentence }, text.lang);
  banner.classList.add('show');
  announce.t = setTimeout(() => announce(null), 8000);
}
function updateLabels() {
  const cp = camera.position, orbit = UI.mode === 'orbit', far = orbit ? Math.max(450, cp.distanceTo(controls.target) * 3.2) : 520, phone = PHONE(), k = phone ? 0.85 : 1;
  const v = new THREE.Vector3(), boxes = [], W = innerWidth, Hh = innerHeight;
  // a name is shown only where it would not land on one already placed (null: off screen)
  const place = (p, w, h) => { v.set(...p.pos).project(camera); if (v.z > 1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) return null; const x = (v.x + 1) * W / 2, y = (1 - v.y) * Hh / 2; if (boxes.some(b => Math.abs(b[0] - x) < b[2] + w && Math.abs(b[1] - y) < b[3] + h)) return false; boxes.push([x, y, w, h]); return true; };
  const cand = [], hiLen = p => placeName(p)[OPT.labels]?.length || 0;
  for (const p of LABELS) if (p.obj) { p.obj.visible = false; if (p.poi) continue; const d = Math.hypot(p.pos[0] - cp.x, p.pos[2] - cp.z); if (d < (p.small || p.road ? far * 0.42 : far) && !(!orbit && d < 14)) cand.push([(p.small ? 1 : p.road ? 2 : 0) * 1e5 + d, p]); }
  const shopTags = OPT.shopTags && OPT.labels !== 'off' && !(orbit && cp.y > 110);
  const shopLabel = p => place(p, Math.max(70, p.en.length * 6.2, hiLen(p) * 6.4) * k / 2, 15 * k);
  const focused = UI.card?.shop ? UI.card : UI.anchor;
  const featured = shopTags && orbit && focused?.shop
    && Math.hypot(focused.pos[0] - cp.x, focused.pos[2] - cp.z) < 35 && shopLabel(focused);
  if (featured) focused.obj.visible = true;
  cand.sort((a, b) => a[0] - b[0]);      // monuments first, then the lesser names, then roads; nearer before farther
  let n = 0; const lim = phone ? 9 : 22;
  for (const [, p] of cand) { if (n >= lim) break; const sm = p.small || p.road, w = Math.max(p.en.length * (sm ? 5.4 : 6.6), hiLen(p) * (sm ? 6.6 : 8.2)) * k / 2 + 4, h = (p.road ? 13 : sm ? 17 : 21) * k; if (place(p, w, h)) { p.obj.visible = true; n++; } }
  // shop-name tags: nearest first, skip any hidden behind walls or overlapping a name already shown
  if (shopTags) {
    const lim = orbit ? 150 : 70, cap = phone ? 6 : 14, cand = [];
    for (const p of LABELS) if (p.poi) {
      if (featured && p === focused) continue;
      const d = Math.hypot(p.pos[0] - cp.x, p.pos[2] - cp.z);
      if (d < lim) cand.push([d - (p.shop ? 18 : 0), p]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    let m = featured ? 1 : 0;
    for (const [, p] of cand) {
      if (m >= cap) break;
      if (!orbit && !lineOfSight(cp.x, cp.z, p.pos[0], p.pos[2])) continue;
      if (shopLabel(p)) { p.obj.visible = true; m++; }
    }
  }
  if (UI.mode === 'walk') { let best = null, bd = 1e9; for (const p of LABELS) if (p.pos && !p.road && !p.poi) { const d = Math.hypot(p.pos[0] - WALK.x, p.pos[2] - WALK.z); if (d < bd) { bd = d; best = p; } } const where = el('where');
    if (best && bd < 400) {
      const name = document.createElement('b');
      writeVisitorText(name, placeName(best), locale());
      where.replaceChildren('Near ', name, ' · ' + Math.round(bd) + ' m');
    } else where.textContent = 'Old city lanes';
    // within reach of a monument (its centre, or the spot you are meant to see it from) for the first time: say where you are
    let at = null, ad = 1e9;
    for (const p of LABELS) if (p.text && p.pos) {
      const front = Math.hypot(p.pos[0] - WALK.x, p.pos[2] - WALK.z);
      if (p.shop && front > 11) continue;
      const arrival = p.walk ? Math.hypot(p.walk[0] - WALK.x, p.walk[1] - WALK.z) : Infinity;
      const d = p.shop ? Math.min(front, arrival) - 50 : Math.min(front - 35, arrival);
      if (d < ad) { ad = d; at = p; }
    }
    if (at && ad < 40) { if (UI.at !== at.id) { UI.at = at.id; announce(at); } } else if (ad > 75) UI.at = null;
  }
}

/* ───────────── minimap ───────────── */
const MM = { s: 0.5, base: null };
function buildMinimap() {
  const B = MAP.bounds, c = document.createElement('canvas'); c.width = (B[1] - B[0]) * MM.s; c.height = (B[3] - B[2]) * MM.s; const g = c.getContext('2d'), X = x => (x - B[0]) * MM.s, Z = z => (z - B[2]) * MM.s;
  const path = (p, close) => { g.beginPath(); addRing(p, close); };
  const addRing = (p, close) => {
    for (let i = 0; i < p.length; i += 2) i ? g.lineTo(X(p[i]), Z(p[i + 1])) : g.moveTo(X(p[i]), Z(p[i + 1]));
    if (close) g.closePath();
  };
  const fill = feature => {
    path(feature.p, true);
    for (const hole of feature.holes || []) addRing(hole, true);
    g.fill('evenodd');
  };
  g.fillStyle = '#dccfb4'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#a8cc8c'; MAP.green.forEach(fill);
  g.fillStyle = '#c9bca2'; for (const h of HOUSES) { g.save(); g.translate(X(h.x), Z(h.z)); g.rotate(-h.rot); g.fillRect(-h.hw * MM.s, -h.hd * MM.s, h.hw * 2 * MM.s, h.hd * 2 * MM.s); g.restore(); }
  g.fillStyle = '#74b3d8'; MAP.water.forEach(fill);
  g.lineCap = g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of MAP.roads) { const foot = /footway|path|steps/.test(r.k); if (foot) continue; path(r.p); g.strokeStyle = pass ? (r._main ? '#fff7df' : '#f4efe2') : '#a99c84'; g.lineWidth = Math.max(1, r._w * MM.s) + (pass ? 0 : 1.4); g.stroke(); }
  path(MAIN.p); g.strokeStyle = '#fff3c8'; g.lineWidth = 7; g.stroke();
  for (const b of MAP.buildings) {
    const center = polyCentroid(b.p);
    g.fillStyle = Object.values(RESERVED_BUILDING_SITES).some(p => pointInPoly(...center, p)) ? '#b5533c' : '#b7a58d';
    fill(b);
  }
  path(DETAILED_CORRIDOR, true);
  g.setLineDash([6, 4]);
  g.lineWidth = 1.4;
  g.strokeStyle = '#735a44';
  g.stroke();
  g.setLineDash([]);
  MM.base = c; MM.B = B;
}
function drawMinimap() {
  const g = el('minimap').getContext('2d'), S = 200, o = UI.mode === 'orbit';
  const sx = o ? controls.target.x : WALK.x, sz = o ? controls.target.z : WALK.z;
  const mpp = o ? clamp(camera.position.distanceTo(controls.target) / 80, 1.2, 8) : 1.05, half = S / 2 * mpp * MM.s, cx = (sx - MM.B[0]) * MM.s, cz = (sz - MM.B[2]) * MM.s;
  g.fillStyle = '#cdbfa3'; g.fillRect(0, 0, S, S); g.drawImage(MM.base, cx - half, cz - half, half * 2, half * 2, 0, 0, S, S);
  if (UI.tour) {
    const tourIndex = UI.tour.index;
    const active = o ? PILOT_LEGS[tourIndex] || PILOT_LEGS[tourIndex - 1] : PILOT_LEGS[tourIndex];
    if (active) {
      g.beginPath();
      for (let i = 0; i < active.p.length; i += 2) {
        const x = S / 2 + (active.p[i] - sx) / mpp, z = S / 2 + (active.p[i + 1] - sz) / mpp;
        if (i) g.lineTo(x, z);
        else g.moveTo(x, z);
      }
      g.lineWidth = 6;
      g.strokeStyle = '#fff7df';
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = '#176765';
      g.stroke();
    }
    const destination = placeById(PILOT_STOPS[tourIndex + (!o && active ? 1 : 0)]);
    const [x, z] = destination.walk;
    const dx = (x - sx) / mpp, dz = (z - sz) / mpp;
    const factor = Math.min(1, (S / 2 - 12) / Math.max(1, Math.abs(dx), Math.abs(dz)));
    g.beginPath();
    g.arc(S / 2 + dx * factor, S / 2 + dz * factor, 5, 0, TAU);
    g.fillStyle = '#176765';
    g.fill();
    g.strokeStyle = '#fff7df';
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.font = '600 10px "Segoe UI",sans-serif'; g.textAlign = 'center';
  for (const p of LABELS) if (p.pos && p.cam && !p.small) {
    if (p.shop && UI.card !== p) continue;   // a shop's dot appears only while its card is open
    const x = S / 2 + (p.pos[0] - sx) / mpp, y = S / 2 + (p.pos[2] - sz) / mpp;
    if (x < 4 || y < 4 || x > S - 4 || y > S - 4) continue;
    g.fillStyle = p.shop ? '#176765' : '#7a1f12';
    g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
    if (mpp < 3.2 && (!p.shop || UI.card === p)) {
      g.fillStyle = '#3a2416';
      g.fillText(visitorText(placeName(p), locale()).text, x, y - 6);
    }
  }
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
    this.market = this.loop(br, 'bandpass', 640, 1.2);
    this.counter = this.loop(wh, 'bandpass', 1550, 1.15);
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
    const [mx, mz] = MARKET_STALLS[0].counter;
    const distance = Math.hypot(cp.x - mx, cp.y, cp.z - mz);
    this.market.gain.setTargetAtTime(0.075 * marketActivity(TIME.hour) * smooth(1 - distance / 66), t, 0.45);
    let serving = 0;
    for (const shop of SHOP_SITES.values()) {
      const [x, z] = shop.service.counter;
      serving = Math.max(serving, shop.activity * smooth(1 - Math.hypot(cp.x - x, cp.y - 1.2, cp.z - z) / 17));
    }
    this.counter.gain.setTargetAtTime(serving * 0.044, t, 0.32);
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
    const h = Math.floor(TIME.hour);
    if (TIME.mode === 'live' && (h + 23) % 24 === this.hour) {
      this.bell(h % 12 || 12, 0.16 * clamp(1 - Math.hypot(cp.x, cp.z, cp.y) / 700, 0.08, 1));
    }
    this.hour = TIME.mode === 'live' ? h : -1;
  },
};

/* ───────────── options panel ───────────── */
function buildOptions() {
  const box = el('options'); box.innerHTML = '';
  const hd = document.createElement('div'); hd.className = 'ohead'; hd.innerHTML = '<span>OPTIONS</span><button class="x" aria-label="Close options">✕</button>'; hd.lastChild.onclick = () => el('bOptions').click(); box.append(hd);
  const h = t => { const e = document.createElement('h3'); e.textContent = t; box.append(e); };
  const row = (label, node) => { const r = document.createElement('div'); r.className = 'row'; const s = document.createElement('span'); s.textContent = label; r.append(s, node); box.append(r); return r; };
  const seg = (label, opts, get, set) => { const w = document.createElement('div'); w.className = 'seg'; for (const [v, t] of opts) { const b = document.createElement('button'); b.textContent = t; b.classList.toggle('on', get() === v); b.setAttribute('aria-pressed', get() === v); b.onclick = () => { set(v); saveOptions(); w.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }; w.append(b); } return row(label, w); };
  const range = (label, min, max, step, get, set) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = get(); i.setAttribute('aria-label', label); i.oninput = () => { set(+i.value); saveOptions(); }; return row(label, i); };
  const check = (label, get, set) => { const l = document.createElement('label'); l.className = 'sw'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = get(); i.onchange = () => { set(i.checked); saveOptions(); }; l.append(i); i.setAttribute('aria-label', label); return row(label, l); };
  const note = t => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; box.append(p); };
  const btn = (label, text, fn) => { const b = document.createElement('button'); b.className = 'mini'; b.textContent = text; b.onclick = fn; return row(label, b); };

  h('Labels & view');
  seg('Labels', [['hi', 'हिंदी'], ['ur', 'اردو'], ['en', 'English'], ['off', 'Off']], () => OPT.labels, v => { OPT.labels = v; OPT.labelsChosen = true; applyLabelLang(); });
  check('Shop name tags', () => OPT.shopTags, v => { OPT.shopTags = v; });
  check('Minimap', () => OPT.minimap, v => { OPT.minimap = v; el('mapWrap').classList.toggle('show', v); });
  btn('Photo mode', 'Hide interface (H)', () => togglePhoto());
  if (document.fullscreenEnabled) btn('Full screen', 'Toggle (F)', toggleFull);

  h('Sky & weather');
  seg('Weather', Object.entries(WEATHER).map(([k, w]) => [k, w.name]), () => OPT.weather, v => setWeather(v));
  check('Festive illumination at night', () => OPT.festive, v => { OPT.festive = v; if (v && TIME.night < 0.3) toast('The lights come on after dark. Try the Night button.'); });
  seg('Festival days', [['auto', 'By date'], ['muharram', '1 Muharram'], ['eid', 'Eid'], ['off', 'Off']], () => OPT.festival, v => { OPT.festival = v; saveOptions(); FEST.key = ''; });
  note('“By date” follows the Hijri calendar as kept in Lucknow; the moon sighting can move it by a day. On 1 Muharram the Shahi Zari procession goes from the Bara to the Chota Imambara, 7 pm to midnight. On Eid the congregation prays at the Asfi Mosque at 11 am.');

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
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(() => { }); } }
function togglePhoto() {
  const original = document.activeElement;
  const on = document.body.classList.toggle('photo');
  const restore = el('restoreView');
  restore.hidden = !on;
  el('ui').inert = on;
  if (on) {
    UI.photoOrigin = original;
    pauseTour();
    if (document.pointerLockElement) document.exitPointerLock();
    restore.focus();
  } else if (UI.photoOrigin?.getClientRects().length) UI.photoOrigin.focus();
  else renderer.domElement.focus({ preventScroll: true });
}
function screenshot() { renderer.render(scene, camera); renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hussainabad-' + Date.now() + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); }

/* ───────────── time bar ───────────── */
function setTime(kind, hour) {
  updateSceneClock();
  TIME.mode = kind === 'live' ? 'live' : 'fixed';
  TIME.preset = TIME.mode === 'fixed' && hour === undefined ? kind : null;
  if (TIME.mode === 'live') updateSceneClock();
  else TIME.hour = hour === undefined ? presetHour(kind) : ((hour % 24) + 24) % 24;
  document.querySelectorAll('#timebar button').forEach(b => {
    const active = b.dataset.t === (TIME.mode === 'live' ? 'live' : TIME.preset);
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', active);
  });
}

/* ───────────── input wiring ───────────── */
function wire() {
  document.querySelectorAll('#modes [data-mode]').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
  el('bTour').onclick = () => {
    if (UI.tour) {
      stopTour();
      showCard(null);
    } else startTour();
  };
  el('tourPrev').onclick = () => seekTour(UI.tour.index - 1);
  el('tourNext').onclick = () => seekTour(UI.tour.index + 1);
  el('tourPlay').onclick = toggleTourPlayback;
  el('tourWalk').onclick = () => enterWalk(...placeById(PILOT_STOPS[UI.tour.index]).walk, true);
  el('tourText').onclick = () => {
    renderItinerary(el('itineraryStops'), locale());
    writeVisitorText(el('itineraryTitle'), GUIDE_COPY.title, locale());
    writeVisitorText(el('itinerary').querySelector('button'), GUIDE_COPY.return, locale());
    el('itinerary').showModal();
    pauseTour();
  };
  el('bOptions').onclick = () => {
    setPlaces(false);
    const open = el('options').classList.toggle('show');
    el('bOptions').classList.toggle('on', open);
    el('bOptions').setAttribute('aria-expanded', open);
    if (!open && el('options').contains(document.activeElement)) el('bOptions').focus();
  };
  el('bPlaces').onclick = () => {
    const open = !el('placesWrap').classList.contains('open');
    if (open && el('options').classList.contains('show')) el('bOptions').click();
    setPlaces(open);
  };
  el('card').querySelector('.x').onclick = () => showCard(null);
  el('cardWalk').onclick = () => { if (UI.card?.walk) enterWalk(...UI.card.walk.slice(0, 4), UI.card.walk[4], !!UI.tour); };
  el('restoreView').onclick = togglePhoto;
  document.querySelectorAll('#timebar button').forEach(b => { b.onclick = () => setTime(b.dataset.t); });
  el('sceneHour').oninput = event => setTime('fixed', event.target.valueAsNumber / 60);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateSceneClock(); });
  el('tExit').onclick = () => {
    setMode('orbit', true, !!UI.tour);
    updateTourControls();
    const origin = UI.walkOrigin;
    if (origin?.matches('button') && origin.getClientRects().length) origin.focus();
    else if (origin?.closest('#places') && el('bPlaces').getClientRects().length) el('bPlaces').focus();
    else document.querySelector('[data-mode="orbit"]').focus();
  };
  el('tRun').onclick = () => {
    WALK.run = !WALK.run;
    el('tRun').classList.toggle('on', WALK.run);
    el('tRun').setAttribute('aria-pressed', WALK.run);
  };
  el('tView').onclick = () => { WALK.dist = WALK.dist > 0 ? 0 : 4.5; }; el('tHop').onclick = () => { if (WALK.onGround) { WALK.vy = 4.6; WALK.onGround = false; } };
  el('zIn').onclick = () => zoomBy(0.6); el('zOut').onclick = () => zoomBy(1 / 0.6);
  el('minimap').onclick = e => { if (UI.mode !== 'orbit') return; const r = e.currentTarget.getBoundingClientRect(), mpp = clamp(camera.position.distanceTo(controls.target) / 80, 1.2, 8) * 200 / r.width; panTo(controls.target.x + (e.clientX - r.left - r.width / 2) * mpp, controls.target.z + (e.clientY - r.top - r.height / 2) * mpp); };
  const cv = renderer.domElement, pts = new Map();
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'Hussainabad 3D scene. Use Places for a shop or landmark, or Tour for the heritage walk.');
  let press = null, hoverT = 0, tap = null, pinch = null;
  cv.addEventListener('pointerdown', e => {
    pauseTour(); UI.fly = null; UI.anchor = null; ZOOM.v = 0; press = [e.clientX, e.clientY, performance.now(), e.button]; UI.ptr = e.pointerType;
    if (e.pointerType === 'touch' && UI.mode === 'orbit') { const now = performance.now(); if (tap && now - tap[2] < 350 && Math.hypot(e.clientX - tap[0], e.clientY - tap[1]) < 28) { tap = null; walkAt(e.clientX, e.clientY); return; } tap = [e.clientX, e.clientY, now]; }
    if (UI.mode === 'orbit') document.body.classList.add('grabbing');
    else if (document.pointerLockElement === cv) WALK.go = e.button === 2 ? -1 : e.button === 0 ? 1 : WALK.go;      // hold left to walk on, right to step back
    else if (!TOUCH && e.button === 0) lockPointer();
    if (UI.mode !== 'orbit') { WALK.drag = [e.clientX, e.clientY, e.pointerId]; if (e.pointerType === 'touch') { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { WALK.drag = null; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: WALK.dist || 1.1 }; } } }
  });
  cv.addEventListener('pointerup', e => {      // a click that did not drag: was it on a place label?
    if (!press || UI.mode !== 'orbit' || press[3] !== 0 || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 5 || performance.now() - press[2] > 500) return;
    const p = labelAt(e.clientX, e.clientY);
    if (p) {
      stopTour();
      UI.cardOrigin = cv;
      selectPlace(p);
    }
  });
  cv.addEventListener('pointermove', e => { if (UI.mode !== 'orbit' || e.buttons || e.timeStamp - hoverT < 50) return; hoverT = e.timeStamp; setHot(labelAt(e.clientX, e.clientY)); });
  cv.addEventListener('pointerleave', () => setHot(null));
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = pinch.dist * pinch.d / Math.max(30, Math.hypot(a[0] - b[0], a[1] - b[1])); WALK.dist = d < 1.1 ? 0 : Math.min(d, 10); return; } }      // fingers apart: closer to the walker, down to first person
    if (document.pointerLockElement === cv) lookBy(e.movementX, e.movementY); else if (WALK.drag && UI.mode !== 'orbit' && e.pointerId === WALK.drag[2]) { lookBy(-(e.clientX - WALK.drag[0]) * 1.6, -(e.clientY - WALK.drag[1]) * 1.6); WALK.drag[0] = e.clientX; WALK.drag[1] = e.clientY; } });
  const release = e => { if (e) pts.delete(e.pointerId); else pts.clear(); if (pts.size < 2) pinch = null; if (!e || !WALK.drag || WALK.drag[2] === e.pointerId) WALK.drag = null; WALK.go = 0; document.body.classList.remove('grabbing'); };      // lifting the stick finger must not end a look-drag by the other
  addEventListener('pointerup', release); addEventListener('pointercancel', release);
  // caught on the way down to the canvas, so the wheel is ours alone (OrbitControls still handles pinch and middle-drag zoom)
  el('stage').addEventListener('wheel', e => { e.stopPropagation(); if (e.ctrlKey || e.metaKey) return; e.preventDefault(); UI.fly = null; UI.anchor = null; pauseTour(); if (UI.mode === 'walk') { const out = e.deltaY > 0; let d = WALK.dist + (out ? 1 : -1) * Math.max(0.7, WALK.dist * 0.2); if (d < 1.3) d = out ? 1.6 : 0; WALK.dist = Math.min(d, 10); } else wheelZoom(e); }, { capture: true, passive: false });      // walk: wheeling right in looks through the walker's eyes
  cv.addEventListener('dblclick', e => { if (UI.ptr !== 'touch') walkAt(e.clientX, e.clientY); });      // touch has its own double-tap above

  document.addEventListener('pointerlockchange', () => { WALK.locked = document.pointerLockElement === cv; if (!WALK.locked) WALK.go = 0; if (!WALK.locked && UI.mode === 'walk') toast('Click the view to look around again · Esc to leave walk mode', 3600); });
  // touch joystick
  const joy = el('joy'), knob = joy.firstElementChild; let jid = null;
  const jmove = e => { const r = joy.getBoundingClientRect(), x = clamp((e.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1), y = clamp((e.clientY - r.top - r.height / 2) / (r.height / 2), -1, 1); WALK.joy.x = x; WALK.joy.y = y; knob.style.transform = `translate(${x * 30}px,${y * 30}px)`; };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
  const jend = () => { jid = null; WALK.joy.x = WALK.joy.y = 0; knob.style.transform = ''; }; joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  addEventListener('keydown', e => {
    if (el('itinerary').open || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Escape') {
      if (document.body.classList.contains('photo')) togglePhoto();
      else if (el('options').classList.contains('show')) el('bOptions').click();
      else if (el('placesWrap').classList.contains('open')) { setPlaces(false); el('bPlaces').focus(); }
      else if (UI.mode === 'walk') el('tExit').click();
      else if (UI.card) showCard(null);
      else stopTour();
      return;
    }
    if (e.target.closest?.('input, select, textarea, button, a, [contenteditable]') && !(e.code === 'KeyH' && e.target === el('restoreView'))) return;
    KEYS[e.code] = true;
    if (UI.mode === 'walk' && /Arrow|Space/.test(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Digit1') setMode('orbit'); else if (e.code === 'Digit2') setMode('walk');
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomBy(0.6); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomBy(1 / 0.6);
    else if (e.code === 'KeyO') el('bOptions').click(); else if (e.code === 'KeyH') togglePhoto(); else if (e.code === 'KeyF') toggleFull(); else if (e.code === 'KeyP') screenshot(); else if (e.code === 'KeyT' && UI.mode === 'orbit') el('bTour').click();
    else if (e.code === 'KeyM') { OPT.minimap = !OPT.minimap; el('mapWrap').classList.toggle('show', OPT.minimap); saveOptions(); buildOptions(); }
    else if (e.code === 'KeyL') { const o = ['hi', 'ur', 'en', 'off']; OPT.labels = o[(o.indexOf(OPT.labels) + 1) % 4]; OPT.labelsChosen = true; applyLabelLang(); saveOptions(); buildOptions(); }
  });
  addEventListener('keyup', e => { KEYS[e.code] = false; });
  addEventListener('focusin', e => { if (e.target !== cv) for (const key in KEYS) KEYS[key] = false; });
  addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; release(); });
  const onResize = () => { if (UI.anchor && UI.mode === 'orbit') flyTo(UI.anchor, 0); camera.aspect = innerWidth / innerHeight; if (UI.mode === 'orbit') camera.fov = fovFor(FOV, 74); camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight); };
  addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 350));      // phones report the new size a moment after turning
  // The hint shares the bottom edge with the time bar, whose width changes with
  // language and screen size. Keep it beside the bar when it fits;
  // otherwise lift it above the zoom buttons, and hide it if even that collides.
  const hint = el('hint'), timebar = el('timebar');
  const fitHint = () => {
    hint.style.bottom = hint.style.visibility = '';
    if (!hint.offsetWidth) return;            // hidden in Walk and on touch screens
    const box = () => hint.getBoundingClientRect();
    const zoom = el('zoom').getBoundingClientRect(), bar = timebar.getBoundingClientRect();
    if (box().right + 14 <= bar.left && (!zoom.height || box().top >= zoom.bottom + 4)) return;
    if (zoom.height) hint.style.bottom = (innerHeight - zoom.top + 8) + 'px';
    const places = el('placesWrap').getBoundingClientRect();
    const blocked = !zoom.height || (places.height && box().top < places.bottom + 8);
    if (blocked || box().right + 14 > bar.left && box().bottom > bar.top) hint.style.visibility = 'hidden';
  };
  new ResizeObserver(fitHint).observe(timebar);
  addEventListener('resize', fitHint);
  // Re-fit when Walk or a card toggles the hint's display.
  new MutationObserver(fitHint).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/* ───────────── main loop ───────────── */
const _clock = new THREE.Clock(), _foc = new THREE.Vector3(); let _shadowHalf = 300, _slow = 0, _warned = false, _lastClock = '';
function frame() {
  if (document.body.classList.contains('scene-failed')) return;
  requestAnimationFrame(frame);
  const raw = _clock.getDelta(), dt = Math.min(raw, 0.05); UI.T += dt; UI.frame++;
  updateSceneClock();
  // camera first, so the sky and shadows follow it without lag
  if (UI.mode === 'orbit') {
    if (UI.fly) { const f = UI.fly; f.t += Math.min(raw, 0.3) / f.dur; const k = ease(Math.min(f.t, 1)); camera.position.lerpVectors(f.c0, f.c1, k); controls.target.lerpVectors(f.t0, f.t1, k); if (f.t >= 1) UI.fly = null; }
    if (UI.tour && !UI.tour.paused && !UI.fly) {
      UI.tour.left -= dt;
      if (UI.tour.left <= 0) {
        if (UI.tour.index + 1 < PILOT_STOPS.length) seekTour(UI.tour.index + 1);
        else pauseTour();
      }
    }
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
  updateShopService(dt);
  for (const u of UPDATERS) u(dt, UI.T);
  updateLife(dt, UI.T);
  sun.target.position.copy(_foc); sun.position.copy(_foc).addScaledVector(sunVec, 900);
  const hr = -(TIME.hour % 12) / 12 * TAU, mn = -(TIME.hour % 1) * TAU; for (const c of CLOCK_HANDS) { c.h.rotation.z = hr; c.m.rotation.z = mn; }
  const minute = Math.min(1439, Math.floor(TIME.hour * 60 + 1e-7));
  const s = String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
  if (s !== _lastClock) {
    _lastClock = s;
    el('clock').firstChild.textContent = s;
    el('sceneHour').value = minute;
    el('sceneHour').setAttribute('aria-valuetext', s + ' IST');
  }
  if (UI.frame % 6 === 0) updateLabels();
  if (OPT.minimap && UI.frame % 4 === 0) drawMinimap();
  SND.tick(dt);
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  if (!_warned && UI.T > 6) { _slow = raw > 0.045 ? _slow + raw : Math.max(0, _slow - raw * 0.5); if (_slow > 5 && OPT.quality !== 'low') { _warned = true; toast('Running slowly? Options → Graphics → Low will lighten the scene.', 6000); } }
}

async function startScene() {
  const step = async (key, message, run) => {
    setLoad(message);
    await new Promise(resolve => setTimeout(resolve, 30));
    const start = performance.now();
    run();
    if (BENCHMARK) BENCHMARK.stages[key] = performance.now() - start;
  };
  await step('roads', 'Laying out the street map of Lucknow…', () => { buildGround(); buildRoads(); buildSidewalks(); });
  await step('houses', 'Growing the old city along its lanes…', () => { buildHouses(); nameShops(); buildHouseMeshes(); buildMappedBuildings(); });
  await step('monuments', 'Raising the monuments…', buildMonuments);
  await step('vegetation', 'Planting trees and lighting the lamps…', () => { gFlush(); scatterTrees(); buildTrees(); planStreetFurniture(); buildStreetDetail(); buildLamps(); buildWires(); });
  await step('life', 'Calling out the tongas, rickshaws and crowds…', buildLife);
  await step('night', 'Switching on the floodlights…', buildNight);
  await step('festival', 'Checking the Hijri calendar…', buildFestival);
  await step('navigation', 'Preparing walkable ground…', () => {
    buildNav();
    buildPilotLegs();
    for (const place of LABELS) {
      if (place.shop && floorAt(place.walk[0], place.walk[1], 0) === null) place.walk = null;
    }
  });
  await step('controls', 'Opening the gates…', () => { buildMinimap(); buildLabels(); buildOptions(); wire(); });
  el('mapWrap').classList.toggle('show', OPT.minimap);
  setTime(BENCHMARK ? 'noon' : 'live');
  applyTime(0.016, 0);
  updateShopService(2.5);
  if (OPT.sound) addEventListener('pointerdown', () => SND.start(), { once: true });
  controls.enableDamping = !REDUCED_MOTION.matches;
  REDUCED_MOTION.addEventListener('change', () => {
    controls.enableDamping = !REDUCED_MOTION.matches;
    if (REDUCED_MOTION.matches) {
      pauseTour();
      if (UI.fly) moveCamera(UI.fly.c1, UI.fly.t1, 0);
      ZOOM.v = 0;
    }
  });
  camera.fov = fovFor(FOV, 74);
  camera.updateProjectionMatrix();
  flyTo(placeById('clock'), BENCHMARK ? 0 : 3);
  frame();
  window.HUSSAINABAD = {
    scene, camera, controls, renderer, UI, WALK, TIME, OPT, LIFE, HERO, NAV,
    setMode, enterWalk, flyTo, zoomBy, panTo, setTime, setWeather, floorAt,
    look: (x, y, z, tx, ty, tz) => {
      UI.anchor = null;
      moveCamera(new THREE.Vector3(x, y, z), new THREE.Vector3(tx, ty, tz), 0);
    },
  };
}
