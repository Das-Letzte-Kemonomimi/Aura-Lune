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
} from '../../components/ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, SectionHeader } from '../../components/ui';

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  genre: string;
  description?: string;
  homepage?: string;
}

const FEATURED_RADIO_STATIONS: RadioStation[] = [
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
  currentLang: Language;
  currentStation: RadioStation | null;
  isPlaying: boolean;
  liveStreamTitle?: string | null;
  customStations: RadioStation[];
  onPlayStation: (station: RadioStation) => void;
  onStop: () => void;
  onOpenAddModal: () => void;
  onDeleteCustomStation: (id: string) => void;
}

type Loc = ReturnType<typeof getTranslations>;

const STATION_DESC_KEYS: Record<string, keyof Loc['radio']> = {
  'listen-moe-jpop': 'stationDescListenMoeJpop',
  'gensokyo-radio': 'stationDescGensokyo',
  'listen-moe-kpop': 'stationDescListenMoeKpop',
  'nightwave-plaza': 'stationDescNightwavePlaza',
  'animenfo-radio': 'stationDescAnimenfo',
  'lofi-girl': 'stationDescLofiGirl',
};

/** Translated description of a featured station, or its built-in English text. */
function stationDescription(loc: Loc, station: RadioStation): string {
  const key = STATION_DESC_KEYS[station.id];
  return (key && loc.radio[key]) || station.description || '';
}

/** Four bouncing bars shown while a stream plays. */
function LiveBars() {
  return (
    <div className="flex h-4.5 items-end gap-1" aria-hidden="true">
      <span className="h-full w-1 origin-bottom rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.8s]" />
      <span className="h-3/5 w-1 origin-bottom rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.6s] [animation-delay:0.2s]" />
      <span className="h-4/5 w-1 origin-bottom rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.7s] [animation-delay:0.4s]" />
      <span className="h-2/5 w-1 origin-bottom rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.9s] [animation-delay:0.1s]" />
    </div>
  );
}

/** Play button of a stopped station, Stop button of the playing one. */
function PlayStopButton({ playing, onPlay, onStop, loc, size }: {
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  loc: Loc;
  size?: 'md' | 'lg';
}) {
  return playing ? (
    <Button variant="danger" size={size} onClick={onStop}>
      <Square size={14} /> {loc.player.stop}
    </Button>
  ) : (
    <Button variant="primary" size={size} onClick={onPlay}>
      <Play size={14} /> {loc.player.play}
    </Button>
  );
}

interface StationCardProps {
  station: RadioStation;
  playing: boolean;
  /** Accent of the card while its station plays, and of its genre badge. */
  tone: 'pink' | 'cyan';
  title: React.ReactNode;
  body: React.ReactNode;
  /** Left side of the card's footer (website link, delete button). */
  footerStart: React.ReactNode;
  onPlay: () => void;
  onStop: () => void;
  loc: Loc;
}

/** One featured or custom station. */
function StationCard({ station, playing, tone, title, body, footerStart, onPlay, onStop, loc }: StationCardProps) {
  return (
    <Card highlight={playing && tone} padding="none" className="flex flex-col justify-between gap-3 rounded-2xl px-5 py-4.5">
      <div>
        <div className="mb-1.5 flex items-start justify-between gap-2">
          {title}
          <Badge tone={tone === 'pink' ? 'purple' : 'cyan'}>{station.genre}</Badge>
        </div>
        {body}
      </div>
      <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
        {footerStart}
        <PlayStopButton playing={playing} onPlay={onPlay} onStop={onStop} loc={loc} />
      </div>
    </Card>
  );
}

