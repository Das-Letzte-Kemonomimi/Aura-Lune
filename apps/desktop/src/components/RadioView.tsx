import React from 'react';
import {
  Radio,
  Wifi,
  Play,
  Square,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Music2,
  Headphones,
  Sliders,
} from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  genre: string;
  description?: string;
  homepage?: string;
}

export const FEATURED_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'listen-moe-jpop',
    name: 'LISTEN.moe J-Pop',
    url: 'https://listen.moe/stream',
    genre: 'J-Pop / Anime',
    description: 'Najpopularniejsze radio z muzyką z anime, gier i japońskiego popu w bezstratnej jakości Opus/AAC.',
    homepage: 'https://listen.moe',
  },
  {
    id: 'gensokyo-radio',
    name: 'Gensokyo Radio',
    url: 'https://stream.gensokyoradio.net/1/',
    genre: 'Touhou Project / Doujin',
    description: '24/7 licencjonowane aranżacje muzyki z legendarnego uniwersum Touhou Project.',
    homepage: 'https://gensokyoradio.net',
  },
  {
    id: 'listen-moe-kpop',
    name: 'LISTEN.moe K-Pop',
    url: 'https://listen.moe/kpop/stream',
    genre: 'K-Pop / OST',
    description: 'Koreański pop, OST-y z dram i nowości muzyczne prosto z Seulu.',
    homepage: 'https://listen.moe',
  },
  {
    id: 'nightwave-plaza',
    name: 'Nightwave Plaza',
    url: 'https://radio.plaza.one/mp3',
    genre: 'Vaporwave / Future Funk / CityPop',
    description: 'Nostalgiczne brzmienia lat 80./90., anime aesthetics, future funk i vaporwave.',
    homepage: 'https://plaza.one',
  },
  {
    id: 'animenfo-radio',
    name: 'AnimeNfo Radio',
    url: 'https://stream.animenfo.com:8000/live',
    genre: 'Anime OST / Classics',
    description: 'Klasyczne i najnowsze openingi, endingi oraz ścieżki dźwiękowe z japońskich animacji.',
    homepage: 'https://animenfo.com',
  },
  {
    id: 'lofi-girl',
    name: 'Lofi Beats Radio',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    genre: 'Lofi / Chill / Study',
    description: 'Kojące bity lofi i lo-fi hip hop idealne do kodowania, nauki i relaksu.',
    homepage: 'https://lofigirl.com',
  },
];

interface RadioViewProps {
  currentLang?: Language;
  currentStation: RadioStation | null;
  isPlaying: boolean;
  liveStreamTitle?: string | null;
  customStations: RadioStation[];
  onPlayStation: (station: RadioStation) => void;
  onStop: () => void;
  onOpenAddModal: () => void;
  onDeleteCustomStation: (id: string) => void;
}

