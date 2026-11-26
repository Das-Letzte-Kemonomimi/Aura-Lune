import React, { useState } from 'react';
import { Globe, Sparkles, Maximize2, Palette, Image as ImageIcon, UploadCloud, FolderOpen, Upload, Trash2, Save, Download, Check, Copy } from '../../components/ui/icons';
import { type Language, type Translations } from '../../i18n';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { type Theme } from '../../types/theme';
import { cn } from '../../utils/cn';

export interface ThemesSettingsViewProps {
  language: Language;
  loc: Translations;
  onLanguageChange: (lang: Language) => void;
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
  jsonExportContent: string;
  onExportTheme: () => void;
  jsonImportContent: string;
  onJsonImportContentChange: (content: string) => void;
  onImportTheme: () => void;
}

export const ThemesSettingsView: React.FC<ThemesSettingsViewProps> = ({
  language,
  loc,
  onLanguageChange,
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
  jsonExportContent,
  onExportTheme,
  jsonImportContent,
  onJsonImportContentChange,
  onImportTheme,
}) => {
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [isDraggingWallpaper, setIsDraggingWallpaper] = useState<boolean>(false);

  const handleCopyJson = () => {
    if (!jsonExportContent) return;
    navigator.clipboard.writeText(jsonExportContent);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleInternalDrop = (e: React.DragEvent) => {
    setIsDraggingWallpaper(false);
    onWallpaperDrop(e);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* UI language choice */}
      <div className="glass-panel flex items-center justify-between p-5">
        <div>
          <h3 className="m-0 flex items-center gap-2 text-base font-bold">
            <Globe size={18} className="text-accent-cyan" /> {loc.settings.language}
          </h3>
          <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
            English • Polski • Deutsch • Suomi • Latina
          </p>
        </div>
        <LanguageSelector currentLang={language} onLanguageChange={onLanguageChange} />
      </div>

      {/* Button hover glow option */}
      <div className="glass-panel flex items-center justify-between p-5">
        <div>
          <h3 className="m-0 flex items-center gap-2 text-base font-bold">
            <Sparkles size={18} className="text-accent-pink" /> {loc.settings.buttonHoverGlowTitle}
          </h3>
          <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
            {loc.settings.buttonHoverGlowDesc}
          </p>
        </div>
        <button
          onClick={onToggleGlow}
          className={cn(
            'rounded-xl border px-4.5 py-2 text-ui font-bold transition-all duration-150',
            buttonGlowEnabled ? 'bg-pink-500/25' : 'bg-white/6',
            buttonGlowEnabled ? 'border-accent-pink' : 'border-line',
            buttonGlowEnabled ? 'text-accent-pink' : 'text-fg-muted',
          )}
        >
          {buttonGlowEnabled
            ? loc.settings.buttonHoverGlowEnabled
            : loc.settings.buttonHoverGlowDisabled}
        </button>
      </div>

      {/* UI scale and working width */}
      <div className="glass-panel p-5">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="m-0 flex items-center gap-2 text-base font-bold">
              <Maximize2 size={18} className="text-accent-cyan" /> {loc.settings.uiScaleLayoutTitle}
            </h3>
            <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
              {loc.settings.uiScaleLayoutDesc}
            </p>
          </div>
          <button
            onClick={onResetScale}
            disabled={uiScale === 1.0}
            className={cn(
              'rounded-lg border border-line bg-white/5 px-3 py-1.5 text-ui font-semibold',
              uiScale === 1.0 ? 'cursor-default' : 'cursor-pointer',
              uiScale === 1.0 ? 'text-fg-muted' : 'text-fg',
              uiScale === 1.0 ? 'opacity-50' : 'opacity-100',
            )}
          >
            {loc.settings.uiScaleReset}
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(42.5),1fr))] gap-2.5">
          {[
            {
              scale: 1.0,
              label: loc.settings.uiScale100Label,
              desc: loc.settings.uiScale100Desc,
            },
            {
              scale: 1.10,
              label: loc.settings.uiScale110Label,
              desc: loc.settings.uiScale110Desc,
            },
            {
              scale: 1.20,
              label: loc.settings.uiScale120Label,
              desc: loc.settings.uiScale120Desc,
            },
            {
              scale: 1.30,
              label: loc.settings.uiScale130Label,
              desc: loc.settings.uiScale130Desc,
            },
          ].map((item) => {
            const isSelected = Math.abs(uiScale - item.scale) < 0.03;
            return (
              <button
                key={item.scale}
                onClick={() => onSelectScale(item.scale)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-all duration-150',
                  isSelected ? 'border-accent-cyan' : 'border-line',
                  isSelected ? 'bg-accent-cyan/20' : 'bg-white/3',
                  isSelected ? 'text-accent-cyan' : 'text-fg',
                  isSelected ? 'shadow-halo shadow-accent-cyan/25' : 'shadow-none',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-bold">{item.label}</span>
                  {isSelected && <Check size={14} stroke={3} />}
                </div>
                <span className={cn('text-xs', isSelected ? 'text-fg' : 'text-fg-muted')}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="mb-2 flex items-center gap-3">
          <Palette size={26} className="text-accent-purple" />
          <h2 className="text-xl font-bold">
            {loc.settings.themes}
          </h2>
        </div>
        <p className="text-sm text-fg-secondary">
          {loc.settings.themesSubtitle}
        </p>
      </div>

      {/* Anime preset grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-4">
        {themes.map((th) => {
          const isActive = currentTheme?.id === th.id;
          return (
            <div
              key={th.id}
              className={cn(
                'glass-card flex flex-col gap-3 rounded-2xl p-5',
                isActive ? 'border-2 border-accent-purple' : 'border border-line',
                isActive ? 'shadow-accent-glow' : 'shadow-none',
                isActive ? 'bg-surface-hover' : 'bg-card',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-fg">
                  {th.name}
                </h3>
                {isActive && (
                  <span className="rounded-3xl bg-accent-purple px-2 py-1 text-xs font-bold text-on-accent">
                    {loc.settings.active}
                  </span>
                )}
              </div>

              <p className="text-ui text-fg-muted">
                {th.attribution || 'Auralune Theme'}
              </p>

              {/* Token colour swatches */}
              <div className="mt-1 flex items-center gap-2">
                <div
                  title={`${loc.settings.tokenBg}: ${th.tokens.bg_deep}`}
                  className="h-7 w-7 rounded-lg border border-line"
                  style={{ background: th.tokens.bg_deep }}
                />
                <div
                  title={`${loc.settings.tokenCard}: ${th.tokens.bg_card}`}
                  className="h-7 w-7 rounded-lg border border-line"
                  style={{ background: th.tokens.bg_card }}
                />
                <div
                  title={`${loc.settings.tokenPink}: ${th.tokens.accent_pink}`}
                  className="h-7 w-7 rounded-lg"
                  style={{ background: th.tokens.accent_pink }}
                />
                <div
                  title={`${loc.settings.tokenPurple}: ${th.tokens.accent_purple}`}
                  className="h-7 w-7 rounded-lg"
                  style={{ background: th.tokens.accent_purple }}
                />
                <div
                  title={`${loc.settings.tokenCyan}: ${th.tokens.accent_cyan}`}
                  className="h-7 w-7 rounded-lg"
                  style={{ background: th.tokens.accent_cyan }}
                />
              </div>

              <button
                onClick={() => onSelectTheme(th.id)}
                disabled={isActive}
                className={cn(
                  'mt-2 rounded-xl p-2.5 text-sm font-semibold',
                  isActive ? 'bg-white/6' : 'bg-accent-gradient',
                  isActive ? 'text-fg-muted' : 'text-fg',
                )}
              >
                {isActive ? loc.settings.active : loc.common.confirm}
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom anime background manager */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <ImageIcon size={22} className="text-accent-cyan" />
          <h3 className="text-lg font-bold">
            {loc.settings.appearance}
          </h3>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-6">
          <div className="flex flex-col gap-4">
            {/* Wallpaper drag & drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingWallpaper(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingWallpaper(false);
              }}
              onDrop={handleInternalDrop}
              onClick={onPickWallpaperFromDisk}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-5 py-6 transition-all duration-200',
                isDraggingWallpaper ? 'border-accent-pink' : 'border-white/20',
                isDraggingWallpaper ? 'bg-pink-500/15' : 'bg-black/20',
                isDraggingWallpaper ? 'shadow-halo-lg shadow-pink-500/35' : 'shadow-none',
              )}
            >
              <div
                className={cn(
                  'flex h-11.5 w-11.5 items-center justify-center rounded-full',
                  isDraggingWallpaper ? 'bg-pink-500/25' : 'bg-white/6',
                  isDraggingWallpaper ? 'text-accent-pink' : 'text-accent-cyan',
                )}
              >
                <UploadCloud size={24} />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-fg">
                  {loc.settings.dragDropWallpaper}
                </div>
                <div className="mt-1 text-xs text-fg-secondary">
                  PNG, JPG, WebP • {loc.settings.customBgDropText}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-fg-secondary">
                {loc.settings.customBgLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customBgPath}
                  onChange={(e) => onCustomBgPathChange(e.target.value)}
                  placeholder={loc.settings.customBgPlaceholder}
                  className="flex-1 rounded-xl border border-line bg-black/30 px-3.5 py-2.5 text-sm text-fg"
                />
                <button
                  type="button"
                  onClick={onPickWallpaperFromDisk}
                  className="flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-linear-135 from-sky-400/25 to-accent-purple/25 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-fg"
                  title={loc.settings.chooseWallpaper}
                >
                  <FolderOpen size={16} className="text-accent-cyan" />
                  {loc.settings.chooseFile}
                </button>
                <button
                  type="button"
                  onClick={onUploadBgImage}
                  className="flex items-center gap-1.5 rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-on-accent"
                >
                  <Upload size={16} />
                  {loc.player.load}
                </button>
              </div>
            </div>

            {themeBgImage && (
              <div className="flex items-center gap-3.5 rounded-xl bg-black/25 p-3">
                <div
                  className="h-10.5 w-15 rounded-lg border border-line bg-cover bg-center"
                  style={{ backgroundImage: `url("${themeBgImage}")` }}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-fg">
                    {loc.settings.active}
                  </p>
                </div>
                <button
                  onClick={onRemoveBgImage}
                  className="flex items-center gap-1 rounded-lg bg-accent-pink/20 px-3 py-2 text-ui text-accent-pink"
                >
                  <Trash2 size={14} />
                  {loc.common.remove}
                </button>
              </div>
            )}

            <button
              onClick={onSaveBackgroundSettings}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent-gradient p-3 text-sm font-bold text-on-accent shadow-accent-glow"
            >
              <Save size={16} />
              {loc.common.save}
            </button>
          </div>

          {/* Overlay and blur sliders */}
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex justify-between">
                <label className="text-sm text-fg-secondary">
                  {loc.settings.themeOpacity}:
                </label>
                <strong className="text-sm text-accent-cyan">
                  {Math.round(themeOverlay * 100)}%
                </strong>
              </div>
              <input
                type="range"
                min={0.0}
                max={0.9}
                step={0.05}
                value={themeOverlay}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onThemeOverlayChange(val);
                }}
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-2 flex justify-between">
                <label className="text-sm text-fg-secondary">
                  {loc.settings.themeBlur}:
                </label>
                <strong className="text-sm text-accent-purple">
                  {themeBlur} px
                </strong>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={themeBlur}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onThemeBlurChange(val);
                }}
                className="w-full"
              />
              <p className="mt-1.5 text-xs text-fg-muted">
                {loc.settings.blurHelp}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* App icon style (Neon Lineout vs Classic Anime) */}
      <div className="glass-panel p-6">
        <div className="mb-2 flex items-center gap-2.5">
          <Sparkles size={22} className="text-accent-pink" />
          <h3 className="text-lg font-bold">
            {loc.settings.appIconTitle}
          </h3>
        </div>
        <p className="mx-0 mt-0 mb-4 text-sm text-fg-secondary">
          {loc.settings.appIconDesc}
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-4">
          {/* Option 1: Neon Lineout */}
          <div
            onClick={() => onSelectIconStyle('lineout')}
            className={cn(
              'glass-card flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-all duration-200',
              appIconStyle === 'lineout' ? 'border-2 border-accent-pink' : 'border border-line',
              appIconStyle === 'lineout' ? 'shadow-halo-lg shadow-pink-500/35' : 'shadow-none',
              appIconStyle === 'lineout' ? 'bg-surface-hover' : 'bg-card',
            )}
          >
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-black/45 shadow-lift shadow-black/30"
            >
              <img
                src="/icon_lineout.png"
                alt="Neon Lineout"
                className="h-12 w-12 object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="m-0 text-base font-bold text-fg">
                  {loc.settings.iconStyleLineout}
                </h4>
                {appIconStyle === 'lineout' && (
                  <span className="rounded-xl bg-accent-pink px-2 py-0.5 text-xs font-bold text-on-accent">
                    {loc.settings.active}
                  </span>
                )}
              </div>
              <p className="mx-0 mt-1 mb-0 text-ui leading-snug text-fg-muted">
                {loc.settings.iconStyleLineoutDesc}
              </p>
            </div>
          </div>

          {/* Option 2: Classic Anime */}
          <div
            onClick={() => onSelectIconStyle('classic')}
            className={cn(
              'glass-card flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-all duration-200',
              appIconStyle === 'classic' ? 'border-2 border-accent-purple' : 'border border-line',
              appIconStyle === 'classic' ? 'shadow-halo-lg shadow-accent-purple/35' : 'shadow-none',
              appIconStyle === 'classic' ? 'bg-surface-hover' : 'bg-card',
            )}
          >
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-black/45 shadow-lift shadow-black/30"
            >
              <img
                src="/icon_classic.png"
                alt="Classic Anime"
                className="h-12 w-12 rounded-xl object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="m-0 text-base font-bold text-fg">
                  {loc.settings.iconStyleClassic}
                </h4>
                {appIconStyle === 'classic' && (
                  <span className="rounded-xl bg-accent-purple px-2 py-0.5 text-xs font-bold text-on-accent">
                    {loc.settings.active}
                  </span>
                )}
              </div>
              <p className="mx-0 mt-1 mb-0 text-ui leading-snug text-fg-muted">
                {loc.settings.iconStyleClassicDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Safe JSON import and export */}
      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <Download size={22} className="text-accent-pink" />
          <h3 className="text-lg font-bold">
            {loc.settings.themePortability}
          </h3>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-5">
          {/* Export */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-fg-secondary">
                {loc.settings.exportTheme}:
              </label>
              <button
                onClick={onExportTheme}
                className="rounded-lg bg-accent-purple px-3 py-1.5 text-xs font-semibold text-on-accent"
              >
                {loc.settings.generateJson}
              </button>
            </div>
            <textarea
              readOnly
              value={jsonExportContent}
              placeholder={loc.settings.generateJsonPlaceholder}
              rows={6}
              className="w-full resize-none rounded-xl border border-line bg-black/30 p-2.5 font-mono text-xs text-accent-cyan"
            />
            {jsonExportContent && (
              <button
                onClick={handleCopyJson}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white/8 px-3 py-2 text-ui text-fg"
              >
                {copiedJson ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                {copiedJson ? loc.settings.copiedJson : loc.settings.copyJson}
              </button>
            )}
          </div>

          {/* Import */}
          <div className="flex flex-col gap-2.5">
            <label className="text-sm text-fg-secondary">
              {loc.settings.importTheme}:
            </label>
            <textarea
              value={jsonImportContent}
              onChange={(e) => onJsonImportContentChange(e.target.value)}
              placeholder={loc.settings.importPlaceholder}
              rows={6}
              className="w-full resize-none rounded-xl border border-line bg-black/30 p-2.5 font-mono text-xs text-fg"
            />
            <button
              onClick={onImportTheme}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-accent-gradient p-2.5 text-sm font-semibold text-on-accent"
            >
              <Upload size={16} />
              {loc.settings.verifyImport}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
