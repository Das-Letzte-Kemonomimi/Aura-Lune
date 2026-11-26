import React from 'react';
import { FolderOpen, Radio, X } from 'lucide-react';
import { invoke } from '../../../api/ipc';
import type { PlaybackStatus, SampleTrackDto } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { cn } from '../../../utils/cn';

export type PlayerToolbarProps = Pick<PlayerViewProps, 'setIsAudioPathModalOpen' | 'loc' | 'setIsQuickLoadOpen' | 'isQuickLoadOpen' | 'filePath' | 'setFilePath' | 'handleLoadFile'> & {
  status: PlaybackStatus;
};

// Memo: sekcja nie zależy od pozycji odtwarzania — nie renderuje się w każdej klatce statusu.
export const PlayerToolbar: React.FC<PlayerToolbarProps> = React.memo(({
  filePath,
  handleLoadFile,
  isQuickLoadOpen,
  loc,
  setFilePath,
  setIsAudioPathModalOpen,
  setIsQuickLoadOpen,
  status,
}) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsAudioPathModalOpen(true)}
          title={loc.player.audioPathInspectorTooltip}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-3xl border px-3 py-1 text-xs font-bold shadow-md shadow-black/20 transition-all duration-150',
            status.engine === 'Bypass' && !status.equalizer_enabled ? 'border-accent-green/45 bg-accent-green/15 text-emerald-400' : 'border-accent-cyan/45 bg-accent-cyan/15 text-accent-cyan',
          )}
        >
          <Radio size={13} /> PipeWire {status.engine === 'Bypass' && !status.equalizer_enabled ? 'Bit-Perfect' : 'Hi-Fi'} • {status.engine}
        </button>

        {status.equalizer_enabled && (
          <span
            className="inline-flex items-center gap-1 rounded-3xl border border-accent-purple/35 bg-accent-purple/15 px-2.5 py-1 text-xs font-bold text-accent-purple"
          >
            10-Band EQ
          </span>
        )}
      </div>

      {/* Dyskretne otwieranie pliku zamiast wielkiego pola tekstowego */}
      <div className="relative">
        <button
          onClick={() => setIsQuickLoadOpen(!isQuickLoadOpen)}
          className={cn(
            'glass-card flex items-center gap-2 rounded-lg border px-3.5 py-2 text-ui font-semibold',
            isQuickLoadOpen ? 'border-accent-pink text-accent-pink' : 'border-line text-fg-secondary',
          )}
          title={loc.player.quickLoadHint}
        >
          <FolderOpen size={15} />
          <span>{loc.player.openFile}</span>
        </button>

        {/* Zwijany elegancki dropdown szybkiego ładowania */}
        {isQuickLoadOpen && (
          <div
            className="glass-panel absolute top-full right-0 z-20 mt-2 w-95 rounded-2xl border border-line-accent bg-surface p-4 shadow-2xl shadow-black/65"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-ui font-bold text-fg">{loc.player.quickLoadTitle}</span>
              <button
                onClick={() => setIsQuickLoadOpen(false)}
                className="flex bg-transparent text-fg-muted"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={filePath || ''}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="tests/fixtures/test_sine_440hz.wav"
                className="flex-1 rounded-lg border border-line bg-black/40 px-3 py-2 font-mono text-ui text-fg"
              />
              <button
                onClick={() => {
                  handleLoadFile(filePath || '');
                  setIsQuickLoadOpen(false);
                }}
                className="rounded-lg bg-accent-gradient px-3.5 py-2 text-ui font-bold text-on-accent"
              >
                {loc.player.load}
              </button>
            </div>

            <div>
              <span className="mb-1.5 block text-xs text-fg-muted">
                {loc.player.testSamples}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const sample = await invoke<SampleTrackDto | null>('get_sample_track');
                      if (sample) {
                        setFilePath(sample.path);
                        handleLoadFile(sample.path);
                      }
                    } catch (e) {
                      console.warn('Failed to load sample track Skrzydła Białe:', e);
                    }
                    setIsQuickLoadOpen(false);
                  }}
                  className="glass-card flex-1 px-2.5 py-1.5 text-center text-xs font-semibold text-accent-pink"
                >
                  🌸 Skrzydła Białe
                </button>
                <button
                  onClick={() => {
                    setFilePath('tests/fixtures/test_sine_440hz.wav');
                    handleLoadFile('tests/fixtures/test_sine_440hz.wav');
                    setIsQuickLoadOpen(false);
                  }}
                  className="glass-card flex-1 px-2.5 py-1.5 text-center text-xs text-fg-secondary"
                >
                  WAV 440 Hz
                </button>
                <button
                  onClick={() => {
                    setFilePath('tests/fixtures/test_sine_440hz.opus');
                    handleLoadFile('tests/fixtures/test_sine_440hz.opus');
                    setIsQuickLoadOpen(false);
                  }}
                  className="glass-card flex-1 px-2.5 py-1.5 text-center text-xs text-accent-cyan"
                >
                  Opus 48 kHz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
));
