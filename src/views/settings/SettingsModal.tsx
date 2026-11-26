import React from 'react';
import {
  Settings,
  Palette,
  Radio,
  FileAudio,
  Info,
  Save,
  Download,
} from '../../components/ui/icons';
import { type Translations } from '../../i18n';

export type { SettingsTab } from '../../types/navigation';
import type { SettingsTab } from '../../types/navigation';
import { Badge, ModalBody, ModalHeader, ModalShell, SegmentedControl, type SegmentedItem } from '../../components/ui';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  loc: Translations;
  /** Shows the "new" pill next to the Updates tab. */
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

  const tabs: SegmentedItem<SettingsTab>[] = [
    { value: 'themes', label: loc.settings.themes, icon: <Palette size={15} /> },
    { value: 'devices', label: loc.settings.audioDevices, icon: <Radio size={15} /> },
    { value: 'transcode', label: loc.settings.exportOpus, icon: <FileAudio size={15} /> },
    {
      value: 'updates',
      label: (
        <>
          {loc.updates.tab}
          {updateAvailable && (
            <Badge tone="green" size="xs" data-testid="updates-tab-pill" className="uppercase">
              {loc.updates.badge}
            </Badge>
          )}
        </>
      ),
      ariaLabel: updateAvailable ? `${loc.updates.tab} (${loc.updates.badge})` : loc.updates.tab,
      icon: <Download size={15} />,
    },
    { value: 'about', label: loc.settings.about, icon: <Info size={15} /> },
    { value: 'backup', label: loc.settings.backupTitle, icon: <Save size={15} /> },
  ];

  return (
    <ModalShell onClose={onClose} size="2xl" labelledBy="settings-title" className="h-[86vh] max-h-215">
      <ModalHeader
        titleId="settings-title"
        title={loc.settings.title}
        subtitle={loc.settings.subtitle}
        icon={<Settings size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.settings.close}
      />

      {/* Settings tab bar */}
      <div className="shrink-0 border-b border-line px-6 py-2.5">
        <SegmentedControl
          label={loc.settings.title}
          tone="purple"
          items={tabs}
          value={activeTab}
          onChange={onSelectTab}
          fullWidth
          className="*:whitespace-normal *:leading-tight"
        />
      </div>

      {/* Content of the selected settings sub-tab */}
      <ModalBody className="p-6">{children}</ModalBody>
    </ModalShell>
  );
};
