import type { CoverCandidate } from '../../types/library';

/** Minimum match score (0-100) required to mark the top result as the best match (matches Rust AUTO_ACCEPT_SCORE). */
export const BEST_MATCH_MIN_SCORE = 75;

/** Candidates scoring below this threshold are dimmed as weak matches in the picker. */
export const LOW_SCORE_THRESHOLD = 50;

/** Returns a new array sorted by `match_score` descending, preserving relative order on ties. */
export function sortCoverCandidates(candidates: readonly CoverCandidate[]): CoverCandidate[] {
  return [...candidates].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
}

/** True only for the top-ranked candidate when it clears the confident-match threshold. */
export function isBestCoverCandidate(
  candidate: Pick<CoverCandidate, 'match_score'>,
  index: number,
): boolean {
  return index === 0 && (candidate.match_score ?? 0) >= BEST_MATCH_MIN_SCORE;
}

/** True when a candidate is a weak fallback match that should be visually dimmed. */
export function isLowScoreCoverCandidate(
  candidate: Pick<CoverCandidate, 'match_score'>,
): boolean {
  return (candidate.match_score ?? 0) < LOW_SCORE_THRESHOLD;
}
