// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins conditional classes', () => {
    const hidden = false;
    expect(cn('flex', hidden && 'hidden', null, undefined, ['gap-2', { 'p-2': true, 'm-2': false }])).toBe(
      'flex gap-2 p-2',
    );
  });

  it('lets the later class win a conflict', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('bg-accent-pink/15', 'bg-surface')).toBe('bg-surface');
  });

  it('keeps a custom font size next to a text colour', () => {
    expect(cn('text-ui', 'text-fg')).toBe('text-ui text-fg');
    expect(cn('text-fg-muted text-xxs', 'text-accent-pink')).toBe('text-xxs text-accent-pink');
  });

  it('resolves conflicts between custom font sizes', () => {
    expect(cn('text-xs', 'text-ui')).toBe('text-ui');
    expect(cn('text-2xs', 'text-md')).toBe('text-md');
  });

  it('treats custom shadows as shadows, not shadow colours', () => {
    expect(cn('shadow-panel', 'shadow-accent-glow')).toBe('shadow-accent-glow');
    expect(cn('shadow-halo shadow-accent-cyan/50', 'shadow-lift')).toBe('shadow-accent-cyan/50 shadow-lift');
    expect(cn('shadow-panel', 'shadow-accent-pink/30')).toBe('shadow-panel shadow-accent-pink/30');
  });

  it('treats the label tracking token as letter spacing', () => {
    expect(cn('tracking-wide', 'tracking-label')).toBe('tracking-label');
  });
});
