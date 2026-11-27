import React from 'react';
import { Plug } from '../../components/ui/icons';
import { DiscordSection, type DiscordSectionProps } from './integrations/DiscordSection';
import { LastfmSection, type LastfmSectionProps } from './integrations/LastfmSection';
import { ListenBrainzSection, type ListenBrainzSectionProps } from './integrations/ListenBrainzSection';
import { SettingsPage } from './SettingsPage';

export type IntegrationsSettingsViewProps = DiscordSectionProps & ListenBrainzSectionProps & LastfmSectionProps;

/** Integrations: Discord Rich Presence and the ListenBrainz and Last.fm scrobblers. */
export const IntegrationsSettingsView: React.FC<IntegrationsSettingsViewProps> = (props) => (
  <SettingsPage title={props.loc.settings.nav.integrations} icon={<Plug size={22} />} tone="purple">
    <DiscordSection {...props} />
    <ListenBrainzSection {...props} />
    <LastfmSection {...props} />
  </SettingsPage>
);
