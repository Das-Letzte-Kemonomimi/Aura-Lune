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
    { value: 'themes', label: loc.settings.themes, icon: <Palette size={18} /> },
    { value: 'devices', label: loc.settings.audioDevices, icon: <Radio size={18} /> },
    { value: 'transcode', label: loc.settings.exportOpus, icon: <FileAudio size={18} /> },
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
      icon: <Download size={18} />,
    },
    { value: 'about', label: loc.settings.about, icon: <Info size={18} /> },
    { value: 'backup', label: loc.settings.backupTitle, icon: <Save size={18} /> },
  ];

  return (
    <ModalShell onClose={onClose} size="2xl" labelledBy="settings-title" className="h-[min(88vh,53.75rem)] max-h-[90vh]">
      <ModalHeader
        titleId="settings-title"
        title={loc.settings.title}
        subtitle={loc.settings.subtitle}
        icon={<Settings size={22} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.settings.close}
      />

      {/* Settings tab bar. Below 3xl (narrow windows, large UI scale) the icon stacks above the label so six tabs still fit. */}
      <div className="@container shrink-0 border-b border-line px-4 py-2 sm:px-6 sm:py-2.5">
        <SegmentedControl
          label={loc.settings.title}
          tone="purple"
          items={tabs}
          value={activeTab}
          onChange={onSelectTab}
          fullWidth
          className="*:whitespace-normal *:leading-tight @max-3xl:*:flex-col @max-3xl:*:gap-1"
        />
      </div>

      {/* Content of the selected settings sub-tab */}
      <ModalBody className="p-4 sm:p-6">{children}</ModalBody>
    </ModalShell>
  );
};
