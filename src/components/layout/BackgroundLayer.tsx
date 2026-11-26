import React from 'react';

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
          className="anime-bg-layer"
          src={themeBgImage!}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: -2,
            filter: `blur(${themeBlur || 0}px)`,
            transform: 'scale(1.05)',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          className="anime-bg-layer"
          style={{
            backgroundImage: themeBgImage ? `url("${themeBgImage}")` : undefined,
            display: themeBgImage ? 'block' : 'none',
            filter: `blur(${themeBlur || 0}px)`,
          }}
        />
      )}
      <div
        className="anime-overlay-layer"
        style={{
          display: themeBgImage ? 'block' : 'none',
          opacity: themeOverlay,
        }}
      />
    </>
  );
};
