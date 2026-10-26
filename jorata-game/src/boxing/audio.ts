import type { PunchType } from './engine';

const AUDIO_STORAGE_KEY = 'jorata.boxing.audio.v1';

export interface BoxingAudioPrefs {
  sfx: boolean;
  music: boolean;
}

export function loadAudioPrefs(): BoxingAudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { sfx: true, music: true };
    const parsed = JSON.parse(raw) as Partial<BoxingAudioPrefs>;
    return {
      sfx: typeof parsed.sfx === 'boolean' ? parsed.sfx : true,
      music: typeof parsed.music === 'boolean' ? parsed.music : true,
    };
  } catch {
    return { sfx: true, music: true };
  }
}

export function saveAudioPrefs(prefs: BoxingAudioPrefs): void {
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage is optional
  }
}

class BoxingSoundEngine {
  private ctx: AudioContext | null = null;
  private ambienceTimer: number | null = null;
  private prefs: BoxingAudioPrefs = loadAudioPrefs();
  private beatStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setPrefs(prefs: BoxingAudioPrefs) {
    this.prefs = prefs;
    saveAudioPrefs(prefs);
    if (!prefs.music) {
      this.stopAmbience();
    }
  }

  getPrefs(): BoxingAudioPrefs {
    return this.prefs;
  }

  playMenuHover() {
    if (!this.prefs.sfx) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.022);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  playMenuClick(isStart = false) {
    if (!this.prefs.sfx) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isStart ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isStart ? 180 : 320, now);
    osc.frequency.exponentialRampToValueAtTime(isStart ? 68 : 140, now + (isStart ? 0.11 : 0.055));

    gain.gain.setValueAtTime(isStart ? 0.09 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isStart ? 0.12 : 0.06));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isStart ? 0.13 : 0.065));
  }

  playBell(strikes = 1) {
    if (!this.prefs.sfx) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    for (let s = 0; s < strikes; s++) {
      const start = ctx.currentTime + s * 0.22;
      const partials = [784, 1188, 1664, 2320];
      partials.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        const amp = 0.065 / (idx + 1);
        gain.gain.setValueAtTime(amp, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75 / (idx * 0.4 + 1));

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.8);
      });
    }
  }

  playPunchSwing(type: PunchType) {
    if (!this.prefs.sfx) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = type === 'jab' ? 240 : type === 'hook' ? 190 : 155;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.065);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playHit(type: PunchType, blocked: boolean) {
    if (!this.prefs.sfx) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (blocked) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    } else {
      osc.type = 'square';
      const base = type === 'uppercut' ? 135 : type === 'hook' ? 160 : 195;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
      gain.gain.setValueAtTime(type === 'uppercut' ? 0.095 : 0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  startAmbience() {
    if (!this.prefs.music || typeof window === 'undefined') return;
    if (this.ambienceTimer !== null) return;

    const notes = [55, 55, 65.41, 55, 73.42, 65.41, 55, 49];
    this.ambienceTimer = window.setInterval(() => {
      if (!this.prefs.music) {
        this.stopAmbience();
        return;
      }
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const freq = notes[this.beatStep % notes.length];
      this.beatStep += 1;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.018, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }, 360);
  }

  stopAmbience() {
    if (this.ambienceTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.ambienceTimer);
      this.ambienceTimer = null;
    }
  }
}

export const boxingAudio = new BoxingSoundEngine();
