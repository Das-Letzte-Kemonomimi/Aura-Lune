import React from 'react';
import type { Translations } from '../../../i18n';
import type { PointerEvent } from 'react';
import { AlertTriangle, Check } from '../../ui/icons';
import { freqToNormX, gainToNormY, PEQ_BAND_COLORS, type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import type { RefObject } from 'react';
import { cn } from '../../../utils/cn';

/** Chart grid lines: frequencies (Hz) and gains (dB). */
const FREQ_GRID_LINES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GAIN_GRID_LINES = [12, 6, 0, -6, -12, -18, -24];

export type PeqResponseChartProps = {} & {
  state: ParametricEqStateDto;
  loc: Translations;
  svgRef: RefObject<SVGSVGElement | null>;
  draggingBandId: string | null;
  handlePointerMove: (e: PointerEvent<Element>) => void;
  handlePointerUp: (e: PointerEvent<Element>) => void;
  svgAreaD: string;
  svgPathD: string;
  selectedBandId: string | null;
  handlePointerDown: (bandId: string, e: PointerEvent<Element>) => void;
};

export const PeqResponseChart: React.FC<PeqResponseChartProps> = ({
  draggingBandId,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  loc,
  selectedBandId,
  state,
  svgAreaD,
  svgPathD,
  svgRef,
}) => (
    <div className="relative h-60 overflow-hidden border-b border-line bg-modal">
      {/* Activity state indicator (Bypass vs active) */}
      <div
        className={cn(
          'pointer-events-none absolute top-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-3xl border px-3 py-1 text-xs font-bold shadow-lift shadow-black/35 backdrop-blur-xs',
          state.enabled ? 'bg-accent-green/15' : 'bg-accent-red/20',
          state.enabled ? 'border-accent-green/45' : 'border-accent-red/50',
          state.enabled ? 'text-emerald-300' : 'text-red-300',
        )}
      >
        {state.enabled ? (
          <>
            <Check size={12} className="text-emerald-400" />
            {loc.parametricEq.peqActiveMsg}
          </>
        ) : (
          <>
            <AlertTriangle size={12} className="text-red-400" />
            {loc.parametricEq.peqBypassMsg}
          </>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 1000 360"
        preserveAspectRatio="none"
        className={cn('block h-full w-full', draggingBandId ? 'cursor-grabbing' : 'cursor-default')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <linearGradient id="peqAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#a855f7" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Vertical grid (logarithmic frequencies) */}
        {FREQ_GRID_LINES.map((freq) => {
          const x = freqToNormX(freq) * 1000;
          return (
            <g key={`freq-${freq}`}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={360}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth="1"
                strokeDasharray={freq === 1000 ? 'none' : '2,3'}
              />
              <text
                x={x + 3}
                y={352}
                fill="rgba(255, 255, 255, 0.35)"
                fontSize="11"
                fontFamily="monospace"
              >
                {freq >= 1000 ? `${freq / 1000}k` : `${freq}`}
              </text>
            </g>
          );
        })}

        {/* Horizontal grid (gain in dB: -24 dB to +12 dB) */}
        {GAIN_GRID_LINES.map((db) => {
          const y = gainToNormY(db, -24, 12) * 360;
          const isZero = db === 0;
          return (
            <g key={`gain-${db}`}>
              <line
                x1={0}
                y1={y}
                x2={1000}
                y2={y}
                stroke={isZero ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.06)'}
                strokeWidth={isZero ? '1.5' : '1'}
                strokeDasharray={isZero ? 'none' : '3,3'}
              />
              <text
                x={8}
                y={y - 3}
                fill={isZero ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'}
                fontSize="10"
                fontFamily="monospace"
              >
                {db > 0 ? `+${db} dB` : `${db} dB`}
              </text>
            </g>
          );
        })}

        {/* Fill below the curve */}
        {svgAreaD && <path d={svgAreaD} fill="url(#peqAreaGrad)" />}

        {/* Main frequency response curve */}
        {svgPathD && (
          <path
            d={svgPathD}
            fill="none"
            stroke={state.enabled ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: state.enabled ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))' : 'none',
            }}
          />
        )}

        {/* Band nodes (interactive drag points) */}
        {state.bands.map((band, idx) => {
          const cx = freqToNormX(band.freq) * 1000;
          const cy = gainToNormY(band.gain_db, -24, 12) * 360;
          const color = PEQ_BAND_COLORS[idx % PEQ_BAND_COLORS.length];
          const isSelected = band.id === selectedBandId;

          return (
            <g
              key={band.id}
              className="cursor-pointer"
              onPointerDown={(e) => handlePointerDown(band.id, e)}
            >
              {/* Q factor range as a halo */}
              {isSelected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={24}
                  fill={color}
                  fillOpacity="0.12"
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
              )}
              {/* Outer ring */}
              <circle
                cx={cx}
                cy={cy}
                r={isSelected ? 10 : 8}
                fill="#101420"
                stroke={band.enabled ? color : 'rgba(255, 255, 255, 0.3)'}
                strokeWidth={isSelected ? 3 : 2}
                className="transition-[r] duration-150"
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
              {/* Band number label */}
              <text
                x={cx}
                y={cy + 3.5}
                textAnchor="middle"
                fill="#fff"
                fontSize="9"
                fontWeight="800"
                pointerEvents="none"
              >
                {idx + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
);
