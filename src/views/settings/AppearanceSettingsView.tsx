import React, { useId, useState } from 'react';
import {
  Sparkles,
  Maximize2,
  Palette,
  Image as ImageIcon,
  UploadCloud,
  FolderOpen,
  Upload,
  Trash2,
  Save,
  Check,
} from '../../components/ui/icons';
import {
  Badge,
  Button,
  Card,
  FieldLabel,
  OptionCard,
  SectionHeader,
  SliderRow,
  TextField,
  ToggleCard,
} from '../../components/ui';
import { highlightTones, iconTileTones } from '../../components/ui/tones';
import { type Translations } from '../../i18n';
import { type Theme } from '../../types/theme';
import { cn } from '../../utils/cn';
import { SettingsPage } from './SettingsPage';
import { AMBIENCE_OPACITY_MIN, useAmbienceOpacity } from '../../hooks/useAmbienceMode';

export interface AppearanceSettingsViewProps {
  loc: Translations;
  buttonGlowEnabled: boolean;
  onToggleGlow: () => void;
  uiScale: number;
  onResetScale: () => void;
  onSelectScale: (scale: number) => void;
  themes: Theme[];
  currentTheme?: Theme | null;
  onSelectTheme: (id: string) => void;
  customBgPath: string;
  onCustomBgPathChange: (path: string) => void;
  themeBgImage: string | null;
  onPickWallpaperFromDisk: () => void;
  onWallpaperDrop: (e: React.DragEvent) => void;
  onUploadBgImage: () => void;
  onRemoveBgImage: () => void;
  onSaveBackgroundSettings: () => void;
  themeOverlay: number;
  onThemeOverlayChange: (val: number) => void;
  themeBlur: number;
  onThemeBlurChange: (val: number) => void;
  appIconStyle: 'lineout' | 'classic';
  onSelectIconStyle: (style: 'lineout' | 'classic') => void;
}

