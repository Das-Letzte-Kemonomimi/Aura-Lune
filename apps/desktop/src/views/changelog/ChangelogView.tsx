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
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '840px',
        margin: '0 auto',
      }}
    >
      {/* Nagłówek sekcji */}
      <div
        className="glass-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          borderLeft: '4px solid var(--accent-pink)',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Sparkles size={20} color="var(--accent-pink)" />
            {loc.changelog.title}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {loc.changelog.subtitle}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '0.74rem',
              padding: '5px 12px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.2)',
              color: 'var(--accent-purple)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Tag size={12} /> v{LATEST_RELEASE.version} • {LATEST_RELEASE.codename}
          </span>
        </div>
      </div>

      {/* Pasek nawigacji / filtrowania stron na górze */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 16px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <Layers size={14} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 600, color: '#fff' }}>
            {loc.changelog.totalReleases.replace('{0}', String(totalReleases))}
          </span>
          <span>•</span>
          <span>
            {loc.changelog.page
              .replace('{0}', String(clampedPage))
              .replace('{1}', String(totalPages))}
          </span>
        </div>

        {/* Wybór liczby wydań na stronę */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>{loc.changelog.perPage}</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              data-testid={`page-size-${size}`}
              aria-label={`${loc.changelog.perPage} ${size}`}
              onClick={() => handlePageSizeChange(size)}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background:
                  pageSize === size
                    ? 'var(--accent-purple)'
                    : 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                transition: 'background 0.15s ease',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Lista wydań bieżącej strony */}
      {paginatedReleases.map((rel) => (
        <div
          key={rel.version}
          className="glass-card"
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Pasek wersji i metadanych */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  boxShadow: '0 2px 8px rgba(244, 63, 94, 0.35)',
                }}
              >
                <Tag size={15} />
                <span>v{rel.version}</span>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                  „{rel.codename}”
                </h4>
              </div>
              {rel.isLatest && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: 'var(--accent-green)',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                  }}
                >
                  {loc.changelog.latestBadge}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} />
                {rel.date}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--accent-pink)',
                  fontWeight: 600,
                }}
              >
                <User size={13} />
                {rel.author}
              </span>
            </div>
          </div>

          {/* Sekcja: Dodano (Added) */}
          {rel.added && rel.added.length > 0 && (
            <div>
              <h5
                style={{
                  margin: '0 0 10px 0',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={15} />
                {loc.changelog.added}
              </h5>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {rel.added.map((item, idx) => (
                  <li key={idx} style={{ lineHeight: 1.5 }}>
                    <span style={{ color: '#fff' }}>{getLocText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sekcja: Naprawiono (Fixed) */}
          {rel.fixed && rel.fixed.length > 0 && (
            <div>
              <h5
                style={{
                  margin: '0 0 10px 0',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: 'var(--accent-pink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Wrench size={15} />
                {loc.changelog.fixed}
              </h5>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {rel.fixed.map((item, idx) => (
                  <li key={idx} style={{ lineHeight: 1.5 }}>
                    <span style={{ color: '#fff' }}>{getLocText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {/* Paginator dolny z przyciskami stron */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '8px',
            marginBottom: '24px',
          }}
        >
          {/* Pierwsza strona */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={clampedPage === 1}
            title={loc.changelog.first}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: clampedPage === 1 ? 'not-allowed' : 'pointer',
              opacity: clampedPage === 1 ? 0.35 : 1,
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Poprzednia strona */}
          <button
            onClick={() => handlePageChange(clampedPage - 1)}
            disabled={clampedPage === 1}
            title={loc.changelog.prev}
            className="glass-card"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: clampedPage === 1 ? 'not-allowed' : 'pointer',
              opacity: clampedPage === 1 ? 0.35 : 1,
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ChevronLeft size={15} />
            <span>{loc.changelog.prev}</span>
          </button>

          {/* Numery stron */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {pageNumbers.map((page, idx) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      padding: '8px 10px',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                    }}
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
                  style={{
                    minWidth: '36px',
                    height: '36px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    background: isSelected
                      ? 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected
                      ? '1px solid var(--accent-pink)'
                      : '1px solid var(--border-subtle)',
                    color: '#fff',
                    boxShadow: isSelected
                      ? '0 2px 8px rgba(244, 63, 94, 0.35)'
                      : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Następna strona */}
          <button
            onClick={() => handlePageChange(clampedPage + 1)}
            disabled={clampedPage === totalPages}
            title={loc.changelog.next}
            className="glass-card"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: clampedPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: clampedPage === totalPages ? 0.35 : 1,
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{loc.changelog.next}</span>
            <ChevronRight size={15} />
          </button>

          {/* Ostatnia strona */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={clampedPage === totalPages}
            title={loc.changelog.last}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: clampedPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: clampedPage === totalPages ? 0.35 : 1,
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
