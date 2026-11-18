use storage::{Database, TrackRecord};

#[allow(dead_code)]
pub async fn setup_test_db() -> Database {
    Database::new_in_memory()
        .await
        .expect("Baza danych testowa w pamięci RAM powinna się zainicjalizować")
}

#[allow(dead_code)]
pub fn make_dummy_track(path: &str, title: &str, artist: &str) -> TrackRecord {
    TrackRecord {
        id: 0,
        path: path.to_string(),
        title: title.to_string(),
        artist: artist.to_string(),
        album_artist: None,
        album_id: None,
        disc_no: Some(1),
        track_no: Some(1),
        duration_ms: 180_000,
        format: "FLAC".to_string(),
        sample_rate: 44100,
        channels: 2,
        bit_depth: Some(16),
        file_size: 10_000_000,
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
    }
}
