import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Theme } from '../types/theme';

export interface UseThemeEngineProps {
  onNotify?: (message: string, isError?: boolean) => void;
}

export function useThemeEngine({ onNotify }: UseThemeEngineProps = {}) {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeOverlay, setThemeOverlay] = useState<number>(0.4);
  const [themeBlur, setThemeBlur] = useState<number>(20);
  const [themeBgImage, setThemeBgImage] = useState<string | null>(null);
  const [customBgPath, setCustomBgPath] = useState('');
  const [isDraggingWallpaper, setIsDraggingWallpaper] = useState(false);
  const [appIconStyle, setAppIconStyle] = useState<'lineout' | 'classic'>('lineout');
  const [jsonExportContent, setJsonExportContent] = useState('');
  const [jsonImportContent, setJsonImportContent] = useState('');

  const notify = useCallback(
    (msg: string, isError = false) => {
      if (onNotify) {
        onNotify(msg, isError);
      }
    },
    [onNotify]
  );

  const applyThemeToDom = useCallback((theme: Theme | null) => {
    if (!theme) return;

    const root = document.documentElement;
    const t = theme.tokens;

    root.style.setProperty('--bg-deep', t.bg_deep);
    root.style.setProperty('--bg-surface', t.bg_surface);
    root.style.setProperty('--bg-surface-hover', t.bg_surface_hover);
    root.style.setProperty('--bg-card', t.bg_card);
    root.style.setProperty('--border-subtle', t.border_subtle);
    root.style.setProperty('--border-accent', t.border_accent);
    root.style.setProperty('--accent-pink', t.accent_pink);
    root.style.setProperty('--accent-purple', t.accent_purple);
    root.style.setProperty('--accent-cyan', t.accent_cyan);
    root.style.setProperty('--accent-green', t.accent_green);
    root.style.setProperty('--accent-amber', t.accent_amber);
    root.style.setProperty('--text-primary', t.text_primary);
    root.style.setProperty('--text-secondary', t.text_secondary);
    root.style.setProperty('--text-muted', t.text_muted);
    root.style.setProperty('--shadow-glow', t.shadow_glow);
    root.style.setProperty('--shadow-card', t.shadow_card);

    root.style.setProperty('--bg-overlay', `${theme.overlay_opacity}`);
    root.style.setProperty('--bg-blur', `${theme.blur_radius}px`);

    setThemeOverlay(theme.overlay_opacity);
    setThemeBlur(theme.blur_radius);
    setThemeBgImage(theme.background_ref);
    setCurrentTheme(theme);
  }, []);

  const loadThemes = useCallback(async () => {
    try {
      const active = await invoke<Theme>('get_active_theme');
      applyThemeToDom(active);
      const all = await invoke<Theme[]>('list_themes');
      setThemes(all);

      const st = await invoke<string>('get_app_icon_style').catch(() => 'lineout');
      setAppIconStyle(st === 'classic' ? 'classic' : 'lineout');
    } catch (e: unknown) {
      console.warn('Error loading themes:', e);
    }
  }, [applyThemeToDom]);

  const handleSelectTheme = useCallback(
    async (themeId: string) => {
      if (!themeId) return;
      try {
        const th = await invoke<Theme>('set_active_theme', { themeId });
        applyThemeToDom(th);
        notify(`Motyw "${th.name}" został aktywowany`);
      } catch (e: unknown) {
        notify(`Błąd: ${e}`, true);
      }
    },
    [applyThemeToDom, notify]
  );

  const handleSelectIconStyle = useCallback(
    async (style: 'lineout' | 'classic') => {
      try {
        const applied = await invoke<string>('set_app_icon_style', { style });
        const clean = applied === 'classic' ? 'classic' : 'lineout';
        setAppIconStyle(clean);
        notify(`Styl ikony zmieniony na: ${clean}`);
      } catch (e: unknown) {
        notify(`Błąd: ${e}`, true);
      }
    },
    [notify]
  );

  const applyWallpaperFromPath = useCallback(
    async (filePath: string) => {
      if (!filePath.trim()) return;
      try {
        setCustomBgPath(filePath);
        const dataUri = await invoke<string>('upload_background_image', { filePath: filePath.trim() });
        setThemeBgImage(dataUri);

        if (!currentTheme) return;

        const updated = await invoke<Theme>('update_theme_background', {
          themeId: currentTheme.id,
          backgroundRef: dataUri,
          overlayOpacity: themeOverlay,
          blurRadius: themeBlur,
        });
        applyThemeToDom(updated);
        await loadThemes();
        notify('Tapeta tła została zaktualizowana');
      } catch (e: unknown) {
        notify(`Błąd: ${e}`, true);
      }
    },
    [currentTheme, themeOverlay, themeBlur, applyThemeToDom, loadThemes, notify]
  );

  const handleRemoveBgImage = useCallback(async () => {
    if (!currentTheme) return;
    try {
      setThemeBgImage(null);
      const updated = await invoke<Theme>('update_theme_background', {
        themeId: currentTheme.id,
        backgroundRef: null,
        overlayOpacity: themeOverlay,
        blurRadius: themeBlur,
      });
      applyThemeToDom(updated);
      await loadThemes();
      notify('Tapeta została usunięta');
    } catch (e: unknown) {
      notify(`Błąd: ${e}`, true);
    }
  }, [currentTheme, themeOverlay, themeBlur, applyThemeToDom, loadThemes, notify]);

  const handleSaveBackgroundSettings = useCallback(async () => {
    if (!currentTheme) return;
    try {
      const updated = await invoke<Theme>('update_theme_background', {
        themeId: currentTheme.id,
        backgroundRef: themeBgImage,
        overlayOpacity: themeOverlay,
        blurRadius: themeBlur,
      });
      applyThemeToDom(updated);
      await loadThemes();
      notify('Ustawienia tła zostały zapisane');
    } catch (e: unknown) {
      notify(`Błąd: ${e}`, true);
    }
  }, [currentTheme, themeBgImage, themeOverlay, themeBlur, applyThemeToDom, loadThemes, notify]);

  return {
    currentTheme,
    themes,
    themeOverlay,
    themeBlur,
    themeBgImage,
    customBgPath,
    isDraggingWallpaper,
    appIconStyle,
    jsonExportContent,
    jsonImportContent,
    setCurrentTheme,
    setThemes,
    setThemeOverlay,
    setThemeBlur,
    setThemeBgImage,
    setCustomBgPath,
    setIsDraggingWallpaper,
    setAppIconStyle,
    setJsonExportContent,
    setJsonImportContent,
    applyThemeToDom,
    loadThemes,
    handleSelectTheme,
    handleSelectIconStyle,
    applyWallpaperFromPath,
    handleRemoveBgImage,
    handleSaveBackgroundSettings,
  };
}
