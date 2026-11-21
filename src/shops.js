'use strict';
/* Featured shopfronts and the public space immediately in front of them.
   Each storefront follows the reference photos listed in
   docs/astra-6.2/shop-references.md: sign colours and lettering, the shape of
   the counter and the things a visitor sees from the pavement. */

const CHOTA_SHOP_ROW = { centre: 37.5, edge: -3.65, first: -22.9, step: 4.16, count: 12 };
const SHOP_SITES = new Map(SHOP_IDS.map(id => {
  const record = SHOP_CATALOG[id];
  const base = record.frame ? FRAME[record.frame] : WORLD;
  const { centre, first, step, edge } = CHOTA_SHOP_ROW;
  const anchor = record.kind === 'bay' ? [centre - first - record.bay * step, edge] : record.anchor;
  const [x, z] = toWorld(base, ...anchor);
  return [id, { id, record, frame: { x, z, rot: base.rot + record.facing }, activity: 0, boards: [], glow: [] }];
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

const stripeTex = canvasTex(64, 8, (x, w, h) => {
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f3f1e8' : '#2c7a46'; x.fillRect(i * 8, 0, 8, h); }
}, 2.6, 1);
const SHOP_MAT = {
  red: M(0x813233, { map: TEX.weathered }),
  plaster: M(0xd5bf9a, { map: TEX.weathered }),
  blue: M(0x315d62, { map: TEX.weathered }),
  tile: M(0xd6c6a3, { map: TEX.paver }),
  steel: M(0xaeb4b6, { metalness: 0.42, roughness: 0.42, envMap: ENV }),
  alu: M(0xc6cacc, { metalness: 0.62, roughness: 0.36, envMap: ENV }),
  copper: M(0xa45a30, { metalness: 0.7, roughness: 0.4, envMap: ENV }),
  enamel: M(0xede9d3),
  bread: M(0xd99f51),
  kebab: M(0x6e3a22),
  oil: M(0x3a2412, { roughness: 0.25 }),
  trim: M(0xc49a5c),
  maroon: M(0x74202c, { map: TEX.plaster }),
  maroonD: M(0x561821, { map: TEX.weathered }),
  creamWall: M(0xf0dc98, { map: TEX.plaster }),
  whiteWall: M(0xf1efe9, { map: TEX.plaster }),
  charcoal: M(0x323232, { map: TEX.weathered }),
  wallGrey: M(0xb9b4aa, { map: TEX.weathered }),
  soot: M(0x56473d, { map: TEX.brick }),
  coal: M(0x1d1916, { emissive: 0xff5a1c, emissiveIntensity: 0.2 }),
  terracotta: M(0xa8552f),
  fridge: M(0xc2161d, { roughness: 0.5 }),
  cooler: M(0xd8eaf0, { emissive: 0xe4f6ff, emissiveIntensity: 0.18, roughness: 0.25 }),
  downlight: M(0xfff6e2, { emissive: 0xfff1d6, emissiveIntensity: 0.6 }),
  tarp: M(0x25282a, { roughness: 0.85, side: THREE.DoubleSide }),
  stripe: M(0xffffff, { map: stripeTex }),
  jali: M(0xb8302a, { map: TEX.jaali, alphaTest: 0.5, side: THREE.DoubleSide }),
  brass: M(0xc59a45, { metalness: 0.75, roughness: 0.35, envMap: ENV }),
  pavilion: M(0xd8c9bd, { map: TEX.plaster }),
  peach: M(0xe9b392, { map: TEX.plaster }),
  peachD: M(0xd49a78, { map: TEX.weathered }),
  window: M(0x7f97a0, { metalness: 0.4, roughness: 0.12, transparent: true, opacity: 0.42, envMap: ENV, side: THREE.DoubleSide }),
};
ENVMATS.push(SHOP_MAT.steel, SHOP_MAT.alu, SHOP_MAT.copper, SHOP_MAT.brass);

/* ───────────── sign artwork ───────────── */
const FONT = {
  serif: 'Georgia,"Times New Roman",serif',
  sans: '"Segoe UI",Arial,sans-serif',
  block: '"Arial Black","Segoe UI Black",Impact,sans-serif',
  script: '"Segoe Script","Brush Script MT","Comic Sans MS",cursive',
  deva: '"Nirmala UI",Mangal,"Segoe UI",sans-serif',
  urdu: '"Urdu Typesetting","Segoe UI","Nirmala UI",sans-serif',
};
function fitText(x, text, cx, cy, maxW, size, weight, family, outline = 0) {
  x.font = `${weight} ${size}px ${family}`;
  const w = x.measureText(text).width;
  if (w > maxW) x.font = `${weight} ${size * maxW / w}px ${family}`;
  if (outline) { x.lineJoin = 'round'; x.lineWidth = outline; x.strokeText(text, cx, cy); }
  x.fillText(text, cx, cy);
}
function disc(x, cx, cy, r, fill) { x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }
/** a small round dish picture of the kind printed along Lucknow menu boards */
function foodBadge(x, cx, cy, r, k) {
  disc(x, cx, cy, r, '#f6f1e4');
  disc(x, cx, cy, r * 0.82, ['#b8642a', '#d9a03a', '#8f3a22', '#cfae63', '#6f3a1e', '#c4542b'][k % 6]);
  for (let i = 0; i < 5; i++) {
    const a = k * 1.7 + i * 1.26;
    disc(x, cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42, r * 0.2, ['#5a2a14', '#e9c77a', '#3c7d32', '#f2e0b0'][(i + k) % 4]);
  }
}
function wreath(x, cx, cy, r, color) {
  x.fillStyle = color;
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const a = Math.PI / 2 + side * (0.35 + i * 0.29);
    x.save(); x.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.rotate(a + side * 0.9);
    x.beginPath(); x.ellipse(0, 0, r * 0.2, r * 0.08, 0, 0, TAU); x.fill(); x.restore();
  }
}
function teaGlass(x, cx, cy, h, lit) {
  x.fillStyle = lit ? '#ffcf7a' : '#c98a3c';
  x.beginPath(); x.moveTo(cx - h * 0.32, cy - h * 0.4); x.lineTo(cx + h * 0.32, cy - h * 0.4); x.lineTo(cx + h * 0.24, cy + h * 0.45); x.lineTo(cx - h * 0.24, cy + h * 0.45); x.fill();
  x.fillStyle = lit ? '#fff3dc' : '#f4ead8'; x.fillRect(cx - h * 0.33, cy - h * 0.5, h * 0.66, h * 0.13);
}
function cupIcon(x, cx, cy, s, cup, steam) {
  x.fillStyle = cup;
  x.beginPath(); x.moveTo(cx - s * 0.5, cy - s * 0.15); x.lineTo(cx + s * 0.5, cy - s * 0.15); x.quadraticCurveTo(cx + s * 0.45, cy + s * 0.5, cx, cy + s * 0.5); x.quadraticCurveTo(cx - s * 0.45, cy + s * 0.5, cx - s * 0.5, cy - s * 0.15); x.fill();
  x.lineWidth = s * 0.09; x.strokeStyle = cup; x.beginPath(); x.arc(cx + s * 0.55, cy + s * 0.08, s * 0.16, -1.2, 1.2); x.stroke();
  x.strokeStyle = steam; x.lineWidth = s * 0.07;
  for (const o of [-0.22, 0, 0.22]) { x.beginPath(); x.moveTo(cx + o * s, cy - s * 0.25); x.bezierCurveTo(cx + (o + 0.14) * s, cy - s * 0.45, cx + (o - 0.14) * s, cy - s * 0.6, cx + o * s, cy - s * 0.82); x.stroke(); }
}
function starburst(x, cx, cy, r, fill) {
  x.fillStyle = fill; x.beginPath();
  for (let i = 0; i < 32; i++) { const a = i * TAU / 32, rr2 = i % 2 ? r * 0.62 : r; x.lineTo(cx + Math.cos(a) * rr2 * 1.5, cy + Math.sin(a) * rr2); }
  x.fill();
}

const SIGN_ART = {
  // The Clock Tower outlet: charcoal fascia, TK emblem panel, white name, branch list and a gold "Since 1905" wreath.
  tunday(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#2c2e30'; x.fillRect(0, 0, W, H); }
    const pw = H * 1.35, px = H * 0.12, py = H * 0.1, ph = H * 0.8, ex = px + pw / 2;
    x.fillStyle = lit ? '#d9d6cf' : '#f4f1ea'; x.fillRect(px, py, pw, ph);
    const tri = (ox, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(ex + ox, py + ph * 0.08); x.lineTo(ex + ox + ph * 0.3, py + ph * 0.56); x.lineTo(ex + ox - ph * 0.3, py + ph * 0.56); x.fill(); };
    tri(-ph * 0.1, lit ? '#ff6a5e' : '#c8202b'); tri(ph * 0.1, lit ? '#58d18a' : '#1f8a4c');
    x.fillStyle = '#ffffff';
    fitText(x, 'TK', ex, py + ph * 0.38, ph * 0.4, ph * 0.24, 'bold', FONT.serif);
    x.fillStyle = lit ? '#ff6a5e' : '#c8202b'; x.fillRect(px + pw * 0.06, py + ph * 0.62, pw * 0.88, ph * 0.18);
    x.fillStyle = '#ffffff';
    fitText(x, 'MELT IN MOUTH KABABS', ex, py + ph * 0.71, pw * 0.8, ph * 0.12, 'bold', FONT.sans);
    x.fillStyle = lit ? '#ff6a5e' : '#8a1d24';
    fitText(x, 'TUNDAY KABABI', ex, py + ph * 0.9, pw * 0.8, ph * 0.1, 'bold', FONT.serif);
    x.fillStyle = lit ? '#ffffff' : '#f2f2f2';
    fitText(x, 'TUNDAY KABABI', W * 0.5, H * 0.38, W * 0.54, H * 0.46, 'bold', FONT.sans);
    fitText(x, '®', W * 0.79, H * 0.2, H * 0.2, H * 0.14, 'bold', FONT.sans);
    fitText(x, 'AMINABAD - ALIGANJ - DELHI - DUBAI - DUBAGGA - LULU MALL', W * 0.525, H * 0.8, W * 0.54, H * 0.15, 'bold', FONT.sans);
    const gold = lit ? '#ffcf6a' : '#d4a64a';
    wreath(x, W * 0.895, H * 0.36, H * 0.25, gold);
    x.fillStyle = gold;
    fitText(x, 'SINCE', W * 0.895, H * 0.3, H * 0.3, H * 0.09, 'bold', FONT.sans);
    fitText(x, '1905', W * 0.895, H * 0.43, H * 0.32, H * 0.13, 'bold', FONT.serif);
    x.strokeStyle = lit ? '#ffffff' : '#ededed'; x.lineWidth = H * 0.025; x.strokeRect(W * 0.835, H * 0.7, W * 0.12, H * 0.2);
    x.fillStyle = lit ? '#ffffff' : '#ededed';
    fitText(x, 'TAKEAWAY', W * 0.895, H * 0.8, W * 0.11, H * 0.12, 'bold', FONT.sans);
  },
  // White lettering with round badges along the food court's brick parapet; transparent elsewhere.
  foodCourtWord(x, W, H, lit) {
    const ink = lit ? '#fff8e8' : '#f7f4ee';
    for (const cx of [H * 0.5, W - H * 0.5]) {
      disc(x, cx, H / 2, H * 0.42, ink); disc(x, cx, H / 2, H * 0.33, lit ? '#2f6f78' : '#2c6a72');
      x.fillStyle = ink; fitText(x, 'H', cx, H * 0.52, H * 0.4, H * 0.36, 'bold', FONT.serif);
    }
    x.fillStyle = ink;
    fitText(x, 'HUSAINABAD FOOD COURT', W / 2, H * 0.54, W - H * 2.4, H * 0.62, 'bold', FONT.sans);
  },
  // The entrance standee listing the outlets inside.
  outlets(x, W, H, lit) {
    x.fillStyle = lit ? '#cfcfcf' : '#f8f8f6'; x.fillRect(0, 0, W, H);
    const cells = [['Rumi Cafe', '#9c2a2a', 'THE HERITAGE TERRACE'], ['KABEER’S', '#1d1d1d', 'PET POOJA'], ['TUNDAY KABABI', '#1f6b3a', 'SINCE 1905'],
      ['EFC', '#c3161c', 'ESSELATE FRIED CHICKEN'], ['HOCCO', '#2a3d9a', 'ICE CREAM'], ['Pista House', '#3d5a2a', 'A LEGACY OF 25 YEARS']];
    cells.forEach(([name, col, sub], i) => {
      const cx = W * (i % 2 ? 0.75 : 0.25), cy = H * (0.18 + Math.floor(i / 2) * 0.31);
      x.strokeStyle = '#d6d2c8'; x.lineWidth = H * 0.006; x.strokeRect(cx - W * 0.23, cy - H * 0.13, W * 0.46, H * 0.27);
      x.fillStyle = col; fitText(x, name, cx, cy, W * 0.42, H * 0.07, 'bold', /Rumi|Pista/.test(name) ? FONT.serif : FONT.sans);
      x.fillStyle = '#555555'; fitText(x, sub, cx, cy + H * 0.07, W * 0.42, H * 0.032, 'bold', FONT.sans);
    });
  },
  // Purple banner of the Lucknow Museum of Heritage and Arts.
  museumBanner(x, W, H, lit) {
    x.fillStyle = lit ? '#4a1f63' : '#5b2a7a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffffff';
    fitText(x, 'LUCKNOW MUSEUM OF HERITAGE AND ARTS', W / 2, H * 0.52, W * 0.9, H * 0.5, 'bold', FONT.sans);
  },
  // Black fascia, white globe badge with "Open 24x7", lit warm-white letters and a script line.
  globe(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#111111'; x.fillRect(0, 0, W, H); }
    const white = lit ? '#eef4ff' : '#f2f2f2', bx = W * 0.085;
    x.strokeStyle = white; x.lineWidth = H * 0.025;
    x.beginPath(); x.arc(bx, H * 0.32, H * 0.17, 0, TAU); x.stroke();
    x.beginPath(); x.ellipse(bx, H * 0.32, H * 0.07, H * 0.17, 0, 0, TAU); x.stroke();
    for (const k of [-0.07, 0.07]) { x.beginPath(); x.moveTo(bx - H * 0.16, H * (0.32 + k)); x.lineTo(bx + H * 0.16, H * (0.32 + k)); x.stroke(); }
    x.fillStyle = white;
    fitText(x, 'GLOBE', bx, H * 0.62, W * 0.12, H * 0.13, 'bold', FONT.sans);
    fitText(x, 'OPEN-24x7', bx, H * 0.82, W * 0.14, H * 0.13, 'bold', FONT.sans);
    x.fillStyle = lit ? '#fff1c9' : '#f7ebcd';
    if (!lit) { x.shadowColor = 'rgba(255,214,140,.7)'; x.shadowBlur = H * 0.06; }
    fitText(x, 'GLOBE CAFE', W * 0.57, H * 0.4, W * 0.7, H * 0.52, 'bold', FONT.sans);
    x.shadowBlur = 0;
    x.fillStyle = white;
    fitText(x, 'chai ke maze ab nawabi', W * 0.6, H * 0.82, W * 0.5, H * 0.19, 'bold', FONT.script);
  },
  // The maroon strip of round dish pictures below Globe's fascia.
  globeMenu(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#3a1430'; x.fillRect(0, 0, W, H); }
    const n = Math.max(5, Math.round(W / H * 0.8));
    for (let i = 0; i < n; i++) foodBadge(x, W * (i + 0.5) / n, H / 2, H * 0.4, i);
  },
  // Black backlit board with yellow "IRANI CHAI" and a glass of tea either side.
  iraniChai(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#141414'; x.fillRect(0, 0, W, H); }
    teaGlass(x, W * 0.12, H * 0.42, H * 0.56, lit); teaGlass(x, W * 0.88, H * 0.42, H * 0.56, lit);
    x.fillStyle = lit ? '#e9f0ff' : '#f0f0f0';
    fitText(x, 'AAPKI PURANI IRANI CHAI', W * 0.5, H * 0.24, W * 0.56, H * 0.14, 'bold', FONT.sans);
    x.fillStyle = lit ? '#ffd94a' : '#f7c51e';
    fitText(x, 'IRANI CHAI', W * 0.5, H * 0.64, W * 0.62, H * 0.44, '900', FONT.block);
  },
  sulemani(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#121212'; x.fillRect(0, 0, W, H); }
    for (const cx of [H * 0.6, W - H * 0.6]) { x.fillStyle = lit ? '#ffe2a2' : '#d8b26a'; x.fillRect(cx - H * 0.45, H * 0.12, H * 0.9, H * 0.76); teaGlass(x, cx, H * 0.52, H * 0.6, lit); }
    x.fillStyle = lit ? '#ffffff' : '#f4f4f4';
    fitText(x, 'SULEMANI CHAI', W / 2, H * 0.54, W * 0.7, H * 0.7, 'bold', FONT.sans);
  },
  // Red, white-edged letters on black flex with the white "I.D.T" starburst.
  iraniDum(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#121212'; x.fillRect(0, 0, W, H); }
    x.fillStyle = lit ? '#f4f4f4' : '#e8e8e8';
    fitText(x, 'HUSAINABAD · CHOTA IMAMBARA', W * 0.5, H * 0.1, W * 0.6, H * 0.1, 'bold', FONT.sans);
    cupIcon(x, W * 0.1, H * 0.34, H * 0.3, lit ? '#ffffff' : '#f2f2f2', lit ? '#ffd27a' : '#c9b48a');
    starburst(x, W * 0.5, H * 0.32, H * 0.14, lit ? '#ffffff' : '#f6f6f6');
    x.fillStyle = '#c4161c';
    fitText(x, 'I.D.T', W * 0.5, H * 0.33, H * 0.36, H * 0.13, 'bold', FONT.sans);
    x.fillStyle = lit ? '#ff3a36' : '#d0141b'; x.strokeStyle = '#ffffff';
    fitText(x, 'IRANI DUM TEA', W * 0.5, H * 0.72, W * 0.92, H * 0.4, '900', FONT.block, H * 0.045);
  },
  // Same wall row: dish pictures along the top and red "IRANI FAST FOOD".
  iraniFast(x, W, H, lit) {
    if (!lit) { x.fillStyle = '#111111'; x.fillRect(0, 0, W, H); }
    for (let i = 0; i < 9; i++) foodBadge(x, W * (0.08 + i * 0.105), H * 0.19, H * 0.13, i + 2);
    x.fillStyle = lit ? '#ff3a36' : '#d0141b'; x.strokeStyle = '#ffffff';
    fitText(x, 'IRANI FAST FOOD', W * 0.5, H * 0.58, W * 0.9, H * 0.34, '900', FONT.block, H * 0.035);
    x.fillStyle = lit ? '#ffffff' : '#ededed';
    fitText(x, 'शादी व पार्टियों के लिए बुकिंग की जाती है', W * 0.5, H * 0.87, W * 0.8, H * 0.11, 'bold', FONT.deva);
  },
  // Charcoal fascia with cream-gold serif lettering and a steaming cup.
  turkish(x, W, H, lit) {
    if (!lit) {
      x.fillStyle = '#353430'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#8f7a4c'; x.lineWidth = H * 0.025; x.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H * 0.88);
    }
    const gold = lit ? '#ffe2a0' : '#e3c78a';
    cupIcon(x, W * 0.13, H * 0.58, H * 0.42, gold, gold);
    x.fillStyle = gold;
    fitText(x, 'Türkish Cafe', W * 0.57, H * 0.52, W * 0.66, H * 0.56, 'bold', FONT.serif);
    fitText(x, 'TEA · COFFEE · SNACKS', W * 0.57, H * 0.86, W * 0.4, H * 0.11, 'bold', FONT.sans);
  },
  // The printed banner on Turkish Cafe's counter cart.
  turkishCart(x, W, H, lit) {
    if (lit) return;
    x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#7d1e3a';
    fitText(x, 'Turkish Cafe', W / 2, H * 0.24, W * 0.86, H * 0.32, 'bold', FONT.script);
    for (const cx of [W * 0.3, W * 0.7]) { disc(x, cx, H * 0.68, H * 0.24, '#ffffff'); disc(x, cx, H * 0.68, H * 0.19, cx < W / 2 ? '#7a4a2a' : '#c98c4a'); disc(x, cx, H * 0.66, H * 0.08, '#efe0c4'); }
  },
  // White backlit fascia with the orange K roundel and a strip of kebabs.
  kebabchi(x, W, H, lit) {
    x.fillStyle = lit ? '#d9d6cf' : '#f7f4ee'; x.fillRect(0, 0, W, H);
    disc(x, W * 0.08, H * 0.5, H * 0.34, '#e5732a');
    disc(x, W * 0.08, H * 0.5, H * 0.27, '#f7f4ee');
    x.fillStyle = '#e5732a';
    fitText(x, 'K', W * 0.08, H * 0.52, H * 0.4, H * 0.4, '900', FONT.sans);
    x.fillStyle = '#cf5a1b';
    fitText(x, 'KEBABCHI', W * 0.4, H * 0.45, W * 0.5, H * 0.56, 'bold', FONT.sans);
    x.fillStyle = '#6a3a22';
    fitText(x, 'LUCKNOW · THE TASTE OF NAWABS', W * 0.4, H * 0.84, W * 0.46, H * 0.12, 'bold', FONT.sans);
    x.fillStyle = '#3b2216'; x.fillRect(W * 0.71, H * 0.1, W * 0.27, H * 0.8);
    for (let i = 0; i < 6; i++) {
      const cx = W * (0.74 + i * 0.043);
      x.fillStyle = '#c9c9c9'; x.fillRect(cx - 1, H * 0.14, 2, H * 0.72);
      for (let j = 0; j < 4; j++) { x.fillStyle = j % 2 ? '#b0562a' : '#8a3d1c'; x.beginPath(); x.ellipse(cx, H * (0.25 + j * 0.16), W * 0.012, H * 0.07, 0, 0, TAU); x.fill(); }
    }
  },
  // Plain painted board for the two storefronts without a reference photo.
  plain(x, W, H, lit, record) {
    const [bg, fg] = record.sign;
    if (!lit) { x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = fg; x.lineWidth = H * 0.04; x.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H * 0.88); }
    x.fillStyle = fg;
    fitText(x, record.name.en, W / 2, H * 0.4, W * 0.88, H * 0.42, 'bold', FONT.sans);
    fitText(x, record.name.hi, W / 2, H * 0.78, W * 0.8, H * 0.24, 'bold', FONT.deva);
  },
};

/** A sign material carrying its own artwork; the glow map lights only the lettering at night. */
function signMaterial(art, w, h, record = {}, transparent = false) {
  const W = Math.min(1536, Math.round(w * 190)), H = Math.max(32, Math.round(W * h / w));
  const draw = SIGN_ART[art];
  const day = canvasTex(W, H, (c) => { c.textAlign = 'center'; c.textBaseline = 'middle'; draw(c, W, H, false, record); }, 0);
  const glow = canvasTex(W, H, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.textBaseline = 'middle'; draw(c, W, H, true, record); }, 0);
  for (const t of [day, glow]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({
    map: day, emissiveMap: glow, emissive: 0xffffff, emissiveIntensity: 0.06, roughness: 0.6,
    ...(transparent ? { transparent: true, alphaTest: 0.3, side: THREE.DoubleSide } : {}),
  });
}

/** A shop's board; its glow follows the shop's opening hours. */
function artPanel(shop, parent, art, w, h, x, y, z, tilt = 0) {
  const material = signMaterial(art, w, h, shop.record);
  shop.boards.push(material);
  const g = grp(parent, x, z, 0, y);
  g.rotation.x = tilt;
  B(g, MAT.iron, w + 0.06, h + 0.06, 0.07, 0, -0.03, -0.04, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(0, h / 2, 0.002);
  g.add(m);
  return { x, y: y + h / 2 * Math.cos(tilt), z: z + h / 2 * Math.sin(tilt), top: y + h * Math.cos(tilt) };
}

/** A board that lights up after dark, for buildings without a shop schedule. */
function litBoard(parent, art, w, h, x, y, z, { transparent = false, glow = 0.85, rotY = 0 } = {}) {
  const material = signMaterial(art, w, h, {}, transparent);
  NIGHTFX.push(() => { material.emissiveIntensity = 0.05 + TIME.lamps * glow; });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

/* ───────────── shared parts ───────────── */
function shopAwning(parent, width, depth, y, z, material, striped = false) {
  const awning = grp(parent, 0, z, 0, y);
  awning.rotation.x = 0.18;
  B(awning, material, width, 0.075, depth, 0, 0, 0, true);
  B(awning, material, width, 0.22, 0.08, 0, -0.15, depth / 2, true);
  if (striped) for (let i = -3; i <= 3; i++) {
    B(awning, SHOP_MAT.trim, width * 0.053, 0.012, depth, i * width / 7, 0.076, 0, true);
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
}
/** clay cups stacked in a small pyramid */
function kulhads(parent, x, y, z, rows = 3) {
  for (let r = 0; r < rows; r++) for (let i = 0; i <= rows - 1 - r; i++) {
    C(parent, SHOP_MAT.terracotta, 0.045, 0.034, 0.08, x + (i - (rows - 1 - r) / 2) * 0.1, y + r * 0.08, z, 7, false, true);
  }
}
/** the bell-shaped aluminium pot used for dum tea, with its domed lid and loop handle */
function dumPot(parent, x, y, z) {
  C(parent, SHOP_MAT.alu, 0.19, 0.34, 0.44, x, y, z, 16, false, true);
  S(parent, SHOP_MAT.alu, 0.19, x, y + 0.44, z, 0.45);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 12, Math.PI), SHOP_MAT.alu);
  loop.position.set(x, y + 0.52, z); loop.castShadow = true; parent.add(loop);
  for (const s of [-1, 1]) B(parent, SHOP_MAT.alu, 0.1, 0.025, 0.03, x + s * 0.3, y + 0.26, z, true);
}
/** an open frontage: floor slab, piers, recess and a solid block behind and above */
function frontShell(parent, shop, { recess, groundH, top, pier, upper, back = SHOP_MAT.plaster, inner }) {
  const { width: w, depth: d } = shop.record;
  // Each shop's interior brightens with its own tube lights while it serves.
  inner = inner.clone();
  inner.emissive.set(0x8f8573);
  inner.emissiveMap = inner.map;
  shop.glow.push(inner);
  P(parent, SHOP_MAT.tile, w, 0.16, recess + 0.35, 0, 0, (0.35 - recess) / 2);
  B(parent, back, w, groundH, d - recess, 0, 0, -(d + recess) / 2);
  for (const s of [-1, 1]) B(parent, pier, 0.36, groundH, recess, s * (w / 2 - 0.18), 0, -recess / 2);
  B(parent, upper, w, top - groundH, d, 0, groundH, -d / 2);
  rectDecal(parent, inner, w - 0.72, groundH - 0.16, 0, 0.16, -recess - 0.08);
  B(parent, inner, w - 0.72, 0.05, recess, 0, groundH - 0.05, -recess / 2, true);
}
/** rows of windows on the storeys above a shop */
function upperWindows(parent, w, y0, floors, n, { frame = MAT.whiteD, balcony = null, rail = MAT.iron } = {}) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * 3.25 + 0.75;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (w / n);
      rectDecal(parent, MAT.recess, w / n * 0.5, 1.5, x, y, 0.01);
      B(parent, frame, w / n * 0.62, 0.1, 0.16, x, y - 0.1, 0.05, true);
      B(parent, frame, w / n * 0.66, 0.08, 0.42, x, y + 1.58, 0.18, true);
    }
    if (balcony) {
      B(parent, balcony, w - 0.5, 0.14, 0.85, 0, y - 0.62, 0.42, true);
      B(parent, rail, w - 0.5, 0.05, 0.05, 0, y + 0.3, 0.83, true);
      for (let i = 0; i <= 12; i++) B(parent, rail, 0.03, 0.8, 0.03, -(w - 0.5) / 2 + i * (w - 0.5) / 12, y - 0.48, 0.83, true);
    }
  }
}

