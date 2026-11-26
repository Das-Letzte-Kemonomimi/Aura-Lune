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
import { type Language, getTranslations } from '../../i18n';
import {
  AUTO_EQ_PROFILES,
  AUTO_EQ_BRANDS,
  type AutoEqProfile,
} from '../../utils/autoEqDatabase';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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
  const loc = getTranslations(currentLang);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    AUTO_EQ_PROFILES[0].id
  );
  const [applyPreamp, setApplyPreamp] = useState<boolean>(true);
  const [appliedProfileName, setAppliedProfileName] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return AUTO_EQ_PROFILES.filter((profile) => {
      if (selectedBrand !== 'All' && profile.brand !== selectedBrand) {
        return false;
      }
      if (selectedType !== 'All' && profile.type !== selectedType) {
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
    <ModalShell
      onClose={onClose}
      layer="tool"
      className="flex max-h-[90vh] max-w-240 flex-col overflow-hidden rounded-2xl border border-line bg-card text-fg"
    >
      {/* HEADER */}
      <div
        className="flex items-center justify-between border-b border-line bg-linear-to-r from-pink-500/10 to-blue-500/8 px-6 py-4.5"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-linear-135 from-pink-500 to-blue-500 shadow-lift shadow-pink-500/35"
          >
            <Headphones size={22} className="text-fg" />
          </div>
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight">
              {loc.autoEq.title}
            </h2>
            <p className="m-0 text-ui text-fg-muted">
              {loc.autoEq.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg border-0 bg-transparent p-2 text-fg-muted"
        >
          <X size={20} />
        </button>
      </div>

      {/* TOP BAR: SEARCH AND TYPE FILTERS */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-3">
        <div className="flex min-w-55 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5">
          <Search size={16} className="text-fg-muted" />
          <input
            type="text"
            placeholder={loc.autoEq.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-0 bg-transparent text-sm text-inherit outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="border-0 bg-transparent text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Type filters */}
        <div className="flex gap-1.5">
          {['All', 'Over-Ear', 'In-Ear', 'Wireless'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                'rounded-md px-3 py-1.5 text-ui font-semibold',
                selectedType === type ? 'bg-pink-500' : 'bg-white/5',
                selectedType === type ? 'text-fg' : 'text-gray-400',
              )}
              style={{
                border: '1px solid ' + (selectedType === type ? '#f472b6' : 'rgba(255, 255, 255, 0.1)'),
              }}
            >
              {type === 'All' ? loc.autoEq.all : type}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            onResetFlat();
            setAppliedProfileName(loc.autoEq.flatProfile);
          }}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-white/6 px-3 py-1.5 text-ui text-gray-400"
        >
          <RotateCcw size={12} /> Reset Flat
        </button>
      </div>

      {/* SCROLLABLE BRAND LIST */}
      <div className="flex gap-2 overflow-x-auto border-b border-line bg-black/15 px-6 py-2">
        {AUTO_EQ_BRANDS.map((brand) => (
          <button
            key={brand}
            onClick={() => setSelectedBrand(brand)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
              selectedBrand === brand ? 'bg-pink-500/20' : 'bg-transparent',
              selectedBrand === brand ? 'text-pink-500' : 'text-fg-muted',
              selectedBrand === brand ? 'border-pink-500' : 'border-transparent',
            )}
          >
            {brand === 'All' ? loc.autoEq.all : brand}
          </button>
        ))}
      </div>

      {/* MAIN CONTENT: TWO COLUMNS (PROFILE LIST + CHART PREVIEW) */}
      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        {/* LEFT COLUMN: HEADPHONE LIST */}
        <div className="flex flex-col gap-2 overflow-y-auto border-r border-line px-5 py-4">
          {filteredProfiles.length === 0 ? (
            <div className="px-0 py-7.5 text-center text-gray-400">
              {loc.autoEq.noModels}
            </div>
          ) : (
            filteredProfiles.map((profile) => {
              const isSelected = profile.id === selectedProfileId;
              const isApplied = appliedProfileName === profile.name;
              return (
                <div
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-3 transition-all duration-100',
                    isSelected ? 'bg-pink-500/15' : 'bg-white/3',
                    isSelected ? 'border-pink-500' : 'border-white/6',
                  )}
                >
                  <div>
                    <div className="text-sm font-semibold">
                      {profile.name}
                    </div>
                    <div className="mt-0.5 text-xs text-fg-muted">
                      {profile.brand} • {profile.type} • {profile.target}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isApplied && (
                      <span className="flex items-center gap-0.5 text-xxs font-bold text-accent-green">
                        <Check size={12} /> {loc.autoEq.active}
                      </span>
                    )}
                    <ChevronRight size={16} color={isSelected ? '#ec4899' : '#6b7280'} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: VISUALISATION AND APPLYING THE SELECTED PROFILE */}
        <div className="flex flex-col justify-between overflow-y-auto bg-black/20 px-6 py-5">
          <div>
            {/* TITLE AND METRICS */}
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-sm bg-pink-500/20 px-2 py-0.5 text-xxs font-bold text-pink-500">
                  {activeProfile.brand} • {activeProfile.type}
                </span>
                <h3 className="mx-0 mt-1.5 mb-0.5 text-lg font-bold">
                  {activeProfile.name}
                </h3>
                <div className="text-ui text-gray-400">
                  {loc.autoEq.targetCurve} <strong>{activeProfile.target}</strong>
                </div>
              </div>
            </div>

            {activeProfile.description && (
              <div
                className="mx-0 my-3 rounded-lg border-l-3 border-pink-500 bg-white/4 px-3 py-2.5 text-ui leading-snug text-gray-200"
              >
                {activeProfile.description}
              </div>
            )}

            {/* 10-BAND VISUALISATION */}
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs font-semibold text-gray-400">
                <span>{loc.autoEq.bandGain}</span>
                <span>{loc.autoEq.range}</span>
              </div>

              <div
                className="grid h-35 grid-cols-10 items-center gap-1.5 rounded-lg border border-white/6 bg-black/30 p-2"
              >
                {activeProfile.bands.map((gain, idx) => {
                  // Bar scaling: 0 dB is the middle (50%)
                  const heightPercent = Math.min(100, Math.abs(gain) * 10);
                  const isPositive = gain >= 0;
                  return (
                    <div
                      key={idx}
                      className="relative flex h-full flex-col items-center justify-end"
                    >
                      {/* dB value */}
                      <span
                        className={cn(
                          'mb-1 text-2xs font-bold',
                          isPositive ? 'text-pink-400' : 'text-blue-400',
                        )}
                      >
                        {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                      </span>

                      {/* Bar container */}
                      <div className="relative h-17.5 w-3 overflow-hidden rounded-sm bg-white/5">
                        {/* 0 dB line */}
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/25" />
                        {/* Bar fill */}
                        <div
                          className={cn(
                            'absolute left-0 right-0 rounded-xs',
                            isPositive && 'bottom-1/2',
                            !isPositive && 'top-1/2',
                            isPositive ? 'bg-linear-to-t from-pink-500 to-pink-400' : 'bg-linear-to-b from-blue-500 to-blue-400',
                          )}
                          style={{ height: `${heightPercent / 2}%` }}
                        />
                      </div>

                      {/* Frequency label */}
                      <span className="mt-1.5 text-2xs whitespace-nowrap text-gray-400">
                        {EQUALIZER_LABELS[idx].replace(' Hz', '').replace(' kHz', 'k')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PREAMP OPTION */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-white/4 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-accent-green" />
                <div>
                  <div className="text-ui font-semibold">
                    {loc.autoEq.preampCompensation} ({activeProfile.preampDb.toFixed(1)} dB)
                  </div>
                  <div className="text-xxs text-gray-400">
                    {loc.autoEq.preampDesc}
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={applyPreamp}
                onChange={(e) => setApplyPreamp(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-pink-500"
              />
            </div>
          </div>

          {/* APPLY BUTTON */}
          <div className="mt-5">
            <button
              onClick={() => handleApply(activeProfile)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-linear-135 from-pink-500 to-blue-500 p-3 text-sm font-bold text-fg shadow-lift shadow-pink-500/35 transition-opacity duration-150"
            >
              <Sparkles size={16} /> {`${loc.autoEq.applyBtn} ${activeProfile.name}`}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
