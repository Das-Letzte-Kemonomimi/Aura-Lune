import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SettingsGroup } from './SettingsGroup';
import { ToolGroup } from './ToolGroup';
import { SettingRow } from './Card';
import { ToggleSwitch } from '../common/ToggleSwitch';

afterEach(cleanup);

describe('SettingsGroup', () => {
  it('names the section by its eyebrow and renders description, actions and rows', () => {
    render(
      <SettingsGroup label="Transitions" description="How tracks join" actions={<button type="button">Reset</button>}>
        <SettingRow compact title="Crossfade" />
      </SettingsGroup>,
    );
    expect(screen.getByRole('region', { name: 'Transitions' })).toBeTruthy();
    expect(screen.getByText('How tracks join')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(screen.getByText('Crossfade')).toBeTruthy();
  });
});

describe('SettingRow in a group', () => {
  it('labels the switch by the row title through htmlFor', () => {
    render(<SettingRow compact title="Close to tray" htmlFor="tray" control={<ToggleSwitch id="tray" label="Close to tray" checked={false} onChange={() => {}} />} />);
    expect(screen.getByLabelText('Close to tray', { selector: 'input' }).id).toBe('tray');
    expect((screen.getByText('Close to tray').closest('label') as HTMLLabelElement).htmlFor).toBe('tray');
  });

  it('adds horizontal padding only when compact', () => {
    const { rerender, container } = render(<SettingRow compact title="A" />);
    expect((container.firstChild as HTMLElement).className).toContain('px-4');
    rerender(<SettingRow title="A" />);
    expect((container.firstChild as HTMLElement).className).not.toContain('px-4');
  });
});

describe('ToolGroup', () => {
  it('is a labelled group and picks the radius by size', () => {
    const { rerender } = render(<ToolGroup label="Transport">x</ToolGroup>);
    expect(screen.getByRole('group', { name: 'Transport' }).className).toContain('rounded-2xl');
    rerender(
      <ToolGroup label="Transport" size="sm">
        x
      </ToolGroup>,
    );
    expect(screen.getByRole('group', { name: 'Transport' }).className).toContain('rounded-xl');
  });
});