/* ───────────── storefronts ───────────── */
// Tunday Kababi's Clock Tower outlet: a single-storey dining pavilion with a
// full-width glass front, brushed-steel panels below and a long charcoal fascia,
// beside one of the peach heritage-style pavilions of the Talab square.
function buildTunday(parent, shop) {
  const { width: w, depth: d } = shop.record, h = 3.45;
  const glassW = w - 2.2, gx = -w / 2 + glassW / 2, doorX = w / 2 - 1.1;
  const wall = SHOP_MAT.pavilion;
  P(parent, SHOP_MAT.tile, w, 0.16, d, 0, 0, -d / 2);
  B(parent, wall, w, h, 0.25, 0, 0, -d + 0.125);
  for (const s of [-1, 1]) B(parent, wall, 0.25, h, d, s * (w / 2 - 0.125), 0, -d / 2);
  B(parent, wall, w + 0.5, 0.2, d + 0.45, 0, h, -d / 2 + 0.12, true);
  B(parent, MAT.whiteD, w + 0.52, 0.1, 0.1, 0, h + 0.05, 0.36, true);
  B(parent, MAT.tin, 1.1, 0.75, 0.85, -w / 2 + 1.4, h + 0.2, -d + 1.2, true);
  // Warm dining room behind the glass: back wall, ceiling, steel tables.
  const inner = SHOP_MAT.whiteWall.clone();
  inner.emissive.set(0x8f8573); inner.emissiveMap = inner.map;
  shop.glow.push(inner);
  rectDecal(parent, inner, w - 0.6, h - 0.3, 0, 0.16, -d + 0.16);
  B(parent, inner, w - 0.5, 0.05, d - 0.3, 0, h - 0.07, -d / 2, true);
  for (let i = 0; i < 3; i++) for (const z of [-1.8, -3.6]) {
    const tx = gx - glassW / 2 + 1.2 + i * (glassW - 2.4) / 2;
    B(parent, SHOP_MAT.steel, 1.2, 0.05, 0.75, tx, 0.9, z, true);
    for (const s of [-1, 1]) B(parent, MAT.wood, 1.1, 0.06, 0.32, tx, 0.6, z + s * 0.6, true);
  }
  // Glass front with steel mullions, kick panels and an outside rail.
  B(parent, SHOP_MAT.steel, glassW, 0.85, 0.07, gx, 0.16, -0.04, true);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(glassW, 1.45), SHOP_MAT.window);
  pane.position.set(gx, 1.74, 0); parent.add(pane);
  for (let i = 0; i <= 4; i++) B(parent, SHOP_MAT.steel, 0.07, 2.32, 0.09, gx - glassW / 2 + i * glassW / 4, 0.16, 0, true);
  B(parent, SHOP_MAT.steel, glassW, 0.07, 0.09, gx, 2.46, 0, true);
  B(parent, SHOP_MAT.steel, glassW, 0.045, 0.045, gx, 0.72, 0.2, true);
  for (let i = 0; i <= 4; i++) B(parent, SHOP_MAT.steel, 0.04, 0.56, 0.04, gx - glassW / 2 + i * glassW / 4, 0.16, 0.2, true);
  const sign = artPanel(shop, parent, 'tunday', glassW, 0.98, gx, 2.48, 0.06);
  // Takeaway door at the east end, under a vent grille, with the counter just inside.
  rectDecal(parent, MAT.recess, 1.5, 2.3, doorX, 0.16, -0.07);
  B(parent, MAT.iron, 1.8, 0.85, 0.06, doorX, 2.5, 0.02, true);
  for (let i = 0; i < 6; i++) B(parent, SHOP_MAT.steel, 1.7, 0.03, 0.03, doorX, 2.56 + i * 0.13, 0.06, true);
  B(parent, SHOP_MAT.steel, 1.5, 0.95, 0.55, doorX, 0.16, -1.7);
  B(parent, MAT.woodL, 1.6, 0.05, 0.62, doorX, 1.11, -1.7, true);
  // The peach heritage pavilion that adjoins it, with pilasters and a cornice.
  const ax = w / 2 + 1.65;
  B(parent, SHOP_MAT.peach, 3.3, 4.5, d + 0.3, ax, 0, -d / 2);
  B(parent, SHOP_MAT.peachD, 3.8, 0.28, d + 0.8, ax, 4.5, -d / 2, true);
  merlons(parent, SHOP_MAT.peach, ax - 1.6, ax + 1.6, 4.78, 0.0, 4, 0.42, 0.45, 0.3);
  for (const s of [-1, 1]) B(parent, SHOP_MAT.peachD, 0.32, 4.3, 0.14, ax + s * 1.38, 0, 0.2, true);
  rectDecal(parent, MAT.door, 1.05, 2.2, ax, 0.05, 0.12);
  counterCover(shop, 1.55, 2.25, doorX, 2.4, 0.12);
  counterLight(shop, parent, doorX, 2.4, 0.42, 0.16, 1.7);
  shopService(shop, {
    staff: [doorX, -2.3], entry: [doorX + 2.8, 3.6], counter: [doorX, 0.95], exit: [doorX - 3.2, 3.8], floor: 0.16,
  });
  return sign;
}

