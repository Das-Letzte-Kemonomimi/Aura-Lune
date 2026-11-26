import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState, ProgressBar, Spinner, StatusDot } from './Feedback';

afterEach(cleanup);

describe('Spinner', () => {
  it('is a status with a label, spinning only with motion allowed', () => {
    render(<Spinner label="Loading" tone="cyan" />);
    const spinner = screen.getByRole('status', { name: 'Loading' });
    const className = spinner.getAttribute('class') ?? '';
    expect(className).toContain('motion-safe:animate-spin');
    expect(className).toContain('text-accent-cyan');
  });

  it('is hidden from assistive tech without a label', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('StatusDot', () => {
  it('renders the tone and the pulse', () => {
    render(<StatusDot tone="red" pulse label="Offline" />);
    const className = screen.getByRole('img', { name: 'Offline' }).className;
    expect(className).toContain('bg-accent-red');
    expect(className).toContain('motion-safe:animate-pulse');
  });
});

describe('ProgressBar', () => {
  it('clamps the value and exposes it', () => {
    render(<ProgressBar value={140} label="Scan" />);
    const bar = screen.getByRole('progressbar', { name: 'Scan' });
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect((bar.firstChild as HTMLElement).style.width).toBe('100%');
  });

  it('uses a solid tone when given one, otherwise the gradient', () => {
    render(
      <>
        <ProgressBar value={30} tone="green" label="A" />
        <ProgressBar value={30} label="B" />
      </>,
    );
    expect((screen.getByRole('progressbar', { name: 'A' }).firstChild as HTMLElement).className).toContain(
      'bg-accent-green',
    );
    expect((screen.getByRole('progressbar', { name: 'B' }).firstChild as HTMLElement).className).toContain(
      'bg-accent-gradient',
    );
  });
});

describe('EmptyState', () => {
  it('renders the title, description and action', () => {
    render(
      <EmptyState
        title="No playlists"
        description="Create one to start"
        action={<button type="button">New playlist</button>}
      />,
    );
    expect(screen.getByText('No playlists')).toBeTruthy();
    expect(screen.getByText('Create one to start')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New playlist' })).toBeTruthy();
  });
});
