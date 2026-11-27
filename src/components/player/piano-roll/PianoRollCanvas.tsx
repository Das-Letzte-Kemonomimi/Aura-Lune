import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCanvasLoop, type CanvasFrame } from '../../../hooks/useCanvasLoop';
import { livePlayback } from '../../../state/livePlayback';
import { clientPointToLocal, roundRectPath } from '../../../utils/canvasDraw';
import { smoothTo } from '../../../utils/smoothing';
import { easeDisplayPosition, extrapolatePositionMs, type ClockAnchor } from '../../../utils/playbackClock';
import { formatTime, formatTimeMs } from '../../../utils/timeFormat';
import {
  COLORS,
  FONT_MONO,
  drawPianoKeyLabel,
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
  fitLabelFontPx,
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
  /** Row height in px, or `null` (auto). */
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
  /** Speed of the source time relative to real time (see `playbackSpeed`). */
  speed?: number;
  /** Position used until the first status arrives from the backend. */
  fallbackPositionMs: number;
  pxPerSec: number;
  mode: PianoRollViewMode;
  /** Note labels (e.g. D2, C4) inside the rectangles, when the note is wide enough. */
  showLabels: boolean;
  /** Show note names on every piano key instead of only C notes. */
  showAllKeyLabels: boolean;
  /** Row height (px); `null` = fitted automatically. */
  rowHeight: number | null;
  onViewChange: (change: PianoRollViewChange) => void;
  onSeek: (positionMs: number) => void;
  labels: PianoRollTooltipLabels;
  ariaLabel: string;
}

/** Cursor movement (px) above which a click becomes a drag (panning). */
const DRAG_THRESHOLD_PX = 4;
const NOTE_MIN_WIDTH = 3;
/** Below this row height a label would be unreadable. */
const MIN_LABEL_KEY_HEIGHT = 10;
/** Position difference (ms) below which the playhead counts as settled and the loop sleeps. */
/** Label padding from the note edge (on each side). */
const LABEL_PAD_PX = 4;
const SETTLED_EPSILON_MS = 0.5;

/** Notes in this window around the playhead drive the vertical tracking in Follow mode. */
const FOLLOW_LOOKBEHIND_MS = 400;
const FOLLOW_LOOKAHEAD_MS = 3000;
const SCROLLBAR_WIDTH = 6;
/** Width of the scrollbar grab zone (easier to hit than 6 px). */
const SCROLLBAR_HIT_WIDTH = 14;
const SCROLLBAR_MIN_THUMB = 24;

interface FrameGeometry {
  layout: Layout;
  time: TimeAxis;
  pitch: PitchAxis;
  /** Maximum scroll in rows (0 = everything fits). */
  maxScroll: number;
}

interface DragState {
  region: 'roll' | 'minimap' | 'vscroll';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  /** The horizontal movement crossed the threshold → the time changes (and Follow is left). */
  panningTime: boolean;
}

/** Translucent strip with a triangle on the top / bottom edge: "there are more notes here, scroll". */
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

