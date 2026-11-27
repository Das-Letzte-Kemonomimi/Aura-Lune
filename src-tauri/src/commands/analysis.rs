//! Music analysis: BPM, key, chords and MIDI transcription (waveforms: [`super::waveform`]).

use super::error::CommandError;
use crate::AppState;
use audio_engine::{
    analyze_track_chords_and_grid, analyze_track_transcription, export_chords_to_chordpro,
    export_chords_to_json, export_chords_to_text, export_transcription_to_midi,
    get_analysis_capabilities as engine_get_analysis_capabilities, parse_chord_symbol, TrackKeyBpm,
    CHORD_ANALYZER_VERSION, TRANSCRIPTION_ANALYZER_VERSION,
};
use domain::analysis::{
    AnalysisCapabilities, ChordSegment, TrackChordsData, TrackTranscriptionData,
};
use storage::{CachedTrackChords, CachedTrackTranscription, NewTrackChords};
use tauri::State;

#[tauri::command]
pub async fn detect_track_key_bpm(
    path: String,
    track_id: Option<i64>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackKeyBpm, CommandError> {
    let recompute = force_recompute.unwrap_or(false);
    // 1. Check whether the BPM and key are already stored in the database (unless a recompute is forced)
    if !recompute {
        if let Some(id) = track_id {
            if let Ok(Some((bpm, key_name))) = state.db.get_track_key_bpm(id).await {
                if let Some((base_key_index, is_minor)) =
                    audio_engine::analysis::parse_musical_key(&key_name)
                {
                    let camelot = if is_minor {
                        audio_engine::analysis::CAMELOT_MINOR[base_key_index].to_string()
                    } else {
                        audio_engine::analysis::CAMELOT_MAJOR[base_key_index].to_string()
                    };
                    return Ok(TrackKeyBpm {
                        bpm,
                        key_name,
                        camelot,
                        base_key_index,
                        is_minor,
                        source: "database".to_string(),
                    });
                }
            }
        }
    }

    // 2. If not in the database, run the analysis in the background (tokio spawn_blocking)
    let path_clone = path.clone();
    let analysis_res =
        tokio::task::spawn_blocking(move || audio_engine::analyze_track_key_bpm(&path_clone))
            .await
            .map_err(|e| CommandError::from(e).context("Analysis thread error"))?
            .map_err(|e| CommandError::from(e).context("Analysis error"))?;

    // 3. If we have a track_id, store the result in the database
    if let Some(id) = track_id {
        let db = state.db.clone();
        let bpm = analysis_res.bpm;
        let key_name = analysis_res.key_name.clone();
        let _ = db.update_track_key_bpm(id, bpm, &key_name).await;
    }

    Ok(analysis_res)
}

#[tauri::command]
pub async fn save_track_key_bpm(
    track_id: i64,
    bpm: f64,
    key_name: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .update_track_key_bpm(track_id, bpm, &key_name)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn get_analysis_capabilities() -> Result<AnalysisCapabilities, CommandError> {
    Ok(engine_get_analysis_capabilities())
}

/// Applies manual chord corrections (matched by `start_ms`) on top of the analysis result.
fn apply_chord_overrides(chords: &mut [ChordSegment], overrides: &[ChordSegment]) {
    for ov in overrides {
        let (root, quality) = parse_chord_symbol(&ov.chord);
        for ch in chords.iter_mut().filter(|ch| ch.start_ms == ov.start_ms) {
            ch.chord = ov.chord.clone();
            ch.quality = quality.to_string();
            if quality != "N" {
                ch.root_note = root.clone();
            }
        }
    }
}

/// Fills in tempo/key for cache entries from before migration v2, using the track tags.
async fn track_bpm_and_key(state: &AppState, track_id: i64) -> (Option<f64>, Option<String>) {
    match state.db.get_track_by_id(track_id).await {
        Ok(Some(t)) => (t.bpm, t.initial_key),
        _ => (None, None),
    }
}

/// Rebuilds `TrackChordsData` from the cache. Returns `None` for corrupted JSON.
async fn chords_from_cache(
    state: &AppState,
    track_id: i64,
    cached: CachedTrackChords,
) -> Option<TrackChordsData> {
    let beat_grid =
        serde_json::from_str::<Vec<domain::analysis::BeatPoint>>(&cached.beat_grid_json).ok()?;
    let mut chords = serde_json::from_str::<Vec<ChordSegment>>(&cached.chords_json).ok()?;
    if let Some(overrides) = cached
        .user_overrides_json
        .as_deref()
        .and_then(|json| serde_json::from_str::<Vec<ChordSegment>>(json).ok())
    {
        apply_chord_overrides(&mut chords, &overrides);
    }

    let (bpm, key) = match (cached.bpm, cached.musical_key) {
        (Some(bpm), Some(key)) => (Some(bpm), Some(key)),
        (bpm, key) => {
            let (tag_bpm, tag_key) = track_bpm_and_key(state, track_id).await;
            (bpm.or(tag_bpm), key.or(tag_key))
        }
    };

    Some(TrackChordsData {
        track_id,
        file_hash: cached.file_hash,
        bpm: bpm.unwrap_or(0.0),
        key: key.unwrap_or_default(),
        camelot: cached.camelot.unwrap_or_default(),
        beat_grid,
        chords,
        analyzer_version: cached.analyzer_version,
    })
}

#[tauri::command]
pub async fn detect_track_chords(
    path: String,
    track_id: Option<i64>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackChordsData, CommandError> {
    let recompute = force_recompute.unwrap_or(false);

    if let (false, Some(id)) = (recompute, track_id) {
        if let Ok(Some(cached)) = state.db.get_track_chords(id, CHORD_ANALYZER_VERSION).await {
            if let Some(data) = chords_from_cache(&state, id, cached).await {
                return Ok(data);
            }
        }
    }

    let path_clone = path.clone();
    let id_val = track_id.unwrap_or(0);
    let analysis_res =
        tokio::task::spawn_blocking(move || analyze_track_chords_and_grid(&path_clone, id_val))
            .await
            .map_err(|e| CommandError::from(e).context("Analysis thread error"))?
            .map_err(|e| CommandError::from(e).context("Chord analysis error"))?;

    if let Some(id) = track_id {
        let beat_json = serde_json::to_string(&analysis_res.beat_grid).unwrap_or_default();
        let chords_json = serde_json::to_string(&analysis_res.chords).unwrap_or_default();
        let _ = state
            .db
            .save_track_chords(&NewTrackChords {
                track_id: id,
                file_hash: &analysis_res.file_hash,
                analyzer_version: &analysis_res.analyzer_version,
                beat_grid_json: &beat_json,
                chords_json: &chords_json,
                bpm: Some(analysis_res.bpm),
                musical_key: Some(&analysis_res.key),
                camelot: Some(&analysis_res.camelot),
            })
            .await;
    }

    Ok(analysis_res)
}

#[tauri::command]
pub async fn get_cached_chords(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<TrackChordsData>, CommandError> {
    let cached = state
        .db
        .get_track_chords(track_id, CHORD_ANALYZER_VERSION)
        .await?;
    match cached {
        Some(cached) => Ok(chords_from_cache(&state, track_id, cached).await),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn save_chord_overrides(
    track_id: i64,
    overrides_json: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .save_chord_overrides(track_id, &overrides_json)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn export_chords_file(
    track_id: i64,
    format: String,
    title: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let chords_data = get_cached_chords(track_id, state)
        .await?
        .ok_or_else(|| CommandError::not_found("No analysed chords for this track"))?;

    match format.to_lowercase().as_str() {
        "chordpro" | "cho" => Ok(export_chords_to_chordpro(&chords_data, &title, &artist)),
        "json" => export_chords_to_json(&chords_data).map_err(CommandError::from),
        _ => Ok(export_chords_to_text(&chords_data)),
    }
}

/// Default MIDI tempo when neither the analysis nor the track tags know it.
const DEFAULT_MIDI_BPM: f64 = 120.0;

/// Rebuilds `TrackTranscriptionData` from the cache. Returns `None` for corrupted JSON.
async fn transcription_from_cache(
    state: &AppState,
    track_id: i64,
    cached: CachedTrackTranscription,
) -> Option<TrackTranscriptionData> {
    let notes =
        serde_json::from_str::<Vec<domain::analysis::DetectedNote>>(&cached.notes_json).ok()?;
    let bpm = match cached.bpm {
        Some(bpm) => bpm,
        None => track_bpm_and_key(state, track_id)
            .await
            .0
            .unwrap_or(DEFAULT_MIDI_BPM),
    };
    Some(TrackTranscriptionData {
        track_id,
        file_hash: cached.file_hash,
        notes,
        bpm,
        analyzer_version: cached.analyzer_version,
    })
}

#[tauri::command]
pub async fn detect_track_transcription(
    path: String,
    track_id: Option<i64>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackTranscriptionData, CommandError> {
    let recompute = force_recompute.unwrap_or(false);

    if let (false, Some(id)) = (recompute, track_id) {
        if let Ok(Some(cached)) = state
            .db
            .get_track_transcription(id, TRANSCRIPTION_ANALYZER_VERSION)
            .await
        {
            if let Some(data) = transcription_from_cache(&state, id, cached).await {
                return Ok(data);
            }
        }
    }

    let path_clone = path.clone();
    let id_val = track_id.unwrap_or(0);
    let analysis_res =
        tokio::task::spawn_blocking(move || analyze_track_transcription(&path_clone, id_val))
            .await
            .map_err(|e| CommandError::from(e).context("Analysis thread error"))?
            .map_err(|e| CommandError::from(e).context("Note transcription error"))?;

    if let Some(id) = track_id {
        if let Ok(json) = serde_json::to_string(&analysis_res.notes) {
            let _ = state
                .db
                .save_track_transcription(
                    id,
                    &analysis_res.file_hash,
                    &analysis_res.analyzer_version,
                    &json,
                    Some(analysis_res.bpm),
                )
                .await;
        }
    }

    Ok(analysis_res)
}

#[tauri::command]
pub async fn get_cached_transcription(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<TrackTranscriptionData>, CommandError> {
    let cached = state
        .db
        .get_track_transcription(track_id, TRANSCRIPTION_ANALYZER_VERSION)
        .await?;
    match cached {
        Some(cached) => Ok(transcription_from_cache(&state, track_id, cached).await),
        None => Ok(None),
    }
}

/// Writes the track transcription as a `.mid` file at the given path (after validating the target).
/// Returns the path the file was actually written to.
#[tauri::command]
pub async fn export_transcription_midi(
    track_id: i64,
    export_path: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let resolved = super::paths::ensure_writable(std::path::Path::new(&export_path))?;
    if !domain::paths::has_allowed_extension(&resolved, &["mid", "midi"]) {
        return Err(CommandError::validation(
            "A MIDI file must have the .mid or .midi extension",
        ));
    }
    let cached = state
        .db
        .get_track_transcription(track_id, TRANSCRIPTION_ANALYZER_VERSION)
        .await?;
    let data = match cached {
        Some(cached) => transcription_from_cache(&state, track_id, cached).await,
        None => None,
    }
    .ok_or_else(|| CommandError::not_found("No saved transcription for this track"))?;
    let bytes = export_transcription_to_midi(&data.notes, data.bpm);
    tokio::fs::write(&resolved, bytes)
        .await
        .map_err(|e| CommandError::from(e).context("Failed to write the MIDI file"))?;
    Ok(resolved.to_string_lossy().into_owned())
}
