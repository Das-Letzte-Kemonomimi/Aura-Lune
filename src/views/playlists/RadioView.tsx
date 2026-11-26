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
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';

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
    description: 'Popular community radio streaming anime, gaming, and Japanese pop in lossless Opus/AAC.',
    homepage: 'https://listen.moe',
  },
  {
    id: 'gensokyo-radio',
    name: 'Gensokyo Radio',
    url: 'https://stream.gensokyoradio.net/1/',
    genre: 'Touhou Project / Doujin',
    description: '24/7 licensed Touhou Project doujin music and game arrangement broadcasts.',
    homepage: 'https://gensokyoradio.net',
  },
  {
    id: 'listen-moe-kpop',
    name: 'LISTEN.moe K-Pop',
    url: 'https://listen.moe/kpop/stream',
    genre: 'K-Pop / OST',
    description: 'Korean pop, K-drama soundtracks, and fresh music straight from Seoul.',
    homepage: 'https://listen.moe',
  },
  {
    id: 'nightwave-plaza',
    name: 'Nightwave Plaza',
    url: 'https://radio.plaza.one/mp3',
    genre: 'Vaporwave / Future Funk / CityPop',
    description: 'Nostalgic 80s/90s vibes, anime aesthetics, future funk, and vaporwave.',
    homepage: 'https://plaza.one',
  },
  {
    id: 'animenfo-radio',
    name: 'AnimeNfo Radio',
    url: 'https://stream.zeno.fm/xwa8ckz7mzzuv',
    genre: 'Anime OST / Classics',
    description: 'Classic and modern anime openings, endings, and Japanese animation soundtracks.',
    homepage: 'https://animenfo.com',
  },
  {
    id: 'lofi-girl',
    name: 'Lofi Beats Radio',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    genre: 'Lofi / Chill / Study',
    description: 'Soothing lofi beats and chill hip-hop for studying, coding, and relaxing.',
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

  const getStationDesc = (id: string, defaultDesc?: string): string => {
    switch (id) {
      case 'listen-moe-jpop': return loc.radio.stationDescListenMoeJpop || defaultDesc || '';
      case 'gensokyo-radio': return loc.radio.stationDescGensokyo || defaultDesc || '';
      case 'listen-moe-kpop': return loc.radio.stationDescListenMoeKpop || defaultDesc || '';
      case 'nightwave-plaza': return loc.radio.stationDescNightwavePlaza || defaultDesc || '';
      case 'animenfo-radio': return loc.radio.stationDescAnimenfo || defaultDesc || '';
      case 'lofi-girl': return loc.radio.stationDescLofiGirl || defaultDesc || '';
      default: return defaultDesc || '';
    }
  };

  return (
    <div className="flex flex-col gap-6 px-0 pt-2 pb-10 motion-safe:animate-fade-in">
      {/* Nagłówek zakładki Radio */}
      <div
        className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line-accent bg-modal p-6"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient shadow-xl shadow-pink-500/35"
          >
            <Radio size={28} className="text-fg" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="m-0 text-2xl font-extrabold tracking-tight text-fg">
                {loc.radio.title}
              </h2>
              <span
                className="flex items-center gap-1 rounded-3xl border border-pink-500/30 bg-pink-500/20 px-2 py-0.5 text-xs font-semibold text-accent-pink"
              >
                <Wifi size={12} /> Live ICY / PipeWire
              </span>
            </div>
            <p className="mx-0 mt-1 mb-0 text-sm text-fg-muted">
              {loc.radio.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="glass-card flex items-center gap-2 rounded-xl border-0 bg-linear-135 from-accent-purple to-accent-pink px-4.5 py-2.5 text-sm font-semibold text-on-accent shadow-lift shadow-accent-purple/30 transition-all duration-200"
        >
          <Plus size={18} />
          {loc.radio.addCustomStation}
        </button>
      </div>

      {/* Aktywny odtwarzany strumień (Live Status Hero Card) */}
      {currentStation && (
        <div
          className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-pink-500/40 bg-linear-135 from-pink-500/10 to-accent-purple/15 px-6 py-5 shadow-2xl shadow-pink-500/20"
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-11.5 w-11.5 items-center justify-center rounded-xl border border-accent-pink',
                isPlaying ? 'bg-pink-500/25' : 'bg-white/8',
              )}
            >
              {isPlaying ? (
                <div className="flex h-4.5 items-end gap-1">
                  <span className="h-full w-1 rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.8s] origin-bottom" />
                  <span className="h-3/5 w-1 rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.6s] [animation-delay:0.2s] origin-bottom" />
                  <span className="h-4/5 w-1 rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.7s] [animation-delay:0.4s] origin-bottom" />
                  <span className="h-2/5 w-1 rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.9s] [animation-delay:0.1s] origin-bottom" />
                </div>
              ) : (
                <Radio size={22} className="text-fg-muted" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold tracking-wider text-accent-pink uppercase">
                  {isPlaying ? loc.radio.liveBroadcast : loc.radio.stopped}
                </span>
                <span className="rounded-sm bg-white/8 px-1.5 py-px text-xs text-fg-secondary">
                  {currentStation.genre}
                </span>
              </div>
              <h3 className="mx-0 mt-1 mb-0 text-xl font-bold text-fg">
                {currentStation.name}
              </h3>
              <p
                className={cn(
                  'mx-0 mt-1 mb-0 flex items-center gap-1.5 text-sm',
                  liveStreamTitle ? 'text-accent-cyan' : 'text-fg-muted',
                  liveStreamTitle ? 'font-semibold' : 'font-normal',
                )}
              >
                <Music2 size={14} />
                {liveStreamTitle || loc.radio.nowPlayingLive}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 rounded-lg border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1.5 text-ui text-accent-cyan"
              title="PipeWire DSP Real-Time"
            >
              <Sliders size={14} />
              <span>DSP Real-Time</span>
            </div>

            {isPlaying ? (
              <button
                onClick={onStop}
                className="glass-card flex items-center gap-1.5 rounded-xl border border-accent-red/40 bg-accent-red/20 px-4 py-2.5 text-sm font-semibold text-rose-400 transition-all duration-200"
              >
                <Square size={16} />
                {loc.player.stop}
              </button>
            ) : (
              <button
                onClick={() => onPlayStation(currentStation)}
                className="glass-card flex items-center gap-1.5 rounded-xl border-0 bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent transition-all duration-200"
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
        <div className="mb-3.5 flex items-center gap-2">
          <Sparkles size={18} className="text-accent-pink" />
          <h3 className="m-0 text-lg font-bold text-fg">
            {loc.radio.featuredStations}
          </h3>
          <span className="text-xs text-fg-muted">
            ({FEATURED_RADIO_STATIONS.length})
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-4">
          {FEATURED_RADIO_STATIONS.map((station) => {
            const isThisPlaying = currentStation?.url === station.url && isPlaying;
            return (
              <div
                key={station.id}
                className={cn(
                  'glass-card flex flex-col justify-between gap-3 rounded-2xl border px-5 py-4.5 transition-all duration-200',
                  isThisPlaying ? 'border-accent-pink' : 'border-line',
                  isThisPlaying && 'shadow-xl shadow-pink-500/25',
                )}
                style={{
                  background: isThisPlaying
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(20, 15, 30, 0.8) 100%)'
                    : 'rgba(20, 15, 30, 0.65)',
                }}
              >
                <div>
                  <div className="mb-1.5 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones className={cn(isThisPlaying ? 'text-accent-pink' : 'text-accent-purple')} size={18} />
                      <h4 className="m-0 text-base font-bold text-fg">
                        {station.name}
                      </h4>
                    </div>
                    <span
                      className="rounded-xl bg-accent-purple/20 px-2 py-0.5 text-xs font-semibold text-accent-purple"
                    >
                      {station.genre}
                    </span>
                  </div>

                  <p className="mx-0 mt-1.5 mb-0 text-ui leading-snug text-fg-secondary">
                    {getStationDesc(station.id, station.description)}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                  {station.homepage ? (
                    <a
                      href={station.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-fg-muted no-underline transition-colors duration-200 hover:text-accent-cyan"
                    >
                      <ExternalLink size={12} />
                      {loc.radio.website}
                    </a>
                  ) : <div />}

                  <button
                    onClick={() => isThisPlaying ? onStop() : onPlayStation(station)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-ui font-semibold transition-all duration-200',
                      isThisPlaying ? 'bg-accent-red/20' : 'bg-accent-gradient',
                      isThisPlaying ? 'text-rose-400' : 'text-fg',
                      isThisPlaying ? 'border border-accent-red/40' : 'border-0',
                    )}
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
      <div className="mt-2.5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-accent-cyan" />
            <h3 className="m-0 text-lg font-bold text-fg">
              {loc.radio.customStations}
            </h3>
            <span className="text-xs text-fg-muted">
              ({customStations.length})
            </span>
          </div>
        </div>

        {customStations.length === 0 ? (
          <div className="glass-card rounded-2xl border border-dashed border-line p-9 text-center text-fg-muted">
            <Radio size={36} className="mb-2.5 opacity-35" />
            <p className="m-0 text-md">
              {loc.radio.noCustomStations}
            </p>
            <p className="mx-0 mt-1 mb-4 text-ui text-fg-muted">
              {loc.radio.supportedStreamsHint}
            </p>
            <button
              onClick={onOpenAddModal}
              className="glass-card inline-flex items-center gap-1.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/15 px-4 py-2 text-ui font-semibold text-accent-cyan"
            >
              <Plus size={16} />
              {loc.radio.addCustomStation}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-4">
            {customStations.map((station) => {
              const isThisPlaying = currentStation?.url === station.url && isPlaying;
              return (
                <div
                  key={station.id}
                  className={cn(
                    'glass-card flex flex-col justify-between gap-3 rounded-2xl border px-5 py-4.5 transition-all duration-200',
                    isThisPlaying ? 'border-accent-cyan' : 'border-line',
                  )}
                  style={{
                    background: isThisPlaying
                      ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(20, 15, 30, 0.8) 100%)'
                      : 'rgba(20, 15, 30, 0.65)',
                  }}
                >
                  <div>
                    <div className="mb-1.5 flex items-start justify-between">
                      <h4 className="m-0 text-base font-bold text-fg">
                        {station.name}
                      </h4>
                      <span className="rounded-xl bg-accent-cyan/20 px-2 py-0.5 text-xs font-semibold text-accent-cyan">
                        {station.genre}
                      </span>
                    </div>

                    <p
                      className="mx-0 mt-1 mb-0 truncate font-mono text-xs text-fg-muted"
                      title={station.url}
                    >
                      {station.url}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                    <button
                      onClick={() => onDeleteCustomStation(station.id)}
                      title={loc.radio.deleteStation}
                      className="flex items-center border-0 bg-transparent p-1 text-fg-muted transition-colors duration-200 hover:text-rose-400"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      onClick={() => isThisPlaying ? onStop() : onPlayStation(station)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-ui font-semibold transition-all duration-200',
                        isThisPlaying ? 'bg-accent-red/20' : 'bg-linear-135 from-accent-cyan to-accent-purple',
                        isThisPlaying ? 'text-rose-400' : 'text-fg',
                        isThisPlaying ? 'border border-accent-red/40' : 'border-0',
                      )}
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
