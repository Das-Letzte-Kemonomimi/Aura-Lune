import { useEffect, useRef, type RefObject } from 'react';
import { stepSpin } from '../utils/inertialSpin';
import { useFrameLoop } from './useFrameLoop';

export interface InertialSpinOptions {
  /** Target angular speed (degrees/s); 0 when stopped. */
  targetDegPerSec: number;
  playing: boolean;
  /** Spin-up time constant (s). */
  tauUp: number;
  /** Spin-down time constant (s). */
  tauDown: number;
  /** 1 = clockwise, -1 = counter-clockwise. */
  direction?: 1 | -1;
  /** Applies the angle (e.g. `style.transform` / `setAttribute('transform')`); called only while the element rotates. */
  apply: (angleDeg: number, speedDegPerSec: number) => void;
  /** Element whose invisibility pauses the loop. */
  target?: RefObject<Element | null>;
}

/**
 * Inertial rotation (platter, reel): the loop runs only while the element rotates or spins up, and sleeps after
 * a full stop. Changing the parameters (tempo, playback) does NOT restart the loop; it only wakes it.
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
