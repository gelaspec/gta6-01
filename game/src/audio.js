// WebAudio synth: engine hum, sirens, gunshots, pickups and a small
// synthwave loop. Everything is generated — no audio files, no network.
// The context starts on the first user gesture; headless runs stay
// silent instead of throwing.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    musicTimer: null,
    musicStep: 0,
    started: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || audio.muted) return;
    try {
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || audio.muted) return;
    try {
      const t = audio.ctx.currentTime;
      const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start(t);
    } catch {
      // Audio is decoration.
    }
  }

  audio.resume = () => {
    if (ensure() && audio.ctx.state === 'suspended') audio.ctx.resume();
  };
  audio.gunshot = () => noise(0.16, 0.5, 2400);
  audio.enemyShot = () => noise(0.14, 0.25, 1800);
  audio.punch = () => noise(0.09, 0.35, 500);
  audio.thud = () => noise(0.2, 0.4, 300);
  audio.reload = () => {
    tone(520, 0.06, 'square', 0.1);
    setTimeout(() => tone(760, 0.06, 'square', 0.1), 120);
  };
  audio.pickup = () => {
    tone(880, 0.09, 'sine', 0.22);
    setTimeout(() => tone(1318, 0.14, 'sine', 0.22), 90);
  };
  audio.cash = () => {
    tone(988, 0.1, 'triangle', 0.22);
    setTimeout(() => tone(1318, 0.1, 'triangle', 0.22), 100);
    setTimeout(() => tone(1760, 0.18, 'triangle', 0.22), 200);
  };
  audio.sirenBurst = () => {
    tone(720, 0.35, 'sine', 0.12, 980);
    setTimeout(() => tone(980, 0.35, 'sine', 0.12, 720), 350);
  };
  audio.mission = () => {
    tone(523, 0.14, 'triangle', 0.22);
    setTimeout(() => tone(659, 0.14, 'triangle', 0.22), 140);
    setTimeout(() => tone(784, 0.22, 'triangle', 0.22), 280);
  };
  audio.engineStart = () => tone(90, 0.5, 'sawtooth', 0.14, 180);
  audio.setEngine = (load, speed) => {
    if (!ensure() || audio.muted) return;
    try {
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        audio.engineOsc.connect(filter);
        filter.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      const target = load * 0.05 + Math.abs(speed) * 0.001;
      audio.engineGain.gain.setTargetAtTime(Math.min(0.07, target), audio.ctx.currentTime, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(55 + load * 130, audio.ctx.currentTime, 0.1);
    } catch {
      // Audio is decoration.
    }
  };
  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };
  audio.startMusic = () => {
    if (!ensure() || audio.musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    const arp = [220, 277, 330, 415, 330, 277];
    audio.musicTimer = setInterval(() => {
      if (audio.muted || document.hidden) return;
      const step = audio.musicStep++;
      tone(bass[step % bass.length], 0.42, 'triangle', 0.1);
      tone(arp[step % arp.length] * 2, 0.18, 'sine', 0.05);
      if (step % 8 === 4) tone(440, 0.3, 'sine', 0.05, 660);
    }, 210);
  };
  return audio;
}
