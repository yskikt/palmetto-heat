// car.js — low-poly car meshes and arcade driving physics shared by the
// player car, traffic and police (police get a light bar + livery).

import * as THREE from 'three';
import { resolveCollisions } from './layout.js';

const PALETTE = [0xe8452c, 0x2e86ab, 0xf2b134, 0x7bc950, 0xe8e4da, 0x8e6cc8, 0x2bb3a3, 0xd6336c];

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.3), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.34, 0.7), paint);
  nose.position.set(0, 0.48, 2.3); g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 2.1),
    new THREE.MeshLambertMaterial({ color: 0x1d2733 }));
  cabin.position.set(0, 1.05, -0.2); cabin.castShadow = true; g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), lightMat);
    hl.position.set(lx, 0.58, 2.66); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    tl.position.set(lx, 0.62, -2.16); g.add(tl);
  }
  if (opts.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 4.34),
      new THREE.MeshLambertMaterial({ color: 0x14406e }));
    stripe.position.y = 0.52; g.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3; bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.3; bar.add(blue);
    bar.position.set(0, 1.42, -0.2); g.add(bar);
    g.userData.lightBar = { red, blue };
  }
  if (opts.convertible) { cabin.visible = false; }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, opts = {}) {
    this.mesh = makeCarMesh(color, opts);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.maxSpeed = opts.maxSpeed || 34;
    this.accel = opts.accel || 15;
    this.health = 100;
    this.occupied = false;
    this.parked = !!opts.parked;
    this.color = color;
  }
  get pos() { return this.mesh.position; }
  // input: {throttle -1..1, steer -1..1, brake}
  drive(dt, input, collide = true) {
    const target = input.throttle;
    if (input.brake) this.speed = Math.max(0, this.speed - 30 * dt) * (this.speed > 0.2 ? 1 : 0);
    else if (target > 0) this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    else if (target < 0) this.speed = Math.max(-9, this.speed - this.accel * 0.7 * dt);
    else this.speed -= this.speed * Math.min(1, 0.7 * dt); // engine drag
    this.steer += ((input.steer || 0) - this.steer) * Math.min(1, dt * 7);
    const spd = Math.abs(this.speed);
    if (spd > 0.05) {
      const turn = this.steer * 0.62 * Math.min(1, spd / 9) * Math.sign(this.speed);
      this.heading -= turn * dt;
    }
    let nx = this.x + Math.sin(this.heading) * this.speed * dt;
    let nz = this.z + Math.cos(this.heading) * this.speed * dt;
    if (collide) {
      const before = Math.hypot(nx - this.x, nz - this.z);
      [nx, nz] = resolveCollisions(nx, nz, 1.55);
      const after = Math.hypot(nx - this.x, nz - this.z);
      if (before > 0.001 && after < before * 0.4) { this.speed *= 0.35; this.health -= Math.min(12, spd * 0.3); }
    }
    this.x = nx; this.z = nz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -this.steer * Math.min(0.06, spd * 0.0022);
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt / 0.36;
    return this.speed;
  }
  syncMesh() { this.mesh.position.set(this.x, 0, this.z); this.mesh.rotation.y = this.heading; }
}

export function randomCarColor(rng) { return PALETTE[Math.floor(rng() * PALETTE.length)]; }
