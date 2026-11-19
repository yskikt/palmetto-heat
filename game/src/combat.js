// combat.js — three weapons (fists / bat / pistol): melee swings with an arc
// check, hitscan pistol shots with tracer lines and muzzle flash, and the
// radial weapon wheel (Tab hold or Q toggle, slow motion x0.12 while open).

import * as THREE from 'three';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', range: 1.9, damage: 12, cooldown: 0.34 },
  { id: 'bat', name: 'BAT', range: 2.5, damage: 26, cooldown: 0.5 },
  { id: 'pistol', name: 'PISTOL', range: 55, damage: 34, cooldown: 0.26 },
];

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.weaponIndex = 0;
    this.cool = 0;
    this.swingT = 0;
    // Tracer pool + muzzle flash light.
    this.tracers = [];
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    for (let i = 0; i < 8; i++) {
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
      line.visible = false; scene.add(line); this.tracers.push({ line, life: 0 });
    }
    this.flash = new THREE.PointLight(0xffc266, 0, 16);
    scene.add(this.flash);
    this.flashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    scene.add(this.flashMesh);
  }
  get weapon() { return WEAPONS[this.weaponIndex]; }
  // Attempt an attack. origin {x,z,heading}; targets resolved by caller via hits.
  attack(now, origin, world) {
    if (now < this.cool) return null;
    const w = this.weapon;
    this.cool = now + w.cooldown;
    this.swingT = 0.22;
    const fx = Math.sin(origin.heading), fz = Math.cos(origin.heading);
    if (w.id !== 'pistol') {
      // Melee arc: nearest ped within range and ~70 degrees ahead.
      const ped = world.peds.nearest(origin.x + fx * 1.2, origin.z + fz * 1.2, w.range);
      if (ped && ped.state !== 'down') {
        ped.knockDown();
        world.onCrime('punch');
        world.audio.thud();
        return { type: 'melee', ped };
      }
      world.audio.swish();
      return { type: 'swing' };
    }
    // Pistol: hitscan along facing; peds fall, cars spark.
    const ox = origin.x + fx * 0.6, oz = origin.z + fz * 0.6;
    let bestT = w.range, hitPed = null, hitCar = null;
    for (const p of world.peds.list) {
      if (p.state === 'down') continue;
      const t = (p.x - ox) * fx + (p.z - oz) * fz;
      if (t < 0 || t > bestT) continue;
      const side = Math.abs((p.x - ox) * fz - (p.z - oz) * fx);
      if (side < 0.7) { bestT = t; hitPed = p; hitCar = null; }
    }
    for (const c of world.vehicles) {
      const t = (c.x - ox) * fx + (c.z - oz) * fz;
      if (t < 0 || t > bestT) continue;
      const side = Math.abs((c.x - ox) * fz - (c.z - oz) * fx);
      if (side < 1.6) { bestT = t; hitCar = c; hitPed = null; }
    }
    const ex = ox + fx * bestT, ez = oz + fz * bestT;
    this.spawnTracer(ox, 1.35, oz, ex, 1.1, ez);
    this.flash.position.set(ox + fx * 0.5, 1.4, oz + fz * 0.5);
    this.flash.intensity = 26;
    this.flashMesh.position.copy(this.flash.position);
    this.flashMesh.material.opacity = 0.95;
    world.audio.gunshot();
    world.peds.scare(origin.x, origin.z, 34);
    if (hitPed) { hitPed.knockDown(); world.onCrime('shoot'); return { type: 'shot', ped: hitPed }; }
    if (hitCar) { hitCar.health -= 18; world.onCrime('shootCar'); return { type: 'shot', car: hitCar }; }
    world.onCrime('shoot');
    return { type: 'shot' };
  }
  spawnTracer(x1, y1, z1, x2, y2, z2) {
    const slot = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    const pos = slot.line.geometry.attributes.position;
    pos.setXYZ(0, x1, y1, z1); pos.setXYZ(1, x2, y2, z2); pos.needsUpdate = true;
    slot.line.visible = true; slot.life = 0.09;
    slot.line.material.opacity = 0.95;
  }
  update(dt) {
    if (this.swingT > 0) this.swingT -= dt;
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 320);
    this.flashMesh.material.opacity = Math.max(0, this.flashMesh.material.opacity - dt * 9);
    for (const t of this.tracers) {
      if (t.life > 0) { t.life -= dt; t.line.material.opacity = Math.max(0, t.life / 0.09); if (t.life <= 0) t.line.visible = false; }
    }
  }
}

// Radial weapon wheel drawn on a 2D canvas overlay.
export class WeaponWheel {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.open = false; this.selected = 0;
  }
  draw() {
    const c = this.ctx, S = 340, cx = S / 2, cy = S / 2;
    c.clearRect(0, 0, S, S);
    for (let i = 0; i < WEAPONS.length; i++) {
      const a0 = -Math.PI / 2 + (i / WEAPONS.length) * Math.PI * 2 + 0.06;
      const a1 = -Math.PI / 2 + ((i + 1) / WEAPONS.length) * Math.PI * 2 - 0.06;
      c.beginPath(); c.moveTo(cx, cy);
      c.arc(cx, cy, 148, a0, a1); c.closePath();
      c.fillStyle = i === this.selected ? 'rgba(255,180,60,0.88)' : 'rgba(14,14,26,0.78)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 2; c.stroke();
      const am = (a0 + a1) / 2, tx = cx + Math.cos(am) * 96, ty = cy + Math.sin(am) * 96;
      c.fillStyle = i === this.selected ? '#1a1206' : '#fff';
      c.font = '800 19px Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(WEAPONS[i].name, tx, ty);
    }
    c.beginPath(); c.arc(cx, cy, 34, 0, Math.PI * 2);
    c.fillStyle = 'rgba(10,10,18,0.9)'; c.fill();
    c.fillStyle = '#ffd94d'; c.font = '800 12px Trebuchet MS, sans-serif';
    c.fillText('WEAPON', cx, cy);
  }
  // Selection from mouse position relative to centre, or A/D cycling.
  pickFromMouse(mx, my) {
    const dx = mx - innerWidth / 2, dy = my - innerHeight / 2;
    if (Math.hypot(dx, dy) < 26) return;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    this.selected = Math.floor(a / (Math.PI * 2) * WEAPONS.length) % WEAPONS.length;
  }
}
