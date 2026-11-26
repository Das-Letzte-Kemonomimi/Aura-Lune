import React from 'react';
import { FolderOpen, Radio, X } from '../../../components/ui/icons';
import { invoke } from '../../../api/ipc';
import type { PlaybackStatus, SampleTrackDto } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { Badge, Button, Chip, IconButton, Popover, TextField } from '../../../components/ui';

export type PlayerToolbarProps = Pick<PlayerViewProps, 'setIsAudioPathModalOpen' | 'loc' | 'setIsQuickLoadOpen' | 'isQuickLoadOpen' | 'filePath' | 'setFilePath' | 'handleLoadFile'> & {
  status: PlaybackStatus;
};

const SINE_WAV = 'tests/fixtures/test_sine_440hz.wav';
const SINE_OPUS = 'tests/fixtures/test_sine_440hz.opus';

// Memo: the section does not depend on the playback position, so it does not render on every status frame.
export const PlayerToolbar: React.FC<PlayerToolbarProps> = React.memo(({
  filePath,
  handleLoadFile,
  isQuickLoadOpen,
  loc,
  setFilePath,
  setIsAudioPathModalOpen,
  setIsQuickLoadOpen,
  status,
}) => {
  const bitPerfect = status.engine === 'Bypass' && !status.equalizer_enabled;
  const close = () => setIsQuickLoadOpen(false);
  const loadAndClose = (path: string) => {
    setFilePath(path);
    handleLoadFile(path);
    close();
  };
  const loadSample = async () => {
    try {
      const sample = await invoke<SampleTrackDto | null>('get_sample_track');
      if (sample) {
        setFilePath(sample.path);
        handleLoadFile(sample.path);
      }
    } catch (e) {
      console.warn('Failed to load sample track Skrzydła Białe:', e);
    }
    close();
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="tinted"
          tone={bitPerfect ? 'green' : 'cyan'}
          size="sm"
          onClick={() => setIsAudioPathModalOpen(true)}
          title={loc.player.audioPathInspectorTooltip}
        >
          <Radio size={13} /> PipeWire {bitPerfect ? 'Bit-Perfect' : 'Hi-Fi'} • {status.engine}
        </Button>
        {status.equalizer_enabled && <Badge tone="purple">10-Band EQ</Badge>}
      </div>

      {/* Discreet file opening instead of a large text field */}
      <Popover
        open={isQuickLoadOpen}
        onClose={close}
        role="dialog"
        label={loc.player.quickLoadTitle}
        align="end"
        className="w-95 gap-3 p-4"
        trigger={
          <Chip
            pressed={isQuickLoadOpen}
            onClick={() => setIsQuickLoadOpen(!isQuickLoadOpen)}
            title={loc.player.quickLoadHint}
            aria-haspopup="dialog"
            className="px-3.5 py-2 text-ui"
          >
            <FolderOpen size={15} />
            {loc.player.openFile}
          </Chip>
        }
      >
        <div className="flex items-center justify-between">
          <span className="text-ui font-bold text-fg">{loc.player.quickLoadTitle}</span>
          <IconButton size="sm" label={loc.common.close} onClick={close}>
            <X size={15} />
          </IconButton>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleLoadFile(filePath || '');
            close();
          }}
        >
          <TextField
            mono
            aria-label={loc.player.quickLoadTitle}
            value={filePath || ''}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder={SINE_WAV}
            className="flex-1"
          />
          <Button type="submit" variant="primary">
            {loc.player.load}
          </Button>
        </form>

        <div>
          <span className="mb-1.5 block text-xs text-fg-muted">{loc.player.testSamples}</span>
          <div className="flex gap-2">
            <Button variant="tinted" tone="pink" size="sm" onClick={loadSample} className="flex-1">
              🌸 Skrzydła Białe
            </Button>
            <Button size="sm" onClick={() => loadAndClose(SINE_WAV)} className="flex-1">
              WAV 440 Hz
            </Button>
            <Button variant="tinted" tone="cyan" size="sm" onClick={() => loadAndClose(SINE_OPUS)} className="flex-1">
              Opus 48 kHz
            </Button>
          </div>
        </div>
      </Popover>
    </div>
  );
});
