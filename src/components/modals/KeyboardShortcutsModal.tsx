import React from 'react';
import { X, Keyboard } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { ModalShell } from '../ui';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose, currentLang = 'en' }) => {
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
    <ModalShell
      onClose={onClose}
      className="flex max-h-[90vh] max-w-170 flex-col gap-5 overflow-y-auto rounded-3xl border border-line-accent p-7 shadow-2xl shadow-black/80"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent-cyan bg-linear-135 from-accent-cyan/30 to-accent-pink/30"
          >
            <Keyboard size={18} className="text-accent-cyan" />
          </div>
          <div>
            <h3 className="m-0 text-xl font-extrabold text-fg">
              {t.shortcuts.title}
            </h3>
            <p className="m-0 text-ui text-fg-muted">
              {t.shortcuts.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex rounded-lg border border-line bg-white/6 p-1.5 text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Category list */}
      <div className="grid grid-cols-2 gap-4">
        {shortcuts.map((cat) => (
          <div
            key={cat.category}
            className="flex flex-col gap-2.5 rounded-xl border border-line bg-slate-900/65 px-4 py-3.5"
          >
            <h4 className="m-0 text-ui font-bold tracking-wider text-accent-cyan uppercase">
              {cat.category}
            </h4>
            <div className="flex flex-col gap-2">
              {cat.items.map((it) => (
                <div
                  key={it.key}
                  className="flex items-center justify-between gap-2 text-ui"
                >
                  <span className="text-fg-secondary">{it.desc}</span>
                  <kbd
                    className="rounded-md border border-white/15 bg-white/8 px-2 py-0.5 font-mono text-xs font-bold whitespace-nowrap text-accent-pink"
                  >
                    {it.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};
