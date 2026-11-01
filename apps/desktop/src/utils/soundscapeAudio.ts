/**
 * Auralune Soundscape Audio Engine — Web Audio API Procedural Synthesizer
 * 
 * Synthesizes 5 organic, seamless lofi ambient layers without requiring external audio assets:
 * 1. Gentle Rain (deszcz ze zmiennym szumem różowym i kroplami)
 * 2. Vinyl Crackle (ciepły trzask płyty gramofonowej i szum igły)
 * 3. Campfire & Embers (strzelające ognisko z ciepłym rezonansem)
 * 4. Wind & Japanese Chimes (wiatr z delikatnymi dzwonkami wietrznymi Furin w skali pentatonicznej)
 * 5. Warm Cafe / Brown Noise (kojący, głęboki szum brązowy)
 */

export interface SoundscapeVolumes {
  master: number;       // 0.0 - 1.0
  rain: number;         // 0.0 - 1.0
  vinyl: number;        // 0.0 - 1.0
  campfire: number;     // 0.0 - 1.0
  wind_chimes: number;  // 0.0 - 1.0
  cafe_brown: number;   // 0.0 - 1.0
}

export interface SoundscapePreset {
  id: string;
  name: { pl: string; en: string };
  icon: string;
  volumes: Partial<SoundscapeVolumes>;
}

export const SOUNDSCAPE_PRESETS: SoundscapePreset[] = [
  {
    id: 'lofi_study',
    name: { pl: 'Lofi Study ☕', en: 'Lofi Study ☕' },
    icon: '☕',
    volumes: { master: 0.5, vinyl: 0.55, cafe_brown: 0.35, rain: 0.2, campfire: 0, wind_chimes: 0 },
  },
  {
    id: 'rainy_tokyo',
    name: { pl: 'Deszczowe Tokio 🌧️', en: 'Rainy Tokyo 🌧️' },
    icon: '🌧️',
    volumes: { master: 0.55, rain: 0.75, vinyl: 0.25, wind_chimes: 0.15, campfire: 0, cafe_brown: 0 },
  },
  {
    id: 'sakura_garden',
    name: { pl: 'Ogród Sakury 🌸', en: 'Sakura Garden 🌸' },
    icon: '🌸',
    volumes: { master: 0.5, wind_chimes: 0.7, rain: 0.15, vinyl: 0, campfire: 0, cafe_brown: 0 },
  },
  {
    id: 'warm_hearth',
    name: { pl: 'Ciepłe Ognisko 🔥', en: 'Warm Hearth 🔥' },
    icon: '🔥',
    volumes: { master: 0.55, campfire: 0.8, vinyl: 0.35, rain: 0, wind_chimes: 0, cafe_brown: 0 },
  },
  {
    id: 'deep_focus',
    name: { pl: 'Głęboki Focus 🎧', en: 'Deep Focus 🎧' },
    icon: '🎧',
    volumes: { master: 0.45, cafe_brown: 0.65, rain: 0.3, vinyl: 0.15, campfire: 0, wind_chimes: 0 },
  },
];

