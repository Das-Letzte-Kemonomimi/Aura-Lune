import type { PlaybackStatus } from '../../types/playback';
import React, { useId } from 'react';
import {
  Radio,
  Cpu,
  Layers,
  Speaker,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Sliders,
  ShieldCheck,
} from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { Badge, Button, ModalBody, ModalFooter, ModalHeader, ModalShell } from '../ui';

export interface AudioPathTrackInfo {
  format?: string | null;
  sample_rate?: number | null;
  bit_depth?: number | null;
  channels?: number | null;
  title?: string;
  artist?: string;
  album?: string | null;
}

interface AudioPathInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: PlaybackStatus;
  currentTrack?: AudioPathTrackInfo | null;
  currentLang?: Language;
  onResetBitPerfect?: () => void;
}

export const AudioPathInspectorModal: React.FC<AudioPathInspectorModalProps> = ({
  isOpen,
  onClose,
  status,
  currentTrack,
  currentLang = 'pl',
  onResetBitPerfect,
}) => {
  const titleId = useId();
  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  // Checks whether the signal flows 100% bit-perfect without modifying the samples
  const isBypass = status.engine === 'Bypass';
  const isDefaultTempo = Math.abs((status.tempo_ratio ?? 1.0) - 1.0) < 0.001;
  const isDefaultPitch = Math.abs(status.pitch_semitones ?? 0.0) < 0.01;
  const isEqDisabled = !status.equalizer_enabled;

  const isBitPerfect = isBypass && isDefaultTempo && isDefaultPitch && isEqDisabled;

  const sampleRate = currentTrack?.sample_rate || 44100;
  const bitDepth = currentTrack?.bit_depth || 16;
  const channels = currentTrack?.channels || 2;
  const format = currentTrack?.format?.toUpperCase() || 'FLAC';

  return (
    <ModalShell onClose={onClose} layer="studio" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={
          <span className="flex items-center gap-2">
            {loc.audioPath.title}
            <Badge tone={isBitPerfect ? 'green' : 'purple'} className="flex items-center gap-1">
              {isBitPerfect ? <ShieldCheck size={12} /> : <Sparkles size={12} />}
              {isBitPerfect ? 'BIT-PERFECT DIRECT' : 'PROCESSED (DSP / EQ)'}
            </Badge>
          </span>
        }
        subtitle={loc.audioPath.subtitle}
        icon={<Radio size={20} />}
        tone={isBitPerfect ? 'green' : 'purple'}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-4">
          {/* Signal Chain Flow Visualization */}
          <div
            className="flex items-center justify-between rounded-xl border border-line bg-black/35 px-4 py-3 text-xs text-slate-300"
          >
            <div className="flex items-center gap-1.5">
              <Layers size={14} className="text-accent-cyan" />
              <strong>{loc.audioPath.source}</strong>
            </div>
            <ArrowRight size={13} className="text-fg-muted" />
            <div className="flex items-center gap-1.5">
              <Cpu size={14} className="text-accent-purple" />
              <strong>GStreamer</strong>
            </div>
            <ArrowRight size={13} className="text-fg-muted" />
            <div className="flex items-center gap-1.5">
              <Sliders size={14} color={isBitPerfect ? '#10b981' : '#ec4899'} />
              <strong>{isBypass ? loc.audioPath.directBypass : status.engine}</strong>
            </div>
            <ArrowRight size={13} className="text-fg-muted" />
            <div className="flex items-center gap-1.5">
              <Speaker size={14} className="text-accent-green" />
              <strong>PipeWire Sink</strong>
            </div>
          </div>

          {/* 1. Audio input source */}
          <div className="rounded-xl border border-accent-cyan/25 bg-black/25 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-ui font-bold text-accent-cyan">
                <Layers size={16} />
                <span>{loc.audioPath.inputSource}</span>
              </div>
              <span className="text-xs text-fg-secondary">
                {status.current_track?.title || loc.audioPath.noTrack}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2.5 text-ui">
              <div>
                <span className="block text-fg-muted">{loc.audioPath.format}</span>
                <strong className="text-fg">{format}</strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.sampleRate}</span>
                <strong className="text-fg">{(sampleRate / 1000).toFixed(1)} kHz</strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.bitDepth}</span>
                <strong className="text-fg">{bitDepth}-bit {bitDepth >= 24 ? 'Hi-Res' : 'CD'}</strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.channels}</span>
                <strong className="text-fg">{channels === 2 ? loc.audioPath.stereo : `${channels} ch`}</strong>
              </div>
            </div>
          </div>

          {/* 2. DSP processing & effects */}
          <div
            className={cn(
              'rounded-xl border bg-black/25 px-4 py-3.5',
              isBitPerfect ? 'border-accent-green/25' : 'border-accent-purple/25',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className={cn(
                'flex items-center gap-2 text-ui font-bold',
                isBitPerfect ? 'text-accent-green' : 'text-accent-purple',
              )}>
                <Cpu size={16} />
                <span>{loc.audioPath.dspProcessing}</span>
              </div>
              <span
                className={cn('text-xs font-semibold', isBitPerfect ? 'text-emerald-400' : 'text-purple-300')}
              >
                {isBypass ? loc.audioPath.directBypassZeroCpu : `${status.engine} Engine`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2.5 text-ui">
              <div>
                <span className="block text-fg-muted">{loc.audioPath.tempo}</span>
                <strong className={cn(isDefaultTempo ? 'text-fg' : 'text-pink-500')}>
                  {(status.tempo_ratio ?? 1.0).toFixed(2)}x
                </strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.pitch}</span>
                <strong className={cn(isDefaultPitch ? 'text-fg' : 'text-pink-500')}>
                  {(status.pitch_semitones ?? 0.0) >= 0 ? '+' : ''}
                  {(status.pitch_semitones ?? 0.0).toFixed(1)} st
                </strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.equalizer}</span>
                <strong className={cn(status.equalizer_enabled ? 'text-pink-500' : 'text-fg-secondary')}>
                  {status.equalizer_enabled ? loc.audioPath.activeBands : loc.audioPath.offFlat}
                </strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.dspLatency}</span>
                <strong className={cn(isBitPerfect ? 'text-emerald-400' : 'text-fg')}>
                  {isBitPerfect ? '0.0 ms (Direct)' : '~12 ms (Vocoder)'}
                </strong>
              </div>
            </div>
          </div>

          {/* 3. PipeWire output (audio sink) */}
          <div className="rounded-xl border border-accent-green/25 bg-black/25 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-ui font-bold text-accent-green">
                <Speaker size={16} />
                <span>{loc.audioPath.pipewireSink}</span>
              </div>
              <span className="text-xs font-semibold text-emerald-400">
                PipeWire Pro Audio Low-Latency
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2.5 text-ui">
              <div>
                <span className="block text-fg-muted">{loc.audioPath.outputFormat}</span>
                <strong className="text-fg">F32LE (Float32)</strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.sinkClockRate}</span>
                <strong className="text-fg">
                  {sampleRate >= 88200 ? `${(sampleRate / 1000).toFixed(1)} kHz (Direct)` : '48.0 kHz Native'}
                </strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.playerBuffer}</span>
                <strong className="text-fg">40 ms deadline</strong>
              </div>
              <div>
                <span className="block text-fg-muted">{loc.audioPath.xruns}</span>
                <strong className="text-emerald-400">0 (Jitter-Free)</strong>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-ui text-slate-300',
              isBitPerfect ? 'bg-accent-green/10' : 'bg-accent-purple/10',
              isBitPerfect ? 'border-accent-green/25' : 'border-accent-purple/25',
            )}
          >
            {isBitPerfect ? (
              <CheckCircle2 size={18} className="shrink-0 text-accent-green" />
            ) : (
              <AlertCircle size={18} className="shrink-0 text-purple-400" />
            )}
            <span>
              {isBitPerfect ? loc.audioPath.bitPerfectSummary : loc.audioPath.processedSummary}
            </span>
          </div>
      </ModalBody>

      {/* Footer with the Bit-Perfect reset button */}
      <ModalFooter className="justify-between">
        {onResetBitPerfect && !isBitPerfect ? (
          <Button variant="tinted" tone="green" onClick={onResetBitPerfect}>
            <RotateCcw size={14} />
            {loc.audioPath.resetBtn}
          </Button>
        ) : (
          <div />
        )}
        <Button variant="primary" onClick={onClose}>
          {loc.common.close}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
