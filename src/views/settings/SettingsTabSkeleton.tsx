import React from 'react';
import type { SettingsTab } from '../../types/navigation';
import { getTranslations, type Translations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { Card, Skeleton, SkeletonLoadingPill } from '../../components/ui';

function SettingsTabHeaderSkeleton({
  tone,
  loadingLabel,
  hasAction = false,
}: {
  tone: 'pink' | 'purple' | 'cyan' | 'green' | 'amber';
  loadingLabel: string;
  hasAction?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Skeleton tone={tone} className="size-11 shrink-0 rounded-2xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-44 rounded-lg" />
          <Skeleton className="h-3.5 w-64 max-w-[45vw] rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {hasAction && <Skeleton tone={tone} className="h-8 w-28 rounded-lg" />}
        <SkeletonLoadingPill label={loadingLabel} />
      </div>
    </div>
  );
}

function SettingsGroupSkeleton({
  rows,
  labelWidth = 'w-28',
  controlWidth = 'w-14',
  pillControl = true,
}: {
  rows: number;
  labelWidth?: string;
  controlWidth?: string;
  pillControl?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cnLabel(labelWidth)} />
      <Card variant="inset" padding="none" className="divide-y divide-line overflow-hidden">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-44 max-w-full rounded-md" />
              <Skeleton className="h-3 w-72 max-w-[60vw] rounded-md" />
            </div>
            <Skeleton
              shape={pillControl ? 'pill' : 'rect'}
              className={pillControl ? `h-6 shrink-0 ${controlWidth}` : `h-8 shrink-0 rounded-lg ${controlWidth}`}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}

function cnLabel(width: string): string {
  return `h-3 ${width} rounded-md ml-1`;
}

function GeneralTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="purple" loadingLabel={loadingLabel} />
      <SettingsGroupSkeleton rows={1} labelWidth="w-24" controlWidth="w-36" pillControl={false} />
      <SettingsGroupSkeleton rows={2} labelWidth="w-32" controlWidth="w-11" />
      <SettingsGroupSkeleton rows={4} labelWidth="w-36" controlWidth="w-28" />
    </div>
  );
}

function AppearanceTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="pink" loadingLabel={loadingLabel} />
      {/* Theme presets swatch grid */}
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-28 rounded-md" />
        <Card variant="inset" padding="none" className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(44),1fr))] gap-2 p-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-xl border border-line bg-card/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                {idx === 0 && <Skeleton tone="pink" shape="pill" className="h-4 w-12" />}
              </div>
              <Skeleton className="h-3 w-28 rounded-md" />
              <div className="mt-1 flex gap-1.5">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className="size-5 rounded-md" />
                <Skeleton tone="pink" className="size-5 rounded-md" />
                <Skeleton tone="purple" className="size-5 rounded-md" />
                <Skeleton tone="cyan" className="size-5 rounded-md" />
              </div>
            </div>
          ))}
        </Card>
      </div>
      {/* Scale + icon style + wallpaper */}
      <SettingsGroupSkeleton rows={3} labelWidth="w-24" controlWidth="w-32" pillControl={false} />
    </div>
  );
}

function PlaybackTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="green" loadingLabel={loadingLabel} />
      {/* Transitions with crossfade slider & chips */}
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-28 rounded-md" />
        <Card variant="inset" padding="none" className="divide-y divide-line overflow-hidden">
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton tone="green" shape="pill" className="h-2.5 w-full" />
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} shape="pill" className="h-6 w-12" />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <Skeleton className="h-4 w-44 rounded-md" />
            <Skeleton shape="pill" className="h-6 w-11" />
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton shape="pill" className="h-6 w-11" />
          </div>
        </Card>
      </div>
      <SettingsGroupSkeleton rows={2} labelWidth="w-32" controlWidth="w-36" />
      <SettingsGroupSkeleton rows={3} labelWidth="w-28" controlWidth="w-32" />
    </div>
  );
}

function AudioTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="green" loadingLabel={loadingLabel} hasAction />
      {/* Sound cards */}
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-32 rounded-md" />
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 2 }).map((_, idx) => (
            <Card key={idx} variant="inset" padding="sm" className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton tone="green" className="size-8 rounded-lg" />
                  <Skeleton className="h-4 w-48 rounded-md" />
                </div>
                <Skeleton tone="green" shape="pill" className="h-6 w-20" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Skeleton shape="pill" className="h-6 w-24" />
                <Skeleton shape="pill" className="h-6 w-28" />
                <Skeleton shape="pill" className="h-6 w-20" />
              </div>
            </Card>
          ))}
        </div>
      </div>
      <SettingsGroupSkeleton rows={4} labelWidth="w-24" controlWidth="w-36" pillControl={false} />
    </div>
  );
}

function LibraryTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="cyan" loadingLabel={loadingLabel} />
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-24 rounded-md" />
        <Card variant="inset" padding="none" className="px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-52 rounded-md" />
              <Skeleton className="h-3 w-72 max-w-[55vw] rounded-md" />
            </div>
            <Skeleton shape="pill" className="h-6 w-11 shrink-0" />
          </div>
          <div className="mt-4 flex justify-end">
            <Skeleton tone="cyan" className="h-8 w-44 rounded-lg" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function IntegrationsTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="purple" loadingLabel={loadingLabel} />
      {(['purple', 'amber', 'pink'] as const).map((tone) => (
        <div key={tone} className="flex flex-col gap-2">
          <Skeleton className="ml-1 h-3 w-28 rounded-md" />
          <Card variant="inset" padding="none" className="divide-y divide-line overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Skeleton tone={tone} className="size-9 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-56 rounded-md" />
                </div>
              </div>
              <Skeleton tone={tone} shape="pill" className="h-6 w-18" />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton tone={tone} className="h-8 w-24 rounded-lg" />
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function ExportTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="pink" loadingLabel={loadingLabel} />
      <SettingsGroupSkeleton rows={2} labelWidth="w-28" controlWidth="w-28" pillControl={false} />
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-24 rounded-md" />
        <Card variant="inset" padding="md" className="flex flex-col gap-3">
          <Skeleton shape="pill" className="h-9 w-full" />
          <Skeleton tone="pink" shape="pill" className="h-2.5 w-full" />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton tone="pink" className="h-10 w-40 rounded-lg" />
      </div>
    </div>
  );
}

function DataTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="purple" loadingLabel={loadingLabel} />
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-32 rounded-md" />
        <Card variant="inset" padding="none" className="flex flex-wrap gap-3 px-4 py-3.5">
          <Skeleton tone="purple" className="h-9 w-36 rounded-lg" />
          <Skeleton tone="cyan" className="h-9 w-36 rounded-lg" />
        </Card>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-36 rounded-md" />
        <Card variant="inset" padding="none" className="divide-y divide-line overflow-hidden">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="flex flex-col gap-2.5 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton tone="purple" className="h-8 w-28 rounded-lg" />
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function UpdatesTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      <SettingsTabHeaderSkeleton tone="cyan" loadingLabel={loadingLabel} hasAction />
      {/* Build info 2x2 grid + auto-check */}
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-24 rounded-md" />
        <Card variant="inset" padding="none" className="overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-line">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="bg-black/30 px-4 py-3">
                <Skeleton className="h-2.5 w-20 rounded-sm" />
                <Skeleton className="mt-1.5 h-4 w-28 rounded-md" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3.5">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton shape="pill" className="h-6 w-11" />
          </div>
        </Card>
      </div>
      {/* Changelog section */}
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-1 h-3 w-24 rounded-md" />
        {Array.from({ length: 2 }).map((_, idx) => (
          <Card key={idx} padding="md" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Skeleton tone="purple" shape="pill" className="h-5 w-24" />
              <Skeleton className="h-3.5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-5/6 rounded-md" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function AboutTabSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-5">
      {/* Hero with app icon + wordmark + buttons */}
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton tone="purple" className="size-16 shrink-0 rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-32 rounded-lg" />
            <Skeleton shape="pill" className="h-5 w-16" />
          </div>
          <Skeleton className="h-3.5 w-60 max-w-full rounded-md" />
          <Skeleton className="h-3 w-72 max-w-full rounded-md" />
        </div>
        <SkeletonLoadingPill label={loadingLabel} />
      </div>
      <SettingsGroupSkeleton rows={2} labelWidth="w-20" controlWidth="w-24" pillControl={false} />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {(['neutral', 'cyan', 'purple', 'green'] as const).map((tone) => (
          <Card key={tone} variant="inset" padding="sm" className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton tone={tone} className="h-4 w-40 rounded-md" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export interface SettingsTabSkeletonProps {
  tab: SettingsTab;
  loc?: Translations;
}

/** Tab-tailored skeleton shown while a lazy settings tab chunk loads or inside `SettingsModalSkeleton`. */
export const SettingsTabSkeleton: React.FC<SettingsTabSkeletonProps> = ({ tab, loc }) => {
  const safeLoc = loc?.settings?.nav && loc?.common ? loc : getTranslations('en');
  const tabLabel = tab === 'updates' ? safeLoc.updates.title : safeLoc.settings.nav[tab];
  const loadingLabel = fmt(safeLoc.common.loadingView, tabLabel);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="motion-safe:animate-fade-in"
    >
      {tab === 'general' && <GeneralTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'appearance' && <AppearanceTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'playback' && <PlaybackTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'audio' && <AudioTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'library' && <LibraryTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'integrations' && <IntegrationsTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'export' && <ExportTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'data' && <DataTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'updates' && <UpdatesTabSkeleton loadingLabel={loadingLabel} />}
      {tab === 'about' && <AboutTabSkeleton loadingLabel={loadingLabel} />}
    </div>
  );
};
