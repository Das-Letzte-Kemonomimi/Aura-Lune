import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '../api/ipc';
import type { Theme } from '../types/theme';
import type { Translations } from '../i18n';

export interface UseThemeManagerOptions {
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useThemeManager({ showMessage, loc }: UseThemeManagerOptions) {
  // 1. UI Scaling & Layout Max Width
  const [uiScale, setUiScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_ui_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.45) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return 1.0;
  });

  useEffect(() => {
    try {
      document.documentElement.style.zoom = String(uiScale);
      document.documentElement.style.setProperty('--ui-scale', String(uiScale));
      localStorage.setItem('auralune_ui_scale', String(uiScale));
    } catch (e) {
      console.warn('UI scale application error:', e);
    }
  }, [uiScale]);

  const layoutMaxWidth = useMemo(() => {
    if (uiScale >= 1.28) return 'min(2350px, 98.5vw)';
    if (uiScale >= 1.18) return 'min(2050px, 98vw)';
    if (uiScale >= 1.08) return 'min(1780px, 96.5vw)';
    return 'min(1500px, 95vw)';
  }, [uiScale]);

  const handleSelectScale = useCallback((scale: number) => {
    setUiScale(scale);
    const label =
      scale >= 1.28
        ? loc.notifications.scale130
        : scale >= 1.18
          ? loc.notifications.scale120
          : scale >= 1.08
            ? loc.notifications.scale110
            : loc.notifications.scale100;
    showMessage(loc.notifications.scaleLabel.replace('{0}', label));
  }, [loc.notifications.scale100, loc.notifications.scale110, loc.notifications.scale120, loc.notifications.scale130, loc.notifications.scaleLabel, showMessage]);

  const handleIncreaseScale = useCallback(() => {
    setUiScale((prev) => {
      let next = 1.0;
      if (prev < 1.08) next = 1.10;
      else if (prev < 1.18) next = 1.20;
      else if (prev < 1.28) next = 1.30;
      else next = 1.0;
      const label =
        next >= 1.28
          ? loc.notifications.scale130
          : next >= 1.18
            ? loc.notifications.scale120
            : loc.notifications.scale110;
      showMessage(loc.notifications.scaleLabel.replace('{0}', label));
      return next;
    });
  }, [loc.notifications.scale110, loc.notifications.scale120, loc.notifications.scale130, loc.notifications.scaleLabel, showMessage]);

  const handleDecreaseScale = useCallback(() => {
    setUiScale((prev) => {
      let next = 1.0;
      if (prev > 1.25) next = 1.20;
      else if (prev > 1.15) next = 1.10;
      else next = 1.0;
      const label =
        next >= 1.18
          ? loc.notifications.scale120
          : next >= 1.08
            ? loc.notifications.scale110
            : loc.notifications.scale100;
      showMessage(loc.notifications.scaleLabel.replace('{0}', label));
      return next;
    });
  }, [loc.notifications.scale100, loc.notifications.scale110, loc.notifications.scale120, loc.notifications.scaleLabel, showMessage]);

  const handleResetScale = useCallback(() => {
    handleSelectScale(1.0);
  }, [handleSelectScale]);

  // 2. Theme State & Styling
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeOverlay, setThemeOverlay] = useState<number>(0.4);
  const [themeBlur, setThemeBlur] = useState<number>(8.0);
  const [themeBgImage, setThemeBgImage] = useState<string | null>(null);
  const [customBgPath, setCustomBgPath] = useState('');
  const [appIconStyle, setAppIconStyle] = useState<'lineout' | 'classic'>('lineout');
  const [jsonExportContent, setJsonExportContent] = useState('');
  const [jsonImportContent, setJsonImportContent] = useState('');

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
      invoke<string>('get_app_icon_style')
        .then((st) => setAppIconStyle(st === 'classic' ? 'classic' : 'lineout'))
        .catch((err) => console.warn('Error reading app_icon_style:', err));
    } catch (e: unknown) {
      console.warn('Error loading themes:', e);
    }
  }, [applyThemeToDom]);

  const handleSelectTheme = useCallback(async (themeId: string) => {
    try {
      const th = await invoke<Theme>('set_active_theme', { themeId });
      applyThemeToDom(th);
      showMessage(loc.notifications.themeActivated.replace('{0}', th.name));
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [applyThemeToDom, loc.common.errorPrefix, loc.notifications.themeActivated, showMessage]);

  const handleSelectIconStyle = useCallback(async (style: 'lineout' | 'classic') => {
    try {
      const applied = await invoke<string>('set_app_icon_style', { style });
      const clean = applied === 'classic' ? 'classic' : 'lineout';
      setAppIconStyle(clean);
      showMessage(
        loc.notifications.iconStyleChanged.replace(
          '{0}',
          clean === 'classic' ? loc.settings.iconStyleClassic : loc.settings.iconStyleLineout
        )
      );
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [loc.common.errorPrefix, loc.notifications.iconStyleChanged, loc.settings.iconStyleClassic, loc.settings.iconStyleLineout, showMessage]);

  const applyWallpaperFromPath = useCallback(async (filePath: string) => {
    try {
      setCustomBgPath(filePath);
      const dataUri = await invoke<string>('upload_background_image', { filePath: filePath.trim() });
      setThemeBgImage(dataUri);
      if (currentTheme) {
        const updated = await invoke<Theme>('update_theme_background', {
          themeId: currentTheme.id,
          backgroundRef: dataUri,
          overlayOpacity: themeOverlay,
          blurRadius: themeBlur,
        });
        applyThemeToDom(updated);
        await loadThemes();
        showMessage(loc.notifications.themeBgUpdated);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [applyThemeToDom, currentTheme, loadThemes, loc.common.errorPrefix, loc.notifications.themeBgUpdated, showMessage, themeBlur, themeOverlay]);

  const handlePickWallpaperFromDisk = useCallback(async () => {
    try {
      const selected = await invoke<string | null>('pick_image_file');
      if (selected) {
        await applyWallpaperFromPath(selected);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [applyWallpaperFromPath, loc.common.errorPrefix, showMessage]);

  const handleWallpaperDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const pathVal = (file as unknown as { path?: string }).path;
      if (pathVal && typeof pathVal === 'string') {
        await applyWallpaperFromPath(pathVal);
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        setThemeBgImage(dataUri);
        if (currentTheme) {
          const updated = await invoke<Theme>('update_theme_background', {
            themeId: currentTheme.id,
            backgroundRef: dataUri,
            overlayOpacity: themeOverlay,
            blurRadius: themeBlur,
          });
          applyThemeToDom(updated);
          await loadThemes();
          showMessage(loc.notifications.themeBgUpdated);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [applyThemeToDom, applyWallpaperFromPath, currentTheme, loadThemes, loc.notifications.themeBgUpdated, showMessage, themeBlur, themeOverlay]);

  const handleUploadBgImage = useCallback(async () => {
    if (!customBgPath.trim()) {
      showMessage(loc.notifications.themeSelectImage, true);
      return;
    }
    await applyWallpaperFromPath(customBgPath);
  }, [applyWallpaperFromPath, customBgPath, loc.notifications.themeSelectImage, showMessage]);

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
      showMessage(loc.notifications.themeBgRemoved);
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [applyThemeToDom, currentTheme, loadThemes, loc.common.errorPrefix, loc.notifications.themeBgRemoved, showMessage, themeBlur, themeOverlay]);

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
      showMessage(loc.notifications.themeBgSaved);
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [applyThemeToDom, currentTheme, loadThemes, loc.common.errorPrefix, loc.notifications.themeBgSaved, showMessage, themeBgImage, themeBlur, themeOverlay]);

  const handleExportTheme = useCallback(async () => {
    if (!currentTheme) return;
    try {
      const json = await invoke<string>('export_theme_json', { themeId: currentTheme.id });
      setJsonExportContent(json);
      showMessage(loc.notifications.themeJsonExported.replace('{0}', currentTheme.name));
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [currentTheme, loc.common.errorPrefix, loc.notifications.themeJsonExported, showMessage]);

  const handleImportTheme = useCallback(async () => {
    if (!jsonImportContent.trim()) {
      showMessage(loc.notifications.themeJsonPaste, true);
      return;
    }
    try {
      const imported = await invoke<Theme>('import_theme_json', { jsonContent: jsonImportContent.trim() });
      applyThemeToDom(imported);
      await loadThemes();
      setJsonImportContent('');
      showMessage(loc.notifications.themeImported.replace('{0}', imported.name));
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [applyThemeToDom, jsonImportContent, loadThemes, loc.common.errorPrefix, loc.notifications.themeImported, loc.notifications.themeJsonPaste, showMessage]);

  return {
    uiScale,
    setUiScale,
    layoutMaxWidth,
    handleSelectScale,
    handleIncreaseScale,
    handleDecreaseScale,
    handleResetScale,
    currentTheme,
    setCurrentTheme,
    themes,
    setThemes,
    themeOverlay,
    setThemeOverlay,
    themeBlur,
    setThemeBlur,
    themeBgImage,
    setThemeBgImage,
    customBgPath,
    setCustomBgPath,
    appIconStyle,
    setAppIconStyle,
    jsonExportContent,
    setJsonExportContent,
    jsonImportContent,
    setJsonImportContent,
    applyThemeToDom,
    loadThemes,
    handleSelectTheme,
    handleSelectIconStyle,
    applyWallpaperFromPath,
    handlePickWallpaperFromDisk,
    handleWallpaperDrop,
    handleUploadBgImage,
    handleRemoveBgImage,
    handleSaveBackgroundSettings,
    handleExportTheme,
    handleImportTheme,
  };
}
