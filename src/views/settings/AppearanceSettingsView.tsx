import React, { useId, useState } from 'react';
import { Check, FolderOpen, Palette, Save, Trash2, Upload, UploadCloud } from '../../components/ui/icons';
import {
  Badge,
  Button,
  OptionCard,
  SegmentedControl,
  SettingRow,
  SettingsGroup,
  SliderRow,
  TextField,
} from '../../components/ui';
import { highlightTones, iconTileTones } from '../../components/ui/tones';
import { type Translations } from '../../i18n';
import { type Theme } from '../../types/theme';
import { cn } from '../../utils/cn';
import { SettingsPage } from './SettingsPage';
import { ToggleRow } from './ToggleRow';
import { AMBIENCE_OPACITY_MIN, useAmbienceOpacity } from '../../hooks/useAmbienceMode';
import { SURFACE_OPACITY_MIN, useSurfaceOpacity } from '../../hooks/useThemeManager';

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
  const [surfaceOpacity, setSurfaceOpacity] = useSurfaceOpacity();
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
  const selectedScale = scaleOptions.find((item) => Math.abs(uiScale - item.scale) < 0.03);

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
      {/* Anime theme presets */}
      <SettingsGroup label={loc.settings.themes} description={loc.settings.themesSubtitle}>
        {themes.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(44),1fr))] gap-2 p-3">
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
                <OptionCard
                  key={th.id}
                  pressed={isActive}
                  tone="pink"
                  onClick={() => onSelectTheme(th.id)}
                  className={cn(
                    'min-w-0 gap-2 overflow-hidden px-3 py-2.5',
                    isActive && 'shadow-halo shadow-accent-pink/25',
                  )}
                >
                  <span className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-fg">{th.name}</span>
                    {isActive && <Badge tone="pink">{loc.settings.themeCurrent}</Badge>}
                  </span>
                  <span className="w-full text-xs leading-snug text-fg-muted">
                    {th.attribution || 'Auralune Theme'}
                  </span>
                  {/* Token colour swatches (runtime theme colours) */}
                  <span className="mt-auto flex items-center gap-1.5 pt-1">
                    {swatches.map((sw) => (
                      <span
                        key={sw.label}
                        title={`${sw.label}: ${sw.color}`}
                        className={cn('size-5 rounded-md', sw.bordered && 'border border-line')}
                        style={{ background: sw.color }}
                      />
                    ))}
                  </span>
                </OptionCard>
              );
            })}
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup label={loc.settings.group.interface}>
        {/* UI scale and working width */}
        <SettingRow
          compact
          title={loc.settings.uiScaleLayoutTitle}
          description={loc.settings.uiScaleLayoutDesc}
          control={
            <Button variant="ghost" size="sm" onClick={onResetScale} disabled={uiScale === 1.0}>
              {loc.settings.uiScaleReset}
            </Button>
          }
        >
          <SegmentedControl
            size="sm"
            tone="cyan"
            label={loc.settings.uiScaleLayoutTitle}
            items={scaleOptions.map((item) => ({ value: String(item.scale), label: item.label }))}
            value={selectedScale ? String(selectedScale.scale) : ''}
            onChange={(v) => onSelectScale(Number(v))}
            className="flex-wrap"
          />
          {selectedScale && <p className="mt-2 text-xs text-fg-muted">{selectedScale.desc}</p>}
        </SettingRow>

        {/* Button hover glow */}
        <ToggleRow
          title={loc.settings.buttonHoverGlowTitle}
          description={loc.settings.buttonHoverGlowDesc}
          checked={buttonGlowEnabled}
          onChange={onToggleGlow}
        />

        {/* App icon style (Neon Lineout vs Classic Anime) */}
        <SettingRow compact title={loc.settings.appIconTitle} description={loc.settings.appIconDesc}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(56),1fr))] gap-2">
            {iconStyles.map((opt) => {
              const isActive = appIconStyle === opt.style;
              return (
                <OptionCard
                  key={opt.style}
                  pressed={isActive}
                  tone={opt.tone}
                  onClick={() => onSelectIconStyle(opt.style)}
                  className="flex-row items-center gap-3 px-3 py-2.5 aria-pressed:text-fg"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-black/45">
                    <img src={opt.src} alt={opt.alt} className="size-9 rounded-lg object-contain" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{opt.title}</span>
                      {isActive && <Check size={14} stroke={3} />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{opt.desc}</span>
                  </span>
                </OptionCard>
              );
            })}
          </div>
        </SettingRow>
      </SettingsGroup>

      {/* Custom anime background */}
      <SettingsGroup label={loc.settings.group.background}>
        <SettingRow compact title={loc.settings.customBgLabel} htmlFor={`${id}-bg`}>
          <div className="flex flex-col gap-3">
            {/* Wallpaper drop zone (also opens the file picker) */}
            <button
              type="button"
              onDragOver={setDragging(true)}
              onDragLeave={setDragging(false)}
              onDrop={handleInternalDrop}
              onClick={onPickWallpaperFromDisk}
              className={cn(
                'flex items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-4',
                isDraggingWallpaper ? highlightTones.pink : 'border-white/20 bg-black/20',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  isDraggingWallpaper ? iconTileTones.pink : iconTileTones.cyan,
                )}
              >
                <UploadCloud size={20} />
              </span>
              <span className="text-left">
                <span className="block text-ui font-semibold text-fg">{loc.settings.dragDropWallpaper}</span>
                <span className="block text-xs text-fg-secondary">PNG, JPG, WebP • {loc.settings.customBgDropText}</span>
              </span>
            </button>

            <TextField
              id={`${id}-bg`}
              value={customBgPath}
              onChange={(e) => onCustomBgPathChange(e.target.value)}
              placeholder={loc.settings.customBgPlaceholder}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onPickWallpaperFromDisk} title={loc.settings.chooseWallpaper}>
                <FolderOpen size={16} className="text-accent-cyan" />
                {loc.settings.chooseFile}
              </Button>
              <Button onClick={onUploadBgImage}>
                <Upload size={16} />
                {loc.player.load}
              </Button>
            </div>

            {/* Preview of the wallpaper in use */}
            {themeBgImage && (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-black/20 p-2.5">
                <div
                  className="h-12 w-20 shrink-0 rounded-lg border border-line bg-cover bg-center"
                  style={{ backgroundImage: `url("${themeBgImage}")` }}
                />
                <p className="flex-1 text-ui font-semibold text-fg">{loc.settings.active}</p>
                <Button variant="danger" size="sm" onClick={onRemoveBgImage}>
                  <Trash2 size={14} />
                  {loc.common.remove}
                </Button>
              </div>
            )}
          </div>
        </SettingRow>

        {/* Overlay, ambience and blur sliders */}
        <div className="flex flex-col gap-5 px-4 py-3">
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
            label={loc.settings.cardOpacity}
            tone="amber"
            min={SURFACE_OPACITY_MIN}
            max={1}
            step={0.05}
            value={surfaceOpacity}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setSurfaceOpacity}
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

        <div className="flex justify-end px-4 py-3">
          <Button variant="primary" onClick={onSaveBackgroundSettings}>
            <Save size={16} />
            {loc.common.save}
          </Button>
        </div>
      </SettingsGroup>
    </SettingsPage>
  );
};
