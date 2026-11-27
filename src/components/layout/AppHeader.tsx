import React from 'react';
import {
  Flame,
  Activity,
  BarChart2,
  Moon,
  Mic2,
  Tv,
  Sparkles,
  Waves,
  Disc3,
  Search,
  Maximize2,
  Minimize2,
  ListMusic,
  Settings,
  ZoomIn,
} from '../ui/icons';
import { type Language, type Translations } from '../../i18n';
import { AppNavbar, type MainTabType } from './AppNavbar';
import { LanguageSelector } from '../common/LanguageSelector';
import { type AmbienceMode } from '../player/AnimeAmbienceFX';
import { cn } from '../../utils/cn';
import { Badge, Button, Chip, type Tone } from '../ui';
import { textTones } from '../ui/tones';
import { fmt } from '../../utils/fmt';

export interface AppHeaderProps {
  appVersion: string;
  /** A new version (not skipped), or a downloaded update waiting for a restart. */
  updateAvailable: boolean;
  updateTitle: string;
  onOpenUpdates: () => void;
  appIconStyle: string;
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  trackCount: number;
  playlistCount: number;
  queueCount: number;
  language: Language;
  loc: Translations;
  onOpenRecap: () => void;
  onOpenKeyBpm: () => void;
  onOpenAnalysis: () => void;
  isSleepTimerOpen?: boolean;
  onOpenSleepTimer: () => void;
  sleepTimerRemainingSec: number | null;
  sleepTimerTargetMode: 'time' | 'end_of_track' | null;
  showLyrics: boolean;
  onToggleLyrics: () => void;
  showDesktopLyrics: boolean;
  onToggleDesktopLyrics: () => void;
  ambienceMode: AmbienceMode;
  onCycleAmbience: () => void;
  isSoundscapeActive: boolean;
  onOpenSoundscape: () => void;
  onOpenHarmonicSuggester: () => void;
  onOpenCommandPalette: () => void;
  onOpenBigScreen: () => void;
  uiScale: number;
  onIncreaseScale: () => void;
  onDecreaseScale: () => void;
  onToggleMiniPlayer: () => void;
  isQueueOpen: boolean;
  onToggleQueue: () => void;
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
  onLanguageChange: (lang: Language) => void;
}

interface HeaderButtonProps extends Omit<React.ComponentProps<'button'>, 'aria-pressed'> {
  /** Colour of the icon, and of the pressed state when `pressed` is set. */
  tone?: Tone;
  /** Makes the button a toggle: idle until pressed. */
  pressed?: boolean;
  icon: React.ReactNode;
}

/** Toolbar button: coloured icon with a quiet label; a toggle lights up in its tone when on. */
function HeaderButton({ tone, pressed, icon, className, children, ...props }: HeaderButtonProps) {
  const cls = cn('h-8 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-semibold', className);
  const content = (
    <>
      <span className={cn('inline-flex', tone && textTones[tone])}>{icon}</span>
      {children}
    </>
  );
  if (pressed !== undefined) {
    return (
      <Chip pressed={pressed} tone={tone} className={cn('border-transparent bg-transparent', cls)} {...props}>
        {content}
      </Chip>
    );
  }
  return (
    <Button variant="ghost" className={cn('text-fg-secondary hover:bg-white/8 hover:text-fg', cls)} {...props}>
      {content}
    </Button>
  );
}

