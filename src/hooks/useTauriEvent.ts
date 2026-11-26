import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

/**
 * Subscribes to a Tauri event for the lifetime of the component.
 *
 * - The handler always sees the latest props/state (kept in a ref), so changing the handler
 *   does not re-register the listener.
 * - If the component unmounts before `listen()` resolves, the listener is
 *   unregistered right after it resolves (no leaked listeners).
 *
 * @param eventName name of the event emitted by the backend
 * @param handler   called with the event `payload`
 * @param enabled   lets the subscription be disabled conditionally (e.g. while a modal is closed)
 */
export function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let unlisten: (() => void) | null = null;

    listen<T>(eventName, (event) => {
      if (!disposed) handlerRef.current(event.payload);
    })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((err) => {
        console.warn(`Failed to register the listener for event ${eventName}:`, err);
      });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [eventName, enabled]);
}
