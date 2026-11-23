import { useEffect, useRef, type RefObject } from 'react';
import { stepSpin } from '../utils/inertialSpin';
import { useFrameLoop } from './useFrameLoop';

export interface InertialSpinOptions {
  /** Docelowa prędkość kątowa (stopnie/s); 0 gdy zatrzymane. */
  targetDegPerSec: number;
  playing: boolean;
  /** Stała czasowa rozpędzania (s). */
  tauUp: number;
  /** Stała czasowa wytracania prędkości (s). */
  tauDown: number;
  /** 1 = zgodnie z ruchem wskazówek, -1 = przeciwnie. */
  direction?: 1 | -1;
  /** Zastosuj kąt (np. `style.transform` / `setAttribute('transform')`) — wołane tylko, gdy element się obraca. */
  apply: (angleDeg: number, speedDegPerSec: number) => void;
  /** Element, którego niewidoczność wstrzymuje pętlę. */
  target?: RefObject<Element | null>;
}

/**
 * Bezwładny obrót (talerz, szpula): pętla działa tylko, dopóki element się obraca lub rozpędza, i śpi po
 * całkowitym zatrzymaniu. Zmiana parametrów (tempo, odtwarzanie) NIE restartuje pętli — jedynie ją budzi.
 */
export function useInertialSpin(options: InertialSpinOptions): {
  angleRef: RefObject<number>;
  speedRef: RefObject<number>;
} {
  const optionsRef = useRef(options);
  const angleRef = useRef(0);
  const speedRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  });

  const { wake } = useFrameLoop(
    ({ dt }) => {
      const o = optionsRef.current;
      const step = stepSpin(
        { angle: angleRef.current, speed: speedRef.current },
        o.targetDegPerSec,
        o.playing,
        dt,
        o.tauUp,
        o.tauDown,
        o.direction ?? 1,
      );
      angleRef.current = step.angle;
      speedRef.current = step.speed;
      if (step.speed > 0.01) o.apply(step.angle, step.speed);
      return !step.settled;
    },
    { target: options.target },
  );

  useEffect(() => {
    wake();
  }, [options.targetDegPerSec, options.playing, wake]);

  return { angleRef, speedRef };
}
