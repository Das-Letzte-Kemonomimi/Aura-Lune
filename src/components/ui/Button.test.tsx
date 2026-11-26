import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, IconButton } from './Button';
import { Chip, OptionCard } from './Chip';
import { Badge, Kbd } from './Badge';

afterEach(cleanup);

describe('Button', () => {
  it('defaults to a secondary md button of type="button"', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('bg-white/5');
    expect(button.className).toContain('text-ui');
  });

  it('applies the variant, the size and the tone of a tinted button', () => {
    render(
      <>
        <Button variant="primary" size="lg">
          Go
        </Button>
        <Button variant="tinted" tone="cyan">
          Tint
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-accent-gradient');
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('px-5');
    expect(screen.getByRole('button', { name: 'Tint' }).className).toContain('text-accent-cyan');
  });

  it("lets the caller's className win", () => {
    render(<Button className="px-8">Wide</Button>);
    const className = screen.getByRole('button', { name: 'Wide' }).className;
    expect(className).toContain('px-8');
    expect(className).not.toContain('px-3.5');
  });

  it('keeps an explicit submit type', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
  });
});

describe('IconButton', () => {
  it('uses the label as the accessible name and the tooltip', () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Close" onClick={onClick}>
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.getAttribute('title')).toBe('Close');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps a different tooltip when one is given', () => {
    render(
      <IconButton label="Close" title="Close (Esc)" size="sm">
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.getAttribute('title')).toBe('Close (Esc)');
    expect(button.className).toContain('size-7');
  });
});

describe('Chip', () => {
  it('reflects the pressed state in aria-pressed and styles it per tone', () => {
    const { rerender } = render(
      <Chip pressed={false} tone="green">
        Loudness
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Loudness' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.className).toContain('aria-pressed:text-accent-green');
    rerender(
      <Chip pressed tone="green">
        Loudness
      </Chip>,
    );
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it("lets the caller's className win", () => {
    render(
      <Chip pressed={false} size="xs" className="px-4">
        A
      </Chip>,
    );
    const className = screen.getByRole('button', { name: 'A' }).className.split(' ');
    expect(className).toContain('px-4');
    expect(className).not.toContain('px-2');
  });
});

describe('OptionCard', () => {
  it('is a pressed-state button that calls onClick', () => {
    const onClick = vi.fn();
    render(
      <OptionCard pressed tone="cyan" onClick={onClick}>
        <span>110%</span>
        <span>Comfortable</span>
      </OptionCard>,
    );
    const card = screen.getByRole('button', { name: /110%/ });
    expect(card.getAttribute('aria-pressed')).toBe('true');
    expect(card.getAttribute('type')).toBe('button');
    expect(card.className).toContain('aria-pressed:border-accent-cyan');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Kbd', () => {
  it('renders a kbd element in the list or hint size', () => {
    const { rerender } = render(<Kbd>Ctrl + K</Kbd>);
    const key = screen.getByText('Ctrl + K');
    expect(key.tagName).toBe('KBD');
    expect(key.className).toContain('text-xs');
    rerender(<Kbd size="xs">Ctrl + K</Kbd>);
    expect(screen.getByText('Ctrl + K').className).toContain('text-2xs');
  });
});

describe('Badge', () => {
  it('renders the tone, size and mono variants', () => {
    render(
      <Badge tone="amber" size="xs" mono>
        -3.0 dB
      </Badge>,
    );
    const className = screen.getByText('-3.0 dB').className;
    expect(className).toContain('text-accent-amber');
    expect(className).toContain('text-2xs');
    expect(className).toContain('font-mono');
  });

  it('is neutral by default', () => {
    render(<Badge>FLAC</Badge>);
    expect(screen.getByText('FLAC').className).toContain('text-fg-secondary');
  });
});
