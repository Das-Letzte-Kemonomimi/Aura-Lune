import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '../../../components/ui/icons';
import { Button, IconButton, Select } from '../../../components/ui';
import type { Translations } from '../../../i18n';
import { fmt } from '../../../utils/fmt';
import { PAGE_SIZE_OPTIONS, pageCount, pageRange, pageWindow } from './paginationModel';

export interface LibraryPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loc: Translations;
}

/** Range summary, page buttons and the rows-per-page choice under (and above) the track table. */
export const LibraryPagination = React.memo(function LibraryPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  loc,
}: LibraryPaginationProps) {
  const count = pageCount(total, pageSize);
  const { start, end } = pageRange(page, total, pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-muted">
      <span aria-live="polite">
        {total === 0 ? '0' : fmt(loc.library.pageRange, String(start + 1), String(end), String(total))}
      </span>

      {count > 1 && (
        <nav aria-label={loc.library.pageNav} className="flex items-center gap-1">
          <IconButton size="sm" label={loc.library.pageFirst} disabled={page <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft size={14} />
          </IconButton>
          <IconButton size="sm" label={loc.library.pagePrev} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={14} />
          </IconButton>
          {pageWindow(page, count).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'tinted' : 'ghost'}
                tone="purple"
                size="sm"
                aria-current={item === page ? 'page' : undefined}
                title={fmt(loc.library.pageGoTo, String(item))}
                onClick={() => onPageChange(item)}
                className="min-w-7 px-1.5 font-mono"
              >
                {item}
              </Button>
            ),
          )}
          <IconButton size="sm" label={loc.library.pageNext} disabled={page >= count} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={14} />
          </IconButton>
          <IconButton size="sm" label={loc.library.pageLast} disabled={page >= count} onClick={() => onPageChange(count)}>
            <ChevronsRight size={14} />
          </IconButton>
        </nav>
      )}

      <label className="flex items-center gap-2">
        <span>{loc.library.pageRows}</span>
        <Select size="sm" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="w-auto">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
});
