import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  Save,
  Tag as TagIcon,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Language } from '../i18n';

export interface TrackMetadataFullDto {
  title: string;
  artist: string;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  genre: string | null;
  track_no: number | null;
  track_total: number | null;
  disc_no: number | null;
  disc_total: number | null;
  comment: string | null;
}

interface TagEditorModalProps {
  trackId: number;
  filePath: string;
  format?: string;
  bitDepth?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  fileSize?: number | null;
  currentLang?: Language;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  trackId,
  filePath,
  format,
  bitDepth,
  sampleRate,
  channels,
  fileSize,
  currentLang = 'pl',
  onClose,
  onSaveSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState('');
  const [trackNo, setTrackNo] = useState<string>('');
  const [trackTotal, setTrackTotal] = useState<string>('');
  const [discNo, setDiscNo] = useState<string>('');
  const [discTotal, setDiscTotal] = useState<string>('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        const meta = await invoke<TrackMetadataFullDto>('get_track_metadata', { path: filePath });
        if (!isMounted) return;
        setTitle(meta.title || '');
        setArtist(meta.artist || '');
        setAlbum(meta.album || '');
        setAlbumArtist(meta.album_artist || '');
        setYear(meta.year != null ? meta.year.toString() : '');
        setGenre(meta.genre || '');
        setTrackNo(meta.track_no != null ? meta.track_no.toString() : '');
        setTrackTotal(meta.track_total != null ? meta.track_total.toString() : '');
        setDiscNo(meta.disc_no != null ? meta.disc_no.toString() : '');
        setDiscTotal(meta.disc_total != null ? meta.disc_total.toString() : '');
        setComment(meta.comment || '');
      } catch (err: any) {
        if (!isMounted) return;
        setError(typeof err === 'string' ? err : err?.message || 'Błąd odczytu tagów pliku');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, [filePath]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      setError(
        currentLang === 'pl'
          ? 'Tytuł i wykonawca nie mogą być puste.'
          : 'Title and artist cannot be empty.'
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: TrackMetadataFullDto = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() ? album.trim() : null,
        album_artist: albumArtist.trim() ? albumArtist.trim() : null,
        year: year.trim() && !isNaN(parseInt(year, 10)) ? parseInt(year, 10) : null,
        genre: genre.trim() ? genre.trim() : null,
        track_no: trackNo.trim() && !isNaN(parseInt(trackNo, 10)) ? parseInt(trackNo, 10) : null,
        track_total: trackTotal.trim() && !isNaN(parseInt(trackTotal, 10)) ? parseInt(trackTotal, 10) : null,
        disc_no: discNo.trim() && !isNaN(parseInt(discNo, 10)) ? parseInt(discNo, 10) : null,
        disc_total: discTotal.trim() && !isNaN(parseInt(discTotal, 10)) ? parseInt(discTotal, 10) : null,
        comment: comment.trim() ? comment.trim() : null,
      };

      await invoke('update_track_metadata', {
        trackId,
        path: filePath,
        meta: payload,
      });

      setSavedSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message || 'Błąd zapisu tagów pliku');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(28, 22, 45, 0.98), rgba(15, 12, 28, 0.98))',
          border: '1px solid var(--accent-purple, #a855f7)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(168, 85, 247, 0.25)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
                background: 'rgba(168, 85, 247, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-purple, #a855f7)',
              }}
            >
              <TagIcon size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                {currentLang === 'pl' ? 'Właściwości utworu / Edytor tagów' : 'Track Properties / Tag Editor'}
              </h2>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  maxWidth: '480px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={filePath}
              >
                {filePath}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* File Audio Specs Banner */}
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Format: </span>
              <strong>{format?.toUpperCase() || 'AUDIO'}</strong>
            </div>
            {bitDepth && (
              <div>
                <span style={{ color: '#64748b' }}>Bit depth: </span>
                <strong>{bitDepth}-bit</strong>
              </div>
            )}
            {sampleRate && (
              <div>
                <span style={{ color: '#64748b' }}>Sample rate: </span>
                <strong>{(sampleRate / 1000).toFixed(1)} kHz</strong>
              </div>
            )}
            {channels && (
              <div>
                <span style={{ color: '#64748b' }}>Channels: </span>
                <strong>{channels === 2 ? 'Stereo (2ch)' : `${channels} ch`}</strong>
              </div>
            )}
            <div>
              <span style={{ color: '#64748b' }}>File size: </span>
              <strong>{formatFileSize(fileSize)}</strong>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#a855f7' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '12px', fontSize: '0.88rem', color: '#94a3b8' }}>
                {currentLang === 'pl' ? 'Wczytywanie tagów pliku...' : 'Reading file tags...'}
              </p>
            </div>
          ) : (
            <form id="tag-editor-form" onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Tytuł */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Tytuł utworu *' : 'Track Title *'}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Wykonawca */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Wykonawca (Artist) *' : 'Artist *'}
                  </label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Album Artist */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Wykonawca albumu (Album Artist)' : 'Album Artist'}
                  </label>
                  <input
                    type="text"
                    value={albumArtist}
                    onChange={(e) => setAlbumArtist(e.target.value)}
                    placeholder={artist}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Album */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Nazwa albumu' : 'Album Title'}
                  </label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Rok / Rok wydania */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Rok (Year)' : 'Year'}
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2099"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2024"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Gatunek */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Gatunek (Genre)' : 'Genre'}
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Anime, J-Pop, OST..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Numer ścieżki i suma */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Numer ścieżki (Track / Total)' : 'Track Number / Total'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      value={trackNo}
                      onChange={(e) => setTrackNo(e.target.value)}
                      placeholder="1"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                    <span style={{ color: '#64748b' }}>/</span>
                    <input
                      type="number"
                      min="1"
                      value={trackTotal}
                      onChange={(e) => setTrackTotal(e.target.value)}
                      placeholder="12"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Numer płyty i suma */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Numer dysku (Disc / Total)' : 'Disc Number / Total'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      value={discNo}
                      onChange={(e) => setDiscNo(e.target.value)}
                      placeholder="1"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                    <span style={{ color: '#64748b' }}>/</span>
                    <input
                      type="number"
                      min="1"
                      value={discTotal}
                      onChange={(e) => setDiscTotal(e.target.value)}
                      placeholder="1"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Komentarz */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    {currentLang === 'pl' ? 'Komentarz (Comment)' : 'Comment'}
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Opis, źródło lub uwagi..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {currentLang === 'pl' ? 'Anuluj' : 'Cancel'}
          </button>

          <button
            type="submit"
            form="tag-editor-form"
            disabled={loading || saving || savedSuccess}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              background: savedSuccess
                ? 'var(--accent-green, #10b981)'
                : 'linear-gradient(135deg, var(--accent-purple, #a855f7), var(--accent-pink, #ec4899))',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: loading || saving || savedSuccess ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>{currentLang === 'pl' ? 'Zapisywanie...' : 'Saving...'}</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check size={16} />
                <span>{currentLang === 'pl' ? 'Zapisano pomyślnie!' : 'Saved!'}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{currentLang === 'pl' ? 'Zapisz tagi do pliku' : 'Save to File'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
