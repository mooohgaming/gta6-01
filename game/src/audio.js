// Synthesised sound: no audio files, everything comes from the Web Audio API.
// The context is created lazily on the first user gesture, so loading the page
// never needs permission, and every call is guarded so a browser without audio
// simply stays silent.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      const gain = context.createGain();
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // Silence is always an acceptable fallback.
    }
  }

  return {
    /** Call on the first user gesture so the context is allowed to start. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** The engine hum follows the car's speed, 0 for parked. */
    setEngine(speedRatio) {
      if (!context || muted) return;
      try {
        engineOsc.frequency.value = 50 + speedRatio * 95;
        engineGain.gain.value = speedRatio > 0.02 ? 0.02 + speedRatio * 0.045 : 0;
      } catch {
        // Ignore.
      }
    },
    shoot() {
      tone(180, 0.12, 'square', 0.18, 60);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.16);
      tone(1320, 0.12, 'sine', 0.12);
    },
    mission() {
      tone(523, 0.12, 'sine', 0.18);
      setTimeout(() => tone(659, 0.12, 'sine', 0.18), 110);
      setTimeout(() => tone(784, 0.22, 'sine', 0.2), 220);
    },
    busted() {
      tone(220, 0.4, 'sawtooth', 0.16, 110);
    },
    /** One wail of the siren, called on a timer while the player is wanted. */
    sirenTick() {
      tone(660, 0.28, 'sine', 0.1, 880);
      setTimeout(() => tone(880, 0.28, 'sine', 0.1, 660), 300);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
