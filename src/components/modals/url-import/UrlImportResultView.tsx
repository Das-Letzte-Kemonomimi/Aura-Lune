import React from 'react';
import type { Translations } from '../../../i18n';
import { Play, ListPlus, FolderOpen, CheckCircle2, Music } from 'lucide-react';
import type { UrlAudioImportModalProps, ImportedItem, UrlImportResult } from '../UrlAudioImportModal';
import { fmt } from '../../../utils/fmt';

export type UrlImportResultViewProps = Pick<UrlAudioImportModalProps, 'onClose'> & {
  result: UrlImportResult;
  loc: Translations;
  bitrate: string;
  formatDuration: (ms: number | null) => string;
  handlePlayAll: () => Promise<void>;
  handleQueueAll: () => Promise<void>;
  handlePlaySingle: (item: ImportedItem) => void;
  handleQueueSingle: (item: ImportedItem) => void;
  handleOpenFolder: (pathToShow?: string | undefined) => void;
  handleResetForAnother: () => void;
};

export const UrlImportResultView: React.FC<UrlImportResultViewProps> = ({
  bitrate,
  formatDuration,
  handleOpenFolder,
  handlePlayAll,
  handlePlaySingle,
  handleQueueAll,
  handleQueueSingle,
  handleResetForAnother,
  loc,
  onClose,
  result,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div
        style={{
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#86efac',
        }}
      >
        <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {result.items && result.items.length > 1
              ? fmt(loc.urlImport.successMultiTitle, String(result.items.length))
              : loc.urlImport.successSingleTitle}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#bbf7d0', marginTop: '2px' }}>
            {loc.urlImport.successDesc}
          </div>
        </div>
      </div>

      {/* Wariant A: Pojedynczy utwór */}
      {(!result.items || result.items.length <= 1) && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '10px',
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d8b4fe',
              flexShrink: 0,
            }}
          >
            <Music size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={result.title}
            >
              {result.title}
            </h3>
            <div
              style={{
                fontSize: '0.84rem',
                color: '#cbd5e1',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {result.artist} • {result.album || loc.urlImport.defaultAlbum}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.72rem' }}>
              <span
                style={{
                  background: 'rgba(168, 85, 247, 0.25)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: '#d8b4fe',
                  fontWeight: 600,
                }}
              >
                {result.format} {bitrate !== '0' ? `(${bitrate.toUpperCase()})` : ''}
              </span>
              {result.duration_ms && (
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: '#94a3b8',
                  }}
                >
                  {formatDuration(result.duration_ms)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wariant B: Lista pobranych utworów (Playlista / Kanał) */}
      {result.items && result.items.length > 1 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Przyciski zbiorcze na górze listy */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={handlePlayAll}
              style={{
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
              }}
            >
              <Play size={18} fill="#fff" />
              {loc.urlImport.playAll}
            </button>
            <button
              type="button"
              onClick={handleQueueAll}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '12px',
                color: '#e2e8f0',
                fontWeight: 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <ListPlus size={18} />
              {loc.urlImport.queueAll}
            </button>
          </div>

          {/* Przewijana lista pobranych utworów */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {result.items.map((item, idx) => (
              <div
                key={item.file_path || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: '#94a3b8',
                      width: '24px',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}.
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: '#cbd5e1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.artist} {item.album ? `• ${item.album}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                    }}
                  >
                    {formatDuration(item.duration_ms)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePlaySingle(item)}
                    style={{
                      background: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      color: '#d8b4fe',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={loc.urlImport.playTrack}
                  >
                    <Play size={13} fill="#d8b4fe" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueSingle(item)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={loc.urlImport.queueTrack}
                  >
                    <ListPlus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Przyciski po sukcesie (pojedynczy utwór) */}
      {(!result.items || result.items.length <= 1) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={() => handlePlaySingle(result.items && result.items[0] ? result.items[0] : (result as any))}
            style={{
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
            }}
          >
            <Play size={18} fill="#fff" />
            {loc.urlImport.playNow}
          </button>
          <button
            type="button"
            onClick={() => handleQueueSingle(result.items && result.items[0] ? result.items[0] : (result as any))}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '12px',
              color: '#e2e8f0',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <ListPlus size={18} />
            {loc.urlImport.addToQueue}
          </button>
        </div>
      )}

      {/* Dolny pasek nawigacyjny po pobraniu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <button
          type="button"
          onClick={() => handleOpenFolder()}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            padding: '6px 0',
          }}
        >
          <FolderOpen size={15} />
          {loc.urlImport.showInFolder}
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleResetForAnother}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#c084fc',
              cursor: 'pointer',
              fontSize: '0.84rem',
              fontWeight: 500,
            }}
          >
            {loc.urlImport.downloadAnother}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '6px 14px',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 500,
            }}
          >
            {loc.urlImport.done}
          </button>
        </div>
      </div>
    </div>
);
