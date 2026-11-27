const isStreamUri = (uri: string): boolean => /^https?:\/\//i.test(uri);

/**
 * `currentRadioStation` is UI state that is set when a station is started but is
 * never cleared when something else starts playing (library track, stem project, ...).
 * It only counts as "active" while the engine is not playing a local file: if the
 * engine reports a non-stream URI, the stored station is stale and must be ignored.
 * While the engine has not reported any track yet (station just started), it is kept.
 */
export function resolveActiveRadioStation<T>(
  station: T | null | undefined,
  engineUri: string | null | undefined,
): T | null {
  if (!station) return null;
  if (engineUri && !isStreamUri(engineUri)) return null;
  return station;
}
