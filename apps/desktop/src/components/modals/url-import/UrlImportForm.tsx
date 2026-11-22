import React from 'react';
import type { FormEvent } from 'react';
import { Download, FolderOpen, AlertCircle, Loader2, Clipboard, Sparkles, ListMusic, SlidersHorizontal } from 'lucide-react';
import type { UrlAudioImportModalProps } from '../UrlAudioImportModal';
import type { Dispatch, SetStateAction } from 'react';

export type UrlImportFormProps = Pick<UrlAudioImportModalProps, 'onClose'> & {
  handleImport: (e: FormEvent<Element>) => Promise<void>;
  loc: { nav: { nowPlaying: string; library: string; playlists: string; dsp: string; stats: string; settings: string; lyrics: string; effects: string; soundscape: string; harmonicSuggester: string; autoEq: string; parametricEq: string; dynamicsStudio: string; fullscreen: string; miniPlayer: string; queue: string; radio: string; musicAnalysis: string; recapTitle: string; keyBpmTitle: string; analysisTitle: string; analysisBtn: string; desktopLrc: string; stemProjectsTitle: string; uiScaleTooltip: string; recap: string; harmonicDj: string; }; player: { track: string; artist: string; album: string; unknownArtist: string; unknownAlbum: string; noTrack: string; play: string; pause: string; stop: string; previous: string; next: string; loopOff: string; loopTrack: string; loopQueue: string; shuffleOn: string; shuffleOff: string; volume: string; mute: string; unmute: string; bookmark: string; bookmarkSaved: string; bookmarkDesc: string; bookmarkActive: string; bookmarkDeleted: string; bookmarkJump: string; bookmarkDelete: string; editLoop: string; editLoopTitle: string; editLoopDesc: string; loopPointA: string; loopPointB: string; loopDuration: string; useCurrentPos: string; jumpToA: string; applyAndClose: string; clearLoop: string; invalidTimeFormat: string; loopBMustBeGreaterThanA: string; loopAB: string; lyrics: string; openFile: string; fetchCover: string; matchCover: string; dspActive: string; estimatedTime: string; seekFadeOn: string; seekFadeOff: string; seekFadeTitle: string; seekFadeDesc: string; statePlaying: string; statePaused: string; stateStopped: string; favoriteAdd: string; favoriteRemove: string; sleepTimer: string; sleepTimerOff: string; turnOffIn: string; quickLoadTitle: string; quickLoadHint: string; testSamples: string; load: string; plays: string; playCount: string; lastPlayed: string; neverPlayed: string; totalListened: string; trackStats: string; resetStats: string; statsTitle: string; timerEnd: string; ambienceFireflies: string; ambienceSnow: string; ambienceMeteors: string; ambienceEmbers: string; audioPathInspectorTooltip: string; displayCover: string; displayVinyl: string; displayTape: string; vinylPlayingStatus: string; vinylPausedStatus: string; tapePlayingStatus: string; tapePausedStatus: string; meterActive: string; meterStandby: string; editLoopTooltip: string; clearedLoopMsg: string; jumpToPointAMsg: string; pointATooltip: string; jumpToPointBMsg: string; pointBTooltip: string; clickToJump: string; loadTrackToManageBookmarks: string; pointsLabel: string; bookmarksModalTitle: string; setPointAAtCurrent: string; setPointBAtCurrent: string; pointAUpdatedMsg: string; pointBUpdatedMsg: string; volumeToggleUnitTooltip: string; stemMix: string; returnToOriginalTooltip: string; restoreOriginal: string; stopAfterCurrentTooltip: string; chordTimelineTitle: string; harmonicAnalysis: string; transposeToggleTooltip: string; transposition: string; transposedOn: string; transposedOrig: string; loopChord: string; detectingChords: string; noChords: string; exportChords: string; tapeCounter: string; tapeSpeedStudio: string; tapeSpeedStandard: string; tapeLoFiTooltip: string; tapeTypeFerric: string; tapeTypeChrome: string; tapeTypeMetal: string; vinylSpeed33: string; vinylSpeed45: string; vinylLoFiTooltip: string; tonearmRest: string; currentChord: string; recomputeChordsTooltip: string; tapeDeckTitle: string; }; waveform: { title: string; hint: string; styleBars: string; styleSmooth: string; styleScrolling: string; styleMirror: string; }; queue: { title: string; items: string; addTracks: string; clear: string; empty: string; emptyHint: string; search: string; duration: string; moveUp: string; moveDown: string; remove: string; customizeView: string; customizeTitle: string; customizeDesc: string; colIndex: string; colCover: string; colArtist: string; colAlbum: string; colFormat: string; colSparkline: string; colDuration: string; colPath: string; compactMode: string; resetDefaults: string; done: string; headerIndex: string; headerCover: string; headerTitleArtist: string; headerAlbum: string; headerQuality: string; headerPath: string; headerWave: string; headerTime: string; headerActions: string; dragHint: string; noMatch: string; browseLibrary: string; pickFromDisk: string; emptyQueueNotice: string; loopNone: string; loopTrack: string; loopQueue: string; autoDjInfinity: string; autoDjHint: string; shuffleOn: string; shuffleOff: string; itemSingle: string; itemFew: string; itemMany: string; clearTooltip: string; addTracksTooltip: string; loopModeNone: string; loopModeTrack: string; loopModeQueue: string; playThis: string; openContainingFolder: string; saveAsPlaylist: string; saveAsPlaylistTitle: string; playlistNamePlaceholder: string; savedToPlaylist: string; inCurrentQueue: string; newPlaylistName: string; autoDj: string; }; dsp: { title: string; subtitle: string; engine: string; bypass: string; bypassDesc: string; rubberband: string; rubberbandDesc: string; soundtouch: string; soundtouchDesc: string; pitch: string; tempo: string; speed: string; semitones: string; cents: string; reset: string; resetAll: string; equalizer: string; eqDesc: string; eqEnabled: string; eqDisabled: string; eqBypass: string; eqAutostart: string; eqAutostartOn: string; eqAutostartOff: string; eqPresets: string; savePreset: string; presetNamePlaceholder: string; resetPitchTooltip: string; resetTempoTooltip: string; dspSpeedTitle: string; enableDspTooltip: string; disableDspTooltip: string; engineDescRubberBand: string; engineDescSoundTouch: string; engineDescBypass: string; spectrumTitle: string; dspAutostart: string; dspAutostartOn: string; dspAutostartOff: string; dspSaveStartupBtn: string; bypassActiveNotice: string; bassBoostTitle: string; bassBoostDesc: string; stereoWidenerTitle: string; stereoWidenerDesc: string; limiterTitle: string; limiterDesc: string; blockBufferLabel: string; keyLabel: string; noBaseKey: string; fromBpm: string; noBaseBpm: string; spatialReverbTitle: string; spatialReverbDesc: string; presetFlat: string; presetBassBoost: string; presetElectronic: string; presetAcoustic: string; presetCustom: string; spectrumCycleTooltip: string; dampingLabel: string; stereoWidthLabel: string; vocalPreserveDesc: string; tapeWarmthDesc: string; bitPerfectDesc: string; nightcoreProfileDesc: string; slowedProfileDesc: string; stereoStageWidth: string; limiterOffWarning: string; autoEqHarmanTooltip: string; dynamicsStudioTooltip: string; defaultEngineStartup: string; enterValuePitch: string; enterValueTempo: string; enterValueSpeed: string; }; library: { title: string; subtitle: string; searchPlaceholder: string; scanFolder: string; browseFolder: string; addFolder: string; addFiles: string; manualPath: string; refresh: string; scanning: string; runScan: string; tracks: string; albums: string; artists: string; favorites: string; allFormats: string; all: string; lossless: string; sortBy: string; sortDefault: string; sortTitle: string; sortArtist: string; sortDuration: string; sortFormat: string; sortDate: string; sortPlays: string; playsCol: string; totalDuration: string; empty: string; emptyHint: string; scanPathLabel: string; scanPathPlaceholder: string; browseDolphin: string; browseDolphinTooltip: string; playSorted: string; quality: string; actions: string; playFromHere: string; addToQueue: string; playNext: string; addToPlaylist: string; filterArtistTracks: string; artistTracksBtn: string; sortDefaultTooltip: string; sortTitleTooltip: string; sortArtistTooltip: string; sortFormatTooltip: string; sortDurationTooltip: string; sortPlaysTooltip: string; scanSummary: string; collection: string; smartAll: string; smartFavorites: string; smartHistory: string; smartTopPlayed: string; smartHiRes: string; resultsCount: string; totalTracksCount: string; sortedBy: string; sortedAsc: string; sortedDesc: string; sortedNewest: string; sortedPlays: string; emptySearchTracks: string; clearSearch: string; removeFromFavorites: string; addToFavorites: string; albumsSortLabel: string; albumSortTitle: string; albumSortArtist: string; albumSortYear: string; sortAscTooltip: string; sortDescTooltip: string; emptyAlbums: string; emptySearchAlbums: string; resultsAlbums: string; totalAlbums: string; resultsArtists: string; totalArtists: string; emptySearchArtists: string; artistTracksCount: string; artistAlbumsCount: string; openContainingFolder: string; duplicateFinder: string; fileRenamer: string; facetsToggle: string; bookmarks: string; backToAlbums: string; hideDuplicatesFilterOn: string; hideDuplicatesFilterOff: string; hideDuplicatesTooltip: string; duplicatesHidden: string; duplicates: string; quickVibeTopRated: string; quickVibeFastBpm: string; quickVibeForgotten: string; cueSheetOpenTooltip: string; cueSheetBtn: string; rating: string; ratingTooltip: string; tagEditorTooltip: string; createStemProjectTooltip: string; albumFilterAll: string; albumFilterWithCover: string; albumFilterMissingCover: string; sortTrackCount: string; sortTotalDuration: string; albumGridSize: string; albumTileSmall: string; albumTileMedium: string; albumTileLarge: string; viewGridView: string; viewGrid: string; viewListView: string; viewList: string; albumViewTracksTooltip: string; filterArtistTracksTooltip: string; playFromStart: string; shuffleAlbum: string; shuffleAlbumTooltip: string; addAlbumToQueue: string; noAlbumTracks: string; importUrlBtn: string; importUrlTooltip: string; shuffleAll: string; shuffleAllTooltip: string; format: string; }; playlists: { title: string; subtitle: string; create: string; namePlaceholder: string; empty: string; emptyHint: string; playAll: string; delete: string; backToList: string; playFromHere: string; addToQueue: string; exportM3u8: string; importM3u8: string; }; covers: { title: string; subtitle: string; searching: string; noCoversFound: string; hintNoCovers: string; searchAlbumPlaceholder: string; searchArtistPlaceholder: string; searchBtn: string; selectCover: string; applyCover: string; matchCover: string; matchCoverTitle: string; downloading: string; cancel: string; sourceWeb: string; mbTitle: string; mbSubtitle: string; mbSearchHint: string; mbMatchScore: string; searchError: string; applyError: string; uploadCustomCover: string; uploadFromDisk: string; dragDropCoverHint: string; customCoverSaved: string; uploadError: string; }; settings: { title: string; subtitle: string; language: string; themes: string; themesSubtitle: string; appearance: string; audioDevices: string; audioSubtitle: string; volumeUnitTitle: string; volumeUnitDesc: string; volumeUnitPercent: string; volumeUnitDb: string; restoreSessionTitle: string; restoreSessionDesc: string; restoreSessionOn: string; restoreSessionOff: string; exportOpus: string; about: string; author: string; version: string; versionName: string; changelog: string; themeOpacity: string; themeBlur: string; appIconTitle: string; appIconDesc: string; iconStyleClassic: string; iconStyleClassicDesc: string; iconStyleLineout: string; iconStyleLineoutDesc: string; outputDevice: string; sampleRate: string; bufferSize: string; active: string; close: string; save: string; transcodeIntegrity: string; transcodeIntegrityDesc: string; sourceFile: string; outputFile: string; targetFormat: string; opusBitrate: string; losslessFlac: string; wavPcm: string; transcodeApplyDsp: string; transcodeApplyDspDesc: string; transcodeApplyRange: string; transcodeApplyRangeDesc: string; transcodePointA: string; transcodePointB: string; transcodeFromPlayer: string; transcodeSetCurrentTime: string; transcodeRangeDuration: string; transcodeEndMustBeGreater: string; transcodeAutoEnqueue: string; transcodeCompletedTitle: string; playRenderedNow: string; addRenderedToQueue: string; addRenderedToPlaylist: string; openRenderedFolder: string; replaygainTitle: string; replaygainDesc: string; replaygainModeOff: string; replaygainModeTrack: string; replaygainModeAlbum: string; replaygainModeAuto: string; replaygainFallbackGain: string; replaygainPreventClipping: string; crossfeedTitle: string; crossfeedDesc: string; crossfeedEnabled: string; crossfeedPresetDefault: string; crossfeedPresetChuMoy: string; crossfeedPresetJanMeier: string; crossfeedPresetCustom: string; crossfeedFcut: string; crossfeedFeed: string; silenceTrimmingTitle: string; silenceTrimmingDesc: string; silenceTrimmingEnabled: string; silenceTrimmingThreshold: string; replaygainPreAmp: string; replaygainLimiterActive: string; replaygainTargetAdjustment: string; scanReplayGainLibrary: string; scanReplayGainTrack: string; scanReplayGainScanning: string; scanReplayGainComplete: string; scanReplayGainWriteTags: string; replaygainTrackGainLabel: string; replaygainTrackPeakLabel: string; customBgLabel: string; customBgPlaceholder: string; chooseWallpaper: string; dragDropWallpaper: string; chooseSource: string; chooseDestination: string; useCurrentTrack: string; chooseFile: string; blurHelp: string; themePortability: string; exportTheme: string; generateJson: string; generateJsonPlaceholder: string; copiedJson: string; copyJson: string; importTheme: string; importPlaceholder: string; verifyImport: string; tokenBg: string; tokenCard: string; tokenPink: string; tokenPurple: string; tokenCyan: string; aboutAudioEngine: string; aboutAudioEngineDesc: string; aboutDsp: string; aboutDspDesc: string; aboutLibrary: string; aboutLibraryDesc: string; aboutLicense: string; aboutLicenseDesc: string; officialRelease: string; disclaimerTitle: string; disclaimerBody: string; proAudioReady: string; proAudioOff: string; proAudioOn: string; hardwareProfiles: string; bluetoothCodecSelect: string; backupTitle: string; backupDesc: string; exportBackupBtn: string; importBackupBtn: string; closeToTray: string; closeToTrayDesc: string; discordRpcTitle: string; discordRpcDesc: string; discordConnected: string; discordDisconnected: string; discordClientIdLabel: string; discordClientIdDefaultBtn: string; listenbrainzTitle: string; listenbrainzDesc: string; listenbrainzToken: string; listenbrainzTokenPlaceholder: string; listenbrainzTest: string; listenbrainzValid: string; listenbrainzInvalid: string; listenbrainzAuto: string; listenbrainzTesting: string; listenbrainzRequiresAccount: string; listenbrainzGetToken: string; lastfmTitle: string; lastfmDesc: string; lastfmConnectBtn: string; lastfmDisconnectBtn: string; lastfmSessionKey: string; lastfmSessionKeyPlaceholder: string; lastfmConnectedAs: string; lastfmNotConnected: string; lastfmAutoScrobble: string; lastfmTesting: string; lastfmConfirmAuthBtn: string; lastfmAuthWaiting: string; lastfmInvalidSession: string; lastfmAdvancedKeys: string; lastfmCustomApiKey: string; lastfmCustomApiSecret: string; crossfadeTitle: string; crossfadeDesc: string; crossfadeDisabled: string; crossfadeTime: string; downloadHubBtn: string; albumPlaybackTitle: string; albumPlaybackDesc: string; albumPlaybackReplace: string; albumPlaybackAppend: string; albumPlaybackSingle: string; volumeSectionTitle: string; volumeSliderResponse: string; volumeSliderInstantDesc: string; volumeSliderSmoothDesc: string; volumeSliderInstant: string; volumeSliderSmooth: string; volumeOsdPosTitle: string; volumeOsdPosDesc: string; volumeOsdBottomCenter: string; volumeOsdCenter: string; volumeOsdTopRight: string; volumeOsdTopLeft: string; volumeOsdBottomRight: string; volumeOsdBottomLeft: string; volumeOsdOff: string; recapTitle: string; recapDesc: string; recapEnabled: string; recapDisabled: string; dspStartupTitle: string; dspStartupDesc: string; dspEngineDirectBypass: string; dspEngineSoundTouch: string; audioBufferTitle: string; audioBufferDefault: string; audioBufferDesc: string; audioBufferReset: string; audioBufferDefaultLabel: string; audioBufferPreset250: string; audioBufferPreset600: string; audioBufferPreset1000: string; audioBufferPreset2000: string; dspBlockSizeTitle: string; dspBlockSizeDefault: string; dspBlockSizeDesc: string; dspBlockSizeFrames: string; dspBlockSizeReset: string; dspBlockSizeDefaultLabel: string; dspBlockPreset512: string; dspBlockPreset1024: string; dspBlockPreset2048: string; dspBlockPreset4096: string; dspBlockPreset8192: string; dspBlockCustom: string; desktopNotificationsTitle: string; desktopNotificationsDesc: string; desktopNotificationsEnabled: string; desktopNotificationsDisabled: string; albumModeReplace: string; albumModeAppend: string; albumModeSingle: string; crossfeedActive: string; crossfeedOff: string; silenceTrimmingPure: string; silenceTrimmingRecommended: string; silenceTrimmingAggressive: string; buttonHoverGlowTitle: string; buttonHoverGlowDesc: string; buttonHoverGlowEnabled: string; buttonHoverGlowDisabled: string; uiScaleLayoutTitle: string; uiScaleLayoutDesc: string; uiScaleReset: string; uiScale100Label: string; uiScale100Desc: string; uiScale110Label: string; uiScale110Desc: string; uiScale120Label: string; uiScale120Desc: string; uiScale130Label: string; uiScale130Desc: string; customBgDropText: string; transcodeLoopAB: string; transcodeSetCurrentPos: string; transcodeGetLoopA: string; transcodeGetLoopB: string; transcodeEndOfTrack: string; transcodeTimePlaceholder: string; transcodeExportRangeText: string; transcodeRendering: string; transcodeRunInBackground: string; aboutBandcampTitle: string; aboutBandcampBtn: string; aboutSortaBtn: string; aboutOnboardingTitle: string; aboutOnboardingDesc: string; aboutOnboardingBtn: string; discordAdvancedClientId: string; apiKeyDefaultPlaceholder: string; apiSecretDefaultPlaceholder: string; aboutBandcampDesc: string; aboutSortaDesc: string; transcodeAppliedLoopMsg: string; transcodeAppliedBookmarksMsg: string; transcodeApplySavedBookmarks: string; transcodeGstreamerBgDesc: string; transcodeRenderingProgress: string; }; shortcuts: { title: string; subtitle: string; catPlayback: string; catNavigation: string; catDsp: string; catLoop: string; playPause: string; seekFwdBack: string; volUpDown: string; muteUnmute: string; miniPlayer: string; fullscreen: string; nextTrack: string; prevTrack: string; shuffle: string; loop: string; lyrics: string; pitchShift: string; tempoShift: string; resetDsp: string; loopA: string; loopB: string; loopClear: string; toggleHelp: string; viewAndUiScale: string; zoomInOut: string; resetUiScale: string; commandPalette: string; quickViewSwitch: string; }; common: { loading: string; confirm: string; cancel: string; clear: string; remove: string; edit: string; back: string; close: string; save: string; errorPrefix: string; copyToClipboard: string; }; stats: { title: string; subtitle: string; liveBadge: string; totalListenTime: string; totalPlays: string; librarySize: string; tracksUnit: string; hiResShare: string; hiResSubtitle: string; topTracks: string; topTracksEmpty: string; topArtists: string; topArtistsEmpty: string; formatBreakdown: string; recentTracks: string; recentTracksEmpty: string; tracksInLibrarySingle: string; tracksInLibraryFew: string; tracksInLibraryMany: string; playsUnit: string; relativeJustNow: string; relativeMinutesAgo: string; relativeHoursAgo: string; relativeDaysAgo: string; relativeOneDayAgo: string; relativeNever: string; hoursUnit: string; minsUnit: string; secsUnit: string; playTrackTooltip: string; viewTrackStatsTooltip: string; unknownArtist: string; }; trackStatsModal: { totalTime: string; trackDuration: string; formatCodec: string; audioChannels: string; stereoChannels: string; filePath: string; resetPlaysTooltip: string; singlePlay: string; }; sleepTimerModal: { title: string; subtitle: string; activeTimer: string; cancel: string; stopAfterCurrent: string; chooseTime: string; endOfTrack: string; gentleFade: string; gentleFadeDesc: string; startTimer: string; timerPill: string; endOfTrackPill: string; customDuration: string; }; lyricsView: { title: string; autoScroll: string; autoScrollOn: string; autoScrollOff: string; offset: string; compensation: string; resetOffset: string; autoDistribute: string; saveLrc: string; searching: string; noLyricsFound: string; noLyricsHint: string; staticNotice: string; autoSyncAction: string; syncToggleOpen: string; syncToggleClose: string; syncTargetLabel: string; endOfLyrics: string; clickAtTime: string; lrcSavedSuccess: string; autoDistributedSuccess: string; errorPrefix: string; retry: string; localLrcBadge: string; autoSyncBadge: string; lrcLibBadge: string; syncLineTooltip: string; refreshTooltip: string; closeTooltip: string; syncModeTitle: string; syncLineAction: string; romajiModeKana: string; romajiModeRomaji: string; romajiModeDual: string; romajiModeTooltip: string; desktopLyricsToggle: string; }; quickVibes: { label: string; nightcore: string; nightcoreDesc: string; slowed: string; slowedDesc: string; vocal: string; vocalDesc: string; bass: string; bassDesc: string; flat: string; flatDesc: string; }; bottomDock: { openFullPlayer: string; prevTooltip: string; nextTooltip: string; playTooltip: string; pauseTooltip: string; pitchTooltip: string; tempoTooltip: string; mutedTooltip: string; volumeTooltip: string; maximizeTooltip: string; scrollToTop: string; selectDspEngine: string; selectDspEngineList: string; dspEngineCycleTooltip: string; cleanAudio: string; fastEngine: string; stopAfterCurrentOn: string; stopAfterCurrentOff: string; }; dragDrop: { title: string; subtitle: string; }; notifications: { langChanged: string; addedFavorite: string; removedFavorite: string; seekFadeEnabled: string; seekFadeDisabled: string; eqAutostartOn: string; eqAutostartOff: string; dspAutostartOn: string; dspAutostartOff: string; dspSavedAsStartup: string; ambienceSakura: string; ambienceNeon: string; ambienceFireflies: string; ambienceSnow: string; ambienceMeteor: string; ambienceMatrix: string; ambienceMomiji: string; ambienceOff: string; themeActivated: string; iconStyleChanged: string; themeSelectImage: string; themeBgUpdated: string; themeBgRemoved: string; themeBgSaved: string; themeJsonExported: string; themeJsonPaste: string; themeImported: string; scanFinished: string; filesSelectedDolphin: string; mbSearchPrompt: string; mbNoMatches: string; mbFoundReleases: string; caaCoverDownloaded: string; mbSearchingCover: string; mbCoverMatched: string; mbCoverLowScore: string; resumedTrack: string; startedPlayback: string; firstSelectTrack: string; bookmarkSaved: string; fileLoaded: string; trackStatsReset: string; dspPresetFlat: string; sleepTimerEndOfTrack: string; sleepTimerSet: string; sleepTimerCancelled: string; sleepTimerTrackEnded: string; sleepTimerPaused: string; nextTrackMsg: string; prevTrackMsg: string; queueEndMsg: string; shuffleOnMsg: string; shuffleOffMsg: string; loopModeMsg: string; playingMsg: string; removedFromQueueMsg: string; queueClearedMsg: string; addedToQueueEndMsg: string; setAsNextMsg: string; loadedTracksToQueueMsg: string; playlistNamePrompt: string; playlistCreatedMsg: string; playlistDeletedMsg: string; addedToPlaylistMsg: string; removedFromPlaylistMsg: string; dspResetDefaultsMsg: string; dspEngineSwitchedMsg: string; dspPresetNamePrompt: string; dspPresetLoadedMsg: string; eqEnabledMsg: string; eqDisabledMsg: string; proAudioEnabledMsg: string; proAudioDisabledMsg: string; noCurrentTrackForCover: string; transcodeSuccessMsg: string; volumeMsg: string; mutedMsg: string; unmutedMsg: string; openedFolder: string; openFolderError: string; scaleLabel: string; scale100: string; scale110: string; scale120: string; scale130: string; minimizeTrayOn: string; minimizeTrayOff: string; discordRpcOn: string; discordRpcOff: string; listenbrainzOn: string; listenbrainzOff: string; lastfmOn: string; lastfmOff: string; lastfmConnected: string; lastfmDisconnected: string; lastfmLoginSuccess: string; scrobbledListenbrainz: string; scrobbledLastfm: string; bassBoostOn: string; bassBoostOff: string; stereoWidenerOn: string; stereoWidenerOff: string; limiterOn: string; limiterOff: string; crossfeedOn: string; crossfeedOff: string; resetBitPerfect: string; restoredOriginalTrack: string; restoreOriginalTrackError: string; dspVibeBypass: string; dspVibeNightcore: string; dspVibeSlowed: string; dspVibeVocal: string; dspVibeBass: string; exportBackground: string; exportProcessing: string; exportDetailsTooltip: string; exportDetails: string; m3u8ImportSuccess: string; noActiveTrackForMarkers: string; savedMarkersAsBookmarks: string; djMixTransition: string; tagsUpdatedSuccess: string; loopRangeImported: string; exportStartedBackground: string; infinityQueueActive: string; infinityQueueDisabled: string; infinityQueuePicked: string; volumeUnitChanged: string; volumeUnitDb: string; volumeUnitPercent: string; restoreSessionMsgOn: string; restoreSessionMsgOff: string; ambienceGothicEmbers: string; stopAfterCurrentOn: string; stopAfterCurrentOff: string; dspStartupEngineSaved: string; audioBufferSet: string; dspBlockSizeSet: string; eqCustom: string; eqFlat: string; eqAppliedPreset: string; autoEqApplied: string; autoEqAppliedWithPreamp: string; loopSetRange: string; loopSetMarkers: string; shuffledTracksCount: string; lofiPresetApplied: string; trackRemovedFromQueue: string; queueCleared: string; setAsNextTrack: string; wallpaperUpdated: string; wallpaperRemoved: string; wallpaperSettingsSaved: string; cuePlaybackStarted: string; cueTracksAdded: string; tempoMatched: string; noBpmDetected: string; }; bigScreenModes: { cover: string; vinyl: string; cassette: string; sideA: string; stereo: string; }; desktopOverlay: { title: string; dragHint: string; lockPosition: string; unlockPosition: string; fontSize: string; opacity: string; closeTooltip: string; noLyrics: string; upcoming: string; }; radio: { title: string; subtitle: string; featuredStations: string; customStations: string; addCustomStation: string; stationName: string; stationUrl: string; stationGenre: string; saveStation: string; deleteStation: string; playing: string; buffering: string; live: string; nowPlayingLive: string; noCustomStations: string; enterValidUrl: string; deleteStationConfirm: string; liveBroadcast: string; stopped: string; supportedStreamsHint: string; stationNamePlaceholder: string; stationGenrePlaceholder: string; stationDescListenMoeJpop: string; stationDescGensokyo: string; stationDescListenMoeKpop: string; stationDescNightwavePlaza: string; stationDescAnimenfo: string; stationDescLofiGirl: string; }; onboarding: { title: string; subtitle: string; whyAuralune: string; whyAuraluneDesc: string; disclaimer: string; disclaimerDesc: string; recapAndLang: string; recapAndLangDesc: string; enableRecap: string; enableRecapDesc: string; interfaceLang: string; audioAndVolume: string; audioAndVolumeDesc: string; volumeMode: string; volumeSmooth: string; volumeSmoothDesc: string; volumeInstant: string; volumeInstantDesc: string; hudPlacement: string; hudCenter: string; hudTopRight: string; hudBottom: string; hudTopLeft: string; hudBottomRight: string; hudDisabled: string; back: string; next: string; startListening: string; }; tagEditor: { title: string; reading: string; readError: string; saveError: string; identifying: string; identifyAcoustId: string; saving: string; saved: string; saveToFile: string; trackTitle: string; artist: string; albumArtist: string; albumTitle: string; year: string; genre: string; trackNumber: string; discNumber: string; comment: string; commentPlaceholder: string; cancel: string; successMsg: string; acoustIdTooltip: string; acoustIdNotFound: string; acoustIdIdentified: string; acoustIdError: string; emptyTitleArtistError: string; selectReleaseCandidate: string; }; keyBpm: { title: string; currentTrack: string; sourceMetadata: string; sourceAcoustic: string; sourceSqlite: string; sourceManual: string; detectionSource: string; autoDetect: string; originalSource: string; baseKey: string; outputDsp: string; transposedKey: string; effectiveBpm: string; manualOverride: string; baseBpm: string; tapTempo: string; quickShift: string; saveAndClose: string; analyzing: string; camelotNotation: string; }; cueSheet: { title: string; subtitle: string; pasteContent: string; parseBtn: string; audioFileLabel: string; tracksCount: string; playFromIndexTooltip: string; editCue: string; addAllToQueue: string; provideContentError: string; parseError: string; }; recapModal: { title: string; generating: string; noHistory: string; noHistoryDesc: string; totalTimeSpent: string; tracksPlayed: string; topTracks: string; topArtists: string; plays: string; period7d: string; period30d: string; period90d: string; period365d: string; periodAll: string; subtitle: string; }; bigScreen: { stemProject: string; createStemProject: string; }; changelog: { title: string; subtitle: string; version: string; codename: string; author: string; date: string; added: string; fixed: string; latestBadge: string; loadMore: string; page: string; prev: string; next: string; first: string; last: string; totalReleases: string; perPage: string; }; commandPalette: { noResults: string; placeholder: string; actionPause: string; actionPlay: string; actionPlayerControl: string; actionNext: string; actionNextSubtitle: string; actionPrev: string; actionPrevSubtitle: string; actionShuffle: string; actionShuffleSubtitle: string; actionShuffleAll: string; actionShuffleAllSubtitle: string; actionHealthCheck: string; actionHealthCheckSubtitle: string; actionStopAfterCurrent: string; actionStopAfterCurrentSubtitle: string; activeTag: string; actionUrlImport: string; actionUrlImportSubtitle: string; actionBigScreen: string; actionBigScreenSubtitle: string; actionSoundscape: string; actionSoundscapeSubtitle: string; actionHarmonicSuggester: string; actionHarmonicSuggesterSubtitle: string; actionAutoEq: string; actionAutoEqSubtitle: string; actionParametricEq: string; actionParametricEqSubtitle: string; actionDynamics: string; actionDynamicsSubtitle: string; actionAmbienceSakura: string; actionAmbienceSakuraSubtitle: string; actionAmbienceNeon: string; actionAmbienceNeonSubtitle: string; actionAmbienceMeteor: string; actionAmbienceMeteorSubtitle: string; actionAmbienceMatrix: string; actionAmbienceMatrixSubtitle: string; actionAmbienceMomiji: string; actionAmbienceMomijiSubtitle: string; actionAmbienceFireflies: string; actionAmbienceFirefliesSubtitle: string; actionAmbienceSnow: string; actionAmbienceSnowSubtitle: string; actionAmbienceEmbers: string; actionAmbienceEmbersSubtitle: string; actionAmbienceOff: string; actionAmbienceOffSubtitle: string; actionDspRubberBand: string; actionDspRubberBandSubtitle: string; actionDspSoundTouch: string; actionDspSoundTouchSubtitle: string; actionDspReset: string; actionDspResetSubtitle: string; actionScanReplaygain: string; actionScanReplaygainSubtitle: string; actionNavPlayer: string; actionNavPlayerSubtitle: string; actionNavLibrary: string; actionNavLibrarySubtitle: string; actionNavDsp: string; actionNavDspSubtitle: string; }; audioPath: { title: string; subtitle: string; source: string; inputSource: string; dspProcessing: string; pipewireSink: string; bitPerfectSummary: string; processedSummary: string; resetBtn: string; directBypass: string; directBypassZeroCpu: string; noTrack: string; format: string; sampleRate: string; bitDepth: string; channels: string; tempo: string; pitch: string; equalizer: string; dspLatency: string; outputFormat: string; sinkClockRate: string; playerBuffer: string; xruns: string; stereo: string; activeBands: string; offFlat: string; }; autoEq: { title: string; subtitle: string; searchPlaceholder: string; all: string; active: string; targetCurve: string; bandGain: string; range: string; preampCompensation: string; preampDesc: string; applyBtn: string; noModels: string; flatProfile: string; }; parametricEq: { title: string; subtitle: string; noBandsError: string; resetAllBands: string; customProfile: string; headroomOk: string; filterBands: string; addBand: string; peakBell: string; lowShelf: string; highShelf: string; deleteBand: string; importExportTitle: string; copied: string; copyConfig: string; applyPasted: string; enabled: string; bypass: string; clippingRiskTitle: string; clippingRiskBadge: string; peqActiveMsg: string; peqBypassMsg: string; filterBandsSubtitle: string; importExportDesc: string; }; dynamicsStudio: { title: string; subtitle: string; resetToBypass: string; presets: string; drcTitle: string; enabled: string; disabled: string; bypass: string; threshold: string; ratio: string; knee: string; makeup: string; inputOutputCurve: string; saturatorTitle: string; modeTube: string; modeTubeDesc: string; modeTape: string; modeTapeDesc: string; modeOverdrive: string; modeOverdriveDesc: string; drive: string; evenHarmonics: string; dryWet: string; waveshaperCurve: string; limiterTitle: string; limiterDesc: string; active: string; off: string; done: string; realTimeTip: string; }; soundscape: { title: string; subtitle: string; channelRain: string; channelRainDesc: string; channelVinyl: string; channelVinylDesc: string; channelCampfire: string; channelCampfireDesc: string; channelWind: string; channelWindDesc: string; channelCafe: string; channelCafeDesc: string; masterVolume: string; muted: string; active: string; allSilent: string; resetZero: string; quickPresets: string; individualLayers: string; unmute: string; mute: string; autoSyncTitle: string; autoSyncDesc: string; }; loopEditor: { title: string; subtitle: string; pointA: string; pointB: string; setPointA: string; setPointB: string; clearA: string; clearB: string; loopActive: string; loopDisabled: string; exportLoop: string; saveBookmarks: string; exportLoopTitle: string; saveBookmarksTitle: string; }; trackBookmarks: { title: string; subtitle: string; addBookmark: string; bookmarkName: string; bookmarkPos: string; exportSection: string; rename: string; deleteBookmark: string; jumpTo: string; setLoopA: string; setLoopB: string; addNewBookmark: string; namePlaceholder: string; timePlaceholder: string; insertCurrentPos: string; savedBookmarks: string; exportRangeWithBookmarks: string; abLoop: string; export: string; loading: string; noBookmarksFound: string; seekAndPlay: string; footerNote: string; rangeFirstToLast: string; quickAddTip: string; }; harmonicSuggester: { title: string; subtitle: string; camelotMatch: string; bpmMatch: string; crossfadeBtn: string; queueNext: string; noMatches: string; currentTrack: string; noActiveTrack: string; selectFromLibrary: string; selectBaseTrack: string; keyUnknown: string; bpmUnknown: string; detectNow: string; beatMatchedTransition: string; disabled: string; bar1: string; bar2: string; bar4: string; disableCrossfade: string; filterTracksPlaceholder: string; compatibleCamelotOnly: string; compatibleBpmOnly: string; foundCount: string; tracksUnit: string; noFilterMatches: string; noFilterMatchesDesc: string; enqueueNext: string; nextBtn: string; playNowCrossfade: string; }; facetsFilter: { title: string; activeFilter: string; clearFilters: string; search: string; all: string; artistHeader: string; searchArtist: string; allArtists: string; searchAlbum: string; unknownArtist: string; }; fileRenamer: { title: string; subtitle: string; noFilesToRename: string; renameSuccess: string; renameError: string; pattern: string; availableTags: string; refreshPreview: string; presets: string; previewCount: string; currentName: string; proposedName: string; statusOverwrite: string; statusUnchanged: string; statusRename: string; renamingProgress: string; renameBtn: string; presetTrackArtistTitle: string; presetArtistTitle: string; presetArtistAlbumTrackTitle: string; presetFolderHierarchy: string; confirmOverwrite: string; }; duplicateFinder: { title: string; subtitle: string; refreshSearch: string; refresh: string; scanning: string; noDuplicates: string; noDuplicatesDesc: string; detectedGroups: string; copies: string; size: string; duration: string; plays: string; playFile: string; showInFolder: string; removeFromDb: string; removeEntry: string; deleteFromDisk: string; removeSuccess: string; removeError: string; confirmDelete: string; confirmRemoveDb: string; }; downloadHub: { title: string; subtitle: string; directUrl: string; destinationFolder: string; selectFolderPlaceholder: string; browse: string; filename: string; expectedSha256: string; integrityOptional: string; starting: string; startDownload: string; queueTitle: string; refreshList: string; emptyQueue: string; downloading: string; streaming: string; playInAuralune: string; error: string; verified: string; compliance: string; errorSelectFolder: string; errorInvalidUrl: string; errorSpecifyDest: string; jobAdded: string; errorStartDownload: string; securityBanner: string; filenamePlaceholder: string; shaPlaceholder: string; }; urlImport: { title: string; subtitle: string; closeEsc: string; urlLabel: string; pasteTooltip: string; paste: string; urlHint: string; targetFormat: string; formatFlacDesc: string; formatMp3Desc: string; formatOpusDesc: string; formatM4aDesc: string; encodingQuality: string; batchMode: string; trackLimit: string; limitUnlimited: string; limit5: string; limit10: string; limit25: string; limit50: string; limit100: string; folderHierarchy: string; hierarchyAlbum: string; hierarchyArtistAlbum: string; hierarchyFlat: string; destFolder: string; browse: string; metadataHint: string; analyzing: string; downloadingTrack: string; extractingBatch: string; extractAudio: string; defaultAlbum: string; playAll: string; queueAll: string; playTrack: string; queueTrack: string; playNow: string; addToQueue: string; showInFolder: string; downloadAnother: string; done: string; errorInvalidUrl: string; errorExtract: string; flacLosslessNotice: string; downloadPlaylistLabel: string; downloadPlaylistDesc: string; sqliteIndexingHint: string; loadingPlaylist: string; loadingTrack: string; btnDownloadPlaylist: string; btnDownloadTrack: string; successMultiTitle: string; successSingleTitle: string; successDesc: string; }; stems: { title: string; subtitle: string; newProject: string; loadingProjects: string; noProjects: string; noProjectsDesc: string; tracksCount: string; openStudio: string; renameProject: string; deleteProject: string; deleteConfirm: string; deleteError: string; renameError: string; master: string; liveMix: string; returnToTrack: string; defaultMix: string; saveMix: string; exportZip: string; closeStudio: string; soloTooltip: string; muteTooltip: string; panResetTooltip: string; volumeResetTooltip: string; masterVolume: string; trackAnalysis: string; vocalPianoRoll: string; shortcutsHint: string; mixNamePlaceholder: string; startSeparation: string; separationSuccess: string; separationDesc: string; channelOther: string; channelVocals: string; channelDrums: string; channelBass: string; projectName: string; computeAccelerator: string; detectingHardware: string; selectPacks: string; outputTracks: string; estimatedTime: string; diskSpace: string; createAndMix: string; creatingProject: string; statusReady: string; statusSeparating: string; statusFailed: string; statusQueued: string; quickModes: string; practiceNoGuitar: string; rhythmDrumsBass: string; karaokeMode: string; activeInAudioPath: string; spectralSeparation: string; loadStemsBtn: string; returnToTrackBtn: string; restoreOriginalTooltip: string; initSeparation: string; modalTitle: string; modalTrackDefault: string; separateStemsTitle: string; originalMaster: string; liveStemMix: string; switchToStemsTooltip: string; returnToOriginalCloseTooltip: string; saveMixTooltip: string; exportZipTooltip: string; masterAndPresets: string; resetAllUnity: string; acapellaSolo: string; drumsOnly: string; instrumental: string; chordsFromBass: string; vocalPianoRollBtn: string; saveMixTitle: string; builtInStft: string; aiReady: string; downloadInManager: string; artistDefault: string; loadingProject: string; instrumentTracksCount: string; errLoadStems: string; errRestoreTrack: string; errSaveMix: string; errExportZip: string; creatingZip: string; exportedZipTo: string; }; analogLoFi: { title: string; subtitle: string; active: string; disabled: string; desc: string; enabledBtn: string; disabledBtn: string; mediumLabel: string; vinyl: string; vinylDesc: string; tape: string; tapeDesc: string; noiseIntensity: string; dustCrackle: string; presetSubtle: string; presetVintage: string; presetLofi: string; presetDeep: string; autoSync: string; autoSyncLabel: string; autoSyncDesc: string; generatorStatus: string; statusAudible: string; statusStandby: string; testPreview: string; stopPreview: string; applyAndClose: string; }; healthCheck: { title: string; subtitle: string; auditing: string; testError: string; pipewireServer: string; dspEngines: string; decoders: string; database: string; audioServerBuffer: string; activeDaemon: string; bufferLatency: string; dspBlock: string; frames: string; realtimeDsp: string; rubberbandDesc: string; soundtouchDesc: string; gstreamerCodecs: string; databaseIntegrity: string; recheckBtn: string; pipewireDirect: string; fallbackAlsa: string; desktopIpc: string; copyReport: string; copiedReport: string; }; aiModels: { title: string; device: string; gpuDetected: string; cpuDetected: string; availableModels: string; deleteWeightsTooltip: string; subtitle: string; installed: string; downloading: string; downloadBtn: string; downloadError: string; deleteConfirm: string; deleteError: string; sizeLabel: string; formatLabel: string; }; analysis: { title: string; tabChords: string; tabPianoRoll: string; tabStems: string; tabProjects: string; tabModels: string; pianoRollTitle: string; detectedNotes: string; analyzingNotes: string; zoomOut: string; zoomIn: string; exportMidiTooltip: string; downloadMidi: string; transcriptionDefault: string; }; };
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  handlePasteClipboard: () => Promise<void>;
  handleFormatChange: (newFormat: string) => void;
  format: string;
  setBitrate: Dispatch<SetStateAction<string>>;
  bitrate: string;
  downloadPlaylist: boolean;
  setDownloadPlaylist: Dispatch<SetStateAction<boolean>>;
  maxItems: number;
  setMaxItems: Dispatch<SetStateAction<number>>;
  folderStructure: string;
  setFolderStructure: Dispatch<SetStateAction<string>>;
  targetDir: string;
  setTargetDir: Dispatch<SetStateAction<string>>;
  handlePickDirectory: () => Promise<void>;
  errorMessage: string | null;
};

