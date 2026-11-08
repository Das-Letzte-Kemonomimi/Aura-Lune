/**
 * Auralune Vinyl & Tape Analog Lo-Fi FX Simulator
 * 
 * Generuje w czasie rzeczywistym organiczny szum analogowy:
 * 1. Winyl: szum powierzchniowy mikrorowków, okresowy sweep obrotowy 33⅓ / 45 RPM,
 *    trzaski kurzu (dust crackle) i mechaniczny pomruk igły (stylus rumble).
 * 2. Taśma magnetofonowa: równomierny szum taśmy chromowej/żelazowej (tape hiss)
 *    z ciepłym filtrem analogowym.
 * 
 * W pełni zsynchronizowany z odtwarzaniem (płynne opadanie i podnoszenie igły).
 */

export type AnalogNoiseMode = 'vinyl' | 'tape';

export interface VinylSimConfig {
  enabled: boolean;
  mode: AnalogNoiseMode;
  intensity: number; // 0.0 - 1.0 (np. 0.25 = 25%)
  autoSync: boolean; // wyciszanie na pauzie
}

const STORAGE_KEY = 'auralune_vinyl_sim_config_v1';

export const DEFAULT_VINYL_SIM_CONFIG: VinylSimConfig = {
  enabled: false,
  mode: 'vinyl',
  intensity: 0.25,
  autoSync: true,
};

class VinylSimulatorEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Węzły winyla
  private vinylGrooveGain: GainNode | null = null;
  private vinylRumbleGain: GainNode | null = null;
  private vinylGrooveSource: AudioBufferSourceNode | null = null;
  private vinylRumbleSource: AudioBufferSourceNode | null = null;
  private grooveLfo: OscillatorNode | null = null;

  // Węzły taśmy
  private tapeHissGain: GainNode | null = null;
  private tapeHissSource: AudioBufferSourceNode | null = null;

  private crackleTimer: number | null = null;
  private isRunning = false;
  private isPlayerPlaying = false;
  private rpm: 33 | 45 = 33;

  private config: VinylSimConfig = { ...DEFAULT_VINYL_SIM_CONFIG };
  private listeners: Set<(cfg: VinylSimConfig) => void> = new Set();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_VINYL_SIM_CONFIG, ...parsed };
      }
    } catch {
      this.config = { ...DEFAULT_VINYL_SIM_CONFIG };
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // Ignoruj błędy zapisu localStorage
    }
    this.notify();
  }

  public subscribe(cb: (cfg: VinylSimConfig) => void): () => void {
    this.listeners.add(cb);
    cb(this.config);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.config));
  }

  public getConfig(): VinylSimConfig {
    return { ...this.config };
  }

  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    this.saveConfig();
    this.updateAudioState();
  }

  public setMode(mode: AnalogNoiseMode) {
    this.config.mode = mode;
    this.saveConfig();
    this.updateAudioState();
  }

  public setIntensity(intensity: number) {
    this.config.intensity = Math.max(0, Math.min(1, intensity));
    this.saveConfig();
    this.updateGainLevels();
  }

  public setAutoSync(autoSync: boolean) {
    this.config.autoSync = autoSync;
    this.saveConfig();
    this.updateAudioState();
  }

  public setRpm(rpm: 33 | 45) {
    this.rpm = rpm;
    if (this.grooveLfo && this.ctx) {
      // Częstotliwość obrotu: 33.33 RPM = 0.555 Hz, 45 RPM = 0.75 Hz
      const freq = rpm === 33 ? 0.555 : 0.75;
      this.grooveLfo.frequency.setValueAtTime(freq, this.ctx.currentTime);
    }
  }

  public setPlaybackState(isPlaying: boolean) {
    this.isPlayerPlaying = isPlaying;
    this.updateAudioState();
  }

  private initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Kanał szumu rowka winyla (groove hiss)
    this.vinylGrooveGain = this.ctx.createGain();
    this.vinylGrooveGain.connect(this.masterGain);

    // Kanał mechanicznego basowego dudnienia (rumble)
    this.vinylRumbleGain = this.ctx.createGain();
    this.vinylRumbleGain.connect(this.masterGain);

    // Kanał szumu taśmy (tape hiss)
    this.tapeHissGain = this.ctx.createGain();
    this.tapeHissGain.connect(this.masterGain);

    this.setupVinylSynthesis();
    this.setupTapeSynthesis();
  }

  private createPinkNoiseBuffer(seconds = 4): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const size = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private createBrownNoiseBuffer(seconds = 4): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const size = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0.0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 2.8;
    }
    return buffer;
  }

  private setupVinylSynthesis() {
    if (!this.ctx || !this.vinylGrooveGain || !this.vinylRumbleGain) return;

    // 1. Szum powierzchniowy rowka (Highpass + Bandpass)
    const pinkBuf = this.createPinkNoiseBuffer(5);
    this.vinylGrooveSource = this.ctx.createBufferSource();
    this.vinylGrooveSource.buffer = pinkBuf;
    this.vinylGrooveSource.loop = true;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2800, this.ctx.currentTime);

    // LFO modulujący obrót płyty (33 RPM ~ 0.55 Hz)
    this.grooveLfo = this.ctx.createOscillator();
    this.grooveLfo.frequency.setValueAtTime(this.rpm === 33 ? 0.555 : 0.75, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    this.grooveLfo.connect(lfoGain);

    const grooveModGain = this.ctx.createGain();
    grooveModGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    lfoGain.connect(grooveModGain.gain);

    this.vinylGrooveSource.connect(hp);
    hp.connect(grooveModGain);
    grooveModGain.connect(this.vinylGrooveGain);

    this.vinylGrooveSource.start();
    this.grooveLfo.start();

    // 2. Mechaniczny basowy pomruk silnika i talerza (Rumble 35 Hz)
    const brownBuf = this.createBrownNoiseBuffer(4);
    this.vinylRumbleSource = this.ctx.createBufferSource();
    this.vinylRumbleSource.buffer = brownBuf;
    this.vinylRumbleSource.loop = true;

    const lpRumble = this.ctx.createBiquadFilter();
    lpRumble.type = 'lowpass';
    lpRumble.frequency.setValueAtTime(65, this.ctx.currentTime);

    this.vinylRumbleSource.connect(lpRumble);
    lpRumble.connect(this.vinylRumbleGain);
    this.vinylRumbleSource.start();
  }

  private setupTapeSynthesis() {
    if (!this.ctx || !this.tapeHissGain) return;

    // Ciepły, gęsty szum taśmy Type II Chrome (Pink noise + Lowpass 7 kHz)
    const pinkBuf = this.createPinkNoiseBuffer(6);
    this.tapeHissSource = this.ctx.createBufferSource();
    this.tapeHissSource.buffer = pinkBuf;
    this.tapeHissSource.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(7200, this.ctx.currentTime);

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(450, this.ctx.currentTime);

    this.tapeHissSource.connect(hp);
    hp.connect(lp);
    lp.connect(this.tapeHissGain);
    this.tapeHissSource.start();
  }

  private scheduleCrackle() {
    if (this.crackleTimer !== null) {
      window.clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
    if (!this.isRunning || !this.config.enabled || this.config.mode !== 'vinyl') return;

    // Losowy odstęp między trzaskami (zależny od intensywności)
    const baseDelay = 50 + Math.random() * 250;
    const delay = Math.max(25, baseDelay * (1.2 - this.config.intensity * 0.7));

    this.crackleTimer = window.setTimeout(() => {
      this.playSingleCrackle();
      this.scheduleCrackle();
    }, delay);
  }

  private playSingleCrackle() {
    if (!this.ctx || !this.masterGain || !this.isRunning || this.config.intensity <= 0.01) return;
    const now = this.ctx.currentTime;

    // Krótki impuls szpilkowy igły o losowej polaryzacji
    const frames = Math.floor(this.ctx.sampleRate * 0.006);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);

    const isLoudPop = Math.random() > 0.92;
    const amp = (isLoudPop ? 0.35 : 0.12) * (Math.random() * 2 - 1) * this.config.intensity;

    for (let i = 0; i < frames; i++) {
      data[i] = amp * Math.exp(-i / 6.0);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400 + Math.random() * 3200, now);
    bp.Q.setValueAtTime(4.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);

    src.start(now);
  }

  private updateGainLevels() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = this.config.intensity;

    if (this.vinylGrooveGain) {
      this.vinylGrooveGain.gain.setTargetAtTime(
        this.config.mode === 'vinyl' ? vol * 0.35 : 0,
        now,
        0.05
      );
    }
    if (this.vinylRumbleGain) {
      this.vinylRumbleGain.gain.setTargetAtTime(
        this.config.mode === 'vinyl' ? vol * 0.22 : 0,
        now,
        0.05
      );
    }
    if (this.tapeHissGain) {
      this.tapeHissGain.gain.setTargetAtTime(
        this.config.mode === 'tape' ? vol * 0.40 : 0,
        now,
        0.05
      );
    }
  }

  private updateAudioState() {
    const shouldAudible =
      this.config.enabled &&
      (!this.config.autoSync || this.isPlayerPlaying);

    if (shouldAudible) {
      this.initContext();
      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.isRunning = true;
      this.updateGainLevels();

      // Płynne podgłośnienie (fade-in 100ms)
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.08);
      }

      if (this.config.mode === 'vinyl') {
        this.scheduleCrackle();
      } else if (this.crackleTimer !== null) {
        window.clearTimeout(this.crackleTimer);
        this.crackleTimer = null;
      }
    } else {
      // Płynne wyciszenie (fade-out 120ms)
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      }
      this.isRunning = false;
      if (this.crackleTimer !== null) {
        window.clearTimeout(this.crackleTimer);
        this.crackleTimer = null;
      }
    }
  }
}

export const vinylSimulator = new VinylSimulatorEngine();