/** Vertical scrollbar along the right edge of the note area: track and thumb in CSS pixels. */
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
  /** Follow scrolls vertically on its own until the user scrolls by hand (it resumes when Follow is turned on again). */
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

    // --- position: extrapolation between backend ticks (60+ Hz instead of 10 Hz) ---
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

    // --- time axis ---
    const view = viewRef.current;
    const visibleMs = (roll.w / view.pxPerSec) * 1000;
    if (view.pxPerSec !== lastPxPerSecRef.current) {
      // A zoom change from the toolbar: in Free mode the centre of the view is kept.
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

    // --- pitch axis ---
    const rows = rowCount(range);
    const keyHeight = resolveKeyHeight(roll.h, rows, view.rowHeight, p.showLabels);
    const maxScroll = maxScrollRows(roll.h, keyHeight, rows);
    const viewRows = roll.h / keyHeight;
    let verticalSettled = true;
    if (maxScroll > 0 && view.mode === 'follow' && autoVerticalRef.current) {
      // Follow: the vertical view tracks the notes just before and after the playhead, moving only when they fall out of the window.
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

    // --- static layers (rebuilt only when the key changes) ---
    // The layer covers one extra row and is shifted by the fractional part, so it is rebuilt only when a whole row changes.
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
      showAllKeyLabels: p.showAllKeyLabels,
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

    // --- grid: only the visible lines, 1 device pixel ---
    const line = 1 / dpr;
    for (const g of visibleGridLines(t0, t1, p.bpm, view.pxPerSec)) {
      const x = Math.round(timeToX(time, g.ms) * dpr) / dpr;
      if (x < roll.x || x > roll.x + roll.w) continue;
      ctx.fillStyle = g.bar ? COLORS.bar : COLORS.beat;
      ctx.fillRect(x, roll.y, line, roll.h);
    }

    // --- notes: only those in the window ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(roll.x, roll.y, roll.w, roll.h);
    ctx.clip();
    const labelFontPx = clamp(keyHeight - 4, 9, 18);
    const drawLabels = p.showLabels && keyHeight >= MIN_LABEL_KEY_HEIGHT;
    const labelFont = (px: number) => `600 ${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    let currentFontPx = labelFontPx;
    ctx.font = labelFont(currentFontPx);
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
      // With labels the note background does not go below 0.75 opacity, otherwise dark text loses contrast.
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
      if (drawLabels) {
        // The label starts at the left edge of the visible part of the note and must fit in it (shrink the font or skip it).
        const labelX = Math.max(x, roll.x) + LABEL_PAD_PX;
        const room = x + w - labelX - LABEL_PAD_PX;
        const fontPx = fitLabelFontPx(note.pitch_name.length, room, labelFontPx);
        if (fontPx !== null) {
          if (fontPx !== currentFontPx) {
            ctx.font = labelFont(fontPx);
            currentFontPx = fontPx;
          }
          ctx.fillStyle = COLORS.noteLabel;
          currentFill = '';
          ctx.fillText(note.pitch_name, labelX, y + keyHeight / 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // --- markers: there are notes outside the visible rows in the time window ---
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

    // --- playhead ---
    const playheadX = timeToX(time, position);
    if (playheadX >= roll.x && playheadX <= roll.x + roll.w) {
      ctx.fillStyle = COLORS.playhead;
      ctx.fillRect(playheadX - 1, roll.y, 2, roll.h);
    }

    // --- vertical scrollbar (only when there is something to scroll) ---
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

    // --- keyboard with the sounding notes highlighted ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, roll.y, layout.keyWidth, roll.h);
    ctx.clip();
    ctx.drawImage(layers.keys, 0, roll.y - subRow, layout.keyWidth, layerHeight);
    if (active.length > 0) {
      for (const midi of active) {
        const y = pitchToY(pitch, midi);
        if (y + keyHeight < roll.y || y > roll.y + roll.h) continue;
        ctx.fillStyle = COLORS.keyActive;
        ctx.fillRect(1, y + 1, layout.keyWidth - 3, keyHeight - 2);
        drawPianoKeyLabel(ctx, midi, y, keyHeight, p.showAllKeyLabels, true);
      }
    }
    ctx.restore();

    // --- time ruler ---
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

    // --- minimap ---
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

    // --- note under the cursor (also while scrolling under a still mouse) ---
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

  // The latest props for the loop and handlers; a view/data change wakes the sleeping loop.
  useEffect(() => {
    propsRef.current = props;
    viewRef.current = { mode: props.mode, pxPerSec: props.pxPerSec, rowHeight: props.rowHeight };
    invalidate();
  });

  // Turning Follow on again restores the automatic row tracking.
  useEffect(() => {
    if (props.mode === 'follow') autoVerticalRef.current = true;
  }, [props.mode]);

  // Playback start/stop: a new anchor from the current displayed position, so the playhead does not jump.
  useEffect(() => {
    const at = performance.now();
    anchorRef.current = { positionMs: displayRef.current ?? anchorRef.current.positionMs, at };
    invalidate();
  }, [props.isPlaying, invalidate]);

  // A new backend status (e.g. a seek while paused) wakes the loop.
  useEffect(() => livePlayback.subscribe(invalidate), [invalidate]);

  const toLocal = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: clientX, y: clientY };
    const { x, y } = clientPointToLocal(el, clientX, clientY);
    return { x, y };
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
      // A click on the track puts the thumb under the cursor; further dragging moves it smoothly.
      const bar = scrollbarGeometry(roll, roll.h / geo.pitch.keyHeight, geo.maxScroll, geo.pitch.scrollRows);
      if (y < bar.thumbY || y > bar.thumbY + bar.thumbH) {
        scrollVertically(((y - roll.y - bar.thumbH / 2) / bar.travel) * geo.maxScroll, 'absolute');
      }
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { region, startX: x, startY: y, lastX: x, lastY: y, moved: false, panningTime: false };
  };

  /** Manual vertical scrolling does not leave Follow in time; it only turns off the automatic centring. */
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
      // Tooltip to the right of the cursor, or to the left near the right edge.
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
        // A vertical drag scrolls the rows and keeps Follow; only horizontal movement shifts the time (→ Free).
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

  // A native `wheel` listener with `passive: false`: React attaches `onWheel` as passive, so modal scrolling could not be cancelled.
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
        // Alt+wheel: row height; the row under the cursor stays under the cursor.
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
      // The wheel scrolls the rows (without leaving Follow) when there is something to scroll; Shift and horizontal movement (touchpad)
      // shift the time. When all rows fit, the wheel shifts the time as before.
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
    // `toLocal`/`setView` read only refs, so the handler is stable.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, invalidate]);

  const resetTooltip = useCallback(() => {
    hoverNoteRef.current = null;
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  }, []);
  useEffect(() => resetTooltip, [resetTooltip, index]);

  return (
    <div ref={wrapRef} className="relative h-full min-h-0 w-full">
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
        className="block h-full w-full cursor-crosshair touch-none"
      />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-5 hidden rounded-md border border-line-accent bg-modal px-2 py-1 text-xs whitespace-nowrap text-fg"
      />
    </div>
  );
});
