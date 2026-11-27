import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SettingsTabSkeleton } from './SettingsTabSkeleton';
import { getTranslations } from '../../i18n';
import { SETTINGS_TABS } from '../../types/navigation';

const loc = getTranslations('en');

afterEach(cleanup);

describe('SettingsTabSkeleton', () => {
  it.each(SETTINGS_TABS.map((t) => t.id))('renders distinct accessible skeleton for %s settings tab', (tab) => {
    const { container } = render(<SettingsTabSkeleton tab={tab} loc={loc} />);
    const tabLabel = tab === 'updates' ? loc.updates.title : loc.settings.nav[tab];
    const expectedLabel = `Loading ${tabLabel}…`;
    const status = screen.getByRole('status', { name: expectedLabel });
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText(expectedLabel)).toBeTruthy();
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(0);
  });
});
