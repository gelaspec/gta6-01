// Audio: a WebAudio synth — engine hum that follows speed, siren
// wails, gunshots, punches, cash pickups and a synthwave radio loop.
// Everything is generated in code; there are no audio files and no
// network. The context only starts after a user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;
  let note = 0;

  // A small synthwave bass line, one bar at a time.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const LEAD = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 196];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; never break the game for it.
    }
  }

  function noiseBurst(dur, vol, low) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = low || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start(t);
    } catch {
      // Ignore.
    }
  }

  return {
    resume() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    startMusic() {
      if (musicOn || !ensure()) return;
      musicOn = true;
      musicTimer = window.setInterval(() => {
        if (muted || !ctx) return;
        const step = note % 8;
        blip(BASS[step], 0.32, 'triangle', 0.16);
        if (step % 2 === 0) blip(LEAD[step], 0.5, 'sine', 0.07);
        note++;
      }, 240);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    engine(speed01) {
      if (!ensure() || muted) return;
      try {
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.02 + speed01 * 0.05;
      } catch {
        // Ignore.
      }
    },
    shot() {
      noiseBurst(0.14, 0.4, 2400);
    },
    punch() {
      noiseBurst(0.1, 0.3, 500);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.22);
      window.setTimeout(() => blip(1318, 0.16, 'sine', 0.2), 90);
    },
    crash() {
      noiseBurst(0.3, 0.35, 700);
    },
    sirenBurst() {
      blip(700, 0.5, 'sine', 0.16, 1200);
      window.setTimeout(() => blip(1200, 0.5, 'sine', 0.16, 700), 500);
    },
    sirenTick(wanted) {
      if (!wanted) return;
      blip(wanted >= 3 ? 950 : 700, 0.4, 'sine', 0.07, wanted >= 3 ? 1400 : 1000);
    },
  };
}
