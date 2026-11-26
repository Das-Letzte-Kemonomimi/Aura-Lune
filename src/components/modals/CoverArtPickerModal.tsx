import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '../../api/ipc';
import { X, Search, Image as ImageIcon, Check, Loader2, Sparkles, Upload, FolderOpen } from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

export interface CoverCandidate {
  source: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  full_url: string;
  width?: number;
  height?: number;
}

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

// Modułowy cache w pamięci RAM: natychmiastowe ładowanie wyników (0ms) dla wcześniej otwieranych albumów
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
      const results = await invoke<CoverCandidate[]>('search_cover_candidates', {
        album: album.trim(),
        artist: artist.trim(),
      });
      setCandidates(results);
      localCoverCache.set(cacheKey, results);
      if (results.length === 0) {
        setErrorMsg(t.covers.noCoversFound);
      }
    } catch (err: unknown) {
      setErrorMsg(`${t.covers.searchError}: ${err}`);
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
      setErrorMsg(`${t.covers.applyError}: ${err}`);
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
      setErrorMsg(`${t.covers.uploadError}: ${err}`);
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
        setErrorMsg(`${t.covers.uploadError}: ${err}`);
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
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[90vh] w-190 max-w-[96vw] flex-col overflow-hidden rounded-3xl border border-line-accent shadow-2xl shadow-black/75 motion-safe:animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-white/2 px-6 py-4.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-on-accent shadow-halo shadow-accent-pink/40"
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="m-0 text-lg font-extrabold text-fg">
              {t.covers.title}
            </h3>
            <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
              {t.covers.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-white/6 text-fg-secondary transition-all duration-200"
        >
          <X size={18} />
        </button>
      </div>

      {/* Wgrywanie własnej okładki z dysku / Drag & Drop */}
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b border-line px-6 py-4 transition-all duration-200',
          isDraggingOver ? 'bg-pink-500/20' : 'bg-linear-135 from-white/4 to-black/20',
        )}
        style={{ outline: isDraggingOver ? '2px dashed var(--accent-pink)' : 'none' }}
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
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl border border-accent-cyan/35 bg-accent-cyan/15 text-accent-cyan shadow-halo-md shadow-accent-cyan/25"
          >
            <Upload size={20} />
          </div>
          <div>
            <h4 className="m-0 text-md font-bold text-fg">
              {t.covers.uploadCustomCover}
            </h4>
            <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
              {t.covers.dragDropCoverHint}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingCustom}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-4 py-2.5 text-ui font-semibold text-fg transition-all duration-200"
          >
            <FolderOpen size={15} />
            {t.settings.chooseFile}
          </button>
          <button
            onClick={handlePickLocalCover}
            disabled={isUploadingCustom}
            className={cn(
              'flex items-center gap-2 rounded-lg border-0 bg-accent-gradient px-4.5 py-2.5 text-ui font-bold text-on-accent shadow-halo-lg shadow-accent-pink/35 transition-all duration-200',
              isUploadingCustom ? 'cursor-default' : 'cursor-pointer',
            )}
          >
            {isUploadingCustom ? (
              <>
                <Loader2 size={15} className="spin" /> {t.covers.downloading}
              </>
            ) : (
              <>
                <Upload size={15} /> {t.covers.uploadFromDisk}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 border-b border-line bg-black/25 px-6 py-4">
        <input
          type="text"
          value={albumQuery}
          onChange={(e) => setAlbumQuery(e.target.value)}
          placeholder={t.covers.searchAlbumPlaceholder}
          className="flex-1 rounded-xl border border-line bg-white/5 px-3.5 py-2.5 text-sm text-fg"
          onKeyDown={(e) => {
            if (e.key === 'Enter') performSearch(albumQuery, artistQuery);
          }}
        />
        <input
          type="text"
          value={artistQuery}
          onChange={(e) => setArtistQuery(e.target.value)}
          placeholder={t.covers.searchArtistPlaceholder}
          className="flex-1 rounded-xl border border-line bg-white/5 px-3.5 py-2.5 text-sm text-fg"
          onKeyDown={(e) => {
            if (e.key === 'Enter') performSearch(albumQuery, artistQuery);
          }}
        />
        <button
          onClick={() => performSearch(albumQuery, artistQuery)}
          disabled={isSearching}
          className={cn(
            'flex items-center gap-2 rounded-xl border-0 bg-linear-135 from-accent-cyan to-accent-purple px-5 py-2.5 text-sm font-bold text-on-accent',
            isSearching ? 'cursor-default' : 'cursor-pointer',
            isSearching ? 'opacity-70' : 'opacity-100',
          )}
        >
          {isSearching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          {t.covers.searchBtn}
        </button>
      </div>

      {/* Content Body */}
      <div className="min-h-80 flex-1 overflow-y-auto p-6">
        {isSearching && (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-fg-secondary">
            <Loader2 size={36} className="text-accent-pink spin" />
            <span>{t.covers.searching}</span>
          </div>
        )}

        {!isSearching && errorMsg && candidates.length === 0 && (
          <div className="flex h-60 flex-col items-center justify-center gap-2.5 text-fg-muted">
            <ImageIcon size={44} opacity={0.4} />
            <p className="m-0 text-md">{errorMsg}</p>
            <p className="m-0 text-ui text-fg-secondary">
              {t.covers.hintNoCovers}
            </p>
          </div>
        )}

        {!isSearching && candidates.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4.5">
            {candidates.map((cand, idx) => {
              const isSelected = isApplying === cand.full_url;
              return (
                <div
                  key={idx}
                  className={cn(
                    'glass-card relative flex flex-col overflow-hidden rounded-2xl bg-black/35 shadow-xl shadow-black/40 transition-all duration-200',
                    isSelected ? 'border-2 border-accent-pink' : 'border border-line',
                  )}
                >
                  {/* Artwork Preview */}
                  <div className="relative aspect-square w-full overflow-hidden bg-deep">
                    <img
                      src={cand.thumbnail_url}
                      alt={cand.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {/* Resolution badge */}
                    <span
                      className="absolute top-2 right-2 rounded-md border border-accent-cyan/40 bg-black/75 px-2 py-0.5 text-xxs font-extrabold text-accent-cyan backdrop-blur-xs"
                    >
                      {cand.width ? `${cand.width}×${cand.height}` : 'HD'}
                    </span>
                  </div>

                  {/* Metadata & Select */}
                  <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
                    <div>
                      <h4
                        className="m-0 truncate text-sm font-bold text-fg"
                        title={cand.title}
                      >
                        {cand.title}
                      </h4>
                      <p
                        className="mx-0 mt-1 mb-0 truncate text-xs text-fg-secondary"
                        title={cand.artist}
                      >
                        {cand.artist}
                      </p>
                      <span className="mt-1.5 inline-block text-xxs font-semibold text-accent-pink">
                        {cand.source}
                      </span>
                    </div>

                    <button
                      onClick={() => handleApply(cand)}
                      disabled={isApplying !== null}
                      className={cn(
                        'flex w-full items-center justify-center gap-1.5 rounded-lg border-0 px-3 py-2 text-ui font-bold text-fg transition-all duration-200',
                        isSelected ? 'bg-accent-pink' : 'bg-accent-gradient',
                        isApplying !== null ? 'cursor-default' : 'cursor-pointer',
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Loader2 size={14} className="spin" /> {t.covers.downloading}
                        </>
                      ) : (
                        <>
                          <Check size={14} /> {t.covers.applyCover}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
};
