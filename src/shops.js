'use strict';
/* Shop geometry and the public spaces immediately in front of it. */

const CHOTA_SHOP_ROW = { centre: 37.5, edge: -3.65, first: -22.9, step: 4.16, count: 12 };
const SHOP_SITES = new Map(SHOP_IDS.map(id => {
  const record = SHOP_CATALOG[id];
  const base = record.frame ? FRAME[record.frame] : WORLD;
  const { centre, first, step, edge } = CHOTA_SHOP_ROW;
  const anchor = record.kind === 'bay' ? [centre - first - record.bay * step, edge] : record.anchor;
  const [x, z] = toWorld(base, ...anchor);
  return [id, { id, record, frame: { x, z, rot: base.rot + record.facing }, activity: 0 }];
}));
const SHOP_PLOTS = [...SHOP_SITES.values()].filter(shop => shop.record.kind === 'frontage').map(shop => {
  const { width, depth } = shop.record, { rot } = shop.frame;
  const [x, z] = toWorld(shop.frame, 0, -depth / 2);
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x, z, ux: c, uz: -s, vx: s, vz: c, hw: width / 2 + 0.26, hd: depth / 2 + 0.22 };
});

function nearShopEntrance(x, z, margin = 0) {
  for (const { frame, record } of SHOP_SITES.values()) {
    // Check in the shop frame so a long bay can sit beside a passing route.
    const [halfWidth, back, front] = record.reserve;
    if (Math.abs(x - frame.x) > front + halfWidth + margin || Math.abs(z - frame.z) > front + halfWidth + margin) continue;
    const [across, along] = toLocal(frame, x, z);
    if (Math.abs(across) < halfWidth + margin && along > back - margin && along < front + margin) return true;
  }
  return false;
}

const SHOP_MAT = {
  red: M(0x813233, { map: TEX.weathered }),
  roof: M(0xe1c99e, { map: TEX.plaster }),
  plaster: M(0xd5bf9a, { map: TEX.weathered }),
  blue: M(0x315d62, { map: TEX.weathered }),
  tile: M(0xd6c6a3, { map: TEX.paver }),
  steel: M(0xaeb4b6, { metalness: 0.42, roughness: 0.42, envMap: ENV }),
  enamel: M(0xede9d3),
  bread: M(0xd99f51),
  kebab: M(0x7f442a),
  trim: M(0xc49a5c),
};
ENVMATS.push(SHOP_MAT.steel);

function shopSign(shop, parent, width, y, z) {
  const cell = SHOPS.length + SHOP_IDS.indexOf(shop.id);
  const board = signBoard(parent, width, 0, y, z, cell, shop.board);
  return board.position;
}

function shopAwning(parent, width, depth, y, z, material, striped = false) {
  const awning = grp(parent, 0, z, 0, y);
  awning.rotation.x = 0.18;
  B(awning, material, width, 0.075, depth, 0, 0, 0, true);
  B(awning, material, width, 0.22, 0.08, 0, -0.15, depth / 2, true);
  if (striped) for (let i = -3; i <= 3; i++) {
    B(awning, SHOP_MAT.roof, width * 0.053, 0.012, depth, i * width / 7, 0.076, 0, true);
    B(awning, SHOP_MAT.roof, width * 0.053, 0.19, 0.025, i * width / 7, -0.14, depth / 2 + 0.044, true);
  }
}

// The cover rolls down within the service opening, above its permanent counter.
function counterCover(shop, width, height, x, top, z) {
  const cover = frameGroup(shop.frame);
  const panel = B(cover, MAT.shutter, width, height, 0.06, x, 0, z, true);
  panel.castShadow = false;
  scene.add(cover);
  shop.cover = { panel, top, height };
}

