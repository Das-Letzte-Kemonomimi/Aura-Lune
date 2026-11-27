import React, { useId, useState } from 'react';
import { Radio, Check, Link, Tag } from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { Button, FieldLabel, ModalBody, ModalFooter, ModalHeader, ModalShell, TextField } from '../ui';

interface AddRadioStationModalProps {
  isOpen: boolean;
  currentLang?: Language;
  onClose: () => void;
  onSave: (station: { name: string; url: string; genre: string }) => void;
}

export const AddRadioStationModal: React.FC<AddRadioStationModalProps> = ({
  isOpen,
  currentLang = 'pl',
  onClose,
  onSave,
}) => {
  const [name, setName] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [genre, setGenre] = useState<string>('Anime / J-Pop');
  const id = useId();

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    onSave({
      name: trimmedName,
      url: trimmedUrl,
      genre: genre.trim() || 'Internet Radio',
    });
    setName('');
    setUrl('');
    setGenre('Anime / J-Pop');
    onClose();
  };

  const isValidUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://');

  return (
    <ModalShell onClose={onClose} layer="nested" size="sm" labelledBy={`${id}-title`}>
      <ModalHeader
        titleId={`${id}-title`}
        title={loc.radio.addCustomStation}
        subtitle="Icecast / Shoutcast / Direct Audio Stream URL"
        icon={<Radio size={20} />}
        tone="cyan"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <ModalBody className="flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor={`${id}-name`}>{loc.radio.stationName}</FieldLabel>
            <TextField
              id={`${id}-name`}
              required
              autoFocus
              placeholder={loc.radio.stationNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <FieldLabel htmlFor={`${id}-url`}>{loc.radio.stationUrl}</FieldLabel>
            <TextField
              id={`${id}-url`}
              type="url"
              required
              mono
              icon={<Link size={16} />}
              placeholder="https://stream.server.org:8000/live.mp3"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url && !isValidUrl && (
              <span className="mt-1 block text-xs text-accent-red">{loc.radio.enterValidUrl}</span>
            )}
          </div>

          <div>
            <FieldLabel htmlFor={`${id}-genre`}>{loc.radio.stationGenre}</FieldLabel>
            <TextField
              id={`${id}-genre`}
              icon={<Tag size={16} />}
              placeholder={loc.radio.stationGenrePlaceholder}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>{loc.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || !isValidUrl}>
            <Check size={16} />
            {loc.radio.addCustomStation}
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
