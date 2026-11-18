'use strict';

/* Walking uses the same local metres as the rendered terrain. Water is a
   separate layer so a bridge can restore a floor without clearing walls. */
const NAV = {
  x0: MAP.bounds[0], z0: MAP.bounds[2],
  W: Math.ceil(MAP.bounds[1] - MAP.bounds[0]), H: Math.ceil(MAP.bounds[3] - MAP.bounds[2]),
  grid: null, top: null, water: null, thin: new Map(), platforms: new Map(),
};
const STEP = 0.6;
const PLATFORM_CELL = 16;
const inObb = (o, x, z, m = 0) => {
  const dx = x - o.x, dz = z - o.z;
  return Math.abs(dx * o.ax + dz * o.az) <= o.hw + m && Math.abs(dx * o.bx + dz * o.bz) <= o.hd + m;
};
const platformKey = (ix, iz) => ix + ',' + iz;
const platformsAt = (x, z) => NAV.platforms.get(platformKey(Math.floor(x / PLATFORM_CELL), Math.floor(z / PLATFORM_CELL)));

function rasterizeFeature({ p, holes = [] }, visit) {
  const [, , minZ, maxZ] = polyBounds(p);
  const rings = [p, ...holes];
  const z0 = Math.max(0, Math.ceil(minZ - NAV.z0 - 0.5));
  const z1 = Math.min(NAV.H, Math.ceil(maxZ - NAV.z0 - 0.5));
  for (let gz = z0; gz < z1; gz++) {
    const z = NAV.z0 + gz + 0.5, edges = [];
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
        const a = ring[i + 1], b = ring[j + 1];
        if ((a > z) !== (b > z)) edges.push(ring[i] + (ring[j] - ring[i]) * (z - a) / (b - a));
      }
    }
    edges.sort((a, b) => a - b);
    for (let i = 0; i + 1 < edges.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(edges[i] - NAV.x0 - 0.5));
      const x1 = Math.min(NAV.W, Math.ceil(edges[i + 1] - NAV.x0 - 0.5));
      for (let gx = x0; gx < x1; gx++) visit(gz * NAV.W + gx);
    }
  }
}

function buildNav() {
  const n = NAV.W * NAV.H;
  const g = NAV.grid = new Uint8Array(n);
  const top = NAV.top = new Uint8Array(n);
  const water = NAV.water = new Uint8Array(n);
  NAV.thin.clear();
  NAV.platforms.clear();

  for (const feature of MAP.water) {
    if (!isTalabWater(feature)) rasterizeFeature(feature, i => { water[i] = 1; });
  }
  for (const r of MAP.roads) {
    if (!r.b || r.f === 0 || !r._in) continue;
    const hw = r._w / 2;
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const [ax, az, bx, bz] = r.p.slice(i, i + 4);
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - hw - NAV.x0));
      const x1 = Math.min(NAV.W, Math.ceil(Math.max(ax, bx) + hw - NAV.x0));
      const z0 = Math.max(0, Math.floor(Math.min(az, bz) - hw - NAV.z0));
      const z1 = Math.min(NAV.H, Math.ceil(Math.max(az, bz) + hw - NAV.z0));
      for (let gz = z0; gz < z1; gz++) for (let gx = x0; gx < x1; gx++) {
        if (segDist(NAV.x0 + gx + 0.5, NAV.z0 + gz + 0.5, ax, az, bx, bz) <= hw) water[gz * NAV.W + gx] = 0;
      }
    }
  }

  for (const { feature, height } of MAPPED_SOLIDS) {
    rasterizeFeature(feature, i => {
      g[i] = 1;
      top[i] = Math.max(top[i], Math.min(255, Math.ceil(height * 8)));
    });
  }
  for (const p of PLATFORMS) {
    const r = Math.hypot(p.hw, p.hd);
    const x0 = Math.floor((p.x - r) / PLATFORM_CELL), x1 = Math.floor((p.x + r) / PLATFORM_CELL);
    const z0 = Math.floor((p.z - r) / PLATFORM_CELL), z1 = Math.floor((p.z + r) / PLATFORM_CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const key = platformKey(ix, iz);
      if (!NAV.platforms.has(key)) NAV.platforms.set(key, []);
      NAV.platforms.get(key).push(p);
    }
  }
  for (const c of COLLIDERS) {
    const m = Math.max(0.4, 0.74 - Math.min(c.hw, c.hd)), r = Math.hypot(c.hw, c.hd) + m + 0.5;
    const thin = Math.max(c.hw, c.hd) < 0.5, ht = Math.min(255, Math.ceil(c.yt * 8));
    if (thin) {
      const key = Math.floor(c.x / 4) + ',' + Math.floor(c.z / 4);
      if (!NAV.thin.has(key)) NAV.thin.set(key, []);
      NAV.thin.get(key).push(c);
    }
    const x0 = Math.max(0, Math.floor(c.x - r - NAV.x0)), x1 = Math.min(NAV.W - 1, Math.ceil(c.x + r - NAV.x0));
    const z0 = Math.max(0, Math.floor(c.z - r - NAV.z0)), z1 = Math.min(NAV.H - 1, Math.ceil(c.z + r - NAV.z0));
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const px = gx + 0.5 + NAV.x0, pz = gz + 0.5 + NAV.z0;
      if (!inObb(c, px, pz, m)) continue;
      let fl = 0;
      for (const p of platformsAt(px, pz) || []) if (p.yt > fl && inObb(p, px, pz)) fl = p.yt;
      if (c.yb >= fl + 1.9 || c.yt <= fl + 0.45) continue;
      const i = gz * NAV.W + gx;
      if (thin) {
        if (!g[i]) g[i] = 2;
      } else {
        g[i] = 1;
        top[i] = Math.max(top[i], ht);
      }
    }
  }
}

