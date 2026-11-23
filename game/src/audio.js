// Sound, all synthesised with WebAudio: no audio files, nothing fetched.
// Engine hum follows the car's speed, the siren wails while the police
// chase, and a little bassline keeps the sunset drive moving.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let beat = 0;

  // A simple bassline in A minor, one note a beat, with a hat tick.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
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
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, seconds, type, volume) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + seconds);
  }

  function noise(seconds, volume, lowpass) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  function scheduleBeat() {
    if (!ctx || muted) return;
    const freq = BASS[beat % BASS.length];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.45);
    beat += 1;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setEngine(speed, maxSpeed) {
      if (!ctx || muted) return;
      engineOsc.frequency.value = 55 + (Math.abs(speed) / maxSpeed) * 160;
      engineGain.gain.value = Math.abs(speed) > 5 ? 0.05 : 0;
    },
    setSiren(on) {
      if (!ctx) return;
      if (on && !muted) {
        sirenGain.gain.value = 0.035;
        const now = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(now);
        sirenOsc.frequency.setValueAtTime(700, now);
        sirenOsc.frequency.linearRampToValueAtTime(950, now + 0.5);
        sirenOsc.frequency.linearRampToValueAtTime(700, now + 1);
      } else {
        sirenGain.gain.value = 0;
      }
    },
    shot() {
      noise(0.12, 0.3, 3000);
    },
    punch() {
      noise(0.08, 0.2, 900);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.2);
      setTimeout(() => blip(1320, 0.15, 'sine', 0.2), 70);
    },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.22), i * 110));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.12), i * 140));
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(scheduleBeat, 460);
    },
    stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