export const AppearanceSettingsView: React.FC<AppearanceSettingsViewProps> = ({
  loc,
  buttonGlowEnabled,
  onToggleGlow,
  uiScale,
  onResetScale,
  onSelectScale,
  themes,
  currentTheme,
  onSelectTheme,
  customBgPath,
  onCustomBgPathChange,
  themeBgImage,
  onPickWallpaperFromDisk,
  onWallpaperDrop,
  onUploadBgImage,
  onRemoveBgImage,
  onSaveBackgroundSettings,
  themeOverlay,
  onThemeOverlayChange,
  themeBlur,
  onThemeBlurChange,
  appIconStyle,
  onSelectIconStyle,
}) => {
  const [ambienceOpacity, setAmbienceOpacity] = useAmbienceOpacity();
  const [isDraggingWallpaper, setIsDraggingWallpaper] = useState<boolean>(false);
  const id = useId();

  const handleInternalDrop = (e: React.DragEvent) => {
    setIsDraggingWallpaper(false);
    onWallpaperDrop(e);
  };

  const setDragging = (dragging: boolean) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWallpaper(dragging);
  };

  const scaleOptions = [
    { scale: 1.0, label: loc.settings.uiScale100Label, desc: loc.settings.uiScale100Desc },
    { scale: 1.1, label: loc.settings.uiScale110Label, desc: loc.settings.uiScale110Desc },
    { scale: 1.2, label: loc.settings.uiScale120Label, desc: loc.settings.uiScale120Desc },
    { scale: 1.3, label: loc.settings.uiScale130Label, desc: loc.settings.uiScale130Desc },
  ];

  const iconStyles = [
    {
      style: 'lineout',
      src: '/icon_lineout.png',
      alt: 'Neon Lineout',
      title: loc.settings.iconStyleLineout,
      desc: loc.settings.iconStyleLineoutDesc,
      tone: 'pink',
    },
    {
      style: 'classic',
      src: '/icon_classic.png',
      alt: 'Classic Anime',
      title: loc.settings.iconStyleClassic,
      desc: loc.settings.iconStyleClassicDesc,
      tone: 'purple',
    },
  ] as const;

  return (
    <SettingsPage title={loc.settings.nav.appearance} icon={<Palette size={22} />} tone="pink">
      {/* Button hover glow */}
      <ToggleCard
        icon={<Sparkles size={20} />}
        tone="pink"
        title={loc.settings.buttonHoverGlowTitle}
        description={loc.settings.buttonHoverGlowDesc}
        checked={buttonGlowEnabled}
        onChange={onToggleGlow}
      />

      {/* UI scale and working width */}
      <Card>
        <SectionHeader
          icon={<Maximize2 size={20} />}
          tone="cyan"
          title={loc.settings.uiScaleLayoutTitle}
          description={loc.settings.uiScaleLayoutDesc}
          actions={
            <Button size="sm" onClick={onResetScale} disabled={uiScale === 1.0}>
              {loc.settings.uiScaleReset}
            </Button>
          }
        />
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(42.5),1fr))] gap-2.5">
          {scaleOptions.map((item) => {
            const isSelected = Math.abs(uiScale - item.scale) < 0.03;
            return (
              <OptionCard
                key={item.scale}
                pressed={isSelected}
                tone="cyan"
                onClick={() => onSelectScale(item.scale)}
                className="px-3.5 py-3"
              >
                <span className="flex w-full items-center justify-between text-sm font-bold">
                  {item.label}
                  {isSelected && <Check size={14} stroke={3} />}
                </span>
                <span className={cn('text-xs', isSelected ? 'text-fg' : 'text-fg-muted')}>{item.desc}</span>
              </OptionCard>
            );
          })}
        </div>
      </Card>

      {/* Anime theme presets */}
      <Card>
        <SectionHeader
          icon={<Palette size={20} />}
          tone="purple"
          title={loc.settings.themes}
          description={loc.settings.themesSubtitle}
        />
        {themes.length > 0 && (
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-3.5">
            {themes.map((th) => {
              const isActive = currentTheme?.id === th.id;
              const swatches = [
                { label: loc.settings.tokenBg, color: th.tokens.bg_deep, bordered: true },
                { label: loc.settings.tokenCard, color: th.tokens.bg_card, bordered: true },
                { label: loc.settings.tokenPink, color: th.tokens.accent_pink, bordered: false },
                { label: loc.settings.tokenPurple, color: th.tokens.accent_purple, bordered: false },
                { label: loc.settings.tokenCyan, color: th.tokens.accent_cyan, bordered: false },
              ];
              return (
                <Card
                  key={th.id}
                  variant="inset"
                  highlight={isActive && 'purple'}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-md font-bold text-fg">{th.name}</h4>
                    {isActive && <Badge tone="purple">{loc.settings.active}</Badge>}
                  </div>
                  <p className="text-ui text-fg-muted">{th.attribution || 'Auralune Theme'}</p>

                  {/* Token colour swatches (runtime theme colours) */}
                  <div className="flex items-center gap-2">
                    {swatches.map((sw) => (
                      <div
                        key={sw.label}
                        title={`${sw.label}: ${sw.color}`}
                        className={cn('size-7 rounded-lg', sw.bordered && 'border border-line')}
                        style={{ background: sw.color }}
                      />
                    ))}
                  </div>

                  <Button
                    variant={isActive ? 'secondary' : 'primary'}
                    onClick={() => onSelectTheme(th.id)}
                    disabled={isActive}
                    className="mt-1 w-full"
                  >
                    {isActive ? loc.settings.active : loc.common.confirm}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Custom anime background */}
      <Card>
        <SectionHeader icon={<ImageIcon size={20} />} tone="cyan" title={loc.settings.appearance} />

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(68),1fr))] gap-6">
          <div className="flex flex-col gap-4">
            {/* Wallpaper drop zone (also opens the file picker) */}
            <button
              type="button"
              onDragOver={setDragging(true)}
              onDragLeave={setDragging(false)}
              onDrop={handleInternalDrop}
              onClick={onPickWallpaperFromDisk}
              className={cn(
                'flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-5 py-6',
                isDraggingWallpaper ? highlightTones.pink : 'border-white/20 bg-black/20',
              )}
            >
              <span
                className={cn(
                  'flex size-11.5 items-center justify-center rounded-full',
                  isDraggingWallpaper ? iconTileTones.pink : iconTileTones.cyan,
                )}
              >
                <UploadCloud size={24} />
              </span>
              <span className="text-center">
                <span className="block text-sm font-semibold text-fg">{loc.settings.dragDropWallpaper}</span>
                <span className="mt-1 block text-xs text-fg-secondary">
                  PNG, JPG, WebP • {loc.settings.customBgDropText}
                </span>
              </span>
            </button>

            <div>
              <FieldLabel htmlFor={`${id}-bg`}>{loc.settings.customBgLabel}</FieldLabel>
              <TextField
                id={`${id}-bg`}
                value={customBgPath}
                onChange={(e) => onCustomBgPathChange(e.target.value)}
                placeholder={loc.settings.customBgPlaceholder}
              />
              <div className="mt-2 flex gap-2 *:flex-1">
                <Button onClick={onPickWallpaperFromDisk} title={loc.settings.chooseWallpaper}>
                  <FolderOpen size={16} className="text-accent-cyan" />
                  {loc.settings.chooseFile}
                </Button>
                <Button variant="tinted" tone="purple" onClick={onUploadBgImage}>
                  <Upload size={16} />
                  {loc.player.load}
                </Button>
              </div>
            </div>

            {themeBgImage && (
              <Card variant="inset" padding="none" className="flex items-center gap-3.5 p-3">
                <div
                  className="h-10.5 w-15 rounded-lg border border-line bg-cover bg-center"
                  style={{ backgroundImage: `url("${themeBgImage}")` }}
                />
                <p className="flex-1 text-sm font-semibold text-fg">{loc.settings.active}</p>
                <Button variant="danger" size="sm" onClick={onRemoveBgImage}>
                  <Trash2 size={14} />
                  {loc.common.remove}
                </Button>
              </Card>
            )}

            <Button variant="primary" onClick={onSaveBackgroundSettings} className="w-full">
              <Save size={16} />
              {loc.common.save}
            </Button>
          </div>

          {/* Overlay and blur sliders */}
          <div className="flex flex-col gap-5">
            <SliderRow
              label={loc.settings.themeOpacity}
              tone="cyan"
              min={0}
              max={0.9}
              step={0.05}
              value={themeOverlay}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={onThemeOverlayChange}
            />
            <SliderRow
              label={loc.settings.ambienceOpacity}
              tone="pink"
              min={AMBIENCE_OPACITY_MIN}
              max={1}
              step={0.05}
              value={ambienceOpacity}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={setAmbienceOpacity}
            />
            <div>
              <SliderRow
                label={loc.settings.themeBlur}
                tone="purple"
                min={0}
                max={30}
                step={1}
                value={themeBlur}
                format={(v) => `${v} px`}
                onChange={onThemeBlurChange}
              />
              <p className="mt-1.5 text-xs text-fg-muted">{loc.settings.blurHelp}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* App icon style (Neon Lineout vs Classic Anime) */}
      <Card>
        <SectionHeader
          icon={<Sparkles size={20} />}
          tone="pink"
          title={loc.settings.appIconTitle}
          description={loc.settings.appIconDesc}
        />
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-3.5">
          {iconStyles.map((opt) => {
            const isActive = appIconStyle === opt.style;
            return (
              <OptionCard
                key={opt.style}
                pressed={isActive}
                tone={opt.tone}
                onClick={() => onSelectIconStyle(opt.style)}
                className="flex-row items-center gap-4 aria-pressed:text-fg"
              >
                <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-line bg-black/45">
                  <img src={opt.src} alt={opt.alt} className="size-12 rounded-xl object-contain" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold">{opt.title}</span>
                    {isActive && <Badge tone={opt.tone}>{loc.settings.active}</Badge>}
                  </span>
                  <span className="mt-1 block text-ui leading-snug text-fg-muted">{opt.desc}</span>
                </span>
              </OptionCard>
            );
          })}
        </div>
      </Card>

    </SettingsPage>
  );
};
