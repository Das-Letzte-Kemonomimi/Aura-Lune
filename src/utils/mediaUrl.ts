/**
 * Rewrites `s=` query parameter on `auralune-media://` cover URLs so large views
 * (Player, BigScreen) request `768` px artwork while lists/tiles/dock keep `256` px.
 * External HTTPS URLs and data URIs pass through unchanged.
 */
export function coverUrlWithSize(
  url: string | null | undefined,
  size: 256 | 768,
): string | null {
  if (!url) return null;
  if (!url.startsWith('auralune-media://')) return url;
  return url.replace(/([?&]s=)(?:256|768)\b/, `$1${size}`);
}
