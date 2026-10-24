import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Search, Image as ImageIcon, Check, Loader2, Sparkles, Upload, FolderOpen } from 'lucide-react';
import { type Language, getTranslations } from '../i18n';

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

  useEffect(() => {
    if (isOpen) {
      setAlbumQuery(initialAlbum);
      setArtistQuery(initialArtist);
      performSearch(initialAlbum, initialArtist);
    }
  }, [isOpen, initialAlbum, initialArtist]);

  const performSearch = async (album: string, artist: string) => {
    if (!album.trim() && !artist.trim()) return;
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const results = await invoke<CoverCandidate[]>('search_cover_candidates', {
        album: album.trim(),
        artist: artist.trim(),
      });
      setCandidates(results);
      if (results.length === 0) {
        setErrorMsg(t.covers.noCoversFound);
      }
    } catch (err: any) {
      setErrorMsg(`${t.covers.searchError}: ${err}`);
    } finally {
      setIsSearching(false);
    }
  };

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
    } catch (err: any) {
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
    } catch (err: any) {
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
      } catch (err: any) {
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '760px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(16, 20, 34, 0.95)',
          borderRadius: '20px',
          border: '1px solid var(--border-accent)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 12px rgba(244, 63, 94, 0.4)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                {t.covers.title}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {t.covers.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Wgrywanie własnej okładki z dysku / Drag & Drop */}
        <div
          style={{
            padding: '16px 24px',
            background: isDraggingOver
              ? 'rgba(236, 72, 153, 0.18)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.2))',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            transition: 'all 0.25s ease',
            outline: isDraggingOver ? '2px dashed var(--accent-pink)' : 'none',
          }}
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
            style={{ display: 'none' }}
            onChange={handleCustomFileInputChange}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
                flexShrink: 0,
                boxShadow: '0 0 14px rgba(6, 182, 212, 0.25)',
              }}
            >
              <Upload size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#fff' }}>
                {t.covers.uploadCustomCover}
              </h4>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {t.covers.dragDropCoverHint}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCustom}
              style={{
                padding: '9px 15px',
                borderRadius: '9px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <FolderOpen size={15} />
              {t.settings.chooseFile}
            </button>
            <button
              onClick={handlePickLocalCover}
              disabled={isUploadingCustom}
              style={{
                padding: '9px 18px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: isUploadingCustom ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 0 16px rgba(244, 63, 94, 0.35)',
                transition: 'all 0.2s',
              }}
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
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            gap: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <input
            type="text"
            value={albumQuery}
            onChange={(e) => setAlbumQuery(e.target.value)}
            placeholder={t.covers.searchAlbumPlaceholder}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontSize: '0.9rem',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') performSearch(albumQuery, artistQuery);
            }}
          />
          <input
            type="text"
            value={artistQuery}
            onChange={(e) => setArtistQuery(e.target.value)}
            placeholder={t.covers.searchArtistPlaceholder}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontSize: '0.9rem',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') performSearch(albumQuery, artistQuery);
            }}
          />
          <button
            onClick={() => performSearch(albumQuery, artistQuery)}
            disabled={isSearching}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isSearching ? 'default' : 'pointer',
              opacity: isSearching ? 0.7 : 1,
            }}
          >
            {isSearching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
            {t.covers.searchBtn}
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            minHeight: '320px',
          }}
        >
          {isSearching && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                gap: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <Loader2 size={36} color="var(--accent-pink)" className="spin" />
              <span>{t.covers.searching}</span>
            </div>
          )}

          {!isSearching && errorMsg && candidates.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                gap: '10px',
                color: 'var(--text-muted)',
              }}
            >
              <ImageIcon size={44} opacity={0.4} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>{errorMsg}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {t.covers.hintNoCovers}
              </p>
            </div>
          )}

          {!isSearching && candidates.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '18px',
              }}
            >
              {candidates.map((cand, idx) => {
                const isSelected = isApplying === cand.full_url;
                return (
                  <div
                    key={idx}
                    className="glass-card"
                    style={{
                      borderRadius: '14px',
                      overflow: 'hidden',
                      border: isSelected ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                      background: 'rgba(0, 0, 0, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Artwork Preview */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        paddingBottom: '100%',
                        background: '#090d16',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={cand.thumbnail_url}
                        alt={cand.title}
                        loading="lazy"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {/* Resolution badge */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: 'rgba(0, 0, 0, 0.75)',
                          backdropFilter: 'blur(4px)',
                          color: 'var(--accent-cyan)',
                          border: '1px solid rgba(6, 182, 212, 0.4)',
                        }}
                      >
                        {cand.width ? `${cand.width}×${cand.height}` : 'HD'}
                      </span>
                    </div>

                    {/* Metadata & Select */}
                    <div
                      style={{
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={cand.title}
                        >
                          {cand.title}
                        </h4>
                        <p
                          style={{
                            margin: '3px 0 0 0',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={cand.artist}
                        >
                          {cand.artist}
                        </p>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '6px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: 'var(--accent-pink)',
                          }}
                        >
                          {cand.source}
                        </span>
                      </div>

                      <button
                        onClick={() => handleApply(cand)}
                        disabled={isApplying !== null}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: isSelected
                            ? 'var(--accent-pink)'
                            : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: isApplying !== null ? 'default' : 'pointer',
                          transition: 'all 0.2s ease',
                        }}
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
      </div>
    </div>
  );
};
