// main.js — PALMETTO HEAT entry point: renderer, title screen, mode switching
// (on foot / driving), follow camera, the game loop wiring every system
// together, BUSTED flow, and the deterministic ?shot= modes used to capture
// the submission screenshots (window.__shotReady signals capture readiness).

import * as THREE from 'three';
import { buildCity, updateSignalHeads } from './city.js';
import { signalState, BOULEVARD_Z, LANE } from './roads.js';
import { SPAWN } from './layout.js';
import { Car } from './car.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Traffic } from './traffic.js';
import { Peds } from './peds.js';
import { Wanted } from './wanted.js';
import { Police, PoliceCar } from './police.js';
import { Combat, WeaponWheel, WEAPONS } from './combat.js';
import { Missions } from './missions.js';
import { Save } from './save.js';
import { GameAudio } from './audio.js';
import { Hud, bearingArrow } from './hud.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 4000);
buildCity(scene);

const save = new Save();
const hud = new Hud();
const input = new Input(canvas);
const audio = new GameAudio();
const player = new Player(scene);
player.place(SPAWN.x, SPAWN.z, 0);
const traffic = new Traffic(scene);
const peds = new Peds(scene, 26);
const wanted = new Wanted();
const police = new Police(scene);
const combat = new Combat(scene);
const missions = new Missions(scene, save);
const wheel = new WeaponWheel(document.getElementById('wheel'));
const wheelCanvas = document.getElementById('wheel');

// Ray's own starter car (never counts as stolen).
const ownCar = new Car(scene, -38, 176, Math.PI / 2, 0xe8452c, { maxSpeed: 36, accel: 17 });
let playerCar = null; // car Ray currently drives
let lastStolenCar = null;
let health = 100;
let camYaw = 0, camPitch = 0.32;
let started = false;
let bustTimer = 0;
let crimeThrottle = 0;
let timeScale = 1;
let elapsed = 0;
let shotMode = null;
let shotFrames = 0;

const params = new URLSearchParams(location.search);
shotMode = params.get('shot');

function focusPos() {
  return playerCar ? { x: playerCar.x, z: playerCar.z } : { x: player.x, z: player.z };
}
function focusSpeed() { return playerCar ? Math.abs(playerCar.speed) : player.speedNow; }

const world = {
  peds,
  get vehicles() { return [...traffic.allVehicles(), ...police.cars, ...(playerCar ? [] : [ownCar])]; },
  audio,
  onCrime(kind) { wanted.report(kind); },
};

