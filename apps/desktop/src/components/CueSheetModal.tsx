import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  FileCode,
  X,
  Play,
  ListPlus,
  AlertCircle,
} from 'lucide-react';
import type { Language } from '../i18n';

export interface CueTrackDto {
  number: number;
  title: string;
  performer: string | null;
  start_offset_ms: number;
  end_offset_ms: number | null;
  duration_ms: number | null;
}

export interface CueSheetDto {
  file_path: string;
  album_title: string | null;
  album_artist: string | null;
  genre: string | null;
  date: string | null;
  tracks: CueTrackDto[];
}

interface CueSheetModalProps {
  currentLang?: Language;
  onClose: () => void;
  onPlayCueTrack: (audioFile: string, track: CueTrackDto) => void;
  onAddCueTracksToQueue: (audioFile: string, tracks: CueTrackDto[]) => void;
}

export const CueSheetModal: React.FC<CueSheetModalProps> = ({
  currentLang = 'pl',
  onClose,
  onPlayCueTrack,
  onAddCueTracksToQueue,
}) => {
  const [cueContent, setCueContent] = useState('');
  const [parsedSheet, setParsedSheet] = useState<CueSheetDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioTargetOverride, setAudioTargetOverride] = useState('');

  const handleParse = async () => {
    if (!cueContent.trim()) {
      setError(currentLang === 'pl' ? 'Wklej treść arkusza CUE lub wybierz plik' : 'Please provide CUE sheet content');
      return;
    }

    try {
      setError(null);
      const sheet = await invoke<CueSheetDto>('parse_cue_sheet_content', {
        cueContent,
      });
      setParsedSheet(sheet);
      if (sheet.file_path) {
        setAudioTargetOverride(sheet.file_path);
      }
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message || 'Błąd parsowania arkusza CUE');
    }
  };

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
          maxHeight: '85vh',
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
              <FileCode size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                {currentLang === 'pl' ? 'Odtwarzacz arkuszy CUE (.cue sheet)' : 'CUE Sheet Player'}
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {currentLang === 'pl'
                  ? 'Wirtualne utwory z pojedynczego pliku albumu (FLAC / WAV + CUE)'
                  : 'Play single-file album rips with cue index points'}
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
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
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

          {!parsedSheet ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                {currentLang === 'pl' ? 'Wklej zawartość pliku .cue:' : 'Paste .cue file content:'}
              </label>
              <textarea
                rows={10}
                value={cueContent}
                onChange={(e) => setCueContent(e.target.value)}
                placeholder={`PERFORMER "Yuki Kajiura"\nTITLE "FictionJunction OST"\nFILE "album.flac" WAVE\n  TRACK 01 AUDIO\n    TITLE "Prologue"\n    INDEX 01 00:00:00\n  TRACK 02 AUDIO\n    TITLE "Swordland"\n    INDEX 01 02:45:00`}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleParse}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: 'var(--accent-purple, #a855f7)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                  }}
                >
                  {currentLang === 'pl' ? 'Przetwórz i załaduj CUE' : 'Parse CUE Sheet'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Header album info */}
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>
                  {parsedSheet.album_title || 'Album CUE'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  {parsedSheet.album_artist} {parsedSheet.date ? `(${parsedSheet.date})` : ''} • {parsedSheet.tracks.length} {currentLang === 'pl' ? 'utworów' : 'tracks'}
                </p>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <span>Plik audio: </span>
                  <input
                    type="text"
                    value={audioTargetOverride}
                    onChange={(e) => setAudioTargetOverride(e.target.value)}
                    placeholder="album.flac"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      width: '260px',
                      marginLeft: '6px',
                    }}
                  />
                </div>
              </div>

              {/* Tracks list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                {parsedSheet.tracks.map((track) => (
                  <div
                    key={track.number}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-purple, #a855f7)', width: '22px' }}>
                        {track.number < 10 ? `0${track.number}` : track.number}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                          {track.title}
                        </div>
                        {track.performer && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {track.performer}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {formatMs(track.start_offset_ms)}
                        {track.duration_ms ? ` (${formatMs(track.duration_ms)})` : ''}
                      </span>
                      <button
                        onClick={() => onPlayCueTrack(audioTargetOverride, track)}
                        title={currentLang === 'pl' ? 'Odtwórz od tego momentu' : 'Play from this index'}
                        style={{
                          background: 'rgba(168, 85, 247, 0.2)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Play size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setParsedSheet(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  {currentLang === 'pl' ? 'Wklej inny CUE' : 'Edit CUE'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onAddCueTracksToQueue(audioTargetOverride, parsedSheet.tracks);
                    onClose();
                  }}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'var(--accent-purple, #a855f7)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ListPlus size={16} />
                  <span>{currentLang === 'pl' ? 'Dodaj wszystkie do kolejki' : 'Add all to Queue'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
