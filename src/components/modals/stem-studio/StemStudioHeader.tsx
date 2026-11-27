import React from 'react';
import type { Translations } from '../../../i18n';
import { RotateCcw, Download, Save, X, Sliders, Music } from '../../ui/icons';
import { Badge, Button, Card, IconButton, SegmentedControl, Select, Spinner } from '../../ui';
import { iconTileTones } from '../../ui/tones';
import type { StemProject, StemChannel, StemProjectMix } from '../../../types/analysis';
import type { Dispatch, SetStateAction } from 'react';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

/** Value of the built-in unity mix in the mix selector. */
const DEFAULT_MIX = 'Default (0 dB)';

export type StemStudioHeaderProps = {} & {
  project: StemProject | null;
  loc: Translations;
  channels: StemChannel[];
  handleSwitchToOriginal: () => Promise<void>;
  t: Translations;
  isOriginalMode: boolean;
  handleSwitchToStems: (startPlaying?: boolean | undefined) => Promise<void>;
  handleReturnToOriginalAndClose: () => Promise<void>;
  activeMixName: string;
  mixes: StemProjectMix[];
  handleLoadMix: (mix: StemProjectMix) => void;
  handleResetAllToUnity: () => void;
  setIsSavingMix: Dispatch<SetStateAction<boolean>>;
  handleExportZip: () => Promise<void>;
  handleClose: () => Promise<void>;
};

export const StemStudioHeader: React.FC<StemStudioHeaderProps> = ({
  activeMixName,
  channels,
  handleClose,
  handleExportZip,
  handleLoadMix,
  handleResetAllToUnity,
  handleReturnToOriginalAndClose,
  handleSwitchToOriginal,
  handleSwitchToStems,
  isOriginalMode,
  loc,
  mixes,
  project,
  setIsSavingMix,
  t,
}) => (
  <Card padding="none" className="mb-3 flex items-center justify-between px-5 py-3">
    <div className="flex items-center gap-3.5">
      <div className={cn('flex size-10.5 items-center justify-center rounded-xl', iconTileTones.pink)}>
        <Sliders size={22} />
      </div>
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 text-xl font-extrabold text-fg">
            {project ? project.title : loc.stems.loadingProject}
          </h2>
          {project?.status === 'separating' && (
            <Badge tone="amber">
              <Spinner size="sm" tone="amber" />
              {fmt(loc.stems.statusSeparating, String(Math.round(project.progress * 100)))}
            </Badge>
          )}
        </div>
        <p className="m-0 text-ui text-fg-secondary">
          {project?.artist} • {project?.album} • {fmt(loc.stems.instrumentTracksCount, String(channels.length))}
        </p>
      </div>
    </div>

    {/* Mix management, live A/B listening and return to the track */}
    <div className="flex items-center gap-2.5">
      {/* Live A/B comparison: the original master or the stem mix */}
      <SegmentedControl
        label={t.stems.listenSourceLabel}
        value={isOriginalMode ? 'original' : 'stems'}
        onChange={(v) => (v === 'original' ? handleSwitchToOriginal() : handleSwitchToStems())}
        items={[
          { value: 'original', icon: <Music size={13} />, label: t.stems.originalMaster },
          { value: 'stems', icon: <Sliders size={13} />, label: t.stems.liveStemMix, ariaLabel: t.stems.switchToStemsTooltip },
        ]}
      />

      {/* Return to the original track and close the studio */}
      <Button variant="tinted" tone="cyan" onClick={handleReturnToOriginalAndClose} title={t.stems.returnToOriginalCloseTooltip}>
        <RotateCcw size={14} />
        {t.stems.returnToTrack}
      </Button>

      <Select
        aria-label={t.stems.mixSelectLabel}
        value={activeMixName}
        onChange={(e) => {
          const selected = mixes.find((m) => m.name === e.target.value);
          if (selected) handleLoadMix(selected);
          else if (e.target.value === DEFAULT_MIX) handleResetAllToUnity();
        }}
        className="w-auto"
      >
        <option value={DEFAULT_MIX}>{t.stems.defaultMix}</option>
        {mixes.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name}
          </option>
        ))}
      </Select>

      <Button onClick={() => setIsSavingMix(true)} title={t.stems.saveMixTooltip}>
        <Save size={14} />
        {t.stems.saveMix}
      </Button>

      <Button onClick={handleExportZip} title={t.stems.exportZipTooltip}>
        <Download size={14} />
        {t.stems.exportZip}
      </Button>

      <IconButton label={t.stems.closeStudio} onClick={handleClose}>
        <X size={20} />
      </IconButton>
    </div>
  </Card>
);
