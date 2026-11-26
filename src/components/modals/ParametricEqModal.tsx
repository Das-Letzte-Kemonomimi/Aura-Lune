import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PeqHeader } from './parametric-eq/PeqHeader';
import { PeqPresetBar } from './parametric-eq/PeqPresetBar';
import { PeqResponseChart } from './parametric-eq/PeqResponseChart';
import { PeqBandRack } from './parametric-eq/PeqBandRack';
import { PeqImportExportDialog } from './parametric-eq/PeqImportExportDialog';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import {
  generateFrequencyResponseCurve,
  freqToNormX,
  gainToNormY,
  normXToFreq,
  normYToGain,
  normalizeFilterType,
  type ParametricBandDto,
  type ParametricEqPresetDto,
  type ParametricEqStateDto,
} from '../../utils/parametricEqMath';

export interface ParametricEqModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}


export const ParametricEqModal: React.FC<ParametricEqModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    currentLang = 'pl',
  } = props;
  const loc = getTranslations(currentLang);

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
          const normState: ParametricEqStateDto = {
            ...s,
            bands: s.bands.map((b) => ({
              ...b,
              filter_type: normalizeFilterType(b.filter_type),
            })),
          };
          setState(normState);
          latestStateRef.current = normState;
          setSelectedBandId(normState.bands[0].id);
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
          latestStateRef.current = defaultState;
          setSelectedBandId('b1');
          sendToBackend(defaultState);
        }
      })
      .catch((e) => console.error('Błąd pobierania stanu PEQ:', e));

    invoke<ParametricEqPresetDto[]>('get_parametric_eq_presets')
      .then((p) => {
        const normPresets = (p || []).map((preset) => ({
          ...preset,
          state: {
            ...preset.state,
            bands: (preset.state.bands || []).map((b) => ({
              ...b,
              filter_type: normalizeFilterType(b.filter_type),
            })),
          },
        }));
        setPresets(normPresets);
      })
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
        bands: found.state.bands.map((b) => ({
          ...b,
          filter_type: normalizeFilterType(b.filter_type),
        })),
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
      ...latestStateRef.current,
      enabled: true,
      bands: [...latestStateRef.current.bands, newBand],
    };
    applyStateToBackend(updated, true);
    setSelectedBandId(newId);
  };

  // Usuwanie pasma
  const handleDeleteBand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const current = latestStateRef.current;
    const updated = {
      ...current,
      bands: current.bands.filter((b) => b.id !== id),
    };
    applyStateToBackend(updated, true);
    if (selectedBandId === id) {
      setSelectedBandId(updated.bands[0]?.id || null);
    }
  };

  // Edycja pojedynczego pasma (automatycznie włącza PEQ, aby użytkownik słyszał zmiany)
  const handleUpdateBand = (id: string, patch: Partial<ParametricBandDto>) => {
    const current = latestStateRef.current;
    const updated = {
      ...current,
      enabled: true,
      bands: current.bands.map((b) =>
        b.id === id
          ? {
              ...b,
              ...patch,
              filter_type: patch.filter_type
                ? normalizeFilterType(patch.filter_type)
                : normalizeFilterType(b.filter_type),
            }
          : b
      ),
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
    if (svgRef.current) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }
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
      if (svgRef.current) {
        try {
          svgRef.current.releasePointerCapture(e.pointerId);
        } catch {}
      }
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
        const normParsed: ParametricEqStateDto = {
          ...parsed,
          bands: parsed.bands.map((b) => ({
            ...b,
            filter_type: normalizeFilterType(b.filter_type),
          })),
        };
        applyStateToBackend(normParsed, true);
        setIsImportModalOpen(false);
        setImportText('');
        if (normParsed.bands[0]) {
          setSelectedBandId(normParsed.bands[0].id);
        }
      } else {
        setImportError(loc.parametricEq.noBandsError);
      }
    } catch (e: unknown) {
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
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-270 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl shadow-black/65 motion-safe:animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK OKNA */}
        <PeqHeader {...props} state={state} loc={loc} handleToggleEnabled={handleToggleEnabled} handleResetFlat={handleResetFlat} setIsImportModalOpen={setIsImportModalOpen} />

        {/* PASEK KONTROLI PRESETÓW I PREAMP */}
        <PeqPresetBar {...props} selectedPresetName={selectedPresetName} handleSelectPreset={handleSelectPreset} loc={loc} presets={presets} state={state} handlePreampChange={handlePreampChange} maxEffectiveBoost={maxEffectiveBoost} handleApplySafePreamp={handleApplySafePreamp} safePreampDb={safePreampDb} />

        {/* WIDOK WYKRESU CZĘSTOTLIWOŚCI (INTERACTIVE SVG CANVAS) */}
        <PeqResponseChart {...props} state={state} loc={loc} svgRef={svgRef} draggingBandId={draggingBandId} handlePointerMove={handlePointerMove} handlePointerUp={handlePointerUp} svgAreaD={svgAreaD} svgPathD={svgPathD} selectedBandId={selectedBandId} handlePointerDown={handlePointerDown} />

        {/* DOLNY PANEL KONTROLI PASM (BAND RACK & TABLE) */}
        <PeqBandRack {...props} loc={loc} state={state} handleAddBand={handleAddBand} selectedBandId={selectedBandId} setSelectedBandId={setSelectedBandId} handleUpdateBand={handleUpdateBand} handleDeleteBand={handleDeleteBand} />
      </div>

      {/* MODAL IMPORTU / EKSPORTU (EQUALIZERAPO / AUTOEQ) */}
      {isImportModalOpen && (
        <PeqImportExportDialog {...props} setIsImportModalOpen={setIsImportModalOpen} loc={loc} importText={importText} exportedApoText={exportedApoText} setImportText={setImportText} importError={importError} handleCopyExport={handleCopyExport} copiedExport={copiedExport} handleImportSubmit={handleImportSubmit} />
      )}
    </div>
  );
};
