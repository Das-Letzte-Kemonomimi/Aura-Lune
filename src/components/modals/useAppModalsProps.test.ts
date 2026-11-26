import { describe, it, expect } from 'vitest';
import { useAppModalsProps } from './useAppModalsProps';

describe('useAppModalsProps', () => {
  it('passes through AppModalsContainerProps directly when no modals bundle is provided', () => {
    const mockProps = { language: 'en' } as any;
    const result = useAppModalsProps(mockProps);
    expect(result).toEqual(mockProps);
  });

  it('unpacks modals bundle and merges with rest properties', () => {
    const mockModals = {
      isHealthCheckModalOpen: true,
      isLoFiModalOpen: false,
    } as any;
    const result = useAppModalsProps({
      modals: mockModals,
      language: 'pl',
      status: { state: 'Playing' } as any,
    });
    expect(result.isHealthCheckModalOpen).toBe(true);
    expect(result.isLoFiModalOpen).toBe(false);
    expect(result.language).toBe('pl');
  });
});
