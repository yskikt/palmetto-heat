// traffic.js — traffic AI: cars follow right-hand lanes along the grid, stop
// at red signals and behind the car ahead, turn at intersections, plus a set
// of parked cars that double as stealable vehicles.

import { Car, randomCarColor } from './car.js';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z, ALL_EW, LANE, signalState, WORLD } from './roads.js';
import { mulberry32 } from './layout.js';

const rng = mulberry32(777);

export class TrafficCar extends Car {
  constructor(scene, x, z, axis, dirSign, roadFixed) {
    super(scene, x, z, 0, randomCarColor(rng), { maxSpeed: 13 + rng() * 4, accel: 9 });
    this.axis = axis; this.dir = dirSign; this.fixed = roadFixed;
    this.setHeadingFromAxis();
    this.maxSpeedCruise = this.maxSpeed;
  }
  setHeadingFromAxis() {
    // heading: 0 faces +z, PI/2 faces +x (mesh forward is +z rotated by heading)
    if (this.axis === 'x') this.heading = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    else this.heading = this.dir > 0 ? 0 : Math.PI;
    this.syncMesh();
  }
  laneCoord() { return this.fixed + (this.axis === 'x' ? -this.dir * LANE : this.dir * LANE); }
}

export class Traffic {
  constructor(scene) {
    this.cars = [];
    this.parked = [];
    // Moving traffic: a mix on NS avenues and EW streets + the boulevard.
    const spawns = [];
    for (let i = 0; i < 9; i++) {
      const road = NS_ROADS[Math.floor(rng() * NS_ROADS.length)];
      spawns.push({ axis: 'z', fixed: road, dir: rng() < 0.5 ? 1 : -1, along: -260 + rng() * 460 });
    }
    for (let i = 0; i < 8; i++) {
      const road = ALL_EW[Math.floor(rng() * ALL_EW.length)];
      spawns.push({ axis: 'x', fixed: road, dir: rng() < 0.5 ? 1 : -1, along: -480 + rng() * 960 });
    }
    for (const s of spawns) {
      const lane = s.fixed + (s.axis === 'x' ? -s.dir * LANE : s.dir * LANE);
      const x = s.axis === 'x' ? s.along : lane;
      const z = s.axis === 'x' ? lane : s.along;
      this.cars.push(new TrafficCar(scene, x, z, s.axis, s.dir, s.fixed));
    }
    // Parked cars along kerbs (stealable).
    const parkSpots = [
      [-41, 120, 0], [59, -96, Math.PI], [-141, 60, 0], [159, 168, Math.PI],
      [-259, -120, 0], [241, 30, Math.PI], [-359, 96, 0], [341, -160, Math.PI],
      [-59, 224, Math.PI / 2], [41, 224, Math.PI / 2], [-161, 224, Math.PI / 2],
      [459, 120, 0], [-449, -60, Math.PI], [151, -224, 0],
    ];
    for (const [x, z, h] of parkSpots) {
      const c = new Car(scene, x, z, h, randomCarColor(rng), { parked: true });
      this.parked.push(c);
    }
  }
  allVehicles() { return [...this.cars, ...this.parked]; }

  update(dt, t, focus) {
    for (const car of this.cars) {
      // Despawn far / respawn near the focus so streets near Ray stay alive.
      const along = car.axis === 'x' ? car.x : car.z;
      const limit = car.axis === 'x' ? 520 : 300;
      if (Math.abs(along) > limit || Math.hypot(car.x - focus.x, car.z - focus.z) > 620) {
        this.respawn(car, focus); continue;
      }
      let throttle = 1, brake = false;
      // Signal check: next intersection ahead.
      const stopDist = this.distanceToRedLight(car, t);
      if (stopDist !== null && stopDist < 16) { throttle = 0; brake = car.speed > 0.5; if (stopDist < 7) car.speed = Math.min(car.speed, Math.max(0, (stopDist - 4))); }
      // Follow the car ahead (same lane-ish).
      for (const other of this.cars) {
        if (other === car) continue;
        const gap = this.gapAhead(car, other);
        if (gap !== null && gap < 11) { throttle = 0; brake = car.speed > other.speed + 0.5; if (gap < 6) car.speed = Math.min(car.speed, other.speed); }
      }
      // Also respect the player's car when it is in the lane.
      if (focus.car) {
        const gap = this.gapAhead(car, focus.car);
        if (gap !== null && gap < 10) { throttle = 0; brake = true; }
      }
      const cruise = stopDist !== null && stopDist < 30 ? car.maxSpeedCruise * 0.5 : car.maxSpeedCruise;
      const savedMax = car.maxSpeed; car.maxSpeed = cruise;
      car.drive(dt, { throttle, steer: 0, brake }, false);
      car.maxSpeed = savedMax;
      // Keep the car glued to its lane centre and maybe turn at intersections.
      this.steerToLane(car, dt);
    }
  }
  gapAhead(car, other) {
    const dx = other.x - car.x, dz = other.z - car.z;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 16 && side < 2.2) return ahead;
    return null;
  }
  distanceToRedLight(car, t) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const roads = car.axis === 'z' ? ALL_EW : NS_ROADS;
    let best = null;
    for (const r of roads) {
      const ix = car.axis === 'z' ? car.fixed : r;
      const iz = car.axis === 'z' ? r : car.fixed;
      const dx = ix - car.x, dz = iz - car.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 2 || ahead > 40) continue;
      const st = signalState(ix, iz, t);
      const mine = car.axis === 'z' ? st.ns : st.ew;
      if (mine !== 'green' && (best === null || ahead < best)) best = ahead;
    }
    return best;
  }
  steerToLane(car, dt) {
    const lane = car.laneCoord();
    if (car.axis === 'x') {
      car.z += (lane - car.z) * Math.min(1, dt * 3);
      // At an NS avenue, sometimes turn onto it.
      for (const rx of NS_ROADS) {
        if (Math.abs(car.x - rx) < 1.2 && Math.abs(car.z - car.fixed) < 9 && rng() < 0.006) {
          car.axis = 'z'; car.fixed = rx; car.dir = rng() < 0.5 ? 1 : -1; car.setHeadingFromAxis(); return;
        }
      }
    } else {
      car.x += (lane - car.x) * Math.min(1, dt * 3);
      for (const rz of ALL_EW) {
        if (Math.abs(car.z - rz) < 1.2 && Math.abs(car.x - car.fixed) < 9 && rng() < 0.006) {
          car.axis = 'x'; car.fixed = rz; car.dir = rng() < 0.5 ? 1 : -1; car.setHeadingFromAxis(); return;
        }
      }
    }
    car.syncMesh();
  }
  respawn(car, focus) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    car.axis = axis; car.dir = rng() < 0.5 ? 1 : -1;
    car.fixed = axis === 'x' ? ALL_EW[Math.floor(rng() * ALL_EW.length)] : NS_ROADS[Math.floor(rng() * NS_ROADS.length)];
    const lane = car.laneCoord();
    if (axis === 'x') { car.x = focus.x + (car.dir > 0 ? -380 : 380); car.z = lane; }
    else { car.z = focus.z + (car.dir > 0 ? -300 : 300); car.x = lane; }
    car.x = Math.max(WORLD.xMin + 10, Math.min(WORLD.xMax - 10, car.x));
    car.z = Math.max(WORLD.zMin + 10, Math.min(WORLD.zMax - 10, car.z));
    car.speed = 6; car.setHeadingFromAxis();
  }
}
