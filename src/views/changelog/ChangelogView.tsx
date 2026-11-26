import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Wrench,
  Tag,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
} from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';
import rawReleases from '../../data/changelog.json';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';

export interface ChangelogItem {
  pl: string;
  en: string;
  de: string;
  fi: string;
  la: string;
}

export interface ChangelogRelease {
  version: string;
  codename: string;
  date: string;
  author: string;
  isLatest?: boolean;
  added: ChangelogItem[];
  fixed: ChangelogItem[];
}

export interface ChangelogViewProps {
  currentLang?: Language;
}

const RELEASES: ChangelogRelease[] = rawReleases as ChangelogRelease[];
const LATEST_RELEASE = RELEASES.find((r) => r.isLatest) || RELEASES[0];
const PAGE_SIZE_OPTIONS = [3, 5, 10];

export const ChangelogView: React.FC<ChangelogViewProps> = ({ currentLang = 'pl' }) => {
  const loc = getTranslations(currentLang);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const totalReleases = RELEASES.length;
  const totalPages = Math.max(1, Math.ceil(totalReleases / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedReleases = useMemo(() => {
    const startIndex = (clampedPage - 1) * pageSize;
    return RELEASES.slice(startIndex, startIndex + pageSize);
  }, [clampedPage, pageSize]);

  const getLocText = (obj: ChangelogItem) => {
    return obj[currentLang] || obj.pl || obj.en;
  };

  const handlePageChange = (newPage: number) => {
    const target = Math.min(Math.max(1, newPage), totalPages);
    setCurrentPage(target);
    if (containerRef.current && typeof containerRef.current.scrollIntoView === 'function') {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Generate page numbers with smart ellipsis for long lists
  const pageNumbers = useMemo(() => {
    const delta = 2;
    const pages: (number | string)[] = [];
    const range: number[] = [];

    for (
      let i = Math.max(2, clampedPage - delta);
      i <= Math.min(totalPages - 1, clampedPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (clampedPage - delta > 2) {
      pages.push(1, '...');
    } else {
      pages.push(1);
    }

    pages.push(...range);

    if (clampedPage + delta < totalPages - 1) {
      pages.push('...', totalPages);
    } else if (totalPages > 1) {
      pages.push(totalPages);
    }

    // Deduplicate in case totalPages is small
    return Array.from(new Set(pages));
  }, [clampedPage, totalPages]);

  return (
    <div
      ref={containerRef}
      className="mx-auto my-0 flex max-w-210 flex-col gap-5"
    >
      {/* Section header */}
      <div
        className="glass-card flex flex-wrap items-center justify-between gap-3.5 border-l-4 border-accent-pink px-6 py-5"
      >
        <div>
          <h3 className="m-0 flex items-center gap-2.5 text-xl font-extrabold text-fg">
            <Sparkles size={20} className="text-accent-pink" />
            {loc.changelog.title}
          </h3>
          <p className="mx-0 mt-1 mb-0 text-ui text-fg-secondary">
            {loc.changelog.subtitle}
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/20 px-3 py-1.5 font-mono text-xs font-bold text-accent-purple"
          >
            <Tag size={12} /> v{LATEST_RELEASE.version} • {LATEST_RELEASE.codename}
          </span>
        </div>
      </div>

      {/* Page navigation / filter bar at the top */}
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-line bg-black/25 px-4 py-2.5 text-ui"
      >
        <div className="flex items-center gap-2 text-fg-muted">
          <Layers size={14} className="text-accent-cyan" />
          <span className="font-semibold text-fg">
            {fmt(loc.changelog.totalReleases, String(totalReleases))}
          </span>
          <span>•</span>
          <span>
            {fmt(loc.changelog.page, String(clampedPage), String(totalPages))}
          </span>
        </div>

        {/* Releases per page */}
        <div className="flex items-center gap-1.5">
          <span className="text-fg-muted">{loc.changelog.perPage}</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              data-testid={`page-size-${size}`}
              aria-label={`${loc.changelog.perPage} ${size}`}
              onClick={() => handlePageSizeChange(size)}
              className={cn(
                'rounded-md border-0 px-2 py-1 text-xs font-bold text-fg transition-colors duration-150',
                pageSize === size ? 'bg-accent-purple' : 'bg-white/8',
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Releases on the current page */}
      {paginatedReleases.map((rel) => (
        <div
          key={rel.version}
          className="glass-card relative flex flex-col gap-4.5 overflow-hidden p-6"
        >
          {/* Version and metadata bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3.5">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5 rounded-lg bg-accent-gradient px-3 py-1 text-base font-extrabold text-on-accent shadow-md shadow-accent-pink/35"
              >
                <Tag size={15} />
                <span>v{rel.version}</span>
              </div>
              <div>
                <h4 className="m-0 text-lg font-bold text-fg">
                  „{rel.codename}”
                </h4>
              </div>
              {rel.isLatest && (
                <span
                  className="rounded-sm border border-green-500/40 bg-green-500/20 px-2 py-0.5 text-xxs font-extrabold tracking-wider text-accent-green"
                >
                  {loc.changelog.latestBadge}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-ui text-fg-muted">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {rel.date}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-accent-pink">
                <User size={13} />
                {rel.author}
              </span>
            </div>
          </div>

          {/* Section: Added */}
          {rel.added && rel.added.length > 0 && (
            <div>
              <h5 className="mx-0 mt-0 mb-2.5 flex items-center gap-2 text-sm font-bold text-accent-cyan">
                <Sparkles size={15} />
                {loc.changelog.added}
              </h5>
              <ul className="m-0 flex flex-col gap-2 pl-4.5 text-ui text-fg-secondary">
                {rel.added.map((item, idx) => (
                  <li key={idx} className="leading-normal">
                    <span className="text-fg">{getLocText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section: Fixed */}
          {rel.fixed && rel.fixed.length > 0 && (
            <div>
              <h5 className="mx-0 mt-0 mb-2.5 flex items-center gap-2 text-sm font-bold text-accent-pink">
                <Wrench size={15} />
                {loc.changelog.fixed}
              </h5>
              <ul className="m-0 flex flex-col gap-2 pl-4.5 text-ui text-fg-secondary">
                {rel.fixed.map((item, idx) => (
                  <li key={idx} className="leading-normal">
                    <span className="text-fg">{getLocText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {/* Bottom paginator with page buttons */}
      {totalPages > 1 && (
        <div className="mt-2 mb-6 flex flex-wrap items-center justify-center gap-2">
          {/* First page */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={clampedPage === 1}
            title={loc.changelog.first}
            className={cn(
              'glass-card flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-ui font-bold text-fg',
              clampedPage === 1 ? 'cursor-not-allowed' : 'cursor-pointer',
              clampedPage === 1 ? 'opacity-35' : 'opacity-100',
            )}
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Previous page */}
          <button
            onClick={() => handlePageChange(clampedPage - 1)}
            disabled={clampedPage === 1}
            title={loc.changelog.prev}
            className={cn(
              'glass-card flex items-center gap-1 rounded-lg border border-line px-3.5 py-2 text-ui font-bold text-fg',
              clampedPage === 1 ? 'cursor-not-allowed' : 'cursor-pointer',
              clampedPage === 1 ? 'opacity-35' : 'opacity-100',
            )}
          >
            <ChevronLeft size={15} />
            <span>{loc.changelog.prev}</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((page, idx) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2.5 py-2 text-ui text-fg-muted"
                  >
                    …
                  </span>
                );
              }
              const isSelected = page === clampedPage;
              return (
                <button
                  key={`page-${page}`}
                  onClick={() => handlePageChange(Number(page))}
                  className={cn(
                    'h-9 min-w-9 rounded-lg border px-2 py-0 text-ui text-fg transition-all duration-150',
                    isSelected ? 'font-extrabold' : 'font-semibold',
                    isSelected ? 'bg-accent-gradient' : 'bg-white/5',
                    isSelected ? 'border-accent-pink' : 'border-line',
                    isSelected ? 'shadow-md shadow-accent-pink/35' : 'shadow-none',
                  )}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Next page */}
          <button
            onClick={() => handlePageChange(clampedPage + 1)}
            disabled={clampedPage === totalPages}
            title={loc.changelog.next}
            className={cn(
              'glass-card flex items-center gap-1 rounded-lg border border-line px-3.5 py-2 text-ui font-bold text-fg',
              clampedPage === totalPages ? 'cursor-not-allowed' : 'cursor-pointer',
              clampedPage === totalPages ? 'opacity-35' : 'opacity-100',
            )}
          >
            <span>{loc.changelog.next}</span>
            <ChevronRight size={15} />
          </button>

          {/* Last page */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={clampedPage === totalPages}
            title={loc.changelog.last}
            className={cn(
              'glass-card flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-ui font-bold text-fg',
              clampedPage === totalPages ? 'cursor-not-allowed' : 'cursor-pointer',
              clampedPage === totalPages ? 'opacity-35' : 'opacity-100',
            )}
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
