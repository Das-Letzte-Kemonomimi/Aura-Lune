import React, { useState } from 'react';
import {
  Globe,
  Sparkles,
  Maximize2,
  Palette,
  Image as ImageIcon,
  UploadCloud,
  FolderOpen,
  Upload,
  Trash2,
  Save,
  Download,
  Check,
  Copy,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import { LanguageSelector } from '../../components/LanguageSelector';
import { type Theme } from '../../types/theme';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Wybór języka interfejsu w ustawieniach */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} color="var(--accent-cyan)" /> {loc.settings.language}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            English • Polski • Deutsch • Suomi • Latina
          </p>
        </div>
        <LanguageSelector currentLang={language} onLanguageChange={onLanguageChange} />
      </div>

      {/* Opcja podświetlenia kursorowego przycisków (Hover Glow) */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-pink)" /> {loc.settings.buttonHoverGlowTitle}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {loc.settings.buttonHoverGlowDesc}
          </p>
        </div>
        <button
          onClick={onToggleGlow}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: buttonGlowEnabled ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: buttonGlowEnabled ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            color: buttonGlowEnabled ? 'var(--accent-pink)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          {buttonGlowEnabled
            ? loc.settings.buttonHoverGlowEnabled
            : loc.settings.buttonHoverGlowDisabled}
        </button>
      </div>

      {/* Skala interfejsu i szerokość robocza (UI Scale & Layout Width) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Maximize2 size={18} color="var(--accent-cyan)" /> {loc.settings.uiScaleLayoutTitle}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {loc.settings.uiScaleLayoutDesc}
            </p>
          </div>
          <button
            onClick={onResetScale}
            disabled={uiScale === 1.0}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: uiScale === 1.0 ? 'default' : 'pointer',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: uiScale === 1.0 ? 'var(--text-muted)' : 'var(--text-main)',
              opacity: uiScale === 1.0 ? 0.5 : 1,
            }}
          >
            {loc.settings.uiScaleReset}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
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
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  gap: '4px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? 'var(--accent-cyan)' : 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 12px rgba(6, 182, 212, 0.25)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.label}</span>
                  {isSelected && <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>✓</span>}
                </div>
                <span style={{ fontSize: '0.72rem', color: isSelected ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Palette size={26} color="var(--accent-purple)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {loc.settings.themes}
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          {loc.settings.themesSubtitle}
        </p>
      </div>

      {/* Siatka presetów Anime */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {themes.map((th) => {
          const isActive = currentTheme?.id === th.id;
          return (
            <div
              key={th.id}
              className="glass-card"
              style={{
                padding: '20px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: isActive ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                background: isActive ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {th.name}
                </h3>
                {isActive && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '20px',
                      background: 'var(--accent-purple)',
                      color: '#fff',
                    }}
                  >
                    {loc.settings.active}
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {th.attribution || 'Auralune Theme'}
              </p>

              {/* Próbnik kolorów tokenów */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <div
                  title={`${loc.settings.tokenBg}: ${th.tokens.bg_deep}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.bg_deep,
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <div
                  title={`${loc.settings.tokenCard}: ${th.tokens.bg_card}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.bg_card,
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <div
                  title={`${loc.settings.tokenPink}: ${th.tokens.accent_pink}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.accent_pink,
                  }}
                />
                <div
                  title={`${loc.settings.tokenPurple}: ${th.tokens.accent_purple}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.accent_purple,
                  }}
                />
                <div
                  title={`${loc.settings.tokenCyan}: ${th.tokens.accent_cyan}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: th.tokens.accent_cyan,
                  }}
                />
              </div>

              <button
                onClick={() => onSelectTheme(th.id)}
                disabled={isActive}
                style={{
                  marginTop: '8px',
                  padding: '10px',
                  borderRadius: '10px',
                  background: isActive
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: isActive ? 'var(--text-muted)' : '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {isActive ? loc.settings.active : loc.common.confirm}
              </button>
            </div>
          );
        })}
      </div>

      {/* Menedżer własnego tła anime */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ImageIcon size={22} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {loc.settings.appearance}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Strefa Drag & Drop dla tapety */}
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
              style={{
                padding: '24px 20px',
                borderRadius: '14px',
                border: isDraggingWallpaper
                  ? '2px dashed var(--accent-pink)'
                  : '2px dashed rgba(255, 255, 255, 0.2)',
                background: isDraggingWallpaper
                  ? 'rgba(236, 72, 153, 0.15)'
                  : 'rgba(0, 0, 0, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: isDraggingWallpaper ? '0 0 20px rgba(236, 72, 153, 0.35)' : 'none',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: isDraggingWallpaper
                    ? 'rgba(236, 72, 153, 0.25)'
                    : 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDraggingWallpaper ? 'var(--accent-pink)' : 'var(--accent-cyan)',
                }}
              >
                <UploadCloud size={24} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                  {loc.settings.dragDropWallpaper}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  PNG, JPG, WebP • {loc.settings.customBgDropText}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {loc.settings.customBgLabel}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={customBgPath}
                  onChange={(e) => onCustomBgPathChange(e.target.value)}
                  placeholder={loc.settings.customBgPlaceholder}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  type="button"
                  onClick={onPickWallpaperFromDisk}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(168, 85, 247, 0.25))',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title={loc.settings.chooseWallpaper}
                >
                  <FolderOpen size={16} color="var(--accent-cyan)" />
                  {loc.settings.chooseFile}
                </button>
                <button
                  type="button"
                  onClick={onUploadBgImage}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: 'var(--accent-purple)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Upload size={16} />
                  {loc.player.load}
                </button>
              </div>
            </div>

            {themeBgImage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '12px' }}>
                <div
                  style={{
                    width: '60px',
                    height: '42px',
                    borderRadius: '8px',
                    backgroundImage: `url("${themeBgImage}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {loc.settings.active}
                  </p>
                </div>
                <button
                  onClick={onRemoveBgImage}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(244, 63, 94, 0.2)',
                    color: 'var(--accent-pink)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={14} />
                  {loc.common.remove}
                </button>
              </div>
            )}

            <button
              onClick={onSaveBackgroundSettings}
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Save size={16} />
              {loc.common.save}
            </button>
          </div>

          {/* Suwaki Overlay i Blur */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {loc.settings.themeOpacity}:
                </label>
                <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
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
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {loc.settings.themeBlur}:
                </label>
                <strong style={{ color: 'var(--accent-purple)', fontSize: '0.9rem' }}>
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
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {loc.settings.blurHelp}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Wybór stylu ikony aplikacji (Neon Lineout vs Classic Anime) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Sparkles size={22} color="var(--accent-pink)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {loc.settings.appIconTitle}
          </h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
          {loc.settings.appIconDesc}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Opcja 1: Neon Lineout */}
          <div
            onClick={() => onSelectIconStyle('lineout')}
            className="glass-card"
            style={{
              padding: '16px',
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: appIconStyle === 'lineout' ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
              boxShadow: appIconStyle === 'lineout' ? '0 0 18px rgba(236, 72, 153, 0.35)' : 'none',
              background: appIconStyle === 'lineout' ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
              transition: 'all 0.25s ease',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '14px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src="/icon_lineout.png"
                alt="Neon Lineout"
                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {loc.settings.iconStyleLineout}
                </h4>
                {appIconStyle === 'lineout' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'var(--accent-pink)',
                      color: '#fff',
                    }}
                  >
                    {loc.settings.active}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                {loc.settings.iconStyleLineoutDesc}
              </p>
            </div>
          </div>

          {/* Opcja 2: Classic Anime */}
          <div
            onClick={() => onSelectIconStyle('classic')}
            className="glass-card"
            style={{
              padding: '16px',
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: appIconStyle === 'classic' ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
              boxShadow: appIconStyle === 'classic' ? '0 0 18px rgba(168, 85, 247, 0.35)' : 'none',
              background: appIconStyle === 'classic' ? 'var(--bg-surface-hover)' : 'var(--bg-card)',
              transition: 'all 0.25s ease',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '14px',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src="/icon_classic.png"
                alt="Classic Anime"
                style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '10px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {loc.settings.iconStyleClassic}
                </h4>
                {appIconStyle === 'classic' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'var(--accent-purple)',
                      color: '#fff',
                    }}
                  >
                    {loc.settings.active}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                {loc.settings.iconStyleClassicDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bezpieczny Import i Eksport JSON */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Download size={22} color="var(--accent-pink)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {loc.settings.themePortability}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Eksport */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {loc.settings.exportTheme}:
              </label>
              <button
                onClick={onExportTheme}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--accent-purple)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {loc.settings.generateJson}
              </button>
            </div>
            <textarea
              readOnly
              value={jsonExportContent}
              placeholder={loc.settings.generateJsonPlaceholder}
              rows={6}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-cyan)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                resize: 'none',
              }}
            />
            {jsonExportContent && (
              <button
                onClick={handleCopyJson}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {copiedJson ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedJson ? loc.settings.copiedJson : loc.settings.copyJson}
              </button>
            )}
          </div>

          {/* Import */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {loc.settings.importTheme}:
            </label>
            <textarea
              value={jsonImportContent}
              onChange={(e) => onJsonImportContentChange(e.target.value)}
              placeholder={loc.settings.importPlaceholder}
              rows={6}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                resize: 'none',
              }}
            />
            <button
              onClick={onImportTheme}
              style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
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
