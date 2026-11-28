//! Playback bookmarks and multi-point time markers (cue points).

use crate::{Database, StorageError};
use sqlx::Row;

impl Database {
    /// Stores the playback position (bookmark) of a track.
    pub async fn save_bookmark(&self, track_id: i64, position_ms: u64) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO playback_bookmarks (track_id, position_ms, updated_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(track_id) DO UPDATE SET
                position_ms = excluded.position_ms,
                updated_at = excluded.updated_at;
            "#,
        )
        .bind(track_id)
        .bind(position_ms as i64)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Returns the stored position of a track.
    pub async fn get_bookmark(&self, track_id: i64) -> Result<Option<u64>, StorageError> {
        let rec = sqlx::query("SELECT position_ms FROM playback_bookmarks WHERE track_id = ?1;")
            .bind(track_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(rec.map(|r| r.get::<i64, _>("position_ms") as u64))
    }

    /// Removes the playback bookmark of a track.
    pub async fn delete_bookmark(&self, track_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playback_bookmarks WHERE track_id = ?1;")
            .bind(track_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Adds a new named time marker (bookmark / cue point) to a track.
    pub async fn add_track_bookmark(
        &self,
        track_id: i64,
        name: &str,
        position_ms: u64,
    ) -> Result<domain::TrackBookmark, StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let rec = sqlx::query(
            r#"
            INSERT INTO track_bookmarks (track_id, name, position_ms, created_at)
            VALUES (?1, ?2, ?3, ?4)
            RETURNING id, track_id, name, position_ms, created_at;
            "#,
        )
        .bind(track_id)
        .bind(name)
        .bind(position_ms as i64)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(domain::TrackBookmark {
            id: rec.get("id"),
            track_id: rec.get("track_id"),
            name: rec.get("name"),
            position_ms: rec.get::<i64, _>("position_ms") as u64,
            created_at: rec.get("created_at"),
        })
    }

    /// Returns all bookmarks of a track, sorted by time ascending.
    pub async fn get_track_bookmarks(
        &self,
        track_id: i64,
    ) -> Result<Vec<domain::TrackBookmark>, StorageError> {
        let rows = sqlx::query(
            "SELECT id, track_id, name, position_ms, created_at FROM track_bookmarks WHERE track_id = ?1 ORDER BY position_ms ASC;",
        )
        .bind(track_id)
        .fetch_all(&self.pool)
        .await?;

        let bookmarks = rows
            .into_iter()
            .map(|r| domain::TrackBookmark {
                id: r.get("id"),
                track_id: r.get("track_id"),
                name: r.get("name"),
                position_ms: r.get::<i64, _>("position_ms") as u64,
                created_at: r.get("created_at"),
            })
            .collect();

        Ok(bookmarks)
    }

    /// Updates the name of a time marker.
    pub async fn update_track_bookmark(
        &self,
        bookmark_id: i64,
        name: &str,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE track_bookmarks SET name = ?1 WHERE id = ?2;")
            .bind(name)
            .bind(bookmark_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Removes every time marker of a track and returns how many were deleted.
    pub async fn delete_all_track_bookmarks(&self, track_id: i64) -> Result<u64, StorageError> {
        let result = sqlx::query("DELETE FROM track_bookmarks WHERE track_id = ?1;")
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Removes the time marker with the given ID.
    pub async fn delete_track_bookmark(&self, bookmark_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM track_bookmarks WHERE id = ?1;")
            .bind(bookmark_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
