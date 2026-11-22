# Manual checks after the refactor phases

Automated checks (`./tests/run_all_tests.sh`) pass after every phase. The items below need a person running the real app (`npm run tauri dev` in `apps/desktop`), real audio hardware or a real desktop session, because the tests can't cover them.

Tick items off as you go. Where a check fails, the "If it fails" note points to the code most likely involved.

**Before you start:** back up your database (`~/.local/share/<app id>/auralune.db`, or wherever your install keeps it). Phases 1 and 3 add one-way schema upgrades (v2 and v3) that run on first launch.

---

## Phase 1: bug fixes (branch `refactor/phase-1-bugfixes`)

- [ ] **Shuffle-play from the library.** Use "Shuffle all" in the library. Playback should start, with shuffle on.
  - If it fails: `useLibraryPlaybackActions.ts` → `handleShuffleAll`, command `set_shuffle` in `commands/queue.rs`.
- [ ] **First scan replaces the demo track.** On a fresh profile with an empty library, the demo track "Skrzydła Białe" shows. Scan a folder. The first library track becomes the loaded track, and pressing Play plays *that* track, not the demo.
  - If it fails: command `set_active_track`.
- [ ] **Sleep timer counts down while music plays.** Set a 1-minute timer during playback. The countdown should move every second; it should fade out over the last 30 s and pause once.
- [ ] **Hotkeys follow the current language and volume unit.** Change the language, then press ↑ or ↓. The volume toast should be in the new language. Switch the volume unit to dB and press ↑ again; the toast should show dB.
- [ ] **One drag-and-drop adds files once.** Drop a single file and then a folder onto the window. Each should be scanned and queued exactly once, with no duplicates.
- [ ] **Compilations show as one album.** Scan a compilation (tracks with different artists but the same ALBUMARTIST tag, e.g. "Various Artists"). It should appear as a single album with the right album artist.
- [ ] **Deleted files leave the library on rescan.** Delete a file from disk and rescan its folder. The track should disappear. Then unmount or rename a whole library folder and rescan: **nothing** in that folder should be removed.
- [ ] **Deleting a bookmarked track works.** Save a resume bookmark on a track, then delete the track (for example from the duplicate finder). There should be no foreign-key error.
- [ ] **File renamer.**
  - Preview and execute a pattern with subfolders (`%artist%/%album%/%track% - %title%`). The files should move inside the track's folder.
  - A pattern that would overwrite an existing file must ask for confirmation, and only overwrite after you confirm.
- [ ] **Cached chord analysis shows real values.** Open chord analysis on a track that was analysed before. It should show the track's real BPM, key and Camelot code, not "120 BPM / Detected". Export a transcription to MIDI and check the tempo in a DAW.
- [ ] **ReplayGain Auto.** Set ReplayGain to Album, then to Auto, and play a shuffled queue. It should use track gain. Play a whole album in order and it should switch to album gain.
- [ ] **Paths with spaces and non-ASCII characters.** Separate stems for, and analyse, a track whose path has spaces and Japanese characters. It should work, with no "file not found".
- [ ] **Shuffle order is different each time.** Shuffle two different queues of the same length. The order should differ.
- [ ] **No freezes from media keys during clicks.** While a track plays, press the media "next" key at the same time as clicking a queue item, several times. The app must never freeze.

## Phase 2: typed errors and IPC (branch `refactor/phase-2-typed-errors-ipc`)

- [ ] **Error messages still read normally.** Trigger a few failures: scan a folder that doesn't exist, use an invalid ListenBrainz token, open a corrupt audio file. The toasts should show plain sentences, never `[object Object]` or JSON.
- [ ] **Settings save and load.** Change and restart with each of these: language, crossfade, close-to-tray, limiter, bass boost, stereo widener, Last.fm and ListenBrainz toggles, DSP "restore on startup". Every value should survive the restart.

## Phase 3: playback ticker, live status, silence trimming (branch `refactor/phase-3-playback-ticker`)

- [ ] **Tracks advance with the window hidden.** Start a queue of short tracks and close the window to the tray (or minimise it). Tracks must keep advancing; check by ear, with media keys, or in Waybar.
  - If it fails: `setup/playback_ticker.rs`.
