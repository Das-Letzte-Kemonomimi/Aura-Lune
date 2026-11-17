import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalManager } from './useModalManager';

describe('useModalManager hook', () => {
  it('initializes with no active modal', () => {
    const { result } = renderHook(() => useModalManager());

    expect(result.current.activeModal).toBeNull();
    expect(result.current.isOpen('equalizer')).toBe(false);
    expect(result.current.modalPayload).toBeNull();
  });

  it('opens a specified modal with optional payload', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('tag_editor', { trackId: 42 });
    });

    expect(result.current.activeModal).toBe('tag_editor');
    expect(result.current.isOpen('tag_editor')).toBe(true);
    expect(result.current.isOpen('equalizer')).toBe(false);
    expect(result.current.modalPayload).toEqual({ trackId: 42 });
  });

  it('closes active modal and clears payload', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('lyrics');
    });
    expect(result.current.isOpen('lyrics')).toBe(true);

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.activeModal).toBeNull();
    expect(result.current.isOpen('lyrics')).toBe(false);
    expect(result.current.modalPayload).toBeNull();
  });

  it('toggles modal open and closed', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.toggleModal('soundscape');
    });
    expect(result.current.isOpen('soundscape')).toBe(true);

    act(() => {
      result.current.toggleModal('soundscape');
    });
    expect(result.current.isOpen('soundscape')).toBe(false);
    expect(result.current.activeModal).toBeNull();
  });

  it('dismisses modal when Escape key is pressed', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('command_palette');
    });
    expect(result.current.isOpen('command_palette')).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen('command_palette')).toBe(false);
    expect(result.current.activeModal).toBeNull();
  });
});
