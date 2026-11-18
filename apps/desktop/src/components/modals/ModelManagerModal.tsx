import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  Download,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AiModelInfo, AnalysisCapabilities } from '../../types/analysis';

export interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
}) => {
  const [capabilities, setCapabilities] = useState<AnalysisCapabilities | null>(null);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [downloading, setDownloading] = useState<{ [id: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const caps = await invoke<AnalysisCapabilities>('get_analysis_capabilities');
        const list = await invoke<AiModelInfo[]>('list_ai_models');
        if (isMounted) {
          setCapabilities(caps);
          setModels(list);
        }
      } catch (err) {
        if (isMounted) setError(String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInfo();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      unlisten = await listen<{
        model_id: string;
        downloaded_bytes: number;
        total_bytes: number | null;
        progress: number;
        status: string;
      }>('auralune://model-download-progress', (event) => {
        const { model_id, progress, status } = event.payload;
        setDownloading((prev) => ({
          ...prev,
          [model_id]: progress,
        }));
        if (progress >= 1.0 || status === 'ready') {
          setModels((prev) =>
            prev.map((m) => (m.id === model_id ? { ...m, is_installed: true } : m))
          );
          setDownloading((prev) => {
            const next = { ...prev };
            delete next[model_id];
            return next;
          });
        }
      });
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!isOpen) return null;

  const handleDownload = async (id: string) => {
    setError(null);
    try {
      setDownloading((prev) => ({ ...prev, [id]: 0.01 }));
      await invoke('download_ai_model', { modelId: id });
    } catch (err: any) {
      setError(`Błąd pobierania modelu: ${err}`);
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć wagi tego modelu z dysku?')) return;
    setError(null);
    try {
      await invoke('delete_ai_model', { modelId: id });
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_installed: false } : m))
      );
    } catch (err: any) {
      setError(`Błąd usuwania modelu: ${err}`);
    }
  };

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.82rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Akceleracja sprzętowa Banner */}
      {capabilities && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: capabilities.hardware_acceleration
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(245, 158, 11, 0.2)',
                border: capabilities.hardware_acceleration
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : '1px solid rgba(245, 158, 11, 0.4)',
                color: capabilities.hardware_acceleration ? '#34d399' : '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Urządzenie wykonawcze:</span>
                <span style={{ color: '#ec4899', fontFamily: 'var(--font-mono)' }}>
                  {capabilities.accelerator_device}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                {capabilities.hardware_acceleration
                  ? 'Wykryto akcelerację sprzętową GPU (Vulkan/ROCm/CUDA).'
                  : 'Przetwarzanie na procesorze (AVX2/AVX-512) bez ryzyka xrunów audio.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista modeli */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3
          style={{
            margin: '4px 0 0 0',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Dostępne i zainstalowane modele
        </h3>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <Sparkles size={24} color="#c084fc" style={{ animation: 'spin 1.5s linear infinite' }} />
          </div>
        ) : (
          models.map((model) => {
            const isDown = downloading[model.id] !== undefined;
            const progress = downloading[model.id] || 0;
            return (
              <div
                key={model.id}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '520px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                      {model.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: '#c084fc',
                        fontWeight: 700,
                      }}
                    >
                      {model.task_type}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    {model.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', color: '#64748b' }}>
                    <span>Rozmiar: {(model.file_size / (1024 * 1024)).toFixed(0)} MB</span>
                    <span>Format: ONNX</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {model.is_installed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '10px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#34d399',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        Zainstalowany
                      </span>
                      <button
                        onClick={() => handleDelete(model.id)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Usuń wagi modelu z dysku"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : isDown ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '140px' }}>
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '3px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.round(progress * 100)}%`,
                            background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        Pobieranie {Math.round(progress * 100)}%
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDownload(model.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)',
                      }}
                    >
                      <Download size={14} />
                      <span>Pobierz ({(model.file_size / (1024 * 1024)).toFixed(0)} MB)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '4px' }}>
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(5, 5, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: 'linear-gradient(145deg, rgba(18, 20, 36, 0.98), rgba(10, 12, 24, 0.99))',
          borderRadius: '24px',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.9), 0 0 35px rgba(168, 85, 247, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          overflow: 'hidden',
          color: '#f8fafc',
          animation: 'fadeInScale 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
              }}
            >
              <Cpu size={20} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  background: 'linear-gradient(90deg, #c084fc, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Menedżer Modeli AI & Akceleracji
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Lokalne modele uczenia maszynowego (Music Analysis & Stems)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
};
