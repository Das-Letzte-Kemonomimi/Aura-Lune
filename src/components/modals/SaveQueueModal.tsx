import React, { useId, useState } from 'react';
import { BookmarkPlus, Check, ListMusic } from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { Button, FieldLabel, ModalBody, ModalFooter, ModalHeader, ModalShell, TextField } from '../ui';

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
  const id = useId();

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
    <ModalShell onClose={onClose} layer="nested" size="sm" labelledBy={`${id}-title`}>
      <ModalHeader
        titleId={`${id}-title`}
        title={loc.queue.saveAsPlaylistTitle}
        subtitle={`${queueLength} ${loc.library.tracks} ${loc.queue.inCurrentQueue}`}
        icon={<BookmarkPlus size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <ModalBody>
          <FieldLabel htmlFor={`${id}-name`}>{loc.queue.newPlaylistName}</FieldLabel>
          <TextField
            id={`${id}-name`}
            autoFocus
            icon={<ListMusic size={16} />}
            placeholder={loc.queue.playlistNamePlaceholder}
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>{loc.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={!playlistName.trim() || isSubmitting}>
            <Check size={16} />
            {loc.common.save}
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
