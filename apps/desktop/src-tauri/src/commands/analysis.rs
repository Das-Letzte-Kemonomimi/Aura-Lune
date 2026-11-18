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

#[tauri::command]
pub async fn detect_track_chords(
    path: String,
    track_id: Option<i64>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackChordsData, String> {
    let recompute = force_recompute.unwrap_or(false);

    if !recompute {
        if let Some(id) = track_id {
            if let Ok(Some((beat_json, chords_json, overrides_json))) =
                state.db.get_track_chords(id).await
            {
                if let (Ok(beat_grid), Ok(mut chords)) = (
                    serde_json::from_str::<Vec<domain::analysis::BeatPoint>>(&beat_json),
                    serde_json::from_str::<Vec<ChordSegment>>(&chords_json),
                ) {
                    if let Some(ref overrides) = overrides_json {
                        if let Ok(override_list) =
                            serde_json::from_str::<Vec<ChordSegment>>(overrides)
                        {
                            for ov in override_list {
                                for ch in chords.iter_mut() {
                                    if ch.start_ms == ov.start_ms {
                                        ch.chord = ov.chord.clone();
                                    }
                                }
                            }
                        }
                    }
                    return Ok(TrackChordsData {
                        track_id: id,
                        file_hash: "cached".to_string(),
                        bpm: 120.0,
                        key: "Detected".to_string(),
                        camelot: "".to_string(),
                        beat_grid,
                        chords,
                        analyzer_version: "1.0.8-classic".to_string(),
                    });
                }
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
        let db = state.db.clone();
        let hash = analysis_res.file_hash.clone();
        let ver = analysis_res.analyzer_version.clone();
        let beat_json = serde_json::to_string(&analysis_res.beat_grid).unwrap_or_default();
        let chords_json = serde_json::to_string(&analysis_res.chords).unwrap_or_default();
        let _ = db
            .save_track_chords(id, &hash, &ver, &beat_json, &chords_json)
            .await;
    }

    Ok(analysis_res)
}

#[tauri::command]
pub async fn get_cached_chords(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<TrackChordsData>, String> {
    match state.db.get_track_chords(track_id).await {
        Ok(Some((beat_json, chords_json, overrides_json))) => {
            if let (Ok(beat_grid), Ok(mut chords)) = (
                serde_json::from_str::<Vec<domain::analysis::BeatPoint>>(&beat_json),
                serde_json::from_str::<Vec<ChordSegment>>(&chords_json),
            ) {
                if let Some(ref overrides) = overrides_json {
                    if let Ok(override_list) = serde_json::from_str::<Vec<ChordSegment>>(overrides)
                    {
                        for ov in override_list {
                            for ch in chords.iter_mut() {
                                if ch.start_ms == ov.start_ms {
                                    ch.chord = ov.chord.clone();
                                }
                            }
                        }
                    }
                }
                Ok(Some(TrackChordsData {
                    track_id,
                    file_hash: "cached".to_string(),
                    bpm: 120.0,
                    key: "Detected".to_string(),
                    camelot: "".to_string(),
                    beat_grid,
                    chords,
                    analyzer_version: "1.0.8-classic".to_string(),
                }))
            } else {
                Ok(None)
            }
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
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

#[tauri::command]
pub async fn detect_track_transcription(
    path: String,
    track_id: Option<i64>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackTranscriptionData, String> {
    let recompute = force_recompute.unwrap_or(false);

    if !recompute {
        if let Some(id) = track_id {
            if let Ok(Some(notes_json)) = state.db.get_track_transcription(id).await {
                if let Ok(notes) =
                    serde_json::from_str::<Vec<domain::analysis::DetectedNote>>(&notes_json)
                {
                    return Ok(TrackTranscriptionData {
                        track_id: id,
                        file_hash: "cached".to_string(),
                        notes,
                        bpm: 120.0,
                        analyzer_version: "1.0.8-salience".to_string(),
                    });
                }
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
        let db = state.db.clone();
        let hash = analysis_res.file_hash.clone();
        let ver = analysis_res.analyzer_version.clone();
        if let Ok(json) = serde_json::to_string(&analysis_res.notes) {
            let _ = db.save_track_transcription(id, &hash, &ver, &json).await;
        }
    }

    Ok(analysis_res)
}

#[tauri::command]
pub async fn get_cached_transcription(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<TrackTranscriptionData>, String> {
    match state.db.get_track_transcription(track_id).await {
        Ok(Some(notes_json)) => {
            if let Ok(notes) =
                serde_json::from_str::<Vec<domain::analysis::DetectedNote>>(&notes_json)
            {
                Ok(Some(TrackTranscriptionData {
                    track_id,
                    file_hash: "cached".to_string(),
                    notes,
                    bpm: 120.0,
                    analyzer_version: "1.0.8-salience".to_string(),
                }))
            } else {
                Ok(None)
            }
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn export_transcription_midi(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    let notes_opt = match state.db.get_track_transcription(track_id).await {
        Ok(Some(json)) => serde_json::from_str::<Vec<domain::analysis::DetectedNote>>(&json).ok(),
        _ => None,
    };

    let notes =
        notes_opt.ok_or_else(|| "Brak zapisanej transkrypcji dla tego utworu".to_string())?;
    Ok(export_transcription_to_midi(&notes, 120.0))
}