function buildGlobe(parent, shop) {
  const { width: w } = shop.record, groundH = 3.1, recess = 3.0;
  frontShell(parent, shop, { recess, groundH, top: 7.6, pier: SHOP_MAT.charcoal, upper: SHOP_MAT.plaster, inner: SHOP_MAT.whiteWall });
  upperWindows(parent, w, groundH + 0.6, 1, 3);
  B(parent, MAT.whiteD, w + 0.2, 0.25, 0.28, 0, 7.4, 0.06, true);
  const sign = artPanel(shop, parent, 'globe', w - 0.2, 1.2, 0, groundH + 0.12, 0.18);
  artPanel(shop, parent, 'globeMenu', w - 0.5, 0.42, 0, groundH - 0.46, 0.12);
  for (const x of [-1.6, 0, 1.6]) C(parent, SHOP_MAT.downlight, 0.09, 0.09, 0.02, x, groundH - 0.08, -1.4, 10, false, true);

  // Drinks fridge and glass coolers on the left, the tea counter on the right.
  B(parent, SHOP_MAT.fridge, 0.78, 1.95, 0.62, -2.25, 0.16, -2.55);
  rectDecal(parent, SHOP_MAT.cooler, 0.6, 1.5, -2.25, 0.42, -2.24);
  B(parent, SHOP_MAT.whiteWall, 0.74, 1.85, 0.6, -1.4, 0.16, -2.55);
  rectDecal(parent, SHOP_MAT.cooler, 0.6, 1.5, -1.4, 0.4, -2.25);
  B(parent, SHOP_MAT.steel, 2.6, 0.92, 0.62, 1.25, 0.16, -0.75);
  B(parent, MAT.woodL, 2.7, 0.06, 0.7, 1.25, 1.08, -0.75, true);
  teaVessel(parent, 0.55, 1.14, -0.8, SHOP_MAT.steel);
  teaVessel(parent, 1.2, 1.14, -0.8, SHOP_MAT.alu);
  for (let i = 0; i < 4; i++) C(parent, SHOP_MAT.enamel, 0.04, 0.03, 0.09, 1.75 + i * 0.12, 1.14, -0.62, 8, false, true);
  rectDecal(parent, MAT.black, 1.9, 0.75, 1.25, 1.9, -recess - 0.06);
  B(parent, MAT.stone, w, 0.16, 0.36, 0, 0, 0.18);
  counterCover(shop, w - 0.72, groundH - 0.16, 0, groundH, 0.04);
  counterLight(shop, parent, 1.25, groundH - 0.12, -0.75, 1.08, 2.4);
  shopService(shop, {
    staff: [1.25, -1.45], entry: [-2.6, 2.3], counter: [1.2, 0.55], exit: [-0.4, 2.4], floor: 0.16,
  });
  return sign;
}