export const RadioView: React.FC<RadioViewProps> = ({
  currentLang,
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
  const isStationPlaying = (station: RadioStation) => currentStation?.url === station.url && isPlaying;
  const addButton = (
    <Button variant="primary" onClick={onOpenAddModal}>
      <Plus size={16} /> {loc.radio.addCustomStation}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 px-0 pt-2 pb-10 motion-safe:animate-fade-in">
      {/* Radio tab header */}
      <Card variant="panel" padding="lg">
        <PageHeader
          icon={<Radio size={20} />}
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              {loc.radio.title}
              <Badge tone="pink">
                <Wifi size={12} /> Live ICY / PipeWire
              </Badge>
            </span>
          }
          description={loc.radio.subtitle}
          actions={addButton}
        />
      </Card>

      {/* Currently playing stream (live status hero card) */}
      {currentStation && (
        <Card highlight="pink" padding="none" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex size-11.5 items-center justify-center rounded-xl border border-accent-pink',
                isPlaying ? 'bg-accent-pink/25' : 'bg-white/8',
              )}
            >
              {isPlaying ? <LiveBars /> : <Radio size={22} className="text-fg-muted" />}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <span className="label-caps text-accent-pink">
                  {isPlaying ? loc.radio.liveBroadcast : loc.radio.stopped}
                </span>
                <Badge>{currentStation.genre}</Badge>
              </div>
              <h3 className="mt-1 text-xl font-bold text-fg">{currentStation.name}</h3>
              <p
                className={cn(
                  'mt-1 flex items-center gap-1.5 text-sm',
                  liveStreamTitle ? 'font-semibold text-accent-cyan' : 'text-fg-muted',
                )}
              >
                <Music2 size={14} />
                {liveStreamTitle || loc.radio.nowPlayingLive}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge tone="cyan" size="sm" title="PipeWire DSP Real-Time">
              <Sliders size={14} /> DSP Real-Time
            </Badge>
            <PlayStopButton
              size="lg"
              playing={isPlaying}
              onPlay={() => onPlayStation(currentStation)}
              onStop={onStop}
              loc={loc}
            />
          </div>
        </Card>
      )}

      {/* Section: recommended stations */}
      <section>
        <SectionHeader
          className="mb-3.5"
          icon={<Sparkles size={16} />}
          title={`${loc.radio.featuredStations} (${FEATURED_RADIO_STATIONS.length})`}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-4">
          {FEATURED_RADIO_STATIONS.map((station) => {
            const playing = isStationPlaying(station);
            return (
              <StationCard
                key={station.id}
                station={station}
                playing={playing}
                tone="pink"
                loc={loc}
                onPlay={() => onPlayStation(station)}
                onStop={onStop}
                title={
                  <div className="flex items-center gap-2">
                    <Headphones size={18} className={playing ? 'text-accent-pink' : 'text-accent-purple'} />
                    <h4 className="text-base font-bold text-fg">{station.name}</h4>
                  </div>
                }
                body={<p className="mt-1.5 text-ui leading-snug text-fg-secondary">{stationDescription(loc, station)}</p>}
                footerStart={
                  station.homepage ? (
                    <a
                      href={station.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-fg-muted no-underline hover:text-accent-cyan"
                    >
                      <ExternalLink size={12} />
                      {loc.radio.website}
                    </a>
                  ) : <div />
                }
              />
            );
          })}
        </div>
      </section>

      {/* Section: custom stations */}
      <section className="mt-2.5">
        <SectionHeader
          className="mb-3.5"
          icon={<Radio size={16} />}
          tone="cyan"
          title={`${loc.radio.customStations} (${customStations.length})`}
        />

        {customStations.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={<Radio size={22} />}
              title={loc.radio.noCustomStations}
              description={loc.radio.supportedStreamsHint}
              action={
                <Button variant="tinted" tone="cyan" onClick={onOpenAddModal}>
                  <Plus size={16} /> {loc.radio.addCustomStation}
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-4">
            {customStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                playing={isStationPlaying(station)}
                tone="cyan"
                loc={loc}
                onPlay={() => onPlayStation(station)}
                onStop={onStop}
                title={<h4 className="text-base font-bold text-fg">{station.name}</h4>}
                body={
                  <p className="mt-1 truncate font-mono text-xs text-fg-muted" title={station.url}>
                    {station.url}
                  </p>
                }
                footerStart={
                  <IconButton
                    size="sm"
                    label={loc.radio.deleteStation}
                    onClick={() => onDeleteCustomStation(station.id)}
                    className="hover:text-accent-red"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
