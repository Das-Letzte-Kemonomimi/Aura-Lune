import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Activity,
  ArrowRight,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Wand2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

interface KeyBpmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrackTitle?: string;
  currentTrackId?: number;
  currentTrackPath?: string;
  pitchSemitones: number;
  tempoRatio: number;
  rateRatio: number;
  onPitchChange: (semitones: number) => void;
  onTempoChange: (tempo: number) => void;
  currentLang: Language;
}

const CHROMATIC_SCALE = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// Mapowanie tonacji na notację Camelot (dla DJ-ów / remikserów)
const CAMELOT_MAJOR: Record<string, string> = {
  'B': '1B', 'F#': '2B', 'C#': '3B', 'G#': '4B',
  'D#': '5B', 'A#': '6B', 'F': '7B', 'C': '8B',
  'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B',
};

const CAMELOT_MINOR: Record<string, string> = {
  'G#': '1A', 'D#': '2A', 'A#': '3A', 'F': '4A',
  'C': '5A', 'G': '6A', 'D': '7A', 'A': '8A',
  'E': '9A', 'B': '10A', 'F#': '11A', 'C#': '12A',
};

export const KeyBpmModal: React.FC<KeyBpmModalProps> = ({
  isOpen,
  onClose,
  currentTrackTitle,
  currentTrackId,
  currentTrackPath,
  pitchSemitones,
  tempoRatio,
  rateRatio,
  onPitchChange,
  onTempoChange,
  currentLang,
}) => {
  const loc = getTranslations(currentLang);

  // Domyślna bazowa tonacja i BPM
  const [baseKeyIndex, setBaseKeyIndex] = useState<number>(0); // 0 = C
  const [isMinor, setIsMinor] = useState<boolean>(false);
  const [baseBpm, setBaseBpm] = useState<number>(128.0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionSource, setDetectionSource] = useState<'tag' | 'acoustic' | 'database' | 'manual' | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Tap Tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapActive, setTapActive] = useState<boolean>(false);

  // Funkcja automatycznej detekcji tonacji i BPM w tle
  const handleAutoDetect = async (path?: string, trackId?: number, forceRecompute: boolean = false) => {
    const targetPath = path || currentTrackPath;
    if (!targetPath) return;

    setIsDetecting(true);
    setDetectError(null);

    try {
      const res = await invoke<{
        bpm: number;
        key_name: string;
        camelot: string;
        base_key_index: number;
        is_minor: boolean;
        source: string;
      }>('detect_track_key_bpm', {
        path: targetPath,
        trackId: trackId ?? currentTrackId ?? null,
        forceRecompute,
      });

      if (res) {
        setBaseKeyIndex(res.base_key_index);
        setIsMinor(res.is_minor);
        setBaseBpm(res.bpm);
        setDetectionSource(res.source as any);

        const cacheKey = currentTrackId
          ? `auralune_track_key_bpm_${currentTrackId}`
          : `auralune_track_key_bpm_${targetPath}`;
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              baseKeyIndex: res.base_key_index,
              isMinor: res.is_minor,
              baseBpm: res.bpm,
              source: res.source,
            })
          );
        } catch {}
      }
    } catch (e: any) {
      console.warn('Błąd detekcji Key/BPM:', e);
      setDetectError(String(e));
    } finally {
      setIsDetecting(false);
    }
  };

  // Wczytaj zapamiętane metadane dla utworu lub automatycznie wykryj jeśli brak
  useEffect(() => {
    if (!isOpen) return;

    let hasStored = false;
    const cacheKey = currentTrackId
      ? `auralune_track_key_bpm_${currentTrackId}`
      : currentTrackPath
      ? `auralune_track_key_bpm_${currentTrackPath}`
      : null;

    if (cacheKey) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.baseKeyIndex === 'number') {
            setBaseKeyIndex(parsed.baseKeyIndex);
            hasStored = true;
          }
          if (typeof parsed.isMinor === 'boolean') setIsMinor(parsed.isMinor);
          if (typeof parsed.baseBpm === 'number') setBaseBpm(parsed.baseBpm);
          if (parsed.source) setDetectionSource(parsed.source);
        }
      } catch {
        // Ignoruj błędy parsowania
      }
    }

    // Jeśli nie znaleziono w pamięci podręcznej, a mamy ścieżkę pliku — automatycznie wykryj!
    if (!hasStored && currentTrackPath) {
      handleAutoDetect(currentTrackPath, currentTrackId);
    }
  }, [isOpen, currentTrackId, currentTrackPath]);

  if (!isOpen) return null;

  const handleSaveForTrack = async () => {
    const cacheKey = currentTrackId
      ? `auralune_track_key_bpm_${currentTrackId}`
      : currentTrackPath
      ? `auralune_track_key_bpm_${currentTrackPath}`
      : null;

    if (cacheKey) {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ baseKeyIndex, isMinor, baseBpm, source: 'manual' })
        );
      } catch {}
    }

    if (currentTrackId) {
      try {
        const keyName = `${CHROMATIC_SCALE[baseKeyIndex]} ${isMinor ? 'm' : 'Maj'}`;
        await invoke('save_track_key_bpm', {
          trackId: currentTrackId,
          bpm: baseBpm,
          keyName,
        });
      } catch (err) {
        console.warn('Błąd zapisu Key/BPM do bazy:', err);
      }
    }
  };

  // Obliczenie tonacji po transpozycji
  const roundedSemitones = Math.round(pitchSemitones);
  const transposedIndex = ((baseKeyIndex + roundedSemitones) % 12 + 12) % 12;
  const originalKeyName = `${CHROMATIC_SCALE[baseKeyIndex]} ${isMinor ? 'm' : 'Maj'}`;
  const transposedKeyName = `${CHROMATIC_SCALE[transposedIndex]} ${isMinor ? 'm' : 'Maj'}`;

  const originalCamelot = isMinor
    ? CAMELOT_MINOR[CHROMATIC_SCALE[baseKeyIndex]] || '-'
    : CAMELOT_MAJOR[CHROMATIC_SCALE[baseKeyIndex]] || '-';

  const transposedCamelot = isMinor
    ? CAMELOT_MINOR[CHROMATIC_SCALE[transposedIndex]] || '-'
    : CAMELOT_MAJOR[CHROMATIC_SCALE[transposedIndex]] || '-';

  // Efektywny BPM po uwzględnieniu tempo stretch i prędkości odtwarzania
  const effectiveBpm = baseBpm * (tempoRatio || 1.0) * (rateRatio || 1.0);
  const bpmDeltaPercent = Math.round(((effectiveBpm / baseBpm) - 1.0) * 100);

  const handleTap = () => {
    const now = performance.now();
    setTapActive(true);
    setTimeout(() => setTapActive(false), 150);

    const taps = tapTimesRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round((60000 / avgInterval) * 10) / 10;
      if (calculatedBpm >= 40 && calculatedBpm <= 280) {
        setBaseBpm(calculatedBpm);
        setDetectionSource('manual');
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(7, 9, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'rgba(18, 20, 32, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 40px rgba(244, 63, 94, 0.15)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek okna */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(6, 182, 212, 0.25))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(244, 63, 94, 0.4)',
              }}
            >
              <Activity size={22} color="var(--accent-pink, #f43f5e)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {currentLang === 'pl' ? 'Klucz i Tempo (BPM)' : 'Musical Key & Tempo (BPM)'}
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {currentTrackTitle || (currentLang === 'pl' ? 'Bieżący utwór' : 'Current Track')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Pasek statusu automatycznej detekcji */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            {isDetecting ? (
              <>
                <Loader2 size={16} className="spin" color="var(--accent-cyan, #06b6d4)" />
                <span style={{ color: 'var(--accent-cyan, #06b6d4)', fontWeight: 600 }}>
                  {currentLang === 'pl'
                    ? 'Analizowanie akustyczne utworu w toku...'
                    : 'Acoustic audio analysis in progress...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={16} color="var(--accent-pink, #f43f5e)" />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {currentLang === 'pl' ? 'Źródło detekcji:' : 'Detection source:'}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background:
                      detectionSource === 'tag'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : detectionSource === 'acoustic'
                        ? 'rgba(6, 182, 212, 0.2)'
                        : detectionSource === 'database'
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                    color:
                      detectionSource === 'tag'
                        ? '#4ade80'
                        : detectionSource === 'acoustic'
                        ? 'var(--accent-cyan)'
                        : detectionSource === 'database'
                        ? 'var(--accent-purple)'
                        : 'var(--accent-amber)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {detectionSource === 'tag'
                    ? (currentLang === 'pl' ? 'Tagi pliku (ID3 / Vorbis)' : 'File Metadata Tags')
                    : detectionSource === 'acoustic'
                    ? (currentLang === 'pl' ? 'Detekcja Akustyczna (AI / DSP)' : 'Acoustic MIR / DSP')
                    : detectionSource === 'database'
                    ? (currentLang === 'pl' ? 'Baza SQLite' : 'SQLite Database')
                    : (currentLang === 'pl' ? 'Ręczne / Tap Tempo' : 'Manual / Tap Tempo')}
                </span>
                {detectError && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-pink)', marginLeft: '6px' }}>
                    ({detectError})
                  </span>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => handleAutoDetect(currentTrackPath, currentTrackId, true)}
            disabled={isDetecting || !currentTrackPath}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: isDetecting ? 'var(--text-muted)' : '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: isDetecting || !currentTrackPath ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <Wand2 size={13} color="var(--accent-cyan)" />
            {currentLang === 'pl' ? 'Wykryj ponownie' : 'Auto Detect'}
          </button>
        </div>

        {/* Porównanie A/B: Oryginał vs Zmodyfikowany DSP */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          {/* Lewa karta: Oryginał */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {currentLang === 'pl' ? 'ORYGINAŁ (BAZA)' : 'ORIGINAL (SOURCE)'}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                }}
              >
                1.0x • 0.0 st
              </span>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {currentLang === 'pl' ? 'Tonacja bazowa' : 'Base Musical Key'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  {originalKeyName}
                </span>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(244, 63, 94, 0.2)',
                    color: 'var(--accent-pink)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title="Camelot Wheel Notation"
                >
                  {originalCamelot}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                BPM (Tempo)
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {baseBpm.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>BPM</span>
              </div>
            </div>
          </div>

          {/* Strzałka przejścia */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
            }}
          >
            <ArrowRight size={24} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              DSP
            </span>
          </div>

          {/* Prawa karta: Po DSP (Pitch / Tempo / Rate) */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(6, 182, 212, 0.08))',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '16px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-pink)', letterSpacing: '0.05em' }}>
                {currentLang === 'pl' ? 'PO PRZETWORZENIU (DSP)' : 'OUTPUT (DSP MODIFIED)'}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(244, 63, 94, 0.2)',
                  color: 'var(--accent-pink)',
                  fontWeight: 600,
                }}
              >
                {pitchSemitones > 0 ? `+${pitchSemitones.toFixed(1)}` : pitchSemitones.toFixed(1)} st
              </span>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {currentLang === 'pl' ? 'Wypadkowa tonacja' : 'Transposed Musical Key'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  {transposedKeyName}
                </span>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(6, 182, 212, 0.2)',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title="Camelot Wheel Notation"
                >
                  {transposedCamelot}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {currentLang === 'pl' ? 'Efektywne Tempo' : 'Effective BPM'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-pink)' }}>
                  {effectiveBpm.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>BPM</span>
                </span>
                {bpmDeltaPercent !== 0 && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: bpmDeltaPercent > 0 ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                    }}
                  >
                    ({bpmDeltaPercent > 0 ? `+${bpmDeltaPercent}` : bpmDeltaPercent}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel sterowania tonacją bazową */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {currentLang === 'pl' ? 'Ręczny wybór tonacji bazowej:' : 'Manual Base Key Override:'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => {
                  setIsMinor(false);
                  setDetectionSource('manual');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: !isMinor ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.06)',
                  color: !isMinor ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Major (Dur)
              </button>
              <button
                onClick={() => {
                  setIsMinor(true);
                  setDetectionSource('manual');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isMinor ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.06)',
                  color: isMinor ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Minor (Moll)
              </button>
            </div>
          </div>

          {/* Siatka 12 półtonów skali chromatycznej */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '4px',
            }}
          >
            {CHROMATIC_SCALE.map((note, idx) => {
              const isSelected = baseKeyIndex === idx;
              return (
                <button
                  key={note}
                  onClick={() => {
                    setBaseKeyIndex(idx);
                    setDetectionSource('manual');
                  }}
                  style={{
                    padding: '8px 2px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--accent-pink)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.4), rgba(168, 85, 247, 0.4))'
                      : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {note}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ręczny BPM + Tap Tempo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {currentLang === 'pl' ? 'Bazowe BPM utworu:' : 'Base Song BPM:'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => {
                  setBaseBpm((prev) => Math.max(40, prev - 1));
                  setDetectionSource('manual');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                step="0.5"
                min="40"
                max="280"
                value={baseBpm}
                onChange={(e) => {
                  setBaseBpm(Number(e.target.value) || 128);
                  setDetectionSource('manual');
                }}
                style={{
                  width: '70px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}
              />
              <button
                onClick={() => {
                  setBaseBpm((prev) => Math.min(280, prev + 1));
                  setDetectionSource('manual');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Tap Tempo Button */}
          <button
            onClick={handleTap}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: tapActive ? 'var(--accent-pink)' : 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: tapActive ? '#fff' : 'var(--accent-pink)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.1s ease',
            }}
          >
            <Activity size={14} />
            {currentLang === 'pl' ? 'TAP TEMPO' : 'TAP TEMPO'}
          </button>
        </div>

        {/* Dolne przyciski szybkiej transpozycji i zapis */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {currentLang === 'pl' ? 'Szybka transpozycja:' : 'Quick Shift:'}
            </span>
            <button
              onClick={() => onPitchChange(pitchSemitones - 1)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              -1 semitone
            </button>
            <button
              onClick={() => onPitchChange(pitchSemitones + 1)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +1 semitone
            </button>
            <button
              onClick={() => {
                onPitchChange(0);
                onTempoChange(1.0);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={13} /> {loc.dsp.reset}
            </button>
          </div>

          <button
            onClick={() => {
              handleSaveForTrack();
              onClose();
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-pink, #f43f5e), var(--accent-purple, #a855f7))',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(244, 63, 94, 0.3)',
            }}
          >
            <Check size={16} />
            {currentLang === 'pl' ? 'Zapisz i Zamknij' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
