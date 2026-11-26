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
      className="pointer-events-auto fixed inset-0 z-120 m-4 flex cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border-3 border-dashed border-accent-pink bg-deep/90 backdrop-blur-lg motion-safe:animate-pulse-drop"
    >
      {/* Close / cancel button in the top right corner */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        title={loc.common?.cancel || 'Cancel (Esc)'}
        className="absolute top-6 right-6 flex size-10.5 items-center justify-center rounded-full border border-white/20 bg-white/10 text-on-accent"
      >
        <X size={20} />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex size-25 items-center justify-center rounded-full bg-accent-gradient shadow-halo-2xl shadow-accent-pink/60 motion-safe:animate-bounce-drop"
      >
        <UploadCloud size={52} className="text-on-accent" />
      </div>

      <div onClick={(e) => e.stopPropagation()} className="max-w-150 px-5 text-center">
        <h2 className="mb-2.5 text-3xl font-extrabold tracking-tight text-fg text-shadow-deep">{loc.dragDrop.title}</h2>
        <p className="mb-3 text-base font-semibold text-accent-cyan">{loc.dragDrop.subtitle}</p>
        <div className="mb-4 inline-flex flex-wrap justify-center gap-2 rounded-xl border border-line bg-white/5 px-4 py-2">
          {SUPPORTED_FORMATS.map((fmt) => (
            <span key={fmt} className="font-mono text-xs font-bold text-fg-secondary">
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/10 px-5 py-2 text-sm font-semibold text-fg-secondary"
          >
            <X size={16} />
            {loc.common?.cancel || 'Cancel'} (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
