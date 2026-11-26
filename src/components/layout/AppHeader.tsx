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
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import { AppNavbar, type MainTabType } from './AppNavbar';
import { LanguageSelector } from '../common/LanguageSelector';
import { type AmbienceMode } from '../player/AnimeAmbienceFX';
import { cn } from '../../utils/cn';
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

type HeaderTone = 'pink' | 'purple' | 'cyan' | 'sky';

/** Always-tinted action (opens a tool). */
const tintedTones: Record<HeaderTone, string> = {
  pink: 'border-accent-pink/35 bg-accent-pink/15 text-accent-pink',
  purple: 'border-accent-purple/35 bg-accent-purple/15 text-accent-purple',
  cyan: 'border-accent-cyan/35 bg-accent-cyan/15 text-accent-cyan',
  sky: 'border-sky-400/35 bg-sky-400/15 text-sky-400',
};

/** Pressed toggle (`aria-pressed`). */
const pressedTones: Record<HeaderTone, string> = {
  pink: 'aria-pressed:border-accent-pink aria-pressed:bg-accent-pink/25 aria-pressed:text-accent-pink',
  purple:
    'aria-pressed:border-accent-purple aria-pressed:bg-accent-purple/25 aria-pressed:text-accent-purple aria-pressed:shadow-halo aria-pressed:shadow-accent-purple/35',
  cyan: 'aria-pressed:border-accent-cyan aria-pressed:bg-accent-cyan/20 aria-pressed:text-accent-cyan',
  sky: 'aria-pressed:border-sky-400 aria-pressed:bg-sky-400/20 aria-pressed:text-sky-400',
};

interface HeaderButtonProps extends React.ComponentProps<'button'> {
  /** Tinted action, or with `pressed` the colour of the pressed state. */
  tone?: HeaderTone;
  /** Makes the button a toggle: idle until pressed. */
  pressed?: boolean;
}