function buildTurkish(parent, shop) {
  const { width: w } = shop.record, groundH = 3.0, recess = 2.4;
  frontShell(parent, shop, { recess, groundH, top: 6.7, pier: SHOP_MAT.charcoal, upper: MAT.cream, inner: SHOP_MAT.creamWall });
  upperWindows(parent, w, groundH + 0.5, 1, 2);
  const sign = artPanel(shop, parent, 'turkish', w - 0.1, 1.0, 0, groundH + 0.08, 0.16);
  B(parent, SHOP_MAT.steel, 2.2, 0.95, 0.55, 0.4, 0.16, -1.75);
  B(parent, SHOP_MAT.steel, 0.5, 0.45, 0.4, 0.9, 1.11, -1.8, true);
  rectDecal(parent, MAT.black, 1.6, 0.6, 0.2, 1.8, -recess - 0.06);

  // The printed counter cart on the pavement, under a big four-colour umbrella, beside a red jali screen.
  const cx = -0.65, cz = 1.4;
  B(parent, MAT.woodL, 1.55, 0.95, 0.72, cx, 0.16, cz);
  B(parent, SHOP_MAT.steel, 1.62, 0.05, 0.78, cx, 1.11, cz, true);
  artPanel(shop, parent, 'turkishCart', 1.5, 0.72, cx, 0.24, cz + 0.37);
  teaVessel(parent, cx - 0.35, 1.16, cz - 0.1, SHOP_MAT.alu);
  for (let i = 0; i < 3; i++) C(parent, SHOP_MAT.enamel, 0.04, 0.03, 0.09, cx + 0.2 + i * 0.13, 1.16, cz + 0.1, 8, false, true);
  C(parent, MAT.iron, 0.03, 0.03, 2.35, cx + 0.95, 0.16, cz, 6, false, true);
  const canopy = [0x2f8f4e, 0xf0c419, 0x2a6fb5, 0xd23a2a].map(c => M(c, { side: THREE.DoubleSide, roughness: 0.8 }));
  for (let i = 0; i < 8; i++) {
    const segment = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.5, 3, 1, true, i * TAU / 8, TAU / 8), canopy[i % 4]);
    segment.position.set(cx + 0.95, 2.72, cz); segment.castShadow = true; parent.add(segment);
  }
  const jali = grp(parent, 1.55, 1.05, -0.35, 0.16);
  for (const s of [-1, 1]) B(jali, SHOP_MAT.maroonD, 0.06, 1.7, 0.06, s * 0.55, 0, 0, true);
  B(jali, SHOP_MAT.maroonD, 1.16, 0.06, 0.06, 0, 1.7, 0, true);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.6), SHOP_MAT.jali);
  screen.position.set(0, 0.86, 0); jali.add(screen);
  addCol(jali, 0, 0, 0.58, 0.06, 0, 1.76);
  counterCover(shop, w - 0.72, groundH - 0.16, 0, groundH, 0.04);
  counterLight(shop, parent, cx, 2.25, cz, 1.11, 1.4);
  shopService(shop, {
    staff: [cx, 0.62], entry: [-2.4, 3.8], counter: [cx, 2.8], exit: [1.8, 3.8],
    steam: [cx - 0.35, 1.62, cz - 0.1], floor: 0.16,
  });
  return sign;
}

