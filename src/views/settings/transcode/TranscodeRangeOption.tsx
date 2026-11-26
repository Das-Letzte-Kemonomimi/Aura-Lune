import React, { useId } from 'react';
import { Scissors, Repeat, Bookmark, AlertTriangle } from '../../../components/ui/icons';
import { Badge, Button, Card, TextField, ToggleCard, type Tone } from '../../../components/ui';
import { textTones } from '../../../components/ui/tones';
import { formatTimeMs } from '../../../utils/timeFormat';
import { cn } from '../../../utils/cn';
import { fmt } from '../../../utils/fmt';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';

export type TranscodeRangeOptionProps = Pick<
  TranscodeSettingsViewProps,
  | 'transcodeApplyRange'
  | 'onTranscodeApplyRangeChange'
  | 'loc'
  | 'loopPointA'
  | 'loopPointB'
  | 'currentTrackBookmarks'
  | 'onTranscodeRangeAChange'
  | 'onTranscodeRangeBChange'
  | 'transcodeRangeA'
  | 'status'
  | 'transcodeRangeB'
> & {
  handleApplyLoopFromPlayer: () => void;
  handleApplyBookmarksRange: () => void;
  parsedA: number;
  parsedB: number | null;
  isOrderInvalid: boolean;
};

interface RangePointFieldProps {
  label: string;
  /** Resolved time shown next to the label. */
  resolved: string;
  tone: Tone;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSetCurrent: () => void;
  setCurrentLabel: string;
  setCurrentTitle: string;
  /** The player's loop point for this end, offered as a one-click fill. */
  loopPoint: number | null;
  loopLetter: 'A' | 'B';
  loopTitle: string;
}

/** One end of the export range: a time field, "set current position" and the player's loop point. */
function RangePointField({
  label,
  resolved,
  tone,
  value,
  placeholder,
  onChange,
  onSetCurrent,
  setCurrentLabel,
  setCurrentTitle,
  loopPoint,
  loopLetter,
  loopTitle,
}: RangePointFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={cn('text-ui font-semibold', textTones[tone])}>
          {label}
        </label>
        <span className="font-mono text-xs text-fg-muted">{resolved}</span>
      </div>
      <div className="flex gap-1.5">
        <TextField id={id} mono placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        <Button size="sm" onClick={onSetCurrent} title={setCurrentTitle}>
          {setCurrentLabel}
        </Button>
        {loopPoint !== null && (
          <Button
            variant="tinted"
            tone={tone}
            size="sm"
            onClick={() => onChange(formatTimeMs(loopPoint))}
            title={loopTitle}
          >
            {loopLetter}
          </Button>
        )}
      </div>
    </div>
  );
}