function nearestVehicle(x, z, maxD) {
  let best = null, bd = maxD;
  for (const c of [ownCar, ...traffic.allVehicles()]) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function startGame() {
  if (started) return;
  started = true;
  document.getElementById('title').classList.add('hidden');
  audio.ensure();
  hud.setMoney(save.data.money);
  hud.showToast('Press M to take a job — first up: FIRST RUN', 5);
}

function enterCar(car) {
  playerCar = car;
  car.occupied = true;
  player.mesh.visible = false;
  if (car !== ownCar && car !== lastStolenCar) {
    wanted.report('stealCar');
    lastStolenCar = car;
    hud.showToast('Vehicle stolen — heat rising', 2.5);
  }
  camYaw = car.heading;
}
function exitCar() {
  if (!playerCar) return;
  const c = playerCar; playerCar = null; c.occupied = false;
  player.place(c.x + Math.cos(c.heading) * 2.2, c.z - Math.sin(c.heading) * 2.2, c.heading);
  player.mesh.visible = true;
}

function doBusted() {
  bustTimer = 2.4;
  hud.showBusted(true);
  audio.bustedJingle();
  const fine = 120 + wanted.stars * 90;
  save.addMoney(-fine);
  save.data.busts++; save.write();
  wanted.clear();
  exitCar();
  player.place(SPAWN.x, SPAWN.z, 0);
  health = Math.max(health, 60);
}

// ---- Shot setups (deterministic compositions for screenshots) ----------
function setupShot(mode) {
  started = true;
  document.getElementById('title').classList.add('hidden');
  hud.setMoney(save.data.money);
  if (mode === 'hero') {
    ownCar.x = -150; ownCar.z = BOULEVARD_Z - LANE; ownCar.heading = Math.PI / 2; ownCar.speed = 13; ownCar.syncMesh();
    enterCar(ownCar); lastStolenCar = ownCar;
    missions.startNext();
    camYaw = Math.PI / 2; camPitch = 0.3;
  } else if (mode === 'foot') {
    player.place(-43, -38, Math.PI * 0.75);
    player.setWeapon('bat');
    combat.weaponIndex = 1;
    wheel.selected = 1; wheel.open = true;
    wheelCanvas.style.display = 'block'; wheel.draw();
    camYaw = Math.PI * 0.75; camPitch = 0.16;
  } else if (mode === 'chase') {
    ownCar.x = 46; ownCar.z = -50 - LANE; ownCar.heading = Math.PI / 2; ownCar.speed = 15; ownCar.maxSpeed = 17; ownCar.syncMesh();
    enterCar(ownCar); lastStolenCar = ownCar;
    wanted.heat = 100; wanted.decayDelay = 30; // 3 stars
  } else if (mode === 'mission') {
    missions.startNext();
    hud.showMissionPanel(missions.active.def);
    ownCar.x = 436; ownCar.z = 100; ownCar.heading = Math.PI / 2; ownCar.speed = 0; ownCar.syncMesh();
    enterCar(ownCar); lastStolenCar = ownCar;
    camYaw = Math.PI / 2; camPitch = 0.36;
  }
  if (mode === 'chase') {
    // Spawn two cruisers right behind Ray (class imported via police module).
    spawnShotPolice();
  }
}
function spawnShotPolice() {
  const a = new PoliceCar(scene, 38, -53.4); a.heading = Math.PI / 2; a.speed = 17; a.syncMesh();
  const b = new PoliceCar(scene, 34.5, -56.5); b.heading = Math.PI / 2; b.speed = 17; b.syncMesh();
  police.cars.push(a, b);
}

if (shotMode) setupShot(shotMode);
document.getElementById('title').addEventListener('click', startGame);
addEventListener('keydown', (e) => { if (e.code === 'Enter') startGame(); });

// ---- Main loop -----------------------------------------------------------
const clock = new THREE.Clock();
let titleAngle = 0;

function frame() {
  requestAnimationFrame(frame);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  // Weapon wheel slow motion.
  const wheelActive = wheel.open;
  timeScale = wheelActive ? 0.12 : 1;
  const dt = rawDt * timeScale;
  elapsed += dt;
  const t = elapsed;

  if (!started) {
    // Title: slow orbit over downtown toward the boulevard.
    titleAngle += rawDt * 0.05;
    const cx = Math.sin(titleAngle) * 120, cz = 60 + Math.cos(titleAngle) * 90;
    camera.position.set(cx, 42, cz);
    camera.lookAt(0, 6, 40);
    renderer.render(scene, camera);
    return;
  }

  const focus = focusPos();
  crimeThrottle -= dt;

  // --- Weapon wheel: Tab hold opens (release closes), Q toggles. ---
  const openWheel = () => { wheel.open = true; wheel.selected = combat.weaponIndex; wheelCanvas.style.display = 'block'; };
  const closeWheel = () => {
    if (!wheel.open) return;
    wheel.open = false; wheelCanvas.style.display = 'none';
    combat.weaponIndex = wheel.selected;
    player.setWeapon(WEAPONS[wheel.selected].id);
  };
  if (!shotMode) {
    const tabHeld = input.down('Tab');
    if (tabHeld && !wheel.open) openWheel();
    if (!tabHeld && wheel.open && wheel._viaTab) { closeWheel(); wheel._viaTab = false; }
    if (tabHeld) wheel._viaTab = true;
    if (input.take('KeyQ')) { if (wheel.open) { closeWheel(); wheel._viaTab = false; } else openWheel(); }
    if (wheel.open) {
      wheel.pickFromMouse(input.mouseX, input.mouseY);
      if (input.take('KeyA')) wheel.selected = (wheel.selected + WEAPONS.length - 1) % WEAPONS.length;
      if (input.take('KeyD')) wheel.selected = (wheel.selected + 1) % WEAPONS.length;
      wheel.draw();
    }
  }

  // --- Driving / walking ---
  const drag = input.consumeDrag();
  if (drag.x || drag.y) { camYaw -= drag.x * 0.0025; camPitch = Math.max(0.06, Math.min(1.1, camPitch + drag.y * 0.002)); }

  let prompt = '';
  if (bustTimer > 0) {
    bustTimer -= rawDt;
    if (bustTimer <= 0) hud.showBusted(false);
  } else if (playerCar) {
    const mv = input.moveVector();
    const autoDrive = shotMode === 'hero' || shotMode === 'chase';
    playerCar.drive(dt, {
      throttle: autoDrive ? 1 : mv.z < 0 ? 1 : mv.z > 0 ? -1 : 0,
      steer: autoDrive ? 0 : mv.x,
      brake: !autoDrive && input.down('Space'),
    }, true);
    if (input.take('KeyR')) { const st = audio.cycleStation(); hud.showToast(`♪ ${st.name}`, 2); }
    if (input.take('KeyE')) exitCar();
    camYaw += (playerCar.heading - camYaw) * Math.min(1, dt * 1.6) * (Math.abs(playerCar.speed) > 3 ? 1 : 0);
    // Running down a pedestrian in the car.
    const ped = peds.nearest(playerCar.x, playerCar.z, 2.4);
    if (ped && Math.abs(playerCar.speed) > 4 && ped.state !== 'down') {
      ped.knockDown(); playerCar.speed *= 0.55;
      if (crimeThrottle <= 0) { wanted.report('hitPed'); crimeThrottle = 1.2; }
      audio.thud();
    }
    // Trading paint with other cars.
    for (const other of traffic.allVehicles()) {
      const d = Math.hypot(other.x - playerCar.x, other.z - playerCar.z);
      if (d < 3.1 && Math.abs(playerCar.speed) > 5) {
        playerCar.speed *= 0.5; other.speed = Math.max(other.speed || 0, 4);
        health -= 3;
        if (crimeThrottle <= 0) { wanted.report('hitCar'); crimeThrottle = 1.5; }
        audio.thud();
      }
    }
  } else {
    // On foot: camera-relative movement. Camera forward F = (sin(camYaw),
    // cos(camYaw)); screen-right R = (-cos(camYaw), sin(camYaw)).
    const mv = input.moveVector();
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const wish = {
      x: fx * -mv.z + -Math.cos(camYaw) * mv.x,
      z: fz * -mv.z + Math.sin(camYaw) * mv.x,
    };
    player.move(dt, wish, input.down('ShiftLeft', 'ShiftRight'));
    // Attack.
    if ((input.takeClick() || input.take('KeyF')) && !wheel.open) {
      combat.attack(t, { x: player.x, z: player.z, heading: player.heading }, world);
      player.armR.rotation.x = -1.9;
    }
    const near = nearestVehicle(player.x, player.z, 3.4);
    if (near) {
      prompt = near === ownCar ? 'E — Get in your car' : 'E — Steal car';
      if (input.take('KeyE')) enterCar(near);
    }
    health = Math.min(100, health + dt * 1.2);
  }

  // --- Missions ---
  if (input.take('KeyM')) {
    const def = missions.startNext();
    if (def) { hud.showMissionPanel(def); hud.showToast(`New job: ${def.title}`, 3); }
    else if (missions.active) hud.showToast('Finish the current job first', 2);
  }
  const mEvents = missions.update(dt, focus, wanted, t);
  if (mEvents.completed) {
    save.addMoney(mEvents.completed.reward);
    audio.cash();
    hud.showToast(`${mEvents.completed.title} complete — +$${mEvents.completed.reward}`, 4);
  } else if (mEvents.arrived) hud.showToast(`Next: ${mEvents.arrived.label}`, 3);
  else if (mEvents.blocked && crimeThrottle <= 0) { hud.showToast(mEvents.blocked, 2); crimeThrottle = 3; }

  // --- World systems ---
  traffic.update(dt, t, { x: focus.x, z: focus.z, car: playerCar });
  const threats = [...traffic.cars.map((c) => ({ x: c.x, z: c.z, speed: c.speed })), ...(playerCar ? [{ x: playerCar.x, z: playerCar.z, speed: playerCar.speed }] : [])];
  peds.update(dt, threats);
  const policeState = police.update(dt, t, { x: focus.x, z: focus.z, inCar: !!playerCar, speed: focusSpeed(), car: playerCar }, wanted);
  wanted.update(dt, policeState.anyNear);
  if (policeState.bust >= 1 && bustTimer <= 0) doBusted();
  combat.update(dt);
  updateSignalHeads(scene, signalState, t);
  // Sea shimmer + sun shadow follows the focus.
  const sea = scene.userData.sea;
  if (sea) sea.position.y = 0.12 + Math.sin(t * 0.7) * 0.05;
  const sun = scene.userData.sun;
  if (sun) { sun.position.set(focus.x + 300, 330, focus.z + 430); sun.target.position.set(focus.x, 0, focus.z); }

  // Radio + audio state.
  audio.update(rawDt, { inCar: !!playerCar, speed: playerCar ? playerCar.speed : 0, stars: wanted.stars, policeDist: police.nearestDistance(focus.x, focus.z) });

  // --- Camera ---
  const dist = playerCar ? 10.5 : 7.2;
  const height = playerCar ? 3.6 : 2.6;
  const back = { x: Math.sin(camYaw + Math.PI), z: Math.cos(camYaw + Math.PI) };
  const desired = {
    x: focus.x + back.x * dist * Math.cos(camPitch),
    y: height + Math.sin(camPitch) * dist * 0.7,
    z: focus.z + back.z * dist * Math.cos(camPitch),
  };
  if (shotMode === 'hero') { desired.x = focus.x - 11; desired.y = 3.4; desired.z = focus.z + 5.5; }
  if (shotMode === 'chase') { desired.x = focus.x - 13; desired.y = 4.2; desired.z = focus.z + 7; }
  camera.position.lerp(new THREE.Vector3(desired.x, Math.max(1.2, desired.y), desired.z), shotMode ? 1 : Math.min(1, rawDt * 5));
  camera.lookAt(focus.x, 1.4, focus.z);

  // --- HUD ---
  const stage = missions.stage;
  const route = missions.route(focus);
  let objective = null;
  if (stage) {
    const d = Math.hypot(stage.x - focus.x, stage.z - focus.z);
    objective = { label: `${missions.active.def.title}: ${stage.label}`, distance: d, arrow: bearingArrow(camYaw, focus, stage) };
  } else objective = { label: missions.available() ? 'Press M — new job available' : 'Free roam — press M for a delivery' };
  hud.setMoney(save.data.money);
  hud.setHealth(health / 100);
  hud.showPrompt(prompt);
  hud.update(rawDt, {
    time: t, wanted: { stars: wanted.stars, seen: wanted.seen },
    policeDist: police.nearestDistance(focus.x, focus.z),
    objective, inCar: !!playerCar, speed: playerCar ? playerCar.speed : 0,
    stationName: audio.station.id !== 'off' ? audio.station.name : '',
    trackName: audio.currentTrack(),
    weaponName: WEAPONS[combat.weaponIndex].name,
    focus, heading: playerCar ? playerCar.heading : player.heading,
    route, target: missions.target, police: police.cars,
  });

  renderer.render(scene, camera);

  if (shotMode) {
    shotFrames++;
    if (shotFrames > 45) window.__shotReady = true;
  }
}
frame();