function counterLight(shop, parent, x, y, z, counterY, width) {
  const bulb = M(0xc3aa83, { emissive: 0xffddb3, emissiveIntensity: 0 });
  B(parent, MAT.iron, width * 0.61, 0.095, 0.18, x, y, z, true);
  B(parent, bulb, width * 0.56, 0.035, 0.14, x, y - 0.035, z, true).castShadow = false;
  const local = frameGroup(shop.frame);
  const spill = new THREE.MeshBasicMaterial({
    map: glowTex, color: 0xffca83, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8,
  });
  const pool = flatRect(local, spill, width, 0.9, x, z, counterY + 0.015);
  pool.renderOrder = 2;
  scene.add(local);
  const [wx, wz] = toWorld(shop.frame, x, z + 0.19);
  shop.light = { bulb, pool, position: new THREE.Vector3(wx, y - 0.28, wz), power: 0 };
}

function shopService(shop, { staff, entry, counter, exit, steam, floor = 0 }) {
  shop.staff = { point: toWorld(shop.frame, ...staff), yaw: shop.frame.rot, floor };
  shop.service = {
    shop, entry: toWorld(shop.frame, ...entry), counter: toWorld(shop.frame, ...counter),
    exit: toWorld(shop.frame, ...exit), floor,
  };
  MARKET_STALLS.push(shop.service);
  if (steam) {
    const [x, y, z] = steam, [wx, wz] = toWorld(shop.frame, x, z);
    shop.steam = [wx, y, wz];
  }
}

function teaVessel(parent, x, y, z, metal) {
  C(parent, metal, 0.22, 0.17, 0.37, x, y, z, 12, false, true);
  C(parent, SHOP_MAT.steel, 0.225, 0.22, 0.045, x, y + 0.37, z, 12, false, true);
  S(parent, MAT.wood, 0.064, x, y + 0.43, z, 0.65);
  C(parent, MAT.copper, 0.03, 0.03, 0.19, x, y + 0.21, z + 0.245, 6, false, true).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    C(parent, SHOP_MAT.enamel, 0.055, 0.041, 0.095, x + 0.43 + i * 0.14, y, z + 0.06, 8, false, true);
  }
}

