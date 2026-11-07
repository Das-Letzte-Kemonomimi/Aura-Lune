import React, { useState, useMemo } from 'react';
import {
  X,
  Headphones,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import type { Language } from '../i18n';
import {
  AUTO_EQ_PROFILES,
  AUTO_EQ_BRANDS,
  type AutoEqProfile,
} from '../utils/autoEqDatabase';

const EQUALIZER_LABELS = [
  '31 Hz',
  '62 Hz',
  '125 Hz',
  '250 Hz',
  '500 Hz',
  '1 kHz',
  '2 kHz',
  '4 kHz',
  '8 kHz',
  '16 kHz',
];

interface AutoEqModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBands?: number[];
  onApplyProfile: (bands: number[], preampDb: number, profileName: string) => void;
  onResetFlat: () => void;
  currentLang?: Language;
}

export const AutoEqModal: React.FC<AutoEqModalProps> = ({
  isOpen,
  onClose,
  onApplyProfile,
  onResetFlat,
  currentLang = 'pl',
}) => {
  const isPl = currentLang === 'pl';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Wszystkie');
  const [selectedType, setSelectedType] = useState<string>('Wszystkie');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    AUTO_EQ_PROFILES[0].id
  );
  const [applyPreamp, setApplyPreamp] = useState<boolean>(true);
  const [appliedProfileName, setAppliedProfileName] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return AUTO_EQ_PROFILES.filter((profile) => {
      if (selectedBrand !== 'Wszystkie' && profile.brand !== selectedBrand) {
        return false;
      }
      if (selectedType !== 'Wszystkie' && profile.type !== selectedType) {
        return false;
      }
      if (q) {
        const matchName = profile.name.toLowerCase().includes(q);
        const matchBrand = profile.brand.toLowerCase().includes(q);
        const matchDesc = profile.description?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchBrand && !matchDesc) return false;
      }
      return true;
    });
  }, [searchQuery, selectedBrand, selectedType]);

  const activeProfile = useMemo(() => {
    return (
      AUTO_EQ_PROFILES.find((p) => p.id === selectedProfileId) ||
      AUTO_EQ_PROFILES[0]
    );
  }, [selectedProfileId]);

  if (!isOpen) return null;

  const handleApply = (profile: AutoEqProfile) => {
    onApplyProfile(
      [...profile.bands],
      applyPreamp ? profile.preampDb : 0,
      profile.name
    );
    setAppliedProfileName(profile.name);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10500,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          background: 'var(--bg-card, rgba(22, 22, 34, 0.95))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(236, 72, 153, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-main, #f0f0f5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.12), rgba(59, 130, 246, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ec4899, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)',
              }}
            >
              <Headphones size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {isPl ? 'Baza profili słuchawkowych AutoEQ' : 'AutoEQ Headphone Profiles'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)' }}>
                {isPl
                  ? 'Kompensacja akustyczna krzywej Harmana dla ponad 160 modeli słuchawek i IEM-ów'
                  : 'Harman target acoustic compensation for 160+ headphone and IEM models'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* GÓRNY PASEK: WYSZUKIWARKA I FILTRY TYPU */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: '220px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '6px 12px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            }}
          >
            <Search size={16} color="var(--text-muted, #9ca3af)" />
            <input
              type="text"
              placeholder={
                isPl
                  ? 'Wpisz model (np. Chu II, HD 600, DT 770, XM4, Sundara)...'
                  : 'Search model (e.g. Chu II, HD 600, DT 770, XM4, Sundara)...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                fontSize: '0.85rem',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtry typów */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['Wszystkie', 'Over-Ear', 'In-Ear', 'Wireless'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: selectedType === type ? '#ec4899' : 'rgba(255, 255, 255, 0.05)',
                  color: selectedType === type ? '#fff' : '#9ca3af',
                  border: '1px solid ' + (selectedType === type ? '#f472b6' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                }}
              >
                {type === 'Wszystkie' ? (isPl ? 'Wszystkie' : 'All') : type}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onResetFlat();
              setAppliedProfileName(isPl ? 'Płaski (Flat)' : 'Flat');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#9ca3af',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} /> Reset Flat
          </button>
        </div>

        {/* PRZEWIJANA LISTA MAREK */}
        <div
          style={{
            padding: '8px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          {AUTO_EQ_BRANDS.map((brand) => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: selectedBrand === brand ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                color: selectedBrand === brand ? '#ec4899' : 'var(--text-muted, #9ca3af)',
                border: selectedBrand === brand ? '1px solid #ec4899' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {brand === 'Wszystkie' ? (isPl ? 'Wszystkie' : 'All') : brand}
            </button>
          ))}
        </div>

        {/* GŁÓWNA ZAWARTOŚĆ: DWIE KOLUMNY (LISTA PROFILI + PODGLĄD WYKRESU) */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            overflow: 'hidden',
          }}
        >
          {/* LEWA KOLUMNA: LISTA SŁUCHAWEK */}
          <div
            style={{
              overflowY: 'auto',
              padding: '16px 20px',
              borderRight: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {filteredProfiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
                {isPl ? 'Brak modeli odpowiadających kryteriom.' : 'No models match your search criteria.'}
              </div>
            ) : (
              filteredProfiles.map((profile) => {
                const isSelected = profile.id === selectedProfileId;
                const isApplied = appliedProfileName === profile.name;
                return (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isSelected
                        ? 'rgba(236, 72, 153, 0.15)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected
                        ? '1px solid #ec4899'
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {profile.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted, #9ca3af)',
                          marginTop: '2px',
                        }}
                      >
                        {profile.brand} • {profile.type} • {profile.target}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isApplied && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#10b981',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <Check size={12} /> {isPl ? 'Aktywny' : 'Active'}
                        </span>
                      )}
                      <ChevronRight size={16} color={isSelected ? '#ec4899' : '#6b7280'} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PRAWA KOLUMNA: WIZUALIZACJA I ZASTOSOWANIE WYBRANEGO PROFILU */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <div>
              {/* TYTUŁ I METRYKA */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(236, 72, 153, 0.2)',
                      color: '#ec4899',
                    }}
                  >
                    {activeProfile.brand} • {activeProfile.type}
                  </span>
                  <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.15rem', fontWeight: 700 }}>
                    {activeProfile.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                    {isPl ? 'Docelowa krzywa:' : 'Target Curve:'} <strong>{activeProfile.target}</strong>
                  </div>
                </div>
              </div>

              {activeProfile.description && (
                <div
                  style={{
                    margin: '12px 0',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    fontSize: '0.8rem',
                    color: '#e5e7eb',
                    lineHeight: 1.4,
                    borderLeft: '3px solid #ec4899',
                  }}
                >
                  {activeProfile.description}
                </div>
              )}

              {/* WIZUALIZACJA 10 PASM */}
              <div style={{ marginTop: '16px' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#9ca3af',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{isPl ? 'Wzmocnienie pasm (Krzywa korekcji dB)' : 'Band Gain (EQ Curve dB)'}</span>
                  <span>{isPl ? 'Zakres: -6 dB .. +8 dB' : 'Range: -6 dB .. +8 dB'}</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(10, 1fr)',
                    gap: '6px',
                    height: '140px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    alignItems: 'center',
                  }}
                >
                  {activeProfile.bands.map((gain, idx) => {
                    // Skalowanie słupka: 0dB to środek (50%)
                    const heightPercent = Math.min(100, Math.abs(gain) * 10);
                    const isPositive = gain >= 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative',
                        }}
                      >
                        {/* Wartość dB */}
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: isPositive ? '#f472b6' : '#60a5fa',
                            marginBottom: '4px',
                          }}
                        >
                          {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                        </span>

                        {/* Kontener słupka */}
                        <div
                          style={{
                            width: '12px',
                            height: '70px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '3px',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Linia 0 dB */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: 0,
                              right: 0,
                              height: '1px',
                              background: 'rgba(255, 255, 255, 0.25)',
                            }}
                          />
                          {/* Wypełnienie słupka */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: isPositive ? '50%' : undefined,
                              top: !isPositive ? '50%' : undefined,
                              height: `${heightPercent / 2}%`,
                              background: isPositive
                                ? 'linear-gradient(to top, #ec4899, #f472b6)'
                                : 'linear-gradient(to bottom, #3b82f6, #60a5fa)',
                              borderRadius: '2px',
                            }}
                          />
                        </div>

                        {/* Etykieta częstotliwości */}
                        <span
                          style={{
                            fontSize: '0.58rem',
                            color: '#9ca3af',
                            marginTop: '6px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {EQUALIZER_LABELS[idx].replace(' Hz', '').replace(' kHz', 'k')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OPCJA PREAMP */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color="#10b981" />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {isPl ? 'Kompensacja Preamp' : 'Preamp Compensation'} ({activeProfile.preampDb.toFixed(1)} dB)
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                      {isPl
                        ? 'Zapobiega cyfrowemu przesterowaniu (clipping) przy podbiciu basu'
                        : 'Prevents digital clipping when boosting frequencies'}
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={applyPreamp}
                  onChange={(e) => setApplyPreamp(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#ec4899', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* PRZYCISK ZASTOSOWANIA */}
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => handleApply(activeProfile)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ec4899, #3b82f6)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(236, 72, 153, 0.35)',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Sparkles size={16} /> {isPl ? `Zastosuj profil ${activeProfile.name}` : `Apply ${activeProfile.name} Profile`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
