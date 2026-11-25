import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCanvasLoop, type CanvasFrame } from '../../../hooks/useCanvasLoop';
import { livePlayback } from '../../../state/livePlayback';
import { roundRectPath } from '../../../utils/canvasDraw';
import { smoothTo } from '../../../utils/smoothing';
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
  ROW_HEIGHT_MAX,
  ROW_HEIGHT_MIN,
  computeLayout,
  computePitchRange,
  followOriginMs,
  followScrollGoal,
  hiddenNotesBeyondView,
  hitTestNote,
  isNoteActive,
  maxScrollRows,
  minimapRect,
  noteOverlaps,
  pitchSpanInWindow,
  pitchToY,
  rollRect,
  resolveKeyHeight,
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

export interface PianoRollViewChange {
  pxPerSec?: number;
  mode?: PianoRollViewMode;
  /** Wysokość wiersza w px albo `null` (auto). */
  rowHeight?: number | null;
}

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
  /** Wysokość wiersza (px); `null` = dopasowana automatycznie. */
  rowHeight: number | null;
  onViewChange: (change: PianoRollViewChange) => void;
  onSeek: (positionMs: number) => void;
  labels: PianoRollTooltipLabels;
  ariaLabel: string;
}

/** Przesunięcie kursora (px) powyżej którego kliknięcie staje się przeciąganiem (panoramowaniem). */
const DRAG_THRESHOLD_PX = 4;
const NOTE_MIN_WIDTH = 3;
const NOTE_LABEL_MIN_WIDTH = 26;
/** Poniżej tej wysokości wiersza podpis byłby nieczytelny. */
const MIN_LABEL_KEY_HEIGHT = 10;
/** Różnica pozycji (ms), poniżej której uznajemy głowicę za ustaloną i usypiamy pętlę. */
const SETTLED_EPSILON_MS = 0.5;

/** Nuty z tego okna wokół głowicy decydują o pionowym śledzeniu w trybie Follow. */
const FOLLOW_LOOKBEHIND_MS = 400;
const FOLLOW_LOOKAHEAD_MS = 3000;
const SCROLLBAR_WIDTH = 6;
/** Szerokość strefy chwytania suwaka (łatwiej trafić niż w 6 px). */
const SCROLLBAR_HIT_WIDTH = 14;
const SCROLLBAR_MIN_THUMB = 24;

interface FrameGeometry {
  layout: Layout;
  time: TimeAxis;
  pitch: PitchAxis;
  /** Maksymalne przewinięcie w wierszach (0 = wszystko się mieści). */
  maxScroll: number;
}

interface DragState {
  region: 'roll' | 'minimap' | 'vscroll';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  /** Przesunięcie poziome przekroczyło próg → zmieniamy czas (i wychodzimy z Follow). */
  panningTime: boolean;
}

/** Półprzezroczysty pas z trójkątem na górnej / dolnej krawędzi: „są tu jeszcze nuty — przewiń”. */
function drawEdgeMarker(ctx: CanvasRenderingContext2D, roll: { x: number; y: number; w: number; h: number }, edge: 'top' | 'bottom') {
  const h = 18;
  const y0 = edge === 'top' ? roll.y : roll.y + roll.h;
  const y1 = edge === 'top' ? roll.y + h : roll.y + roll.h - h;
  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, COLORS.edgeMarker);
  grad.addColorStop(1, COLORS.edgeMarkerFade);
  ctx.fillStyle = grad;
  ctx.fillRect(roll.x, Math.min(y0, y1), roll.w, h);
  const cx = roll.x + 14;
  const tip = edge === 'top' ? y0 + 3 : y0 - 3;
  const base = edge === 'top' ? y0 + 10 : y0 - 10;
  ctx.fillStyle = COLORS.edgeMarkerArrow;
  ctx.beginPath();
  ctx.moveTo(cx, tip);
  ctx.lineTo(cx - 5, base);
  ctx.lineTo(cx + 5, base);
  ctx.closePath();
  ctx.fill();
}

