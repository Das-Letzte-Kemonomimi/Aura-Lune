import React from 'react';
import { FolderOpen, Radio, X } from 'lucide-react';
import { invoke } from '../../../api/ipc';
import type { PlaybackStatus, SampleTrackDto } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';

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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setIsAudioPathModalOpen(true)}
          title={loc.player.audioPathInspectorTooltip}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: status.engine === 'Bypass' && !status.equalizer_enabled
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(6, 182, 212, 0.15)',
            border: status.engine === 'Bypass' && !status.equalizer_enabled
              ? '1px solid rgba(16, 185, 129, 0.45)'
              : '1px solid rgba(6, 182, 212, 0.45)',
            color: status.engine === 'Bypass' && !status.equalizer_enabled
              ? '#34d399'
              : 'var(--accent-cyan)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <Radio size={13} /> PipeWire {status.engine === 'Bypass' && !status.equalizer_enabled ? 'Bit-Perfect' : 'Hi-Fi'} • {status.engine}
        </button>

        {status.equalizer_enabled && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '20px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              color: 'var(--accent-purple)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            10-Band EQ
          </span>
        )}
      </div>

      {/* Dyskretne otwieranie pliku zamiast wielkiego pola tekstowego */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsQuickLoadOpen(!isQuickLoadOpen)}
          className="glass-card"
          style={{
            padding: '7px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: isQuickLoadOpen ? 'var(--accent-pink)' : 'var(--text-secondary)',
            border: isQuickLoadOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          title={loc.player.quickLoadHint}
        >
          <FolderOpen size={15} />
          <span>{loc.player.openFile}</span>
        </button>

        {/* Zwijany elegancki dropdown szybkiego ładowania */}
        {isQuickLoadOpen && (
          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '8px',
              width: '380px',
              padding: '16px',
              zIndex: 50,
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65)',
              border: '1px solid var(--border-accent)',
              borderRadius: '14px',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{loc.player.quickLoadTitle}</span>
              <button
                onClick={() => setIsQuickLoadOpen(false)}
                style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={filePath || ''}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="tests/fixtures/test_sine_440hz.wav"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(0,0,0,0.4)',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              />
              <button
                onClick={() => {
                  handleLoadFile(filePath || '');
                  setIsQuickLoadOpen(false);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                {loc.player.load}
              </button>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                {loc.player.testSamples}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                  className="glass-card"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-pink)', textAlign: 'center', fontWeight: 600 }}
                >
                  🌸 Skrzydła Białe
                </button>
                <button
                  onClick={() => {
                    setFilePath('tests/fixtures/test_sine_440hz.wav');
                    handleLoadFile('tests/fixtures/test_sine_440hz.wav');
                    setIsQuickLoadOpen(false);
                  }}
                  className="glass-card"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}
                >
                  WAV 440 Hz
                </button>
                <button
                  onClick={() => {
                    setFilePath('tests/fixtures/test_sine_440hz.opus');
                    handleLoadFile('tests/fixtures/test_sine_440hz.opus');
                    setIsQuickLoadOpen(false);
                  }}
                  className="glass-card"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-cyan)', textAlign: 'center' }}
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
