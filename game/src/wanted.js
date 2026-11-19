// wanted.js — the wanted system: crimes add heat, heat maps to 0-5 stars,
// and stars decay over time (faster while police are far / Ray is unseen).

export const CRIMES = {
  stealCar: { heat: 26, label: 'Vehicle theft' },
  hitCar: { heat: 7, label: 'Hit and run' },
  hitPed: { heat: 30, label: 'Pedestrian down' },
  punch: { heat: 14, label: 'Assault' },
  shoot: { heat: 22, label: 'Shots fired' },
  shootCar: { heat: 18, label: 'Shooting a vehicle' },
  missionHeat: { heat: 55, label: 'Mission heat' },
};

export class Wanted {
  constructor() {
    this.heat = 0; this.decayDelay = 0; this.seen = false;
    this.lastCrime = '';
  }
  get stars() {
    if (this.heat <= 0) return 0;
    return Math.min(5, 1 + Math.floor(this.heat / 34));
  }
  report(kind) {
    const c = CRIMES[kind]; if (!c) return;
    this.heat = Math.min(170, this.heat + c.heat);
    this.decayDelay = 7;
    this.lastCrime = c.label;
  }
  // policeNear: any officer within sight range; hidden: out of their view.
  update(dt, policeNear) {
    this.seen = policeNear && this.stars > 0;
    if (this.decayDelay > 0) { this.decayDelay -= dt; return; }
    if (this.heat > 0) {
      const rate = policeNear ? 0.55 : 2.6; // lying low cools heat much faster
      this.heat = Math.max(0, this.heat - rate * dt);
    }
  }
  clear() { this.heat = 0; this.decayDelay = 0; }
  get stateLabel() {
    if (this.stars === 0) return '';
    return this.seen ? 'PURSUIT' : 'EVADING';
  }
}
