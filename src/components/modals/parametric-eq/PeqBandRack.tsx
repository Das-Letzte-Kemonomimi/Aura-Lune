import React from 'react';
import type { Translations } from '../../../i18n';
import { Plus, Trash2 } from '../../ui/icons';
import { normalizeFilterType, PEQ_BAND_COLORS, type ParametricBandDto, type ParametricEqStateDto, type ParametricFilterType } from '../../../utils/parametricEqMath';
import type { Dispatch, SetStateAction } from 'react';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Button, IconButton, RangeSlider, Select, TextField } from '../../ui';

export type PeqBandRackProps = {
  loc: Translations;
  state: ParametricEqStateDto;
  handleAddBand: () => void;
  selectedBandId: string | null;
  setSelectedBandId: Dispatch<SetStateAction<string | null>>;
  handleUpdateBand: (id: string, patch: Partial<ParametricBandDto>) => void;
  handleDeleteBand: (id: string, e?: React.MouseEvent | undefined) => void;
};

export const PeqBandRack: React.FC<PeqBandRackProps> = ({
  handleAddBand,
  handleDeleteBand,
  handleUpdateBand,
  loc,
  selectedBandId,
  setSelectedBandId,
  state,
}) => (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">
            {fmt(loc.parametricEq.filterBands, String(state.bands.length))}
          </span>
          <span className="text-xs text-fg-muted">
            {loc.parametricEq.filterBandsSubtitle}
          </span>
        </div>

        <Button variant="tinted" tone="cyan" size="sm" onClick={handleAddBand}>
          <Plus size={13} />
          {loc.parametricEq.addBand}
        </Button>
      </div>

      {/* Band list */}
      <div className="flex flex-col gap-1.5">
        {state.bands.map((band, idx) => {
          const color = PEQ_BAND_COLORS[idx % PEQ_BAND_COLORS.length];
          const isSelected = band.id === selectedBandId;

          return (
            <div
              key={band.id}
              onClick={() => setSelectedBandId(band.id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-all duration-150',
                isSelected ? 'bg-white/8' : 'bg-white/2',
              )}
              style={{
                border: isSelected
                  ? `1px solid ${color}`
                  : '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {/* Band activity */}
              <input
                type="checkbox"
                checked={band.enabled}
                onChange={(e) => handleUpdateBand(band.id, { enabled: e.target.checked })}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${loc.parametricEq.enabled} #${idx + 1}`}
                className="cursor-pointer"
              />

              {/* Band number with its colour */}
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xxs font-extrabold text-fg"
                style={{ background: color }}
              >
                {idx + 1}
              </div>

              {/* Filter type */}
              <Select
                size="sm"
                aria-label={`#${idx + 1}`}
                value={normalizeFilterType(band.filter_type)}
                onChange={(e) =>
                  handleUpdateBand(band.id, {
                    filter_type: e.target.value as ParametricFilterType,
                  })
                }
                onClick={(e) => e.stopPropagation()}
                className="w-auto"
              >
                <option value="peak">
                  {loc.parametricEq.peakBell}
                </option>
                <option value="low-shelf">
                  {loc.parametricEq.lowShelf}
                </option>
                <option value="high-shelf">
                  {loc.parametricEq.highShelf}
                </option>
              </Select>

              {/* Frequency (Hz) */}
              <div className="flex w-37.5 items-center gap-1.5">
                <span className="text-xxs text-fg-muted">Freq:</span>
                <TextField
                  type="number"
                  size="sm"
                  mono
                  min="20"
                  max="20000"
                  step="1"
                  value={band.freq}
                  onChange={(e) =>
                    handleUpdateBand(band.id, { freq: parseFloat(e.target.value) || 20 })
                  }
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Freq (Hz)"
                  className="w-20 text-right"
                />
                <span className="text-xxs text-fg-muted">Hz</span>
              </div>

              {/* Gain (dB) */}
              <div className="flex w-52.5 items-center gap-1.5">
                <span className="text-xxs text-fg-muted">Gain:</span>
                <RangeSlider
                  aria-label="Gain (dB)"
                  min={-24}
                  max={12}
                  step={0.5}
                  value={band.gain_db}
                  onChange={(v) => handleUpdateBand(band.id, { gain_db: v })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-25"
                />
                <span
                  className={cn(
                    'w-14 text-right font-mono text-xs font-bold',
                    band.gain_db > 0 ? 'text-accent-cyan' : band.gain_db < 0 ? 'text-accent-pink' : 'text-fg-muted',
                  )}
                >
                  {band.gain_db > 0 ? `+${band.gain_db.toFixed(1)}` : band.gain_db.toFixed(1)} dB
                </span>
              </div>

              {/* Q factor */}
              <div className="flex w-35 items-center gap-1.5">
                <span className="text-xxs text-fg-muted">Q:</span>
                <TextField
                  type="number"
                  size="sm"
                  mono
                  min="0.1"
                  max="10.0"
                  step="0.05"
                  value={band.q}
                  onChange={(e) =>
                    handleUpdateBand(band.id, { q: parseFloat(e.target.value) || 0.1 })
                  }
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Q"
                  className="w-20 text-right"
                />
              </div>

              {/* Delete */}
              <IconButton
                size="sm"
                label={loc.parametricEq.deleteBand}
                onClick={(e) => handleDeleteBand(band.id, e)}
                className="ml-auto hover:text-accent-red"
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          );
        })}
      </div>
    </div>
);
