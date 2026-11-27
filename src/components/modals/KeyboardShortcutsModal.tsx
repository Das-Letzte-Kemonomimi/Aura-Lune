import React, { useId } from 'react';
import { Keyboard } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { Card, Kbd, ModalBody, ModalHeader, ModalShell } from '../ui';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose, currentLang = 'en' }) => {
  const titleId = useId();
  if (!isOpen) return null;

  const t = getTranslations(currentLang);

  const shortcuts = [
    {
      category: t.shortcuts.catPlayback,
      items: [
        { key: 'Space', desc: t.shortcuts.playPause },
        { key: '← / →', desc: t.shortcuts.seekFwdBack },
        { key: '↑ / ↓', desc: t.shortcuts.volUpDown },
        { key: 'M', desc: t.shortcuts.muteUnmute },
        { key: 'F2 / Shift+M', desc: t.shortcuts.miniPlayer },
        { key: 'F11', desc: t.shortcuts.fullscreen },
      ],
    },
    {
      category: t.shortcuts.catNavigation,
      items: [
        { key: 'N', desc: t.shortcuts.nextTrack },
        { key: 'P', desc: t.shortcuts.prevTrack },
        { key: 'S', desc: t.shortcuts.shuffle },
        { key: 'L', desc: t.shortcuts.loop },
        { key: 'T', desc: t.shortcuts.lyrics },
      ],
    },
    {
      category: t.shortcuts.catDsp,
      items: [
        { key: '[ / ]', desc: t.shortcuts.pitchShift },
        { key: '- / +', desc: t.shortcuts.tempoShift },
        { key: '0', desc: t.shortcuts.resetDsp },
      ],
    },
    {
      category: t.shortcuts.viewAndUiScale,
      items: [
        { key: 'Ctrl + / -', desc: t.shortcuts.zoomInOut },
        { key: 'Ctrl + 0', desc: t.shortcuts.resetUiScale },
        { key: 'Ctrl + K', desc: t.shortcuts.commandPalette },
        { key: '1 - 4', desc: t.shortcuts.quickViewSwitch },
      ],
    },
    {
      category: t.shortcuts.catLoop,
      items: [
        { key: 'A', desc: t.shortcuts.loopA },
        { key: 'B', desc: t.shortcuts.loopB },
        { key: 'C', desc: t.shortcuts.loopClear },
        { key: '?', desc: t.shortcuts.toggleHelp },
      ],
    },
  ];

  return (
    <ModalShell onClose={onClose} size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.shortcuts.title}
        subtitle={t.shortcuts.subtitle}
        icon={<Keyboard size={20} />}
        tone="cyan"
        onClose={onClose}
        closeLabel={t.common.close}
      />

      <ModalBody className="grid grid-cols-2 gap-4">
        {shortcuts.map((cat) => (
          <Card key={cat.category} variant="inset" padding="sm" className="flex flex-col gap-2.5">
            <h4 className="label-caps text-accent-cyan">{cat.category}</h4>
            <div className="flex flex-col gap-2">
              {cat.items.map((it) => (
                <div key={it.key} className="flex items-center justify-between gap-2 text-ui">
                  <span className="text-fg-secondary">{it.desc}</span>
                  <Kbd>{it.key}</Kbd>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </ModalBody>
    </ModalShell>
  );
};
