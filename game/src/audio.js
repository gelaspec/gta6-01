// Sound, all synthesised with WebAudio — no audio files, no network. Engine
// hum follows the car's speed, the siren wails while the player is wanted,
// gunshots are noise bursts, and a quiet synthwave pad loops underneath.
// Everything starts on the first user gesture; headless runs stay silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = 0;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineOsc2.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freqA, freqB, dur, type, gain) {
    if (!started) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freqA, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain || 0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  function noiseBurst(dur, gain, filterFreq) {
    if (!started) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1800;
      const g = ctx.createGain();
      g.gain.value = gain || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  // A slow synthwave pad: Am – F – C – G, one chord every 2 seconds.
  const CHORDS = [
    [110, 130.81, 164.81],
    [87.31, 110, 130.81],
    [130.81, 164.81, 196],
    [98, 123.47, 146.83],
  ];

  function musicTick(dt) {
    if (!started) return;
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer = 2.0;
    const chord = CHORDS[musicStep % CHORDS.length];
    musicStep += 1;
    for (const freq of chord) {
      try {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.9);
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 2.0);
      } catch {
        // Ignore.
      }
    }
  }

  return {
    ensure,
    start() {
      // Engine rev as the game starts: a rising sawtooth blip.
      blip(60, 180, 0.4, 'sawtooth', 0.12);
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    update(dt, speed, wanted) {
      if (!started) return;
      try {
        const target = Math.min(0.16, 0.03 + Math.abs(speed) * 0.0035);
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        const f = 50 + Math.abs(speed) * 3.2;
        engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
        engineOsc2.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.08);
        if (wanted > 0) {
          sirenTimer -= dt;
          if (sirenTimer <= 0) {
            sirenTimer = 0.45;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
          }
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        }
        musicTick(dt);
      } catch {
        // Ignore.
      }
    },
    gunshot(hit) {
      noiseBurst(0.14, hit ? 0.4 : 0.3, 2400);
      if (hit) blip(220, 90, 0.12, 'square', 0.1);
    },
    enemyShot() {
      noiseBurst(0.12, 0.16, 1600);
    },
    punch() {
      noiseBurst(0.08, 0.22, 900);
    },
    pickup() {
      blip(880, 1320, 0.16, 'sine', 0.2);
    },
    mission() {
      blip(523, 523, 0.12, 'sine', 0.18);
      setTimeout(() => blip(659, 659, 0.12, 'sine', 0.18), 120);
      setTimeout(() => blip(784, 784, 0.22, 'sine', 0.2), 240);
    },
    denied() {
      blip(180, 120, 0.2, 'square', 0.12);
    },
  };
}
