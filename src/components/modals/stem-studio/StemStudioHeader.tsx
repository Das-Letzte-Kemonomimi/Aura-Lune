import React from 'react';
import type { Translations } from '../../../i18n';
import { RotateCcw, Download, Save, Sparkles, X, Sliders, Music } from 'lucide-react';
import type { StemProject, StemChannel, StemProjectMix } from '../../../types/analysis';
import type { Dispatch, SetStateAction } from 'react';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

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
    <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-5 py-3">
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-10.5 w-10.5 items-center justify-center rounded-xl bg-linear-135 from-pink-500 to-violet-500 shadow-lift shadow-pink-500/40"
        >
          <Sliders size={22} className="text-fg" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="m-0 text-xl font-extrabold text-fg">
              {project ? project.title : loc.stems.loadingProject}
            </h2>
            {project?.status === 'separating' && (
              <span
                className="flex items-center gap-1 rounded-xl border border-accent-amber/40 bg-accent-amber/20 px-2 py-0.5 text-xs text-accent-amber"
              >
                <Sparkles size={12} className="animate-spin" />
                {fmt(loc.stems.statusSeparating, String(Math.round(project.progress * 100)))}
              </span>
            )}
          </div>
          <p className="m-0 text-ui text-fg-secondary">
            {project?.artist} • {project?.album} • {fmt(loc.stems.instrumentTracksCount, String(channels.length))}
          </p>
        </div>
      </div>

      {/* Zarządzanie miksami, odsłuch na żywo A/B i powrót do utworu */}
      <div className="flex items-center gap-2.5">
        {/* Przełącznik odsłuchu na żywo (A/B Live Comparison) */}
        <div className="flex items-center rounded-xl border border-white/15 bg-black/45 p-1">
          <button
            onClick={handleSwitchToOriginal}
            title={t.stems.originalMaster}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-1.5 text-ui font-bold transition-all duration-150',
              isOriginalMode ? 'bg-linear-135 from-accent-cyan to-blue-500' : 'bg-transparent',
              isOriginalMode ? 'text-fg' : 'text-fg-secondary',
              isOriginalMode ? 'shadow-md shadow-accent-cyan/40' : 'shadow-none',
            )}
          >
            <Music size={13} />
            {t.stems.originalMaster}
          </button>
          <button
            onClick={() => handleSwitchToStems()}
            title={t.stems.switchToStemsTooltip}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-1.5 text-ui font-bold transition-all duration-150',
              !isOriginalMode ? 'bg-linear-135 from-pink-500 to-violet-500' : 'bg-transparent',
              !isOriginalMode ? 'text-fg' : 'text-fg-secondary',
              !isOriginalMode ? 'shadow-md shadow-pink-500/40' : 'shadow-none',
            )}
          >
            <Sliders size={13} />
            {t.stems.liveStemMix}
          </button>
        </div>

        {/* Przycisk powrotu do oryginalnego utworu i zamknięcia studia */}
        <button
          onClick={handleReturnToOriginalAndClose}
          title={t.stems.returnToOriginalCloseTooltip}
          className="flex items-center gap-1.5 rounded-xl border border-accent-cyan/40 bg-accent-cyan/15 px-3.5 py-2 text-ui font-bold text-accent-cyan transition-all duration-150"
        >
          <RotateCcw size={14} />
          {t.stems.returnToTrack}
        </button>

        {/* Selektor miksu */}
        <select
          value={activeMixName}
          onChange={(e) => {
            const selected = mixes.find((m) => m.name === e.target.value);
            if (selected) handleLoadMix(selected);
            else if (e.target.value === 'Default (0 dB)') handleResetAllToUnity();
          }}
          className="cursor-pointer rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-ui text-fg outline-none"
        >
          <option value="Default (0 dB)">{t.stems.defaultMix}</option>
          {mixes.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setIsSavingMix(true)}
          title={t.stems.saveMixTooltip}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-ui text-slate-300"
        >
          <Save size={14} />
          {t.stems.saveMix}
        </button>

        <button
          onClick={handleExportZip}
          title={t.stems.exportZipTooltip}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-ui text-slate-300"
        >
          <Download size={14} />
          {t.stems.exportZip}
        </button>

        <button
          onClick={handleClose}
          title={t.stems.closeStudio}
          className="flex rounded-full border-0 bg-transparent p-2 text-fg-secondary"
        >
          <X size={20} />
        </button>
      </div>
    </div>
);
