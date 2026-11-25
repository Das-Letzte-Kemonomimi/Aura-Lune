import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCanvasLoop, type CanvasFrame } from '../../../hooks/useCanvasLoop';
import { livePlayback } from '../../../state/livePlayback';
import { roundRectPath } from '../../../utils/canvasDraw';
import { easeDisplayPosition, extrapolatePositionMs, type ClockAnchor } from '../../../utils/playbackClock';
import { formatTime, formatTimeMs } from '../../../utils/timeFormat';
import {
  COLORS,
  FONT_MONO,
  minimapKeyEquals,
  noteColor,
  renderMinimapLayer,
  renderRowsLayer,
  rowsKeyEquals,
  type MinimapKey,
  type RowsLayerKey,
} from './pianoRollLayers';
import {
  clamp,
  clampOriginMs,
  computeDensity,
  computeKeyHeight,
  computeLayout,
  computePitchRange,
  followOriginMs,
  hitTestNote,
  isNoteActive,
  maxScrollRows,
  minimapRect,
  noteOverlaps,
  pitchToY,
  rollRect,
  rowCount,
  rulerTicks,
  timeToX,
  visibleGridLines,
  visibleNoteRange,
  xToTime,
  zoomAround,
  MAX_PX_PER_SEC,
  MIN_PX_PER_SEC,
  type Layout,
  type NoteIndex,
  type PitchAxis,
  type TimeAxis,
} from './pianoRollModel';
import type { DetectedNote } from '../../../types/analysis';

export type PianoRollViewMode = 'follow' | 'free';

export interface PianoRollTooltipLabels {
  start: string;
  length: string;
  velocity: string;
}

export interface PianoRollCanvasProps {
  index: NoteIndex;
  bpm: number;
  durationMs: number;
  isPlaying: boolean;
  /** Prędkość czasu źródła względem rzeczywistego (zob. `playbackSpeed`). */
  speed?: number;
  /** Pozycja używana, dopóki nie dotarł pierwszy status z backendu. */
  fallbackPositionMs: number;
  pxPerSec: number;
  mode: PianoRollViewMode;
  /** Podpisy nut (np. D2, C4) wewnątrz prostokątów, o ile nuta jest dość szeroka. */
  showLabels: boolean;
  onViewChange: (change: { pxPerSec?: number; mode?: PianoRollViewMode }) => void;
  onSeek: (positionMs: number) => void;
  labels: PianoRollTooltipLabels;
  ariaLabel: string;
}

/** Przesunięcie kursora (px) powyżej którego kliknięcie staje się przeciąganiem (panoramowaniem). */
const DRAG_THRESHOLD_PX = 4;
const NOTE_MIN_WIDTH = 3;
const NOTE_LABEL_MIN_WIDTH = 24;
/** Poniżej tej wysokości wiersza podpis byłby nieczytelny. */
const MIN_LABEL_KEY_HEIGHT = 8;
/** Różnica pozycji (ms), poniżej której uznajemy głowicę za ustaloną i usypiamy pętlę. */
const SETTLED_EPSILON_MS = 0.5;

interface FrameGeometry {
  layout: Layout;
  time: TimeAxis;
  pitch: PitchAxis;
}

