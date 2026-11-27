import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Skeleton, SkeletonLoadingPill } from './Skeleton';

afterEach(cleanup);

describe('Skeleton', () => {
  it('renders decorative shimmer block with default shape and tone', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('skeleton-shimmer');
    expect(el.className).toContain('rounded-xl');
    expect(el.className).toContain('h-4 w-24');
  });

  it('applies pill/circle shapes and accent tones', () => {
    const { container } = render(
      <>
        <Skeleton shape="pill" tone="pink" className="h-6 w-20" />
        <Skeleton shape="circle" tone="cyan" className="size-10" />
      </>,
    );
    const [pill, circle] = Array.from(container.children) as HTMLElement[];
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('border-accent-pink/25');
    expect(circle.className).toContain('aspect-square');
    expect(circle.className).toContain('border-accent-cyan/25');
  });
});

describe('SkeletonLoadingPill', () => {
  it('displays the loading label and decorative equalizer bars', () => {
    const { container } = render(<SkeletonLoadingPill label="Loading Library…" />);
    expect(screen.getByText('Loading Library…')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
