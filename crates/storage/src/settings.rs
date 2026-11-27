//! App configuration, visual themes and DSP presets.

use crate::{Database, DspPresetRecord, StorageError};
use sqlx::Row;

impl Database {
    /// Stores a DSP preset.
    pub async fn save_dsp_preset(
        &self,
        name: &str,
        engine: &str,
        pitch: f64,
        tempo: f64,
        rate: f64,
    ) -> Result<i64, StorageError> {
        let mut conn = self.pool.acquire().await?;
        Self::save_dsp_preset_conn(&mut conn, name, engine, pitch, tempo, rate).await
    }

    async fn save_dsp_preset_conn(
        conn: &mut sqlx::SqliteConnection,
        name: &str,
        engine: &str,
        pitch: f64,
        tempo: f64,
        rate: f64,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO dsp_presets (name, engine, pitch_semitones, tempo_ratio, rate_ratio)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(name) DO UPDATE SET
                engine = excluded.engine,
                pitch_semitones = excluded.pitch_semitones,
                tempo_ratio = excluded.tempo_ratio,
                rate_ratio = excluded.rate_ratio
            RETURNING id;
            "#,
        )
        .bind(name)
        .bind(engine)
        .bind(pitch)
        .bind(tempo)
        .bind(rate)
        .fetch_one(conn)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Returns every DSP preset.
    pub async fn list_dsp_presets(&self) -> Result<Vec<DspPresetRecord>, StorageError> {
        let res = sqlx::query_as::<_, DspPresetRecord>("SELECT * FROM dsp_presets ORDER BY name;")
            .fetch_all(&self.pool)
            .await?;

        Ok(res)
    }

    /// Stores or updates a theme in the database.
    pub async fn save_theme(&self, theme: &domain::Theme) -> Result<(), StorageError> {
        let mut conn = self.pool.acquire().await?;
        Self::save_theme_conn(&mut conn, theme).await
    }

    async fn save_theme_conn(
        conn: &mut sqlx::SqliteConnection,
        theme: &domain::Theme,
    ) -> Result<(), StorageError> {
        theme.validate()?;
        let tokens_json = serde_json::to_string(&theme.tokens)?;

        sqlx::query(
            r#"
            INSERT INTO themes (
                id, name, schema_version, tokens_json, background_ref, overlay_opacity, blur_radius, attribution
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                schema_version = excluded.schema_version,
                tokens_json = excluded.tokens_json,
                background_ref = excluded.background_ref,
                overlay_opacity = excluded.overlay_opacity,
                blur_radius = excluded.blur_radius,
                attribution = excluded.attribution;
            "#,
        )
        .bind(&theme.id)
        .bind(&theme.name)
        .bind(theme.schema_version as i64)
        .bind(&tokens_json)
        .bind(&theme.background_ref)
        .bind(theme.overlay_opacity as f64)
        .bind(theme.blur_radius as f64)
        .bind(&theme.attribution)
        .execute(conn)
        .await?;

        Ok(())
    }

    /// Returns a theme by its ID.
    pub async fn get_theme(&self, id: &str) -> Result<Option<domain::Theme>, StorageError> {
        let row = sqlx::query(
            "SELECT id, name, schema_version, tokens_json, background_ref, overlay_opacity, blur_radius, attribution FROM themes WHERE id = ?1 LIMIT 1;"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(r) = row {
            let tokens_json: String = r.get("tokens_json");
            let tokens: domain::ThemeTokens = serde_json::from_str(&tokens_json)?;

            Ok(Some(domain::Theme {
                id: r.get("id"),
                name: r.get("name"),
                schema_version: r.get::<i64, _>("schema_version") as u32,
                tokens,
                background_ref: r.get("background_ref"),
                overlay_opacity: r.get::<f64, _>("overlay_opacity") as f32,
                blur_radius: r.get::<f64, _>("blur_radius") as f32,
                attribution: r.get("attribution"),
            }))
        } else {
            Ok(None)
        }
    }

    /// Returns every available theme.
    pub async fn list_themes(&self) -> Result<Vec<domain::Theme>, StorageError> {
        let rows = sqlx::query(
            "SELECT id, name, schema_version, tokens_json, background_ref, overlay_opacity, blur_radius, attribution FROM themes ORDER BY id;"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut themes = Vec::with_capacity(rows.len());
        for r in rows {
            let tokens_json: String = r.get("tokens_json");
            let tokens: domain::ThemeTokens = serde_json::from_str(&tokens_json)?;

            themes.push(domain::Theme {
                id: r.get("id"),
                name: r.get("name"),
                schema_version: r.get::<i64, _>("schema_version") as u32,
                tokens,
                background_ref: r.get("background_ref"),
                overlay_opacity: r.get::<f64, _>("overlay_opacity") as f32,
                blur_radius: r.get::<f64, _>("blur_radius") as f32,
                attribution: r.get("attribution"),
            });
        }

        Ok(themes)
    }

    /// Stores an app setting (key-value).
    pub async fn set_app_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            INSERT INTO app_settings (key, value) VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Returns an app setting.
    pub async fn get_app_setting(&self, key: &str) -> Result<Option<String>, StorageError> {
        let row = sqlx::query("SELECT value FROM app_settings WHERE key = ?1 LIMIT 1;")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| r.get("value")))
    }

    /// Every app setting in one query (e.g. at startup, instead of many reads).
    pub async fn list_app_settings(
        &self,
    ) -> Result<std::collections::HashMap<String, String>, StorageError> {
        let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM app_settings;")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows.into_iter().collect())
    }

    /// Atomically imports validated DSP presets, themes, and playlists (with pre-resolved track IDs)
    /// inside a single SQLite transaction.
    ///
    /// Returns `(restored_presets, restored_themes, restored_playlists)`.
    pub async fn import_profile_entries(
        &self,
        dsp_presets: &[(&str, &str, f64, f64, f64)],
        themes: &[domain::Theme],
        playlists: &[(String, Vec<i64>)],
    ) -> Result<(usize, usize, usize), StorageError> {
        let mut tx = self.pool.begin().await?;
        let mut restored_presets = 0;
        let mut restored_themes = 0;
        let mut restored_playlists = 0;

        for &(name, engine, pitch, tempo, rate) in dsp_presets {
            if Self::save_dsp_preset_conn(&mut tx, name, engine, pitch, tempo, rate)
                .await
                .is_ok()
            {
                restored_presets += 1;
            }
        }

        for theme in themes {
            if Self::save_theme_conn(&mut tx, theme).await.is_ok() {
                restored_themes += 1;
            }
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        for (name, track_ids) in playlists {
            if let Ok(row) = sqlx::query(
                "INSERT INTO playlists (name, created_at) VALUES (?1, ?2) RETURNING id;",
            )
            .bind(name)
            .bind(now)
            .fetch_one(&mut *tx)
            .await
            {
                let pl_id: i64 = row.get("id");
                restored_playlists += 1;
                for (pos, &track_id) in track_ids.iter().enumerate() {
                    let _ = sqlx::query(
                        "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3);",
                    )
                    .bind(pl_id)
                    .bind(track_id)
                    .bind(pos as i64)
                    .execute(&mut *tx)
                    .await;
                }
            }
        }

        tx.commit().await?;
        Ok((restored_presets, restored_themes, restored_playlists))
    }
}
