// Synthesised sound: engine hum, siren, gunshots, pickups and a lo-fi
// synthwave loop — all WebAudio oscillators, no audio files, no network.
// Everything is guarded: if the browser refuses audio (headless, no
// gesture yet) the game still runs silently.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let station = 0;
  let muted = false;
  let ready = false;

  function ensure() {
    if (ready) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      ready = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function engine(speed01, on) {
    if (!ready) return;
    try {
      engineGain.gain.value = on ? 0.05 + speed01 * 0.075 : 0;
      engineOsc.frequency.value = 52 + speed01 * 165;
    } catch { /* silent */ }
  }

  function siren(on) {
    if (!ready) return;
    try {
      sirenGain.gain.value = on ? 0.045 : 0;
    } catch { /* silent */ }
  }

  function blip(freq = 880, dur = 0.12, vol = 0.2) {
    if (!ready) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* silent */ }
  }

  function shot() {
    if (!ready) return;
    try {
      const len = ctx.sampleRate * 0.14;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(master);
      src.start();
    } catch { /* silent */ }
  }

  function crash() {
    if (!ready) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(160, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.3);
    } catch { /* silent */ }
  }

  // A tiny synthwave loop: a bassline plus a lead arp, scheduled ahead.
  const BASS = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
  const LEAD = [220, 261.6, 329.6, 392, 329.6, 261.6, 220, 196];
  let step = 0;
  function note(freq, when, dur, vol, type) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g);
    g.connect(master);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function startMusic() {
    if (!ready || musicTimer) return;
    musicTimer = setInterval(() => {
      try {
        if (!ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime + 0.08;
        note(BASS[step % BASS.length], t, 0.34, 0.16, 'triangle');
        note(LEAD[step % LEAD.length] * 2, t, 0.22, 0.05, 'square');
        if (step % 4 === 2) note(LEAD[(step + 3) % LEAD.length] * 2, t + 0.17, 0.2, 0.04, 'square');
        step++;
      } catch { /* silent */ }
    }, 210);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.32;
  }

  function nextStation() {
    station = (station + 1) % 4;
    return station;
  }

  return {
    ensure, resume, engine, siren, blip, shot, crash,
    startMusic, stopMusic, setMuted, nextStation,
    get station() { return station; },
    get muted() { return muted; },
    get ready() { return ready; },
  };
}
