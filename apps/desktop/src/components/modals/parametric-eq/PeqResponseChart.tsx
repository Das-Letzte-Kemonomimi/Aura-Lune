import React from 'react';
import type { Translations } from '../../../i18n';
import type { PointerEvent } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { freqToNormX, gainToNormY, PEQ_BAND_COLORS, type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import type { RefObject } from 'react';

/** Linie siatki wykresu: częstotliwości (Hz) i wzmocnienia (dB). */
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
    <div
      style={{
        position: 'relative',
        height: '240px',
        background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.95), rgba(15, 20, 35, 0.98))',
        borderBottom: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Wskaźnik stanu aktywności (Bypass vs Aktywny) */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: state.enabled ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.18)',
          border: `1px solid ${state.enabled ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.5)'}`,
          borderRadius: '20px',
          padding: '3px 12px',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: state.enabled ? '#6ee7b7' : '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10,
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        }}
      >
        {state.enabled ? (
          <>
            <Check size={12} color="#34d399" />
            {loc.parametricEq.peqActiveMsg}
          </>
        ) : (
          <>
            <AlertTriangle size={12} color="#f87171" />
            {loc.parametricEq.peqBypassMsg}
          </>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 1000 360"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: draggingBandId ? 'grabbing' : 'default',
        }}
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

        {/* Siatka pionowa (częstotliwości logarytmiczne) */}
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

        {/* Siatka pozioma (wzmocnienie w dB: -24 dB do +12 dB) */}
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

        {/* Wypełnienie pod krzywą */}
        {svgAreaD && <path d={svgAreaD} fill="url(#peqAreaGrad)" />}

        {/* Główna krzywa odpowiedzi częstotliwościowej */}
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

        {/* Węzły pasm (interaktywne punkty do przeciągania) */}
        {state.bands.map((band, idx) => {
          const cx = freqToNormX(band.freq) * 1000;
          const cy = gainToNormY(band.gain_db, -24, 12) * 360;
          const color = PEQ_BAND_COLORS[idx % PEQ_BAND_COLORS.length];
          const isSelected = band.id === selectedBandId;

          return (
            <g
              key={band.id}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => handlePointerDown(band.id, e)}
            >
              {/* Zasięg dobroci Q jako otoczka */}
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
              {/* Zewnętrzny pierścień */}
              <circle
                cx={cx}
                cy={cy}
                r={isSelected ? 10 : 8}
                fill="#101420"
                stroke={band.enabled ? color : 'rgba(255, 255, 255, 0.3)'}
                strokeWidth={isSelected ? 3 : 2}
                style={{
                  transition: 'r 0.15s ease',
                  filter: `drop-shadow(0 0 4px ${color})`,
                }}
              />
              {/* Etykieta numeru pasma */}
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
