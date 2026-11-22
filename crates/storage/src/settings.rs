//! Zarządzanie konfiguracją aplikacji, motywami graficznymi oraz presetami DSP.

use crate::{Database, DspPresetRecord, StorageError};
use sqlx::Row;

impl Database {
    /// Zapisuje preset DSP.
    pub async fn save_dsp_preset(
        &self,
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
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Pobiera listę wszystkich presetów DSP.
    pub async fn list_dsp_presets(&self) -> Result<Vec<DspPresetRecord>, StorageError> {
        let res = sqlx::query_as::<_, DspPresetRecord>("SELECT * FROM dsp_presets ORDER BY name;")
            .fetch_all(&self.pool)
            .await?;

        Ok(res)
    }

    /// Zapisuje lub aktualizuje motyw w bazie danych.
    pub async fn save_theme(&self, theme: &domain::Theme) -> Result<(), StorageError> {
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
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Pobiera motyw po ID.
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

    /// Pobiera listę wszystkich dostępnych motywów.
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

    /// Zapisuje ustawienie aplikacji (klucz-wartość).
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

    /// Pobiera ustawienie aplikacji.
    pub async fn get_app_setting(&self, key: &str) -> Result<Option<String>, StorageError> {
        let row = sqlx::query("SELECT value FROM app_settings WHERE key = ?1 LIMIT 1;")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| r.get("value")))
    }
}
