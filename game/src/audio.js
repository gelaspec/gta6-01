// Meridian Bay — WebAudio synth: engine hum, two-tone siren, gunshots,
// pickup blips and a tiny synthwave radio loop. Created lazily on the first
// user gesture; shot mode never initialises it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let muted = false;
  let radioOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // engine: sawtooth through a lowpass, pitch follows speed
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // siren: two alternating tones
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let hi = true;
      setInterval(() => {
        if (!ctx || muted) return;
        hi = !hi;
        sirenOsc.frequency.setTargetAtTime(hi ? 700 : 950, ctx.currentTime, 0.05);
      }, 380);
      return true;
    } catch (e) {
      return false;
    }
  }

  function setEngine(speedKmh, inCar) {
    if (!ctx || muted) return;
    engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.min(0.09, speedKmh / 1800) : 0, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.1, ctx.currentTime, 0.08);
  }
  function setSiren(on) {
    if (!ctx || muted) return;
    sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
  }
  function blip(freq, dur = 0.12, type = 'sine', vol = 0.2) {
    if (!ensure() || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }
  function gunshot() {
    if (!ensure() || muted) return;
    const len = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(g);
    g.connect(master);
    src.start();
  }
  function pickup() { blip(880, 0.14, 'sine', 0.22); setTimeout(() => blip(1320, 0.18, 'sine', 0.2), 90); }
  function missionPass() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 110));
  }
  function busted() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.14), i * 160));
  }
  // tiny synthwave loop: bass + arp, scheduled per bar
  function startRadio() {
    if (radioOn || !ensure()) return;
    radioOn = true;
    const bassNotes = [55, 55, 65.4, 49];
    const arpNotes = [220, 277, 330, 440, 330, 277];
    let bar = 0;
    radioTimer = setInterval(() => {
      if (muted || !ctx) return;
      const b = bassNotes[bar % bassNotes.length];
      blip(b, 0.5, 'sawtooth', 0.06);
      for (let i = 0; i < 4; i++) {
        setTimeout(() => blip(arpNotes[(bar * 2 + i) % arpNotes.length], 0.16, 'square', 0.03), i * 120);
      }
      bar += 1;
    }, 480);
  }
  function stopRadio() {
    radioOn = false;
    if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return {
    ensure, setEngine, setSiren, gunshot, pickup, missionPass, busted, startRadio, stopRadio, toggleMute,
    get muted() { return muted; },
  };
}
