//! Moduł pamięci trwałej i bazy SQLite (sqlx).
//!
//! Zdekomponowana i modularna warstwa persystencji danych Aura-Lune:
//! - [`models`]: Struktury DTO, encje bazodanowe i błędy [`StorageError`].
//! - [`schema`]: Migracje SQLite, schematy tabel, indeksy i domyślne motywy.
//! - [`library`]: Zarządzanie artystami, albumami, utworami i wykrywaniem duplikatów.
//! - [`bookmarks`]: Zakładki odtwarzania oraz wielopunktowe znaczniki (cue points).
//! - [`settings`]: Ustawienia aplikacji, motywy graficzne i presety DSP.
//! - [`playlists`]: Playlisty użytkowniczki oraz stan kolejki odtwarzania.
//! - [`stats`]: Statystyki odsłuchów, historia, inteligentne zapytania i roczne/okresowe Recap.
//! - [`analysis`]: Wyniki analizy muzycznej (akordy, transkrypcja, punkty szczytowe fali, modele AI).
//! - [`stems`]: Wyniki separacji stemów oraz wielościeżkowe projekty miksów (Moises-like).

pub mod analysis;
pub mod bookmarks;
pub mod library;
pub mod models;
pub mod playlists;
pub mod schema;
pub mod settings;
pub mod stats;
pub mod stems;

pub use models::*;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;
use tracing::info;

/// Główny interfejs bazy danych SQLite.
#[derive(Clone)]
pub struct Database {
    pub(crate) pool: SqlitePool,
}

