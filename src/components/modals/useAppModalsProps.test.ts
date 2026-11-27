// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useAppModalsProps } from './useAppModalsProps';

describe('useAppModalsProps', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes through AppModalsContainerProps directly when no modals bundle is provided', () => {
    const mockProps = { language: 'en' } as any;
    const { result, rerender } = renderHook((props: any) => useAppModalsProps(props), {
      initialProps: mockProps,
    });
    const first = result.current;
    expect(first).toEqual(mockProps);

    rerender({ language: 'en' });
    expect(result.current).toBe(first);
  });

  it('unpacks modals bundle and merges with rest properties', () => {
    const mockModals = {
      isHealthCheckModalOpen: true,
      isLoFiModalOpen: false,
    } as any;
    const { result } = renderHook(() =>
      useAppModalsProps({
        modals: mockModals,
        language: 'pl',
        status: { state: 'Playing' } as any,
      }),
    );
    expect(result.current.isHealthCheckModalOpen).toBe(true);
    expect(result.current.isLoFiModalOpen).toBe(false);
    expect(result.current.language).toBe('pl');
  });
});
