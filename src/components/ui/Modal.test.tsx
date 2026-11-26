import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModalHeader, ModalShell } from './Modal';

function renderModal(onClose = vi.fn(), closeOnBackdrop?: boolean) {
  render(
    <ModalShell onClose={onClose} labelledBy="t" closeOnBackdrop={closeOnBackdrop}>
      <ModalHeader titleId="t" title="Sleep Timer" onClose={onClose} closeLabel="Close dialog" />
      <button type="button">Inside</button>
    </ModalShell>,
  );
  return onClose;
}

describe('ModalShell', () => {
  afterEach(cleanup);

  it('exposes a labelled modal dialog', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Sleep Timer' }).getAttribute('aria-modal')).toBe('true');
  });

  it('closes on Escape', () => {
    const onClose = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on clicks inside the panel', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the backdrop inert when closeOnBackdrop is false', () => {
    const onClose = renderModal(vi.fn(), false);
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the header close button', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops listening for Escape after unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ModalShell onClose={onClose}>
        <p>Body</p>
      </ModalShell>,
    );
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
