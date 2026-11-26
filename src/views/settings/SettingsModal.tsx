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
import { cn } from '../../utils/cn';
import { ModalShell } from '../../components/ui';

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
    <ModalShell
      onClose={onClose}
      className="flex h-[86vh] max-h-215 max-w-240 flex-col overflow-hidden rounded-3xl border border-line-accent bg-deep shadow-2xl shadow-black/85"
    >
      {/* Nagłówek okna ustawień */}
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-black/35 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-linear-135 from-accent-purple to-accent-pink shadow-halo shadow-accent-purple/40"
          >
            <Settings size={18} className="text-fg" />
          </div>
          <div>
            <h2 className="m-0 text-lg font-bold text-fg">
              {loc.settings.title}
            </h2>
            <p className="m-0 text-xs text-fg-muted">
              {loc.settings.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="glass-card flex items-center px-2.5 py-1.5 text-fg-muted"
          title={loc.settings.close}
        >
          <X size={18} />
        </button>
      </div>

      {/* Pasek zakładek ustawień */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-black/20 px-6 py-2.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-ui font-semibold text-fg transition-[background] duration-150',
                isActive ? 'bg-accent-purple' : 'bg-transparent',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'updates' && updateAvailable && (
                <span
                  data-testid="updates-tab-pill"
                  className="pointer-events-none absolute -top-2 -right-1 rounded-full bg-green-500 px-1.5 py-0.5 text-2xs leading-none font-extrabold text-green-950 uppercase ring-2 ring-deep"
                >
                  {loc.updates.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Treść wybranej pod-zakładki ustawień */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </ModalShell>
  );
};
