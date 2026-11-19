// city.js — builds the three.js scene from layout data: gradient sky, golden
// hour sun, turquoise sea, beach, roads with crosswalks, buildings, the port,
// 112 instanced palms, streetlights and signal heads.

import * as THREE from 'three';
import { buildings, palms, streetlights, port } from './layout.js';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z, ROAD_HALF, BOULEVARD_HALF, BEACH_Z, SEA_Z, SIGNALS } from './roads.js';

const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts?.material || mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = !!opts?.shadow; m.receiveShadow = true;
  return m;
}

export function buildCity(scene) {
  scene.fog = new THREE.Fog(0xf2a56b, 260, 1150);

  // Gradient sky dome (canvas texture: deep blue -> peach -> gold horizon).
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#1d3a66'); gr.addColorStop(0.42, '#5f4390');
  gr.addColorStop(0.7, '#e05f3c'); gr.addColorStop(0.88, '#ff8a3c'); gr.addColorStop(1, '#ffc46b');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(cv);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sunBall.position.set(1400, 240, 1500); scene.add(sunBall);

  // Golden-hour lighting (sun in the south-east so downtown streets and the
  // eastbound boulevard are lit, shadows falling north-west).
  const sun = new THREE.DirectionalLight(0xffb066, 2.6);
  sun.position.set(300, 330, 430); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 1400; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x8fb6d9, 0x59422e, 1.5));
  scene.userData.sun = sun;

  // Ground base (city blocks sit on warm pavement-grey).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1180, 700), mat(0x8d8578));
  ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.05, 0); ground.receiveShadow = true;
  scene.add(ground);

  // Roads: dark asphalt strips + centre dashes (instanced for draw calls).
  const asphalt = mat(0x4a4d55), dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c9 });
  const dummy = new THREE.Object3D();
  const dashSpots = [];
  for (const x of NS_ROADS) {
    const r = box(ROAD_HALF * 2, 0.06, 560, 0, 0.03, 0); r.material = asphalt; r.position.set(x, 0.03, -22); scene.add(r);
    for (let z = -282; z <= 240; z += 14) dashSpots.push([x, z]);
  }
  const dashInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 5), dashMat, dashSpots.length);
  dashSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0.07, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix();
    dashInst.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashInst);
  for (const z of EW_ROADS) {
    const r = box(1060, 0.06, ROAD_HALF * 2, 0, 0, 0); r.material = asphalt; r.position.set(0, 0.03, z); scene.add(r);
  }
  const blvd = box(1080, 0.06, BOULEVARD_HALF * 2, 0, 0, 0); blvd.material = mat(0x55504c);
  blvd.position.set(0, 0.03, BOULEVARD_Z); scene.add(blvd);
  // Promenade strip between the last EW street and the boulevard.
  const prom = box(1080, 0.05, 24, 0xd9c49a); prom.position.set(0, 0.025, 170); scene.add(prom);

  // Crosswalks at signalled intersections (instanced stripes).
  const cwSpots = [];
  for (const s of SIGNALS) {
    for (let i = -3; i <= 3; i++) {
      cwSpots.push([s.x + i * 2.4, s.z - ROAD_HALF - 2.2]);
      cwSpots.push([s.x + i * 2.4, s.z + ROAD_HALF + 2.2]);
    }
  }
  const cwInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 7),
    new THREE.MeshBasicMaterial({ color: 0xe8e4da }), cwSpots.length);
  cwSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0.075, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix();
    cwInst.setMatrixAt(i, dummy.matrix);
  });
  dummy.rotation.set(0, 0, 0);
  scene.add(cwInst);

  // Beach + sea (animated in main loop via userData).
  const sand = box(1180, 0.05, SEA_Z - BEACH_Z + 30, 0xeed9a4); sand.position.set(20, 0.01, (BEACH_Z + SEA_Z) / 2 + 6); scene.add(sand);
  const seaMat = new THREE.MeshPhongMaterial({ color: 0x17a2a8, shininess: 140, specular: 0xffd9a0, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 420, 24, 8), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(20, 0.12, SEA_Z + 200); scene.add(sea);
  scene.userData.sea = sea;

  // Buildings: body + emissive-window band texture per building, instanced roofs.
  const winCv = document.createElement('canvas'); winCv.width = 32; winCv.height = 64;
  const wg = winCv.getContext('2d'); wg.fillStyle = '#20242c'; wg.fillRect(0, 0, 32, 64);
  for (let y = 3; y < 60; y += 6) for (let x = 3; x < 28; x += 6) {
    wg.fillStyle = Math.random() < 0.4 ? '#ffd98a' : '#3d4a5a'; wg.fillRect(x, y, 3.4, 3.4);
  }
  const winTex = new THREE.CanvasTexture(winCv);
  for (const b of buildings) {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: b.color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bodyMat);
    body.position.y = b.h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
    if (b.h > 16) { // window skin slightly proud of the walls
      const skin = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.15, b.h * 0.92, b.d + 0.15),
        new THREE.MeshLambertMaterial({ map: winTex, transparent: true, opacity: 0.55 }));
      skin.position.y = b.h / 2; grp.add(skin);
    }
    const roof = box(b.w + 0.8, 0.8, b.d + 0.8, 0x5a4a42); roof.position.y = b.h + 0.4; grp.add(roof);
    grp.position.set(b.x, 0, b.z); scene.add(grp);
  }

  buildPort(scene);
  buildPalms(scene);

  // Streetlights (instanced poles + head glow spheres).
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 5);
  const poleInst = new THREE.InstancedMesh(poleGeo, mat(0x3a3f46), streetlights.length);
  streetlights.forEach((s, i) => { dummy.position.set(s.x, 2.8, s.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); poleInst.setMatrixAt(i, dummy.matrix); });
  scene.add(poleInst);
  const headGeo = new THREE.SphereGeometry(0.32, 6, 5);
  const headInst = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), streetlights.length);
  streetlights.forEach((s, i) => { dummy.position.set(s.x, 5.7, s.z); dummy.updateMatrix(); headInst.setMatrixAt(i, dummy.matrix); });
  scene.add(headInst);

  // Signal heads at intersections (state updated per-frame in main).
  const signals = new THREE.Group(); const heads = [];
  const poleG = new THREE.CylinderGeometry(0.09, 0.09, 4.6, 5);
  for (const s of SIGNALS) {
    const p = new THREE.Mesh(poleG, mat(0x2c2f34)); p.position.set(s.x + ROAD_HALF + 1.4, 2.3, s.z + ROAD_HALF + 1.4); signals.add(p);
    const headBox = box(0.55, 1.5, 0.55, 0x1c1e22); headBox.position.set(p.position.x, 5.1, p.position.z); signals.add(headBox);
    const mk = (dy, color) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      lamp.position.set(p.position.x, 5.1 + dy, p.position.z); signals.add(lamp); return { lamp, color };
    };
    heads.push({ x: s.x, z: s.z, ns: [mk(0.5, 0xff3b30), mk(0, 0xffcc00), mk(-0.5, 0x35e065)], ew: null });
  }
  scene.add(signals);
  scene.userData.signalHeads = heads;
  return { sky, sun };
}

