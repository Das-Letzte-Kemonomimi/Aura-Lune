import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModalBody, ModalFooter, ModalHeader, ModalShell } from './Modal';

function renderModal(onClose = vi.fn(), closeOnBackdrop?: boolean) {
  render(
    <ModalShell onClose={onClose} labelledBy="t" closeOnBackdrop={closeOnBackdrop}>
      <h3 id="t">Sleep Timer</h3>
      <button type="button" onClick={onClose}>
        Close dialog
      </button>
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

  it('lets content close it through its own button', () => {
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

describe('ModalHeader, ModalBody and ModalFooter', () => {
  afterEach(cleanup);

  it('names the dialog through the header title and closes from its button', () => {
    const onClose = vi.fn();
    render(
      <ModalShell onClose={onClose} labelledBy="hdr" size="full">
        <ModalHeader titleId="hdr" title="Tag Editor" subtitle="3 tracks" onClose={onClose} closeLabel="Close" />
        <ModalBody>body</ModalBody>
        <ModalFooter>
          <button type="button">Save</button>
        </ModalFooter>
      </ModalShell>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tag Editor' });
    expect(dialog.className).toContain('max-w-[96vw]');
    expect(screen.getByText('3 tracks')).toBeTruthy();
    expect(screen.getByText('body').className).toContain('overflow-y-auto');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders no close button without onClose', () => {
    render(<ModalHeader title="Info" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