/** Pionowy suwak wzdłuż prawej krawędzi obszaru nut: tor i uchwyt w pikselach CSS. */
function scrollbarGeometry(roll: { x: number; y: number; w: number; h: number }, viewRows: number, maxScroll: number, scrollRows: number) {
  const totalRows = viewRows + maxScroll;
  const thumbH = clamp((viewRows / totalRows) * roll.h, SCROLLBAR_MIN_THUMB, roll.h);
  const travel = Math.max(1, roll.h - thumbH);
  const thumbY = roll.y + (maxScroll > 0 ? (scrollRows / maxScroll) * travel : 0);
  return { x: roll.x + roll.w - SCROLLBAR_WIDTH - 2, thumbY, thumbH, travel };
}

export const PianoRollCanvas = React.memo(function PianoRollCanvas(props: PianoRollCanvasProps) {
  const { index } = props;
  const propsRef = useRef(props);
  const viewRef = useRef({ mode: props.mode, pxPerSec: props.pxPerSec, rowHeight: props.rowHeight });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const anchorRef = useRef<ClockAnchor>({ positionMs: props.fallbackPositionMs, at: performance.now() });
  const displayRef = useRef<number | null>(null);
  const freeOriginRef = useRef(0);
  const scrollRowsRef = useRef(0);
  /** Follow przewija pionowo sam, dopóki użytkownik nie przewinie ręcznie (wraca po ponownym włączeniu Follow). */
  const autoVerticalRef = useRef(true);
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
    const keyHeight = resolveKeyHeight(roll.h, rows, view.rowHeight, p.showLabels);
    const maxScroll = maxScrollRows(roll.h, keyHeight, rows);
    const viewRows = roll.h / keyHeight;
    let verticalSettled = true;
    if (maxScroll > 0 && view.mode === 'follow' && autoVerticalRef.current) {
      // Follow: widok pionowy sam śledzi nuty tuż przed i za głowicą — przesuwa się tylko wtedy, gdy wypadają z okna.
      const near = pitchSpanInWindow(index, position - FOLLOW_LOOKBEHIND_MS, position + FOLLOW_LOOKAHEAD_MS);
      const current = scrollRowsRef.current;
      const goal = followScrollGoal({ span: near, maxMidi: range.maxMidi, viewRows, current, maxScroll });
      const next = dt === 0 ? goal : smoothTo(current, goal, dt, 0.2);
      scrollRowsRef.current = Math.abs(next - goal) < 0.02 ? goal : next;
      verticalSettled = scrollRowsRef.current === goal;
    }
    scrollRowsRef.current = clamp(scrollRowsRef.current, 0, maxScroll);
    const pitch: PitchAxis = {
      maxMidi: range.maxMidi,
      minMidi: range.minMidi,
      keyHeight,
      top: roll.y,
      scrollRows: scrollRowsRef.current,
    };
    geometryRef.current = { layout, time, pitch, maxScroll };

    // --- warstwy statyczne (przebudowa tylko przy zmianie klucza) ---
    // Warstwa obejmuje jeden wiersz więcej i jest przesuwana o część ułamkową — przebudowa tylko przy zmianie pełnego wiersza.
    const wholeRows = Math.floor(scrollRowsRef.current);
    const subRow = (scrollRowsRef.current - wholeRows) * keyHeight;
    const layerHeight = Math.ceil(roll.h + keyHeight);
    const rowsKey: RowsLayerKey = {
      width,
      height: layerHeight,
      dpr,
      minMidi: range.minMidi,
      maxMidi: range.maxMidi,
      keyHeight,
      scrollRows: wholeRows,
      keyWidth: layout.keyWidth,
    };
    if (!rowsLayerRef.current || !rowsKeyEquals(rowsKeyRef.current, rowsKey)) {
      rowsLayerRef.current = renderRowsLayer(rowsKey, { ...pitch, scrollRows: wholeRows });
      rowsKeyRef.current = rowsKey;
    }
    const layers = rowsLayerRef.current;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, roll.y, width, roll.h);
    ctx.clip();
    ctx.drawImage(layers.rows, roll.x, roll.y - subRow, roll.w, layerHeight);
    ctx.restore();

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
    const labelFontPx = clamp(keyHeight - 4, 9, 18);
    const drawLabels = p.showLabels && keyHeight >= MIN_LABEL_KEY_HEIGHT;
    ctx.font = `600 ${labelFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
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
      // Z podpisami tło nuty nie schodzi poniżej 0,75 krycia — inaczej ciemny tekst traci kontrast.
      const velocityAlpha = clamp(note.velocity / 127, 0, 1);
      ctx.globalAlpha = isActive ? 1 : drawLabels ? 0.75 + 0.25 * velocityAlpha : 0.5 + 0.5 * velocityAlpha;
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
        currentFill = '';
        ctx.fillText(note.pitch_name, x + 4, y + keyHeight / 2);
      }
    }
    ctx.globalAlpha = 1;

    // --- znaczniki: w oknie czasu są nuty poza widocznymi wierszami ---
    if (maxScroll > 0) {
      const hidden = hiddenNotesBeyondView({
        span: pitchSpanInWindow(index, t0, t1),
        maxMidi: range.maxMidi,
        viewRows,
        scrollRows: scrollRowsRef.current,
      });
      if (hidden.above) drawEdgeMarker(ctx, roll, 'top');
      if (hidden.below) drawEdgeMarker(ctx, roll, 'bottom');
    }

    // --- głowica ---
    const playheadX = timeToX(time, position);
    if (playheadX >= roll.x && playheadX <= roll.x + roll.w) {
      ctx.fillStyle = COLORS.playhead;
      ctx.fillRect(playheadX - 1, roll.y, 2, roll.h);
    }

    // --- pionowy suwak (tylko gdy jest co przewijać) ---
    if (maxScroll > 0) {
      const bar = scrollbarGeometry(roll, viewRows, maxScroll, scrollRowsRef.current);
      ctx.fillStyle = COLORS.scrollTrack;
      roundRectPath(ctx, bar.x, roll.y, SCROLLBAR_WIDTH, roll.h, SCROLLBAR_WIDTH / 2);
      ctx.fill();
      ctx.fillStyle = COLORS.scrollThumb;
      roundRectPath(ctx, bar.x, bar.thumbY, SCROLLBAR_WIDTH, bar.thumbH, SCROLLBAR_WIDTH / 2);
      ctx.fill();
    }
    ctx.restore();

    // --- klawiatura z podświetleniem brzmiących nut ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, roll.y, layout.keyWidth, roll.h);
    ctx.clip();
    ctx.drawImage(layers.keys, 0, roll.y - subRow, layout.keyWidth, layerHeight);
    if (active.length > 0) {
      ctx.fillStyle = COLORS.keyActive;
      for (const midi of active) {
        const y = pitchToY(pitch, midi);
        if (y + keyHeight < roll.y || y > roll.y + roll.h) continue;
        ctx.fillRect(1, y + 1, layout.keyWidth - 3, keyHeight - 2);
      }
    }
    ctx.restore();

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

    return !(settled && verticalSettled);
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
    viewRef.current = { mode: props.mode, pxPerSec: props.pxPerSec, rowHeight: props.rowHeight };
    invalidate();
  });

  // Ponowne włączenie Follow przywraca automatyczne śledzenie wierszy.
  useEffect(() => {
    if (props.mode === 'follow') autoVerticalRef.current = true;
  }, [props.mode]);

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

  const setView = (change: PianoRollViewChange) => {
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
    if (region === 'roll' && geo.maxScroll > 0 && x >= roll.x + roll.w - SCROLLBAR_HIT_WIDTH) {
      region = 'vscroll';
      // Kliknięcie w tor ustawia uchwyt pod kursorem; dalsze przeciąganie przesuwa go płynnie.
      const bar = scrollbarGeometry(roll, roll.h / geo.pitch.keyHeight, geo.maxScroll, geo.pitch.scrollRows);
      if (y < bar.thumbY || y > bar.thumbY + bar.thumbH) {
        scrollVertically(((y - roll.y - bar.thumbH / 2) / bar.travel) * geo.maxScroll, 'absolute');
      }
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { region, startX: x, startY: y, lastX: x, lastY: y, moved: false, panningTime: false };
  };

  /** Ręczne przewijanie pionowe nie wychodzi z Follow w czasie, tylko wyłącza automatyczne centrowanie. */
  const scrollVertically = (rows: number, kind: 'delta' | 'absolute') => {
    autoVerticalRef.current = false;
    scrollRowsRef.current = kind === 'delta' ? scrollRowsRef.current + rows : rows;
    invalidate();
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
    if (drag && geo && drag.region === 'vscroll') {
      const roll = rollRect(geo.layout);
      const bar = scrollbarGeometry(roll, roll.h / geo.pitch.keyHeight, geo.maxScroll, geo.pitch.scrollRows);
      drag.moved = true;
      scrollVertically(((y - drag.lastY) / bar.travel) * geo.maxScroll, 'delta');
      drag.lastY = y;
    }
    if (drag && geo && drag.region === 'roll') {
      if (!drag.moved && Math.abs(x - drag.startX) + Math.abs(y - drag.startY) >= DRAG_THRESHOLD_PX) drag.moved = true;
      if (drag.moved) {
        // Przeciągnięcie w pionie przewija wiersze i zostawia Follow; dopiero ruch w poziomie przesuwa czas (→ Free).
        if (!drag.panningTime && Math.abs(x - drag.startX) >= DRAG_THRESHOLD_PX) {
          drag.panningTime = true;
          if (viewRef.current.mode !== 'free') setView({ mode: 'free' });
        }
        if (drag.panningTime) {
          const p = propsRef.current;
          const roll = rollRect(geo.layout);
          const pxPerSec = viewRef.current.pxPerSec;
          freeOriginRef.current = clampOriginMs(
            freeOriginRef.current - ((x - drag.lastX) / pxPerSec) * 1000,
            p.durationMs,
            roll.w,
            pxPerSec,
          );
        }
        if (geo.maxScroll > 0) scrollVertically(-(y - drag.lastY) / geo.pitch.keyHeight, 'delta');
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
    if (!drag || !geo || drag.moved || drag.region === 'vscroll') return;
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

      if (e.altKey) {
        // Alt+kółko: wysokość wierszy; wiersz pod kursorem zostaje pod kursorem.
        const { y } = toLocal(e.clientX, e.clientY);
        const oldHeight = geo.pitch.keyHeight;
        const next = clamp(oldHeight * Math.exp(-(e.deltaY || e.deltaX) * 0.0015), ROW_HEIGHT_MIN, ROW_HEIGHT_MAX);
        const rowUnderCursor = (y - roll.y) / oldHeight + geo.pitch.scrollRows;
        scrollRowsRef.current = rowUnderCursor - (y - roll.y) / next;
        autoVerticalRef.current = false;
        setView({ rowHeight: next });
        return;
      }
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
      // Kółko przewija wiersze (bez wychodzenia z Follow), gdy jest co przewijać; Shift i ruch poziomy (gładzik)
      // przesuwają czas. Gdy wszystkie wiersze się mieszczą, kółko przesuwa czas jak dotąd.
      const canScrollRows = geo.maxScroll > 0;
      const wantsRows = canScrollRows && !e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX);
      if (wantsRows) {
        scrollVertically(e.deltaY / geo.pitch.keyHeight, 'delta');
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
