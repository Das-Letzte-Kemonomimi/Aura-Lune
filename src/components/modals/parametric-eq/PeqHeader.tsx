import React from 'react';
import type { Translations } from '../../../i18n';
import { X, Sliders, Power, RotateCcw, Upload } from 'lucide-react';
import { type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import type { ParametricEqModalProps } from '../ParametricEqModal';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

export type PeqHeaderProps = Pick<ParametricEqModalProps, 'onClose'> & {
  state: ParametricEqStateDto;
  loc: Translations;
  handleToggleEnabled: () => void;
  handleResetFlat: () => void;
  setIsImportModalOpen: Dispatch<SetStateAction<boolean>>;
};

export const PeqHeader: React.FC<PeqHeaderProps> = ({
  handleResetFlat,
  handleToggleEnabled,
  loc,
  onClose,
  setIsImportModalOpen,
  state,
}) => (
    <div className="flex items-center justify-between gap-4 border-b border-line bg-white/2 px-6 py-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9.5 w-9.5 items-center justify-center rounded-xl transition-all duration-300',
            state.enabled ? 'bg-linear-135 from-accent-cyan to-blue-500' : 'bg-white/8',
            state.enabled ? 'text-fg' : 'text-fg-muted',
          )}
        >
          <Sliders size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-xl font-extrabold">
              Parametric EQ Studio
            </h2>
            <span
              className={cn(
                'rounded-xl border px-2 py-0.5 text-xxs font-bold',
                state.enabled ? 'bg-accent-green/20' : 'bg-white/8',
                state.enabled ? 'text-accent-green' : 'text-fg-muted',
                state.enabled ? 'border-accent-green/40' : 'border-white/10',
              )}
            >
              {state.enabled ? loc.parametricEq.enabled.toUpperCase() : loc.parametricEq.bypass.toUpperCase()}
            </span>
          </div>
          <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-secondary">
            {loc.parametricEq.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* On / Bypass toggle */}
        <button
          onClick={handleToggleEnabled}
          className={cn(
            'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-ui font-bold transition-all duration-200',
            state.enabled ? 'bg-accent-green/25' : 'bg-white/6',
            state.enabled ? 'border-accent-green' : 'border-line',
            state.enabled ? 'text-accent-green' : 'text-fg-muted',
          )}
        >
          <Power size={14} />
          {state.enabled ? loc.parametricEq.enabled : loc.parametricEq.bypass}
        </button>

        {/* Reset Flat */}
        <button
          onClick={handleResetFlat}
          title={loc.parametricEq.resetAllBands}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-white/5 px-3 py-2 text-ui font-semibold text-fg-secondary"
        >
          <RotateCcw size={13} />
          Reset Flat
        </button>

        {/* Import / Export button */}
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-blue-500/35 bg-blue-500/20 px-3 py-2 text-ui font-semibold text-blue-400"
        >
          <Upload size={13} />
          Import / Export
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="flex items-center rounded-lg border-0 bg-transparent p-2 text-fg-muted"
        >
          <X size={20} />
        </button>
      </div>
    </div>
);
