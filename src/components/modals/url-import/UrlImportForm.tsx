import React from 'react';
import type { Translations } from '../../../i18n';
import type { FormEvent } from 'react';
import { Download, FolderOpen, AlertCircle, Loader2, Clipboard, Sparkles, ListMusic, SlidersHorizontal } from 'lucide-react';
import type { UrlAudioImportModalProps } from '../UrlAudioImportModal';
import type { Dispatch, SetStateAction } from 'react';

export type UrlImportFormProps = Pick<UrlAudioImportModalProps, 'onClose'> & {
  handleImport: (e: FormEvent<Element>) => Promise<void>;
  loc: Translations;
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  handlePasteClipboard: () => Promise<void>;
  handleFormatChange: (newFormat: string) => void;
  format: string;
  setBitrate: Dispatch<SetStateAction<string>>;
  bitrate: string;
  downloadPlaylist: boolean;
  setDownloadPlaylist: Dispatch<SetStateAction<boolean>>;
  maxItems: number;
  setMaxItems: Dispatch<SetStateAction<number>>;
  folderStructure: string;
  setFolderStructure: Dispatch<SetStateAction<string>>;
  targetDir: string;
  setTargetDir: Dispatch<SetStateAction<string>>;
  handlePickDirectory: () => Promise<void>;
  errorMessage: string | null;
};

