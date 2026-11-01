import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Sliders,
  Power,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Language } from '../i18n';
import {
  generateFrequencyResponseCurve,
  freqToNormX,
  gainToNormY,
  normXToFreq,
  normYToGain,
  PEQ_BAND_COLORS,
  type ParametricBandDto,
  type ParametricEqPresetDto,
  type ParametricEqStateDto,
  type ParametricFilterType,
} from '../utils/parametricEqMath';

interface ParametricEqModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

const FREQ_GRID_LINES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GAIN_GRID_LINES = [12, 6, 0, -6, -12, -18, -24];

export const ParametricEqModal: React.FC<ParametricEqModalProps> = ({
  isOpen,
  onClose,
}) => {

  const [state, setState] = useState<ParametricEqStateDto>({
    enabled: false,
    preamp_db: 0.0,
    bands: [],
  });

  const [presets, setPresets] = useState<ParametricEqPresetDto[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('');
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  // Modal importu/eksportu
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);

  // Drag & drop węzłów na wykresie
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingBandId, setDraggingBandId] = useState<string | null>(null);

  // Throttling IPC do backendu (płynne 60/120 FPS bez zalewania GStreamera)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef<ParametricEqStateDto>(state);
  latestStateRef.current = state;

  const sendToBackend = (st: ParametricEqStateDto) => {
    invoke('set_parametric_eq_state', { eqState: st }).catch((e) =>
      console.error('Błąd zapisu stanu PEQ:', e)
    );
  };

  const applyStateToBackend = (newState: ParametricEqStateDto, immediate = false) => {
    setState(newState);
    latestStateRef.current = newState;

    if (immediate) {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
      sendToBackend(newState);
      return;
    }

    if (!throttleTimeoutRef.current) {
      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null;
        sendToBackend(latestStateRef.current);
      }, 35);
    }
  };

  // Pobranie aktualnego stanu PEQ i presetów z backendu
  useEffect(() => {
    if (!isOpen) return;

    invoke<ParametricEqStateDto>('get_parametric_eq_state')
      .then((s) => {
        if (s && s.bands && s.bands.length > 0) {
          setState(s);
          setSelectedBandId(s.bands[0].id);
        } else {
          // Jeśli pusty, załaduj domyślne pasma i zsynchronizuj z silnikiem audio
          const defaultState: ParametricEqStateDto = {
            enabled: false,
            preamp_db: 0.0,
            bands: [
              { id: 'b1', filter_type: 'low-shelf', freq: 80.0, gain_db: 0.0, q: 0.707, enabled: true },
              { id: 'b2', filter_type: 'peak', freq: 250.0, gain_db: 0.0, q: 1.414, enabled: true },
              { id: 'b3', filter_type: 'peak', freq: 1000.0, gain_db: 0.0, q: 1.414, enabled: true },
              { id: 'b4', filter_type: 'peak', freq: 4000.0, gain_db: 0.0, q: 1.414, enabled: true },
              { id: 'b5', filter_type: 'high-shelf', freq: 10000.0, gain_db: 0.0, q: 0.707, enabled: true },
            ],
          };
          setState(defaultState);
          setSelectedBandId('b1');
          sendToBackend(defaultState);
        }
      })
      .catch((e) => console.error('Błąd pobierania stanu PEQ:', e));

    invoke<ParametricEqPresetDto[]>('get_parametric_eq_presets')
      .then((p) => setPresets(p || []))
      .catch((e) => console.error('Błąd pobierania presetów PEQ:', e));
  }, [isOpen]);

  // Przełączanie włączenia / bypass
  const handleToggleEnabled = () => {
    const updated = { ...state, enabled: !state.enabled };
    applyStateToBackend(updated, true);
  };

  // Zmiana preamp (z automatyczną aktywacją)
  const handlePreampChange = (val: number) => {
    const updated = { ...state, enabled: true, preamp_db: Math.round(val * 10) / 10 };
    applyStateToBackend(updated);
  };

  // Auto-Safe Preamp
  const maxEffectiveBoost = useMemo(() => {
    const maxBand = state.bands
      .filter((b) => b.enabled)
      .reduce((max, b) => Math.max(max, b.gain_db), 0);
    return state.preamp_db + maxBand;
  }, [state]);

  const safePreampDb = useMemo(() => {
    const maxBand = state.bands
      .filter((b) => b.enabled && b.gain_db > 0)
      .reduce((max, b) => Math.max(max, b.gain_db), 0);
    return maxBand > 0 ? -maxBand : 0;
  }, [state]);

  const handleApplySafePreamp = () => {
    handlePreampChange(safePreampDb);
  };

  // Reset Flat
  const handleResetFlat = () => {
    const updated: ParametricEqStateDto = {
      ...state,
      preamp_db: 0.0,
      bands: state.bands.map((b) => ({ ...b, gain_db: 0.0 })),
    };
    applyStateToBackend(updated, true);
    setSelectedPresetName('');
  };

  // Aplikowanie presetu
  const handleSelectPreset = (presetName: string) => {
    const found = presets.find((p) => p.name === presetName);
    if (found) {
      const updated: ParametricEqStateDto = {
        enabled: true,
        preamp_db: found.state.preamp_db,
        bands: found.state.bands.map((b) => ({ ...b })),
      };
      applyStateToBackend(updated, true);
      setSelectedPresetName(presetName);
      if (updated.bands.length > 0) {
        setSelectedBandId(updated.bands[0].id);
      }
    }
  };

  // Dodawanie pasma
  const handleAddBand = () => {
    if (state.bands.length >= 32) return;
    const newId = `band-${Date.now().toString(36)}`;
    const newBand: ParametricBandDto = {
      id: newId,
      filter_type: 'peak',
      freq: 1000.0,
      gain_db: 3.0,
      q: 1.414,
      enabled: true,
    };
    const updated = {
      ...state,
      enabled: true,
      bands: [...state.bands, newBand],
    };
    applyStateToBackend(updated, true);
    setSelectedBandId(newId);
  };

  // Usuwanie pasma
  const handleDeleteBand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = {
      ...state,
      bands: state.bands.filter((b) => b.id !== id),
    };
    applyStateToBackend(updated, true);
    if (selectedBandId === id) {
      setSelectedBandId(updated.bands[0]?.id || null);
    }
  };

  // Edycja pojedynczego pasma (automatycznie włącza PEQ, aby użytkownik słyszał zmiany)
  const handleUpdateBand = (id: string, patch: Partial<ParametricBandDto>) => {
    const updated = {
      ...state,
      enabled: true,
      bands: state.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    };
    applyStateToBackend(updated);
  };

  // Punkty krzywej częstotliwości
  const curvePoints = useMemo(() => {
    return generateFrequencyResponseCurve(state.bands, state.preamp_db, state.enabled, 160);
  }, [state]);

  // Generowanie ścieżki SVG dla krzywej (-24 dB do +12 dB)
  const svgPathD = useMemo(() => {
    if (curvePoints.length === 0) return '';
    return curvePoints
      .map((pt, idx) => {
        const x = freqToNormX(pt.freq) * 1000;
        const y = gainToNormY(pt.db, -24, 12) * 360;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [curvePoints]);

  const svgAreaD = useMemo(() => {
    if (!svgPathD) return '';
    const zeroY = gainToNormY(0, -24, 12) * 360;
    return `${svgPathD} L 1000,${zeroY} L 0,${zeroY} Z`;
  }, [svgPathD]);

  // Obsługa przeciągania węzłów na wykresie SVG
  const handlePointerDown = (bandId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingBandId(bandId);
    setSelectedBandId(bandId);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingBandId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newFreq = Math.round(normXToFreq(normX));
    const newGain = Math.round(normYToGain(normY, -24, 12) * 10) / 10;

    handleUpdateBand(draggingBandId, { freq: newFreq, gain_db: newGain });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingBandId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingBandId(null);
      // Natychmiastowe wysłanie ostatecznego stanu po zakończeniu przeciągania
      applyStateToBackend(latestStateRef.current, true);
    }
  };

  // Import tekstu EqualizerAPO
  const handleImportSubmit = async () => {
    setImportError(null);
    try {
      const parsed = await invoke<ParametricEqStateDto>('parse_equalizer_apo_config', {
        text: importText,
      });
      if (parsed && parsed.bands.length > 0) {
        applyStateToBackend(parsed);
        setIsImportModalOpen(false);
        setImportText('');
        if (parsed.bands[0]) {
          setSelectedBandId(parsed.bands[0].id);
        }
      } else {
        setImportError('Nie znaleziono pasm w podanym tekście.');
      }
    } catch (e: any) {
      setImportError(String(e));
    }
  };

  // Eksport tekstu
  const exportedApoText = useMemo(() => {
    let out = '# EqualizerAPO Parametric EQ configuration from Auralune\n';
    out += `Preamp: ${state.preamp_db.toFixed(1)} dB\n`;
    state.bands.forEach((b, idx) => {
      const typeCode =
        b.filter_type === 'low-shelf' ? 'LSC' : b.filter_type === 'high-shelf' ? 'HSC' : 'PK';
      const stateStr = b.enabled ? 'ON' : 'OFF';
      out += `Filter ${idx + 1}: ${stateStr} ${typeCode} Fc ${b.freq.toFixed(
        1
      )} Hz Gain ${b.gain_db.toFixed(1)} dB Q ${b.q.toFixed(2)}\n`;
    });
    return out;
  }, [state]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportedApoText);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10400,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          background: 'var(--bg-glass, rgba(20, 24, 38, 0.95))',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK OKNA */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: state.enabled
                  ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
                  : 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: state.enabled ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.3s ease',
              }}
            >
              <Sliders size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  Parametric EQ Studio
                </h2>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: state.enabled
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: state.enabled ? 'var(--accent-green, #10b981)' : 'var(--text-muted)',
                    border: `1px solid ${
                      state.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                    }`,
                  }}
                >
                  {state.enabled ? 'AKTYWNY' : 'BYPASS'}
                </span>
              </div>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Wielopasmowe filtry biquad (Peak, Low Shelf, High Shelf) z obsługą formatu EqualizerAPO
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Przełącznik Włącz / Bypass */}
            <button
              onClick={handleToggleEnabled}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: state.enabled
                  ? 'rgba(16, 185, 129, 0.25)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: state.enabled
                  ? '1px solid var(--accent-green, #10b981)'
                  : '1px solid var(--border-subtle)',
                color: state.enabled ? 'var(--accent-green, #10b981)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <Power size={14} />
              {state.enabled ? 'Włączony' : 'Bypass'}
            </button>

            {/* Reset Flat */}
            <button
              onClick={handleResetFlat}
              title="Resetuj wszystkie pasma do 0.0 dB"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RotateCcw size={13} />
              Reset Flat
            </button>

            {/* Przycisk Import / Export */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.18)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#60a5fa',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Upload size={13} />
              Import / Export
            </button>

            {/* Zamknij */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PASEK KONTROLI PRESETÓW I PREAMP */}
        <div
          style={{
            padding: '12px 24px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Wybór Presetu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Preset:
            </span>
            <select
              value={selectedPresetName}
              onChange={(e) => handleSelectPreset(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary, #fff)',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Własny profil (Custom)</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name} style={{ background: '#181e30' }}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Przedwzmacniacz (Preamp) z ochroną przed clippingiem */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Preamp:
              </span>
              <input
                type="range"
                min="-20"
                max="10"
                step="0.5"
                value={state.preamp_db}
                onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
                style={{ width: '100px', cursor: 'pointer' }}
              />
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  minWidth: '55px',
                  color: state.preamp_db < 0 ? '#60a5fa' : state.preamp_db > 0 ? '#f43f5e' : 'var(--text-muted)',
                }}
              >
                {state.preamp_db > 0 ? `+${state.preamp_db.toFixed(1)}` : state.preamp_db.toFixed(1)} dB
              </span>
            </div>

            {/* Ostrzeżenie przed przesterowaniem */}
            {maxEffectiveBoost > 0.01 ? (
              <button
                onClick={handleApplySafePreamp}
                title={`Maksymalne wzmocnienie wynosi +${maxEffectiveBoost.toFixed(
                  1
                )} dB. Kliknij, aby ustawić bezpieczny Preamp na ${safePreampDb.toFixed(1)} dB`}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.18)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <AlertTriangle size={13} />
                Ryzyko clippingu (+{maxEffectiveBoost.toFixed(1)} dB) &rarr; Safe Preamp
              </button>
            ) : (
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--accent-green, #10b981)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={12} /> Brak przesterowania (Headroom OK)
              </span>
            )}
          </div>
        </div>

        {/* WIDOK WYKRESU CZĘSTOTLIWOŚCI (INTERACTIVE SVG CANVAS) */}
        <div
          style={{
            position: 'relative',
            height: '240px',
            background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.95), rgba(15, 20, 35, 0.98))',
            borderBottom: '1px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          {/* Wskaźnik stanu aktywności (Bypass vs Aktywny) */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: state.enabled ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.18)',
              border: `1px solid ${state.enabled ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.5)'}`,
              borderRadius: '20px',
              padding: '3px 12px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: state.enabled ? '#6ee7b7' : '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 10,
              pointerEvents: 'none',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
            }}
          >
            {state.enabled ? (
              <>
                <Check size={12} color="#34d399" />
                PEQ Aktywny — korekcja audio włączona w czasie rzeczywistym
              </>
            ) : (
              <>
                <AlertTriangle size={12} color="#f87171" />
                PEQ w trybie Bypass (wyłączony) — kliknij Włącz lub przesuń pasmo
              </>
            )}
          </div>

          <svg
            ref={svgRef}
            viewBox="0 0 1000 360"
            preserveAspectRatio="none"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: draggingBandId ? 'grabbing' : 'default',
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <defs>
              <linearGradient id="peqAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#a855f7" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Siatka pionowa (częstotliwości logarytmiczne) */}
            {FREQ_GRID_LINES.map((freq) => {
              const x = freqToNormX(freq) * 1000;
              return (
                <g key={`freq-${freq}`}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={360}
                    stroke="rgba(255, 255, 255, 0.06)"
                    strokeWidth="1"
                    strokeDasharray={freq === 1000 ? 'none' : '2,3'}
                  />
                  <text
                    x={x + 3}
                    y={352}
                    fill="rgba(255, 255, 255, 0.35)"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    {freq >= 1000 ? `${freq / 1000}k` : `${freq}`}
                  </text>
                </g>
              );
            })}

            {/* Siatka pozioma (wzmocnienie w dB: -24 dB do +12 dB) */}
            {GAIN_GRID_LINES.map((db) => {
              const y = gainToNormY(db, -24, 12) * 360;
              const isZero = db === 0;
              return (
                <g key={`gain-${db}`}>
                  <line
                    x1={0}
                    y1={y}
                    x2={1000}
                    y2={y}
                    stroke={isZero ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.06)'}
                    strokeWidth={isZero ? '1.5' : '1'}
                    strokeDasharray={isZero ? 'none' : '3,3'}
                  />
                  <text
                    x={8}
                    y={y - 3}
                    fill={isZero ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {db > 0 ? `+${db} dB` : `${db} dB`}
                  </text>
                </g>
              );
            })}

            {/* Wypełnienie pod krzywą */}
            {svgAreaD && <path d={svgAreaD} fill="url(#peqAreaGrad)" />}

            {/* Główna krzywa odpowiedzi częstotliwościowej */}
            {svgPathD && (
              <path
                d={svgPathD}
                fill="none"
                stroke={state.enabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: state.enabled ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))' : 'none',
                }}
              />
            )}

            {/* Węzły pasm (interaktywne punkty do przeciągania) */}
            {state.bands.map((band, idx) => {
              const cx = freqToNormX(band.freq) * 1000;
              const cy = gainToNormY(band.gain_db, -24, 12) * 360;
              const color = PEQ_BAND_COLORS[idx % PEQ_BAND_COLORS.length];
              const isSelected = band.id === selectedBandId;

              return (
                <g
                  key={band.id}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => handlePointerDown(band.id, e)}
                >
                  {/* Zasięg dobroci Q jako otoczka */}
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={24}
                      fill={color}
                      fillOpacity="0.12"
                      stroke={color}
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                  )}
                  {/* Zewnętrzny pierścień */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 10 : 8}
                    fill="#101420"
                    stroke={band.enabled ? color : 'rgba(255, 255, 255, 0.3)'}
                    strokeWidth={isSelected ? 3 : 2}
                    style={{
                      transition: 'r 0.15s ease',
                      filter: `drop-shadow(0 0 4px ${color})`,
                    }}
                  />
                  {/* Etykieta numeru pasma */}
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="9"
                    fontWeight="800"
                    pointerEvents="none"
                  >
                    {idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* DOLNY PANEL KONTROLI PASM (BAND RACK & TABLE) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                Pasma filtrów ({state.bands.length})
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Kliknij węzeł na wykresie lub wybierz wiersz, aby edytować
              </span>
            </div>

            <button
              onClick={handleAddBand}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Plus size={13} />
              Dodaj pasmo
            </button>
          </div>

          {/* Lista pasm */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {state.bands.map((band, idx) => {
              const color = PEQ_BAND_COLORS[idx % PEQ_BAND_COLORS.length];
              const isSelected = band.id === selectedBandId;

              return (
                <div
                  key={band.id}
                  onClick={() => setSelectedBandId(band.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: isSelected
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected
                      ? `1px solid ${color}`
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Aktywność pasma */}
                  <input
                    type="checkbox"
                    checked={band.enabled}
                    onChange={(e) => handleUpdateBand(band.id, { enabled: e.target.checked })}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer' }}
                  />

                  {/* Numer pasma z kolorem */}
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: color,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Typ filtru */}
                  <select
                    value={band.filter_type}
                    onChange={(e) =>
                      handleUpdateBand(band.id, {
                        filter_type: e.target.value as ParametricFilterType,
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary, #fff)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  >
                    <option value="peak" style={{ background: '#181e30' }}>
                      Peak (Dzwon)
                    </option>
                    <option value="low-shelf" style={{ background: '#181e30' }}>
                      Low Shelf (Półka niska)
                    </option>
                    <option value="high-shelf" style={{ background: '#181e30' }}>
                      High Shelf (Półka wysoka)
                    </option>
                  </select>

                  {/* Częstotliwość Hz */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '150px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Freq:</span>
                    <input
                      type="number"
                      min="20"
                      max="20000"
                      step="1"
                      value={band.freq}
                      onChange={(e) =>
                        handleUpdateBand(band.id, { freq: parseFloat(e.target.value) || 20 })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '70px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hz</span>
                  </div>

                  {/* Wzmocnienie Gain dB */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '210px',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gain:</span>
                    <input
                      type="range"
                      min="-24"
                      max="12"
                      step="0.5"
                      value={band.gain_db}
                      onChange={(e) =>
                        handleUpdateBand(band.id, { gain_db: parseFloat(e.target.value) })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100px', cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        width: '55px',
                        textAlign: 'right',
                        color:
                          band.gain_db > 0
                            ? '#38bdf8'
                            : band.gain_db < 0
                            ? '#f43f5e'
                            : 'var(--text-muted)',
                      }}
                    >
                      {band.gain_db > 0 ? `+${band.gain_db.toFixed(1)}` : band.gain_db.toFixed(1)} dB
                    </span>
                  </div>

                  {/* Dobroć Q */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '140px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Q:</span>
                    <input
                      type="number"
                      min="0.1"
                      max="10.0"
                      step="0.05"
                      value={band.q}
                      onChange={(e) =>
                        handleUpdateBand(band.id, { q: parseFloat(e.target.value) || 0.1 })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '60px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        textAlign: 'right',
                      }}
                    />
                  </div>

                  {/* Usuń */}
                  <button
                    onClick={(e) => handleDeleteBand(band.id, e)}
                    title="Usuń pasmo"
                    style={{
                      marginLeft: 'auto',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL IMPORTU / EKSPORTU (EQUALIZERAPO / AUTOEQ) */}
      {isImportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10600,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: '#161c2d',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#60a5fa" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Import / Eksport EqualizerAPO & AutoEQ
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Wklej konfigurację EqualizerAPO / AutoEQ / Peace lub skopiuj aktualne ustawienia:
            </p>

            <textarea
              value={importText || exportedApoText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Preamp: -6.5 dB&#10;Filter 1: ON PK Fc 31 Hz Gain 4.8 dB Q 1.41&#10;Filter 2: ON LSC Fc 105 Hz Gain 3.5 dB Q 0.71"
              style={{
                width: '100%',
                height: '180px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                outline: 'none',
                resize: 'none',
              }}
            />

            {importError && (
              <div
                style={{
                  color: '#f43f5e',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={13} />
                {importError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button
                onClick={handleCopyExport}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {copiedExport ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedExport ? 'Skopiowano!' : 'Kopiuj konfigurację'}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleImportSubmit}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Zastosuj wklejony profil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