function buildKebabchi(parent, shop) {
  const { width: w, depth: d } = shop.record, groundH = 3.3;
  B(parent, MAT.stone, w, 0.16, 0.5, 0, 0, 0.25);
  B(parent, SHOP_MAT.whiteWall, w, groundH, d, 0, 0, -d / 2);
  B(parent, MAT.whiteW, w, 6.6, d, 0, groundH, -d / 2);
  upperWindows(parent, w, 3.9, 2, 3, { frame: MAT.whiteD });
  B(parent, MAT.whiteD, w + 0.2, 0.3, 0.3, 0, 9.6, 0.05, true);
  // Dark-framed glass front with Mughal arches onto the chandelier-lit room.
  B(parent, SHOP_MAT.maroonD, w - 0.1, groundH - 0.3, 0.12, 0, 0.16, 0.06, true);
  for (const x of [-2.3, 0, 2.3]) {
    decal(parent, 1.55, 2.25, x, 0.3, 0.12, { cusps: 5, trim: SHOP_MAT.brass, mat: MAT.recessLit });
  }
  const sign = artPanel(shop, parent, 'kebabchi', w - 0.2, 1.15, 0, groundH + 0.02, 0.16);

  // A seekh grill at the pavement edge.
  const gx = 2.45, gz = 0.98;
  B(parent, SHOP_MAT.steel, 1.4, 0.92, 0.55, gx, 0, gz);
  B(parent, SHOP_MAT.coal, 1.3, 0.05, 0.45, gx, 0.92, gz, true);
  for (let i = 0; i < 7; i++) {
    B(parent, MAT.iron, 0.012, 0.012, 0.62, gx - 0.54 + i * 0.18, 1.0, gz, true);
    C(parent, SHOP_MAT.kebab, 0.024, 0.024, 0.32, gx - 0.54 + i * 0.18, 1.0, gz - 0.16, 6, false, true).rotation.x = Math.PI / 2;
  }
  counterCover(shop, w - 0.4, groundH - 0.4, 0, groundH - 0.1, 0.42);
  counterLight(shop, parent, gx, 2.1, gz, 0.95, 1.5);
  shop.glow.push(SHOP_MAT.coal);
  shopService(shop, {
    staff: [gx, 0.32], entry: [-1.4, 3.6], counter: [gx, 2.35], exit: [3.9, 3.4],
    steam: [gx, 1.2, gz],
  });
  return sign;
}