impl Database {
    /// Tworzy bazę danych w pamięci RAM (przydatne do testów i sesji ulotnych).
    pub async fn new_in_memory() -> Result<Self, StorageError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect("sqlite::memory:")
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;
        Ok(db)
    }

    /// Otwiera lub tworzy bazę danych w podanej ścieżce na dysku.
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let path_str = path.as_ref().to_str().unwrap_or("auralune.db");
        let opts = SqliteConnectOptions::from_str(path_str)?
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            .busy_timeout(std::time::Duration::from_secs(15));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(opts)
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;
        info!("Baza danych SQLite zainicjalizowana: {}", path_str);
        Ok(db)
    }

    /// Zwraca referencję do wewnętrznej puli połączeń SQLite.
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_crud_and_bookmarks() {
        let db = Database::new_in_memory().await.unwrap();

        // 1. Dodawanie artysty i albumu
        let artist_id = db.upsert_artist("RADWIMPS").await.unwrap();
        assert!(artist_id > 0);

        let album_id = db
            .upsert_album("Your Name.", "RADWIMPS", Some(2016), None)
            .await
            .unwrap();
        assert!(album_id > 0);

        // 2. Dodawanie utworu
        let track = TrackRecord {
            id: 0,
            path: "/music/sparkle.flac".to_string(),
            title: "Sparkle".to_string(),
            artist: "RADWIMPS".to_string(),
            album_artist: Some("RADWIMPS".to_string()),
            album_id: Some(album_id),
            disc_no: Some(1),
            track_no: Some(8),
            duration_ms: 538000,
            format: "FLAC".to_string(),
            sample_rate: 48000,
            channels: 2,
            bit_depth: Some(24),
            file_size: 65432100,
            modified_time: 1700000000,
            is_favorite: None,
            play_count: None,
            last_played_at: None,
            total_play_time_ms: None,
            bpm: None,
            initial_key: None,
            replaygain_track_gain: None,
            replaygain_track_peak: None,
            rating: None,
        };

        let track_id = db.upsert_track(&track).await.unwrap();
        assert!(track_id > 0);

        // 3. Weryfikacja pobierania
        let fetched = db.get_track_by_path("/music/sparkle.flac").await.unwrap();
        assert!(fetched.is_some());
        let fetched_track = fetched.unwrap();
        assert_eq!(fetched_track.title, "Sparkle");
        assert_eq!(fetched_track.duration_ms, 538000);

        // Test ulubionych i statystyk odtworzeń
        let is_fav = db.toggle_favorite(track_id).await.unwrap();
        assert!(is_fav);
        let favs = db.list_favorite_tracks().await.unwrap();
        assert_eq!(favs.len(), 1);
        assert_eq!(favs[0].title, "Sparkle");

        // Test oceny gwiazdkowej
        db.set_track_rating(track_id, 5).await.unwrap();
        let rated = db.list_top_rated_tracks().await.unwrap();
        assert_eq!(rated.len(), 1);
        assert_eq!(rated[0].rating, Some(5));

        // Test aktualizacji metadanych
        db.update_track_metadata(
            track_id,
            "Sparkle (Movie Ver.)",
            "RADWIMPS",
            Some("RADWIMPS"),
            Some(8),
            Some(1),
            Some("Your Name."),
            Some(2016),
        )
        .await
        .unwrap();
        let updated = db.get_track_by_id(track_id).await.unwrap().unwrap();
        assert_eq!(updated.title, "Sparkle (Movie Ver.)");

        db.record_track_play(track_id).await.unwrap();
        db.record_track_listening(track_id, 45000).await.unwrap();
        let top = db.list_top_played_tracks(10).await.unwrap();
        assert_eq!(top.len(), 1);
        assert_eq!(top[0].play_count, Some(1));
        assert_eq!(top[0].total_play_time_ms, Some(45000));

        let recap = db.get_recap_summary("week", 0).await.unwrap();
        assert_eq!(recap.total_listened_ms, 45000);
        assert_eq!(recap.tracks_played_count, 1);
        assert_eq!(recap.top_tracks.len(), 1);
        assert_eq!(recap.top_artists.len(), 1);
        assert_eq!(recap.top_artists[0].artist, "RADWIMPS");

        let hires = db.list_hires_tracks().await.unwrap();
        assert_eq!(hires.len(), 1);
        assert_eq!(hires[0].title, "Sparkle (Movie Ver.)");

        // 4. Test zakładki odtwarzania
        db.save_bookmark(track_id, 125000).await.unwrap();
        let pos = db.get_bookmark(track_id).await.unwrap();
        assert_eq!(pos, Some(125000));

        // 5. Test presetu DSP
        let preset_id = db
            .save_dsp_preset("Nightcore", "SoundTouch", 3.0, 1.25, 1.0)
            .await
            .unwrap();
        assert!(preset_id > 0);

        let presets = db.list_dsp_presets().await.unwrap();
        assert_eq!(presets.len(), 1);
        assert_eq!(presets[0].name, "Nightcore");
        assert_eq!(presets[0].pitch_semitones, 3.0);

        // 6. Test motywów anime i tokenów
        let themes = db.list_themes().await.unwrap();
        assert_eq!(themes.len(), 7); // 7 domyślnych motywów zainicjowanych migracją (w tym Gothic In Extremo 1999)
        let active = db.get_app_setting("active_theme_id").await.unwrap();
        assert_eq!(active, Some("cyber-kitsune".to_string()));

        let cyber = db.get_theme("cyber-kitsune").await.unwrap();
        assert!(cyber.is_some());
        let mut custom = cyber.unwrap();
        custom.id = "custom-synth".to_string();
        custom.name = "Custom Synth".to_string();
        custom.overlay_opacity = 0.65;
        custom.blur_radius = 16.0;
        db.save_theme(&custom).await.unwrap();

        let fetched_custom = db.get_theme("custom-synth").await.unwrap().unwrap();
        assert_eq!(fetched_custom.name, "Custom Synth");
        assert_eq!(fetched_custom.overlay_opacity, 0.65);
        assert_eq!(fetched_custom.blur_radius, 16.0);

        db.set_app_setting("active_theme_id", "custom-synth")
            .await
            .unwrap();
        assert_eq!(
            db.get_app_setting("active_theme_id").await.unwrap(),
            Some("custom-synth".to_string())
        );

        // 7. Test playlist i kolejki
        let pl_id = db.create_playlist("Anime Favorites").await.unwrap();
        assert!(pl_id > 0);

        db.add_track_to_playlist(pl_id, track_id).await.unwrap();
        let playlists = db.list_playlists().await.unwrap();
        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].name, "Anime Favorites");
        assert_eq!(playlists[0].track_count, 1);

        let pl_tracks = db.get_playlist_tracks(pl_id).await.unwrap();
        assert_eq!(pl_tracks.len(), 1);
        assert_eq!(pl_tracks[0].title, "Sparkle (Movie Ver.)");

        // Test persystencji kolejki odtwarzania
        let mut queue = domain::PlaybackQueue::new();
        queue.add_item(domain::QueueItem {
            id: "q-1".to_string(),
            track_id: Some(track_id),
            uri: "/music/sparkle.flac".to_string(),
            title: "Sparkle".to_string(),
            artist: "RADWIMPS".to_string(),
            album: Some("Your Name.".to_string()),
            duration_ms: 538000,
        });
        queue.set_loop_mode(domain::LoopMode::Track);
        queue.set_shuffle(true);

        db.save_queue_state(&queue).await.unwrap();
        let loaded_queue = db.load_queue_state().await.unwrap();
        assert!(loaded_queue.is_some());
        let lq = loaded_queue.unwrap();
        assert_eq!(lq.items.len(), 1);
        assert_eq!(lq.items[0].title, "Sparkle");
        assert_eq!(lq.loop_mode, domain::LoopMode::Track);
        assert!(lq.shuffle);

        // Test usunięcia utworu i playlisty
        db.remove_track_from_playlist(pl_id, track_id)
            .await
            .unwrap();
        let empty_tracks = db.get_playlist_tracks(pl_id).await.unwrap();
        assert!(empty_tracks.is_empty());

        db.delete_playlist(pl_id).await.unwrap();
        let empty_pls = db.list_playlists().await.unwrap();
        assert!(empty_pls.is_empty());

        // 8. Test wielopunktowych zakładek (Track Bookmarks / Cue points)
        let bm1 = db
            .add_track_bookmark(track_id, "Intro Drop", 15400)
            .await
            .unwrap();
        assert_eq!(bm1.name, "Intro Drop");
        assert_eq!(bm1.position_ms, 15400);

        let bm2 = db
            .add_track_bookmark(track_id, "Guitar Solo", 85200)
            .await
            .unwrap();
        assert_eq!(bm2.name, "Guitar Solo");

        let bms = db.get_track_bookmarks(track_id).await.unwrap();
        assert_eq!(bms.len(), 2);
        assert_eq!(bms[0].position_ms, 15400);
        assert_eq!(bms[1].position_ms, 85200);

        db.update_track_bookmark(bm1.id, "Main Verse")
            .await
            .unwrap();
        let updated_bms = db.get_track_bookmarks(track_id).await.unwrap();
        assert_eq!(updated_bms[0].name, "Main Verse");

        db.delete_track_bookmark(bm2.id).await.unwrap();
        let bms_after_del = db.get_track_bookmarks(track_id).await.unwrap();
        assert_eq!(bms_after_del.len(), 1);

        // 9. Test wyszukiwania duplikatów (Duplicate Finder)
        let dup_track = TrackRecord {
            id: 0,
            path: "/music/sparkle_copy.mp3".to_string(),
            title: "Sparkle (Movie Ver.)".to_string(),
            artist: "RADWIMPS".to_string(),
            album_artist: Some("RADWIMPS".to_string()),
            album_id: Some(album_id),
            disc_no: Some(1),
            track_no: Some(8),
            duration_ms: 538000,
            format: "MP3".to_string(),
            sample_rate: 44100,
            channels: 2,
            bit_depth: Some(16),
            file_size: 12000000,
            modified_time: 1600000000,
            is_favorite: None,
            play_count: None,
            last_played_at: None,
            total_play_time_ms: None,
            bpm: None,
            initial_key: None,
            replaygain_track_gain: None,
            replaygain_track_peak: None,
            rating: None,
        };
        let dup_id = db.upsert_track(&dup_track).await.unwrap();
        assert!(dup_id > 0);

        let duplicates = db.find_duplicate_tracks().await.unwrap();
        assert_eq!(duplicates.len(), 1);
        assert_eq!(duplicates[0].count, 2);
        assert_eq!(duplicates[0].tracks.len(), 2);

        // Test aktualizacji ścieżki (File Renamer)
        db.update_track_path(dup_id, "/music/RADWIMPS - Sparkle.mp3")
            .await
            .unwrap();
        let moved_track = db.get_track_by_id(dup_id).await.unwrap().unwrap();
        assert_eq!(moved_track.path, "/music/RADWIMPS - Sparkle.mp3");

        // Test usunięcia duplikatu
        db.delete_track(dup_id).await.unwrap();
        let remaining_dups = db.find_duplicate_tracks().await.unwrap();
        assert!(remaining_dups.is_empty());

        // 10. Test zachowania własnej okładki przy ponownym skanowaniu (upsert_album)
        let album_id2 = db
            .upsert_album(
                "Verehrt Und Angespien",
                "In Extremo",
                Some(1999),
                Some("/covers/custom_in_extremo.jpg"),
            )
            .await
            .unwrap();

        // Symulacja skanowania pliku z tagiem embedded cover (np. /tmp/extracted_tag.jpg)
        let rescan_id = db
            .upsert_album(
                "Verehrt Und Angespien",
                "In Extremo",
                Some(1999),
                Some("/tmp/extracted_tag.jpg"),
            )
            .await
            .unwrap();
        assert_eq!(album_id2, rescan_id);

        let album_rec = db
            .list_albums()
            .await
            .unwrap()
            .into_iter()
            .find(|a| a.id == album_id2)
            .expect("Album must exist");

        // Okładka użytkownika MUSI pozostać nienaruszona!
        assert_eq!(
            album_rec.cover_path.as_deref(),
            Some("/covers/custom_in_extremo.jpg")
        );

        // 11. Testy pamięci podręcznej analizy muzycznej (akordy, transkrypcja, stemy, modele AI)
        db.save_track_chords(
            track_id,
            "hash123",
            "1.0.0",
            r#"[{"time_ms":0,"beat_number":1,"is_downbeat":true}]"#,
            r#"[{"start_ms":0,"end_ms":2000,"chord":"C","confidence":0.95}]"#,
        )
        .await
        .unwrap();

        let chords = db.get_track_chords(track_id).await.unwrap();
        assert!(chords.is_some());
        let (beat_json, chords_json, overrides) = chords.unwrap();
        assert!(beat_json.contains("beat_number"));
        assert!(chords_json.contains("\"chord\":\"C\""));
        assert!(overrides.is_none());

        db.save_chord_overrides(
            track_id,
            r#"[{"start_ms":0,"end_ms":2000,"chord":"Cmaj7"}]"#,
        )
        .await
        .unwrap();
        let chords2 = db.get_track_chords(track_id).await.unwrap().unwrap();
        assert_eq!(
            chords2.2,
            Some(r#"[{"start_ms":0,"end_ms":2000,"chord":"Cmaj7"}]"#.to_string())
        );

        db.save_track_transcription(
            track_id,
            "hash123",
            "1.0.0",
            r#"[{"onset_ms":100,"duration_ms":500,"midi_pitch":60,"velocity":80}]"#,
        )
        .await
        .unwrap();
        let trans = db.get_track_transcription(track_id).await.unwrap();
        assert!(trans.is_some());
        assert!(trans.unwrap().contains("\"midi_pitch\":60"));

        let stem_data = domain::analysis::StemSeparationData {
            track_id,
            file_hash: "hash123".to_string(),
            model_name: "htdemucs_v4".to_string(),
            stems_dir: "/tmp/stems".to_string(),
            vocals_path: "/tmp/stems/vocals.flac".to_string(),
            drums_path: "/tmp/stems/drums.flac".to_string(),
            bass_path: "/tmp/stems/bass.flac".to_string(),
            other_path: "/tmp/stems/other.flac".to_string(),
            piano_path: None,
            guitar_path: None,
        };
        db.save_stem_tracks(&stem_data).await.unwrap();
        let fetched_stems = db.get_stem_tracks(track_id).await.unwrap();
        assert!(fetched_stems.is_some());
        let stems = fetched_stems.unwrap();
        assert_eq!(stems.vocals_path, "/tmp/stems/vocals.flac");

        let model_info = domain::analysis::AiModelInfo {
            id: "htdemucs_v4".to_string(),
            name: "HTDemucs v4".to_string(),
            task_type: domain::analysis::AiTaskType::StemSeparation,
            file_path: "/models/htdemucs.onnx".to_string(),
            file_size: 80_000_000,
            sha256: "abc123sha256".to_string(),
            license: "MIT".to_string(),
            download_url: Some("https://example.com/htdemucs.onnx".to_string()),
            description: "4-Stem separation model".to_string(),
            is_installed: true,
        };
        db.register_ai_model(&model_info).await.unwrap();
        let models = db.list_ai_models().await.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].name, "HTDemucs v4");

        let fetched_model = db.get_ai_model("htdemucs_v4").await.unwrap();
        assert!(fetched_model.is_some());
        assert_eq!(fetched_model.unwrap().sha256, "abc123sha256");

        db.delete_ai_model("htdemucs_v4").await.unwrap();
        assert!(db.get_ai_model("htdemucs_v4").await.unwrap().is_none());

        // 8. Test modułu Stem Projects (Moises-like)
        let sample_project = domain::StemProject {
            id: 0,
            track_id,
            track_hash: "hash123".to_string(),
            title: "Sparkle (Multitrack Project)".to_string(),
            artist: "RADWIMPS".to_string(),
            album: "Your Name.".to_string(),
            cover_uri: None,
            status: domain::StemProjectStatus::Ready,
            progress: 1.0,
            model_name: "htdemucs_6s".to_string(),
            disk_size_bytes: 120_000_000,
            channels: vec![
                domain::StemChannel {
                    id: "lead_vocal".to_string(),
                    name: "Lead Vocal".to_string(),
                    parent_stem: Some("vocals".to_string()),
                    file_path: "/tmp/stems/lead_vocal.flac".to_string(),
                    color_hex: "#f43f5e".to_string(),
                    quality_tier: domain::StemQualityTier::HighQuality,
                    volume: 0.75,
                    pan: 0.0,
                    mute: false,
                    solo: false,
                },
                domain::StemChannel {
                    id: "kick".to_string(),
                    name: "Kick Drum".to_string(),
                    parent_stem: Some("drums".to_string()),
                    file_path: "/tmp/stems/kick.flac".to_string(),
                    color_hex: "#ea580c".to_string(),
                    quality_tier: domain::StemQualityTier::HighQuality,
                    volume: 0.75,
                    pan: 0.0,
                    mute: false,
                    solo: false,
                },
            ],
            active_mix_name: Some("Default".to_string()),
            created_at: "2026-11-14T19:00:00Z".to_string(),
            updated_at: "2026-11-14T19:00:00Z".to_string(),
        };

        let proj_id = db.create_stem_project(&sample_project).await.unwrap();
        assert!(proj_id > 0);

        let fetched_proj = db.get_stem_project(proj_id).await.unwrap().unwrap();
        assert_eq!(fetched_proj.title, "Sparkle (Multitrack Project)");
        assert_eq!(fetched_proj.channels.len(), 2);
        assert_eq!(fetched_proj.channels[0].id, "lead_vocal");
        assert_eq!(fetched_proj.channels[0].volume, 0.75);

        let mut mix_settings = std::collections::HashMap::new();
        mix_settings.insert(
            "lead_vocal".to_string(),
            domain::ChannelMixSetting {
                volume: 0.85,
                pan: 0.0,
                mute: false,
                solo: false,
            },
        );
        let sample_mix = domain::StemProjectMix {
            id: None,
            project_id: proj_id,
            name: "Acapella Boost".to_string(),
            is_default: false,
            channels: mix_settings,
            master_volume: 1.0,
            updated_at: "2026-11-14T19:30:00Z".to_string(),
        };
        let mix_id = db.save_stem_project_mix(&sample_mix).await.unwrap();
        assert!(mix_id > 0);

        let mixes = db.get_stem_project_mixes(proj_id).await.unwrap();
        assert_eq!(mixes.len(), 1);
        assert_eq!(mixes[0].name, "Acapella Boost");
        assert_eq!(mixes[0].channels.get("lead_vocal").unwrap().volume, 0.85);

        db.rename_stem_project(proj_id, "Sparkle (Acoustic Mix)")
            .await
            .unwrap();
        let renamed = db.get_stem_project(proj_id).await.unwrap().unwrap();
        assert_eq!(renamed.title, "Sparkle (Acoustic Mix)");

        let all_projects = db.list_stem_projects().await.unwrap();
        assert_eq!(all_projects.len(), 1);

        db.delete_stem_project(proj_id).await.unwrap();
        assert!(db.get_stem_project(proj_id).await.unwrap().is_none());
        assert_eq!(
            db.get_stem_project_channels(proj_id).await.unwrap().len(),
            0
        );
        assert_eq!(db.get_stem_project_mixes(proj_id).await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_track_waveform_storage() {
        let db = Database::new_in_memory().await.unwrap();
        let track = TrackRecord {
            id: 0,
            path: "/music/test_wave.flac".to_string(),
            title: "Waveform Track".to_string(),
            artist: "Artist".to_string(),
            album_artist: None,
            album_id: None,
            disc_no: None,
            track_no: Some(1),
            duration_ms: 180_000,
            format: "FLAC".to_string(),
            sample_rate: 44100,
            channels: 2,
            bit_depth: Some(16),
            file_size: 15_000_000,
            modified_time: 1234567,
            is_favorite: None,
            play_count: None,
            last_played_at: None,
            total_play_time_ms: None,
            bpm: None,
            initial_key: None,
            replaygain_track_gain: None,
            replaygain_track_peak: None,
            rating: None,
        };
        let track_id = db.upsert_track(&track).await.unwrap();

        // 1. Initial check - should be None
        assert!(db.get_track_waveform(track_id).await.unwrap().is_none());

        // 2. Save waveform peaks
        let sample_peaks = vec![0.15f32, 0.45, 0.88, 0.95, 0.62, 0.33];
        let peaks_json = serde_json::to_string(&sample_peaks).unwrap();
        db.save_track_waveform(track_id, sample_peaks.len() as i64, &peaks_json)
            .await
            .unwrap();

        // 3. Retrieve and verify
        let fetched_json = db.get_track_waveform(track_id).await.unwrap().unwrap();
        let fetched_peaks: Vec<f32> = serde_json::from_str(&fetched_json).unwrap();
        assert_eq!(fetched_peaks.len(), 6);
        assert!((fetched_peaks[2] - 0.88).abs() < 1e-4);

        // 4. Overwrite (upsert)
        let updated_peaks = vec![0.5f32, 0.9f32];
        let updated_json = serde_json::to_string(&updated_peaks).unwrap();
        db.save_track_waveform(track_id, updated_peaks.len() as i64, &updated_json)
            .await
            .unwrap();

        let updated_fetched = db.get_track_waveform(track_id).await.unwrap().unwrap();
        let updated_result: Vec<f32> = serde_json::from_str(&updated_fetched).unwrap();
        assert_eq!(updated_result.len(), 2);
        assert_eq!(updated_result[0], 0.5);
    }

    #[tokio::test]
    async fn test_playlist_lifecycle_and_track_ordering() {
        let db = Database::new_in_memory().await.unwrap();

        // 1. Create two test tracks
        let track1 = TrackRecord {
            id: 0,
            path: "/music/track1.flac".to_string(),
            title: "Track One".to_string(),
            artist: "Artist A".to_string(),
            album_artist: None,
            album_id: None,
            disc_no: None,
            track_no: Some(1),
            duration_ms: 200_000,
            format: "FLAC".to_string(),
            sample_rate: 48000,
            channels: 2,
            bit_depth: Some(24),
            file_size: 20_000_000,
            modified_time: 1000,
            is_favorite: None,
            play_count: None,
            last_played_at: None,
            total_play_time_ms: None,
            bpm: None,
            initial_key: None,
            replaygain_track_gain: None,
            replaygain_track_peak: None,
            rating: None,
        };
        let mut track2 = track1.clone();
        track2.path = "/music/track2.flac".to_string();
        track2.title = "Track Two".to_string();

        let t1_id = db.upsert_track(&track1).await.unwrap();
        let t2_id = db.upsert_track(&track2).await.unwrap();

        // 2. Create playlist
        let pl_id = db.create_playlist("Chill Vibes").await.unwrap();
        assert!(pl_id > 0);

        let playlists = db.list_playlists().await.unwrap();
        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].name, "Chill Vibes");
        assert_eq!(playlists[0].track_count, 0);

        // 3. Add tracks to playlist in order
        db.add_track_to_playlist(pl_id, t1_id).await.unwrap();
        db.add_track_to_playlist(pl_id, t2_id).await.unwrap();

        let pl_tracks = db.get_playlist_tracks(pl_id).await.unwrap();
        assert_eq!(pl_tracks.len(), 2);
        assert_eq!(pl_tracks[0].id, t1_id);
        assert_eq!(pl_tracks[1].id, t2_id);

        // 4. Remove one track
        db.remove_track_from_playlist(pl_id, t1_id).await.unwrap();
        let remaining = db.get_playlist_tracks(pl_id).await.unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, t2_id);

        // 5. Delete playlist
        db.delete_playlist(pl_id).await.unwrap();
        let empty_pls = db.list_playlists().await.unwrap();
        assert_eq!(empty_pls.len(), 0);
    }
}
