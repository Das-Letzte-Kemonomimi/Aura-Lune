/**
 * Single dynamic-import entry for the settings modal chunk. `App.tsx` lazy-loads through it and the
 * header button warms it on hover, so both share one module request.
 */
export const loadAppSettingsModal = () =>
  import('./AppSettingsModal').then((m) => ({ default: m.AppSettingsModal }));

/** Fire-and-forget warm-up; a failed prefetch is retried by the real `lazy` load on open. */
export const preloadAppSettingsModal = (): void => {
  void loadAppSettingsModal().catch(() => undefined);
};
