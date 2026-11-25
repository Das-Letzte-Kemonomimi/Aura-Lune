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
import { fmt } from '../../utils/fmt';

export interface AppHeaderProps {
  appVersion: string;
  /** Nowa wersja (niepominięta) albo pobrana aktualizacja czekająca na restart. */
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
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
        gap: '8px',
        minWidth: 0,
        flexWrap: 'wrap',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Logo i Nazwa Aplikacji */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '0.62rem',
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: '4px',
              background: 'rgba(168, 85, 247, 0.25)',
              color: 'var(--accent-purple)',
              fontWeight: 700,
              border: '1px solid rgba(168, 85, 247, 0.4)',
              letterSpacing: '0.02em',
            }}
          >
            v{appVersion}
          </span>
          <img
            src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
            alt="Auralune Logo"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              objectFit: 'contain',
              background: 'rgba(0, 0, 0, 0.25)',
              boxShadow:
                appIconStyle === 'classic'
                  ? '0 0 16px rgba(168, 85, 247, 0.45)'
                  : '0 0 16px rgba(236, 72, 153, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: appIconStyle === 'classic' ? '0' : '2px',
              flexShrink: 0,
            }}
          />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <h1
            style={{
              fontSize: '1.38rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span>Auralune</span>
            <span style={{ color: 'var(--accent-pink)', fontSize: '1.15rem', fontWeight: 600 }}>狐</span>
          </h1>
          {updateAvailable && (
            <button
              type="button"
              onClick={onOpenUpdates}
              title={updateTitle}
              aria-label={updateTitle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.6rem',
              marginTop: '4px',
                lineHeight: 1,
                padding: '2px 5px',
                borderRadius: '4px',
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                fontWeight: 700,
                border: '1px solid rgba(34, 197, 94, 0.45)',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  animation: 'update-dot-pulse 1.6s ease-in-out infinite',
                }}
              />
              {loc.updates.badge}
            </button>
          )}
          </div>
      </div>

      {/* Zakładki nawigacyjne */}
      <AppNavbar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        trackCount={trackCount}
        playlistCount={playlistCount}
        language={language}
        loc={loc}
      />

      {/* Narzędzia i Ustawienia po prawej */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
        {/* Recap */}
        <button
          onClick={onOpenRecap}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(168, 85, 247, 0.25))',
            border: '1px solid rgba(244, 63, 94, 0.45)',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(244, 63, 94, 0.2)',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={loc.nav.recapTitle}
        >
          <Flame size={14} color="var(--accent-pink)" />
          <span className="header-action-text">{loc.nav.recap}</span>
        </button>

        {/* Key & BPM */}
        <button
          onClick={onOpenKeyBpm}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            color: 'var(--accent-cyan)',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={loc.nav.keyBpmTitle}
        >
          <Activity size={14} color="var(--accent-cyan)" />
          <span className="header-action-text">Key & BPM</span>
        </button>

        {/* Music Analysis */}
        <button
          onClick={onOpenAnalysis}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'rgba(236, 72, 153, 0.15)',
            border: '1px solid rgba(236, 72, 153, 0.35)',
            color: 'var(--accent-pink)',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={loc.nav.analysisTitle}
        >
          <BarChart2 size={14} color="var(--accent-pink)" />
          <span className="header-action-text">{loc.nav.analysisBtn}</span>
        </button>

        {/* Sleep Timer */}
        <button
          onClick={onOpenSleepTimer}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.4), rgba(6, 182, 212, 0.4))'
                : 'rgba(255, 255, 255, 0.06)',
            border:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? '1px solid var(--accent-cyan)'
                : '1px solid var(--border-subtle)',
            color:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? '#ffffff'
                : 'var(--text-secondary)',
            boxShadow:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? '0 0 14px rgba(6, 182, 212, 0.5)'
                : 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={loc.player.sleepTimer}
        >
          <Moon size={14} color={sleepTimerRemainingSec !== null ? 'var(--accent-cyan)' : 'currentColor'} />
          <span className="header-action-text">
            {sleepTimerRemainingSec !== null
              ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
              : sleepTimerTargetMode === 'end_of_track'
                ? loc.player.timerEnd
                : 'Timer'}
          </span>
        </button>

        {/* Lyrics */}
        <button
          onClick={onToggleLyrics}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: showLyrics ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: showLyrics ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            color: showLyrics ? 'var(--accent-cyan)' : '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={loc.shortcuts.lyrics}
        >
          <Mic2 size={14} />
          <span className="header-action-text">{loc.nav.lyrics}</span>
        </button>

        {/* Desktop Lyrics Overlay */}
        <button
          onClick={onToggleDesktopLyrics}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: showDesktopLyrics ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: showDesktopLyrics ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
            color: showDesktopLyrics ? 'var(--accent-purple)' : '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: showDesktopLyrics ? '0 0 12px rgba(168, 85, 247, 0.35)' : undefined,
            flexShrink: 0,
          }}
          title={loc.lyricsView?.desktopLyricsToggle || 'Pulpit HUD / Tekst (Desktop Lyrics)'}
        >
          <Tv size={14} />
          <span className="header-action-text">{loc.nav.desktopLrc}</span>
        </button>

        {/* Ambience cycle */}
        <button
          onClick={onCycleAmbience}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: ambienceMode !== 'off' ? 'rgba(255, 105, 180, 0.22)' : 'rgba(255, 255, 255, 0.06)',
            border: ambienceMode !== 'off' ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            color: ambienceMode !== 'off' ? 'var(--accent-pink)' : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={`Ambience: ${ambienceMode}`}
        >
          <Sparkles size={14} />
          <span className="header-action-text">
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
        </button>

        {/* Soundscape */}
        <button
          onClick={onOpenSoundscape}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: isSoundscapeActive ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.06)',
            border: isSoundscapeActive ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
            color: isSoundscapeActive ? '#38bdf8' : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={loc.nav.soundscape + ' (Lofi Ambience)'}
        >
          <Waves size={14} />
          <span className="header-action-text">{loc.nav.soundscape}</span>
        </button>

        {/* Harmonic Suggester */}
        <button
          onClick={onOpenHarmonicSuggester}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'rgba(236, 72, 153, 0.16)',
            border: '1px solid rgba(236, 72, 153, 0.35)',
            color: 'var(--accent-pink, #f472b6)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title={loc.nav.harmonicSuggester + ' (Camelot & BPM)'}
        >
          <Disc3 size={14} />
          <span className="header-action-text">{loc.nav.harmonicDj}</span>
        </button>

        {/* Command Palette */}
        <button
          onClick={onOpenCommandPalette}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'rgba(168, 85, 247, 0.16)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            color: 'var(--accent-purple, #c084fc)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          title="Command Palette / Szukaj (Ctrl + K)"
        >
          <Search size={14} />
          <span style={{ fontSize: '0.72rem', opacity: 0.85, fontFamily: 'monospace' }}>Ctrl+K</span>
        </button>

        {/* Fullscreen */}
        <button
          onClick={onOpenBigScreen}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={loc.shortcuts.fullscreen}
        >
          <Maximize2 size={14} />
          <span className="header-action-text">{loc.nav.fullscreen}</span>
        </button>

        {/* UI Scale Switcher */}
        <button
          onClick={onIncreaseScale}
          onContextMenu={(e) => {
            e.preventDefault();
            onDecreaseScale();
          }}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: uiScale > 1.0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: uiScale > 1.0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            color: uiScale > 1.0 ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={fmt(loc.nav.uiScaleTooltip, String(Math.round(uiScale * 100)))}
        >
          <Maximize2 size={13} />
          <span className="header-action-text">{Math.round(uiScale * 100)}%</span>
        </button>

        {/* Mini Player */}
        <button
          onClick={onToggleMiniPlayer}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={loc.shortcuts.miniPlayer}
        >
          <Minimize2 size={14} />
          <span className="header-action-text">{loc.nav.miniPlayer}</span>
        </button>

        {/* Queue */}
        <button
          onClick={onToggleQueue}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            background: isQueueOpen ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: isQueueOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            color: isQueueOpen ? 'var(--accent-pink)' : '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={`${loc.nav.queue} (${queueCount})`}
        >
          <ListMusic size={14} />
          <span className="header-action-text">{loc.nav.queue}</span> ({queueCount})
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="glass-card"
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            color: isSettingsOpen ? 'var(--accent-purple)' : '#fff',
            border: isSettingsOpen ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
            background: isSettingsOpen ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={loc.settings.title}
        >
          <Settings size={14} />
          <span className="header-action-text">{loc.settings.title}</span>
        </button>

        {/* Language Selector */}
        <div style={{ flexShrink: 0 }}>
          <LanguageSelector currentLang={language} onLanguageChange={onLanguageChange} />
        </div>
      </div>
    </header>
  );
};
