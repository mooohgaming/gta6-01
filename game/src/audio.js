// Synthesized sound: no audio files. An engine hum that follows the car's
// speed, a gunshot, a pickup blip, a mission jingle and the busted/wasted
// stings — all from one WebAudio graph, created on the first user gesture.

export function createAudio() {
  let context = null;
  let engine = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      engine = context.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engine.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engine.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, duration, type, volume, when = 0) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + when + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(context.currentTime + when);
      osc.stop(context.currentTime + when + duration);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(duration, volume) {
    if (!context || muted) return;
    try {
      const length = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume().catch(() => {}); },
    setEngine(speed, inCar) {
      if (!context || muted || !engineGain) return;
      const target = inCar ? 0.02 + Math.abs(speed) / 560 * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engine.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.12, context.currentTime, 0.1);
    },
    shot() { noise(0.12, 0.25); blip(180, 0.08, 'square', 0.12); },
    enemyShot() { noise(0.1, 0.08); },
    pickup() { blip(880, 0.12, 'sine', 0.16); blip(1320, 0.14, 'sine', 0.12, 0.07); },
    mission() { blip(523, 0.14, 'triangle', 0.2); blip(659, 0.14, 'triangle', 0.2, 0.12); blip(784, 0.24, 'triangle', 0.22, 0.24); },
    busted() { blip(330, 0.2, 'sawtooth', 0.16); blip(262, 0.34, 'sawtooth', 0.16, 0.18); },
    wasted() { blip(220, 0.3, 'sawtooth', 0.16); blip(165, 0.5, 'sawtooth', 0.16, 0.26); },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
  };
}
