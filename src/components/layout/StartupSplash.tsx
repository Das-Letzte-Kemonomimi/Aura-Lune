import React from 'react';
import type { Translations } from '../../i18n';
import type { BootStage, BootState } from '../../hooks/useAppBootstrap';
import { cn } from '../../utils/cn';
import { Badge, ProgressBar } from '../ui';

export interface StartupSplashProps {
  bootState: BootState;
  appVersion: string;
  loc: Translations;
}

function getStageLabel(stage: BootStage, loc: Translations): string {
  switch (stage) {
    case 'themes':
      return loc.startup.loadingThemes;
    case 'settings':
      return loc.startup.loadingSettings;
    case 'devices':
      return loc.startup.loadingDevices;
    case 'queue':
      return loc.startup.loadingQueue;
    case 'library':
      return loc.startup.loadingLibrary;
    case 'ready':
      return loc.startup.ready;
  }
}

/**
 * Full-screen startup overlay shown while initial settings, theme, audio devices,
 * queue, and music library are hydrated from the Rust backend.
 */
export const StartupSplash: React.FC<StartupSplashProps> = ({
  bootState,
  appVersion,
  loc,
}) => {
  const stageLabel = getStageLabel(bootState.stage, loc);
  const formattedVersion = appVersion
    ? appVersion.startsWith('v')
      ? appVersion
      : `v${appVersion}`
    : '';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!bootState.isExiting}
      aria-label={loc.startup.initializing}
      className={cn(
        'fixed inset-0 z-130 flex flex-col items-center justify-center overflow-hidden bg-deep px-6 text-center transition-opacity duration-300 ease-out motion-reduce:transition-none',
        bootState.isExiting ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      {/* Ambient theme-aware glow orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-accent-purple/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1/4 left-1/3 size-72 rounded-full bg-accent-cyan/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Emblem with subtle rotating halo */}
        <div className="relative flex size-26 items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-line-accent/60 shadow-halo-2xl shadow-accent-purple/30 motion-safe:animate-spin-slow"
          />
          <div className="relative flex size-22 items-center justify-center rounded-full border border-line bg-surface/80 backdrop-blur-md">
            <img
              src="/icon_lineout.svg"
              alt=""
              aria-hidden="true"
              className="size-16 select-none"
            />
          </div>
        </div>

        {/* Wordmark and optional version badge */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-fg text-shadow-soft">
              Auralune
            </h1>
            {formattedVersion && (
              <Badge tone="purple" size="xs" mono>
                {formattedVersion}
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium tracking-wide text-fg-secondary">
            {loc.startup.initializing}
          </p>
        </div>

        {/* Progress bar, mini equalizer pulse, and localized stage readout */}
        <div className="flex w-60 flex-col items-center gap-2.5">
          <ProgressBar value={bootState.progress} size="sm" label={stageLabel} />
          <div className="flex w-full items-center justify-between gap-2 text-xs text-fg-muted">
            <span className="flex items-center gap-2 truncate">
              <span aria-hidden="true" className="inline-flex h-3 items-end gap-0.5">
                <span className="h-full w-0.5 origin-bottom rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.8s]" />
                <span className="h-3/5 w-0.5 origin-bottom rounded-xs bg-accent-purple motion-safe:animate-eq-bar [animation-duration:0.6s] [animation-delay:0.2s]" />
                <span className="h-4/5 w-0.5 origin-bottom rounded-xs bg-accent-cyan motion-safe:animate-eq-bar [animation-duration:0.7s] [animation-delay:0.35s]" />
              </span>
              <span className="truncate">{stageLabel}</span>
            </span>
            <span className="shrink-0 font-mono text-xxs text-fg-secondary">
              {bootState.progress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
