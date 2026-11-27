import { describe, expect, it } from 'vitest';
import type { CoverCandidate } from '../../types/library';
import {
  BEST_MATCH_MIN_SCORE,
  LOW_SCORE_THRESHOLD,
  isBestCoverCandidate,
  isLowScoreCoverCandidate,
  sortCoverCandidates,
} from './coverCandidateModel';

function makeCandidate(overrides: Partial<CoverCandidate> = {}): CoverCandidate {
  return {
    source: 'Deezer (1000px)',
    title: 'ef - a tale of memories.',
    artist: 'TENMON',
    thumbnail_url: 'https://cdn.example/thumb.jpg',
    full_url: 'https://cdn.example/full.jpg',
    width: 1000,
    height: 1000,
    match_score: 90,
    ...overrides,
  };
}

describe('coverCandidateModel', () => {
  it('sorts candidates by match_score descending while preserving tie order', () => {
    const low = makeCandidate({ title: 'Weak', match_score: 30, full_url: 'https://cdn.example/1.jpg' });
    const firstTie = makeCandidate({ title: 'First 90', match_score: 90, full_url: 'https://cdn.example/2.jpg' });
    const secondTie = makeCandidate({ title: 'Second 90', match_score: 90, full_url: 'https://cdn.example/3.jpg' });
    const mid = makeCandidate({ title: 'Mid', match_score: 65, full_url: 'https://cdn.example/4.jpg' });

    const sorted = sortCoverCandidates([low, firstTie, mid, secondTie]);
    expect(sorted.map((c) => c.title)).toEqual(['First 90', 'Second 90', 'Mid', 'Weak']);
  });

  it('marks only index 0 as best match when it meets BEST_MATCH_MIN_SCORE', () => {
    const strong = makeCandidate({ match_score: BEST_MATCH_MIN_SCORE });
    const weak = makeCandidate({ match_score: BEST_MATCH_MIN_SCORE - 1 });

    expect(isBestCoverCandidate(strong, 0)).toBe(true);
    expect(isBestCoverCandidate(strong, 1)).toBe(false);
    expect(isBestCoverCandidate(weak, 0)).toBe(false);
  });

  it('dims candidates strictly below LOW_SCORE_THRESHOLD', () => {
    expect(isLowScoreCoverCandidate({ match_score: LOW_SCORE_THRESHOLD - 1 })).toBe(true);
    expect(isLowScoreCoverCandidate({ match_score: LOW_SCORE_THRESHOLD })).toBe(false);
    expect(isLowScoreCoverCandidate({ match_score: 95 })).toBe(false);
  });
});