/** the common shell of a Chota Imambara wall bay */
function wallBay(parent, roof) {
  const w = CHOTA_SHOP_ROW.step;
  B(parent, SHOP_MAT.plaster, w, 3.3, 1.34, 0, 0, -2.53);
  B(parent, SHOP_MAT.plaster, w, 1.02, 1.86, 0, 2.28, -0.93);
  for (const x of [-1.94, 1.94]) B(parent, SHOP_MAT.plaster, 0.28, 2.28, 1.86, x, 0, -0.93);
  flatRect(parent, SHOP_MAT.tile, w - 0.56, 1.86, 0, -0.93, 0.026);
  rectDecal(parent, SHOP_MAT.wallGrey, w - 0.56, 2.2, 0, 0.03, -1.94);
  if (roof === 'tin') {
    const tin = grp(parent, 0, 0.55, 0, 2.42); tin.rotation.x = 0.2;
    B(tin, MAT.shutter, w + 0.1, 0.05, 1.25, 0, 0, 0, true);
  }
}

function buildIraniChai(parent, shop) {
  wallBay(parent, 'tin');
  const sign = artPanel(shop, parent, 'iraniChai', 3.95, 1.0, 0, 2.66, 0.14);
  artPanel(shop, parent, 'sulemani', 3.6, 0.36, 0, 2.02, 0.2);
  B(parent, SHOP_MAT.fridge, 0.66, 1.78, 0.6, -1.4, 0, -1.25);
  rectDecal(parent, SHOP_MAT.cooler, 0.5, 1.35, -1.4, 0.3, -0.98);
  B(parent, MAT.iron, 0.75, 0.62, 0.55, 0.65, 0, -1.3, true);
  C(parent, SHOP_MAT.alu, 0.34, 0.31, 0.42, 0.65, 0.62, -1.3, 16, false, true);
  C(parent, SHOP_MAT.alu, 0.35, 0.35, 0.03, 0.65, 1.04, -1.3, 16, false, true);
  B(parent, MAT.wood, 0.9, 0.05, 0.35, 1.25, 1.35, -1.72, true);
  kulhads(parent, 1.25, 1.4, -1.72, 4);
  B(parent, SHOP_MAT.steel, 3.2, 0.95, 0.55, 0, 0, 0.09);
  B(parent, SHOP_MAT.steel, 1.0, 0.03, 0.42, -0.6, 0.95, 0.1, true);
  for (let i = 0; i < 6; i++) C(parent, SHOP_MAT.enamel, 0.04, 0.03, 0.085, -0.95 + (i % 3) * 0.16, 0.98, 0.0 + Math.floor(i / 3) * 0.17, 8, false, true);
  kulhads(parent, 0.9, 0.95, 0.12, 3);
  counterCover(shop, 3.37, 0.98, 0, 2.0, 0.47);
  counterLight(shop, parent, -0.13, 2.16, 0.02, 0.98, 3.18);
  shopService(shop, {
    staff: [-0.2, -0.62], entry: [-1.2, 3.25], counter: [0.71, 1.45], exit: [1.45, 3.5],
    steam: [0.65, 1.45, -1.3],
  });
  return sign;
}