interface DragState {
  region: 'roll' | 'minimap';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

export const PianoRollCanvas = React.memo(function PianoRollCanvas(props: PianoRollCanvasProps) {
  const { index } = props;
  const propsRef = useRef(props);
  const viewRef = useRef({ mode: props.mode, pxPerSec: props.pxPerSec });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const anchorRef = useRef<ClockAnchor>({ positionMs: props.fallbackPositionMs, at: performance.now() });
  const displayRef = useRef<number | null>(null);
  const freeOriginRef = useRef(0);
  const scrollRowsRef = useRef(0);
  const lastPxPerSecRef = useRef(props.pxPerSec);
  const geometryRef = useRef<FrameGeometry | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoverNoteRef = useRef<DetectedNote | null>(null);
  const activePitchesRef = useRef<number[]>([]);
  const rowsKeyRef = useRef<RowsLayerKey | null>(null);
  const rowsLayerRef = useRef<{ rows: HTMLCanvasElement; keys: HTMLCanvasElement } | null>(null);
  const minimapKeyRef = useRef<MinimapKey | null>(null);
  const minimapLayerRef = useRef<HTMLCanvasElement | null>(null);
  const densityRef = useRef<{ notes: NoteIndex; duration: number; buckets: number; value: number[] } | null>(null);

  const range = useMemo(() => computePitchRange(index.notes), [index]);

  const draw = (frame: CanvasFrame): boolean => {
    const { ctx, width, height, dpr, dt } = frame;
    const p = propsRef.current;
    const layout = computeLayout(width, height);
    const roll = rollRect(layout);
    if (roll.w <= 0 || roll.h <= 0) return false;

    // --- pozycja: ekstrapolacja między tickami backendu (60+ Hz zamiast 10 Hz) ---
    const now = performance.now();
    const snap = livePlayback.getSnapshot();
    const reported = snap.ready ? snap.positionMs : p.fallbackPositionMs;
    if (reported !== anchorRef.current.positionMs) anchorRef.current = { positionMs: reported, at: now };
    const target = extrapolatePositionMs(anchorRef.current, now, {
      speed: p.speed ?? 1,
      playing: p.isPlaying,
      durationMs: p.durationMs,
    });
    const position = easeDisplayPosition(displayRef.current, target, dt, p.isPlaying);
    displayRef.current = position;
    const settled = !p.isPlaying && Math.abs(position - target) < SETTLED_EPSILON_MS;

    // --- oś czasu ---
    const view = viewRef.current;
    const visibleMs = (roll.w / view.pxPerSec) * 1000;
    if (view.pxPerSec !== lastPxPerSecRef.current) {
      // Zmiana zoomu z paska narzędzi: w trybie Free zachowujemy środek widoku.
      const centre = freeOriginRef.current + ((roll.w / lastPxPerSecRef.current) * 1000) / 2;
      freeOriginRef.current = centre - visibleMs / 2;
      lastPxPerSecRef.current = view.pxPerSec;
    }
    let originMs: number;
    if (view.mode === 'follow') {
      originMs = followOriginMs(position, roll.w, view.pxPerSec);
      freeOriginRef.current = originMs;
    } else {
      originMs = clampOriginMs(freeOriginRef.current, p.durationMs, roll.w, view.pxPerSec);
      freeOriginRef.current = originMs;
    }
    const time: TimeAxis = { originMs, pxPerSec: view.pxPerSec, left: roll.x };
    const t0 = originMs;
    const t1 = originMs + visibleMs;

    // --- oś wysokości ---
    const rows = rowCount(range);
    const keyHeight = computeKeyHeight(roll.h, rows);
    scrollRowsRef.current = clamp(scrollRowsRef.current, 0, maxScrollRows(roll.h, keyHeight, rows));
    const pitch: PitchAxis = {
      maxMidi: range.maxMidi,
      minMidi: range.minMidi,
      keyHeight,
      top: roll.y,
      scrollRows: scrollRowsRef.current,
    };
    geometryRef.current = { layout, time, pitch };

    // --- warstwy statyczne (przebudowa tylko przy zmianie klucza) ---
    const rowsKey: RowsLayerKey = {
      width,
      height: roll.h,
      dpr,
      minMidi: range.minMidi,
      maxMidi: range.maxMidi,
      keyHeight,
      scrollRows: scrollRowsRef.current,
      keyWidth: layout.keyWidth,
    };
    if (!rowsLayerRef.current || !rowsKeyEquals(rowsKeyRef.current, rowsKey)) {
      rowsLayerRef.current = renderRowsLayer(rowsKey, pitch);
      rowsKeyRef.current = rowsKey;
    }
    const layers = rowsLayerRef.current;
    ctx.drawImage(layers.rows, roll.x, roll.y, roll.w, roll.h);

    // --- siatka: tylko widoczne linie, 1 piksel urządzenia ---
    const line = 1 / dpr;
    for (const g of visibleGridLines(t0, t1, p.bpm, view.pxPerSec)) {
      const x = Math.round(timeToX(time, g.ms) * dpr) / dpr;
      if (x < roll.x || x > roll.x + roll.w) continue;
      ctx.fillStyle = g.bar ? COLORS.bar : COLORS.beat;
      ctx.fillRect(x, roll.y, line, roll.h);
    }

    // --- nuty: tylko te z okna ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(roll.x, roll.y, roll.w, roll.h);
    ctx.clip();
    const labelFontPx = clamp(keyHeight - 3, 7, 10);
    const drawLabels = p.showLabels && keyHeight >= MIN_LABEL_KEY_HEIGHT;
    ctx.font = `${labelFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = 'middle';
    const active = activePitchesRef.current;
    active.length = 0;
    const hover = hoverNoteRef.current;
    const [first, last] = visibleNoteRange(index, t0, t1);
    let currentFill = '';
    for (let i = first; i < last; i++) {
      const note = index.notes[i];
      if (!noteOverlaps(note, t0, t1)) continue;
      if (note.midi_pitch < range.minMidi || note.midi_pitch > range.maxMidi) continue;
      const y = pitchToY(pitch, note.midi_pitch);
      if (y + keyHeight < roll.y || y > roll.y + roll.h) continue;
      const x = timeToX(time, note.onset_ms);
      const w = Math.max(NOTE_MIN_WIDTH, (note.duration_ms / 1000) * view.pxPerSec - 1);
      const isActive = isNoteActive(note, position);
      if (isActive) active.push(note.midi_pitch);

      const fill = isActive ? COLORS.noteActive : noteColor(note.stem);
      if (fill !== currentFill) {
        ctx.fillStyle = fill;
        currentFill = fill;
      }
      ctx.globalAlpha = isActive ? 1 : 0.5 + 0.5 * clamp(note.velocity / 127, 0, 1);
      ctx.beginPath();
      roundRectPath(ctx, x, y + 1, w, keyHeight - 2, Math.min(3, w / 2));
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isActive || note === hover) {
        ctx.strokeStyle = COLORS.noteOutline;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (drawLabels && w >= NOTE_LABEL_MIN_WIDTH) {
        ctx.fillStyle = COLORS.noteLabel;
        currentFill = COLORS.noteLabel;
        ctx.fillText(note.pitch_name, x + 4, y + keyHeight / 2);
      }
    }
    ctx.globalAlpha = 1;

    // --- głowica ---
    const playheadX = timeToX(time, position);
    if (playheadX >= roll.x && playheadX <= roll.x + roll.w) {
      ctx.fillStyle = COLORS.playhead;
      ctx.fillRect(playheadX - 1, roll.y, 2, roll.h);
    }
    ctx.restore();

    // --- klawiatura z podświetleniem brzmiących nut ---
    ctx.drawImage(layers.keys, 0, roll.y, layout.keyWidth, roll.h);
    if (active.length > 0) {
      ctx.fillStyle = COLORS.keyActive;
      for (const midi of active) {
        const y = pitchToY(pitch, midi);
        if (y + keyHeight < roll.y || y > roll.y + roll.h) continue;
        ctx.fillRect(1, y + 1, layout.keyWidth - 3, keyHeight - 2);
      }
    }

    // --- linijka czasu ---
    ctx.fillStyle = COLORS.rulerBg;
    ctx.fillRect(0, 0, width, layout.rulerHeight);
    ctx.fillStyle = COLORS.rulerTick;
    ctx.font = FONT_MONO;
    ctx.textBaseline = 'middle';
    for (const tick of rulerTicks(t0, t1, view.pxPerSec)) {
      const x = Math.round(timeToX(time, tick.ms) * dpr) / dpr;
      ctx.fillStyle = COLORS.rulerTick;
      ctx.fillRect(x, layout.rulerHeight - 5, line, 5);
      ctx.fillStyle = COLORS.rulerText;
      ctx.fillText(formatTime(tick.ms), x + 4, layout.rulerHeight / 2);
    }
    if (playheadX >= roll.x && playheadX <= roll.x + roll.w) {
      ctx.fillStyle = COLORS.playhead;
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 7);
      ctx.closePath();
      ctx.fill();
    }

    // --- minimapa ---
    if (layout.minimapHeight > 0 && p.durationMs > 0) {
      const mm = minimapRect(layout);
      ctx.fillStyle = COLORS.minimapBg;
      ctx.fillRect(0, mm.y, layout.keyWidth, mm.h);
      const buckets = Math.max(1, Math.floor(mm.w / 2));
      let density = densityRef.current;
      if (!density || density.notes !== index || density.duration !== p.durationMs || density.buckets !== buckets) {
        density = { notes: index, duration: p.durationMs, buckets, value: computeDensity(index.notes, p.durationMs, buckets) };
        densityRef.current = density;
      }
      const mmKey: MinimapKey = { width: mm.w, height: mm.h, dpr, density: density.value };
      if (!minimapLayerRef.current || !minimapKeyEquals(minimapKeyRef.current, mmKey)) {
        minimapLayerRef.current = renderMinimapLayer(mmKey);
        minimapKeyRef.current = mmKey;
      }
      ctx.drawImage(minimapLayerRef.current, mm.x, mm.y, mm.w, mm.h);
      const vx = mm.x + clamp(t0 / p.durationMs, 0, 1) * mm.w;
      const vw = Math.max(3, clamp(visibleMs / p.durationMs, 0, 1) * mm.w);
      ctx.fillStyle = COLORS.minimapView;
      ctx.fillRect(vx, mm.y + 1, Math.min(vw, mm.x + mm.w - vx), mm.h - 2);
      ctx.fillStyle = COLORS.minimapViewBorder;
      ctx.fillRect(vx, mm.y + 1, line, mm.h - 2);
      ctx.fillStyle = COLORS.playhead;
      ctx.fillRect(mm.x + clamp(position / p.durationMs, 0, 1) * mm.w - 1, mm.y, 2, mm.h);
    }

    // --- nuta pod kursorem (też podczas przewijania pod nieruchomą myszą) ---
    updateHover(pitch, time);

    return !settled;
  };

  const updateHover = (pitch: PitchAxis, time: TimeAxis) => {
    const pos = hoverPosRef.current;
    const roll = geometryRef.current ? rollRect(geometryRef.current.layout) : null;
    let note: DetectedNote | null = null;
    if (pos && roll && pos.x >= roll.x && pos.x <= roll.x + roll.w && pos.y >= roll.y && pos.y <= roll.y + roll.h) {
      note = hitTestNote({ index, time, pitch, x: pos.x, y: pos.y });
    }
    if (note === hoverNoteRef.current) return;
    hoverNoteRef.current = note;
    const el = tooltipRef.current;
    if (!el) return;
    const l = propsRef.current.labels;
    if (!note) {
      el.style.display = 'none';
      return;
    }
    el.textContent = `${note.pitch_name} · ${l.start} ${formatTimeMs(note.onset_ms)} · ${l.length} ${(note.duration_ms / 1000).toFixed(2)} s · ${l.velocity} ${note.velocity}`;
    el.style.display = 'block';
  };

  const { canvasRef, invalidate } = useCanvasLoop(draw, {
    pixelRatio: 'device',
    onResize: () => {
      rowsKeyRef.current = null;
      minimapKeyRef.current = null;
    },
  });

  // Najnowsze propsy dla pętli i handlerów; zmiana widoku/danych budzi uśpioną pętlę.
  useEffect(() => {
    propsRef.current = props;
    viewRef.current = { mode: props.mode, pxPerSec: props.pxPerSec };
    invalidate();
  });

  // Start/stop odtwarzania: nowa kotwica z aktualnej pozycji wyświetlanej, żeby głowica nie skoczyła.
  useEffect(() => {
    const at = performance.now();
    anchorRef.current = { positionMs: displayRef.current ?? anchorRef.current.positionMs, at };
    invalidate();
  }, [props.isPlaying, invalidate]);

  // Nowy status backendu (np. seek w trakcie pauzy) budzi pętlę.
  useEffect(() => livePlayback.subscribe(invalidate), [invalidate]);

  const toLocal = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const setView = (change: { pxPerSec?: number; mode?: PianoRollViewMode }) => {
    viewRef.current = { ...viewRef.current, ...change };
    propsRef.current.onViewChange(change);
    invalidate();
  };

  const seekTo = (ms: number) => {
    const duration = propsRef.current.durationMs;
    propsRef.current.onSeek(Math.round(clamp(ms, 0, duration > 0 ? duration : Infinity)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const geo = geometryRef.current;
    if (e.button !== 0 || !geo) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const roll = rollRect(geo.layout);
    const mm = minimapRect(geo.layout);
    let region: DragState['region'] | null = null;
    if (x >= roll.x && x <= roll.x + roll.w && y >= roll.y && y <= roll.y + roll.h) region = 'roll';
    else if (geo.layout.minimapHeight > 0 && x >= mm.x && y >= mm.y) region = 'minimap';
    if (!region) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { region, startX: x, startY: y, lastX: x, lastY: y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = toLocal(e.clientX, e.clientY);
    hoverPosRef.current = { x, y };
    const tip = tooltipRef.current;
    if (tip) {
      const w = wrapRef.current?.clientWidth ?? 0;
      // Tooltip po prawej od kursora, a przy prawej krawędzi — po lewej.
      const flip = w > 0 && x > w * 0.6;
      tip.style.transform = `translate(${Math.round(x + (flip ? -12 : 14))}px, ${Math.round(y + 14)}px)${flip ? ' translateX(-100%)' : ''}`;
    }

    const drag = dragRef.current;
    const geo = geometryRef.current;
    if (drag && geo && drag.region === 'roll') {
      if (!drag.moved && Math.abs(x - drag.startX) + Math.abs(y - drag.startY) >= DRAG_THRESHOLD_PX) {
        drag.moved = true;
        if (viewRef.current.mode !== 'free') setView({ mode: 'free' });
      }
      if (drag.moved) {
        const p = propsRef.current;
        const roll = rollRect(geo.layout);
        const pxPerSec = viewRef.current.pxPerSec;
        freeOriginRef.current = clampOriginMs(
          freeOriginRef.current - ((x - drag.lastX) / pxPerSec) * 1000,
          p.durationMs,
          roll.w,
          pxPerSec,
        );
        scrollRowsRef.current -= (y - drag.lastY) / geo.pitch.keyHeight;
      }
      drag.lastX = x;
      drag.lastY = y;
    }
    invalidate();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const geo = geometryRef.current;
    if (!drag || !geo || drag.moved) return;
    const { x } = toLocal(e.clientX, e.clientY);
    if (drag.region === 'roll') {
      seekTo(xToTime(geo.time, x));
      return;
    }
    const mm = minimapRect(geo.layout);
    if (mm.w > 0) seekTo(((x - mm.x) / mm.w) * propsRef.current.durationMs);
  };

  const onPointerLeave = () => {
    hoverPosRef.current = null;
    invalidate();
  };

  // Natywny listener `wheel` z `passive: false` — React podpina `onWheel` jako pasywny i nie da się anulować przewijania modala.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const geo = geometryRef.current;
      if (!geo) return;
      e.preventDefault();
      const { x } = toLocal(e.clientX, e.clientY);
      const roll = rollRect(geo.layout);
      const p = propsRef.current;
      const delta = e.deltaY || e.deltaX;
      const view = viewRef.current;

      if (e.ctrlKey || e.metaKey) {
        const next = clamp(view.pxPerSec * Math.exp(-delta * 0.0015), MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        if (view.mode === 'free') {
          const zoomed = zoomAround(geo.time, clamp(x, roll.x, roll.x + roll.w), next);
          freeOriginRef.current = clampOriginMs(zoomed.originMs, p.durationMs, roll.w, zoomed.pxPerSec);
        }
        lastPxPerSecRef.current = next;
        setView({ pxPerSec: next });
        return;
      }
      if (e.shiftKey) {
        scrollRowsRef.current += delta / geo.pitch.keyHeight;
        invalidate();
        return;
      }
      if (view.mode !== 'free') setView({ mode: 'free' });
      freeOriginRef.current = clampOriginMs(
        freeOriginRef.current + (delta / view.pxPerSec) * 1000,
        p.durationMs,
        roll.w,
        view.pxPerSec,
      );
      invalidate();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
    // `toLocal`/`setView` czytają tylko refy, więc handler jest stabilny.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, invalidate]);

  const resetTooltip = useCallback(() => {
    hoverNoteRef.current = null;
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  }, []);
  useEffect(() => resetTooltip, [resetTooltip, index]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={props.ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onPointerLeave={onPointerLeave}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
      />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'none',
          pointerEvents: 'none',
          padding: '4px 8px',
          borderRadius: '6px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          color: '#e2e8f0',
          fontSize: '0.72rem',
          whiteSpace: 'nowrap',
          zIndex: 5,
        }}
      />
    </div>
  );
});