/** Rounded rail that groups related header buttons. */
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-0.5 rounded-2xl border border-line bg-black/25 p-1">
      {children}
    </div>
  );
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  appVersion,
  updateAvailable,
  updateTitle,
  onOpenUpdates,
  appIconStyle,
  activeTab,
  onSelectTab,
  trackCount,
  playlistCount,
  queueCount,
  language,
  loc,
  onOpenRecap,
  onOpenKeyBpm,
  onOpenAnalysis,
  onOpenSleepTimer,
  sleepTimerRemainingSec,
  sleepTimerTargetMode,
  showLyrics,
  onToggleLyrics,
  showDesktopLyrics,
  onToggleDesktopLyrics,
  ambienceMode,
  onCycleAmbience,
  isSoundscapeActive,
  onOpenSoundscape,
  onOpenHarmonicSuggester,
  onOpenCommandPalette,
  onOpenBigScreen,
  uiScale,
  onIncreaseScale,
  onDecreaseScale,
  onToggleMiniPlayer,
  isQueueOpen,
  onToggleQueue,
  isSettingsOpen,
  onOpenSettings,
  onLanguageChange,
}) => {
  const sleepActive = sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track';
  return (
    <header className="relative z-30 mb-3 flex min-w-0 shrink-0 flex-col gap-2">
      {/* Row 1: brand on the left, the main tabs on the right */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* App logo and name */}
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <span className="rounded-sm border border-accent-purple/40 bg-accent-purple/25 px-1.5 py-0.5 text-2xs leading-none font-bold tracking-wide text-accent-purple">
              v{appVersion}
            </span>
            <img
              src={appIconStyle === 'classic' ? '/icon_classic_128.png' : '/icon_lineout_128.png'}
              alt="Auralune Logo"
              className={cn(
                'size-9 shrink-0 rounded-xl border border-line-accent bg-black/25 object-contain shadow-halo-lg',
                appIconStyle === 'classic' ? 'shadow-accent-purple/45' : 'p-0.5 shadow-accent-pink/45',
              )}
            />
          </div>
          {/* With the update pill: the pill is level with the version badge (top), the title level with the logo (bottom). */}
          <div className={cn('flex min-w-0 flex-col items-start', updateAvailable && 'self-stretch justify-between')}>
            {updateAvailable && (
              <button
                type="button"
                onClick={onOpenUpdates}
                title={updateTitle}
                aria-label={updateTitle}
                className="inline-flex items-center gap-1 rounded-md border border-accent-green/35 bg-accent-green/15 px-1.5 py-0.5 text-2xs leading-none font-bold text-accent-green"
              >
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-green motion-safe:animate-update-dot" />
                {loc.updates.badge}
              </button>
            )}
            <h1 className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight whitespace-nowrap sm:text-2xl">
              <span>Auralune</span>
              <span className="text-lg font-semibold text-accent-pink">狐</span>
            </h1>
          </div>
        </div>

        <AppNavbar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          trackCount={trackCount}
          playlistCount={playlistCount}
          language={language}
          loc={loc}
        />
      </div>

      {/* Row 2: tools in groups, settings and language at the end */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Button
          onClick={onOpenRecap}
          title={loc.nav.recapTitle}
          className="h-9 shrink-0 gap-1.5 rounded-2xl border-accent-pink/45 bg-linear-135 from-accent-pink/25 to-accent-purple/25 px-3 text-xs font-bold text-fg shadow-halo-sm shadow-accent-pink/20"
        >
          <Flame size={15} className="text-accent-pink" />
          <span className="max-nav:hidden">{loc.nav.recap}</span>
        </Button>

        <ToolGroup label={loc.nav.analysisBtn}>
          <HeaderButton icon={<Activity size={15} />} tone="cyan" onClick={onOpenKeyBpm} title={loc.nav.keyBpmTitle}>
            <span className="max-nav:hidden">Key & BPM</span>
          </HeaderButton>
          <HeaderButton icon={<BarChart2 size={15} />} tone="pink" onClick={onOpenAnalysis} title={loc.nav.analysisTitle}>
            <span className="max-nav:hidden">{loc.nav.analysisBtn}</span>
          </HeaderButton>
          <HeaderButton icon={<Disc3 size={15} />} tone="pink" onClick={onOpenHarmonicSuggester} title={loc.nav.harmonicSuggester + ' (Camelot & BPM)'}>
            <span className="max-nav:hidden">{loc.nav.harmonicDj}</span>
          </HeaderButton>
        </ToolGroup>

        <ToolGroup label={loc.nav.lyrics}>
          <HeaderButton icon={<Mic2 size={15} />} tone="cyan" pressed={showLyrics} onClick={onToggleLyrics} title={loc.shortcuts.lyrics}>
            <span className="max-nav:hidden">{loc.nav.lyrics}</span>
          </HeaderButton>
          <HeaderButton
            icon={<Tv size={15} />}
            tone="purple"
            pressed={showDesktopLyrics}
            onClick={onToggleDesktopLyrics}
            title={loc.lyricsView?.desktopLyricsToggle || 'Pulpit HUD / Tekst (Desktop Lyrics)'}
          >
            <span className="max-nav:hidden">{loc.nav.desktopLrc}</span>
          </HeaderButton>
        </ToolGroup>

        <ToolGroup label={loc.nav.effects}>
          <HeaderButton icon={<Sparkles size={15} />} tone="pink" pressed={ambienceMode !== 'off'} onClick={onCycleAmbience} title={`Ambience: ${ambienceMode}`}>
            <span className="max-nav:hidden">
              {ambienceMode === 'sakura'
              ? 'Sakura 🌸'
              : ambienceMode === 'neon_rain'
                ? 'Neon 🌧️'
                : ambienceMode === 'fireflies'
                  ? loc.player.ambienceFireflies
                  : ambienceMode === 'snow'
                    ? loc.player.ambienceSnow
                    : ambienceMode === 'meteor_shower'
                      ? loc.player.ambienceMeteors
                      : ambienceMode === 'matrix_rain'
                        ? 'Matrix 🟩'
                        : ambienceMode === 'momiji'
                          ? 'Momiji 🍁'
                          : ambienceMode === 'embers'
                            ? loc.player.ambienceEmbers
                            : loc.nav.effects}
            </span>
          </HeaderButton>
          <HeaderButton
            icon={<Waves size={15} />}
            tone="green"
            pressed={isSoundscapeActive}
            onClick={onOpenSoundscape}
            title={loc.nav.soundscape + ' (Lofi Ambience)'}
          >
            <span className="max-nav:hidden">{loc.nav.soundscape}</span>
          </HeaderButton>
          <HeaderButton
            icon={<Moon size={15} className={cn(sleepTimerRemainingSec !== null && 'text-accent-cyan')} />}
            tone="purple"
            pressed={sleepActive}
            onClick={onOpenSleepTimer}
            title={loc.player.sleepTimer}
          >
            <span className="max-nav:hidden">
              {sleepTimerRemainingSec !== null
                ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
                : sleepTimerTargetMode === 'end_of_track'
                  ? loc.player.timerEnd
                  : 'Timer'}
            </span>
          </HeaderButton>
        </ToolGroup>

        {/* Pushes the view and app controls to the right edge */}
        <div className="min-w-0 flex-1" />

        <ToolGroup label={loc.nav.fullscreen}>
          <HeaderButton icon={<Search size={15} />} tone="purple" onClick={onOpenCommandPalette} title="Command Palette / Search (Ctrl + K)">
            <kbd className="rounded-sm border border-line bg-white/5 px-1 font-mono text-2xs">Ctrl K</kbd>
          </HeaderButton>
          <HeaderButton icon={<Maximize2 size={15} />} onClick={onOpenBigScreen} title={loc.shortcuts.fullscreen}>
            <span className="max-nav:hidden">{loc.nav.fullscreen}</span>
          </HeaderButton>
          <HeaderButton icon={<Minimize2 size={15} />} onClick={onToggleMiniPlayer} title={loc.shortcuts.miniPlayer}>
            <span className="max-nav:hidden">{loc.nav.miniPlayer}</span>
          </HeaderButton>
          {/* UI scale: click to enlarge, right-click to shrink */}
          <HeaderButton
            icon={<ZoomIn size={15} />}
            tone="cyan"
            pressed={uiScale > 1.0}
            onClick={onIncreaseScale}
            onContextMenu={(e) => {
              e.preventDefault();
              onDecreaseScale();
            }}
            title={fmt(loc.nav.uiScaleTooltip, String(Math.round(uiScale * 100)))}
          >
            <span className="font-mono tabular-nums">{Math.round(uiScale * 100)}%</span>
          </HeaderButton>
        </ToolGroup>

        <ToolGroup label={loc.nav.queue}>
          <HeaderButton icon={<ListMusic size={15} />} tone="pink" pressed={isQueueOpen} onClick={onToggleQueue} title={`${loc.nav.queue} (${queueCount})`}>
            <span className="max-nav:hidden">{loc.nav.queue}</span>
            <Badge tone="pink" size="xs" mono className="font-bold">
              {queueCount}
            </Badge>
          </HeaderButton>
          <HeaderButton icon={<Settings size={15} />} tone="purple" pressed={isSettingsOpen} onClick={onOpenSettings} title={loc.settings.title}>
            <span className="max-nav:hidden">{loc.settings.title}</span>
          </HeaderButton>
        </ToolGroup>

        <ToolGroup label={loc.settings.language}>
          <LanguageSelector variant="toolbar" currentLang={language} onLanguageChange={onLanguageChange} />
        </ToolGroup>
      </div>
    </header>
  );
};
