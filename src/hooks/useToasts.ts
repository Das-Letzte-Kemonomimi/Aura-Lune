import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastLevel = 'info' | 'error';

export interface Toast {
  id: number;
  level: ToastLevel;
  text: string;
}

export interface UseToastsOptions {
  /** Whether to show info messages (errors only by default). */
  showInfo?: boolean;
  /** Maximum number of messages visible at once. */
  maxVisible?: number;
  durationMs?: Partial<Record<ToastLevel, number>>;
}

const DEFAULT_DURATION: Record<ToastLevel, number> = { info: 2500, error: 5000 };

/**
 * In-app notification queue. Each message has its own timer (cleared on
 * unmount), new messages do not overwrite earlier ones, and identical text is not duplicated.
 * `showMessage` has a stable reference, so it is safe in effect dependencies.
 */
export function useToasts({ showInfo = false, maxVisible = 3, durationMs }: UseToastsOptions = {}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);
  const config = useRef({ showInfo, maxVisible, durationMs });
  config.current = { showInfo, maxVisible, durationMs };

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const showMessage = useCallback(
    (text: string, isError = false) => {
      const level: ToastLevel = isError ? 'error' : 'info';
      const { showInfo: info, maxVisible: max, durationMs: durations } = config.current;
      if (level === 'info' && !info) return;
      const id = nextId.current++;
      setToasts((list) => {
        const withoutDuplicate = list.filter((t) => !(t.text === text && t.level === level));
        for (const t of list) if (!withoutDuplicate.includes(t)) dismissTimer(t.id);
        const next = [...withoutDuplicate, { id, level, text }];
        for (const t of next.slice(0, Math.max(0, next.length - max))) dismissTimer(t.id);
        return next.slice(-max);
      });
      const duration = durations?.[level] ?? DEFAULT_DURATION[level];
      timers.current.set(id, setTimeout(() => dismiss(id), duration));

      function dismissTimer(oldId: number) {
        const timer = timers.current.get(oldId);
        if (timer) clearTimeout(timer);
        timers.current.delete(oldId);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  return { toasts, showMessage, dismiss };
}
