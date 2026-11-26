import React, { useId, useMemo, useState } from 'react';
import { X, Headphones, Search, Check, RotateCcw, Sparkles, ShieldCheck, ChevronRight } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { AUTO_EQ_PROFILES, AUTO_EQ_BRANDS, type AutoEqProfile } from '../../utils/autoEqDatabase';
import { cn } from '../../utils/cn';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ModalHeader,
  ModalShell,
  OptionCard,
  SegmentedControl,
  SettingRow,
  TextField,
} from '../ui';
import { ToggleSwitch } from '../common/ToggleSwitch';

/** Short labels of the ten graphic-EQ bands, low to high. */
const BAND_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

const HEADPHONE_TYPES = ['All', 'Over-Ear', 'In-Ear', 'Wireless'];

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

  const titleId = useId();
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
  const typeItems = HEADPHONE_TYPES.map((type) => ({ value: type, label: type === 'All' ? loc.autoEq.all : type }));

  return (
    <ModalShell onClose={onClose} layer="tool" size="2xl" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.autoEq.title}
        subtitle={loc.autoEq.subtitle}
        icon={<Headphones size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      {/* Search, headphone type and reset */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-6 py-3">
        <div className="relative min-w-55 flex-1">
          <TextField
            size="sm"
            icon={<Search size={16} />}
            aria-label={loc.autoEq.searchPlaceholder}
            placeholder={loc.autoEq.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <IconButton
              size="sm"
              label={loc.common.clear}
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2"
            >
              <X size={14} />
            </IconButton>
          )}
        </div>

        <SegmentedControl
          size="sm"
          label={loc.autoEq.typeFilterLabel}
          items={typeItems}
          value={selectedType}
          onChange={setSelectedType}
        />

        <Button
          size="sm"
          onClick={() => {
            onResetFlat();
            setAppliedProfileName(loc.autoEq.flatProfile);
          }}
        >
          <RotateCcw size={12} /> {loc.autoEq.resetFlat}
        </Button>
      </div>

      {/* Brands (scroll sideways) */}
      <div
        role="group"
        aria-label={loc.autoEq.brandFilterLabel}
        className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line bg-black/15 px-6 py-2"
      >
        {AUTO_EQ_BRANDS.map((brand) => (
          <Chip key={brand} size="xs" pressed={selectedBrand === brand} onClick={() => setSelectedBrand(brand)} className="shrink-0">
            {brand === 'All' ? loc.autoEq.all : brand}
          </Chip>
        ))}
      </div>

      {/* Profile list and preview of the selected profile */}
      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        <div className="flex flex-col gap-2 overflow-y-auto border-r border-line px-5 py-4">
          {filteredProfiles.length === 0 ? (
            <EmptyState icon={<Headphones size={28} />} title={loc.autoEq.noModels} />
          ) : (
            filteredProfiles.map((profile) => {
              const isSelected = profile.id === selectedProfileId;
              const isApplied = appliedProfileName === profile.name;
              return (
                <OptionCard
                  key={profile.id}
                  pressed={isSelected}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className="w-full flex-row items-center justify-between px-3.5 py-3"
                >
                  <span>
                    <span className="block text-sm font-semibold">{profile.name}</span>
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {profile.brand} • {profile.type} • {profile.target}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {isApplied && (
                      <Badge tone="green" size="xs">
                        <Check size={12} /> {loc.autoEq.active}
                      </Badge>
                    )}
                    <ChevronRight size={16} className={isSelected ? 'text-accent-pink' : 'text-fg-muted'} />
                  </span>
                </OptionCard>
              );
            })
          )}
        </div>

        <div className="flex flex-col justify-between overflow-y-auto bg-black/20 px-6 py-5">
          <div>
            <Badge tone="pink" size="xs">
              {activeProfile.brand} • {activeProfile.type}
            </Badge>
            <h3 className="mx-0 mt-1.5 mb-0.5 text-lg font-bold">{activeProfile.name}</h3>
            <div className="text-ui text-fg-secondary">
              {loc.autoEq.targetCurve} <strong className="text-fg">{activeProfile.target}</strong>
            </div>

            {activeProfile.description && (
              <p className="my-3 rounded-lg border-l-3 border-accent-pink bg-white/4 px-3 py-2.5 text-ui leading-snug text-fg">
                {activeProfile.description}
              </p>
            )}

            {/* The ten band gains */}
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs font-semibold text-fg-secondary">
                <span>{loc.autoEq.bandGain}</span>
                <span>{loc.autoEq.range}</span>
              </div>
              <Card variant="inset" padding="none" className="grid h-35 grid-cols-10 items-center gap-1.5 p-2">
                {activeProfile.bands.map((gain, idx) => {
                  // 0 dB sits in the middle; 10 dB fills one half.
                  const heightPercent = Math.min(100, Math.abs(gain) * 10);
                  const isPositive = gain >= 0;
                  return (
                    <div key={idx} className="relative flex h-full flex-col items-center justify-end">
                      <span className={cn('mb-1 text-2xs font-bold', isPositive ? 'text-accent-pink' : 'text-accent-cyan')}>
                        {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                      </span>
                      <div className="relative h-17.5 w-3 overflow-hidden rounded-sm bg-white/5">
                        <div className="absolute top-1/2 right-0 left-0 h-px bg-white/25" />
                        <div
                          className={cn(
                            'absolute right-0 left-0 rounded-xs',
                            isPositive ? 'bottom-1/2 bg-accent-pink' : 'top-1/2 bg-accent-cyan',
                          )}
                          style={{ height: `${heightPercent / 2}%` }}
                        />
                      </div>
                      <span className="mt-1.5 text-2xs whitespace-nowrap text-fg-secondary">{BAND_LABELS[idx]}</span>
                    </div>
                  );
                })}
              </Card>
            </div>

            {/* Preamp compensation */}
            <Card padding="none" className="mt-4 px-3.5">
              <SettingRow
                icon={<ShieldCheck size={16} className="text-accent-green" />}
                title={`${loc.autoEq.preampCompensation} (${activeProfile.preampDb.toFixed(1)} dB)`}
                description={loc.autoEq.preampDesc}
                control={
                  <ToggleSwitch checked={applyPreamp} onChange={setApplyPreamp} label={loc.autoEq.preampCompensation} />
                }
              />
            </Card>
          </div>

          <Button variant="primary" size="lg" onClick={() => handleApply(activeProfile)} className="mt-5 w-full">
            <Sparkles size={16} /> {`${loc.autoEq.applyBtn} ${activeProfile.name}`}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};
