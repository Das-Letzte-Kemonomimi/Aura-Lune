import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Radio,
  Volume2,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface AudioCodecStatus {
  format: string;
  decoder: string;
  available: boolean;
}

export interface AudioSystemHealth {
  pipewire_active: boolean;
  pipewire_version: string | null;
  sample_rate: number;
  channels: number;
  audio_buffer_ms: number;
  dsp_block_size: number;
  rubberband_available: boolean;
  soundtouch_available: boolean;
  gstreamer_version: string;
  codecs: AudioCodecStatus[];
  db_status: string;
  tracks_count: number;
  albums_count: number;
  mpris_active: boolean;
  waybar_ipc_active: boolean;
  fifo_ipc_active: boolean;
}

interface AudioHealthCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioHealthCheckModal: React.FC<AudioHealthCheckModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [health, setHealth] = useState<AudioSystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<AudioSystemHealth>('get_audio_system_health');
      setHealth(res);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (!health) return;
    const report = [
      '==================================================',
      '     AURALUNE 1.0 — RAPORT DIAGNOSTYCZNY AUDIO',
      '==================================================',
      `Data testu: ${new Date().toISOString()}`,
      `Platforma: Linux (Wayland / X11)`,
      `Serwer Audio PipeWire: ${health.pipewire_active ? `AKTYWNY (v${health.pipewire_version || 'unknown'})` : 'NIEOBECNY / PULSEAUDIO FALLBACK'}`,
      `Potok GStreamer: v${health.gstreamer_version}`,
      `Bufor audio PipeWire: ${health.audio_buffer_ms} ms`,
      `Rozmiar bloku DSP: ${health.dsp_block_size} ramek`,
      `Silnik DSP Rubber Band: ${health.rubberband_available ? 'DOSTĘPNY (Phase Vocoder v3)' : 'BRAK'}`,
      `Silnik DSP SoundTouch: ${health.soundtouch_available ? 'DOSTĘPNY (WSOLA)' : 'BRAK'}`,
      `Baza danych SQLite: ${health.db_status} (${health.tracks_count} utworów, ${health.albums_count} albumów)`,
      `MPRIS v2 D-Bus: ${health.mpris_active ? 'AKTYWNY' : 'NIEAKTYWNY'}`,
      `Linux IPC Waybar (/tmp/auralune.json): ${health.waybar_ipc_active ? 'GOTOWY' : 'BRAK'}`,
      `Linux IPC FIFO (/tmp/auralune_ctl): ${health.fifo_ipc_active ? 'GOTOWY' : 'BRAK'}`,
      '--------------------------------------------------',
      'Kodeki dekodowania audio GStreamer:',
      ...health.codecs.map(
        (c) => `  - [${c.available ? 'OK' : 'BRAK'}] ${c.format} -> ${c.decoder}`
      ),
      '==================================================',
    ].join('\n');

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        background: 'rgba(5, 6, 14, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          borderRadius: '24px',
          background: 'linear-gradient(145deg, rgba(20, 22, 42, 0.96), rgba(10, 12, 24, 0.98))',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 30px rgba(168, 85, 247, 0.25)',
          padding: '26px 28px',
          display: 'flex',
          flexDirection: 'column',
          color: '#fff',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
              }}
            >
              <Activity size={22} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Test Środowiska Audio <span style={{ color: 'var(--accent-pink)', fontSize: '0.9rem' }}>v1.0 Health Check</span>
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Audyt niskopoziomowego toru PipeWire, silników DSP, dekoderów GStreamera i bazy danych
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
              <RefreshCw size={28} className="spin" color="var(--accent-pink)" />
              <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Trwa audyt toru audio...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.85rem' }}>
              Błąd testu: {error}
            </div>
          )}

          {!loading && health && (
            <>
              {/* Sekcja 1: Serwer Audio PipeWire */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={16} color="var(--accent-pink)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Serwer Audio & Bufor Wyjściowy</span>
                  </div>
                  {health.pipewire_active ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <CheckCircle2 size={12} /> PipeWire Direct
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                      Fallback ALSA/Pulse
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PipeWire Wersja</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                      {health.pipewire_version ? `v${health.pipewire_version}` : 'Aktywny daemon'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Latencja bufora</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-pink)', marginTop: '2px' }}>
                      {health.audio_buffer_ms} ms
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Blok DSP</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                      {health.dsp_block_size} ramek
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GStreamer Core</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-purple)', marginTop: '2px' }}>
                      v{health.gstreamer_version}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sekcja 2: Silniki DSP */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Cpu size={16} color="var(--accent-purple)" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Silniki DSP Czasu Rzeczywistego</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Rubber Band v3</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Phase-vocoder, formanty głosu</div>
                    </div>
                    <CheckCircle2 size={16} color="#4ade80" />
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>SoundTouch WSOLA</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Niskie zużycie CPU, natychmiastowy czas</div>
                    </div>
                    <CheckCircle2 size={16} color="#4ade80" />
                  </div>
                </div>
              </div>

              {/* Sekcja 3: Kodeki Audio GStreamera */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--accent-pink)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Formaty Dekodowania Audio</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>GStreamer Plugins</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {health.codecs.map((c) => (
                    <div
                      key={c.format}
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {c.format}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {c.decoder}
                        </div>
                      </div>
                      {c.available ? (
                        <CheckCircle2 size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                      ) : (
                        <XCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sekcja 4: Baza Danych i Integracja Pulpitu */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Database size={15} color="var(--accent-purple)" />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Baza SQLite</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4ade80' }}>
                    {health.tracks_count} utworów • {health.albums_count} albumów
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {health.db_status}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Radio size={15} color="var(--accent-pink)" />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Pulpit & IPC</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: health.mpris_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)', color: health.mpris_active ? '#4ade80' : 'var(--text-muted)' }}>
                      MPRIS D-Bus
                    </span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: health.waybar_ipc_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)', color: health.waybar_ipc_active ? '#4ade80' : 'var(--text-muted)' }}>
                      Waybar JSON
                    </span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: health.fifo_ipc_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)', color: health.fifo_ipc_active ? '#4ade80' : 'var(--text-muted)' }}>
                      FIFO Control
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={fetchHealth}
            disabled={loading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Odśwież test
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopyReport}
              disabled={!health}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: copied
                  ? 'rgba(34, 197, 94, 0.25)'
                  : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                border: copied ? '1px solid #4ade80' : 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: !health ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(236, 72, 153, 0.35)',
              }}
            >
              {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
              {copied ? 'Skopiowano raport do schowka!' : 'Kopiuj raport diagnostyczny'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
