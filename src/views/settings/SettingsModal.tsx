import React from 'react';
import {
  Settings,
  X,
  Palette,
  Radio,
  FileAudio,
  Info,
  Save,
  Download,
} from 'lucide-react';
import { type Translations } from '../../i18n';

export type { SettingsTab } from '../../types/navigation';
import type { SettingsTab } from '../../types/navigation';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  loc: Translations;
  /** Pokazuje pigułkę „nowe” przy zakładce Aktualizacje. */
  updateAvailable?: boolean;
  children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  loc,
  updateAvailable = false,
  children,
}) => {
  if (!isOpen) return null;

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'themes', label: loc.settings.themes, icon: <Palette size={15} /> },
    { id: 'devices', label: loc.settings.audioDevices, icon: <Radio size={15} /> },
    { id: 'transcode', label: loc.settings.exportOpus, icon: <FileAudio size={15} /> },
    { id: 'updates', label: loc.updates.tab, icon: <Download size={15} /> },
    { id: 'about', label: loc.settings.about, icon: <Info size={15} /> },
    { id: 'backup', label: loc.settings.backupTitle, icon: <Save size={15} /> },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '960px',
          height: '86vh',
          maxHeight: '860px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          border: '1px solid var(--border-accent)',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          background: 'var(--bg-deep)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek okna ustawień */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.35)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
              }}
            >
              <Settings size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                {loc.settings.title}
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                {loc.settings.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="glass-card"
            style={{
              padding: '6px 10px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            title={loc.settings.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Pasek zakładek ustawień */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 24px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto',
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
                  position: 'relative',
                  padding: '8px 14px',
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
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'updates' && updateAvailable && (
                  <span
                    data-testid="updates-tab-pill"
                    style={{
                      // Na krawędzi przycisku, nad nim — zakładka nie robi się szersza.
                      position: 'absolute',
                      top: '-7px',
                      right: '-4px',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      padding: '2px 6px',
                      borderRadius: '999px',
                      background: '#22c55e',
                      color: '#04210f',
                      textTransform: 'uppercase',
                      boxShadow: '0 0 0 2px var(--bg-deep)',
                      pointerEvents: 'none',
                    }}
                  >
                    {loc.updates.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Treść wybranej pod-zakładki ustawień */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
