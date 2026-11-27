use super::*;

fn sample_dto(marker: &str) -> LyricsDto {
    LyricsDto {
        is_synced: false,
        lines: Vec::new(),
        plain_lyrics: Some(marker.to_string()),
        source: "lrclib".to_string(),
    }
}

#[test]
fn test_lyrics_lru_cache_eviction_and_touch() {
    let mut cache = LyricsLruCache::default();
    let now = Instant::now();

    for i in 0..LYRICS_CACHE_CAPACITY {
        let key = LyricsCacheKey::new("Artist", &format!("Track {i}"), None, Some(180.0));
        cache.insert(key, CachedLyrics::Hit(sample_dto(&format!("lyrics-{i}"))));
    }

    // Touch entry 0 so entry 1 becomes the least-recently-used key.
    let key0 = LyricsCacheKey::new("  artist ", "track 0", Some(""), Some(180.4));
    assert!(matches!(cache.get(&key0, now), Some(Some(_))));

    // Inserting one more evicts entry 1 while retaining entry 0.
    let overflow = LyricsCacheKey::new("Artist", "Overflow", None, Some(200.0));
    cache.insert(overflow, CachedLyrics::Hit(sample_dto("overflow")));

    let key1 = LyricsCacheKey::new("Artist", "Track 1", None, Some(180.0));
    assert!(cache.get(&key1, now).is_none());
    assert!(cache.get(&key0, now).is_some());
    assert_eq!(cache.entries.len(), LYRICS_CACHE_CAPACITY);
}

#[test]
fn test_lyrics_lru_cache_negative_ttl_expires_after_one_hour() {
    let mut cache = LyricsLruCache::default();
    let base = Instant::now();
    let key = LyricsCacheKey::new("Artist", "Missing", Some("Album"), Some(210.0));

    cache.insert(key.clone(), CachedLyrics::NegativeMiss { cached_at: base });

    // Within 1 h negative TTL -> cache hit returning None (no HTTP call needed).
    assert_eq!(
        cache.get(&key, base + Duration::from_secs(3599)),
        Some(None)
    );

    // At/after 1 h TTL -> cache miss so caller retries LRCLIB.
    assert_eq!(cache.get(&key, base + Duration::from_secs(3600)), None);
}