export const UrlImportForm: React.FC<UrlImportFormProps> = ({
  bitrate,
  downloadPlaylist,
  errorMessage,
  folderStructure,
  format,
  handleFormatChange,
  handleImport,
  handlePasteClipboard,
  handlePickDirectory,
  isLoading,
  loc,
  maxItems,
  onClose,
  setBitrate,
  setDownloadPlaylist,
  setFolderStructure,
  setMaxItems,
  setTargetDir,
  setUrl,
  targetDir,
  url,
}) => (
    <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Input URL */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '6px',
            color: 'var(--color-text-main, #f0f0f5)',
          }}
        >
          {loc.urlImport.urlLabel}
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="np. https://soundcloud.com/... lub YouTube, Bandcamp, Mixcloud"
            disabled={isLoading}
            autoFocus
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.15))',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <button
            type="button"
            onClick={handlePasteClipboard}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '0 12px',
              color: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
            title={loc.urlImport.pasteTooltip}
          >
            <Clipboard size={15} />
            {loc.urlImport.paste}
          </button>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
          {loc.urlImport.urlHint}
        </span>
      </div>

      {/* Wybór formatu audio */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '8px',
          }}
        >
          {loc.urlImport.targetFormat}
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}
        >
          {[
            { id: 'flac', name: 'FLAC', desc: loc.urlImport.formatFlacDesc },
            { id: 'mp3', name: 'MP3', desc: loc.urlImport.formatMp3Desc },
            { id: 'opus', name: 'OPUS', desc: loc.urlImport.formatOpusDesc },
            { id: 'm4a', name: 'M4A', desc: loc.urlImport.formatM4aDesc },
          ].map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => handleFormatChange(fmt.id)}
              disabled={isLoading}
              style={{
                background:
                  format === fmt.id
                    ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3))'
                    : 'rgba(0, 0, 0, 0.25)',
                border:
                  format === fmt.id
                    ? '1px solid #c084fc'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '8px 6px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                {fmt.name}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                {fmt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Wybór bitratu / jakości audio */}
      {format !== 'flac' ? (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <SlidersHorizontal size={15} style={{ color: '#c084fc' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#f0f0f5' }}>
              {loc.urlImport.encodingQuality}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {format === 'mp3' && (
              <>
                {[
                  { id: '320k', label: '320 kbps (CBR)', desc: 'Studio' },
                  { id: '256k', label: '256 kbps (CBR)', desc: 'Wysoka' },
                  { id: '192k', label: '192 kbps (CBR)', desc: 'Standard' },
                  { id: '0', label: 'V0 VBR (~245k)', desc: 'Zmienna' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    style={{
                      background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: bitrate === b.id ? '#fff' : '#cbd5e1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
            {format === 'opus' && (
              <>
                {[
                  { id: '160k', label: '160 kbps (Studio)', desc: 'Transparentny Hi-Fi' },
                  { id: '128k', label: '128 kbps (Standard)', desc: 'Optymalny' },
                  { id: '96k', label: '96 kbps (Kompakt)', desc: 'Lekki' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    style={{
                      background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: bitrate === b.id ? '#fff' : '#cbd5e1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
            {format === 'm4a' && (
              <>
                {[
                  { id: '256k', label: '256 kbps (AAC)', desc: 'iTunes Plus' },
                  { id: '192k', label: '192 kbps (AAC)', desc: 'Standard' },
                  { id: '128k', label: '128 kbps (AAC)', desc: 'Kompakt' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBitrate(b.id)}
                    disabled={isLoading}
                    style={{
                      background: bitrate === b.id ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                      border: bitrate === b.id ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: bitrate === b.id ? '#fff' : '#cbd5e1',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>• {b.desc}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: '#bae6fd',
          }}
        >
          <Sparkles size={16} style={{ flexShrink: 0, color: '#38bdf8' }} />
          <span>
            {loc.urlImport.flacLosslessNotice}
          </span>
        </div>
      )}

      {/* Opcja pobierania całej playlisty / albumu / kanału SoundCloud */}
      <div
        style={{
          backgroundColor: downloadPlaylist ? 'rgba(168, 85, 247, 0.14)' : 'rgba(0, 0, 0, 0.22)',
          border: downloadPlaylist ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={downloadPlaylist}
              onChange={(e) => setDownloadPlaylist(e.target.checked)}
              disabled={isLoading}
              style={{
                width: '18px',
                height: '18px',
                accentColor: '#a855f7',
                cursor: 'pointer',
              }}
            />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                {loc.urlImport.downloadPlaylistLabel}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '1px' }}>
                {loc.urlImport.downloadPlaylistDesc}
              </div>
            </div>
          </label>
          {downloadPlaylist && (
            <span
              style={{
                background: 'rgba(168, 85, 247, 0.3)',
                color: '#d8b4fe',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ListMusic size={13} />
              {loc.urlImport.batchMode}
            </span>
          )}
        </div>

        {/* Dodatkowe opcje przy włączonej playliście */}
        {downloadPlaylist && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Limit pobieranych utworów */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: '#cbd5e1',
                  marginBottom: '4px',
                }}
              >
                {loc.urlImport.trackLimit}
              </label>
              <select
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
                disabled={isLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              >
                <option value={0}>{loc.urlImport.limitUnlimited}</option>
                <option value={5}>{loc.urlImport.limit5}</option>
                <option value={10}>{loc.urlImport.limit10}</option>
                <option value={25}>{loc.urlImport.limit25}</option>
                <option value={50}>{loc.urlImport.limit50}</option>
                <option value={100}>{loc.urlImport.limit100}</option>
              </select>
            </div>

            {/* Struktura folderów */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: '#cbd5e1',
                  marginBottom: '4px',
                }}
              >
                {loc.urlImport.folderHierarchy}
              </label>
              <select
                value={folderStructure}
                onChange={(e) => setFolderStructure(e.target.value)}
                disabled={isLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              >
                <option value="playlist">
                  {loc.urlImport.hierarchyAlbum}
                </option>
                <option value="artist_album">
                  {loc.urlImport.hierarchyArtistAlbum}
                </option>
                <option value="flat">
                  {loc.urlImport.hierarchyFlat}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Folder docelowy */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '6px',
          }}
        >
          {loc.urlImport.destFolder}
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={targetDir}
            onChange={(e) => setTargetDir(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="button"
            onClick={handlePickDirectory}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
          >
            <FolderOpen size={15} />
            {loc.urlImport.browse}
          </button>
        </div>
      </div>

      {/* Informacje o silniku yt-dlp */}
      <div
        style={{
          backgroundColor: 'rgba(168, 85, 247, 0.08)',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.78rem',
          color: '#e9d5ff',
        }}
      >
        <Sparkles size={16} style={{ flexShrink: 0, color: '#c084fc' }} />
        <span>
          {loc.urlImport.sqliteIndexingHint}
        </span>
      </div>

      {/* Błąd */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            gap: '10px',
            color: '#fca5a5',
            fontSize: '0.82rem',
            whiteSpace: 'pre-line',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Przycisk akcji */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          {loc.common.cancel}
        </button>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          style={{
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !url.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {downloadPlaylist
                ? loc.urlImport.loadingPlaylist
                : loc.urlImport.loadingTrack}
            </>
          ) : (
            <>
              <Download size={16} />
              {downloadPlaylist
                ? loc.urlImport.btnDownloadPlaylist
                : loc.urlImport.btnDownloadTrack}
            </>
          )}
        </button>
      </div>
    </form>
);
