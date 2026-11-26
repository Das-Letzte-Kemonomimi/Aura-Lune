import React, { useState } from 'react';
import { Radio, X, Check, Link, Tag } from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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
    <ModalShell
      onClose={onClose}
      layer="nested"
      className="w-115 max-w-[92vw] rounded-2xl border border-line-accent p-6 shadow-2xl shadow-black/65"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 border-0 bg-transparent p-1 text-fg-muted"
      >
        <X size={18} />
      </button>

      <div className="mb-4.5 flex items-center gap-3">
        <div
          className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-linear-135 from-accent-cyan to-accent-purple shadow-lift shadow-accent-cyan/30"
        >
          <Radio size={22} className="text-fg" />
        </div>
        <div>
          <h3 className="m-0 text-xl font-bold text-fg">
            {loc.radio.addCustomStation}
          </h3>
          <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
            Icecast / Shoutcast / Direct Audio Stream URL
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="mb-1.5 block text-ui font-semibold text-fg-secondary">
            {loc.radio.stationName}:
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder={loc.radio.stationNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-white/6 px-3 py-2.5 text-sm text-fg outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-ui font-semibold text-fg-secondary">
            {loc.radio.stationUrl}:
          </label>
          <div className="relative">
            <input
              type="url"
              required
              placeholder="https://stream.server.org:8000/live.mp3"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-line bg-white/6 pl-9 pr-3 py-2.5 font-mono text-sm text-fg outline-none"
            />
            <Link
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
            />
          </div>
          {url && !isValidUrl && (
            <span className="mt-1 block text-xs text-rose-400">
              {loc.radio.enterValidUrl}
            </span>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-ui font-semibold text-fg-secondary">
            {loc.radio.stationGenre}:
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder={loc.radio.stationGenrePlaceholder}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-line bg-white/6 pl-9 pr-3 py-2.5 text-sm text-fg outline-none"
            />
            <Tag
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
            />
          </div>
        </div>

        <div className="mt-2.5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="glass-card rounded-lg border border-line bg-white/6 px-4 py-2.5 text-sm text-fg-secondary"
          >
            {loc.common.cancel}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !isValidUrl}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border-0 bg-linear-135 from-accent-cyan to-accent-purple px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lift shadow-accent-cyan/30',
              !name.trim() || !isValidUrl ? 'cursor-not-allowed' : 'cursor-pointer',
              !name.trim() || !isValidUrl ? 'opacity-50' : 'opacity-100',
            )}
          >
            <Check size={16} />
            {loc.radio.addCustomStation}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