export const RadioView: React.FC<RadioViewProps> = ({
  currentLang = 'pl',
  currentStation,
  isPlaying,
  liveStreamTitle,
  customStations,
  onPlayStation,
  onStop,
  onOpenAddModal,
  onDeleteCustomStation,
}) => {
  const loc = getTranslations(currentLang);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '8px 0 40px 0',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Nagłówek zakładki Radio */}
      <div
        className="glass-card"
        style={{
          padding: '24px',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(135deg, rgba(30, 20, 50, 0.7) 0%, rgba(15, 10, 25, 0.8) 100%)',
          border: '1px solid var(--border-accent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(236, 72, 153, 0.35)',
              flexShrink: 0,
            }}
          >
            <Radio size={28} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                {loc.radio.title}
              </h2>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: 'rgba(236, 72, 153, 0.18)',
                  color: 'var(--accent-pink)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Wifi size={12} /> Live ICY / PipeWire
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              {loc.radio.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="glass-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(168, 85, 247, 0.3)',
            transition: 'all 0.2s ease',
          }}
        >
          <Plus size={18} />
          {loc.radio.addCustomStation}
        </button>
      </div>

      {/* Aktywny odtwarzany strumień (Live Status Hero Card) */}
      {currentStation && (
        <div
          className="glass-card"
          style={{
            padding: '20px 24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(168, 85, 247, 0.15) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.4)',
            boxShadow: '0 8px 32px rgba(236, 72, 153, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: isPlaying ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--accent-pink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isPlaying ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '18px' }}>
                  <span
                    style={{
                      width: '3px',
                      height: '100%',
                      background: 'var(--accent-pink)',
                      borderRadius: '2px',
                      animation: 'bounce 0.8s ease-in-out infinite alternate',
                    }}
                  />
                  <span
                    style={{
                      width: '3px',
                      height: '60%',
                      background: 'var(--accent-pink)',
                      borderRadius: '2px',
                      animation: 'bounce 0.6s ease-in-out infinite alternate 0.2s',
                    }}
                  />
                  <span
                    style={{
                      width: '3px',
                      height: '80%',
                      background: 'var(--accent-pink)',
                      borderRadius: '2px',
                      animation: 'bounce 0.7s ease-in-out infinite alternate 0.4s',
                    }}
                  />
                  <span
                    style={{
                      width: '3px',
                      height: '40%',
                      background: 'var(--accent-pink)',
                      borderRadius: '2px',
                      animation: 'bounce 0.9s ease-in-out infinite alternate 0.1s',
                    }}
                  />
                </div>
              ) : (
                <Radio size={22} color="var(--text-muted)" />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-pink)', fontWeight: 700 }}>
                  {isPlaying ? '● TRANSMISJA NA ŻYWO' : 'ZATRZYMANO'}
                </span>
                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                  {currentStation.genre}
                </span>
              </div>
              <h3 style={{ margin: '3px 0 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                {currentStation.name}
              </h3>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '0.85rem',
                  color: liveStreamTitle ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontWeight: liveStreamTitle ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Music2 size={14} />
                {liveStreamTitle || loc.radio.nowPlayingLive}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                color: 'var(--accent-cyan)',
                fontSize: '0.78rem',
              }}
              title="PipeWire DSP Real-Time"
            >
              <Sliders size={14} />
              <span>DSP Real-Time</span>
            </div>

            {isPlaying ? (
              <button
                onClick={onStop}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ff6b81',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Square size={16} />
                {loc.player.stop}
              </button>
            ) : (
              <button
                onClick={() => onPlayStation(currentStation)}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Play size={16} />
                {loc.player.play}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sekcja: Polecane Stacje */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Sparkles size={18} color="var(--accent-pink)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            {loc.radio.featuredStations}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ({FEATURED_RADIO_STATIONS.length})
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {FEATURED_RADIO_STATIONS.map((station) => {
            const isThisPlaying = currentStation?.url === station.url && isPlaying;
            return (
              <div
                key={station.id}
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  border: isThisPlaying
                    ? '1px solid var(--accent-pink)'
                    : '1px solid var(--border-subtle)',
                  background: isThisPlaying
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(20, 15, 30, 0.8) 100%)'
                    : 'rgba(20, 15, 30, 0.65)',
                  boxShadow: isThisPlaying ? '0 4px 20px rgba(236, 72, 153, 0.25)' : undefined,
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Headphones size={18} color={isThisPlaying ? 'var(--accent-pink)' : 'var(--accent-purple)'} />
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                        {station.name}
                      </h4>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: 'var(--accent-purple)',
                        fontWeight: 600,
                      }}
                    >
                      {station.genre}
                    </span>
                  </div>

                  <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {station.description}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {station.homepage ? (
                    <a
                      href={station.homepage}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.76rem',
                        color: 'var(--text-muted)',
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <ExternalLink size={12} />
                      Strona WWW
                    </a>
                  ) : <div />}

                  <button
                    onClick={() => isThisPlaying ? onStop() : onPlayStation(station)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: isThisPlaying
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: isThisPlaying ? '#ff6b81' : '#fff',
                      border: isThisPlaying ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isThisPlaying ? (
                      <>
                        <Square size={14} />
                        {loc.player.stop}
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        {loc.player.play}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sekcja: Własne Stacje */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={18} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              {loc.radio.customStations}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({customStations.length})
            </span>
          </div>
        </div>

        {customStations.length === 0 ? (
          <div
            className="glass-card"
            style={{
              padding: '36px',
              borderRadius: '14px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Radio size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              {loc.radio.noCustomStations}
            </p>
            <p style={{ margin: '4px 0 16px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Obsługiwane są dowolne bezpośrednie strumienie Icecast, Shoutcast, AAC, MP3, Ogg Vorbis i Opus.
            </p>
            <button
              onClick={onOpenAddModal}
              className="glass-card"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              {loc.radio.addCustomStation}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {customStations.map((station) => {
              const isThisPlaying = currentStation?.url === station.url && isPlaying;
              return (
                <div
                  key={station.id}
                  className="glass-card"
                  style={{
                    padding: '18px 20px',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    border: isThisPlaying
                      ? '1px solid var(--accent-cyan)'
                      : '1px solid var(--border-subtle)',
                    background: isThisPlaying
                      ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(20, 15, 30, 0.8) 100%)'
                      : 'rgba(20, 15, 30, 0.65)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                        {station.name}
                      </h4>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: 'rgba(6, 182, 212, 0.2)',
                          color: 'var(--accent-cyan)',
                          fontWeight: 600,
                        }}
                      >
                        {station.genre}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '0.76rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={station.url}
                    >
                      {station.url}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <button
                      onClick={() => onDeleteCustomStation(station.id)}
                      title="Usuń stację"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b81')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      onClick={() => isThisPlaying ? onStop() : onPlayStation(station)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '8px',
                        background: isThisPlaying
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                        color: isThisPlaying ? '#ff6b81' : '#fff',
                        border: isThisPlaying ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isThisPlaying ? (
                        <>
                          <Square size={14} />
                          {loc.player.stop}
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          {loc.player.play}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
