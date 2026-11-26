import React from 'react';
import type { Translations } from '../../../i18n';
import { Minimize2, Radio, Zap, Mic2, Music, Layers } from '../../../components/ui/icons';
import type { BigScreenViewProps } from '../BigScreenView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';
import { Badge, Button, Chip } from '../../../components/ui';

export type BigScreenHudProps = Pick<BigScreenViewProps, 'format' | 'pitchSemitones' | 'tempoRatio' | 'currentChord' | 'onCreateStemProject' | 'onClose'> & {
  showHud: boolean;
  t: Translations;
  setShowLyrics: Dispatch<SetStateAction<boolean>>;
  showLyrics: boolean;
};

export const BigScreenHud: React.FC<BigScreenHudProps> = ({
  currentChord,
  format,
  onClose,
  onCreateStemProject,
  pitchSemitones,
  setShowLyrics,
  showHud,
  showLyrics,
  t,
  tempoRatio,
}) => (
    <div
      className={cn(
        'flex items-center justify-between transition-opacity duration-300',
        showHud ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex items-center gap-3">
        <Badge tone="cyan" className="gap-1.5 px-3 py-1 text-ui">
          <Radio size={14} /> PipeWire Hi-Fi • {format || 'FLAC'}
        </Badge>
        {(Math.abs(pitchSemitones) > 0.05 || Math.abs(tempoRatio - 1.0) > 0.02) && (
          <Badge tone="pink" className="px-2.5 py-1 text-ui">
            <Zap size={12} /> DSP: {tempoRatio.toFixed(2)}x
          </Badge>
        )}
        {currentChord && (
          <Badge tone="pink" mono title={t.player.currentChord} className="gap-1.5 px-3 py-1 text-sm font-extrabold shadow-halo shadow-accent-pink/40">
            <Music size={14} /> {currentChord}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {onCreateStemProject && (
          <Button variant="tinted" tone="pink" size="lg" onClick={onCreateStemProject} title={t.bigScreen.createStemProject}>
            <Layers size={16} />
            {t.bigScreen.stemProject}
          </Button>
        )}

        <Chip tone="purple" pressed={showLyrics} onClick={() => setShowLyrics(!showLyrics)} className="px-5 py-2.5 text-sm">
          <Mic2 size={16} />
          {t.nav.lyrics}
        </Chip>
        <Button size="lg" onClick={onClose} title={`${t.common.close} (Esc / F11)`}>
          <Minimize2 size={16} />
          {t.common.close} (Esc)
        </Button>
      </div>
    </div>
);
