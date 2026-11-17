import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Playlist } from '../types/playlist';
import type { TrackRecord } from '../types/player';
import type { RadioStation } from '../components/RadioView';
import type { Language, Translations, getTranslations } from '../i18n';

export interface UsePlaylistManagerProps {
  language: Language;
  loc: Translations;
  t: ReturnType<typeof getTranslations>;
  showMessage: (msg: string, isError?: boolean) => void;
  initialStartupPositionRef?: React.MutableRefObject<number | null>;
  setTrackDirectCover?: (c: string | null) => void;
  setActiveTrackId?: (id: number | null) => void;
}

export function usePlaylistManager({
  language,
  loc,
  t,
  showMessage,
  initialStartupPositionRef,
  setTrackDirectCover,
  setActiveTrackId,
}: UsePlaylistManagerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackRecord[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<TrackRecord | null>(null);

  const [customRadioStations, setCustomRadioStations] = useState<RadioStation[]>(() => {
    try {
      const stored = localStorage.getItem('auralune_custom_radio_stations');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [currentRadioStation, setCurrentRadioStation] = useState<RadioStation | null>(null);

  const refreshPlaylists = useCallback(async () => {
    try {
      const list = await invoke<Playlist[]>('list_playlists');
      setPlaylists(list);
      return list;
    } catch (e: any) {
      console.warn('Błąd pobierania playlist:', e);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshPlaylists();
  }, [refreshPlaylists]);

  const handlePlayRadioStation = useCallback(async (station: RadioStation) => {
    try {
      if (initialStartupPositionRef) initialStartupPositionRef.current = null;
      setCurrentRadioStation(station);
      if (setTrackDirectCover) setTrackDirectCover(null);
      if (setActiveTrackId) setActiveTrackId(null);
      await invoke('load_radio_stream', { url: station.url, stationName: station.name });
      showMessage(`${station.name} • ${loc.radio.buffering}`);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [initialStartupPositionRef, setTrackDirectCover, setActiveTrackId, showMessage, loc.radio.buffering, t.common.errorPrefix]);

  const handleSaveCustomStation = useCallback((stationData: { name: string; url: string; genre: string }) => {
    const newStation: RadioStation = {
      id: `custom_${Date.now()}`,
      name: stationData.name,
      url: stationData.url,
      genre: stationData.genre || 'Internet Stream',
    };
    const updated = [...customRadioStations, newStation];
    setCustomRadioStations(updated);
    try {
      localStorage.setItem('auralune_custom_radio_stations', JSON.stringify(updated));
    } catch { }
    showMessage(`${loc.radio.saveStation}: ${newStation.name}`);
  }, [customRadioStations, showMessage, loc.radio.saveStation]);

  const handleDeleteCustomStation = useCallback((id: string) => {
    if (!confirm(loc.radio.deleteStationConfirm)) return;
    const updated = customRadioStations.filter((s) => s.id !== id);
    setCustomRadioStations(updated);
    try {
      localStorage.setItem('auralune_custom_radio_stations', JSON.stringify(updated));
    } catch { }
    if (currentRadioStation?.id === id) {
      setCurrentRadioStation(null);
    }
  }, [customRadioStations, currentRadioStation, loc.radio.deleteStationConfirm]);

  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) {
      showMessage(t.notifications.playlistNamePrompt, true);
      return;
    }
    try {
      await invoke('create_playlist', { name: newPlaylistName.trim() });
      setNewPlaylistName('');
      await refreshPlaylists();
      showMessage(t.notifications.playlistCreatedMsg.replace('{0}', newPlaylistName.trim()));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [newPlaylistName, showMessage, t.notifications.playlistNamePrompt, t.notifications.playlistCreatedMsg, t.common.errorPrefix, refreshPlaylists]);

  const handleDeletePlaylist = useCallback(async (playlistId: number, name: string) => {
    try {
      await invoke('delete_playlist', { playlistId });
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
        setPlaylistTracks([]);
      }
      await refreshPlaylists();
      showMessage(t.notifications.playlistDeletedMsg.replace('{0}', name));
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [selectedPlaylist, showMessage, t.notifications.playlistDeletedMsg, t.common.errorPrefix, refreshPlaylists]);

  const handleOpenPlaylist = useCallback(async (pl: Playlist) => {
    setSelectedPlaylist(pl);
    try {
      const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId: pl.id });
      setPlaylistTracks(tr);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [showMessage, t.common.errorPrefix]);

  const handleAddTrackToPlaylist = useCallback(async (playlistId: number, trackId: number) => {
    try {
      await invoke('add_track_to_playlist', { playlistId, trackId });
      setShowPlaylistModal(false);
      setTrackToAddToPlaylist(null);
      await refreshPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId });
        setPlaylistTracks(tr);
      }
      showMessage(t.notifications.addedToPlaylistMsg);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [selectedPlaylist, showMessage, t.notifications.addedToPlaylistMsg, t.common.errorPrefix, refreshPlaylists]);

  const handleRemoveTrackFromPlaylist = useCallback(async (playlistId: number, trackId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke('remove_track_from_playlist', { playlistId, trackId });
      const tr = await invoke<TrackRecord[]>('get_playlist_tracks', { playlistId });
      setPlaylistTracks(tr);
      await refreshPlaylists();
      showMessage(t.notifications.removedFromPlaylistMsg);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [showMessage, t.notifications.removedFromPlaylistMsg, t.common.errorPrefix, refreshPlaylists]);

  const handleExportPlaylistM3u8 = useCallback(async (pl: Playlist) => {
    try {
      const dest = await invoke<string | null>('pick_save_destination', {
        defaultName: `${pl.name}.m3u8`,
        extension: 'm3u8',
      });
      if (!dest) return;

      const msg = await invoke<string>('export_playlist_m3u8', {
        playlistId: pl.id,
        exportPath: dest,
        useRelativePaths: true,
      });
      showMessage(msg);
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [showMessage, t.common.errorPrefix]);

  const handleImportPlaylistM3u8 = useCallback(async () => {
    try {
      const filePath = await invoke<string | null>('pick_custom_file', {
        title: loc.playlists.importM3u8,
        filter: '*.m3u *.m3u8|Pliki playlist M3U (*.m3u, *.m3u8)',
      });
      if (!filePath) return;

      const res = await invoke<{
        playlist_id: number;
        playlist_name: string;
        total_entries: number;
        matched_tracks: number;
        missing_tracks: string[];
      }>('import_playlist_m3u8', { filePath });

      await refreshPlaylists();
      showMessage(
        loc.notifications.m3u8ImportSuccess
          .replace('{0}', res.playlist_name)
          .replace('{1}', String(res.matched_tracks))
          .replace('{2}', String(res.total_entries))
      );
    } catch (err: any) {
      showMessage(`${t.common.errorPrefix} ${err}`, true);
    }
  }, [loc.playlists.importM3u8, refreshPlaylists, showMessage, language, t.common.errorPrefix]);

  return {
    playlists,
    setPlaylists,
    selectedPlaylist,
    setSelectedPlaylist,
    playlistTracks,
    setPlaylistTracks,
    newPlaylistName,
    setNewPlaylistName,
    showPlaylistModal,
    setShowPlaylistModal,
    trackToAddToPlaylist,
    setTrackToAddToPlaylist,
    customRadioStations,
    setCustomRadioStations,
    currentRadioStation,
    setCurrentRadioStation,
    refreshPlaylists,
    handlePlayRadioStation,
    handleSaveCustomStation,
    handleDeleteCustomStation,
    handleCreatePlaylist,
    handleDeletePlaylist,
    handleOpenPlaylist,
    handleAddTrackToPlaylist,
    handleRemoveTrackFromPlaylist,
    handleExportPlaylistM3u8,
    handleImportPlaylistM3u8,
  };
}
