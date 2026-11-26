import React from 'react';
import type { Translations } from '../../../i18n';
import type { BigScreenViewProps } from '../BigScreenView';

export type BigScreenTapeDeckProps = Pick<BigScreenViewProps, 'isPlaying' | 'title' | 'artist' | 'tempoRatio'> & {
  showLyrics: boolean;
  t: Translations;
  progress: number;
};

export const BigScreenTapeDeck: React.FC<BigScreenTapeDeckProps> = ({
  artist,
  isPlaying,
  progress,
  showLyrics,
  t,
  tempoRatio,
  title,
}) => (
    <div
      style={{
        width: showLyrics ? 'min(360px, 100%)' : 'min(440px, 100%)',
        height: showLyrics ? 'min(230px, 30vh)' : 'min(280px, 34vh)',
        borderRadius: '16px',
        background: 'linear-gradient(145deg, #181926 0%, #0d0e17 100%)',
        border: '2px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isPlaying
          ? '0 0 35px rgba(244, 63, 94, 0.35), 0 20px 45px rgba(0, 0, 0, 0.85)'
          : '0 20px 45px rgba(0, 0, 0, 0.85)',
        position: 'relative',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* 4 śrubki narożne */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
        <div
          key={corner}
          style={{
            position: 'absolute',
            top: corner.includes('top') ? '6px' : 'auto',
            bottom: corner.includes('bottom') ? '6px' : 'auto',
            left: corner.includes('left') ? '6px' : 'auto',
            right: corner.includes('right') ? '6px' : 'auto',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#94a3b8',
            border: '1px solid #475569',
            boxShadow: 'inset 0 0 2px #000',
          }}
        />
      ))}

      {/* Naklejka etykiety kasety (Vintage Paper Label) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
          color: '#1e1b4b',
          borderRadius: '8px',
          padding: '8px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          border: '1px solid #e9d5ff',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-pink)', letterSpacing: '0.08em' }}>
            {t.bigScreenModes.sideA}
          </span>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6b21a8' }}>
            {t.bigScreenModes.stereo}
          </span>
        </div>
        <div
          style={{
            fontSize: '0.88rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#111827',
            fontFamily: 'monospace, sans-serif',
          }}
        >
          {title || 'Auralune Track'}
        </div>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#4b5563',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {artist || 'Unknown Artist'}
        </div>
      </div>

      {/* Środkowe przezroczyste okienko taśmy ze szpulami */}
      <div
        style={{
          flex: 1,
          margin: '10px 0',
          background: 'rgba(0, 0, 0, 0.65)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)',
        }}
      >
        {/* Podziałka magnetofonowa: 100 • 50 • 0 */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            fontSize: '0.6rem',
            color: 'rgba(255, 255, 255, 0.4)',
            letterSpacing: '8px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          100 • 50 • 0
        </div>

        {/* Lewa szpula (Feed reel) - taśma maleje od 100% do 0% */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: `${Math.max(32, 70 - (progress / 100) * 36)}px`,
              height: `${Math.max(32, 70 - (progress / 100) * 36)}px`,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #271a15 30%, #451a03 70%, #1e130c 100%)',
              boxShadow: '0 0 8px rgba(0,0,0,0.8)',
              position: 'absolute',
              transition: 'width 0.2s, height 0.2s',
            }}
          />
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#f8fafc',
              border: '2px solid #cbd5e1',
              boxShadow: 'inset 0 0 6px #64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              animation: isPlaying
                ? `spin ${Math.max(0.8, 2.5 / (tempoRatio || 1.0))}s linear infinite`
                : 'none',
            }}
          >
            {[0, 60, 120].map((deg) => (
              <div
                key={deg}
                style={{
                  position: 'absolute',
                  width: '4px',
                  height: '24px',
                  background: '#475569',
                  borderRadius: '1px',
                  transform: `rotate(${deg}deg)`,
                }}
              />
            ))}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#0f172a',
                zIndex: 3,
              }}
            />
          </div>
        </div>

        {/* Przechodzący pasek taśmy magnetycznej */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            width: '65%',
            height: '6px',
            background: 'linear-gradient(90deg, #451a03, #78350f, #451a03)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
          }}
        />

        {/* Prawa szpula (Take-up reel) - taśma rośnie od 0% do 100% */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: `${Math.max(32, 34 + (progress / 100) * 36)}px`,
              height: `${Math.max(32, 34 + (progress / 100) * 36)}px`,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #271a15 30%, #451a03 70%, #1e130c 100%)',
              boxShadow: '0 0 8px rgba(0,0,0,0.8)',
              position: 'absolute',
              transition: 'width 0.2s, height 0.2s',
            }}
          />
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#f8fafc',
              border: '2px solid #cbd5e1',
              boxShadow: 'inset 0 0 6px #64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              animation: isPlaying
                ? `spin ${Math.max(0.8, 2.5 / (tempoRatio || 1.0))}s linear infinite`
                : 'none',
            }}
          >
            {[0, 60, 120].map((deg) => (
              <div
                key={deg}
                style={{
                  position: 'absolute',
                  width: '4px',
                  height: '24px',
                  background: '#475569',
                  borderRadius: '1px',
                  transform: `rotate(${deg}deg)`,
                }}
              />
            ))}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#0f172a',
                zIndex: 3,
              }}
            />
          </div>
        </div>
      </div>

      {/* Dolny profil kasety z rolkami prowadzącymi */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 30px',
        }}
      >
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#64748b', border: '1px solid #94a3b8' }} />
        <div style={{ width: '28px', height: '10px', background: '#334155', borderRadius: '2px', border: '1px solid #475569' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#64748b', border: '1px solid #94a3b8' }} />
      </div>
    </div>
);
