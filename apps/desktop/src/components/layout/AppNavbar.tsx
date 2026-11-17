import React from 'react';
import {
  Play,
  Music,
  ListPlus,
  Sliders,
  Radio,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';

export type MainTabType =
  | 'player'
  | 'library'
  | 'playlists'
  | 'stem-projects'
  | 'radio'
  | 'dsp'
  | 'stats';

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
      label: 'Stem Projects',
      icon: <Sliders size={14} />,
      title: loc.nav.stemProjectsTitle,
    },
    {
      id: 'radio',
      label: loc.nav.radio || 'Radio',
      icon: <Radio size={14} />,
      title: loc.nav.radio || 'Radio',
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
    <nav
      style={{
        display: 'flex',
        gap: '4px',
        background: 'rgba(0,0,0,0.3)',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              background: isActive ? 'var(--accent-purple)' : 'transparent',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: 'none',
              transition: 'background 0.15s ease',
            }}
            title={tab.title}
          >
            {tab.icon}
            <span className="header-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