function buildPort(scene) {
  for (const w of port.warehouses) {
    const g = new THREE.Group();
    const body = box(w.w, w.h, w.d, 0xb8b0a4, 0, w.h / 2, 0, { shadow: true }); g.add(body);
    const roof = box(w.w + 1, 1.2, w.d + 1, 0x8a4b3a, 0, w.h + 0.6, 0); g.add(roof);
    const door = box(8, 6, 0.4, 0x4a5058, -w.w / 4, 3, w.d / 2 + 0.2); g.add(door);
    const sign = box(12, 2.2, 0.3, 0xffb35c, w.w / 5, w.h - 2, w.d / 2 + 0.2); g.add(sign);
    g.position.set(w.x, 0, w.z); scene.add(g);
  }
  const contGeo = new THREE.BoxGeometry(12, 2.6, 2.5);
  for (const c of port.containers) {
    const m = new THREE.Mesh(contGeo, mat(c.color));
    m.position.set(c.x, 1.3 + c.level * 2.7, c.z); m.rotation.y = c.rotY;
    m.castShadow = true; scene.add(m);
  }
  for (const c of port.cranes) {
    const g = new THREE.Group();
    const legMat = mat(0xe8641e);
    for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 26, 0.9), legMat); leg.position.set(lx, 13, lz); g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 44), legMat); beam.position.set(0, 26.5, 4); g.add(beam);
    const cab = box(3.4, 3, 3.4, 0x2e6f8e, 0, 24, 10); g.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 4), mat(0x222222)); cable.position.set(0, 19, 10); g.add(cable);
    const hook = box(6, 2.4, 2.4, 0xd64545, 0, 12.4, 10); g.add(hook);
    g.position.set(c.x, 0, c.z); scene.add(g);
  }
  // Cargo ship riding the turquoise water off the docks.
  const ship = new THREE.Group();
  const hull = box(26, 7, 84, 0x37424e, 0, 3, 0, { shadow: true }); ship.add(hull);
  const deck = box(24, 1, 80, 0x8a4b3a, 0, 7, 0); ship.add(deck);
  const bridge = box(18, 10, 10, 0xf1e6d2, 0, 12, -30); ship.add(bridge);
  for (let i = 0; i < 6; i++) {
    const cc = box(11, 2.6, 2.5, [0xd64545, 0x2e86ab, 0x3fa34d][i % 3], (i % 2 ? 5.6 : -5.6), 9 + Math.floor(i / 2) * 2.7, -12 + (i % 3) * 14);
    ship.add(cc);
  }
  ship.position.set(port.ship.x, 0, port.ship.z); ship.rotation.y = port.ship.rotY;
  scene.add(ship);
}

