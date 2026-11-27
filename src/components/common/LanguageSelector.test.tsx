import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

describe('LanguageSelector', () => {
  afterEach(cleanup);

  it('marks the current language and switches to the picked one', async () => {
    const onLanguageChange = vi.fn();
    render(<LanguageSelector currentLang="en" onLanguageChange={onLanguageChange} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const current = screen.getByRole('menuitemradio', { checked: true });
    expect(current.textContent).toContain('English');

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Polski/ }));
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => {
      expect(onLanguageChange).toHaveBeenCalledWith('pl');
    });
  });

  it('closes on Escape without changing the language', () => {
    const onLanguageChange = vi.fn();
    render(<LanguageSelector currentLang="en" onLanguageChange={onLanguageChange} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onLanguageChange).not.toHaveBeenCalled();
  });
});
