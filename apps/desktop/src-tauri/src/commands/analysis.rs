//! Analiza muzyczna: BPM, tonacja, akordy, fale dźwiękowe i transkrypcja MIDI.

use crate::AppState;
use audio_engine::{
    analyze_track_chords_and_grid, analyze_track_transcription, export_chords_to_chordpro,
    export_chords_to_json, export_chords_to_text, export_transcription_to_midi,
    get_analysis_capabilities as engine_get_analysis_capabilities, TrackKeyBpm,
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
) -> Result<TrackKeyBpm, String> {
    let recompute = force_recompute.unwrap_or(false);
    // 1. Sprawdź, czy mamy już zapisany BPM i klucz w bazie danych (chyba że wymuszono przeliczenie)
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

    // 2. Jeśli nie ma w bazie, wykonaj analizę w tle (tokio spawn_blocking)
    let path_clone = path.clone();
    let analysis_res =
        tokio::task::spawn_blocking(move || audio_engine::analyze_track_key_bpm(&path_clone))
            .await
            .map_err(|e| format!("Błąd wątku analizy: {}", e))?
            .map_err(|e| format!("Błąd analizy: {}", e))?;

    // 3. Jeśli mamy track_id, zapisz wynik w bazie danych
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
) -> Result<(), String> {
    state
        .db
        .update_track_key_bpm(track_id, bpm, &key_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_analysis_capabilities() -> Result<AnalysisCapabilities, String> {
    Ok(engine_get_analysis_capabilities())
}

#[tauri::command]
pub async fn get_or_extract_track_waveform(
    track_id: Option<i64>,
    path: String,
    count: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<f32>, String> {
    let desired_count = count.unwrap_or(160);

    // 1. Sprawdź pamięć podręczną SQLite
    if let Some(id) = track_id {
        if let Ok(Some(cached_json)) = state.db.get_track_waveform(id).await {
            if let Ok(peaks) = serde_json::from_str::<Vec<f32>>(&cached_json) {
                if !peaks.is_empty() {
                    return Ok(peaks);
                }
            }
        }
    }

    // 2. Wyekstrahuj wierno-akustyczny profil szczytów z pliku audio w osobnym wątku
    let path_clone = path.clone();
    let peaks = tokio::task::spawn_blocking(move || {
        audio_engine::extract_track_waveform_peaks(&path_clone, desired_count)
    })
    .await
    .map_err(|e| format!("Błąd wątku roboczego ekstrakcji: {}", e))?
    .map_err(|e| format!("Błąd ekstrakcji fali: {}", e))?;

    // 3. Zapisz w SQLite w tle jeśli podano track_id
    if let Some(id) = track_id {
        if !peaks.is_empty() {
            let db = state.db.clone();
            let peaks_json = serde_json::to_string(&peaks).unwrap_or_default();
            let sample_cnt = peaks.len() as i64;
            tokio::spawn(async move {
                let _ = db.save_track_waveform(id, sample_cnt, &peaks_json).await;
            });
        }
    }

    Ok(peaks)
}

/// Nakłada ręczne poprawki akordów (dopasowane po `start_ms`) na wynik analizy.
fn apply_chord_overrides(chords: &mut [ChordSegment], overrides: &[ChordSegment]) {
    for ov in overrides {
        for ch in chords.iter_mut().filter(|ch| ch.start_ms == ov.start_ms) {
            ch.chord = ov.chord.clone();
        }
    }
}

/// Uzupełnia tempo/tonację dla wpisów pamięci podręcznej sprzed migracji v2 z tagów utworu.
async fn track_bpm_and_key(state: &AppState, track_id: i64) -> (Option<f64>, Option<String>) {
    match state.db.get_track_by_id(track_id).await {
        Ok(Some(t)) => (t.bpm, t.initial_key),
        _ => (None, None),
    }
}

/// Odtwarza `TrackChordsData` z pamięci podręcznej. Zwraca `None` przy uszkodzonym JSON.
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
) -> Result<TrackChordsData, String> {
    let recompute = force_recompute.unwrap_or(false);

    if let (false, Some(id)) = (recompute, track_id) {
        if let Ok(Some(cached)) = state.db.get_track_chords(id).await {
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
            .map_err(|e| format!("Błąd wątku analizy: {}", e))?
            .map_err(|e| format!("Błąd analizy akordów: {}", e))?;

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
) -> Result<Option<TrackChordsData>, String> {
    let cached = state
        .db
        .get_track_chords(track_id)
        .await
        .map_err(|e| e.to_string())?;
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
) -> Result<(), String> {
    state
        .db
        .save_chord_overrides(track_id, &overrides_json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_chords_file(
    track_id: i64,
    format: String,
    title: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let chords_data = get_cached_chords(track_id, state)
        .await?
        .ok_or_else(|| "Brak przeanalizowanych akordów dla tego utworu".to_string())?;

    match format.to_lowercase().as_str() {
        "chordpro" | "cho" => Ok(export_chords_to_chordpro(&chords_data, &title, &artist)),
        "json" => export_chords_to_json(&chords_data).map_err(|e| e.to_string()),
        _ => Ok(export_chords_to_text(&chords_data)),
    }
}

/// Domyślne tempo MIDI, gdy ani analiza, ani tagi utworu go nie znają.
const DEFAULT_MIDI_BPM: f64 = 120.0;

/// Odtwarza `TrackTranscriptionData` z pamięci podręcznej. Zwraca `None` przy uszkodzonym JSON.
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
) -> Result<TrackTranscriptionData, String> {
    let recompute = force_recompute.unwrap_or(false);

    if let (false, Some(id)) = (recompute, track_id) {
        if let Ok(Some(cached)) = state.db.get_track_transcription(id).await {
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
            .map_err(|e| format!("Błąd wątku analizy: {}", e))?
            .map_err(|e| format!("Błąd transkrypcji nutowej: {}", e))?;

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
) -> Result<Option<TrackTranscriptionData>, String> {
    let cached = state
        .db
        .get_track_transcription(track_id)
        .await
        .map_err(|e| e.to_string())?;
    match cached {
        Some(cached) => Ok(transcription_from_cache(&state, track_id, cached).await),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn export_transcription_midi(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    let cached = state
        .db
        .get_track_transcription(track_id)
        .await
        .map_err(|e| e.to_string())?;
    let data = match cached {
        Some(cached) => transcription_from_cache(&state, track_id, cached).await,
        None => None,
    }
    .ok_or_else(|| "Brak zapisanej transkrypcji dla tego utworu".to_string())?;
    Ok(export_transcription_to_midi(&data.notes, data.bpm))
}
