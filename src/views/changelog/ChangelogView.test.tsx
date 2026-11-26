import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ChangelogView } from './ChangelogView';

describe('ChangelogView component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders changelog header and latest version badge', () => {
    render(<ChangelogView currentLang="en" />);
    expect(screen.getByText('Changelog & Release Notes')).toBeTruthy();
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
