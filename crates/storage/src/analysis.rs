use sqlx::Row;

use crate::{Database, StorageError};

impl Database {
    // =========================================================================
    // MODUŁ ANALIZY MUZYCZNEJ (AKORDY, TRANSKRYPCJA, WAVEFORM, MODELE AI)
    // =========================================================================

    /// Zapisuje wynik detekcji akordów i siatki taktowej dla utworu.
    pub async fn save_track_chords(
        &self,
        track_id: i64,
        file_hash: &str,
        analyzer_version: &str,
        beat_grid_json: &str,
        chords_json: &str,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO track_chords (track_id, file_hash, analyzer_version, beat_grid_json, chords_json, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6);
            "#,
        )
        .bind(track_id)
        .bind(file_hash)
        .bind(analyzer_version)
        .bind(beat_grid_json)
        .bind(chords_json)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera zapisane dane akordów i siatki taktów dla danego utworu.
    pub async fn get_track_chords(
        &self,
        track_id: i64,
    ) -> Result<Option<(String, String, Option<String>)>, StorageError> {
        let row = sqlx::query(
            "SELECT beat_grid_json, chords_json, user_overrides_json FROM track_chords WHERE track_id = ?1 ORDER BY id DESC LIMIT 1;",
        )
        .bind(track_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| {
            let beat: String = r.get(0);
            let chords: String = r.get(1);
            let overrides: Option<String> = r.get(2);
            (beat, chords, overrides)
        }))
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

    /// Zapisuje wynik polifonicznej transkrypcji nutowej.
    pub async fn save_track_transcription(
        &self,
        track_id: i64,
        file_hash: &str,
        analyzer_version: &str,
        notes_json: &str,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO track_transcriptions (track_id, file_hash, analyzer_version, notes_json, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5);
            "#,
        )
        .bind(track_id)
        .bind(file_hash)
        .bind(analyzer_version)
        .bind(notes_json)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera zapisaną transkrypcję nutową utworu.
    pub async fn get_track_transcription(
        &self,
        track_id: i64,
    ) -> Result<Option<String>, StorageError> {
        let row = sqlx::query(
            "SELECT notes_json FROM track_transcriptions WHERE track_id = ?1 ORDER BY id DESC LIMIT 1;",
        )
        .bind(track_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|r| r.get(0)))
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
