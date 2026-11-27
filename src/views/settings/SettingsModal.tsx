import React, { useEffect, useRef } from 'react';
import {
  Settings,
  Palette,
  Play,
  Radio,
  Music,
  Plug,
  FileAudio,
  Save,
  Download,
  Info,
} from '../../components/ui/icons';
import { type Translations } from '../../i18n';

export type { SettingsTab } from '../../types/navigation';
import { SETTINGS_TABS, type SettingsNavGroupId, type SettingsTab } from '../../types/navigation';
import {
  Badge,
  ModalBody,
  ModalHeader,
  ModalShell,
  SettingsNav,
  type SettingsNavGroup,
} from '../../components/ui';

const TAB_ICONS: Record<SettingsTab, React.ReactNode> = {
  general: <Settings size={15} />,
  appearance: <Palette size={15} />,
  playback: <Play size={15} />,
  audio: <Radio size={15} />,
  library: <Music size={15} />,
  integrations: <Plug size={15} />,
  export: <FileAudio size={15} />,
  data: <Save size={15} />,
  updates: <Download size={15} />,
  about: <Info size={15} />,
};

const TAB_PANEL_ID = 'settings-panel';
const tabElementId = (tab: SettingsTab) => `settings-tab-${tab}`;

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  loc: Translations;
  /** Shows the "new" bubble on the Updates tab. */
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
  const contentRef = useRef<HTMLDivElement>(null);

  // Each tab starts at the top.
  useEffect(() => {
    contentRef.current?.scrollTo?.({ top: 0 });
  }, [activeTab]);

  if (!isOpen) return null;

  const groups: SettingsNavGroup<SettingsTab>[] = [];
  for (const tab of SETTINGS_TABS) {
    const items = groups.find((g) => g.id === tab.group)?.items;
    const label = tab.id === 'updates' ? loc.updates.title : loc.settings.nav[tab.id];
    const item = {
      id: tab.id,
      label,
      icon: TAB_ICONS[tab.id],
      badge:
        tab.id === 'updates' && updateAvailable ? (
          <Badge tone="green" size="xs" data-testid="updates-tab-pill" className="uppercase">
            {loc.updates.badge}
          </Badge>
        ) : undefined,
    };
    if (items) (items as (typeof item)[]).push(item);
    else groups.push({ id: tab.group, label: loc.settings.navGroup[tab.group as SettingsNavGroupId], items: [item] });
  }

  return (
    <ModalShell onClose={onClose} size="3xl" labelledBy="settings-title" className="h-[min(88vh,53.75rem)] max-h-[90vh]">
      <ModalHeader
        titleId="settings-title"
        title={loc.settings.title}
        subtitle={loc.settings.subtitle}
        icon={<Settings size={22} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.settings.close}
      />

      {/* Rail on wide windows, a scrollable strip below 3xl. Only the content column scrolls. */}
      <div className="@container flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
          <div className="shrink-0 border-b border-line p-2 @3xl:w-56 @3xl:overflow-y-auto @3xl:border-r @3xl:border-b-0 @3xl:p-4">
            <SettingsNav
              groups={groups}
              value={activeTab}
              onChange={onSelectTab}
              label={loc.settings.title}
              orientation="responsive"
              tabId={tabElementId}
              panelId={TAB_PANEL_ID}
            />
          </div>
          <ModalBody
            ref={contentRef}
            role="tabpanel"
            id={TAB_PANEL_ID}
            aria-labelledby={tabElementId(activeTab)}
            className="min-w-0 flex-1 p-4 sm:p-6"
          >
            {children}
          </ModalBody>
        </div>
      </div>
    </ModalShell>
  );
};
