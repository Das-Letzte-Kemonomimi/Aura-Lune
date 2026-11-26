import React from 'react';
import {
  Play,
  Music,
  ListPlus,
  Sliders,
  Radio,
  SlidersHorizontal,
  BarChart3,
} from '../ui/icons';
import { type Language, type Translations } from '../../i18n';

export type { MainTabType } from '../../types/navigation';
import type { MainTabType } from '../../types/navigation';

export interface AppNavbarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  trackCount: number;
  playlistCount: number;
  language: Language;
  loc: Translations;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  activeTab,
  onSelectTab,
  trackCount,
  playlistCount,
  language: _language,
  loc,
}) => {
  const tabs: Array<{
    id: MainTabType;
    label: string;
    icon: React.ReactNode;
    title: string;
    count?: number;
  }> = [
    {
      id: 'player',
      label: loc.nav.nowPlaying,
      icon: <Play size={14} />,
      title: loc.nav.nowPlaying,
    },
    {
      id: 'library',
      label: loc.nav.library,
      count: trackCount,
      icon: <Music size={14} />,
      title: loc.nav.library,
    },
    {
      id: 'playlists',
      label: loc.nav.playlists,
      count: playlistCount,
      icon: <ListPlus size={14} />,
      title: loc.nav.playlists,
    },
    {
      id: 'stem-projects',
      label: loc.nav.stemProjects,
      icon: <Sliders size={14} />,
      title: loc.nav.stemProjectsTitle,
    },
    {
      id: 'radio',
      label: loc.nav.radio,
      icon: <Radio size={14} />,
      title: loc.nav.radio,
    },
    {
      id: 'dsp',
      label: loc.nav.dsp,
      icon: <SlidersHorizontal size={14} />,
      title: loc.nav.dsp,
    },
    {
      id: 'stats',
      label: loc.nav.stats,
      icon: <BarChart3 size={14} />,
      title: loc.nav.stats,
    },
  ];

  return (
    <nav aria-label="Main" className="flex shrink-0 gap-1 rounded-2xl border border-line bg-black/30 p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-ui font-semibold text-fg-secondary hover:text-fg aria-[current=page]:bg-accent-purple aria-[current=page]:text-fg aria-[current=page]:shadow-halo-sm aria-[current=page]:shadow-accent-purple/40"
            title={tab.title}
          >
            {tab.icon}
            <span className="max-nav:hidden">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="rounded-full bg-black/35 px-1.5 py-px font-mono text-2xs tabular-nums text-fg-muted">{tab.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
