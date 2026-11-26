//! Listening statistics, Recap summaries, ratings, favourites and smart queries (smart playlists).

use crate::{
    Database, RecapSummaryDto, RecapTopArtistDto, RecapTopTrackDto, StorageError, TrackRecord,
};
use sqlx::Row;

impl Database {
    /// Toggles a track's favourite status (is_favorite).
    pub async fn toggle_favorite(&self, track_id: i64) -> Result<bool, StorageError> {
        // One statement: the read and the write cannot interleave with another toggle.
        let new_val: Option<bool> = sqlx::query_scalar(
            "UPDATE tracks SET is_favorite = NOT COALESCE(is_favorite, 0) WHERE id = ?1 RETURNING is_favorite;",
        )
        .bind(track_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(new_val.unwrap_or(false))
    }

    /// Records a play of a track (increments play_count and updates last_played_at).
    pub async fn record_track_play(&self, track_id: i64) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            "UPDATE tracks SET play_count = COALESCE(play_count, 0) + 1, last_played_at = ?1 WHERE id = ?2;",
        )
        .bind(now)
        .bind(track_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Records a track's play time in milliseconds (increments total_play_time_ms and adds a listening_history entry).
    pub async fn record_track_listening(
        &self,
        track_id: i64,
        duration_ms: i64,
    ) -> Result<(), StorageError> {
        if duration_ms <= 0 {
            return Ok(());
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // The track counter and the listening history change together or not at all.
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "UPDATE tracks SET total_play_time_ms = COALESCE(total_play_time_ms, 0) + ?1, last_played_at = ?2 WHERE id = ?3;",
        )
        .bind(duration_ms)
        .bind(now)
        .bind(track_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO listening_history (track_id, duration_ms, played_at) VALUES (?1, ?2, ?3);",
        )
        .bind(track_id)
        .bind(duration_ms)
        .bind(now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    /// Returns the listening summary for a period (e.g. from a given UTC timestamp).
    pub async fn get_recap_summary(
        &self,
        period: &str,
        since_epoch_secs: i64,
    ) -> Result<RecapSummaryDto, StorageError> {
        let total_row = sqlx::query(
            "SELECT COALESCE(SUM(duration_ms), 0) as total_ms, COUNT(DISTINCT track_id) as tracks_count FROM listening_history WHERE played_at >= ?1;",
        )
        .bind(since_epoch_secs)
        .fetch_one(&self.pool)
        .await?;

        let mut total_listened_ms: i64 = total_row.try_get("total_ms").unwrap_or(0);
        let mut tracks_played_count: i64 = total_row.try_get("tracks_count").unwrap_or(0);

        if since_epoch_secs == 0 {
            if let Ok(tracks_total_row) = sqlx::query(
                "SELECT COALESCE(SUM(total_play_time_ms), 0) as total_ms, COUNT(DISTINCT id) as tracks_count FROM tracks WHERE play_count > 0 OR total_play_time_ms > 0;",
            )
            .fetch_one(&self.pool)
            .await
            {
                let tracks_total_ms: i64 = tracks_total_row.try_get("total_ms").unwrap_or(0);
                let tracks_count: i64 = tracks_total_row.try_get("tracks_count").unwrap_or(0);
                total_listened_ms = total_listened_ms.max(tracks_total_ms);
                tracks_played_count = tracks_played_count.max(tracks_count);
            }
        }

        let mut top_tracks = Vec::new();

        if since_epoch_secs > 0 {
            let top_track_rows = sqlx::query(
                r#"
                SELECT 
                    t.id, 
                    t.title, 
                    t.artist, 
                    a.title as album, 
                    COALESCE(t.play_count, 0) as play_count, 
                    COALESCE(h.dur, 0) as total_time_ms
                FROM (
                    SELECT track_id, SUM(duration_ms) as dur
                    FROM listening_history
                    WHERE played_at >= ?1
                    GROUP BY track_id
                    ORDER BY dur DESC
                    LIMIT 5
                ) h
                JOIN tracks t ON t.id = h.track_id
                LEFT JOIN albums a ON a.id = t.album_id
                ORDER BY h.dur DESC, t.play_count DESC;
                "#,
            )
            .bind(since_epoch_secs)
            .fetch_all(&self.pool)
            .await?;

            for row in top_track_rows {
                let id: i64 = row.try_get("id").unwrap_or(0);
                let title: String = row.try_get("title").unwrap_or_default();
                let artist: String = row.try_get("artist").unwrap_or_default();
                let album: Option<String> = row.try_get("album").ok();
                let play_count: i64 = row.try_get("play_count").unwrap_or(0);
                let total_time_ms: i64 = row.try_get("total_time_ms").unwrap_or(0);

                top_tracks.push(RecapTopTrackDto {
                    id,
                    title,
                    artist,
                    album,
                    play_count,
                    total_time_ms,
                    total_play_time_ms: total_time_ms,
                });
            }
        }

        if top_tracks.is_empty() {
            let all_time_rows = sqlx::query(
                r#"
                SELECT 
                    t.id, 
                    t.title, 
                    t.artist, 
                    a.title as album, 
                    COALESCE(t.play_count, 0) as play_count, 
                    COALESCE(t.total_play_time_ms, 0) as total_time_ms
                FROM tracks t
                LEFT JOIN albums a ON a.id = t.album_id
                WHERE COALESCE(t.play_count, 0) > 0 OR COALESCE(t.total_play_time_ms, 0) > 0
                ORDER BY COALESCE(t.play_count, 0) DESC, COALESCE(t.total_play_time_ms, 0) DESC
                LIMIT 5;
                "#,
            )
            .fetch_all(&self.pool)
            .await?;

            for row in all_time_rows {
                let id: i64 = row.try_get("id").unwrap_or(0);
                let title: String = row.try_get("title").unwrap_or_default();
                let artist: String = row.try_get("artist").unwrap_or_default();
                let album: Option<String> = row.try_get("album").ok();
                let play_count: i64 = row.try_get("play_count").unwrap_or(0);
                let total_time_ms: i64 = row.try_get("total_time_ms").unwrap_or(0);

                top_tracks.push(RecapTopTrackDto {
                    id,
                    title,
                    artist,
                    album,
                    play_count,
                    total_time_ms,
                    total_play_time_ms: total_time_ms,
                });
            }
        }

        let mut top_artists = Vec::new();

        if since_epoch_secs > 0 {
            let artist_rows = sqlx::query(
                r#"
                SELECT 
                    t.artist, 
                    SUM(h.duration_ms) as total_dur
                FROM listening_history h
                JOIN tracks t ON t.id = h.track_id
                WHERE h.played_at >= ?1 AND t.artist IS NOT NULL AND TRIM(t.artist) != ''
                GROUP BY t.artist
                ORDER BY total_dur DESC
                LIMIT 5;
                "#,
            )
            .bind(since_epoch_secs)
            .fetch_all(&self.pool)
            .await?;

            for r in artist_rows {
                let artist: String = r.try_get("artist").unwrap_or_default();
                let dur: i64 = r.try_get("total_dur").unwrap_or(0);
                if !artist.is_empty() {
                    let estimated_plays = std::cmp::max(1, dur / 180_000);
                    top_artists.push(RecapTopArtistDto {
                        artist,
                        play_count: estimated_plays,
                        total_time_ms: dur,
                    });
                }
            }
        }

        if top_artists.is_empty() {
            let fallback_artists = sqlx::query(
                r#"
                SELECT 
                    artist, 
                    SUM(COALESCE(play_count, 0)) as total_plays,
                    SUM(COALESCE(total_play_time_ms, 0)) as total_dur
                FROM tracks 
                WHERE artist IS NOT NULL AND TRIM(artist) != '' 
                GROUP BY artist 
                HAVING total_plays > 0 OR total_dur > 0
                ORDER BY total_plays DESC, total_dur DESC 
                LIMIT 5;
                "#,
            )
            .fetch_all(&self.pool)
            .await?;

            for r in fallback_artists {
                let artist: String = r.try_get("artist").unwrap_or_default();
                let plays: i64 = r.try_get("total_plays").unwrap_or(0);
                let dur: i64 = r.try_get("total_dur").unwrap_or(0);
                if !artist.is_empty() && (plays > 0 || dur > 0) {
                    top_artists.push(RecapTopArtistDto {
                        artist,
                        play_count: plays,
                        total_time_ms: if dur > 0 { dur } else { plays * 180_000 },
                    });
                }
            }
        }

        let total_listening_seconds = total_listened_ms / 1000;
        let total_tracks_played = tracks_played_count;

        Ok(RecapSummaryDto {
            period: period.to_string(),
            total_listened_ms,
            total_listening_seconds,
            tracks_played_count,
            total_tracks_played,
            top_tracks,
            top_artists,
        })
    }

    /// Resets a track's play counter.
    pub async fn reset_track_plays(&self, track_id: i64) -> Result<(), StorageError> {
        sqlx::query(
            "UPDATE tracks SET play_count = 0, total_play_time_ms = 0, last_played_at = NULL WHERE id = ?1;",
        )
        .bind(track_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Returns the tracks marked as favourites.
    pub async fn list_favorite_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE is_favorite = 1 ORDER BY artist, title;",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Returns the recently played tracks (History).
    pub async fn list_recently_played_tracks(
        &self,
        limit: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?1;",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Returns the most played tracks (Top Played).
    pub async fn list_top_played_tracks(
        &self,
        limit: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE play_count > 0 ORDER BY play_count DESC LIMIT ?1;",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Returns Hi-Res Audio tracks (24-bit or a sample rate > 48000 Hz).
    pub async fn list_hires_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE (bit_depth IS NOT NULL AND bit_depth >= 24) OR sample_rate > 48000 ORDER BY artist, title;",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Sets a track's star rating (0-5).
    pub async fn set_track_rating(&self, track_id: i64, rating: i64) -> Result<(), StorageError> {
        let clamped = rating.clamp(0, 5);
        sqlx::query("UPDATE tracks SET rating = ?1 WHERE id = ?2;")
            .bind(clamped)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Returns forgotten tracks (never played, or play_count = 0).
    pub async fn list_forgotten_tracks(
        &self,
        limit: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE play_count IS NULL OR play_count = 0 ORDER BY RANDOM() LIMIT ?1;",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Returns tracks with a high BPM (e.g. >= 130 BPM).
    pub async fn list_high_bpm_tracks(
        &self,
        min_bpm: f64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE bpm IS NOT NULL AND bpm >= ?1 ORDER BY bpm DESC;",
        )
        .bind(min_bpm)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Returns the top-rated tracks (rating >= 4).
    pub async fn list_top_rated_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE rating IS NOT NULL AND rating >= 4 ORDER BY rating DESC, play_count DESC;",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }
}
