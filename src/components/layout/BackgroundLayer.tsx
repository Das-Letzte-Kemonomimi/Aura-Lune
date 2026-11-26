import React from 'react';
import { cn } from '../../utils/cn';

export interface BackgroundLayerProps {
  themeBgImage: string | null;
  themeBlur: number;
  themeOverlay: number;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  themeBgImage,
  themeBlur,
  themeOverlay,
}) => {
  const isVideo =
    Boolean(themeBgImage) &&
    (themeBgImage!.toLowerCase().endsWith('.mp4') ||
      themeBgImage!.toLowerCase().endsWith('.webm') ||
      themeBgImage!.startsWith('data:video/'));

  return (
    <>
      {isVideo ? (
        <video
          className="pointer-events-none fixed inset-0 -z-2 size-full scale-105 object-cover transition-[filter] duration-250"
          src={themeBgImage!}
          autoPlay
          loop
          muted
          playsInline
          style={{ filter: `blur(${themeBlur || 0}px)` }}
        />
      ) : (
        <div
          className={cn('anime-bg-layer', !themeBgImage && 'hidden')}
          style={{
            backgroundImage: themeBgImage ? `url("${themeBgImage}")` : undefined,
            filter: `blur(${themeBlur || 0}px)`,
          }}
        />
      )}
      <div className={cn('anime-overlay-layer', !themeBgImage && 'hidden')} style={{ opacity: themeOverlay }} />
    </>
  );
};