function insideWalkGrid(gx, gz) {
  return gx >= 3 && gz >= 3 && gx < NAV.W - 3 && gz < NAV.H - 3;
}

/** Floor height a walker standing at feet would find at (x,z), or null. */
function floorAt(x, z, feet) {
  const gx = Math.floor(x - NAV.x0), gz = Math.floor(z - NAV.z0);
  if (!insideWalkGrid(gx, gz)) return null;
  const i = gz * NAV.W + gx;
  if (NAV.grid[i]) return null;
  const depth = talabDepthAt(x, z);
  if (depth === -99 || (depth === null && NAV.water[i])) return null;
  let floor = depth ?? 0;
  for (const p of platformsAt(x, z) || []) {
    if (!inObb(p, x, z)) continue;
    if (p.yt <= feet + STEP) floor = Math.max(floor, p.yt);
    else if (p.yb < feet + 1.7) return null;
  }
  return floor - feet > STEP ? null : floor;
}

function lineOfSight(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
  for (let i = 2; i < n - 3; i++) {
    const t = i / n, gx = Math.floor(lerp(x0, x1, t) - NAV.x0), gz = Math.floor(lerp(z0, z1, t) - NAV.z0);
    if (insideWalkGrid(gx, gz) && NAV.grid[gz * NAV.W + gx]) return false;
  }
  return true;
}

function findFree(x, z) {
  if (!insideWalkGrid(Math.floor(x - NAV.x0), Math.floor(z - NAV.z0))) return null;
  for (let r = 0; r < 40; r += 0.8) {
    for (let k = 0; k < (r ? 14 : 1); k++) {
      const a = k * TAU / 14 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const floor = floorAt(px, pz, 0);
      if (floor !== null) return [px, pz, floor];
    }
  }
  return null;
}

/** Check a curated walking leg at intervals smaller than a stair tread. */
function walkableLeg(points) {
  let floor = floorAt(points[0], points[1], 0);
  if (floor === null) return false;
  for (let i = 2; i < points.length; i += 2) {
    const x = points[i - 2], z = points[i - 1], dx = points[i] - x, dz = points[i + 1] - z;
    const steps = Math.ceil(Math.hypot(dx, dz) / 0.3);
    for (let j = 1; j <= steps; j++) {
      const next = floorAt(x + dx * j / steps, z + dz * j / steps, floor);
      if (next === null || floor - next > STEP) return false;
      floor = next;
    }
  }
  return true;
}
