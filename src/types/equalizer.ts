export interface EqualizerPreset {
  name: string;
  bands: number[];
}

export const EQUALIZER_BANDS = [
  { freq: '31 Hz', label: 'Sub-bass' },
  { freq: '62 Hz', label: 'Bass' },
  { freq: '125 Hz', label: 'Mid-bass' },
  { freq: '250 Hz', label: 'Low Mids' },
  { freq: '500 Hz', label: 'Mids' },
  { freq: '1 kHz', label: 'Upper Mids' },
  { freq: '2 kHz', label: 'Presence' },
  { freq: '4 kHz', label: 'Treble' },
  { freq: '8 kHz', label: 'High Treble' },
  { freq: '16 kHz', label: 'Air' },
];
