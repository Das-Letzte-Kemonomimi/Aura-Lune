//! Zarządzanie playlistami, utworami w playlistach oraz stanem kolejki odtwarzania.

use crate::{Database, StorageError, TrackRecord};
use sqlx::Row;

impl Database {
    /// Tworzy nową playlistę i zwraca jej ID.
    pub async fn create_playlist(&self, name: &str) -> Result<i64, StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let rec = sqlx::query(
            r#"
            INSERT INTO playlists (name, created_at)
            VALUES (?1, ?2)
            RETURNING id;
            "#,
        )
        .bind(name)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Usuwa playlistę wraz ze wszystkimi powiązanymi wpisami utworów.
    pub async fn delete_playlist(&self, playlist_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playlists WHERE id = ?1;")
            .bind(playlist_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Zwraca listę wszystkich playlist wraz z liczbą przypisanych utworów.
    pub async fn list_playlists(&self) -> Result<Vec<domain::Playlist>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT p.id, p.name, p.created_at, COUNT(pt.track_id) as track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            GROUP BY p.id
            ORDER BY p.name ASC;
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let playlists = rows
            .into_iter()
            .map(|r| domain::Playlist {
                id: r.get("id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
                track_count: r.get::<i64, _>("track_count") as usize,
            })
            .collect();

        Ok(playlists)
    }

    /// Dodaje utwór na koniec wybranej playlisty.
    pub async fn add_track_to_playlist(
        &self,
        playlist_id: i64,
        track_id: i64,
    ) -> Result<(), StorageError> {
        let next_pos: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?1;",
        )
        .bind(playlist_id)
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO playlist_tracks (playlist_id, track_id, position)
            VALUES (?1, ?2, ?3);
            "#,
        )
        .bind(playlist_id)
        .bind(track_id)
        .bind(next_pos)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Usuwa utwór z playlisty.
    pub async fn remove_track_from_playlist(
        &self,
        playlist_id: i64,
        track_id: i64,
    ) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2;")
            .bind(playlist_id)
            .bind(track_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Pobiera utwory z playlisty z zachowaniem kolejności `position`.
    pub async fn get_playlist_tracks(
        &self,
        playlist_id: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let rows = sqlx::query_as::<_, TrackRecord>(
            r#"
            SELECT t.id, t.path, t.title, t.artist, t.album_artist, t.album_id,
                   t.disc_no, t.track_no, t.duration_ms, t.format, t.sample_rate,
                   t.channels, t.bit_depth, t.file_size, t.modified_time
            FROM tracks t
            JOIN playlist_tracks pt ON t.id = pt.track_id
            WHERE pt.playlist_id = ?1
            ORDER BY pt.position ASC;
            "#,
        )
        .bind(playlist_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Zapisuje bieżący stan kolejki odtwarzania.
    pub async fn save_queue_state(
        &self,
        queue: &domain::PlaybackQueue,
    ) -> Result<(), StorageError> {
        let queue_json = serde_json::to_string(queue)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO queue_state (id, queue_json, updated_at)
            VALUES (1, ?1, ?2)
            ON CONFLICT(id) DO UPDATE SET
                queue_json = excluded.queue_json,
                updated_at = excluded.updated_at;
            "#,
        )
        .bind(queue_json)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Ładuje zapisany stan kolejki odtwarzania.
    pub async fn load_queue_state(&self) -> Result<Option<domain::PlaybackQueue>, StorageError> {
        let row = sqlx::query("SELECT queue_json FROM queue_state WHERE id = 1 LIMIT 1;")
            .fetch_optional(&self.pool)
            .await?;

        if let Some(r) = row {
            let json_str: String = r.get("queue_json");
            let q: domain::PlaybackQueue = serde_json::from_str(&json_str)?;
            Ok(Some(q))
        } else {
            Ok(None)
        }
    }
}
