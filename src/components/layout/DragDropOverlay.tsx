import React from 'react';
import { UploadCloud, X } from 'lucide-react';
import { type Translations } from '../../i18n';

export interface DragDropOverlayProps {
  isDraggingOver: boolean;
  onDismiss: () => void;
  loc: Translations;
}

const SUPPORTED_FORMATS = ['FLAC', 'MP3', 'OGG', 'OPUS', 'WAV', 'M4A', 'AAC', 'ALAC'];

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({
  isDraggingOver,
  onDismiss,
  loc,
}) => {
  if (!isDraggingOver) return null;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(9, 10, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        border: '3px dashed var(--accent-pink)',
        borderRadius: '24px',
        margin: '16px',
        pointerEvents: 'auto',
        animation: 'pulse-drop 2s infinite ease-in-out',
        cursor: 'pointer',
      }}
    >
      {/* Przycisk zamknięcia / anulowania w prawym górnym rogu */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        title={loc.common?.cancel || 'Anuluj (Esc)'}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <X size={20} />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 35px rgba(244, 63, 94, 0.6)',
          animation: 'bounce-drop 1.5s infinite ease-in-out',
        }}
      >
        <UploadCloud size={52} color="#fff" />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', maxWidth: '600px', padding: '0 20px' }}
      >
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 10px 0',
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}
        >
          {loc.dragDrop.title}
        </h2>
        <p
          style={{
            fontSize: '1.05rem',
            color: 'var(--accent-cyan)',
            margin: '0 0 12px 0',
            fontWeight: 600,
          }}
        >
          {loc.dragDrop.subtitle}
        </p>
        <div
          style={{
            display: 'inline-flex',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '8px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
          }}
        >
          {SUPPORTED_FORMATS.map((fmt) => (
            <span
              key={fmt}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}
            >
              {fmt}
            </span>
          ))}
        </div>
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '8px 20px',
              color: 'var(--text-secondary)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <X size={16} />
            {loc.common?.cancel || 'Anuluj'} (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