function buildTunday(parent, shop) {
  const roof = cone(parent, SHOP_MAT.roof, 4.75, 1.23, 0, 3.7, 0, 4);
  roof.rotation.y = Math.PI / 4;
  for (const x of [-3.0, 3.0]) for (const z of [-2.92, 2.92]) {
    B(parent, MAT.iron, 0.14, 3.7, 0.14, x, 0, z, true);
    addCol(parent, x, z, 0.075, 0.075, 0, 3.7);
    B(parent, MAT.stoneD, 0.32, 0.14, 0.32, x, 0, z, true);
  }
  for (const z of [-3.05, 3.05]) B(parent, SHOP_MAT.red, 6.35, 0.26, 0.2, 0, 3.45, z, true);
  for (const x of [-3.05, 3.05]) B(parent, SHOP_MAT.red, 0.2, 0.26, 6.2, x, 3.45, 0, true);
  const width = 5.55;
  for (const z of [-3.29, 3.29]) {
    B(parent, MAT.wood, width + 0.14, 1.43, 0.13, 0, 2.62, z, true);
  }
  const sign = shopSign(shop, parent, width, 2.64, 3.29);
  shopSign(shop, grp(parent, 0, 0, Math.PI), width, 2.64, 3.29);

  flatRect(parent, SHOP_MAT.tile, 6.4, 6.1, 0, 0.06, 0.027);
  B(parent, SHOP_MAT.red, 5.28, 0.96, 1.0, 0, 0, 2.02);
  B(parent, MAT.stone, 5.46, 0.09, 1.16, 0, 0.96, 2.02, true);
  B(parent, SHOP_MAT.trim, 5.32, 0.095, 0.055, 0, 0.8, 2.54, true);
  for (const x of [-1.72, 0, 1.72]) B(parent, MAT.wood, 1.53, 0.52, 0.075, x, 0.17, 2.53, true);
  B(parent, MAT.woodL, 4.5, 0.88, 0.62, -0.16, 0, -2.47);
  B(parent, SHOP_MAT.red, 5.35, 1.26, 0.12, 0, 0, -2.88, true);
  B(parent, SHOP_MAT.trim, 5.41, 0.065, 0.05, 0, 1.23, -2.96, true);
  for (const x of [-1.82, 0, 1.82]) B(parent, MAT.wood, 1.54, 0.69, 0.065, x, 0.31, -2.96, true);
  B(parent, MAT.iron, 1.74, 0.12, 0.96, -1.52, 1.05, 2.04, true);
  C(parent, MAT.iron, 0.55, 0.49, 0.083, -1.52, 1.17, 2.04, 24, false, true);
  C(parent, MAT.black, 0.51, 0.51, 0.03, -1.52, 1.25, 2.04, 20, false, true);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    C(parent, SHOP_MAT.kebab, 0.091, 0.105, 0.056,
      -1.52 + 0.32 * Math.cos(angle), 1.28, 2.04 + 0.32 * Math.sin(angle), 9, false, true);
  }
  B(parent, MAT.woodL, 0.99, 0.049, 0.52, -0.15, 1.05, 2.02, true);
  B(parent, SHOP_MAT.steel, 0.055, 0.043, 0.53, -0.53, 1.11, 2.04, true).rotation.y = 0.31;
  B(parent, MAT.wood, 0.32, 0.065, 0.068, -1.04, 1.26, 2.5, true).rotation.y = 0.43;
  for (const x of [0.68, 1.18, 1.76]) C(parent, SHOP_MAT.enamel, 0.18, 0.14, 0.065, x, 1.05, 2.03, 12, false, true);
  C(parent, SHOP_MAT.bread, 0.25, 0.25, 0.058, 1.33, 1.12, 2.04, 14, false, true);
  for (const x of [-1.75, -0.95, -0.15, 0.65, 1.35]) {
    C(parent, SHOP_MAT.steel, 0.17, 0.135, 0.28, x, 0.88, -2.52, 9, false, true);
  }
  B(parent, MAT.iron, 5.40, 0.22, 0.26, 0, 2.78, 2.53, true);
  counterCover(shop, 5.35, 1.75, 0, 2.81, 2.57);
  counterLight(shop, parent, -0.45, 2.82, 2.05, 1.05, 4.6);
  shopService(shop, {
    staff: [-1.52, 1.18], entry: [2.5, 5.5], counter: [1.25, 3.67], exit: [-2.3, 5.5],
    steam: [-1.52, 1.42, 2.04],
  });
  return sign;
}