function buildIraniDum(parent, shop) {
  wallBay(parent, null);
  const sign = artPanel(shop, parent, 'iraniDum', 3.95, 1.05, 0, 2.66, 0.14);
  // A sagging black tarpaulin tied off with rope instead of a tin awning.
  const tarp = grp(parent, 0, 0.62, 0, 2.5); tarp.rotation.x = 0.32;
  B(tarp, SHOP_MAT.tarp, 4.1, 0.03, 1.35, 0, 0, 0, true);
  const drape = grp(parent, 0, 1.25, 0, 2.08); drape.rotation.x = -0.25;
  B(drape, SHOP_MAT.tarp, 4.1, 0.24, 0.03, 0, 0, 0, true);
  for (const x of [-1.7, 1.7]) { const rope = C(parent, MAT.woodL, 0.008, 0.008, 0.6, x, 2.05, 1.32, 4, false, true); rope.rotation.z = 0.1; }
  // Soot-darkened brick hearth with the two dum pots.
  B(parent, SHOP_MAT.soot, 2.1, 0.72, 0.9, -0.6, 0, -0.55);
  for (const x of [-1.15, -0.1]) {
    B(parent, MAT.iron, 0.5, 0.06, 0.5, x, 0.72, -0.55, true);
    dumPot(parent, x, 0.78, -0.55);
  }
  B(parent, MAT.woodL, 1.15, 0.9, 0.55, 1.35, 0, 0.0);
  kulhads(parent, 1.2, 0.9, -0.05, 4);
  kulhads(parent, 1.62, 0.9, 0.05, 3);
  B(parent, MAT.wood, 1.4, 0.08, 0.38, -1.3, 0.42, 2.4, true);
  for (const x of [-1.9, -0.7]) B(parent, MAT.wood, 0.08, 0.42, 0.32, x, 0, 2.4, true);
  counterCover(shop, 3.37, 1.24, 0, 2.28, 0.47);
  counterLight(shop, parent, -0.13, 2.12, -0.2, 0.9, 3.0);
  shopService(shop, {
    staff: [-0.6, -1.45], entry: [0.3, 3.6], counter: [0.95, 1.2], exit: [1.9, 3.6],
    steam: [-0.6, 1.5, -0.55],
  });
  return sign;
}

