import React from 'react';
import type { Translations } from '../../../i18n';
import { Plus, Trash2 } from 'lucide-react';
import { normalizeFilterType, PEQ_BAND_COLORS, type ParametricBandDto, type ParametricEqStateDto, type ParametricFilterType } from '../../../utils/parametricEqMath';
import type { Dispatch, SetStateAction } from 'react';
import { fmt } from '../../../utils/fmt';

export type PeqBandRackProps = {} & {
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
            {fmt(loc.parametricEq.filterBands, String(state.bands.length))}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {loc.parametricEq.filterBandsSubtitle}
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
          {loc.parametricEq.addBand}
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
                value={normalizeFilterType(band.filter_type)}
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
                  {loc.parametricEq.peakBell}
                </option>
                <option value="low-shelf" style={{ background: '#181e30' }}>
                  {loc.parametricEq.lowShelf}
                </option>
                <option value="high-shelf" style={{ background: '#181e30' }}>
                  {loc.parametricEq.highShelf}
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
                title={loc.parametricEq.deleteBand}
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
);