- [ ] **MPRIS updates on automatic track changes.** With the window hidden, let a track end. The desktop media widget, lock screen and `playerctl metadata` should show the new track.
- [ ] **Tray controls.** Play/pause, next and previous from the tray menu should work. The UI should update straight away when you reopen the window.
- [ ] **Smooth progress.** During playback, these should move smoothly at about 10 updates a second:
  - the progress bars in the player view, bottom bar, big-screen mode and mini player;
  - the time readouts, waveform playhead, lyrics highlight and spectrum or VU visualisers.
- [ ] **Seek slider.** Dragging the progress slider (and the waveform) should feel instant. On release, playback jumps there with no click.
- [ ] **A-B loop.** Set A and B a few seconds apart. Playback should jump back to A right at B, without overshooting by about a second, and without stuttering or double-jumping.
- [ ] **Bookmarks use the exact position.** Saving a bookmark mid-track should store the exact moment you clicked (within about 0.1 s).
- [ ] **Resume position after restart.** Quit mid-track and restart. The progress bar should show the saved position before you press Play, and Play should resume from there.
- [ ] **Listening stats (Recap).** Play a track for about 1 minute, half of that with the window hidden. The Recap and stats listening time should grow by about 1 minute. Suspending the laptop must not add hours.
- [ ] **Silence trimming.** Turn it on in DSP settings and use a track with 2 s or more of silence at the start and end. Check that:
  - playback starts at the first sound;
  - the next track starts when the trailing silence begins;
  - with repeat-one on, the same track restarts;
  - with "stop after current" on, playback stops.
- [ ] **Silence trimming never cuts music.** Test with a long track (over 10 minutes) and a track with a quiet fade-out. The music must never be cut before the real end.
- [ ] **Silence trimming is skipped for radio.** Play an internet radio stream with trimming on. It should play normally.
- [ ] **CPU use.** During playback with the player view open, CPU should be lower than before. The React DevTools Profiler should show only the progress, time and visualiser components re-rendering each frame.

## Phase 4: real-time audio and pipeline split (branch `refactor/phase-4-realtime-pipeline`)

- [ ] **Bit-perfect bypass.** With DSP on Bypass and the EQ off, play a hi-res file (24-bit / 96 kHz). The output format and sample rate should be unchanged, for example as shown by `pw-top`.
- [ ] **DSP changes during playback.** While playing, change pitch, tempo and rate quickly. Switch Rubber Band → SoundTouch → Bypass and back. Change the DSP block size in settings. Listen for clicks, dropouts and freezes; there should be none.
- [ ] **Saturator and stereo widener.** Toggle both and move their sliders during playback. They should take effect immediately with no glitches. Play a mono or 5.1 file with the widener on; it should pass through unchanged.
- [ ] **Stems and stem projects.** Load the stem mixer for a track and a stem project.
  - Mute, solo and the faders should work.
  - Switching back to the original track should keep the playback position.
- [ ] **Crossfade and repeat.** With crossfade at about 4 s, check next and previous, clicking a queue item, the automatic end-of-track transition, repeat-one, and repeat-all on a single track.
- [ ] **Spectrum visualiser.** It should show stereo L/R bands for stereo files and mirrored bands for mono files.
- [ ] **Media keys stay responsive.** Press next, previous and seek on the keyboard or via `playerctl` several times quickly. They should respond each time, and the app must not freeze or lag.

## Phase 5: frontend structure (branch `refactor/phase-5-frontend-structure`)

The big views and modals were split into section components by moving their JSX verbatim, so they should look and behave exactly as before. Click through each one once and look for anything missing, misplaced, or a control that no longer reacts.

- [ ] **Player view.** Check that each part looks and works as before:
  - the top toolbar (engine badge, open file, quick-load dropdown);
  - the visual mode switcher (vinyl, tape, VU meter, spectrum) and the controls under it;
  - Quick DSP Vibes;
  - the progress bar with waveform, A-B loop band and bookmark markers;
  - all transport and tool buttons (bookmark, cue points, A, B, loop editor, sleep timer, shortcuts, lyrics, shuffle, prev, stop, play, next, repeat, volume);
  - the DSP mini-bar;
  - the queue panel (badges, search, column config popover, add files, save as playlist, clear, drag to reorder, cover click, open folder, remove).
