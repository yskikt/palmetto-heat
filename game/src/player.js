// player.js — Ray, the on-foot player: capsule body with shirt/jeans colours,
// walk/run movement relative to the camera, held weapon props (bat / pistol).

import * as THREE from 'three';
import { resolveCollisions } from './layout.js';
import { WORLD } from './roads.js';

export class Player {
  constructor(scene) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0xff7a45 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a7a });
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), jeans);
    this.legL.position.set(-0.16, 0.38, 0);
    this.legR = this.legL.clone(); this.legR.position.x = 0.16;
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
    this.torso.position.y = 1.12; this.torso.castShadow = true;
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), shirt);
    this.armL.position.set(-0.42, 1.12, 0);
    this.armR = this.armL.clone(); this.armR.position.x = 0.42;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
    this.head.position.y = 1.72; this.head.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x14406e }));
    cap.position.y = 1.88;
    // Held props (shown by the weapon wheel selection).
    this.bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.85, 6),
      new THREE.MeshLambertMaterial({ color: 0xb08954 }));
    this.bat.position.set(0.55, 1.0, 0.25); this.bat.rotation.z = 0.7; this.bat.visible = false;
    this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x22242a }));
    this.gun.position.set(0.48, 0.95, 0.3); this.gun.visible = false;
    g.add(this.legL, this.legR, this.torso, this.armL, this.armR, this.head, cap, this.bat, this.gun);
    this.mesh = g;
    this.x = 0; this.z = 0; this.heading = 0; this.walkPhase = 0; this.speedNow = 0;
    scene.add(g);
  }
  setWeapon(name) {
    this.bat.visible = name === 'bat';
    this.gun.visible = name === 'pistol';
  }
  // move: {x,z} camera-relative wish direction, run flag. Returns speed.
  move(dt, move, run) {
    const len = Math.hypot(move.x, move.z);
    const max = run ? 8.4 : 4.4;
    if (len > 0.05) {
      const vx = (move.x / len) * max, vz = (move.z / len) * max;
      let nx = this.x + vx * dt, nz = this.z + vz * dt;
      [nx, nz] = resolveCollisions(nx, nz, 0.55);
      this.x = Math.max(WORLD.xMin, Math.min(WORLD.xMax, nx));
      this.z = Math.max(WORLD.zMin, Math.min(WORLD.zMax, nz));
      this.heading = Math.atan2(vx, vz);
      this.speedNow = max;
      this.walkPhase += dt * (run ? 11 : 8);
    } else this.speedNow = 0;
    const s = Math.sin(this.walkPhase) * (this.speedNow > 0 ? 0.5 : 0);
    this.legL.rotation.x = s; this.legR.rotation.x = -s;
    this.armL.rotation.x = -s * 0.8; this.armR.rotation.x = s * 0.8;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.05, this.z);
    this.mesh.rotation.y = this.heading;
    return this.speedNow;
  }
  place(x, z, heading = 0) { this.x = x; this.z = z; this.heading = heading; this.mesh.position.set(x, 0, z); }
}