function buildGlobe(parent, shop) {
  const { width, depth } = shop.record;
  const recess = 2.02;
  P(parent, SHOP_MAT.tile, width, 0.16, recess + 0.8, 0, 0, (0.8 - recess) / 2);
  B(parent, SHOP_MAT.plaster, width, 7.42, depth - recess, 0, 0, -(depth + recess) / 2);
  B(parent, SHOP_MAT.plaster, width, 4.68, recess, 0, 2.74, -recess / 2);
  for (const x of [-(width - 0.44) / 2, (width - 0.44) / 2]) {
    B(parent, SHOP_MAT.blue, 0.44, 2.74, recess, x, 0, -recess / 2);
    B(parent, MAT.stone, 0.49, 0.19, 0.09, x, 0.16, 0.05, true);
  }
  B(parent, MAT.stone, width + 0.22, 0.18, 0.26, 0, 4.23, 0.07, true);
  B(parent, MAT.whiteD, width + 0.24, 0.23, 0.26, 0, 7.23, 0.08, true);
  B(parent, MAT.wood, width - 0.34, 1.29, 0.15, 0, 2.83, 0.11, true);
  const sign = shopSign(shop, parent, width - 0.64, 2.8, 0.17);
  shopAwning(parent, width + 0.17, 1.48, 2.69, 0.78, SHOP_MAT.red, true);

  for (const x of [-1.96, 0, 1.96]) {
    rectDecal(parent, MAT.recess, 1.21, 1.82, x, 4.75, 0.02);
    for (const side of [-1, 1]) B(parent, MAT.doorG, 0.18, 1.88, 0.12, x + side * 0.52, 4.72, 0.17, true);
    B(parent, MAT.stoneD, 1.45, 0.1, 0.27, x, 4.65, 0.12, true);
    B(parent, MAT.stone, 1.44, 0.23, 0.19, x, 6.55, 0.12, true);
  }
  const panel = SHOP_MAT.blue;
  B(parent, panel, 2.12, 0.94, 0.66, -1.72, 0.16, -0.3);
  B(parent, MAT.woodL, 2.26, 0.09, 0.79, -1.72, 1.1, -0.3, true);
  for (const x of [-2.29, -1.89, -1.48]) C(parent, SHOP_MAT.enamel, 0.071, 0.064, 0.08, x, 1.19, -0.18, 8, false, true);
  B(parent, MAT.woodL, 0.95, 0.11, 0.72, 1.6, 0.87, -0.72, true);
  B(parent, MAT.iron, 0.10, 0.73, 0.10, 1.6, 0.16, -0.72, true);
  B(parent, panel, 1.36, 0.48, 0.48, 1.77, 0.16, -1.49, true);
  B(parent, panel, 1.36, 0.53, 0.10, 1.77, 0.64, -1.68, true);
  rectDecal(parent, MAT.doorG, 1.09, 2.09, 0.02, 0.16, -recess + 0.01);
  B(parent, MAT.woodL, 1.42, 0.10, 0.22, -1.7, 1.6, -1.85, true);
  for (const x of [-2.26, -1.91, -1.56, -1.23]) C(parent, SHOP_MAT.steel, 0.11, 0.115, 0.20, x, 1.71, -1.82, 8, false, true);
  counterCover(shop, 2.17, 1.56, -1.72, 2.75, 0.11);
  counterLight(shop, parent, -1.45, 2.61, -0.27, 1.19, 2.15);
  shopService(shop, {
    staff: [-1.72, -1.12], entry: [-2.72, 2.17], counter: [-1.78, 0.94], exit: [-0.65, 2.14], floor: 0.16,
  });
  return sign;
}

function buildTeaBay(parent, shop) {
  const dumTea = shop.id === 'irani-dum-tea', w = CHOTA_SHOP_ROW.step;
  const panel = dumTea ? SHOP_MAT.red : SHOP_MAT.blue;
  B(parent, SHOP_MAT.plaster, w, 3.3, 1.34, 0, 0, -2.53);
  B(parent, SHOP_MAT.plaster, w, 1.02, 1.86, 0, 2.28, -0.93);
  for (const x of [-1.94, 1.94]) B(parent, SHOP_MAT.plaster, 0.28, 2.28, 1.86, x, 0, -0.93);
  flatRect(parent, SHOP_MAT.tile, w - 0.56, 1.86, 0, -0.93, 0.026);
  shopAwning(parent, 3.9, 1.09, 2.29, 0.55, panel);
  const sign = shopSign(shop, parent, 3.68, 2.38, 0.12);

  B(parent, panel, 3.24, 0.96, 0.55, 0, 0, 0.09);
  B(parent, MAT.woodL, 3.45, 0.09, 0.73, 0, 0.96, 0.09, true);
  B(parent, SHOP_MAT.trim, 3.23, 0.055, 0.04, 0, 0.67, 0.38, true);
  teaVessel(parent, -0.76, 1.05, 0.11, dumTea ? MAT.copper : SHOP_MAT.steel);
  for (const x of [-1.1, 1.02]) {
    B(parent, MAT.wood, 0.82, 0.073, 0.38, x, 1.32, -1.65, true);
    for (let j = 0; j < 3; j++) C(parent, dumTea ? SHOP_MAT.bread : SHOP_MAT.enamel, 0.08, 0.075, 0.17, x + (j - 1) * 0.23, 1.4, -1.66, 8, false, true);
  }
  counterCover(shop, 3.37, 1.24, 0, 2.28, 0.47);
  counterLight(shop, parent, -0.13, 2.16, 0.02, 1.05, 3.18);
  shopService(shop, {
    staff: [-0.68, -0.64], entry: [-1.2, 3.25], counter: [0.71, 1.45], exit: [1.45, 3.5],
    steam: [-0.76, 1.52, 0.11],
  });
  return sign;
}