- [ ] **Loop A/B buttons.** Pressing A or B mid-track should set the point at the exact moment you pressed (now read directly from live playback).
- [ ] **Library view.** Check the header and actions, the folder scan panel, the toolbar (view switch, live search, format filters, hide duplicates, sort), the tracks table, the album grid, album detail (open an album and come back), artists, and the MusicBrainz matching panel.
- [ ] **DSP Studio.** Check the engine selector, the pitch, tempo and rate sliders (buttons, step sizes, typing a value by hand), reverb, the preset manager, the mastering rack (bass boost, stereo widener, limiter, crossfeed) and the graphic EQ with its preset menu.
- [ ] **Crossfeed controls in DSP Studio (bug fix).** They received no values before, so they did nothing. Toggle crossfeed, change the preset, and move the cut-off and feed sliders. The sound should change, and the Settings → Devices crossfeed option should show the same state.
- [ ] **Library "Add to queue" and "Play next" (bug fix).** In the tracks table and album detail they received no handler before. Both should now add the track.
- [ ] **Per-track ReplayGain scan from the library (bug fix).** It received no handler before. Run it on one track.
- [ ] **Settings → Devices → "Restore session on startup" (bug fix).** The toggle received no state or handler before. Turn it on, restart, and the last track and position should come back. Turn it off, restart, and they shouldn't.
- [ ] **Big-screen mode.** Check the HUD, the vinyl and tape modes, the bottom controls with the spectrum/VU switch and waveform, and the lyrics toggle.
- [ ] **Settings → Devices and Transcode tabs.** Volume/OSD/Recap, output buffer, DSP block size, ReplayGain, crossfeed, the sound card list, and transcode with DSP, the A-B range and the result panel (play, queue, add to playlist, open folder).
- [ ] **Parametric EQ modal.** Header (enable, reset), presets and preamp, dragging points on the response chart, the band rack, and EqualizerAPO / AutoEQ import and export.
- [ ] **URL audio import modal.** Form (paste, format, bitrate, playlist options, folder picker) and the result view (play or queue all, play or queue single, open folder, import another).
- [ ] **Stem project studio.** Header (switch original/stems, mixes, export ZIP) and workspace (solo, mute, pan, volume, master, presets).
- [ ] **Command palette → "ReplayGain scanner".** It should open Settings on the Devices tab.

## Phase 6: hardening, lifecycle, storage, cleanup (branch `refactor/phase-6-hardening`)

### Security (do these first)

- [ ] **The app renders with the new Content Security Policy.** Start a production build (`npm run tauri build`, then run the AppImage or deb) **and** `npm run tauri dev`. The window must not be blank, and the devtools console (right-click → Inspect) must show no `Refused to load…` / `violates the Content Security Policy` errors while you browse:
  - Google Fonts (Outfit / JetBrains Mono) should load;
  - album covers, cover-art search thumbnails and custom wallpapers (image **and** video) should show;
  - the spectrum and waveform canvases and soundscapes should work;
  - piano-roll MIDI export (uses a `blob:` URL) should work.
  - If it fails: `app.security.csp` / `devCsp` in `apps/desktop/src-tauri/tauri.conf.json`. Setting `"csp": null` there temporarily confirms whether the CSP is the cause.
- [ ] **Export and save dialogs still work for normal places.** Export a playlist (M3U8), a profile backup, a transcode render, and a stem ZIP to `~/Music` or `~/Desktop`; each should succeed.
- [ ] **Hidden locations are refused.** Exporting to a hidden folder in your home directory (for example `~/.config/test.m3u8`) or to `/etc` should be refused with an error toast.
- [ ] **Downloads.** In the Download Hub, a download into `~/Music` should work. A typed destination like `~/Music` (with a literal `~`) is now rejected because it isn't an absolute path; use the folder picker.
- [ ] **AI model download.** It should still save into the app data folder.
- [ ] **Custom cover, wallpaper and M3U import.** Pick a PNG or JPG as a custom album cover and as a wallpaper (also an MP4 or WebM wallpaper), and import an `.m3u8` and a backup `.json`; each should work. A renamed non-image file (for example `notes.txt` renamed to `.png`) is accepted by extension, which is expected.
- [ ] **Cover search.** Applying a cover from cover-art search (MusicBrainz / Deezer thumbnails) should still work.
- [ ] **Waybar / control FIFO.** If you use Waybar or scripts with `/tmp/auralune_ctl` or `/tmp/auralune.sock`, they should still control the player. Both are now readable and writable only by your user.
- [ ] **Desktop notifications.** A track title starting with `-` should show correctly in the notification.
- [ ] **App icon style "lineout".** Selecting it in Settings → Themes should still install the icon.
