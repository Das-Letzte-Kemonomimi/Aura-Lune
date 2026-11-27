import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BackgroundLayer } from './BackgroundLayer';

describe('BackgroundLayer', () => {
  it('hides background and overlay layers when themeBgImage is null', () => {
    const { container } = render(
      <BackgroundLayer themeBgImage={null} themeBlur={8} themeOverlay={0.4} />,
    );

    const bg = container.querySelector('.anime-bg-layer');
    const overlay = container.querySelector('.anime-overlay-layer');
    expect(bg).not.toBeNull();
    expect(overlay).not.toBeNull();
    expect(bg?.className).toContain('hidden');
    expect(overlay?.className).toContain('hidden');
  });

  it('renders image background and overlay with blur and opacity when set', () => {
    const url = 'auralune-media://localhost/bg/abc123.png';
    const { container } = render(
      <BackgroundLayer themeBgImage={url} themeBlur={12} themeOverlay={0.55} />,
    );

    const bg = container.querySelector('.anime-bg-layer') as HTMLElement | null;
    const overlay = container.querySelector('.anime-overlay-layer') as HTMLElement | null;
    expect(bg).not.toBeNull();
    expect(overlay).not.toBeNull();
    expect(bg?.className).not.toContain('hidden');
    expect(overlay?.className).not.toContain('hidden');
    expect(bg?.style.backgroundImage).toContain(url);
    expect(bg?.style.filter).toBe('blur(12px)');
    expect(overlay?.style.opacity).toBe('0.55');
  });

  it('renders video background at z-0 for video URLs', () => {
    const url = 'auralune-media://localhost/bg/loop.mp4';
    const { container } = render(
      <BackgroundLayer themeBgImage={url} themeBlur={4} themeOverlay={0.3} />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe(url);
    expect(video?.className).toContain('z-0');
    expect(video?.className).not.toContain('-z-2');
    expect(video?.style.filter).toBe('blur(4px)');
  });
});
