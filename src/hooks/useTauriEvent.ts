import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

/**
 * Subskrybuje zdarzenie Tauri na czas życia komponentu.
 *
 * - Handler zawsze widzi najnowsze propsy/stan (trzymany w ref), więc zmiana handlera
 *   nie powoduje ponownej rejestracji nasłuchu.
 * - Jeśli komponent zostanie odmontowany, zanim `listen()` się rozwiąże, nasłuch jest
 *   wyrejestrowywany natychmiast po rozwiązaniu (brak wycieku nasłuchów).
 *
 * @param eventName nazwa zdarzenia emitowanego przez backend
 * @param handler   wywoływany z `payload` zdarzenia
 * @param enabled   pozwala warunkowo wyłączyć subskrypcję (np. gdy modal jest zamknięty)
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
        console.warn(`Nie udało się zarejestrować nasłuchu zdarzenia ${eventName}:`, err);
      });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [eventName, enabled]);
}
