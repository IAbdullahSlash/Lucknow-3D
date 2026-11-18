'use strict';

const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const number = (key, fallback) => {
  const value = params.get(key);
  return value && Number.isFinite(Number(value)) ? Number(value) : fallback;
};
const scale = Math.max(0.25, Math.min(10, number('s', 0.8)));
const centerX = number('x', 0), centerZ = number('z', 160);
const roadColors = {
  primary: '#e8af50', primary_link: '#e8af50', secondary: '#f4d385', secondary_link: '#f4d385',
  tertiary: '#fff6dc', tertiary_link: '#fff6dc', residential: '#f4efe3',
  living_street: '#f4efe3', service: '#f4efe3', footway: '#c66', path: '#a66', steps: '#c00',
};

function drawMap(canvas, map) {
  const ctx = canvas.getContext('2d');
  const xAt = x => (x - centerX) * scale + canvas.width / 2;
  const zAt = z => (z - centerZ) * scale + canvas.height / 2;
  const ring = (points, close) => {
    for (let i = 0; i < points.length; i += 2) {
      const x = xAt(points[i]), z = zAt(points[i + 1]);
      if (i === 0) ctx.moveTo(x, z);
      else ctx.lineTo(x, z);
    }
    if (close) ctx.closePath();
  };
  const polygon = feature => {
    ctx.beginPath();
    ring(feature.p, true);
    for (const hole of feature.holes || []) ring(hole, true);
    ctx.fill('evenodd');
  };
  ctx.fillStyle = '#d8cfbd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [key, color] of [['areas', '#cdb796'], ['green', '#a9c889'], ['water', '#7fb6d9']]) {
    ctx.fillStyle = color;
    map[key].forEach(polygon);
  }
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const road of map.roads) {
    ctx.beginPath();
    ring(road.p);
    ctx.strokeStyle = road.b ? '#e8a04a' : roadColors[road.k] || '#fff6dc';
    ctx.lineWidth = Math.max(1, road.w * scale);
    ctx.stroke();
  }
  for (const b of map.buildings) {
    ctx.fillStyle = b.n ? '#a74d3c' : '#968375';
    polygon(b);
  }
  ctx.font = '14px system-ui,sans-serif';
  ctx.fillStyle = '#472821';
  for (const b of [...map.buildings, ...map.areas, ...map.green, ...map.water]) {
    if (!b.n) continue;
    let x = 0, z = 0;
    for (let i = 0; i < b.p.length; i += 2) {
      x += b.p[i];
      z += b.p[i + 1];
    }
    ctx.fillText(b.n, xAt(2 * x / b.p.length), zAt(2 * z / b.p.length));
  }
}

function caption(name, data) {
  const timestamp = data.source?.osm_timestamp || 'extract date unavailable';
  return name + ' · ' + timestamp + ' · ' + data.roads.length + ' road runs · ' + data.buildings.length + ' building parts';
}
drawMap(el('baseline'), MAPDATA);
el('baselineInfo').textContent = caption('Checked-in extract', MAPDATA);

el('compare').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  const status = el('status');
  try {
    const body = (await file.text()).trim();
    const generated = body.indexOf('window.MAPDATA = ');
    const data = JSON.parse(generated < 0 ? body : body.slice(generated + 'window.MAPDATA = '.length).replace(/;$/, ''));
    drawMap(el('comparison'), data);
    el('candidateInfo').textContent = caption(file.name, data);
    el('candidate').hidden = false;
    status.hidden = true;
  } catch {
    el('candidate').hidden = true;
    status.textContent = 'Choose a map file produced by tools/build_map.py.';
    status.hidden = false;
  }
};
