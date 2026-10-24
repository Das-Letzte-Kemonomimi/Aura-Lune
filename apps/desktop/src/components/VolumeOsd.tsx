import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

export type VolumeOsdPosition = 'center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left' | 'off';

interface VolumeOsdProps {
  volume: number; // 0.0 - 1.0 (or up to 2.0)
  position: VolumeOsdPosition;
}

export const VolumeOsd: React.FC<VolumeOsdProps> = ({ volume, position }) => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const isFirstMount = useRef(true);

  const percentage = Math.round(volume * 100);

  useEffect(() => {
    // Nie wyświetlaj przy inicjalizacji
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (position === 'off') {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 1300);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [volume, position]);

  if (!visible || position === 'off') {
    return null;
  }

  // Obliczenie pozycji w oknie
  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'center':
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      case 'top-right':
        return {
          top: '32px',
          right: '32px',
        };
      case 'top-left':
        return {
          top: '32px',
          left: '32px',
        };
      case 'bottom-center':
        return {
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom-right':
        return {
          bottom: '120px',
          right: '32px',
        };
      case 'bottom-left':
        return {
          bottom: '120px',
          left: '32px',
        };
      default:
        return {
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 999999,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 24px',
        background: 'rgba(15, 17, 28, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(244, 63, 94, 0.35)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(244, 63, 94, 0.25)',
        borderRadius: '18px',
        minWidth: '180px',
        animation: 'volumeOsdPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transition: 'opacity 0.25s ease',
        ...getPositionStyles(),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {percentage === 0 ? (
          <VolumeX size={26} color="var(--accent-pink, #f43f5e)" />
        ) : percentage < 50 ? (
          <Volume1 size={26} color="var(--accent-cyan, #06b6d4)" />
        ) : (
          <Volume2 size={26} color="var(--accent-pink, #f43f5e)" />
        )}
        <span
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            color: '#fff',
            letterSpacing: '-0.02em',
          }}
        >
          {percentage}%
        </span>
      </div>

      {/* Wskaźnik paska głośności */}
      <div
        style={{
          width: '140px',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, percentage)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent-cyan, #06b6d4), var(--accent-pink, #f43f5e))',
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(244, 63, 94, 0.5)',
            transition: 'width 0.08s ease-out',
          }}
        />
      </div>
    </div>
  );
};
