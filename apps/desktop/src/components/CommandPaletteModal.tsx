import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Music,
  Disc,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Sliders,
  Sparkles,
  Maximize2,
  Activity,
  Layers,
} from 'lucide-react';
import type { Language } from '../i18n';

export interface CommandItem {
  id: string;
  type: 'track' | 'album' | 'artist' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: string;
  onExecute: () => void;
}

interface CommandPaletteModalProps {
  tracks: any[];
  albums: any[];
  isPlaying: boolean;
  currentLang?: Language;
  onClose: () => void;
  onPlayTrack: (track: any) => void;
  onAddToQueue?: (track: any) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleShuffle: () => void;
  onSetAmbience: (mode: any) => void;
  onSetDspEngine: (engine: 'RubberBand' | 'SoundTouch') => void;
  onResetDsp: () => void;
  onOpenBigScreen: () => void;
  onOpenReplayGainScanner: () => void;
  onSelectTab: (tab: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  tracks,
  albums,
  isPlaying,
  currentLang = 'pl',
  onClose,
  onPlayTrack,
  onTogglePlay,
  onNext,
  onPrevious,
  onToggleShuffle,
  onSetAmbience,
  onSetDspEngine,
  onResetDsp,
  onOpenBigScreen,
  onOpenReplayGainScanner,
  onSelectTab,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Wszystkie stałe akcje systemowe
  const systemActions: CommandItem[] = useMemo(() => {
    const isPl = currentLang === 'pl';
    return [
      {
        id: 'action-play-pause',
        type: 'action',
        title: isPlaying
          ? isPl ? 'Wstrzymaj odtwarzanie (Pauza)' : 'Pause Playback'
          : isPl ? 'Wznów odtwarzanie (Play)' : 'Resume Playback',
        subtitle: isPl ? 'Sterowanie odtwarzaczem' : 'Player control',
        icon: isPlaying ? <Pause size={18} /> : <Play size={18} />,
        badge: 'Space',
        onExecute: () => {
          onTogglePlay();
          onClose();
        },
      },
      {
        id: 'action-next',
        type: 'action',
        title: isPl ? 'Następny utwór' : 'Next Track',
        subtitle: isPl ? 'Przejdź do kolejnego utworu w kolejce' : 'Skip to next track',
        icon: <SkipForward size={18} />,
        badge: 'N',
        onExecute: () => {
          onNext();
          onClose();
        },
      },
      {
        id: 'action-prev',
        type: 'action',
        title: isPl ? 'Poprzedni utwór' : 'Previous Track',
        subtitle: isPl ? 'Wróć do poprzedniego utworu' : 'Go back to previous track',
        icon: <SkipBack size={18} />,
        badge: 'P',
        onExecute: () => {
          onPrevious();
          onClose();
        },
      },
      {
        id: 'action-shuffle',
        type: 'action',
        title: isPl ? 'Przełącz losowe odtwarzanie (Shuffle)' : 'Toggle Shuffle',
        subtitle: isPl ? 'Włącz lub wyłącz losową kolejność' : 'Randomize playback order',
        icon: <Shuffle size={18} />,
        onExecute: () => {
          onToggleShuffle();
          onClose();
        },
      },
      {
        id: 'action-big-screen',
        type: 'action',
        title: isPl ? 'Otwórz widok pełnoekranowy (Big Screen Now Playing)' : 'Open Big Screen View',
        subtitle: isPl ? 'Kinowy tryb pełnoekranowy z wizualizerem' : 'Cinema fullscreen mode',
        icon: <Maximize2 size={18} />,
        badge: 'F11',
        onExecute: () => {
          onOpenBigScreen();
          onClose();
        },
      },
      // Ambience modes
      {
        id: 'action-ambience-sakura',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Płatki Sakury 🌸' : 'Anime Ambience: Sakura Petals 🌸',
        subtitle: isPl ? 'Spadające delikatne płatki wiśni' : 'Drifting cherry blossom petals',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('sakura');
          onClose();
        },
      },
      {
        id: 'action-ambience-neon-rain',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Cyberpunk Neon Rain 🌧️' : 'Anime Ambience: Cyberpunk Neon Rain 🌧️',
        subtitle: isPl ? 'Neonowy deszcz w stylu Blade Runner' : 'Neon rain streaks',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('neon_rain');
          onClose();
        },
      },
      {
        id: 'action-ambience-meteor',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Spadające gwiazdy (Meteor Shower) 🌠' : 'Anime Ambience: Meteor Shower 🌠',
        subtitle: isPl ? 'Meteory i gwiezdne poświaty' : 'Shooting stars & nebula sky',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('meteor_shower');
          onClose();
        },
      },
      {
        id: 'action-ambience-matrix',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Cyber Matrix Rain 🟩' : 'Anime Ambience: Cyber Matrix Rain 🟩',
        subtitle: isPl ? 'Cyfrowy deszcz znaków katakana' : 'Digital falling glyphs',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('matrix_rain');
          onClose();
        },
      },
      {
        id: 'action-ambience-momiji',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Jesienne liście klonu (Momiji) 🍁' : 'Anime Ambience: Autumn Leaves (Momiji) 🍁',
        subtitle: isPl ? 'Czerwono-złote japońskie liście klonu na wietrze' : 'Drifting Japanese autumn foliage',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('momiji');
          onClose();
        },
      },
      {
        id: 'action-ambience-fireflies',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Świetliki / Stardust ✨' : 'Anime Ambience: Fireflies / Stardust ✨',
        subtitle: isPl ? 'Złote unoszące się świetliki' : 'Floating golden orbs',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('fireflies');
          onClose();
        },
      },
      {
        id: 'action-ambience-snow',
        type: 'action',
        title: isPl ? 'Otoczenie Anime: Śnieg ❄️' : 'Anime Ambience: Snow ❄️',
        subtitle: isPl ? 'Spokojnie opadające płatki śniegu' : 'Gentle snow falling',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('snow');
          onClose();
        },
      },
      {
        id: 'action-ambience-embers',
        type: 'action',
        title: isPl ? 'Otoczenie: Gotyckie Płonące Iskry / Embers 🔥' : 'Ambience: Gothic Burning Embers 🔥',
        subtitle: isPl ? 'Wznoszące się w górę płomienne iskry i żar ognia' : 'Rising gothic sparks & flame embers',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('embers');
          onClose();
        },
      },
      {
        id: 'action-ambience-off',
        type: 'action',
        title: isPl ? 'Wyłącz efekty otoczenia Anime' : 'Turn off Ambience Effects',
        subtitle: isPl ? 'Czyste tło bez animacji cząsteczkowych' : 'Disable particle overlay',
        icon: <Sparkles size={18} />,
        onExecute: () => {
          onSetAmbience('off');
          onClose();
        },
      },
      // DSP Engines
      {
        id: 'action-dsp-rubberband',
        type: 'action',
        title: isPl ? 'Przełącz silnik DSP na Rubber Band' : 'Switch DSP Engine to Rubber Band',
        subtitle: isPl ? 'Profesjonalny phase-vocoder o wysokiej wierności' : 'High-fidelity phase vocoder',
        icon: <Sliders size={18} />,
        onExecute: () => {
          onSetDspEngine('RubberBand');
          onClose();
        },
      },
      {
        id: 'action-dsp-soundtouch',
        type: 'action',
        title: isPl ? 'Przełącz silnik DSP na SoundTouch' : 'Switch DSP Engine to SoundTouch',
        subtitle: isPl ? 'Szybki silnik WSOLA o minimalnej latencji' : 'Fast WSOLA engine',
        icon: <Sliders size={18} />,
        onExecute: () => {
          onSetDspEngine('SoundTouch');
          onClose();
        },
      },
      {
        id: 'action-dsp-reset',
        type: 'action',
        title: isPl ? 'Zresetuj efekty DSP (Pitch & Tempo)' : 'Reset DSP Effects (Pitch & Tempo)',
        subtitle: isPl ? 'Przywróć 1.0x tempo i 0.0 semitonów pitchu' : 'Restore 1.0x tempo and 0 semitones',
        icon: <Sliders size={18} />,
        onExecute: () => {
          onResetDsp();
          onClose();
        },
      },
      {
        id: 'action-scan-replaygain',
        type: 'action',
        title: isPl ? 'Skanuj głośność biblioteki (ReplayGain EBU R128)' : 'Scan Library Loudness (ReplayGain)',
        subtitle: isPl ? 'Oblicz znormalizowaną głośność dla wszystkich utworów' : 'Batch calculate track gain',
        icon: <Activity size={18} />,
        onExecute: () => {
          onOpenReplayGainScanner();
          onClose();
        },
      },
      // Tab navigation
      {
        id: 'action-nav-player',
        type: 'action',
        title: isPl ? 'Przejdź do: Odtwarzacz (Now Playing)' : 'Navigate to: Now Playing',
        subtitle: isPl ? 'Główny ekran odtwarzacza' : 'Main playback screen',
        icon: <Music size={18} />,
        badge: '1',
        onExecute: () => {
          onSelectTab('player');
          onClose();
        },
      },
      {
        id: 'action-nav-library',
        type: 'action',
        title: isPl ? 'Przejdź do: Biblioteka' : 'Navigate to: Library',
        subtitle: isPl ? 'Kolekcja utworów, albumów i artystów' : 'Music library',
        icon: <Layers size={18} />,
        badge: '2',
        onExecute: () => {
          onSelectTab('library');
          onClose();
        },
      },
      {
        id: 'action-nav-dsp',
        type: 'action',
        title: isPl ? 'Przejdź do: Zaawansowany panel DSP' : 'Navigate to: DSP Effects Studio',
        subtitle: isPl ? 'Equalizer, pitch, tempo i eksport' : 'EQ, pitch, tempo & transcode',
        icon: <Sliders size={18} />,
        badge: '3',
        onExecute: () => {
          onSelectTab('dsp');
          onClose();
        },
      },
    ];
  }, [isPlaying, currentLang]);

  // Filtrowane wyniki
  const filteredItems: CommandItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return systemActions;
    }

    const results: CommandItem[] = [];

    // 1. Akcje systemowe dopasowane do zapytania
    for (const act of systemActions) {
      if (
        act.title.toLowerCase().includes(q) ||
        (act.subtitle && act.subtitle.toLowerCase().includes(q))
      ) {
        results.push(act);
      }
    }

    // 2. Utwory z biblioteki
    for (const t of tracks) {
      if (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album_artist && t.album_artist.toLowerCase().includes(q))
      ) {
        results.push({
          id: `track-${t.id}`,
          type: 'track',
          title: t.title,
          subtitle: `${t.artist}${t.album_artist ? ` • ${t.album_artist}` : ''}`,
          icon: <Music size={18} />,
          badge: t.format?.toUpperCase(),
          onExecute: () => {
            onPlayTrack(t);
            onClose();
          },
        });
      }
      if (results.length >= 35) break;
    }

    // 3. Albumy
    for (const a of albums) {
      if (
        a.title.toLowerCase().includes(q) ||
        a.album_artist.toLowerCase().includes(q)
      ) {
        results.push({
          id: `album-${a.id}`,
          type: 'album',
          title: a.title,
          subtitle: a.album_artist,
          icon: <Disc size={18} />,
          badge: a.year ? a.year.toString() : 'Album',
          onExecute: () => {
            onSelectTab('library');
            onClose();
          },
        });
      }
      if (results.length >= 45) break;
    }

    return results;
  }, [query, systemActions, tracks, albums]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Obsługa klawiatury
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onExecute();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 99999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(24, 18, 38, 0.98), rgba(12, 10, 22, 0.98))',
          border: '1px solid var(--accent-purple, #a855f7)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(168, 85, 247, 0.3)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search input header */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <Search size={22} style={{ color: 'var(--accent-purple, #a855f7)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentLang === 'pl'
                ? 'Szukaj utworu, wykonawcy, albumu lub komendy...'
                : 'Search tracks, artists, albums, or commands...'
            }
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '1.05rem',
              fontWeight: 500,
            }}
          />
          <kbd
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            padding: '8px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b', fontSize: '0.9rem' }}>
              {currentLang === 'pl' ? 'Brak wyników dla zapytania' : 'No results found'}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.onExecute}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(168, 85, 247, 0.22)'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(168, 85, 247, 0.45)'
                      : '1px solid transparent',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isSelected
                          ? 'var(--accent-purple, #a855f7)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          color: isSelected ? '#ffffff' : '#e2e8f0',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: isSelected ? '#e9d5ff' : '#94a3b8',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        flexShrink: 0,
                        marginLeft: '12px',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <span>
              <kbd style={{ padding: '2px 5px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>↑↓</kbd> Nawigacja
            </span>
            <span>
              <kbd style={{ padding: '2px 5px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>↵</kbd> Wybierz
            </span>
          </div>
          <div>
            <span>Ctrl + K</span>
          </div>
        </div>
      </div>
    </div>
  );
};
