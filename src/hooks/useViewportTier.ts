import { useEffect, useState } from 'react';

export type ViewportTier = 'mobile' | 'tablet' | 'desktop';

function getViewportTier(): ViewportTier {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  if (window.matchMedia('(max-width: 639px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 767px)').matches) return 'tablet';
  return 'desktop';
}

/** Tracks Tailwind's `sm` (640px) and `md` (768px) breakpoints for numeric canvas/SVG widget props. */
export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(getViewportTier);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mobileQuery = window.matchMedia('(max-width: 639px)');
    const tabletQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setTier(getViewportTier());

    update();
    mobileQuery.addEventListener('change', update);
    tabletQuery.addEventListener('change', update);
    return () => {
      mobileQuery.removeEventListener('change', update);
      tabletQuery.removeEventListener('change', update);
    };
  }, []);

  return tier;
}
