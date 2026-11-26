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
  }> = [
    {
      id: 'player',
      label: loc.nav.nowPlaying,
      icon: <Play size={14} />,
      title: loc.nav.nowPlaying,
    },
    {
      id: 'library',
      label: `${loc.nav.library} (${trackCount})`,
      icon: <Music size={14} />,
      title: loc.nav.library,
    },
    {
      id: 'playlists',
      label: `${loc.nav.playlists} (${playlistCount})`,
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
    <nav className="flex shrink-0 gap-1 rounded-xl border border-line bg-black/30 p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className="flex items-center gap-1.5 bg-transparent px-3 py-2 text-ui font-semibold text-fg aria-[current=page]:bg-accent-purple"
            title={tab.title}
          >
            {tab.icon}
            <span className="max-nav:hidden">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
