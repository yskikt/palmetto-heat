// missions.js — story arc of three jobs plus repeatable deliveries.
// Each stage drops a golden beacon pillar, tracks distance/bearing for the
// objective banner, and draws a Manhattan route on the minimap.

import * as THREE from 'three';
import { gridRoute } from './roads.js';

export const STORY = [
  {
    id: 'first-run', title: 'FIRST RUN', reward: 450,
    story: 'Ray owes the dock crews. A sealed crate waits at the port — pick it up and bring it downtown, clean and quiet.',
    stages: [
      { x: 470, z: 120, label: 'Pick up the crate at the port', radius: 9 },
      { x: -52, z: -52, label: 'Deliver it downtown', radius: 10 },
    ],
  },
  {
    id: 'the-set-up', title: 'THE SET-UP', reward: 900,
    story: 'The buyer wants to meet behind the port warehouses. It smells wrong — but the money clears half the debt.',
    stages: [
      { x: 428, z: 190, label: 'Meet the buyer at the port', radius: 9, heat: true },
      { x: -250, z: -150, label: 'Lose the heat — reach the safehouse', radius: 11, needCalm: true },
    ],
  },
  {
    id: 'last-heat', title: 'LAST HEAT', reward: 1600,
    story: 'It was a set-up, and now everyone wants Ray. One final run: grab the money car and vanish down the boulevard.',
    stages: [
      { x: 150, z: 52, label: 'Reach the money car downtown', radius: 9 },
      { x: -462, z: 196, label: 'Escape to the west end of the boulevard', radius: 12, heat: true },
    ],
  },
];

const DELIVERY_SPOTS = [
  { x: 250, z: -52 }, { x: -350, z: 52 }, { x: 52, z: -248 }, { x: -152, z: 148 },
  { x: 352, z: -152 }, { x: -48, z: 196 }, { x: 470, z: 90 }, { x: -252, z: -52 },
];

export class Missions {
  constructor(scene, save) {
    this.save = save;
    this.active = null; // {def, stageIndex, delivery}
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 46, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 23;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd94d }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    this.beacon.add(pillar, ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.ring = ring;
  }
  get storyIndex() { return this.save.data.story; }
  available() { return this.storyIndex < STORY.length; }
  startNext() {
    if (this.active) return null;
    if (this.available()) {
      const def = STORY[this.storyIndex];
      this.active = { def, stageIndex: 0, delivery: false };
    } else {
      const spot = DELIVERY_SPOTS[Math.floor(Math.random() * DELIVERY_SPOTS.length)];
      this.active = {
        def: { title: 'QUICK DELIVERY', reward: 180, story: 'Another parcel, another fare. Palmetto Bay never stops moving.', stages: [{ x: spot.x, z: spot.z, label: 'Drop the parcel', radius: 10 }] },
        stageIndex: 0, delivery: true,
      };
    }
    const st = this.stage;
    if (st.heat) this.pendingHeat = true;
    return this.active.def;
  }
  get stage() { return this.active ? this.active.def.stages[this.active.stageIndex] : null; }
  get target() { const s = this.stage; return s ? { x: s.x, z: s.z } : null; }
  route(from) { const t = this.target; return t ? gridRoute(from, t) : null; }
  // Returns events: {arrived, completed, reward} as stages advance.
  update(dt, pos, wanted, t) {
    const events = {};
    const s = this.stage;
    this.beacon.visible = !!s;
    if (!s) return events;
    this.beacon.position.set(s.x, 0, s.z);
    this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
    if (this.pendingHeat) { this.pendingHeat = false; wanted.report('missionHeat'); events.heat = true; }
    const d = Math.hypot(pos.x - s.x, pos.z - s.z);
    events.distance = d;
    if (d < s.radius) {
      if (s.needCalm && wanted.stars > 1) { events.blocked = 'Lose the heat first (stars <= 1)'; return events; }
      this.active.stageIndex++;
      if (this.active.stageIndex >= this.active.def.stages.length) {
        events.completed = this.active.def;
        events.reward = this.active.def.reward;
        if (!this.active.delivery) this.save.data.story++;
        else this.save.data.deliveries++;
        this.save.write();
        this.active = null;
      } else {
        events.arrived = this.stage;
        if (this.stage.heat) this.pendingHeat = true;
      }
    }
    return events;
  }
}
