import { useState, useCallback, useEffect } from 'react';

export type ModalType =
  | 'equalizer'
  | 'parametric_eq'
  | 'dynamics_studio'
  | 'lyrics'
  | 'key_bpm'
  | 'loop_editor'
  | 'tape_deck'
  | 'stats'
  | 'tag_editor'
  | 'cover_art_picker'
  | 'duplicate_finder'
  | 'soundscape'
  | 'analog_lofi'
  | 'anime_ambience'
  | 'sleep_timer'
  | 'command_palette'
  | 'keyboard_shortcuts'
  | 'cue_sheet'
  | 'file_renamer'
  | 'harmonic_suggester'
  | 'model_manager'
  | 'stem_mixer'
  | 'stem_project_studio'
  | 'url_import'
  | 'audio_health_check'
  | 'audio_path_inspector'
  | 'auralune_recap'
  | 'changelog'
  | 'save_queue'
  | 'add_radio'
  | 'download_hub'
  | 'onboarding';

export interface ModalState<P = unknown> {
  activeModal: ModalType | null;
  payload: P | null;
}

export function useModalManager() {
  const [modalState, setModalState] = useState<ModalState>({
    activeModal: null,
    payload: null,
  });

  const isOpen = useCallback(
    (type: ModalType): boolean => {
      return modalState.activeModal === type;
    },
    [modalState.activeModal]
  );

  const openModal = useCallback((type: ModalType, payload: unknown = null) => {
    setModalState({
      activeModal: type,
      payload,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => {
      if (prev.activeModal === null) return prev;
      return { activeModal: null, payload: null };
    });
  }, []);

  const toggleModal = useCallback(
    (type: ModalType, payload: unknown = null) => {
      setModalState((prev) => {
        if (prev.activeModal === type) {
          return { activeModal: null, payload: null };
        }
        return { activeModal: type, payload };
      });
    },
    []
  );

  // Global Escape key listener to dismiss the currently open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState.activeModal !== null) {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalState.activeModal, closeModal]);

  return {
    activeModal: modalState.activeModal,
    modalPayload: modalState.payload,
    isOpen,
    openModal,
    closeModal,
    toggleModal,
  };
}
