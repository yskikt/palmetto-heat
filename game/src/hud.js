// hud.js — all DOM HUD: money/health/stars, wanted indicator (blinking stars,
// red/blue edge flash scaled by police distance, SPOTTED/PURSUIT/EVADING),
// objective banner with distance + bearing arrow, mission detail panel,
// prompts/toasts, BUSTED overlay, and the canvas minimap (roads, route line,
// player arrow, mission marker, blinking police blips).

import { NS_ROADS, ALL_EW } from './roads.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.money = $('money'); this.health = $('health'); this.stars = $('stars');
    this.wantedState = $('wantedState'); this.objTitle = $('objTitle'); this.objArrow = $('objArrow');
    this.speed = $('speed'); this.radio = $('radio'); this.weaponLabel = $('weaponLabel');
    this.prompt = $('prompt'); this.toast = $('toast'); this.busted = $('busted');
    this.panel = $('missionPanel'); this.vignette = $('vignette');
    this.minimap = $('minimap').getContext('2d');
    this.panelT = 0; this.toastT = 0;
  }
  setMoney(n) { this.money.textContent = '$' + n.toLocaleString('en-US'); }
  setHealth(frac) { this.health.style.width = Math.max(0, Math.min(100, frac * 100)) + '%'; }
  showPrompt(text) {
    if (text) { this.prompt.textContent = text; this.prompt.classList.remove('hidden'); }
    else this.prompt.classList.add('hidden');
  }
  showToast(text, seconds = 3) { this.toast.textContent = text; this.toast.style.display = 'block'; this.toastT = seconds; }
  showMissionPanel(def) {
    $('mpTitle').textContent = def.title;
    $('mpStory').textContent = def.story;
    $('mpGoal').textContent = def.stages.map((s) => s.label).join('  →  ');
    $('mpReward').textContent = 'Reward: $' + def.reward.toLocaleString('en-US');
    this.panel.style.display = 'block'; this.panelT = 9;
  }
  showBusted(show) { this.busted.style.display = show ? 'flex' : 'none'; }

  update(dt, s) {
    if (this.panelT > 0) { this.panelT -= dt; if (this.panelT <= 0) this.panel.style.display = 'none'; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.style.display = 'none'; }
    // Stars: filled ones blink while police have eyes on Ray.
    const blink = s.wanted.seen && Math.sin(s.time * 6) > 0;
    let html = '';
    for (let i = 0; i < 5; i++) {
      if (i < s.wanted.stars) html += `<span class="${blink ? 'off' : 'on'}">★</span>`;
      else html += '<span class="off">★</span>';
    }
    this.stars.innerHTML = html;
    this.wantedState.textContent = s.wanted.stars > 0
      ? (s.wanted.seen ? '● SPOTTED — PURSUIT' : 'EVADING') : '';
    this.wantedState.style.color = s.wanted.seen ? '#ff8080' : '#ffd94d';
    // Red/blue edge flash, stronger as the nearest cruiser closes in.
    if (s.wanted.stars > 0 && s.policeDist < 90) {
      const inten = Math.max(0.06, 0.5 - s.policeDist * 0.0045);
      const phase = Math.sin(s.time * 7) > 0;
      const col = phase ? `rgba(255,40,40,${inten})` : `rgba(50,90,255,${inten})`;
      this.vignette.style.opacity = '1';
      this.vignette.style.background = `radial-gradient(ellipse at center, transparent 52%, ${col} 100%)`;
    } else this.vignette.style.opacity = '0';
    // Objective banner.
    if (s.objective) {
      let txt = s.objective.label;
      if (s.objective.distance !== undefined) txt += ` — ${Math.round(s.objective.distance)} m`;
      this.objTitle.textContent = txt;
      if (s.objective.arrow) this.objArrow.textContent = ' ' + s.objective.arrow;
      else this.objArrow.textContent = '';
    }
    this.speed.textContent = s.inCar ? `${Math.round(Math.abs(s.speed) * 3.6)} km/h` : '';
    this.radio.textContent = s.inCar && s.stationName
      ? `♪ ${s.stationName}${s.trackName ? ' — ' + s.trackName : ''}` : '';
    this.weaponLabel.textContent = s.weaponName ? `Weapon: ${s.weaponName}` : '';
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const c = this.minimap, S = 212, range = 330;
    const px = s.focus.x, pz = s.focus.z;
    const X = (wx) => S / 2 + (wx - px) / range * S;
    const Z = (wz) => S / 2 + (wz - pz) / range * S;
    c.fillStyle = '#20303e'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#17a2a8'; c.fillRect(0, Z(252), S, S - Z(252)); // sea
    c.fillStyle = '#eed9a4'; c.fillRect(0, Z(218), S, Z(252) - Z(218)); // beach
    c.strokeStyle = '#4a5560'; c.lineWidth = 3;
    for (const x of NS_ROADS) { c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), S); c.stroke(); }
    for (const z of ALL_EW) { c.beginPath(); c.moveTo(0, Z(z)); c.lineTo(S, Z(z)); c.stroke(); }
    // Route line along the grid.
    if (s.route && s.route.length > 1) {
      c.strokeStyle = '#ffd94d'; c.lineWidth = 2.5; c.beginPath();
      s.route.forEach((p, i) => { if (i === 0) c.moveTo(X(p.x), Z(p.z)); else c.lineTo(X(p.x), Z(p.z)); });
      c.stroke();
    }
    // Mission target.
    if (s.target) {
      c.fillStyle = '#ffd94d';
      c.beginPath(); c.arc(X(s.target.x), Z(s.target.z), 5 + Math.sin(s.time * 4) * 1.2, 0, Math.PI * 2); c.fill();
    }
    // Police blips blink red/blue.
    if (s.police) {
      const on = Math.sin(s.time * 7) > 0;
      c.fillStyle = on ? '#ff4040' : '#4488ff';
      for (const car of s.police) {
        const x = X(car.x), z = Z(car.z);
        if (x < -6 || z < -6 || x > S + 6 || z > S + 6) continue;
        c.beginPath(); c.arc(x, z, 3.6, 0, Math.PI * 2); c.fill();
      }
    }
    // Player arrow (heading up = facing direction rotated to map north).
    c.save(); c.translate(S / 2, S / 2); c.rotate(Math.atan2(Math.sin(s.heading), Math.cos(s.heading)) * 0 + (-s.heading + Math.PI));
    // Simpler: draw arrow pointing by heading in world axes.
    c.restore();
    c.save(); c.translate(S / 2, S / 2);
    const a = Math.atan2(Math.sin(s.heading), -Math.cos(s.heading));
    c.rotate(a);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1; c.strokeRect(0, 0, S, S);
  }
}

// Bearing arrow (8-way) from camera heading to a target.
export function bearingArrow(camHeading, from, to) {
  const world = Math.atan2(to.x - from.x, to.z - from.z);
  let rel = world - camHeading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const idx = Math.round(((rel + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return arrows[idx];
}