// Palms: instanced trunks / fronds / coconuts. Trunk base height 8.6 m, base
// radius 0.34 m; boulevard trees scale hs 1.18-1.50 -> 10.2-12.9 m tall with
// crowns ~13 m across. Fronds: 14 per tree in two tiers (9 drooping + 5 up).
function buildPalms(scene) {
  const N = palms.length;
  const dummy = new THREE.Object3D();
  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.34, 8.6, 6);
  trunkGeo.translate(0, 4.3, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x8a6844), N);
  trunks.castShadow = true;
  palms.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z); dummy.rotation.set(p.lean, p.rot, 0); dummy.scale.setScalar(p.hs);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunks);

  const FRONDS = 14;
  const frondGeo = new THREE.ConeGeometry(0.85, 5.6, 4);
  frondGeo.translate(0, 2.8, 0); frondGeo.scale(1, 1, 0.3);
  const fronds = new THREE.InstancedMesh(frondGeo, mat(0x2e9e4f), N * FRONDS);
  fronds.castShadow = true;
  let fi = 0;
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const p of palms) {
    const topX = p.x - Math.sin(p.lean) * 0, topY = 8.6 * p.hs, topZ = p.z;
    for (let k = 0; k < FRONDS; k++) {
      const upTier = k >= 9;
      const ang = (k / (upTier ? 5 : 9)) * Math.PI * 2 + p.rot + (upTier ? 0.3 : 0);
      const tilt = upTier ? 0.55 : 1.15; // from vertical: up tier steeper, low tier droops
      dir.set(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang)).normalize();
      q.setFromUnitVectors(up, dir);
      dummy.position.set(topX, topY - 0.15, topZ); dummy.quaternion.copy(q);
      dummy.scale.setScalar(p.cs * (upTier ? 0.8 : 1)); dummy.updateMatrix();
      fronds.setMatrixAt(fi++, dummy.matrix);
    }
  }
  dummy.rotation.set(0, 0, 0); dummy.quaternion.identity();
  scene.add(fronds);

  const nutGeo = new THREE.SphereGeometry(0.34, 6, 5);
  const nuts = new THREE.InstancedMesh(nutGeo, mat(0x6d4c2f), N * 3);
  palms.forEach((p, i) => {
    for (let k = 0; k < 3; k++) {
      const a = p.rot + k * 2.1;
      dummy.position.set(p.x + Math.cos(a) * 0.5, 8.6 * p.hs - 0.5, p.z + Math.sin(a) * 0.5);
      dummy.scale.setScalar(p.cs); dummy.updateMatrix(); nuts.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  });
  scene.add(nuts);
}

export function updateSignalHeads(scene, signalStateFn, t) {
  const heads = scene.userData.signalHeads; if (!heads) return;
  for (const h of heads) {
    const st = signalStateFn(h.x, h.z, t);
    const set = (lamps, state) => {
      lamps[0].lamp.material.color.setHex(state === 'red' ? 0xff3b30 : 0x2a0d0b);
      lamps[1].lamp.material.color.setHex(state === 'amber' ? 0xffcc00 : 0x2a2208);
      lamps[2].lamp.material.color.setHex(state === 'green' ? 0x35e065 : 0x0b2413);
    };
    set(h.ns, st.ns);
  }
}
