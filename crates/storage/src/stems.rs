use sqlx::Row;

use crate::{Database, StorageError};

impl Database {
    // =========================================================================
    // MODUŁ SEPARACJI STEMÓW I PROJEKTÓW MULTITRACK
    // =========================================================================

    /// Zapisuje metadane rozdzielonych ścieżek stemów.
    pub async fn save_stem_tracks(
        &self,
        data: &domain::analysis::StemSeparationData,
    ) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            r#"
            INSERT INTO stem_tracks (
                track_id, file_hash, model_name, stems_dir,
                vocals_path, drums_path, bass_path, other_path,
                piano_path, guitar_path, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11);
            "#,
        )
        .bind(data.track_id)
        .bind(&data.file_hash)
        .bind(&data.model_name)
        .bind(&data.stems_dir)
        .bind(&data.vocals_path)
        .bind(&data.drums_path)
        .bind(&data.bass_path)
        .bind(&data.other_path)
        .bind(&data.piano_path)
        .bind(&data.guitar_path)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera rozdzielone ścieżki dla danego utworu.
    pub async fn get_stem_tracks(
        &self,
        track_id: i64,
    ) -> Result<Option<domain::analysis::StemSeparationData>, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT track_id, file_hash, model_name, stems_dir,
                   vocals_path, drums_path, bass_path, other_path,
                   piano_path, guitar_path
            FROM stem_tracks WHERE track_id = ?1 ORDER BY id DESC LIMIT 1;
            "#,
        )
        .bind(track_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| domain::analysis::StemSeparationData {
            track_id: r.get(0),
            file_hash: r.get(1),
            model_name: r.get(2),
            stems_dir: r.get(3),
            vocals_path: r.get(4),
            drums_path: r.get(5),
            bass_path: r.get(6),
            other_path: r.get(7),
            piano_path: r.get(8),
            guitar_path: r.get(9),
        }))
    }

    /// Usuwa rekord i powiązane stemy dla danego utworu.
    pub async fn delete_stem_tracks(&self, track_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM stem_tracks WHERE track_id = ?1;")
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Tworzy nowy projekt stemów i zwraca jego ID.
    pub async fn create_stem_project(
        &self,
        project: &domain::StemProject,
    ) -> Result<i64, StorageError> {
        let status_str = match project.status {
            domain::StemProjectStatus::Queued => "queued",
            domain::StemProjectStatus::Separating => "separating",
            domain::StemProjectStatus::Ready => "ready",
            domain::StemProjectStatus::Failed => "failed",
        };

        let row = sqlx::query(
            r#"
            INSERT INTO stem_projects (
                track_id, track_hash, title, artist, album, cover_uri,
                status, progress, model_name, disk_size_bytes, active_mix_name,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            RETURNING id;
            "#,
        )
        .bind(project.track_id)
        .bind(&project.track_hash)
        .bind(&project.title)
        .bind(&project.artist)
        .bind(&project.album)
        .bind(&project.cover_uri)
        .bind(status_str)
        .bind(project.progress as f64)
        .bind(&project.model_name)
        .bind(project.disk_size_bytes as i64)
        .bind(&project.active_mix_name)
        .bind(&project.created_at)
        .bind(&project.updated_at)
        .fetch_one(&self.pool)
        .await?;

        let project_id: i64 = row.get(0);

        if !project.channels.is_empty() {
            self.save_stem_project_channels(project_id, &project.channels)
                .await?;
        }

        Ok(project_id)
    }

    /// Pobiera projekt stemów wraz z przypisanymi kanałami.
    pub async fn get_stem_project(
        &self,
        project_id: i64,
    ) -> Result<Option<domain::StemProject>, StorageError> {
        let row_opt = sqlx::query(
            r#"
            SELECT id, track_id, track_hash, title, artist, album, cover_uri,
                   status, progress, model_name, disk_size_bytes, active_mix_name,
                   created_at, updated_at
            FROM stem_projects
            WHERE id = ?1;
            "#,
        )
        .bind(project_id)
        .fetch_optional(&self.pool)
        .await?;

        let row = match row_opt {
            Some(r) => r,
            None => return Ok(None),
        };

        let status_str: String = row.get("status");
        let status = match status_str.as_str() {
            "separating" => domain::StemProjectStatus::Separating,
            "ready" => domain::StemProjectStatus::Ready,
            "failed" => domain::StemProjectStatus::Failed,
            _ => domain::StemProjectStatus::Queued,
        };

        let channels = self.get_stem_project_channels(project_id).await?;

        Ok(Some(domain::StemProject {
            id: row.get("id"),
            track_id: row.get("track_id"),
            track_hash: row.get("track_hash"),
            title: row.get("title"),
            artist: row.get("artist"),
            album: row.get("album"),
            cover_uri: row.get("cover_uri"),
            status,
            progress: row.get::<f64, _>("progress") as f32,
            model_name: row.get("model_name"),
            disk_size_bytes: row.get::<i64, _>("disk_size_bytes") as u64,
            channels,
            active_mix_name: row.get("active_mix_name"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }))
    }

    /// Zwraca listę wszystkich projektów stemów posortowaną od najnowszych.
    pub async fn list_stem_projects(&self) -> Result<Vec<domain::StemProject>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT id, track_id, track_hash, title, artist, album, cover_uri,
                   status, progress, model_name, disk_size_bytes, active_mix_name,
                   created_at, updated_at
            FROM stem_projects
            ORDER BY updated_at DESC, id DESC;
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut projects = Vec::new();
        for row in rows {
            let pid: i64 = row.get("id");
            let status_str: String = row.get("status");
            let status = match status_str.as_str() {
                "separating" => domain::StemProjectStatus::Separating,
                "ready" => domain::StemProjectStatus::Ready,
                "failed" => domain::StemProjectStatus::Failed,
                _ => domain::StemProjectStatus::Queued,
            };
            let channels = self.get_stem_project_channels(pid).await?;

            projects.push(domain::StemProject {
                id: pid,
                track_id: row.get("track_id"),
                track_hash: row.get("track_hash"),
                title: row.get("title"),
                artist: row.get("artist"),
                album: row.get("album"),
                cover_uri: row.get("cover_uri"),
                status,
                progress: row.get::<f64, _>("progress") as f32,
                model_name: row.get("model_name"),
                disk_size_bytes: row.get::<i64, _>("disk_size_bytes") as u64,
                channels,
                active_mix_name: row.get("active_mix_name"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }

        Ok(projects)
    }

    /// Aktualizuje status, postęp i rozmiar na dysku projektu stemów.
    pub async fn update_stem_project_status(
        &self,
        project_id: i64,
        status: domain::StemProjectStatus,
        progress: f32,
        disk_size_bytes: u64,
    ) -> Result<(), StorageError> {
        let status_str = match status {
            domain::StemProjectStatus::Queued => "queued",
            domain::StemProjectStatus::Separating => "separating",
            domain::StemProjectStatus::Ready => "ready",
            domain::StemProjectStatus::Failed => "failed",
        };

        sqlx::query(
            r#"
            UPDATE stem_projects
            SET status = ?1, progress = ?2, disk_size_bytes = ?3, updated_at = datetime('now')
            WHERE id = ?4;
            "#,
        )
        .bind(status_str)
        .bind(progress as f64)
        .bind(disk_size_bytes as i64)
        .bind(project_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Zmienia tytuł projektu stemów.
    pub async fn rename_stem_project(
        &self,
        project_id: i64,
        title: &str,
    ) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            UPDATE stem_projects
            SET title = ?1, updated_at = datetime('now')
            WHERE id = ?2;
            "#,
        )
        .bind(title)
        .bind(project_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Usuwa projekt stemów (kaskadowo usuwając kanały i miksy).
    pub async fn delete_stem_project(&self, project_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM stem_project_channels WHERE project_id = ?1;")
            .bind(project_id)
            .execute(&self.pool)
            .await?;
        sqlx::query("DELETE FROM stem_project_mixes WHERE project_id = ?1;")
            .bind(project_id)
            .execute(&self.pool)
            .await?;
        sqlx::query("DELETE FROM stem_projects WHERE id = ?1;")
            .bind(project_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Zapisuje listę kanałów dla projektu stemów (zastępuje istniejące).
    pub async fn save_stem_project_channels(
        &self,
        project_id: i64,
        channels: &[domain::StemChannel],
    ) -> Result<(), StorageError> {
        // Jedna transakcja: błąd w połowie nie zostawia projektu bez kanałów.
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM stem_project_channels WHERE project_id = ?1;")
            .bind(project_id)
            .execute(&mut *tx)
            .await?;

        for ch in channels {
            let quality_str = match ch.quality_tier {
                domain::StemQualityTier::HighQuality => "high_quality",
                domain::StemQualityTier::Experimental => "experimental",
                domain::StemQualityTier::DspFallback => "dsp_fallback",
                domain::StemQualityTier::Unavailable => "unavailable",
            };

            sqlx::query(
                r#"
                INSERT INTO stem_project_channels (
                    project_id, stem_id, name, parent_stem, file_path,
                    color_hex, quality_tier, volume, pan, mute, solo
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11);
                "#,
            )
            .bind(project_id)
            .bind(&ch.id)
            .bind(&ch.name)
            .bind(&ch.parent_stem)
            .bind(&ch.file_path)
            .bind(&ch.color_hex)
            .bind(quality_str)
            .bind(ch.volume as f64)
            .bind(ch.pan as f64)
            .bind(ch.mute as i32)
            .bind(ch.solo as i32)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;

        Ok(())
    }

    /// Pobiera kanały dla danego projektu stemów.
    pub async fn get_stem_project_channels(
        &self,
        project_id: i64,
    ) -> Result<Vec<domain::StemChannel>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT stem_id, name, parent_stem, file_path, color_hex,
                   quality_tier, volume, pan, mute, solo
            FROM stem_project_channels
            WHERE project_id = ?1
            ORDER BY id ASC;
            "#,
        )
        .bind(project_id)
        .fetch_all(&self.pool)
        .await?;

        let mut channels = Vec::new();
        for r in rows {
            let q_str: String = r.get("quality_tier");
            let quality_tier = match q_str.as_str() {
                "high_quality" => domain::StemQualityTier::HighQuality,
                "experimental" => domain::StemQualityTier::Experimental,
                "unavailable" => domain::StemQualityTier::Unavailable,
                _ => domain::StemQualityTier::DspFallback,
            };

            channels.push(domain::StemChannel {
                id: r.get("stem_id"),
                name: r.get("name"),
                parent_stem: r.get("parent_stem"),
                file_path: r.get("file_path"),
                color_hex: r.get("color_hex"),
                quality_tier,
                volume: r.get::<f64, _>("volume") as f32,
                pan: r.get::<f64, _>("pan") as f32,
                mute: r.get::<i32, _>("mute") != 0,
                solo: r.get::<i32, _>("solo") != 0,
            });
        }

        Ok(channels)
    }

    /// Zapisuje miks parametrów dla projektu stemów.
    pub async fn save_stem_project_mix(
        &self,
        mix: &domain::StemProjectMix,
    ) -> Result<i64, StorageError> {
        let channels_json =
            serde_json::to_string(&mix.channels).unwrap_or_else(|_| "{}".to_string());

        let row = sqlx::query(
            r#"
            INSERT INTO stem_project_mixes (
                project_id, name, is_default, channels_json, master_volume, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            RETURNING id;
            "#,
        )
        .bind(mix.project_id)
        .bind(&mix.name)
        .bind(mix.is_default as i32)
        .bind(&channels_json)
        .bind(mix.master_volume as f64)
        .bind(&mix.updated_at)
        .fetch_one(&self.pool)
        .await?;

        let mix_id: i64 = row.get(0);
        Ok(mix_id)
    }

    /// Pobiera zapisane miksy dla danego projektu stemów.
    pub async fn get_stem_project_mixes(
        &self,
        project_id: i64,
    ) -> Result<Vec<domain::StemProjectMix>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT id, project_id, name, is_default, channels_json, master_volume, updated_at
            FROM stem_project_mixes
            WHERE project_id = ?1
            ORDER BY is_default DESC, updated_at DESC;
            "#,
        )
        .bind(project_id)
        .fetch_all(&self.pool)
        .await?;

        let mut mixes = Vec::new();
        for r in rows {
            let ch_json: String = r.get("channels_json");
            let channels = serde_json::from_str(&ch_json).unwrap_or_default();

            mixes.push(domain::StemProjectMix {
                id: Some(r.get("id")),
                project_id: r.get("project_id"),
                name: r.get("name"),
                is_default: r.get::<i32, _>("is_default") != 0,
                channels,
                master_volume: r.get::<f64, _>("master_volume") as f32,
                updated_at: r.get("updated_at"),
            });
        }

        Ok(mixes)
    }

    /// Usuwa zapisany miks.
    pub async fn delete_stem_project_mix(&self, mix_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM stem_project_mixes WHERE id = ?1;")
            .bind(mix_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Ustawia nazwę aktywnego miksu dla projektu stemów.
    pub async fn set_active_stem_project_mix(
        &self,
        project_id: i64,
        mix_name: &str,
    ) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            UPDATE stem_projects
            SET active_mix_name = ?1, updated_at = datetime('now')
            WHERE id = ?2;
            "#,
        )
        .bind(mix_name)
        .bind(project_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Projekty, których separacja została przerwana (np. zamknięciem aplikacji), oznacza jako
    /// nieudane — inaczej pozostałyby na zawsze w stanie „separating”. Zwraca liczbę projektów.
    pub async fn fail_interrupted_stem_projects(&self) -> Result<u64, StorageError> {
        let res =
            sqlx::query("UPDATE stem_projects SET status = 'failed' WHERE status = 'separating';")
                .execute(&self.pool)
                .await?;
        Ok(res.rows_affected())
    }
}
