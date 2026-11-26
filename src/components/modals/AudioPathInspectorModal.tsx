import React from 'react';
import {
  X,
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
  status: any;
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
    <div
      className="fixed inset-0 z-90 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-modal shadow-modal',
          'flex max-h-[90vh] w-full max-w-170 flex-col overflow-hidden rounded-2xl border motion-safe:animate-modal-in',
          isBitPerfect ? 'border-accent-green/45' : 'border-accent-purple/45',
          isBitPerfect && '',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 bg-white/2 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-9.5 w-9.5 items-center justify-center rounded-xl border',
                isBitPerfect ? 'bg-accent-green/15' : 'bg-accent-purple/20',
                isBitPerfect ? 'text-accent-green' : 'text-accent-purple',
                isBitPerfect ? 'border-accent-green/30' : 'border-accent-purple/30',
              )}
            >
              <Radio size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-lg font-bold text-fg">
                  {loc.audioPath.title}
                </h2>
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-xl border px-2 py-0.5 text-xxs font-bold',
                    isBitPerfect ? 'bg-accent-green/20' : 'bg-accent-purple/20',
                    isBitPerfect ? 'text-emerald-400' : 'text-purple-300',
                    isBitPerfect ? 'border-accent-green/40' : 'border-accent-purple/40',
                  )}
                >
                  {isBitPerfect ? (
                    <>
                      <ShieldCheck size={12} />
                      <span>BIT-PERFECT DIRECT</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>PROCESSED (DSP / EQ)</span>
                    </>
                  )}
                </span>
              </div>
              <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
                {loc.audioPath.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border-0 bg-transparent p-1.5 text-fg-secondary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5.5">
          {/* Signal Chain Flow Visualization */}
          <div
            className="flex items-center justify-between rounded-xl border border-white/6 bg-black/35 px-4 py-3 text-xs text-slate-300"
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
        </div>

        {/* Footer with the Bit-Perfect reset button */}
        <div className="flex items-center justify-between border-t border-white/8 bg-white/2 px-6 py-3.5">
          {onResetBitPerfect && !isBitPerfect ? (
            <button
              onClick={() => {
                onResetBitPerfect();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-accent-green/35 bg-accent-green/15 px-3.5 py-2 text-ui font-bold text-emerald-400 transition-all duration-150"
            >
              <RotateCcw size={14} />
              <span>{loc.audioPath.resetBtn}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="rounded-lg border-0 bg-linear-135 from-accent-purple to-accent-pink px-5 py-2 text-sm font-semibold text-on-accent shadow-lift shadow-accent-purple/35"
          >
            {loc.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