function buildIraniFast(parent, shop) {
  wallBay(parent, 'tin');
  const sign = artPanel(shop, parent, 'iraniFast', 3.95, 1.05, 0, 2.66, 0.14);
  B(parent, SHOP_MAT.steel, 3.2, 0.95, 0.6, 0, 0, 0.08);
  B(parent, MAT.iron, 1.3, 0.05, 0.5, -0.75, 0.95, 0.08, true);
  for (let i = 0; i < 5; i++) C(parent, SHOP_MAT.bread, 0.11, 0.11, 0.015, -1.2 + i * 0.22, 1.0, 0.08, 10, false, true);
  B(parent, SHOP_MAT.cooler, 1.1, 0.45, 0.45, 0.8, 0.95, 0.06, true);
  for (let i = 0; i < 4; i++) C(parent, SHOP_MAT.kebab, 0.05, 0.05, 0.3, 0.45 + i * 0.22, 1.05, 0.06, 6, false, true).rotation.z = Math.PI / 2;
  B(parent, MAT.wood, 2.4, 0.05, 0.3, 0, 1.4, -1.75, true);
  for (let i = 0; i < 5; i++) C(parent, SHOP_MAT.steel, 0.12, 0.1, 0.18, -0.9 + i * 0.45, 1.45, -1.75, 9, false, true);
  counterCover(shop, 3.37, 1.24, 0, 2.28, 0.47);
  counterLight(shop, parent, 0, 2.16, 0.02, 0.98, 3.18);
  shopService(shop, {
    staff: [0.3, -0.7], entry: [-1.3, 3.3], counter: [-0.4, 1.4], exit: [1.5, 3.6],
    steam: [-0.75, 1.3, 0.08],
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
  shopAwning(parent, 3.84, 1.21, 2.31, 1.58, bread ? MAT.cream : SHOP_MAT.red, true);
  const sign = artPanel(shop, parent, 'plain', 3.62, 0.9, 0, 2.44, 1.23);
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
  const { kind, width, kerb = 0.169 } = shop.record;
  if (kind === 'frontage') {
    // Repair strip and a flush drain between the threshold and the road.
    flatRect(parent, GM.pathTop, width + 1.2, 2.75, 0, 2.13, kerb);
    B(parent, MAT.iron, 0.25, 0.026, 0.88, -width / 2 - 0.45, kerb, 2.56, true);
    for (let j = -3; j <= 3; j++) B(parent, MAT.tin, 0.23, 0.012, 0.028, -width / 2 - 0.45, kerb + 0.027, 2.56 + j * 0.116, true);
  } else if (kind === 'bay') {
    flatRect(parent, GM.herring, 3.98, 2.36, 0, 1.2, 0.033);
    B(parent, MAT.stoneD, 3.88, 0.033, 0.15, 0, 0, 2.38, true);
  }
}

const SHOP_BUILDERS = {
  tunday: buildTunday, globe: buildGlobe, turkish: buildTurkish, kebabchi: buildKebabchi,
  iraniChai: buildIraniChai, iraniDum: buildIraniDum, iraniFast: buildIraniFast, kiosk: buildMarketKiosk,
};

function buildShopFronts() {
  const streets = new THREE.Group();
  for (const shop of SHOP_SITES.values()) {
    const { id, record, frame } = shop;
    const parent = frameGroup(frame);
    streets.add(parent);
    const board = SHOP_BUILDERS[record.style](parent, shop);
    shop.board = shop.boards[0];
    buildShopStreet(parent, shop);

    const world = (x, y, z) => {
      const [wx, wz] = toWorld(frame, x, z);
      return [wx, y, wz];
    };
    const frontage = record.kind === 'frontage';
    const tgt = world(0, frontage ? 2.6 : 2.05, board.z - 0.05);
    const views = [
      { name: SHOP_COPY.approach, cam: world(1.65, frontage ? 4.6 : 3.0, board.z + (frontage ? 15 : 13)), tgt },
      { name: SHOP_COPY.service, cam: world(-0.5, 2.25, board.z + 5.0), tgt: world(0, 1.65, board.z - 0.7) },
    ];
    const [tx, ty, tz] = tgt;
    LABELS.push({
      id, ...record.name, record, poi: true, shop, views, cam: views[0].cam, tgt,
      // Anchored by its bottom edge (see ui.js), so the tag sits above the board at any distance.
      pos: world(0, board.top + 0.25, board.z + 0.3), above: true,
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
    const open = h => smooth((h - opens) / 0.55) * (1 - smooth((h - closes + 0.7) / 0.7));
    const target = Math.max(open(TIME.hour), open(TIME.hour + 24));   // hours may run past midnight
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
    const signGlow = 0.06 + TIME.lamps * (0.12 + service * 0.42);
    for (const board of shop.boards) board.emissiveIntensity = signGlow;
    for (const m of shop.glow) m.emissiveIntensity = 0.08 + service * (0.25 + 0.55 * TIME.lamps);
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
