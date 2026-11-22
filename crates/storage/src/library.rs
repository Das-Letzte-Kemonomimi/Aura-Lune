//! Operacje na bibliotece muzycznej: wykonawcy, albumy, utwory, duplikaty oraz aktualizacje ścieżek.

use crate::{AlbumRecord, ArtistRecord, Database, DuplicateGroup, StorageError, TrackRecord};
use sqlx::{FromRow, Row};

impl Database {
    /// Wstawia lub aktualizuje artystę i zwraca jego ID.
    pub async fn upsert_artist(&self, name: &str) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO artists (name) VALUES (?1)
            ON CONFLICT(name) DO UPDATE SET name=excluded.name
            RETURNING id;
            "#,
        )
        .bind(name)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Wstawia lub aktualizuje album i zwraca jego ID.
    pub async fn upsert_album(
        &self,
        title: &str,
        album_artist: &str,
        year: Option<i64>,
        cover_path: Option<&str>,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO albums (title, album_artist, year, cover_path)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(title, album_artist) DO UPDATE SET
                year = COALESCE(excluded.year, albums.year),
                cover_path = COALESCE(albums.cover_path, excluded.cover_path)
            RETURNING id;
            "#,
        )
        .bind(title)
        .bind(album_artist)
        .bind(year)
        .bind(cover_path)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Aktualizuje okładkę oraz identyfikator MBID dla albumu.
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

    /// Wstawia lub aktualizuje utwór.
    pub async fn upsert_track(&self, track: &TrackRecord) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO tracks (
                path, title, artist, album_artist, album_id, disc_no, track_no,
                duration_ms, format, sample_rate, channels, bit_depth, file_size, modified_time,
                bpm, initial_key, replaygain_track_gain, replaygain_track_peak
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
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
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Aktualizuje wykryty lub ręcznie ustawiony BPM oraz klucz muzyczny dla utworu.
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

    /// Aktualizuje obliczone wartości ReplayGain (Track Gain i Track Peak) dla utworu.
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

    /// Pobiera zapisany BPM oraz klucz muzyczny dla danego utworu.
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

    /// Powiązuje dany utwór z albumem.
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

    /// Pobiera utwór po ścieżce na dysku.
    pub async fn get_track_by_path(&self, path: &str) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE path = ?1 LIMIT 1;")
            .bind(path)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Wyszukuje utwór po ścieżce lub URI (obsługuje prefiks file:// oraz dopasowanie elastyczne).
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

    /// Pobiera utwór po jego identyfikatorze ID.
    pub async fn get_track_by_id(&self, id: i64) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE id = ?1 LIMIT 1;")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Pobiera listę wszystkich utworów w bibliotece.
    pub async fn list_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks ORDER BY artist, album_id, track_no, title;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(res)
    }

    /// Pobiera listę wszystkich albumów w bibliotece.
    pub async fn list_albums(&self) -> Result<Vec<AlbumRecord>, StorageError> {
        let res = sqlx::query_as::<_, AlbumRecord>(
            "SELECT * FROM albums ORDER BY album_artist, year, title;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(res)
    }

    /// Zwraca łączną liczbę utworów w bibliotece.
    /// Pierwszy utwór w kolejności `list_tracks` (bez wczytywania całej biblioteki).
    pub async fn first_track(&self) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks ORDER BY artist, album_id, track_no, title LIMIT 1;",
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(res)
    }

    pub async fn count_tracks(&self) -> Result<i64, StorageError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks;")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    /// Zwraca łączną liczbę albumów w bibliotece.
    pub async fn count_albums(&self) -> Result<i64, StorageError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM albums;")
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0)
    }

    /// Pobiera album na podstawie jego ID.
    pub async fn get_album_by_id(&self, id: i64) -> Result<Option<AlbumRecord>, StorageError> {
        let res = sqlx::query_as::<_, AlbumRecord>("SELECT * FROM albums WHERE id = ?1 LIMIT 1;")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Buduje element kolejki dla utworu, uzupełniając tytuł albumu z tabeli `albums`.
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

    /// Pobiera listę wszystkich wykonawców.
    pub async fn list_artists(&self) -> Result<Vec<ArtistRecord>, StorageError> {
        let res = sqlx::query_as::<_, ArtistRecord>("SELECT * FROM artists ORDER BY name;")
            .fetch_all(&self.pool)
            .await?;

        Ok(res)
    }

    /// Wyszukuje grupy potencjalnych duplikatów utworów w bibliotece na podstawie znormalizowanego tytułu i wykonawcy.
    pub async fn find_duplicate_tracks(&self) -> Result<Vec<DuplicateGroup>, StorageError> {
        // Jedno zapytanie zamiast osobnego zapytania na każdą grupę duplikatów (N+1).
        // Klucz grupy liczy SQLite (LOWER/TRIM), więc grupowanie jest identyczne jak w HAVING.
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

    /// Usuwa rekord utworu z bazy danych (np. przy deduplikacji).
    pub async fn delete_track(&self, track_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM tracks WHERE id = ?1;")
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Aktualizuje ścieżkę pliku utworu w bazie danych po zmianie nazwy / przeniesieniu na dysku.
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

    /// Usuwa z bazy utwory leżące w katalogu `root`, których ścieżek nie ma już na liście
    /// aktywnych plików. Utwory spoza `root` (inne foldery biblioteki) nie są dotykane.
    /// Wszystkie usunięcia wykonywane są w jednej transakcji.
    pub async fn delete_stale_tracks(
        &self,
        root: &str,
        active_paths: &[String],
    ) -> Result<usize, StorageError> {
        let prefix = format!("{}/", root.trim_end_matches('/'));
        let candidates: Vec<(i64, String)> =
            sqlx::query_as("SELECT id, path FROM tracks WHERE substr(path, 1, length(?1)) = ?1;")
                .bind(&prefix)
                .fetch_all(&self.pool)
                .await?;

        let active_set: std::collections::HashSet<&str> =
            active_paths.iter().map(|s| s.as_str()).collect();
        let stale: Vec<i64> = candidates
            .into_iter()
            .filter(|(_, path)| !active_set.contains(path.as_str()))
            .map(|(id, _)| id)
            .collect();
        if stale.is_empty() {
            return Ok(0);
        }

        let mut tx = self.pool.begin().await?;
        for id in &stale {
            sqlx::query("DELETE FROM tracks WHERE id = ?1;")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Ok(stale.len())
    }

    /// Aktualizuje metadane utworu w bazie SQLite.
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
        let mut album_id = None;
        if let Some(al_title) = album_title {
            let al_artist = album_artist.unwrap_or(artist);
            let id = self.upsert_album(al_title, al_artist, year, None).await?;
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
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
