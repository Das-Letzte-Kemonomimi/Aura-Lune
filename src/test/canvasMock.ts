/**
 * Opt-in test helper for code that draws on a canvas (jsdom has no canvas: `getContext` returns null).
 * - `installFakeRaf()`: a manually driven `requestAnimationFrame`,
 * - `installCanvasMock()`: a recording 2D context, the canvas CSS size, DPR, ResizeObserver and a counter
 *   of `canvas.width/height` assignments (buffer reallocations).
 * Each returns an object with `restore()`; call it in `afterEach`.
 */
import { vi } from 'vitest';

export interface FakeRaf {
  /** Advances time by `ms` and runs all scheduled frames. */
  step: (ms?: number) => void;
  /** Number of scheduled frames not run yet. */
  pending: () => number;
  restore: () => void;
}

export function installFakeRaf(): FakeRaf {
  let now = 0;
  let nextId = 0;
  const queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    nextId += 1;
    queue.set(nextId, cb);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  return {
    step(ms = 16) {
      now += ms;
      const due = [...queue.values()];
      queue.clear();
      due.forEach((cb) => cb(now));
    },
    pending: () => queue.size,
    restore: () => {
      vi.unstubAllGlobals();
    },
  };
}

export interface CanvasMock {
  /** Recorded context method calls (names). */
  calls: string[];
  /** How many times `canvas.width` / `canvas.height` was assigned (each one reallocates and clears the buffer). */
  widthAssignments: () => number;
  heightAssignments: () => number;
  setCssSize: (width: number, height: number) => void;
  setDpr: (dpr: number) => void;
  /** Calls the callbacks of every ResizeObserver. */
  triggerResize: () => void;
  restore: () => void;
}

export function installCanvasMock(css = { width: 300, height: 100 }): CanvasMock {
  const calls: string[] = [];
  const store = new WeakMap<HTMLCanvasElement, { width: number; height: number }>();
  let widthSets = 0;
  let heightSets = 0;
  const size = { ...css };
  const resizeCallbacks = new Set<() => void>();

  const gradient = { addColorStop: () => {} };
  const ctxState: Record<string, unknown> = {};
  const ctx = new Proxy(ctxState, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args: unknown[]) => {
          calls.push(prop);
          void args;
          return gradient;
        };
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      return (...args: unknown[]) => {
        calls.push(prop);
        void args;
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext);

  const protoDescriptors = {
    width: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'),
    height: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height'),
  };
  const bufferOf = (el: HTMLCanvasElement) => {
    let v = store.get(el);
    if (!v) {
      v = { width: 300, height: 150 };
      store.set(el, v);
    }
    return v;
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    configurable: true,
    get(this: HTMLCanvasElement) {
      return bufferOf(this).width;
    },
    set(this: HTMLCanvasElement, v: number) {
      widthSets += 1;
      bufferOf(this).width = v;
    },
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
    configurable: true,
    get(this: HTMLCanvasElement) {
      return bufferOf(this).height;
    },
    set(this: HTMLCanvasElement, v: number) {
      heightSets += 1;
      bufferOf(this).height = v;
    },
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => size.width });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => size.height });

  const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  const setDpr = (dpr: number) =>
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, writable: true, value: dpr });
  setDpr(1);

  class FakeResizeObserver {
    private readonly cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
      resizeCallbacks.add(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      resizeCallbacks.delete(this.cb);
    }
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);

  return {
    calls,
    widthAssignments: () => widthSets,
    heightAssignments: () => heightSets,
    setCssSize(width, height) {
      size.width = width;
      size.height = height;
    },
    setDpr,
    triggerResize: () => resizeCallbacks.forEach((cb) => cb()),
    restore() {
      getContext.mockRestore();
      if (protoDescriptors.width) Object.defineProperty(HTMLCanvasElement.prototype, 'width', protoDescriptors.width);
      if (protoDescriptors.height) Object.defineProperty(HTMLCanvasElement.prototype, 'height', protoDescriptors.height);
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientWidth;
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientHeight;
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      vi.unstubAllGlobals();
    },
  };
}
