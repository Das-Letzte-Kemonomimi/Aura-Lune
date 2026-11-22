use sqlx::Row;

use crate::{CachedTrackChords, CachedTrackTranscription, Database, NewTrackChords, StorageError};

impl Database {
    // =========================================================================
    // MODUŁ ANALIZY MUZYCZNEJ (AKORDY, TRANSKRYPCJA, WAVEFORM, MODELE AI)
    // =========================================================================

    /// Zapisuje wynik detekcji akordów i siatki taktowej dla utworu.
    pub async fn save_track_chords(&self, entry: &NewTrackChords<'_>) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO track_chords (track_id, file_hash, analyzer_version, beat_grid_json, chords_json,
                                      created_at, bpm, musical_key, camelot)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9);
            "#,
        )
        .bind(entry.track_id)
        .bind(entry.file_hash)
        .bind(entry.analyzer_version)
        .bind(entry.beat_grid_json)
        .bind(entry.chords_json)
        .bind(now)
        .bind(entry.bpm)
        .bind(entry.musical_key)
        .bind(entry.camelot)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera najnowsze zapisane dane akordów i siatki taktów dla danego utworu.
    pub async fn get_track_chords(
        &self,
        track_id: i64,
    ) -> Result<Option<CachedTrackChords>, StorageError> {
        let row = sqlx::query_as::<_, CachedTrackChords>(
            r#"
            SELECT file_hash, analyzer_version, beat_grid_json, chords_json, user_overrides_json,
                   bpm, musical_key, camelot
            FROM track_chords WHERE track_id = ?1 ORDER BY id DESC LIMIT 1;
            "#,
        )
        .bind(track_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    /// Zapisuje ręczne poprawki akordów wprowadzone przez użytkowniczkę.
    pub async fn save_chord_overrides(
        &self,
        track_id: i64,
        overrides_json: &str,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE track_chords SET user_overrides_json = ?1 WHERE track_id = ?2;")
            .bind(overrides_json)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Zapisuje wynik polifonicznej transkrypcji nutowej (wraz z wykrytym tempem).
    pub async fn save_track_transcription(
        &self,
        track_id: i64,
        file_hash: &str,
        analyzer_version: &str,
        notes_json: &str,
        bpm: Option<f64>,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO track_transcriptions (track_id, file_hash, analyzer_version, notes_json, created_at, bpm)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6);
            "#,
        )
        .bind(track_id)
        .bind(file_hash)
        .bind(analyzer_version)
        .bind(notes_json)
        .bind(now)
        .bind(bpm)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera najnowszą zapisaną transkrypcję nutową utworu.
    pub async fn get_track_transcription(
        &self,
        track_id: i64,
    ) -> Result<Option<CachedTrackTranscription>, StorageError> {
        let row = sqlx::query_as::<_, CachedTrackTranscription>(
            r#"
            SELECT file_hash, analyzer_version, notes_json, bpm
            FROM track_transcriptions WHERE track_id = ?1 ORDER BY id DESC LIMIT 1;
            "#,
        )
        .bind(track_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    /// Zapisuje wyekstrahowane punkty szczytowe fali (waveform peaks) dla utworu.
    pub async fn save_track_waveform(
        &self,
        track_id: i64,
        sample_count: i64,
        peaks_json: &str,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO track_waveforms (track_id, sample_count, peaks_json, created_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(track_id) DO UPDATE SET
                sample_count = excluded.sample_count,
                peaks_json = excluded.peaks_json,
                created_at = excluded.created_at;
            "#,
        )
        .bind(track_id)
        .bind(sample_count)
        .bind(peaks_json)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera zapisane punkty szczytowe fali utworu (waveform peaks).
    pub async fn get_track_waveform(&self, track_id: i64) -> Result<Option<String>, StorageError> {
        let row =
            sqlx::query("SELECT peaks_json FROM track_waveforms WHERE track_id = ?1 LIMIT 1;")
                .bind(track_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(row.map(|r| r.get(0)))
    }

    /// Rejestruje zainstalowany model AI w menedżerze modeli.
    pub async fn register_ai_model(
        &self,
        model: &domain::analysis::AiModelInfo,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO ai_models (id, name, task_type, file_path, file_size, sha256, license, download_url, description, installed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                file_path = excluded.file_path,
                file_size = excluded.file_size,
                sha256 = excluded.sha256,
                installed_at = excluded.installed_at;
            "#,
        )
        .bind(&model.id)
        .bind(&model.name)
        .bind(model.task_type.as_str())
        .bind(&model.file_path)
        .bind(model.file_size as i64)
        .bind(&model.sha256)
        .bind(&model.license)
        .bind(&model.download_url)
        .bind(&model.description)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera zarejestrowany model po identyfikatorze.
    pub async fn get_ai_model(
        &self,
        id: &str,
    ) -> Result<Option<domain::analysis::AiModelInfo>, StorageError> {
        let row = sqlx::query(
            "SELECT id, name, task_type, file_path, file_size, sha256, license, download_url, description FROM ai_models WHERE id = ?1;",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| {
            let task_str: String = r.get(2);
            domain::analysis::AiModelInfo {
                id: r.get(0),
                name: r.get(1),
                task_type: domain::analysis::AiTaskType::from_str_repr(&task_str)
                    .unwrap_or(domain::analysis::AiTaskType::StemSeparation),
                file_path: r.get(3),
                file_size: r.get::<i64, _>(4) as u64,
                sha256: r.get(5),
                license: r.get(6),
                download_url: r.get(7),
                description: r.get(8),
                is_installed: true,
            }
        }))
    }

    /// Listuje wszystkie zarejestrowane modele AI.
    pub async fn list_ai_models(&self) -> Result<Vec<domain::analysis::AiModelInfo>, StorageError> {
        let rows = sqlx::query(
            "SELECT id, name, task_type, file_path, file_size, sha256, license, download_url, description FROM ai_models ORDER BY name ASC;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let task_str: String = r.get(2);
                domain::analysis::AiModelInfo {
                    id: r.get(0),
                    name: r.get(1),
                    task_type: domain::analysis::AiTaskType::from_str_repr(&task_str)
                        .unwrap_or(domain::analysis::AiTaskType::StemSeparation),
                    file_path: r.get(3),
                    file_size: r.get::<i64, _>(4) as u64,
                    sha256: r.get(5),
                    license: r.get(6),
                    download_url: r.get(7),
                    description: r.get(8),
                    is_installed: true,
                }
            })
            .collect())
    }

    /// Usuwa model z rejestru.
    pub async fn delete_ai_model(&self, id: &str) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM ai_models WHERE id = ?1;")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

impl Database {
    /// Zwraca zapisane granice ciszy utworu, jeśli były liczone dla tego samego progu
    /// i niezmienionego pliku (`file_modified_time`).
    pub async fn get_silence_bounds(
        &self,
        track_id: i64,
        threshold_db: f64,
        file_modified_time: i64,
    ) -> Result<Option<domain::SilenceBounds>, StorageError> {
        let row: Option<(i64, Option<i64>)> = sqlx::query_as(
            r#"
            SELECT start_ms, end_ms FROM track_silence_bounds
            WHERE track_id = ?1 AND ABS(threshold_db - ?2) < 0.01 AND file_modified_time = ?3;
            "#,
        )
        .bind(track_id)
        .bind(threshold_db)
        .bind(file_modified_time)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|(start, end)| domain::SilenceBounds {
            start_ms: start.max(0) as u64,
            end_ms: end.map(|e| e.max(0) as u64),
        }))
    }

    /// Zapisuje (nadpisuje) granice ciszy utworu.
    pub async fn save_silence_bounds(
        &self,
        track_id: i64,
        threshold_db: f64,
        file_modified_time: i64,
        bounds: &domain::SilenceBounds,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO track_silence_bounds
                (track_id, threshold_db, start_ms, end_ms, file_modified_time, analyzed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(track_id) DO UPDATE SET
                threshold_db = excluded.threshold_db,
                start_ms = excluded.start_ms,
                end_ms = excluded.end_ms,
                file_modified_time = excluded.file_modified_time,
                analyzed_at = excluded.analyzed_at;
            "#,
        )
        .bind(track_id)
        .bind(threshold_db)
        .bind(bounds.start_ms as i64)
        .bind(bounds.end_ms.map(|e| e as i64))
        .bind(file_modified_time)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
