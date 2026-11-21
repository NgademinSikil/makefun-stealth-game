// NIGHTSHADE — tiny WebAudio bleeps: footsteps, a relic chime, the alarm
// and the win arpeggio. Everything is lazy (no AudioContext until the first
// input) and wrapped, so a browser without sound — or a headless screenshot
// run — never breaks the game.

export function createAudio() {
  let ctx = null;
  let lastStep = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, seconds, type, gain) {
    const ac = ensure();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(gain, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + seconds);
      osc.connect(amp);
      amp.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + seconds);
    } catch {
      // Sound is garnish; silence is always acceptable.
    }
  }

  return {
    unlock() {
      const ac = ensure();
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    },
    footstep(running) {
      const now = performance.now();
      if (now - lastStep < (running ? 220 : 340)) return;
      lastStep = now;
      tone(running ? 110 : 85, 0.07, 'sine', 0.05);
    },
    relic() {
      tone(880, 0.12, 'sine', 0.12);
      setTimeout(() => tone(1320, 0.18, 'sine', 0.1), 90);
    },
    spotted() {
      tone(220, 0.25, 'square', 0.08);
      setTimeout(() => tone(220, 0.25, 'square', 0.08), 220);
    },
    caught() {
      tone(160, 0.4, 'sawtooth', 0.1);
    },
    level() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.1), i * 110));
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.1), i * 130));
    },
  };
}
