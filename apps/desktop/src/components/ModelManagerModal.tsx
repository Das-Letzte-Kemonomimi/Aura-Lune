import React, { useState, useEffect } from 'react';
import {
  Cpu,
  HardDrive,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  Download,
  Loader2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AiModelInfo, AnalysisCapabilities } from '../types/analysis';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
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
    try {
      setDownloading((prev) => ({ ...prev, [id]: 0.01 }));
      await invoke('download_ai_model', { modelId: id });
    } catch (err: any) {
      alert(`Błąd pobierania modelu: ${err}`);
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Czy na pewno usunąć model ${id} z dysku?`)) return;
    try {
      await invoke('delete_ai_model', { modelId: id });
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_installed: false } : m))
      );
    } catch (err) {
      alert(`Błąd usuwania modelu: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl p-6 max-w-2xl w-full flex flex-col shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Menedżer Modeli AI & Akceleracji
              </h2>
              <p className="text-xs text-slate-400">
                Lokalne modele uczenia maszynowego (Music Analysis & Stems)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs">
            {error}
          </div>
        )}

        {/* Akceleracja sprzętowa Banner */}
        {capabilities && (
          <div className="flex items-center justify-between p-3.5 mb-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  capabilities.hardware_acceleration
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                  <span>Urządzenie wykonawcze:</span>
                  <span className="font-mono text-pink-400">
                    {capabilities.accelerator_device}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {capabilities.hardware_acceleration
                    ? 'Wykryto akcelerację sprzętową GPU (Vulkan/ROCm/CUDA).'
                    : 'Przetwarzanie na procesorze (AVX2/AVX-512) bez ryzyka xrunów audio.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista modeli */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Dostępne i zainstalowane modele
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-600 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-100">
                      {model.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-700 text-slate-300">
                      {model.license}
                    </span>
                    {model.is_installed ? (
                      <span className="flex items-center space-x-1 text-[10px] text-green-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Zainstalowany</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium">
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>{(model.file_size / 1024 / 1024).toFixed(0)} MB</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{model.description}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate max-w-md">
                    SHA-256: {model.sha256}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {model.is_installed ? (
                    <button
                      onClick={() => handleDelete(model.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium transition"
                      title="Usuń plik modelu z dysku"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Usuń</span>
                    </button>
                  ) : downloading[model.id] !== undefined ? (
                    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      <span>{Math.round((downloading[model.id] || 0) * 100)}%</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDownload(model.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-md shadow-purple-900/30 transition hover:scale-105 active:scale-95"
                      title="Pobierz wagi modelu AI na dysk"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pobierz ({(model.file_size / 1024 / 1024).toFixed(0)} MB)</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span>Prywatność 100% lokalna: Żadne dane audio nie opuszczają urządzenia.</span>
          </div>
          <span>Katalog: ~/.local/share/auralune/models/</span>
        </div>
      </div>
    </div>
  );
};

