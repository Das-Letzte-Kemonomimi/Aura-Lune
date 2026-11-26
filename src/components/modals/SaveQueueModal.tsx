import React, { useState } from 'react';
import { BookmarkPlus, X, Check, ListMusic } from 'lucide-react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

interface SaveQueueModalProps {
  isOpen: boolean;
  currentLang?: Language;
  queueLength: number;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export const SaveQueueModal: React.FC<SaveQueueModalProps> = ({
  isOpen,
  currentLang = 'pl',
  queueLength,
  onClose,
  onSave,
}) => {
  const [playlistName, setPlaylistName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playlistName.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSave(trimmed);
      setPlaylistName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      layer="nested"
      className="w-105 max-w-[92vw] rounded-2xl border border-line-accent p-6 shadow-2xl shadow-black/65"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 border-0 bg-transparent p-1 text-fg-muted"
      >
        <X size={18} />
      </button>

      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-accent-gradient shadow-lift shadow-pink-500/30"
        >
          <BookmarkPlus size={22} className="text-fg" />
        </div>
        <div>
          <h3 className="m-0 text-xl font-bold text-fg">
            {loc.queue.saveAsPlaylistTitle}
          </h3>
          <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
            {queueLength} {loc.library.tracks} {loc.queue.inCurrentQueue}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="mb-2 block text-ui font-semibold text-fg-secondary">
            {loc.queue.newPlaylistName}
          </label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder={loc.queue.playlistNamePlaceholder}
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="w-full rounded-xl border border-line bg-white/6 pl-9.5 pr-3.5 py-2.5 text-sm text-fg outline-none"
            />
            <ListMusic
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="glass-card rounded-lg border border-line bg-white/6 px-4 py-2.5 text-sm text-fg-secondary"
          >
            {loc.common.cancel}
          </button>
          <button
            type="submit"
            disabled={!playlistName.trim() || isSubmitting}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lift shadow-pink-500/30',
              !playlistName.trim() || isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer',
              !playlistName.trim() || isSubmitting ? 'opacity-60' : 'opacity-100',
            )}
          >
            <Check size={16} />
            {loc.common.save}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
