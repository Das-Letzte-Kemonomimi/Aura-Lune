//! Playlists, playlist tracks and the playback queue state.

use crate::{Database, QueueCursorState, StorageError, TrackRecord};
use sqlx::Row;

impl Database {
    /// Creates a new playlist and returns its ID.
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

    /// Deletes a playlist with all its track entries.
    pub async fn delete_playlist(&self, playlist_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playlists WHERE id = ?1;")
            .bind(playlist_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Returns every playlist with its number of tracks.
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

    /// Appends a track to the end of the chosen playlist.
    pub async fn add_track_to_playlist(
        &self,
        playlist_id: i64,
        track_id: i64,
    ) -> Result<(), StorageError> {
        // The position is computed in the same statement as the insert, so two parallel adds
        // do not get the same position.
        sqlx::query(
            r#"
            INSERT INTO playlist_tracks (playlist_id, track_id, position)
            SELECT ?1, ?2, COALESCE(MAX(position), -1) + 1
            FROM playlist_tracks WHERE playlist_id = ?1;
            "#,
        )
        .bind(playlist_id)
        .bind(track_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Appends many tracks to a playlist in a single transaction, preserving slice order.
    pub async fn add_tracks_to_playlist(
        &self,
        playlist_id: i64,
        track_ids: &[i64],
    ) -> Result<usize, StorageError> {
        if track_ids.is_empty() {
            return Ok(0);
        }
        let mut tx = self.pool.begin().await?;
        let base_pos: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?1;",
        )
        .bind(playlist_id)
        .fetch_one(&mut *tx)
        .await?;

        for (offset, &track_id) in track_ids.iter().enumerate() {
            sqlx::query(
                "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3);",
            )
            .bind(playlist_id)
            .bind(track_id)
            .bind(base_pos + offset as i64)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(track_ids.len())
    }

    /// Removes a track from a playlist.
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

    /// Returns a playlist's tracks in `position` order.
    pub async fn get_playlist_tracks(
        &self,
        playlist_id: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let rows = sqlx::query_as::<_, TrackRecord>(
            r#"
            -- Every column: favourites, rating, BPM and ReplayGain are visible in playlists too.
            SELECT t.*
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

    /// Stores the current playback queue state (items + cursor) and clears any stale cursor overlay.
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
            INSERT INTO queue_state (id, queue_json, cursor_json, updated_at)
            VALUES (1, ?1, NULL, ?2)
            ON CONFLICT(id) DO UPDATE SET
                queue_json = excluded.queue_json,
                cursor_json = NULL,
                updated_at = excluded.updated_at;
            "#,
        )
        .bind(queue_json)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Updates only the persisted queue cursor/modes without rewriting `queue_json`.
    ///
    /// Returns `Ok(false)` when no `queue_state` row exists yet so the caller can fall back to
    /// saving the full queue state.
    pub async fn save_queue_cursor(&self, cursor: &QueueCursorState) -> Result<bool, StorageError> {
        let cursor_json = serde_json::to_string(cursor)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let res =
            sqlx::query("UPDATE queue_state SET cursor_json = ?1, updated_at = ?2 WHERE id = 1;")
                .bind(cursor_json)
                .bind(now)
                .execute(&self.pool)
                .await?;

        Ok(res.rows_affected() > 0)
    }

    /// Loads the stored playback queue state, overlaying any newer cursor-only update.
    pub async fn load_queue_state(&self) -> Result<Option<domain::PlaybackQueue>, StorageError> {
        let row =
            sqlx::query("SELECT queue_json, cursor_json FROM queue_state WHERE id = 1 LIMIT 1;")
                .fetch_optional(&self.pool)
                .await?;

        if let Some(r) = row {
            let json_str: String = r.get("queue_json");
            let mut q: domain::PlaybackQueue = serde_json::from_str(&json_str)?;
            if let Ok(Some(cursor_str)) = r.try_get::<Option<String>, _>("cursor_json") {
                if !cursor_str.is_empty() {
                    let cursor: QueueCursorState = serde_json::from_str(&cursor_str)?;
                    q.current_index = cursor.current_index;
                    q.loop_mode = cursor.loop_mode;
                    q.shuffle = cursor.shuffle;
                    q.shuffle_cursor = cursor.shuffle_cursor;
                }
            }
            Ok(Some(q))
        } else {
            Ok(None)
        }
    }
}
