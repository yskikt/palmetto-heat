// layout.js — city layout data for Palmetto Bay: buildings per zone, the port,
// 112 signature palms, streetlights, and AABB collision resolution.

import { NS_ROADS, EW_ROADS, BOULEVARD_Z, ROAD_HALF, BOULEVARD_HALF } from './roads.js';

// Small seeded RNG so the city is identical on every load (and every screenshot).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261118);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

export const colliders = []; // {minX,maxX,minZ,maxZ}
function addCollider(cx, cz, w, d) {
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
}

// Resolve a circle (x,z,r) out of every building AABB. Returns corrected [x,z].
export function resolveCollisions(x, z, r) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
      else { // centre inside the box: push out along the smallest penetration
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
      }
    }
  }
  return [x, z];
}

// ---- Zones ------------------------------------------------------------
const CORAL = [0xf2784b, 0xff8c69, 0xe85d75, 0xffb4a2, 0xf4a259];
const WHITE = [0xfff6ec, 0xf7ede2, 0xffffff, 0xf1e6d2];
const GLASS = [0x2e6f8e, 0x3a86a8, 0x25607e, 0x4d9db8];

export const buildings = []; // {x,z,w,d,h,color,zone}
function zoneOf(cx, cz) {
  if (cx >= 380 && cz >= 60) return 'port';
  if (Math.abs(cx) <= 170 && cz <= 70) return 'downtown';
  if (cx <= -270) return 'residential';
  return 'midtown';
}
for (let i = 0; i < NS_ROADS.length - 1; i++) {
  for (let j = 0; j < EW_ROADS.length; j++) {
    const x0 = NS_ROADS[i] + ROAD_HALF, x1 = NS_ROADS[i + 1] - ROAD_HALF;
    const zEdges = [...EW_ROADS, BOULEVARD_Z];
    const z0 = (j === 0 ? -292 : zEdges[j - 1] + (j - 1 === EW_ROADS.length - 1 ? BOULEVARD_HALF : ROAD_HALF));
    const z1 = zEdges[j] - (j === EW_ROADS.length - 1 ? BOULEVARD_HALF : ROAD_HALF);
    if (z1 - z0 < 20 || x1 - x0 < 20) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, zone = zoneOf(cx, cz);
    if (zone === 'port') continue;
    // 2x2 sub-lots per block
    for (let sx = 0; sx < 2; sx++) for (let sz = 0; sz < 2; sz++) {
      if (rng() < 0.12) continue; // occasional plaza / parking gap
      const lx = x0 + (sx + 0.5) * (x1 - x0) / 2 + (rng() - 0.5) * 4;
      const lz = z0 + (sz + 0.5) * (z1 - z0) / 2 + (rng() - 0.5) * 4;
      let w, d, h, color;
      if (zone === 'downtown') {
        w = 22 + rng() * 12; d = 22 + rng() * 12; h = 42 + rng() * 68;
        color = rng() < 0.45 ? pick(GLASS) : pick([...WHITE, ...CORAL]);
      } else if (zone === 'residential') {
        w = 13 + rng() * 6; d = 12 + rng() * 6; h = 6 + rng() * 5;
        color = pick([...WHITE, 0xffd9a0, 0xa8d8c8]);
      } else {
        w = 18 + rng() * 12; d = 18 + rng() * 12; h = 14 + rng() * 26;
        color = rng() < 0.5 ? pick(CORAL) : pick(WHITE);
      }
      buildings.push({ x: lx, z: lz, w, d, h, color, zone });
      addCollider(lx, lz, w + 0.6, d + 0.6);
    }
  }
}

// ---- Port (east, z 60..235): warehouses, container stacks, cranes, ship --
export const port = { warehouses: [], containers: [], cranes: [], ship: { x: 505, z: 300, rotY: 0.5 } };
for (let i = 0; i < 3; i++) {
  const wx = 425 + i * 8, wz = 78 + i * 52;
  port.warehouses.push({ x: wx, z: wz, w: 46, d: 30, h: 13 });
  addCollider(wx, wz, 47, 31);
}
const CONT_COLORS = [0xd64545, 0x2e86ab, 0x3fa34d, 0xe8a13a, 0x7d5ba6, 0x2bb3a3];
for (let i = 0; i < 34; i++) {
  const cx = 462 + rng() * 70, cz = 66 + rng() * 150;
  const level = Math.floor(rng() * 3);
  port.containers.push({ x: cx, z: cz, rotY: rng() < 0.5 ? 0 : Math.PI / 2, level, color: pick(CONT_COLORS) });
  if (level === 0) addCollider(cx, cz, 12.4, 5);
}
port.cranes.push({ x: 470, z: 96 }, { x: 478, z: 196 });
for (const c of port.cranes) addCollider(c.x, c.z, 6, 6);
addCollider(port.ship.x, port.ship.z, 30, 90);

// ---- Palms: exactly 112. Boulevard rows are the tall signature trees. ---
export const palms = []; // {x,z,hs (trunk scale),cs (crown scale),lean,rot}
function addPalm(x, z, hs, cs) {
  palms.push({ x, z, hs, cs, lean: (rng() - 0.5) * 0.07, rot: rng() * Math.PI * 2 });
}
// Boulevard double row (DEVLOG spec rows z=180.5 / 202.5), skipping crossings.
for (let x = -492; x <= 492; x += 21.5) {
  const nearCrossing = NS_ROADS.some((rx) => Math.abs(x - rx) < 13);
  if (nearCrossing) continue;
  addPalm(x + (rng() - 0.5) * 2, 180.5, 1.18 + rng() * 0.32, 1.15 + rng() * 0.3);
  addPalm(x + 9 + (rng() - 0.5) * 2, 202.5, 1.18 + rng() * 0.32, 1.15 + rng() * 0.3);
}
// Beach scatter + a plaza cluster + residential streets fill up to 112.
while (palms.length < 112) {
  const kind = rng();
  if (kind < 0.45) addPalm(-480 + rng() * 980, 224 + rng() * 22, 0.9 + rng() * 0.3, 0.9 + rng() * 0.25);
  else if (kind < 0.7) addPalm(-60 + rng() * 120, 96 + rng() * 40, 0.95 + rng() * 0.25, 0.95 + rng() * 0.2);
  else addPalm(-470 + rng() * 300, -270 + rng() * 480, 0.85 + rng() * 0.3, 0.85 + rng() * 0.25);
}
palms.length = 112;

// ---- Streetlights -------------------------------------------------------
export const streetlights = [];
for (const rx of NS_ROADS) for (let z = -285; z <= 235; z += 46) {
  if (EW_ROADS.some((rz) => Math.abs(z - rz) < 12)) continue;
  streetlights.push({ x: rx + ROAD_HALF + 1.2, z });
}
for (let x = -492; x <= 492; x += 41) {
  if (NS_ROADS.some((rx) => Math.abs(x - rx) < 12)) continue;
  streetlights.push({ x, z: BOULEVARD_Z - BOULEVARD_HALF - 1.2 });
}

export const SPAWN = { x: -48, z: 168, heading: Math.PI / 2 }; // on foot near the boulevard