function buildMarketKiosk(parent, shop) {
  const bread = shop.id === 'kamar-sheermal';
  const panel = bread ? SHOP_MAT.red : SHOP_MAT.blue;
  B(parent, panel, 3.66, 2.69, 0.22, 0, 0, -1.53);
  B(parent, panel, 3.8, 0.32, 2.91, 0, 2.37, -0.18);
  for (const x of [-1.72, 1.72]) B(parent, panel, 0.22, 2.5, 2.63, x, 0, -0.16);
  flatRect(parent, SHOP_MAT.tile, 3.62, 2.9, 0, -0.05, 0.027);
  shopAwning(parent, 3.84, 1.21, 2.31, 1.58, bread ? SHOP_MAT.roof : SHOP_MAT.red, true);
  const sign = shopSign(shop, parent, 3.62, 2.44, 1.23);
  B(parent, panel, 3.18, 0.93, 0.63, 0, 0, 0.87);
  B(parent, MAT.woodL, 3.35, 0.09, 0.75, 0, 0.93, 0.87, true);
  if (bread) {
    for (const x of [-0.95, -0.35, 0.31]) for (let j = 0; j < 4; j++) {
      C(parent, SHOP_MAT.bread, 0.21, 0.22, 0.034, x + j * 0.013, 1.03 + j * 0.037, 0.9, 12, false, true);
    }
  } else teaVessel(parent, -0.84, 1.02, 0.84, SHOP_MAT.steel);
  counterCover(shop, 3.19, 1.35, 0, 2.37, 1.27);
  counterLight(shop, parent, 0, 2.26, 0.88, 1.02, 3.05);
  shopService(shop, {
    staff: [-0.62, 0.01], entry: [-1.45, 3.52], counter: [0.7, 2.04], exit: [1.52, 3.8],
    steam: bread ? undefined : [-0.84, 1.5, 0.84],
  });
  return sign;
}

function buildShopStreet(parent, shop) {
  const { kind } = shop.record;
  if (kind === 'frontage') {
    // Repair strip and a flush drain between the threshold and road.
    flatRect(parent, GM.pathTop, 7.4, 2.75, 0, 2.13, 0.169);
    B(parent, MAT.iron, 0.25, 0.026, 0.88, 2.65, 0.17, 2.56, true);
    for (let j = -3; j <= 3; j++) B(parent, MAT.tin, 0.23, 0.012, 0.028, 2.65, 0.197, 2.56 + j * 0.116, true);
    B(parent, MAT.iron, 0.052, 5.8, 0.052, 2.83, 0.56, 0.05, true);
    B(parent, MAT.tin, 0.27, 0.32, 0.10, 2.83, 1.72, 0.08, true);
  } else if (kind === 'bay') {
    flatRect(parent, GM.herring, 3.98, 2.36, 0, 1.2, 0.033);
    B(parent, MAT.stoneD, 3.88, 0.033, 0.15, 0, 0, 2.38, true);
  } else if (kind === 'stall') {
    flatRect(parent, GM.pathTop, 6.45, 2.03, 0, 3.9, 0.034);
    B(parent, SHOP_MAT.blue, 0.50, 0.73, 0.52, -3.8, 0, -2.42);
    B(parent, MAT.tin, 0.57, 0.09, 0.60, -3.8, 0.73, -2.42, true);
    B(parent, MAT.woodL, 1.78, 0.09, 0.47, 3.32, 0.49, -1.64, true);
    for (const z of [-1.88, -1.40]) B(parent, MAT.iron, 0.39, 0.49, 0.085, 3.32, 0, z, true);
  }
}

