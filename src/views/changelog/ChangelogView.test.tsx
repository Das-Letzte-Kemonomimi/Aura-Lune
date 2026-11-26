import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ChangelogView } from './ChangelogView';

describe('ChangelogView component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders stable releases and hides dev entries on stable channel', () => {
    render(<ChangelogView currentLang="en" channel="stable" />);
    expect(screen.getByText('Changelog & Release Notes')).toBeTruthy();
    expect(screen.getAllByText(/v1\.1\.5/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/-dev/)).toBeNull();
  });

  it('renders the dev entry with dev badge when channel is dev', () => {
    render(<ChangelogView currentLang="en" channel="dev" />);
    expect(screen.getByText('DEV BUILD')).toBeTruthy();
    expect(screen.getAllByText(/v1\.1\.5/i).length).toBeGreaterThan(0);
  });

  it('renders pagination and paginated releases', () => {
    render(<ChangelogView currentLang="en" />);
    // Check pagination information
    expect(screen.getByText(/Total:\s*\d+\s*releases/i)).toBeTruthy();
    expect(screen.getByText(/Page 1 of/i)).toBeTruthy();
    // Next button should be present and clickable
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Page 2 of/i)).toBeTruthy();
  });

  it('allows changing items per page', () => {
    render(<ChangelogView currentLang="en" />);
    const button3 = screen.getByTestId('page-size-3');
    fireEvent.click(button3);
    expect(screen.getByText(/Page 1 of/i)).toBeTruthy();
  });
});