export const UrlImportForm: React.FC<UrlImportFormProps> = ({
  bitrate,
  downloadPlaylist,
  errorMessage,
  folderStructure,
  format,
  handleFormatChange,
  handleImport,
  handlePasteClipboard,
  handlePickDirectory,
  isLoading,
  loc,
  maxItems,
  onClose,
  setBitrate,
  setDownloadPlaylist,
  setFolderStructure,
  setMaxItems,
  setTargetDir,
  setUrl,
  targetDir,
  url,
}) => (
    <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Input URL */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '6px',
            color: 'var(--color-text-main, #f0f0f5)',
          }}
        >
          {loc.urlImport.urlLabel}
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="np. https://soundcloud.com/... lub YouTube, Bandcamp, Mixcloud"
            disabled={isLoading}
            autoFocus
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.15))',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <button
            type="button"
            onClick={handlePasteClipboard}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '0 12px',
              color: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
            title={loc.urlImport.pasteTooltip}
          >
            <Clipboard size={15} />
            {loc.urlImport.paste}
          </button>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
          {loc.urlImport.urlHint}
        </span>
      </div>

      {/* Wybór formatu audio */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '8px',
          }}
        >
          {loc.urlImport.targetFormat}
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}
        >
          {[
            { id: 'flac', name: 'FLAC', desc: loc.urlImport.formatFlacDesc },
            { id: 'mp3', name: 'MP3', desc: loc.urlImport.formatMp3Desc },
            { id: 'opus', name: 'OPUS', desc: loc.urlImport.formatOpusDesc },
            { id: 'm4a', name: 'M4A', desc: loc.urlImport.formatM4aDesc },
          ].map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => handleFormatChange(fmt.id)}
              disabled={isLoading}
              style={{
                background:
                  format === fmt.id
                    ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3))'
                    : 'rgba(0, 0, 0, 0.25)',
                border:
                  format === fmt.id
                    ? '1px solid #c084fc'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '8px 6px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                {fmt.name}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                {fmt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Wybór bitratu / jakości audio */}
      {format !== 'flac' ? (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <SlidersHorizontal size={15} style={{ color: '#c084fc' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#f0f0f5' }}>
              {loc.urlImport.encodingQuality}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {format === 'mp3' && (
              <>
                {[
                  { id: '320k', label: '320 kbps (CBR)', desc: 'Studio' },
                  { id: '256k', label: '256 kbps (CBR)', desc: 'Wysoka' },
                  { id: '192k', label: '192 kbps (CBR)', desc: 'Standard' },
                  { id: '0', label: 'V0 VBR (~245k)', desc: 'Zmienna' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    style={{
                      background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: bitrate === b.id ? '#fff' : '#cbd5e1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
            {format === 'opus' && (
              <>
                {[
                  { id: '160k', label: '160 kbps (Studio)', desc: 'Transparentny Hi-Fi' },
                  { id: '128k', label: '128 kbps (Standard)', desc: 'Optymalny' },
                  { id: '96k', label: '96 kbps (Kompakt)', desc: 'Lekki' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    style={{
                      background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: bitrate === b.id ? '#fff' : '#cbd5e1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
            {format === 'm4a' && (
              <>
                {[
                  { id: '256k', label: '256 kbps (AAC)', desc: 'iTunes Plus' },
                  { id: '192k', label: '192 kbps (AAC)', desc: 'Standard' },
                  { id: '128k', label: '128 kbps (AAC)', desc: 'Kompakt' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    style={{
                      background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: bitrate === b.id ? '#fff' : '#cbd5e1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: '#bae6fd',
          }}
        >
          <Sparkles size={16} style={{ flexShrink: 0, color: '#38bdf8' }} />
          <span>
            {loc.urlImport.flacLosslessNotice}
          </span>
        </div>
      )}

      {/* Opcja pobierania całej playlisty / albumu / kanału SoundCloud */}
      <div
        style={{
          backgroundColor: downloadPlaylist ? 'rgba(168, 85, 247, 0.14)' : 'rgba(0, 0, 0, 0.22)',
          border: downloadPlaylist ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={downloadPlaylist}
              onChange={(e) => setDownloadPlaylist(e.target.checked)}
              disabled={isLoading}
              style={{
                width: '18px',
                height: '18px',
                accentColor: '#a855f7',
                cursor: 'pointer',
              }}
            />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                {loc.urlImport.downloadPlaylistLabel}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '1px' }}>
                {loc.urlImport.downloadPlaylistDesc}
              </div>
            </div>
          </label>
          {downloadPlaylist && (
            <span
              style={{
                background: 'rgba(168, 85, 247, 0.3)',
                color: '#d8b4fe',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ListMusic size={13} />
              {loc.urlImport.batchMode}
            </span>
          )}
        </div>

        {/* Dodatkowe opcje przy włączonej playliście */}
        {downloadPlaylist && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Limit pobieranych utworów */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: '#cbd5e1',
                  marginBottom: '4px',
                }}
              >
                {loc.urlImport.trackLimit}
              </label>
              <select
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
                disabled={isLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              >
                <option value={0}>{loc.urlImport.limitUnlimited}</option>
                <option value={5}>{loc.urlImport.limit5}</option>
                <option value={10}>{loc.urlImport.limit10}</option>
                <option value={25}>{loc.urlImport.limit25}</option>
                <option value={50}>{loc.urlImport.limit50}</option>
                <option value={100}>{loc.urlImport.limit100}</option>
              </select>
            </div>

            {/* Struktura folderów */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: '#cbd5e1',
                  marginBottom: '4px',
                }}
              >
                {loc.urlImport.folderHierarchy}
              </label>
              <select
                value={folderStructure}
                onChange={(e) => setFolderStructure(e.target.value)}
                disabled={isLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              >
                <option value="playlist">
                  {loc.urlImport.hierarchyAlbum}
                </option>
                <option value="artist_album">
                  {loc.urlImport.hierarchyArtistAlbum}
                </option>
                <option value="flat">
                  {loc.urlImport.hierarchyFlat}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Folder docelowy */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '6px',
          }}
        >
          {loc.urlImport.destFolder}
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={targetDir}
            onChange={(e) => setTargetDir(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="button"
            onClick={handlePickDirectory}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
          >
            <FolderOpen size={15} />
            {loc.urlImport.browse}
          </button>
        </div>
      </div>

      {/* Informacje o silniku yt-dlp */}
      <div
        style={{
          backgroundColor: 'rgba(168, 85, 247, 0.08)',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.78rem',
          color: '#e9d5ff',
        }}
      >
        <Sparkles size={16} style={{ flexShrink: 0, color: '#c084fc' }} />
        <span>
          {loc.urlImport.sqliteIndexingHint}
        </span>
      </div>

      {/* Błąd */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            gap: '10px',
            color: '#fca5a5',
            fontSize: '0.82rem',
            whiteSpace: 'pre-line',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Przycisk akcji */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          {loc.common.cancel}
        </button>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          style={{
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !url.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {downloadPlaylist
                ? loc.urlImport.loadingPlaylist
                : loc.urlImport.loadingTrack}
            </>
          ) : (
            <>
              <Download size={16} />
              {downloadPlaylist
                ? loc.urlImport.btnDownloadPlaylist
                : loc.urlImport.btnDownloadTrack}
            </>
          )}
        </button>
      </div>
    </form>
);
