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
  RefreshCw,
} from '../../components/ui/icons';
import { type Language, getTranslations } from '../../i18n';
import rawReleases from '../../data/changelog.json';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, Chip, IconButton, SectionHeader } from '../../components/ui';
import {
  headerRelease,
  pageItems,
  visibleReleases,
  type ChangelogItem,
  type ChangelogRelease,
} from './changelogModel';

export type { ChangelogItem, ChangelogRelease };

export interface ChangelogViewProps {
  currentLang: Language;
  /** Build channel (`"dev"` or `"stable"`). Defaults from `__APP_VERSION__`. */
  channel?: string;
}

const ALL_RELEASES: ChangelogRelease[] = rawReleases as ChangelogRelease[];
const PAGE_SIZE_OPTIONS = [3, 5, 10];

function resolveChannel(channel?: string): string {
  if (channel) return channel;
  return typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__.includes('-dev') ? 'dev' : 'stable';
}

/** The "Added" or "Fixed" list of one release. */
function ReleaseSection({ icon, title, className, items, text }: {
  icon: React.ReactNode;
  title: string;
  className: string;
  items: ChangelogItem[] | undefined;
  text: (item: ChangelogItem) => string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h5 className={cn('mb-2.5 flex items-center gap-2 text-sm font-bold', className)}>
        {icon}
        {title}
      </h5>
      <ul className="flex list-disc flex-col gap-2 pl-4.5 text-ui text-fg">
        {items.map((item, idx) => (
          <li key={idx} className="leading-normal">
            {text(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ChangelogView: React.FC<ChangelogViewProps> = ({ currentLang, channel }) => {
  const loc = getTranslations(currentLang);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const effectiveChannel = resolveChannel(channel);
  const releases = useMemo(
    () => visibleReleases(ALL_RELEASES, effectiveChannel),
    [effectiveChannel],
  );
  const highlightedRelease = useMemo(
    () => headerRelease(ALL_RELEASES, effectiveChannel),
    [effectiveChannel],
  );

  const totalReleases = releases.length;
  const totalPages = Math.max(1, Math.ceil(totalReleases / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const onFirstPage = clampedPage === 1;
  const onLastPage = clampedPage === totalPages;

  const paginatedReleases = useMemo(() => {
    const startIndex = (clampedPage - 1) * pageSize;
    return releases.slice(startIndex, startIndex + pageSize);
  }, [clampedPage, pageSize, releases]);

  const getLocText = (obj: ChangelogItem) => obj[currentLang] || obj.en || obj.pl;

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.min(Math.max(1, newPage), totalPages));
    if (containerRef.current && typeof containerRef.current.scrollIntoView === 'function') {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div ref={containerRef} className="mx-auto flex max-w-210 flex-col gap-5">
      {/* Section header */}
      <Card padding="none" className="border-l-4 border-l-accent-pink px-6 py-5">
        <SectionHeader
          icon={<Sparkles size={16} />}
          title={loc.changelog.title}
          description={loc.changelog.subtitle}
          actions={
            highlightedRelease ? (
              <Badge tone={highlightedRelease.isDev ? 'cyan' : 'purple'} size="sm" mono className="font-bold">
                <Tag size={12} /> v{highlightedRelease.version} • {highlightedRelease.codename}
              </Badge>
            ) : undefined
          }
        />
      </Card>

      {/* Page navigation / filter bar at the top */}
      <Card variant="inset" padding="none" className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 text-ui">
        <div className="flex items-center gap-2 text-fg-muted">
          <Layers size={14} className="text-accent-cyan" />
          <span className="font-semibold text-fg">{fmt(loc.changelog.totalReleases, String(totalReleases))}</span>
          <span aria-hidden="true">•</span>
          <span>{fmt(loc.changelog.page, String(clampedPage), String(totalPages))}</span>
        </div>

        {/* Releases per page */}
        <div role="group" aria-label={loc.changelog.perPage} className="flex items-center gap-1.5">
          <span className="text-fg-muted" aria-hidden="true">{loc.changelog.perPage}</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Chip
              key={size}
              tone="purple"
              data-testid={`page-size-${size}`}
              aria-label={`${loc.changelog.perPage} ${size}`}
              pressed={pageSize === size}
              onClick={() => handlePageSizeChange(size)}
            >
              {size}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Releases on the current page */}
      {paginatedReleases.map((rel) => (
        <Card
          key={rel.version}
          padding="lg"
          highlight={rel.isDev ? 'cyan' : undefined}
          className="flex flex-col gap-4.5"
        >
          {/* Version and metadata bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={rel.isDev ? 'cyan' : 'pink'} className="text-base font-extrabold">
                <Tag size={15} /> v{rel.version}
              </Badge>
              <h4 className="text-lg font-bold text-fg">„{rel.codename}”</h4>
              {rel.isDev && (
                <Badge tone="cyan" size="xs" className="font-extrabold tracking-wider">
                  {loc.changelog.devBadge}
                </Badge>
              )}
              {!rel.isDev && rel.isLatest && (
                <Badge tone="green" size="xs" className="font-extrabold tracking-wider">
                  {loc.changelog.latestBadge}
                </Badge>
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

          <ReleaseSection
            icon={<Sparkles size={15} />}
            title={loc.changelog.added}
            className="text-accent-cyan"
            items={rel.added}
            text={getLocText}
          />
          <ReleaseSection
            icon={<RefreshCw size={15} />}
            title={loc.changelog.changed}
            className="text-accent-purple"
            items={rel.changed}
            text={getLocText}
          />
          <ReleaseSection
            icon={<Wrench size={15} />}
            title={loc.changelog.fixed}
            className="text-accent-pink"
            items={rel.fixed}
            text={getLocText}
          />
        </Card>
      ))}

      {/* Bottom paginator with page buttons */}
      {totalPages > 1 && (
        <nav aria-label={fmt(loc.changelog.page, String(clampedPage), String(totalPages))} className="mt-2 mb-6 flex flex-wrap items-center justify-center gap-2">
          <IconButton variant="secondary" label={loc.changelog.first} disabled={onFirstPage} onClick={() => handlePageChange(1)}>
            <ChevronsLeft size={15} />
          </IconButton>
          <Button disabled={onFirstPage} onClick={() => handlePageChange(clampedPage - 1)}>
            <ChevronLeft size={15} /> {loc.changelog.prev}
          </Button>

          <div className="flex items-center gap-1">
            {pageItems(clampedPage, totalPages).map((page, idx) =>
              page === 'gap' ? (
                <span key={`gap-${idx}`} className="px-2.5 py-2 text-ui text-fg-muted" aria-hidden="true">
                  …
                </span>
              ) : (
                <Button
                  key={`page-${page}`}
                  variant={page === clampedPage ? 'primary' : 'secondary'}
                  aria-current={page === clampedPage ? 'page' : undefined}
                  onClick={() => handlePageChange(page)}
                  className="min-w-9 px-2"
                >
                  {page}
                </Button>
              ),
            )}
          </div>

          <Button disabled={onLastPage} onClick={() => handlePageChange(clampedPage + 1)}>
            {loc.changelog.next} <ChevronRight size={15} />
          </Button>
          <IconButton variant="secondary" label={loc.changelog.last} disabled={onLastPage} onClick={() => handlePageChange(totalPages)}>
            <ChevronsRight size={15} />
          </IconButton>
        </nav>
      )}
    </div>
  );
};
