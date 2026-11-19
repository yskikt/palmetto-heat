// save.js — localStorage save: money, story progress, delivery count,
// best escape. Survives reloads; corrupt data falls back to a fresh save.

const KEY = 'palmetto-heat-save-v1';

export class Save {
  constructor() {
    this.data = { money: 120, story: 0, deliveries: 0, busts: 0 };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch { /* private mode / corrupt JSON: keep defaults */ }
  }
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
  addMoney(n) { this.data.money += n; this.write(); }
}
