import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { errorMessage, invoke } from '../../api/ipc';
import { Search, Image as ImageIcon, Check, Sparkles, Upload, FolderOpen } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, EmptyState, ModalHeader, ModalShell, SectionHeader, Spinner, TextField } from '../ui';

import type { CoverCandidate } from '../../types/library';
import {
  isBestCoverCandidate,
  isLowScoreCoverCandidate,
  sortCoverCandidates,
} from './coverCandidateModel';

export type { CoverCandidate };

interface CoverArtPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId: number;
  initialAlbum: string;
  initialArtist: string;
  trackId?: number | null;
  onCoverApplied: (coverDataUri: string) => void;
  currentLang?: Language;
}

// Module-level RAM cache: instant results (0 ms) for albums opened before
const localCoverCache = new Map<string, CoverCandidate[]>();

export const CoverArtPickerModal: React.FC<CoverArtPickerModalProps> = ({
  isOpen,
  onClose,
  albumId,
  initialAlbum,
  initialArtist,
  trackId,
  onCoverApplied,
  currentLang = 'en',
}) => {
  const titleId = useId();
  const [albumQuery, setAlbumQuery] = useState(initialAlbum);
  const [artistQuery, setArtistQuery] = useState(initialArtist);
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const t = getTranslations(currentLang);

  const performSearch = useCallback(async (album: string, artist: string) => {
    if (!album.trim() && !artist.trim()) return;
    const cacheKey = `${album.trim().toLowerCase()}---${artist.trim().toLowerCase()}`;
    if (localCoverCache.has(cacheKey) && localCoverCache.get(cacheKey)!.length > 0) {
      setCandidates(localCoverCache.get(cacheKey)!);
      setIsSearching(false);
      setErrorMsg(null);
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    try {
      const results = sortCoverCandidates(
        await invoke<CoverCandidate[]>('search_cover_candidates', {
          album: album.trim(),
          artist: artist.trim(),
        }),
      );
      setCandidates(results);
      localCoverCache.set(cacheKey, results);
      if (results.length === 0) {
        setErrorMsg(t.covers.noCoversFound);
      }
    } catch (err: unknown) {
      setErrorMsg(`${t.covers.searchError}: ${errorMessage(err)}`);
    } finally {
      setIsSearching(false);
    }
  }, [t.covers.noCoversFound, t.covers.searchError]);

  useEffect(() => {
    if (isOpen) {
      setAlbumQuery(initialAlbum);
      setArtistQuery(initialArtist);
      const cacheKey = `${initialAlbum.trim().toLowerCase()}---${initialArtist.trim().toLowerCase()}`;
      if (localCoverCache.has(cacheKey) && localCoverCache.get(cacheKey)!.length > 0) {
        setCandidates(localCoverCache.get(cacheKey)!);
        setIsSearching(false);
        setErrorMsg(null);
      } else {
        performSearch(initialAlbum, initialArtist);
      }
    }
  }, [isOpen, initialAlbum, initialArtist, performSearch]);

  const handleApply = async (candidate: CoverCandidate) => {
    setIsApplying(candidate.full_url);
    try {
      const coverDataUri = await invoke<string>('apply_cover_url', {
        albumId,
        coverUrl: candidate.full_url,
        albumTitle: initialAlbum || albumQuery,
        artist: initialArtist || artistQuery,
        trackId: trackId ?? null,
      });
      onCoverApplied(coverDataUri);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(`${t.covers.applyError}: ${errorMessage(err)}`);
    } finally {
      setIsApplying(null);
    }
  };

  const handlePickLocalCover = async () => {
    setIsUploadingCustom(true);
    setErrorMsg(null);
    try {
      const selectedPath = await invoke<string | null>('pick_image_file');
      if (selectedPath) {
        const coverDataUri = await invoke<string>('apply_custom_cover_file', {
          albumId,
          filePath: selectedPath,
          albumTitle: initialAlbum,
          artist: initialArtist,
          trackId: trackId ?? null,
        });
        onCoverApplied(coverDataUri);
        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(`${t.covers.uploadError}: ${errorMessage(err)}`);
    } finally {
      setIsUploadingCustom(false);
    }
  };

  const handleCustomFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    setIsUploadingCustom(true);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const ext = file.name.split('.').pop() || 'jpg';
        const coverDataUri = await invoke<string>('apply_custom_cover_data', {
          albumId,
          dataBase64: dataUrl,
          extension: ext,
          albumTitle: initialAlbum,
          artist: initialArtist,
          trackId: trackId ?? null,
        });
        onCoverApplied(coverDataUri);
        onClose();
      } catch (err: unknown) {
        setErrorMsg(`${t.covers.uploadError}: ${errorMessage(err)}`);
      } finally {
        setIsUploadingCustom(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg(t.covers.uploadError);
      setIsUploadingCustom(false);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} layer="studio" size="xl" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.covers.title}
        subtitle={t.covers.subtitle}
        icon={<Sparkles size={20} />}
        onClose={onClose}
        closeLabel={t.common.close}
      />

      {/* Custom cover from disk, or dropped onto this strip */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-4 border-b border-line px-6 py-4 transition-colors duration-200',
          isDraggingOver ? 'bg-accent-pink/20 outline-2 outline-accent-pink outline-dashed' : 'bg-white/3',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
            processImageFile(file);
          }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleCustomFileInputChange}
        />
        <SectionHeader
          as="h3"
          icon={<Upload size={20} />}
          tone="cyan"
          title={t.covers.uploadCustomCover}
          description={t.covers.dragDropCoverHint}
          className="flex-1"
        />
        <div className="flex shrink-0 gap-2.5">
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploadingCustom}>
            <FolderOpen size={15} />
            {t.settings.chooseFile}
          </Button>
          <Button variant="primary" onClick={handlePickLocalCover} disabled={isUploadingCustom}>
            {isUploadingCustom ? <Spinner size="sm" className="text-current" /> : <Upload size={15} />}
            {isUploadingCustom ? t.covers.downloading : t.covers.uploadFromDisk}
          </Button>
        </div>
      </div>

      {/* Search (Enter in either field searches) */}
      <form
        className="flex shrink-0 gap-3 border-b border-line bg-black/25 px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          performSearch(albumQuery, artistQuery);
        }}
      >
        <TextField
          aria-label={t.covers.searchAlbumPlaceholder}
          value={albumQuery}
          onChange={(e) => setAlbumQuery(e.target.value)}
          placeholder={t.covers.searchAlbumPlaceholder}
          className="flex-1"
        />
        <TextField
          aria-label={t.covers.searchArtistPlaceholder}
          value={artistQuery}
          onChange={(e) => setArtistQuery(e.target.value)}
          placeholder={t.covers.searchArtistPlaceholder}
          className="flex-1"
        />
        <Button type="submit" variant="tinted" tone="cyan" disabled={isSearching}>
          {isSearching ? <Spinner size="sm" tone="cyan" /> : <Search size={16} />}
          {t.covers.searchBtn}
        </Button>
      </form>

      <div className="min-h-80 flex-1 overflow-y-auto p-6">
        {isSearching && (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-fg-secondary">
            <Spinner size="lg" />
            <span>{t.covers.searching}</span>
          </div>
        )}

        {!isSearching && errorMsg && candidates.length === 0 && (
          <EmptyState
            icon={<ImageIcon size={44} />}
            title={errorMsg}
            description={t.covers.hintNoCovers}
            className="h-60"
          />
        )}

        {!isSearching && candidates.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(50),1fr))] gap-4.5">
            {candidates.map((cand, idx) => {
              const isSelected = isApplying === cand.full_url;
              const isBestMatch = isBestCoverCandidate(cand, idx);
              const isLowScore = isLowScoreCoverCandidate(cand);
              return (
                <Card
                  key={cand.full_url || idx}
                  variant="inset"
                  padding="none"
                  highlight={isSelected ? 'pink' : isBestMatch ? 'green' : false}
                  className={cn(
                    'relative flex flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/40 transition-opacity',
                    isLowScore && !isSelected && 'opacity-65 hover:opacity-100',
                  )}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-deep">
                    <img
                      src={cand.thumbnail_url}
                      alt={cand.title}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                    {isBestMatch && (
                      <Badge tone="green" size="xs" className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs">
                        {t.covers.bestMatch}
                      </Badge>
                    )}
                    <Badge tone="cyan" size="xs" className="absolute top-2 right-2 bg-black/75 backdrop-blur-xs">
                      {cand.width ? `${cand.width}×${cand.height}` : 'HD'}
                    </Badge>
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
                    <div>
                      <h4 className="m-0 truncate text-sm font-bold text-fg" title={cand.title}>
                        {cand.title}
                      </h4>
                      <p className="mx-0 mt-1 mb-0 truncate text-xs text-fg-secondary" title={cand.artist}>
                        {cand.artist}
                      </p>
                      <span className="mt-1.5 inline-block text-xxs font-semibold text-accent-pink">{cand.source}</span>
                    </div>

                    <Button variant="primary" size="sm" onClick={() => handleApply(cand)} disabled={isApplying !== null} className="w-full">
                      {isSelected ? <Spinner size="sm" className="text-current" /> : <Check size={14} />}
                      {isSelected ? t.covers.downloading : t.covers.applyCover}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
};
