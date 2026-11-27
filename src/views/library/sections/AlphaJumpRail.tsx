import React from 'react';
import { Button } from '../../../components/ui';
import { JUMP_LETTERS } from './alphaIndexModel';

export interface AlphaJumpRailProps {
  /** First list index of each letter present in the current list. */
  letterIndex: ReadonlyMap<string, number>;
  onJump: (index: number) => void;
  label: string;
  otherLabel: string;
}

/** Vertical A–Z strip: letters with no entries are disabled, `#` collects numbers and symbols. */
export const AlphaJumpRail = React.memo(function AlphaJumpRail({ letterIndex, onJump, label, otherLabel }: AlphaJumpRailProps) {
  return (
    <nav aria-label={label} className="sticky top-16 z-20 flex shrink-0 flex-col items-center self-start rounded-xl border border-line bg-black/30 py-1">
      {JUMP_LETTERS.map((letter) => {
        const index = letterIndex.get(letter);
        return (
          <Button
            key={letter}
            variant="ghost"
            disabled={index === undefined}
            title={letter === '#' ? otherLabel : undefined}
            onClick={() => index !== undefined && onJump(index)}
            className="h-4.5 w-6 rounded-md px-0 py-0 text-xxs"
          >
            {letter}
          </Button>
        );
      })}
    </nav>
  );
});
