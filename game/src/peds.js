// peds.js — pedestrians: they stroll block perimeters and the promenade,
// step aside from cars, flee from violence, and fall when hit or punched.

import * as THREE from 'three';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z, ROAD_HALF } from './roads.js';
import { mulberry32 } from './layout.js';

const rng = mulberry32(4242);
const SKIN = [0xc98a5e, 0x8a5a3b, 0xe8b48f, 0x6e4530];
const CLOTH = [0xff5f6d, 0x2e86ab, 0xffc371, 0x7bc950, 0xf7ede2, 0x8e6cc8, 0x2bb3a3, 0xff8c69];

function makePedMesh() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: CLOTH[Math.floor(rng() * CLOTH.length)] });
  const skin = new THREE.MeshLambertMaterial({ color: SKIN[Math.floor(rng() * SKIN.length)] });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), cloth); torso.position.y = 1.02; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 7), skin); head.position.y = 1.56;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
  legL.position.set(-0.13, 0.35, 0);
  const legR = legL.clone(); legR.position.x = 0.13;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.17), cloth); armL.position.set(-0.35, 1.02, 0);
  const armR = armL.clone(); armR.position.x = 0.35;
  g.add(torso, head, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

class Ped {
  constructor(scene) {
    this.mesh = makePedMesh(); scene.add(this.mesh);
    // Waypoint loop: rectangle around a random block, or along the promenade.
    if (rng() < 0.35) {
      const z = BOULEVARD_Z - 16 + rng() * 6;
      this.loop = [{ x: -460, z }, { x: 460, z }];
    } else {
      const bx = NS_ROADS[Math.floor(rng() * (NS_ROADS.length - 1))] + ROAD_HALF + 3;
      const bz = EW_ROADS[Math.floor(rng() * (EW_ROADS.length - 1))] + ROAD_HALF + 3;
      const w = 72, d = 72;
      this.loop = [
        { x: bx, z: bz }, { x: bx + w, z: bz }, { x: bx + w, z: bz + d }, { x: bx, z: bz + d },
      ];
    }
    this.wp = Math.floor(rng() * this.loop.length);
    const p = this.loop[this.wp];
    this.x = p.x + (rng() - 0.5) * 8; this.z = p.z + (rng() - 0.5) * 8;
    this.speed = 1.1 + rng() * 0.7; this.phase = rng() * 6;
    this.state = 'walk'; this.stateT = 0; this.fleeX = 0; this.fleeZ = 0;
  }
  scare(fromX, fromZ, radius = 26) {
    const d = Math.hypot(this.x - fromX, this.z - fromZ);
    if (d < radius && this.state !== 'down') {
      this.state = 'flee'; this.stateT = 2.5 + rng() * 2;
      const a = Math.atan2(this.x - fromX, this.z - fromZ);
      this.fleeX = Math.sin(a); this.fleeZ = Math.cos(a);
    }
  }
  knockDown() { if (this.state !== 'down') { this.state = 'down'; this.stateT = 3.5; } }
  update(dt, threats) {
    this.stateT -= dt;
    if (this.state === 'down') {
      this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.set(this.x, 0.25, this.z);
      if (this.stateT <= 0) { this.state = 'walk'; this.mesh.rotation.x = 0; }
      return;
    }
    this.mesh.rotation.x = 0;
    let vx = 0, vz = 0, spd = this.speed;
    if (this.state === 'flee') {
      vx = this.fleeX; vz = this.fleeZ; spd = 4.6;
      if (this.stateT <= 0) this.state = 'walk';
    } else {
      const target = this.loop[this.wp];
      const dx = target.x - this.x, dz = target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6) { this.wp = (this.wp + 1) % this.loop.length; }
      else { vx = dx / d; vz = dz / d; }
    }
    // Vehicle avoidance: sidestep any fast/near car.
    for (const c of threats) {
      const dx = this.x - c.x, dz = this.z - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 30) {
        const d = Math.sqrt(d2) || 1;
        vx += (dx / d) * 1.6; vz += (dz / d) * 1.6;
        if (Math.abs(c.speed) > 6 && d < 4.2) this.knockDown();
      }
    }
    const vl = Math.hypot(vx, vz) || 1;
    this.x += (vx / vl) * spd * dt; this.z += (vz / vl) * spd * dt;
    this.phase += dt * (spd > 2 ? 11 : 7);
    const s = Math.sin(this.phase) * 0.45;
    const u = this.mesh.userData;
    u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = Math.atan2(vx, vz);
  }
}

export class Peds {
  constructor(scene, count = 26) {
    this.list = [];
    for (let i = 0; i < count; i++) this.list.push(new Ped(scene));
  }
  update(dt, threats) { for (const p of this.list) p.update(dt, threats); }
  scare(x, z, r) { for (const p of this.list) p.scare(x, z, r); }
  nearest(x, z, maxD) {
    let best = null, bd = maxD;
    for (const p of this.list) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
}
