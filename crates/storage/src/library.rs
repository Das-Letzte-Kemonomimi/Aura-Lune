//! Music library operations: artists, albums, tracks, duplicates and path updates.

use crate::{AlbumRecord, ArtistRecord, Database, DuplicateGroup, StorageError, TrackRecord};
use sqlx::{FromRow, Row};

impl Database {
    async fn upsert_artist_conn(
        conn: &mut sqlx::SqliteConnection,
        name: &str,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO artists (name) VALUES (?1)
            ON CONFLICT(name) DO UPDATE SET name=excluded.name
            RETURNING id;
            "#,
        )
        .bind(name)
        .fetch_one(conn)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    async fn upsert_album_conn(
        conn: &mut sqlx::SqliteConnection,
        title: &str,
        album_artist: &str,
        year: Option<i64>,
        cover_path: Option<&str>,
        release_mbid: Option<&str>,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO albums (title, album_artist, year, cover_path, release_mbid)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(title, album_artist) DO UPDATE SET
                year = COALESCE(excluded.year, albums.year),
                cover_path = COALESCE(NULLIF(albums.cover_path, ''), excluded.cover_path),
                release_mbid = COALESCE(NULLIF(albums.release_mbid, ''), excluded.release_mbid)
            RETURNING id;
            "#,
        )
        .bind(title)
        .bind(album_artist)
        .bind(year)
        .bind(cover_path)
        .bind(release_mbid)
        .fetch_one(conn)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    async fn upsert_track_conn(
        conn: &mut sqlx::SqliteConnection,
        track: &TrackRecord,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO tracks (
                path, title, artist, album_artist, album_id, disc_no, track_no,
                duration_ms, format, sample_rate, channels, bit_depth, file_size, modified_time,
                bpm, initial_key, replaygain_track_gain, replaygain_track_peak, added_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                CAST(strftime('%s', 'now') AS INTEGER))
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album_artist = excluded.album_artist,
                album_id = excluded.album_id,
                disc_no = excluded.disc_no,
                track_no = excluded.track_no,
                duration_ms = excluded.duration_ms,
                format = excluded.format,
                sample_rate = excluded.sample_rate,
                channels = excluded.channels,
                bit_depth = excluded.bit_depth,
                file_size = excluded.file_size,
                modified_time = excluded.modified_time,
                bpm = COALESCE(excluded.bpm, tracks.bpm),
                initial_key = COALESCE(excluded.initial_key, tracks.initial_key),
                replaygain_track_gain = COALESCE(excluded.replaygain_track_gain, tracks.replaygain_track_gain),
                replaygain_track_peak = COALESCE(excluded.replaygain_track_peak, tracks.replaygain_track_peak)
            RETURNING id;
            "#,
        )
        .bind(&track.path)
        .bind(&track.title)
        .bind(&track.artist)
        .bind(&track.album_artist)
        .bind(track.album_id)
        .bind(track.disc_no)
        .bind(track.track_no)
        .bind(track.duration_ms)
        .bind(&track.format)
        .bind(track.sample_rate)
        .bind(track.channels)
        .bind(track.bit_depth)
        .bind(track.file_size)
        .bind(track.modified_time)
        .bind(track.bpm)
        .bind(&track.initial_key)
        .bind(track.replaygain_track_gain)
        .bind(track.replaygain_track_peak)
        .fetch_one(conn)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    async fn prune_album_if_empty_conn(
        conn: &mut sqlx::SqliteConnection,
        album_id: i64,
    ) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            DELETE FROM albums
            WHERE id = ?1
              AND NOT EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = ?1);
            "#,
        )
        .bind(album_id)
        .execute(conn)
        .await?;
        Ok(())
    }

    /// Inserts or updates an artist and returns its ID.
    pub async fn upsert_artist(&self, name: &str) -> Result<i64, StorageError> {
        let mut conn = self.pool.acquire().await?;
        Self::upsert_artist_conn(&mut conn, name).await
    }

    /// Inserts or updates an album and returns its ID.
    pub async fn upsert_album(
        &self,
        title: &str,
        album_artist: &str,
        year: Option<i64>,
        cover_path: Option<&str>,
        release_mbid: Option<&str>,
    ) -> Result<i64, StorageError> {
        let mut conn = self.pool.acquire().await?;
        Self::upsert_album_conn(
            &mut conn,
            title,
            album_artist,
            year,
            cover_path,
            release_mbid,
        )
        .await
    }

    /// Atomically saves a scanned track along with its artist and album in one transaction.
    ///
    /// Prevents orphaned empty albums if persisting the track fails.
    pub async fn save_scanned_track(
        &self,
        track: &TrackRecord,
        album_title: &str,
        album_artist: &str,
        year: Option<i64>,
        cover_path: Option<&str>,
        release_mbid: Option<&str>,
    ) -> Result<i64, StorageError> {
        let mut tx = self.pool.begin().await?;
        Self::upsert_artist_conn(&mut tx, &track.artist).await?;
        let album_id = Self::upsert_album_conn(
            &mut tx,
            album_title,
            album_artist,
            year,
            cover_path,
            release_mbid,
        )
        .await?;
        let mut linked = track.clone();
        linked.album_id = Some(album_id);
        let track_id = Self::upsert_track_conn(&mut tx, &linked).await?;
        tx.commit().await?;
        Ok(track_id)
    }

    /// Updates an album's cover and MBID.
    pub async fn update_album_cover(
        &self,
        album_id: i64,
        cover_path: &str,
        release_mbid: Option<&str>,
    ) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            UPDATE albums
            SET cover_path = ?1,
                release_mbid = COALESCE(?2, release_mbid)
            WHERE id = ?3;
            "#,
        )
        .bind(cover_path)
        .bind(release_mbid)
        .bind(album_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Inserts or updates a track.
    pub async fn upsert_track(&self, track: &TrackRecord) -> Result<i64, StorageError> {
        let mut conn = self.pool.acquire().await?;
        Self::upsert_track_conn(&mut conn, track).await
    }

    /// Updates a track's detected or manually set BPM and musical key.
    pub async fn update_track_key_bpm(
        &self,
        track_id: i64,
        bpm: f64,
        initial_key: &str,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE tracks SET bpm = ?1, initial_key = ?2 WHERE id = ?3;")
            .bind(bpm)
            .bind(initial_key)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Updates a track's computed ReplayGain values (Track Gain and Track Peak).
    pub async fn update_track_replaygain(
        &self,
        track_id: i64,
        track_gain: f64,
        track_peak: f64,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "UPDATE tracks SET replaygain_track_gain = ?1, replaygain_track_peak = ?2 WHERE id = ?3;",
        )
        .bind(track_gain)
        .bind(track_peak)
        .bind(track_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Returns the stored BPM and musical key of a track.
    pub async fn get_track_key_bpm(
        &self,
        track_id: i64,
    ) -> Result<Option<(f64, String)>, StorageError> {
        let row = sqlx::query("SELECT bpm, initial_key FROM tracks WHERE id = ?1 LIMIT 1;")
            .bind(track_id)
            .fetch_optional(&self.pool)
            .await?;
        if let Some(r) = row {
            let bpm: Option<f64> = r.try_get("bpm").ok();
            let key: Option<String> = r.try_get("initial_key").ok();
            if let (Some(b), Some(k)) = (bpm, key) {
                return Ok(Some((b, k)));
            }
        }
        Ok(None)
    }

    /// Links a track to an album.
    pub async fn link_track_to_album(
        &self,
        track_id: i64,
        album_id: i64,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE tracks SET album_id = ?1 WHERE id = ?2;")
            .bind(album_id)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Size and modification time of every indexed file (`path → (size, mtime)`) in
    /// one query: the scanner compares them in memory instead of asking the database per file.
    pub async fn track_file_stamps(
        &self,
    ) -> Result<std::collections::HashMap<String, (i64, i64)>, StorageError> {
        let rows = sqlx::query("SELECT path, file_size, modified_time FROM tracks;")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(|r| (r.get("path"), (r.get("file_size"), r.get("modified_time"))))
            .collect())
    }

    /// Maps track paths to their `album_id` for albums that currently have no cover path.
    pub async fn track_album_ids_without_cover(
        &self,
    ) -> Result<std::collections::HashMap<String, i64>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT t.path, a.id AS album_id
            FROM tracks t
            JOIN albums a ON a.id = t.album_id
            WHERE a.cover_path IS NULL OR a.cover_path = '';
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| (r.get("path"), r.get("album_id")))
            .collect())
    }

    /// Returns a track by its path on disk.
    pub async fn get_track_by_path(&self, path: &str) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE path = ?1 LIMIT 1;")
            .bind(path)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Finds a track by path or URI (handles the file:// prefix and flexible matching).
    pub async fn find_track_by_path_or_uri(
        &self,
        path_or_uri: &str,
    ) -> Result<Option<TrackRecord>, StorageError> {
        let clean_path = path_or_uri.strip_prefix("file://").unwrap_or(path_or_uri);
        let with_file_uri = format!("file://{}", clean_path);

        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE path = ?1 OR path = ?2 LIMIT 1;",
        )
        .bind(clean_path)
        .bind(&with_file_uri)
        .fetch_optional(&self.pool)
        .await?;

        Ok(res)
    }

    /// Returns a track by its ID.
    pub async fn get_track_by_id(&self, id: i64) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE id = ?1 LIMIT 1;")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Returns every track in the library.
    pub async fn list_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks ORDER BY artist, album_id, track_no, title;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(res)
    }

    /// Returns every album in the library.
    pub async fn list_albums(&self) -> Result<Vec<AlbumRecord>, StorageError> {
        let res = sqlx::query_as::<_, AlbumRecord>(
            "SELECT * FROM albums ORDER BY album_artist, year, title;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(res)
    }

    /// The first track in `list_tracks` order (without loading the whole library).
    pub async fn first_track(&self) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks ORDER BY artist, album_id, track_no, title LIMIT 1;",
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(res)
    }

    /// Returns the total number of tracks in the library.
    pub async fn count_tracks(&self) -> Result<i64, StorageError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks;")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    /// Returns the total number of albums in the library.
    pub async fn count_albums(&self) -> Result<i64, StorageError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM albums;")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    /// Returns an album by its ID.
    pub async fn get_album_by_id(&self, id: i64) -> Result<Option<AlbumRecord>, StorageError> {
        let res = sqlx::query_as::<_, AlbumRecord>("SELECT * FROM albums WHERE id = ?1 LIMIT 1;")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Builds a queue item for a track, filling in the album title from the `albums` table.
    pub async fn queue_item_for_track(&self, track: &TrackRecord) -> domain::queue::QueueItem {
        let album_title = match track.album_id {
            Some(id) => self
                .get_album_by_id(id)
                .await
                .ok()
                .flatten()
                .map(|a| a.title),
            None => None,
        };
        track.to_queue_item(album_title)
    }

    /// Returns every artist.
    pub async fn list_artists(&self) -> Result<Vec<ArtistRecord>, StorageError> {
        let res = sqlx::query_as::<_, ArtistRecord>("SELECT * FROM artists ORDER BY name;")
            .fetch_all(&self.pool)
            .await?;

        Ok(res)
    }

    /// Finds groups of potential duplicate tracks in the library by normalised title and artist.
    pub async fn find_duplicate_tracks(&self) -> Result<Vec<DuplicateGroup>, StorageError> {
        // One query instead of a separate query per duplicate group (N+1).
        // SQLite computes the group key (LOWER/TRIM), so grouping matches the HAVING exactly.
        let rows = sqlx::query(
            r#"
            WITH dups AS (
                SELECT LOWER(TRIM(title)) AS nt, LOWER(TRIM(artist)) AS na, COUNT(*) AS cnt
                FROM tracks
                WHERE title != '' AND artist != ''
                GROUP BY LOWER(TRIM(title)), LOWER(TRIM(artist))
                HAVING cnt > 1
            )
            SELECT t.*, d.nt AS dup_title, d.na AS dup_artist, d.cnt AS dup_count
            FROM tracks t
            JOIN dups d ON LOWER(TRIM(t.title)) = d.nt AND LOWER(TRIM(t.artist)) = d.na
            ORDER BY d.cnt DESC, d.nt ASC, d.na ASC,
                     t.format ASC, t.bit_depth DESC, t.sample_rate DESC, t.file_size DESC;
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut groups: Vec<DuplicateGroup> = Vec::new();
        let mut current_key: Option<(String, String)> = None;
        for row in rows {
            let key: (String, String) = (row.get("dup_title"), row.get("dup_artist"));
            let track = TrackRecord::from_row(&row)?;
            if current_key.as_ref() != Some(&key) {
                groups.push(DuplicateGroup {
                    key: format!("{} — {}", track.artist, track.title),
                    count: row.get::<i64, _>("dup_count") as usize,
                    tracks: Vec::new(),
                });
                current_key = Some(key);
            }
            if let Some(group) = groups.last_mut() {
                group.tracks.push(track);
            }
        }

        Ok(groups)
    }

    /// Removes a track record from the database (e.g. during deduplication) and
    /// prunes its album if no tracks remain in it.
    pub async fn delete_track(&self, track_id: i64) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        let album_id: Option<i64> =
            sqlx::query_scalar("SELECT album_id FROM tracks WHERE id = ?1 LIMIT 1;")
                .bind(track_id)
                .fetch_optional(&mut *tx)
                .await?
                .flatten();
        sqlx::query("DELETE FROM tracks WHERE id = ?1;")
            .bind(track_id)
            .execute(&mut *tx)
            .await?;
        if let Some(aid) = album_id {
            Self::prune_album_if_empty_conn(&mut tx, aid).await?;
        }
        tx.commit().await?;
        Ok(())
    }

    /// Updates a track's file path in the database after a rename / move on disk.
    pub async fn update_track_path(
        &self,
        track_id: i64,
        new_path: &str,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE tracks SET path = ?1 WHERE id = ?2;")
            .bind(new_path)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Removes the tracks under the `root` directory whose paths are no longer in the list of
    /// active files. Tracks outside `root` (other library folders) are not touched.
    /// Also prunes any affected albums that are left with zero tracks.
    /// All deletions run in one transaction.
    pub async fn delete_stale_tracks(
        &self,
        root: &str,
        active_paths: &[String],
    ) -> Result<usize, StorageError> {
        let prefix = format!("{}/", root.trim_end_matches('/'));
        let candidates: Vec<(i64, String, Option<i64>)> = sqlx::query_as(
            "SELECT id, path, album_id FROM tracks WHERE substr(path, 1, length(?1)) = ?1;",
        )
        .bind(&prefix)
        .fetch_all(&self.pool)
        .await?;

        let active_set: std::collections::HashSet<&str> =
            active_paths.iter().map(|s| s.as_str()).collect();
        let mut stale_ids: Vec<i64> = Vec::new();
        let mut touched_albums = std::collections::HashSet::new();
        for (id, path, album_id) in candidates {
            if !active_set.contains(path.as_str()) {
                stale_ids.push(id);
                if let Some(aid) = album_id {
                    touched_albums.insert(aid);
                }
            }
        }
        if stale_ids.is_empty() {
            return Ok(0);
        }

        let mut tx = self.pool.begin().await?;
        for id in &stale_ids {
            sqlx::query("DELETE FROM tracks WHERE id = ?1;")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        for aid in touched_albums {
            Self::prune_album_if_empty_conn(&mut tx, aid).await?;
        }
        tx.commit().await?;
        Ok(stale_ids.len())
    }

    /// Updates a track's metadata in the SQLite database.
    #[allow(clippy::too_many_arguments)]
    pub async fn update_track_metadata(
        &self,
        track_id: i64,
        title: &str,
        artist: &str,
        album_artist: Option<&str>,
        track_no: Option<i64>,
        disc_no: Option<i64>,
        album_title: Option<&str>,
        year: Option<i64>,
    ) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        let old_album_id: Option<i64> =
            sqlx::query_scalar("SELECT album_id FROM tracks WHERE id = ?1 LIMIT 1;")
                .bind(track_id)
                .fetch_optional(&mut *tx)
                .await?
                .flatten();

        let mut album_id = None;
        if let Some(al_title) = album_title {
            let al_artist = album_artist.unwrap_or(artist);
            let id =
                Self::upsert_album_conn(&mut tx, al_title, al_artist, year, None, None).await?;
            album_id = Some(id);
        }

        sqlx::query(
            r#"
            UPDATE tracks
            SET title = ?1,
                artist = ?2,
                album_artist = ?3,
                album_id = COALESCE(?4, album_id),
                track_no = ?5,
                disc_no = ?6
            WHERE id = ?7;
            "#,
        )
        .bind(title)
        .bind(artist)
        .bind(album_artist)
        .bind(album_id)
        .bind(track_no)
        .bind(disc_no)
        .bind(track_id)
        .execute(&mut *tx)
        .await?;

        if let (Some(old_aid), Some(new_aid)) = (old_album_id, album_id) {
            if old_aid != new_aid {
                Self::prune_album_if_empty_conn(&mut tx, old_aid).await?;
            }
        }
        tx.commit().await?;
        Ok(())
    }
}
