// roads.js — Palmetto Bay street grid: 10 north-south avenues x 6 east-west
// streets (the 6th is the beachfront boulevard), lane geometry, signal cycle.

export const NS_ROADS = [-450, -350, -250, -150, -50, 50, 150, 250, 350, 450];
export const EW_ROADS = [-250, -150, -50, 50, 150];
export const BOULEVARD_Z = 191.5;
export const ALL_EW = [...EW_ROADS, BOULEVARD_Z];
export const ROAD_HALF = 9;          // normal street half width
export const BOULEVARD_HALF = 13;    // boulevard half width
export const WORLD = { xMin: -520, xMax: 560, zMin: -310, zMax: 330 };
export const BEACH_Z = 218;          // sand starts here
export const SEA_Z = 252;            // water starts here

export function roadHalfAtZ(z) { return Math.abs(z - BOULEVARD_Z) < 1 ? BOULEVARD_HALF : ROAD_HALF; }

// Is a point on any road surface?
export function onRoad(x, z) {
  for (const rx of NS_ROADS) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const rz of EW_ROADS) if (Math.abs(z - rz) <= ROAD_HALF) return true;
  if (Math.abs(z - BOULEVARD_Z) <= BOULEVARD_HALF) return true;
  return false;
}

// Intersections that carry traffic signals (boulevard crossings included).
export const SIGNALS = [];
for (const x of NS_ROADS) for (const z of ALL_EW) SIGNALS.push({ x, z });

// Deterministic signal cycle: 14 s NS green, 3 s amber, 14 s EW green, 3 s amber.
// phase offset varies per intersection so the city does not blink in unison.
export function signalState(x, z, t) {
  const off = ((Math.round(x / 100) + 5) * 7 + (Math.round(z / 100) + 3) * 3) % 17;
  const c = (t + off) % 34;
  if (c < 14) return { ns: 'green', ew: 'red' };
  if (c < 17) return { ns: 'amber', ew: 'red' };
  if (c < 31) return { ns: 'red', ew: 'green' };
  return { ns: 'red', ew: 'amber' };
}

// Lane centre offset for right-hand traffic, by travel direction.
export const LANE = 3.4;
export function lanePoint(axis, fixed, dirSign) {
  // axis 'x': travelling along x at road z=fixed; axis 'z': along z at road x=fixed
  return fixed + (axis === 'x' ? -dirSign * LANE : dirSign * LANE);
}

// Manhattan route along the grid (for the minimap route line). The port sits
// east of avenue 450, so routes to/from the port use a dedicated dock branch.
export function gridRoute(a, b) {
  const pts = [{ x: a.x, z: a.z }];
  const portA = a.x > 470, portB = b.x > 470;
  const ax = portA ? 450 : nearest(NS_ROADS, a.x), az = portA ? 150 : nearest(ALL_EW, a.z);
  const bx = portB ? 450 : nearest(NS_ROADS, b.x), bz = portB ? 150 : nearest(ALL_EW, b.z);
  pts.push({ x: ax, z: a.z });
  pts.push({ x: ax, z: az });
  pts.push({ x: bx, z: az });
  pts.push({ x: bx, z: bz });
  pts.push({ x: b.x, z: bz });
  pts.push({ x: b.x, z: b.z });
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.5);
}
function nearest(arr, v) { let best = arr[0], d = 1e9; for (const n of arr) { const dd = Math.abs(n - v); if (dd < d) { d = dd; best = n; } } return best; }
