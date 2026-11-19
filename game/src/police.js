// police.js — police AI: cruisers spawn on side streets scaled by wanted
// stars, chase and box in the target, and build BUSTED pressure when close
// and slow. Light bars strobe red/blue; sirens are handled by audio.js.

import { Car } from './car.js';
import { NS_ROADS, ALL_EW } from './roads.js';

export class PoliceCar extends Car {
  constructor(scene, x, z) {
    super(scene, x, z, 0, 0xf2f4f6, { police: true, maxSpeed: 37, accel: 19 });
    this.bustPressure = 0;
  }
  flash(t) {
    const bar = this.mesh.userData.lightBar; if (!bar) return;
    const on = Math.sin(t * 11 + this.x) > 0;
    bar.red.material.color.setHex(on ? 0xff2222 : 0x551111);
    bar.blue.material.color.setHex(on ? 0x113355 : 0x3388ff);
  }
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.spawnT = 0;
  }
  desiredCount(stars) { return stars <= 0 ? 0 : Math.min(6, 1 + stars); }
  update(dt, t, target, wanted) {
    const stars = wanted.stars;
    const want = this.desiredCount(stars);
    this.spawnT -= dt;
    // Despawn when the heat is gone.
    if (stars === 0) {
      for (const c of this.cars) this.scene.remove(c.mesh);
      this.cars = [];
      return { anyNear: false, bust: 0 };
    }
    if (this.cars.length < want && this.spawnT <= 0) {
      this.spawnT = 2.2;
      this.spawnNear(target);
    }
    if (this.cars.length > want + 2) {
      const c = this.cars.pop(); this.scene.remove(c.mesh);
    }
    let anyNear = false, bust = 0;
    this.cars.forEach((car, i) => {
      car.flash(t);
      const dx = target.x - car.x, dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 90) anyNear = true;
      // Surround: each cruiser aims at a slot around the target.
      const ang = (i / Math.max(1, this.cars.length)) * Math.PI * 2 + t * 0.15;
      const slotR = target.inCar ? 7.5 : 3.4;
      const tx = target.x + Math.sin(ang) * slotR, tz = target.z + Math.cos(ang) * slotR;
      const desired = Math.atan2(tx - car.x, tz - car.z);
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      const slow = dist < 9 && target.speed < 2;
      car.drive(dt, { throttle: slow ? 0 : 1, steer, brake: Math.abs(dh) > 2.4 }, true);
      // BUSTED pressure: a cruiser alongside a slow/on-foot target fills it.
      if (dist < (target.inCar ? 8 : 4.5) && target.speed < 2.2) {
        car.bustPressure = Math.min(1, car.bustPressure + dt / 2.6);
      } else car.bustPressure = Math.max(0, car.bustPressure - dt * 0.8);
      bust = Math.max(bust, car.bustPressure);
      // Ramming a fleeing car nudges it and adds a little damage drama.
      if (target.inCar && dist < 3.4 && Math.abs(car.speed) > 8) {
        target.car.speed *= 0.92;
      }
    });
    return { anyNear, bust };
  }
  spawnNear(target) {
    // Spawn on a grid street 120-170 m away so arrivals feel earned.
    const useNS = Math.random() < 0.5;
    let x, z;
    if (useNS) {
      x = NS_ROADS[Math.floor(Math.random() * NS_ROADS.length)];
      z = target.z + (Math.random() < 0.5 ? -150 : 150);
    } else {
      z = ALL_EW[Math.floor(Math.random() * ALL_EW.length)];
      x = target.x + (Math.random() < 0.5 ? -150 : 150);
    }
    const car = new PoliceCar(this.scene, x, z);
    car.heading = Math.atan2(target.x - x, target.z - z);
    car.syncMesh();
    this.cars.push(car);
  }
  nearestDistance(x, z) {
    let best = 1e9;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.x - x, c.z - z));
    return best;
  }
}
