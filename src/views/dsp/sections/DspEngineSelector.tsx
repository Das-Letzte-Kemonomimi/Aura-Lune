import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { Badge, Callout, Card, Chip, OptionCard, SectionHeader, type Tone } from '../../../components/ui';
import { Cpu, Info } from '../../../components/ui/icons';

export type DspEngineSelectorProps = Pick<
  DspStudioViewProps,
  'loc' | 'handleEngineChange' | 'dspBlockSize' | 'handleSetDspBlockSize'
> & {
  status: PlaybackStatus;
};

type Engine = 'Bypass' | 'RubberBand' | 'SoundTouch';

const BLOCK_SIZES = [
  { label: '1024', value: 1024 },
  { label: '2048 (Def)', value: 2048 },
  { label: '4096', value: 4096 },
] as const;

/** Engine cards (Bypass / Rubber Band / SoundTouch), the live engine and block size, and the Bypass notice. */
export const DspEngineSelector: React.FC<DspEngineSelectorProps> = ({
  dspBlockSize,
  handleEngineChange,
  handleSetDspBlockSize,
  loc,
  status,
}) => {
  const engines: { id: Engine; title: string; desc: string; badge: string; tone: Tone }[] = [
    { id: 'Bypass', title: loc.dsp.bypass, desc: loc.dsp.bypassDesc, badge: 'DIRECT', tone: 'green' },
    { id: 'RubberBand', title: loc.dsp.rubberband, desc: loc.dsp.rubberbandDesc, badge: 'HI-FI (MSC)', tone: 'pink' },
    { id: 'SoundTouch', title: loc.dsp.soundtouch, desc: loc.dsp.soundtouchDesc, badge: 'LOW CPU', tone: 'cyan' },
  ];

  return (
    <Card>
      <SectionHeader icon={<Cpu size={18} />} tone="purple" title={loc.dsp.engine} />

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(55),1fr))] gap-3">
        {engines.map((e) => (
          <OptionCard key={e.id} pressed={status.engine === e.id} tone={e.tone} onClick={() => handleEngineChange(e.id)}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-base font-bold text-fg">{e.title}</span>
              <Badge tone={e.tone}>{e.badge}</Badge>
            </span>
            <span className="text-xs leading-snug text-fg-secondary">{e.desc}</span>
          </OptionCard>
        ))}
      </div>

      {/* Engine telemetry and the processing block size */}
      <Card variant="inset" padding="none" className="mt-4 flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 text-ui">
        <span>
          {loc.dsp.engine}: <strong className="text-accent-pink">{status.capabilities?.name || 'SoundTouch'}</strong>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-secondary">{loc.dsp.blockBufferLabel}</span>
          <span className={dspBlockSize === 2048 ? 'font-bold text-accent-green' : 'font-bold text-accent-cyan'}>
            {dspBlockSize} {loc.settings.dspBlockSizeFrames}
          </span>
          {dspBlockSize === 2048 && <Badge tone="green">{loc.settings.dspBlockSizeDefault}</Badge>}
          {BLOCK_SIZES.map((b) => (
            <Chip
              key={b.value}
              size="xs"
              tone="cyan"
              pressed={dspBlockSize === b.value}
              onClick={() => handleSetDspBlockSize(b.value)}
            >
              {b.label}
            </Chip>
          ))}
        </div>
      </Card>

      {status.engine === 'Bypass' && (
        <Callout tone="green" icon={<Info size={18} />} className="mt-4 text-ui leading-snug text-fg">
          {loc.dsp.bypassActiveNotice}
        </Callout>
      )}
    </Card>
  );
};