export const TranscodeRangeOption: React.FC<TranscodeRangeOptionProps> = ({
  currentTrackBookmarks,
  handleApplyBookmarksRange,
  handleApplyLoopFromPlayer,
  isOrderInvalid,
  loc,
  loopPointA,
  loopPointB,
  onTranscodeApplyRangeChange,
  onTranscodeRangeAChange,
  onTranscodeRangeBChange,
  parsedA,
  parsedB,
  status,
  transcodeApplyRange,
  transcodeRangeA,
  transcodeRangeB,
}) => {
  const hasLoop = loopPointA !== null || loopPointB !== null;
  return (
    <ToggleCard
      icon={<Scissors size={20} />}
      tone="cyan"
      title={loc.settings.transcodeApplyRange}
      description={loc.settings.transcodeApplyRangeDesc}
      checked={transcodeApplyRange}
      onChange={onTranscodeApplyRangeChange}
    >
      {hasLoop && !transcodeApplyRange && (
        <Badge tone="cyan">
          {loc.settings.transcodeLoopAB} {formatTimeMs(loopPointA ?? 0)} → {formatTimeMs(loopPointB)}
        </Badge>
      )}

      {transcodeApplyRange && (
        <div className="flex flex-col gap-3">
          {/* Fill the range from the player's A-B loop or the saved markers */}
          {(hasLoop || currentTrackBookmarks.length >= 2) && (
            <div className="flex flex-wrap items-center gap-2">
              {hasLoop && (
                <Button variant="tinted" tone="cyan" size="sm" onClick={handleApplyLoopFromPlayer}>
                  <Repeat size={14} />
                  {loc.settings.transcodeFromPlayer} (A: {loopPointA !== null ? formatTimeMs(loopPointA) : '0ms'} → B:{' '}
                  {loopPointB !== null ? formatTimeMs(loopPointB) : '—'})
                </Button>
              )}
              {currentTrackBookmarks.length >= 2 && (
                <Button variant="tinted" tone="pink" size="sm" onClick={handleApplyBookmarksRange}>
                  <Bookmark size={14} />
                  {fmt(loc.settings.transcodeApplySavedBookmarks, String(currentTrackBookmarks.length))}
                </Button>
              )}
            </div>
          )}

          {currentTrackBookmarks.length > 0 && (
            <Card variant="inset" padding="none" className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
              <span className="text-xs text-fg-muted">{loc.settings.transcodeSavedMarkers}</span>
              {currentTrackBookmarks.map((bm) => (
                <span key={bm.id} className="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-xxs">
                  <span className="font-semibold text-fg">{bm.name}</span>
                  <span className="font-mono text-accent-cyan">({formatTimeMs(bm.position_ms)})</span>
                  <Button
                    variant="tinted"
                    tone="cyan"
                    size="sm"
                    className="px-1.5 py-0 text-xxs"
                    onClick={() => onTranscodeRangeAChange(formatTimeMs(bm.position_ms))}
                    title={`Set "${bm.name}" as point A`}
                  >
                    A
                  </Button>
                  <Button
                    variant="tinted"
                    tone="pink"
                    size="sm"
                    className="px-1.5 py-0 text-xxs"
                    onClick={() => onTranscodeRangeBChange(formatTimeMs(bm.position_ms))}
                    title={`Set "${bm.name}" as point B`}
                  >
                    B
                  </Button>
                </span>
              ))}
            </Card>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(55),1fr))] gap-2.5">
            <RangePointField
              label={loc.settings.transcodePointA}
              resolved={formatTimeMs(parsedA)}
              tone="cyan"
              value={transcodeRangeA}
              placeholder="e.g. 0:00.000, 0:22.449, 860ms"
              onChange={onTranscodeRangeAChange}
              onSetCurrent={() => onTranscodeRangeAChange(formatTimeMs(status.position_ms))}
              setCurrentLabel={loc.settings.transcodeSetCurrentTime}
              setCurrentTitle={loc.settings.transcodeSetCurrentPos}
              loopPoint={loopPointA}
              loopLetter="A"
              loopTitle={loc.settings.transcodeGetLoopA}
            />
            <RangePointField
              label={loc.settings.transcodePointB}
              resolved={parsedB !== null ? formatTimeMs(parsedB) : loc.settings.transcodeEndOfTrack}
              tone="pink"
              value={transcodeRangeB}
              placeholder={loc.settings.transcodeTimePlaceholder}
              onChange={onTranscodeRangeBChange}
              onSetCurrent={() => onTranscodeRangeBChange(formatTimeMs(status.position_ms))}
              setCurrentLabel={loc.settings.transcodeSetCurrentTime}
              setCurrentTitle={loc.settings.transcodeSetCurrentPos}
              loopPoint={loopPointB}
              loopLetter="B"
              loopTitle={loc.settings.transcodeGetLoopB}
            />
          </div>

          {/* Range summary and validation */}
          {isOrderInvalid ? (
            <div role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-accent-red">
              <AlertTriangle size={14} />
              <span>{loc.settings.transcodeEndMustBeGreater}</span>
            </div>
          ) : (
            <div
              className={cn('flex items-center gap-1.5 font-mono text-xs', parsedB !== null ? 'text-accent-cyan' : 'text-fg-muted')}
            >
              <Scissors size={14} />
              <span>
                {parsedB !== null
                  ? fmt(
                      loc.settings.transcodeRangeDuration,
                      `${((parsedB - parsedA) / 1000).toFixed(3)}s (${formatTimeMs(parsedB - parsedA)})`,
                    )
                  : fmt(loc.settings.transcodeExportRangeText, formatTimeMs(parsedA))}
              </span>
            </div>
          )}
        </div>
      )}
    </ToggleCard>
  );
};
