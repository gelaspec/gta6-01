// Meridian Bay — WebAudio synth: engine hum, two-tone siren, gunshots,
// pickup blips and a small synthwave loop. Everything is synthesized at
// run time (no audio files, no network); it stays silent until the first
// user gesture, and never throws when audio is unavailable.
import { CONFIG } from './config.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.muted = false;
    this.radioIndex = 0;
    this._unlock = () => this.ensure();
    window.addEventListener('pointerdown', this._unlock, { once: true });
    window.addEventListener('keydown', this._unlock, { once: true });
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // -- engine hum ------------------------------------------------------------
  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  engine(speed, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.05 + Math.min(0.1, Math.abs(speed) * 0.0022) : 0.0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 2.1, this.ctx.currentTime, 0.08);
  }

  // -- siren -----------------------------------------------------------------
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this._sirenLfo = null;
    }
  }

  // -- one-shots ---------------------------------------------------------------
  blip(freq, dur, type = 'sine', vol = 0.16) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  pickup() {
    this.blip(880, 0.12);
    setTimeout(() => this.blip(1318, 0.16), 90);
  }

  punch() {
    this.blip(160, 0.1, 'square', 0.2);
  }

  dryFire() {
    this.blip(1200, 0.05, 'square', 0.08);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.3;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  missionDone() {
    this.blip(523, 0.14);
    setTimeout(() => this.blip(659, 0.14), 130);
    setTimeout(() => this.blip(784, 0.22), 260);
  }

  // -- synthwave loop: bass line + pad, stepped on a timer --------------------
  startMusic() {
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
    const pad = [220, 261.6, 329.6];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep % 16;
      this.musicStep += 1;
      const b = bass[step];
      if (b) this.blip(b, 0.22, 'triangle', 0.07);
      if (step === 0) {
        for (const f of pad) this.blip(f, 1.6, 'sine', 0.025);
      }
    }, 240);
  }

  nextRadio() {
    this.radioIndex = (this.radioIndex + 1) % CONFIG.radio.length;
    return CONFIG.radio[this.radioIndex];
  }

  dispose() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this.ctx) this.ctx.close().catch(() => {});
  }
}