export const DEFAULT_SOUNDSCAPE_VOLUMES: SoundscapeVolumes = {
  master: 0.5,
  rain: 0.0,
  vinyl: 0.0,
  campfire: 0.0,
  wind_chimes: 0.0,
  cafe_brown: 0.0,
};

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Kanały Gain
  private gainRain: GainNode | null = null;
  private gainVinyl: GainNode | null = null;
  private gainCampfire: GainNode | null = null;
  private gainWindChimes: GainNode | null = null;
  private gainCafeBrown: GainNode | null = null;

  // Źródła i timery
  private rainSource: AudioBufferSourceNode | null = null;
  private brownSource: AudioBufferSourceNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private vinylHissSource: AudioBufferSourceNode | null = null;
  private campfireRumbleSource: AudioBufferSourceNode | null = null;

  private isRunning = false;
  private isMuted = false;
  private dropletTimer: number | null = null;
  private vinylClickTimer: number | null = null;
  private campfirePopTimer: number | null = null;
  private chimesTimer: number | null = null;

  private volumes: SoundscapeVolumes = { ...DEFAULT_SOUNDSCAPE_VOLUMES };

  // Dźwięki dzwonków wietrznych w tradycyjnej japońskiej skali Insen / Hirajoshi (Hz)
  private readonly CHIME_PITCHES = [523.25, 587.33, 622.25, 783.99, 880.0, 1046.5];

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('auralune_soundscape_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.volumes) {
          this.volumes = { ...DEFAULT_SOUNDSCAPE_VOLUMES, ...parsed.volumes };
        }
        if (typeof parsed.isMuted === 'boolean') {
          this.isMuted = parsed.isMuted;
        }
      }
    } catch {
      // Ignoruj błędy parsowania
    }
  }

  public saveSettings() {
    try {
      localStorage.setItem(
        'auralune_soundscape_settings',
        JSON.stringify({
          volumes: this.volumes,
          isMuted: this.isMuted,
        })
      );
    } catch {
      // Ignoruj błędy
    }
  }

  private initContext() {
    if (this.ctx) return;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtxClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volumes.master, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 1. Rain channel
    this.gainRain = this.ctx.createGain();
    this.gainRain.gain.setValueAtTime(this.volumes.rain, this.ctx.currentTime);
    this.gainRain.connect(this.masterGain);

    // 2. Vinyl channel
    this.gainVinyl = this.ctx.createGain();
    this.gainVinyl.gain.setValueAtTime(this.volumes.vinyl, this.ctx.currentTime);
    this.gainVinyl.connect(this.masterGain);

    // 3. Campfire channel
    this.gainCampfire = this.ctx.createGain();
    this.gainCampfire.gain.setValueAtTime(this.volumes.campfire, this.ctx.currentTime);
    this.gainCampfire.connect(this.masterGain);

    // 4. Wind & Chimes channel
    this.gainWindChimes = this.ctx.createGain();
    this.gainWindChimes.gain.setValueAtTime(this.volumes.wind_chimes, this.ctx.currentTime);
    this.gainWindChimes.connect(this.masterGain);

    // 5. Cafe / Brown Noise channel
    this.gainCafeBrown = this.ctx.createGain();
    this.gainCafeBrown.gain.setValueAtTime(this.volumes.cafe_brown, this.ctx.currentTime);
    this.gainCafeBrown.connect(this.masterGain);

    this.setupRainSynthesis();
    this.setupVinylSynthesis();
    this.setupCampfireSynthesis();
    this.setupWindChimesSynthesis();
    this.setupCafeBrownSynthesis();
  }

  /**
   * Generuje 5-sekundowy bufor płynnie zapętlonego szumu różowego (Pink Noise)
   */
  private createPinkNoiseBuffer(durationSeconds = 5): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const bufferSize = this.ctx.sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
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

  /**
   * Generuje 5-sekundowy bufor szumu brązowego (Brownian / Red noise)
   */
  private createBrownNoiseBuffer(durationSeconds = 5): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const bufferSize = this.ctx.sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.2; // Wzmocnienie percepcyjne
    }
    return buffer;
  }

  // --- 1. Synteza Deszczu (Rain) ---
  private setupRainSynthesis() {
    if (!this.ctx || !this.gainRain) return;

    const pinkBuffer = this.createPinkNoiseBuffer(6);
    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = pinkBuffer;
    this.rainSource.loop = true;

    // Filtr dolnoprzepustowy z wolną modulacją wiatru
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    // LFO modulujący powiewy deszczu
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(260, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.rainSource.connect(filter);
    filter.connect(this.gainRain);
    this.rainSource.start();

    // Drobne krople wody
    this.scheduleDroplet();
  }

  private scheduleDroplet() {
    if (!this.ctx || !this.isRunning) return;
    const delayMs = 120 + Math.random() * 340;
    this.dropletTimer = window.setTimeout(() => {
      this.playDropletClick();
      this.scheduleDroplet();
    }, delayMs);
  }

  private playDropletClick() {
    if (!this.ctx || !this.gainRain || this.volumes.rain <= 0.01 || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Losowa częstotliwość uderzenia kropli
    osc.frequency.setValueAtTime(1400 + Math.random() * 1800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.035);

    const clickVol = (0.01 + Math.random() * 0.03) * this.volumes.rain;
    gain.gain.setValueAtTime(clickVol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.gainRain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // --- 2. Synteza Winyla (Vinyl) ---
  private setupVinylSynthesis() {
    if (!this.ctx || !this.gainVinyl) return;

    // Płynny, cichy szum igły gramofonowej (Highpass)
    const pinkBuffer = this.createPinkNoiseBuffer(4);
    this.vinylHissSource = this.ctx.createBufferSource();
    this.vinylHissSource.buffer = pinkBuffer;
    this.vinylHissSource.loop = true;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(3200, this.ctx.currentTime);

    const hissGain = this.ctx.createGain();
    hissGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.vinylHissSource.connect(highpass);
    highpass.connect(hissGain);
    hissGain.connect(this.gainVinyl);
    this.vinylHissSource.start();

    this.scheduleVinylClick();
  }

  private scheduleVinylClick() {
    if (!this.ctx || !this.isRunning) return;
    const delayMs = 40 + Math.random() * 180;
    this.vinylClickTimer = window.setTimeout(() => {
      this.playVinylCrackle();
      this.scheduleVinylClick();
    }, delayMs);
  }

  private playVinylCrackle() {
    if (!this.ctx || !this.gainVinyl || this.volumes.vinyl <= 0.01 || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Bardzo krótki impuls igły (Dirack-like impulse click)
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.008), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const amp = (Math.random() > 0.88 ? 0.45 : 0.18) * (Math.random() * 2 - 1);
    for (let i = 0; i < data.length; i++) {
      data[i] = amp * Math.exp(-i / 8);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200 + Math.random() * 3000, now);
    filter.Q.setValueAtTime(3.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainVinyl);
    src.start(now);
  }

  // --- 3. Synteza Ogniska (Campfire) ---
  private setupCampfireSynthesis() {
    if (!this.ctx || !this.gainCampfire) return;

    // Ciepły basowy pomruk ognia (Brown noise lowpass)
    const brownBuffer = this.createBrownNoiseBuffer(5);
    this.campfireRumbleSource = this.ctx.createBufferSource();
    this.campfireRumbleSource.buffer = brownBuffer;
    this.campfireRumbleSource.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(380, this.ctx.currentTime);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    this.campfireRumbleSource.connect(lowpass);
    lowpass.connect(rumbleGain);
    rumbleGain.connect(this.gainCampfire);
    this.campfireRumbleSource.start();

    this.scheduleCampfirePop();
  }

  private scheduleCampfirePop() {
    if (!this.ctx || !this.isRunning) return;
    const delayMs = 120 + Math.random() * 550;
    this.campfirePopTimer = window.setTimeout(() => {
      this.playCampfireSpark();
      this.scheduleCampfirePop();
    }, delayMs);
  }

  private playCampfireSpark() {
    if (!this.ctx || !this.gainCampfire || this.volumes.campfire <= 0.01 || this.isMuted) return;
    const now = this.ctx.currentTime;
    const isLoudPop = Math.random() > 0.85;
    const dur = isLoudPop ? 0.06 : 0.025;

    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (isLoudPop ? 400 : 120));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isLoudPop ? 1100 : 2400 + Math.random() * 1200, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isLoudPop ? 0.35 : 0.16, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainCampfire);
    src.start(now);
  }

  // --- 4. Synteza Wiatru i Japońskich Dzwonków (Wind & Chimes) ---
  private setupWindChimesSynthesis() {
    if (!this.ctx || !this.gainWindChimes) return;

    // Delikatny, falujący wiatr
    const pinkBuffer = this.createPinkNoiseBuffer(6);
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = pinkBuffer;
    this.windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(520, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(2.8, this.ctx.currentTime);

    // LFO modulujące świst wiatru
    const windLfo = this.ctx.createOscillator();
    windLfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    const windLfoGain = this.ctx.createGain();
    windLfoGain.gain.setValueAtTime(320, this.ctx.currentTime);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    this.windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.gainWindChimes);
    this.windSource.start();

    this.scheduleChime();
  }

  private scheduleChime() {
    if (!this.ctx || !this.isRunning) return;
    const delayMs = 1800 + Math.random() * 3800;
    this.chimesTimer = window.setTimeout(() => {
      this.playWindChimeTing();
      this.scheduleChime();
    }, delayMs);
  }

  private playWindChimeTing() {
    if (!this.ctx || !this.gainWindChimes || this.volumes.wind_chimes <= 0.01 || this.isMuted) return;
    const now = this.ctx.currentTime;
    const fundamental = this.CHIME_PITCHES[Math.floor(Math.random() * this.CHIME_PITCHES.length)];

    // Dzwonek szklany/metalowy Furin składa się z tonu podstawowego i składowej nieharmonicznej
    [1.0, 2.76].forEach((mult, idx) => {
      if (!this.ctx || !this.gainWindChimes) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * mult, now);

      const vol = (idx === 0 ? 0.08 : 0.035) * this.volumes.wind_chimes;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.gainWindChimes);
      osc.start(now);
      osc.stop(now + 1.85);
    });
  }

  // --- 5. Synteza Szumu Brązowego / Kawiarni (Cafe Brown) ---
  private setupCafeBrownSynthesis() {
    if (!this.ctx || !this.gainCafeBrown) return;

    const brownBuffer = this.createBrownNoiseBuffer(6);
    this.brownSource = this.ctx.createBufferSource();
    this.brownSource.buffer = brownBuffer;
    this.brownSource.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(500, this.ctx.currentTime);

    const brownGain = this.ctx.createGain();
    brownGain.gain.setValueAtTime(0.42, this.ctx.currentTime);

    this.brownSource.connect(lowpass);
    lowpass.connect(brownGain);
    brownGain.connect(this.gainCafeBrown);
    this.brownSource.start();
  }

  // --- API Publiczne sterowania ---

  public start() {
    if (this.isRunning) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    this.initContext();
    this.isRunning = true;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.dropletTimer) window.clearTimeout(this.dropletTimer);
    if (this.vinylClickTimer) window.clearTimeout(this.vinylClickTimer);
    if (this.campfirePopTimer) window.clearTimeout(this.campfirePopTimer);
    if (this.chimesTimer) window.clearTimeout(this.chimesTimer);

    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  public isSoundscapeActive(): boolean {
    if (this.isMuted) return false;
    const { rain, vinyl, campfire, wind_chimes, cafe_brown } = this.volumes;
    return (rain + vinyl + campfire + wind_chimes + cafe_brown) > 0.05 && this.volumes.master > 0.05;
  }

  public setMasterVolume(val: number) {
    this.volumes.master = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volumes.master, this.ctx.currentTime, 0.03);
    }
    this.checkAutoStart();
    this.saveSettings();
  }

  public setChannelVolume(channel: keyof Omit<SoundscapeVolumes, 'master'>, val: number) {
    this.volumes[channel] = Math.max(0, Math.min(1, val));
    if (!this.ctx) {
      this.checkAutoStart();
      this.saveSettings();
      return;
    }

    const targetGain = this.volumes[channel];
    const now = this.ctx.currentTime;
    switch (channel) {
      case 'rain':
        this.gainRain?.gain.setTargetAtTime(targetGain, now, 0.03);
        break;
      case 'vinyl':
        this.gainVinyl?.gain.setTargetAtTime(targetGain, now, 0.03);
        break;
      case 'campfire':
        this.gainCampfire?.gain.setTargetAtTime(targetGain, now, 0.03);
        break;
      case 'wind_chimes':
        this.gainWindChimes?.gain.setTargetAtTime(targetGain, now, 0.03);
        break;
      case 'cafe_brown':
        this.gainCafeBrown?.gain.setTargetAtTime(targetGain, now, 0.03);
        break;
    }

    this.checkAutoStart();
    this.saveSettings();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volumes.master, this.ctx.currentTime, 0.03);
    }
    this.checkAutoStart();
    this.saveSettings();
    return this.isMuted;
  }

  public applyPreset(preset: SoundscapePreset) {
    if (preset.volumes.master !== undefined) this.volumes.master = preset.volumes.master;
    if (preset.volumes.rain !== undefined) this.volumes.rain = preset.volumes.rain;
    if (preset.volumes.vinyl !== undefined) this.volumes.vinyl = preset.volumes.vinyl;
    if (preset.volumes.campfire !== undefined) this.volumes.campfire = preset.volumes.campfire;
    if (preset.volumes.wind_chimes !== undefined) this.volumes.wind_chimes = preset.volumes.wind_chimes;
    if (preset.volumes.cafe_brown !== undefined) this.volumes.cafe_brown = preset.volumes.cafe_brown;

    this.isMuted = false;
    this.start();

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.volumes.master, now, 0.05);
      this.gainRain?.gain.setTargetAtTime(this.volumes.rain, now, 0.05);
      this.gainVinyl?.gain.setTargetAtTime(this.volumes.vinyl, now, 0.05);
      this.gainCampfire?.gain.setTargetAtTime(this.volumes.campfire, now, 0.05);
      this.gainWindChimes?.gain.setTargetAtTime(this.volumes.wind_chimes, now, 0.05);
      this.gainCafeBrown?.gain.setTargetAtTime(this.volumes.cafe_brown, now, 0.05);
    }

    this.saveSettings();
  }

  /**
   * Automatyczna adaptacja dźwięku w zależności od wybranego trybu wizualnego AnimeAmbienceFX
   */
  public syncWithVisualAmbience(mode: string) {
    if (!this.isAutoSyncEnabled()) return;

    switch (mode) {
      case 'neon_rain':
        this.setChannelVolume('rain', 0.65);
        this.setChannelVolume('wind_chimes', 0.1);
        break;
      case 'sakura':
        this.setChannelVolume('wind_chimes', 0.7);
        this.setChannelVolume('rain', 0.1);
        break;
      case 'embers':
        this.setChannelVolume('campfire', 0.75);
        this.setChannelVolume('vinyl', 0.25);
        break;
      case 'snow':
        this.setChannelVolume('wind_chimes', 0.4);
        this.setChannelVolume('cafe_brown', 0.4);
        break;
      case 'matrix_rain':
        this.setChannelVolume('rain', 0.5);
        this.setChannelVolume('vinyl', 0.3);
        break;
      case 'momiji':
        this.setChannelVolume('wind_chimes', 0.5);
        this.setChannelVolume('campfire', 0.3);
        break;
      default:
        break;
    }
  }

  public isAutoSyncEnabled(): boolean {
    return localStorage.getItem('auralune_soundscape_autosync') === 'true';
  }

  public setAutoSyncEnabled(enabled: boolean) {
    localStorage.setItem('auralune_soundscape_autosync', enabled ? 'true' : 'false');
  }

  private checkAutoStart() {
    if (this.isSoundscapeActive() && !this.isRunning) {
      this.start();
    } else if (!this.isSoundscapeActive() && this.isRunning) {
      // Możemy zatrzymać kontekst by oszczędzać CPU, gdy wszystkie kanały są wyzerowane
      this.stop();
    }
  }

  public getVolumes(): SoundscapeVolumes {
    return { ...this.volumes };
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const soundscapeEngine = new SoundscapeEngine();
