// audio.js — everything is synthesized with WebAudio (no audio files):
// engine hum tied to speed, police siren, ocean ambience, one-shots, and the
// car radio: 4 generated stations + OFF, each with its own synthesis recipe
// and track titles that rotate every 16 seconds.

export const STATIONS = [
  { id: 'off', name: 'RADIO OFF', tracks: [] },
  { id: 'wave', name: 'PALMETTO WAVE 101.1', style: 'synthwave', tracks: ['Neon Palms — Vector Coast', 'Golden Hour Drive — Ray & The Tides', 'Chrome Sunset — Mira Sol'] },
  { id: 'funk', name: 'FUNK BAY 98.5', style: 'funk', tracks: ['Bay Funk Express — The Dockers', 'Sweat & Seawater — Lola Reef', 'Groove Avenue — Captain C'] },
  { id: 'sol', name: 'SOL RADIO 106.3', style: 'latin', tracks: ['Brisa de la Bahía — Los Faroles', 'Palmera — Niña del Puerto', 'Sol y Sal — Trío Costa'] },
  { id: 'talk', name: 'BAY TALK 760', style: 'talk', tracks: ['Bay Talk Morning — Harbour Report', 'Traffic & Tides — with Sal', 'Bay Talk Nights — Caller Hour'] },
];

const SCALES = { synthwave: [0, 3, 5, 7, 10], funk: [0, 3, 5, 6, 7, 10], latin: [0, 2, 4, 7, 9], talk: [0] };

export class GameAudio {
  constructor() {
    this.ctx = null; this.started = false;
    this.stationIndex = 1; this.trackIndex = 0; this.trackT = 0;
    this.radioOn = false; this.noteT = 0; this.step = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    // Engine: sawtooth + lowpass, pitch follows speed.
    this.engineOsc = ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 50;
    this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    // Siren: triangle LFO between two tones.
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 800;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master); this.sirenOsc.start();
    // Ocean ambience: looped filtered noise, very quiet.
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0); let v = 0;
    for (let i = 0; i < len; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; data[i] = v * 8; }
    this.noise = ctx.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 480;
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = 0.05;
    this.noise.connect(nf).connect(this.noiseGain).connect(this.master); this.noise.start();
    // Radio bus.
    this.radioGain = ctx.createGain(); this.radioGain.gain.value = 0; this.radioGain.connect(this.master);
    this.started = true;
  }
  get station() { return STATIONS[this.stationIndex]; }
  cycleStation() {
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    this.trackIndex = 0; this.trackT = 0; this.step = 0;
    return this.station;
  }
  currentTrack() { const s = this.station; return s.tracks.length ? s.tracks[this.trackIndex % s.tracks.length] : ''; }
  update(dt, state) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Engine.
    const target = state.inCar ? 0.05 + Math.min(0.1, Math.abs(state.speed) * 0.003) : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(46 + Math.abs(state.speed) * 4.4, t, 0.08);
    // Siren.
    const sirenOn = state.stars > 0 && state.policeDist < 130;
    this.sirenGain.gain.setTargetAtTime(sirenOn ? Math.max(0.008, 0.07 - state.policeDist * 0.0004) : 0, t, 0.2);
    if (sirenOn) this.sirenOsc.frequency.setTargetAtTime(760 + Math.sin(t * 2.6) * 190, t, 0.05);
    // Radio only while driving.
    const radioAudible = state.inCar && this.station.id !== 'off';
    this.radioGain.gain.setTargetAtTime(radioAudible ? 0.8 : 0, t, 0.15);
    if (radioAudible) {
      this.trackT += dt;
      if (this.trackT > 16) { this.trackT = 0; this.trackIndex++; }
      this.noteT -= dt;
      if (this.noteT <= 0) { this.playRadioStep(); }
    }
  }
  playRadioStep() {
    const ctx = this.ctx, style = this.station.style;
    const scale = SCALES[style] || SCALES.synthwave;
    const base = style === 'latin' ? 196 : style === 'funk' ? 110 : 130.8;
    const tempo = style === 'talk' ? 0.42 : style === 'latin' ? 0.21 : 0.24;
    this.noteT = tempo;
    const s = this.step++;
    if (style === 'talk') { // speech-like burble: short filtered blips
      if (s % 3 === 0) this.blip(140 + Math.random() * 90, 0.1, 'sawtooth', 0.05);
      return;
    }
    const note = scale[s % scale.length] + (s % 16 >= 12 ? 12 : 0);
    const freq = base * Math.pow(2, note / 12);
    const type = style === 'synthwave' ? 'square' : style === 'funk' ? 'sawtooth' : 'triangle';
    this.blip(freq, tempo * 0.95, type, style === 'funk' ? 0.1 : 0.08, this.radioGain);
    if (s % 4 === 0) this.blip(base / 2, tempo * 1.8, 'sine', 0.14, this.radioGain); // bass
    if (style === 'funk' && s % 2 === 0) this.noiseHit();
  }
  blip(freq, dur, type, vol, dest) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(dest || this.master); o.start(); o.stop(ctx.currentTime + dur);
  }
  noiseHit() {
    const ctx = this.ctx, len = ctx.sampleRate * 0.05, buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(f).connect(g).connect(this.radioGain); src.start();
  }
  gunshot() { if (!this.ctx) return; this.blip(160, 0.16, 'square', 0.2); this.noiseHitMaster(); }
  noiseHitMaster() {
    if (!this.ctx) return;
    const ctx = this.ctx, len = ctx.sampleRate * 0.12, buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.22;
    src.connect(g).connect(this.master); src.start();
  }
  thud() { if (this.ctx) this.blip(84, 0.14, 'sine', 0.3); }
  swish() { if (this.ctx) this.blip(520, 0.07, 'triangle', 0.06); }
  cash() { if (!this.ctx) return; this.blip(880, 0.09, 'square', 0.1); setTimeout(() => this.blip(1320, 0.14, 'square', 0.1), 70); }
  bustedJingle() { if (!this.ctx) return; this.blip(392, 0.2, 'square', 0.12); setTimeout(() => this.blip(311, 0.34, 'square', 0.12), 160); }
}
