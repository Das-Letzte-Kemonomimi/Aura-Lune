import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Card, PageHeader, SectionHeader, SettingRow } from './Card';
import { Callout } from './Callout';

afterEach(cleanup);

describe('Card', () => {
  it('renders the variant, padding and interactive hover', () => {
    render(
      <Card variant="inset" padding="sm" interactive>
        body
      </Card>,
    );
    const className = screen.getByText('body').className;
    expect(className).toContain('bg-black/30');
    expect(className).toContain('p-4');
    expect(className).toContain('hover:border-line-accent');
  });

  it('tints the card only while highlight is set', () => {
    const { rerender } = render(<Card highlight="purple">body</Card>);
    const className = () => screen.getByText('body').className;
    expect(className()).toContain('border-accent-purple/45');
    expect(className()).not.toContain('border-line');
    rerender(<Card highlight={false}>body</Card>);
    expect(className()).toContain('border-line');
    expect(className()).not.toContain('accent-purple');
  });

  it("lets the caller's className win", () => {
    render(<Card className="p-2">body</Card>);
    const className = screen.getByText('body').className;
    expect(className).toContain('p-2');
    expect(className).not.toContain('p-5');
  });
});

describe('SectionHeader', () => {
  it('renders the heading level, description and actions', () => {
    render(
      <SectionHeader
        as="h2"
        id="sec"
        title="Output"
        description="Where the sound goes"
        icon={<svg data-testid="icon" />}
        actions={<button type="button">Reset</button>}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Output' });
    expect(heading.id).toBe('sec');
    expect(screen.getByText('Where the sound goes')).toBeTruthy();
    expect(screen.getByTestId('icon')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
  });
});

describe('PageHeader', () => {
  it('uses the medium tile and title by default', () => {
    render(<PageHeader title="Library" icon={<svg data-testid="icon" />} />);
    const tile = screen.getByTestId('icon').parentElement as HTMLElement;
    expect(tile.className).toContain('size-9');
    expect(screen.getByRole('heading', { level: 2, name: 'Library' }).className).toContain('text-lg');
  });

  it('grows the tile and title for size="lg"', () => {
    render(<PageHeader size="lg" title="Themes" icon={<svg data-testid="icon" />} />);
    const tile = screen.getByTestId('icon').parentElement as HTMLElement;
    expect(tile.className).toContain('size-10');
    expect(tile.className).not.toContain('size-9');
    expect(screen.getByRole('heading', { level: 2, name: 'Themes' }).className).toContain('text-xl');
  });
});

describe('SettingRow', () => {
  it('renders the title, description, control and extra content', () => {
    render(
      <SettingRow title="Gapless" description="No silence between tracks" control={<input type="checkbox" />}>
        <span>extra</span>
      </SettingRow>,
    );
    expect(screen.getByText('Gapless')).toBeTruthy();
    expect(screen.getByText('No silence between tracks')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.getByText('extra')).toBeTruthy();
  });
});

describe('Callout', () => {
  it('treats danger as the red tone and colours the icon', () => {
    render(
      <Callout tone="danger" icon={<svg data-testid="warn" />}>
        Failed
      </Callout>,
    );
    const box = screen.getByText('Failed').parentElement as HTMLElement;
    expect(box.className).toContain('bg-accent-red/15');
    expect((screen.getByTestId('warn').parentElement as HTMLElement).className).toContain('text-accent-red');
  });

  it('keeps plain children without an icon', () => {
    render(<Callout tone="green">Done</Callout>);
    expect(screen.getByText('Done').className).toContain('bg-accent-green/15');
  });
});
