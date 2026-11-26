import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  afterEach(cleanup);

  it('defaults to type="button" so it never submits a surrounding form', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('keeps an explicit submit type', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
  });

  it('lets caller classes override variant classes', () => {
    render(
      <Button size="md" className="px-8">
        Wide
      </Button>,
    );
    const cls = screen.getByRole('button', { name: 'Wide' }).className;
    expect(cls).toContain('px-8');
    expect(cls).not.toContain('px-5');
  });

  it('exposes the chip toggle state through aria-pressed', () => {
    render(
      <Button variant="chip" aria-pressed>
        30 min
      </Button>,
    );
    expect(screen.getByRole('button', { name: '30 min', pressed: true })).toBeTruthy();
  });
});