/** Toolbar button: tinted action, toggle (idle → pressed tone) or plain. */
function HeaderButton({ tone, pressed, className, ...props }: HeaderButtonProps) {
  const isToggle = pressed !== undefined;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'flex shrink-0 items-center gap-1.5 border px-2.5 py-2 text-ui font-semibold',
        isToggle || !tone ? 'border-line bg-white/5 text-fg-secondary hover:text-fg' : tintedTones[tone],
        isToggle && tone && pressedTones[tone],
        className,
      )}
      {...props}
    />
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
    <header className="relative z-30 mb-3.5 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2">
      {/* App logo and name */}
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <span className="rounded-sm border border-accent-purple/40 bg-accent-purple/25 px-1.5 py-0.5 text-2xs leading-none font-bold tracking-wide text-accent-purple">
            v{appVersion}
          </span>
          <img
            src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
            alt="Auralune Logo"
            className={cn(
              'size-9.5 shrink-0 rounded-xl border border-white/15 bg-black/25 object-contain shadow-halo-lg',
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
              className="inline-flex items-center gap-1 rounded-sm border border-green-500/45 bg-green-500/20 px-1.5 py-0.5 text-2xs leading-none font-bold text-green-400"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-green-400 motion-safe:animate-update-dot" />
              {loc.updates.badge}
            </button>
          )}
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight whitespace-nowrap">
            <span>Auralune</span>
            <span className="text-lg font-semibold text-accent-pink">狐</span>
          </h1>
        </div>
      </div>

      {/* Navigation tabs */}
      <AppNavbar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        trackCount={trackCount}
        playlistCount={playlistCount}
        language={language}
        loc={loc}
      />

      {/* Tools and Settings on the right */}
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        {/* Recap */}
        <HeaderButton
          onClick={onOpenRecap}
          className="border-accent-pink/45 bg-linear-135 from-accent-pink/25 to-accent-purple/25 font-bold text-fg shadow-halo-sm shadow-accent-pink/20"
          title={loc.nav.recapTitle}
        >
          <Flame size={14} className="text-accent-pink" />
          <span className="max-actions:hidden">{loc.nav.recap}</span>
        </HeaderButton>

        {/* Key & BPM */}
        <HeaderButton onClick={onOpenKeyBpm} tone="cyan" className="font-bold" title={loc.nav.keyBpmTitle}>
          <Activity size={14} />
          <span className="max-actions:hidden">Key & BPM</span>
        </HeaderButton>

        {/* Music Analysis */}
        <HeaderButton onClick={onOpenAnalysis} tone="pink" className="font-bold" title={loc.nav.analysisTitle}>
          <BarChart2 size={14} />
          <span className="max-actions:hidden">{loc.nav.analysisBtn}</span>
        </HeaderButton>

        {/* Sleep Timer */}
        <HeaderButton
          onClick={onOpenSleepTimer}
          pressed={sleepActive}
          className="font-bold aria-pressed:border-accent-cyan aria-pressed:bg-linear-135 aria-pressed:from-accent-pink/40 aria-pressed:to-accent-cyan/40 aria-pressed:text-on-accent aria-pressed:shadow-halo-md aria-pressed:shadow-accent-cyan/50"
          title={loc.player.sleepTimer}
        >
          <Moon size={14} className={cn(sleepTimerRemainingSec !== null && 'text-accent-cyan')} />
          <span className="max-actions:hidden">
            {sleepTimerRemainingSec !== null
              ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
              : sleepTimerTargetMode === 'end_of_track'
                ? loc.player.timerEnd
                : 'Timer'}
          </span>
        </HeaderButton>

        {/* Lyrics */}
        <HeaderButton onClick={onToggleLyrics} pressed={showLyrics} tone="cyan" title={loc.shortcuts.lyrics}>
          <Mic2 size={14} />
          <span className="max-actions:hidden">{loc.nav.lyrics}</span>
        </HeaderButton>

        {/* Desktop Lyrics Overlay */}
        <HeaderButton
          onClick={onToggleDesktopLyrics}
          pressed={showDesktopLyrics}
          tone="purple"
          title={loc.lyricsView?.desktopLyricsToggle || 'Pulpit HUD / Tekst (Desktop Lyrics)'}
        >
          <Tv size={14} />
          <span className="max-actions:hidden">{loc.nav.desktopLrc}</span>
        </HeaderButton>

        {/* Ambience cycle */}
        <HeaderButton onClick={onCycleAmbience} pressed={ambienceMode !== 'off'} tone="pink" title={`Ambience: ${ambienceMode}`}>
          <Sparkles size={14} />
          <span className="max-actions:hidden">
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

        {/* Soundscape */}
        <HeaderButton
          onClick={onOpenSoundscape}
          pressed={isSoundscapeActive}
          tone="sky"
          title={loc.nav.soundscape + ' (Lofi Ambience)'}
        >
          <Waves size={14} />
          <span className="max-actions:hidden">{loc.nav.soundscape}</span>
        </HeaderButton>

        {/* Harmonic Suggester */}
        <HeaderButton onClick={onOpenHarmonicSuggester} tone="pink" title={loc.nav.harmonicSuggester + ' (Camelot & BPM)'}>
          <Disc3 size={14} />
          <span className="max-actions:hidden">{loc.nav.harmonicDj}</span>
        </HeaderButton>

        {/* Command Palette */}
        <HeaderButton onClick={onOpenCommandPalette} tone="purple" title="Command Palette / Search (Ctrl + K)">
          <Search size={14} />
          <span className="font-mono text-xs opacity-85">Ctrl+K</span>
        </HeaderButton>

        {/* Fullscreen */}
        <HeaderButton onClick={onOpenBigScreen} title={loc.shortcuts.fullscreen}>
          <Maximize2 size={14} />
          <span className="max-actions:hidden">{loc.nav.fullscreen}</span>
        </HeaderButton>

        {/* UI Scale Switcher */}
        <HeaderButton
          onClick={onIncreaseScale}
          onContextMenu={(e) => {
            e.preventDefault();
            onDecreaseScale();
          }}
          pressed={uiScale > 1.0}
          tone="cyan"
          title={fmt(loc.nav.uiScaleTooltip, String(Math.round(uiScale * 100)))}
        >
          <Maximize2 size={13} />
          <span className="max-actions:hidden">{Math.round(uiScale * 100)}%</span>
        </HeaderButton>

        {/* Mini Player */}
        <HeaderButton onClick={onToggleMiniPlayer} title={loc.shortcuts.miniPlayer}>
          <Minimize2 size={14} />
          <span className="max-actions:hidden">{loc.nav.miniPlayer}</span>
        </HeaderButton>

        {/* Queue */}
        <HeaderButton onClick={onToggleQueue} pressed={isQueueOpen} tone="pink" title={`${loc.nav.queue} (${queueCount})`}>
          <ListMusic size={14} />
          <span className="max-actions:hidden">{loc.nav.queue}</span> ({queueCount})
        </HeaderButton>

        {/* Settings */}
        <HeaderButton onClick={onOpenSettings} pressed={isSettingsOpen} tone="purple" title={loc.settings.title}>
          <Settings size={14} />
          <span className="max-actions:hidden">{loc.settings.title}</span>
        </HeaderButton>

        {/* Language Selector */}
        <div className="shrink-0">
          <LanguageSelector currentLang={language} onLanguageChange={onLanguageChange} />
        </div>
      </div>
    </header>
  );
};