function buildShopFronts() {
  const builders = { stall: buildTunday, frontage: buildGlobe, bay: buildTeaBay, kiosk: buildMarketKiosk };
  const streets = new THREE.Group();
  for (const shop of SHOP_SITES.values()) {
    const { id, record, frame } = shop;
    const parent = frameGroup(frame);
    streets.add(parent);
    shop.board = signMats[0].clone();
    const board = builders[record.kind](parent, shop);
    buildShopStreet(parent, shop);

    const world = (x, y, z) => {
      const [wx, wz] = toWorld(frame, x, z);
      return [wx, y, wz];
    };
    const tgt = world(0, 2.05, board.z - 0.05);
    const views = [
      { name: SHOP_COPY.approach, cam: world(record.kind === 'stall' ? 4.9 : 1.65, 3.0, board.z + 13), tgt },
      { name: SHOP_COPY.service, cam: world(record.kind === 'stall' ? 1.55 : -0.5, 2.25, board.z + (record.kind === 'stall' ? 5.7 : 5.0)), tgt: world(0, 1.65, board.z - 0.7) },
    ];
    if (record.kind === 'stall') views.push({
      name: SHOP_COPY.opposite, cam: world(-5.9, 3.1, -13.6), tgt: world(0, 2.5, -2.9),
    });
    const [tx, ty, tz] = tgt;
    LABELS.push({
      id, ...record.name, record, poi: true, shop, views, cam: views[0].cam, tgt,
      pos: world(0, board.y + (record.kind === 'stall' ? 0.9 : 0.67), board.z + 0.3),
      text: record.description.en, walk: [...toWorld(frame, ...record.arrival), tx, tz, ty],
    });
  }
  bake(streets);
}

// A single nearby fill light on Medium and High complements the baked spill
// used on all presets. Its presence is fixed so shaders stay warm.
const shopFill = Q.shadow ? new THREE.PointLight(0xffd8a4, 0, 6.5, 2) : null;
if (shopFill) scene.add(shopFill);

function updateShopService(dt) {
  let nearest = null, closest = 18 ** 2;
  const mix = 1 - Math.exp(-dt * 2.9);
  for (const shop of SHOP_SITES.values()) {
    const [opens, closes] = shop.record.hours;
    const target = smooth((TIME.hour - opens) / 0.55) * (1 - smooth((TIME.hour - closes + 0.7) / 0.7));
    shop.activity += (target - shop.activity) * mix;
    const service = shop.activity;
    const { panel, height, top } = shop.cover;
    const progress = 1 - service;
    panel.visible = progress > 0.03;
    panel.scale.y = Math.max(0.03, progress);
    panel.position.y = top - height * panel.scale.y / 2;

    const { light } = shop;
    light.power = service * (0.09 + 0.91 * TIME.lamps);
    light.bulb.emissiveIntensity = light.power * 1.55;
    light.pool.material.opacity = light.power * 0.46;
    light.pool.visible = light.power > 0.025;
    shop.board.emissiveIntensity = 0.065 + TIME.lamps * (0.105 + service * 0.29);
    const distance = camera.position.distanceToSquared(light.position);
    if (light.power > 0.035 && distance < closest) {
      nearest = light;
      closest = distance;
    }
  }
  if (shopFill) {
    if (nearest) shopFill.position.copy(nearest.position);
    const power = nearest ? nearest.power * 13 * smooth(1 - Math.max(0, Math.sqrt(closest) - 6) / 12) : 0;
    shopFill.intensity += (power - shopFill.intensity) * mix;
  }
}
