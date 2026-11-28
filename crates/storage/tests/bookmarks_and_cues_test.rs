mod common;

use common::{make_dummy_track, setup_test_db};

#[tokio::test]
async fn test_single_track_bookmark() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/bookmark_track.flac", "Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    // No bookmark at first
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);

    // Store a bookmark
    db.save_bookmark(track_id, 125000).await.unwrap();
    let pos = db.get_bookmark(track_id).await.unwrap();
    assert_eq!(pos, Some(125000));

    // Remove the bookmark
    db.delete_bookmark(track_id).await.unwrap();
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);
}

#[tokio::test]
async fn test_multi_cue_track_bookmarks() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/cues_track.flac", "Track with Cues", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    // Add markers
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

    // Rename a marker
    db.update_track_bookmark(bm1.id, "Main Verse")
        .await
        .unwrap();
    let updated_bms = db.get_track_bookmarks(track_id).await.unwrap();
    assert_eq!(updated_bms[0].name, "Main Verse");

    // Remove a marker
    db.delete_track_bookmark(bm2.id).await.unwrap();
    let bms_after_del = db.get_track_bookmarks(track_id).await.unwrap();
    assert_eq!(bms_after_del.len(), 1);
    assert_eq!(bms_after_del[0].id, bm1.id);
}

#[tokio::test]
async fn test_delete_all_track_bookmarks_only_affects_one_track() {
    let db = setup_test_db().await;
    let track_a = db
        .upsert_track(&make_dummy_track("/music/a.flac", "A", "Artist"))
        .await
        .unwrap();
    let track_b = db
        .upsert_track(&make_dummy_track("/music/b.flac", "B", "Artist"))
        .await
        .unwrap();

    db.add_track_bookmark(track_a, "One", 1000).await.unwrap();
    db.add_track_bookmark(track_a, "Two", 2000).await.unwrap();
    db.add_track_bookmark(track_b, "Keep", 3000).await.unwrap();

    assert_eq!(db.delete_all_track_bookmarks(track_a).await.unwrap(), 2);
    assert!(db.get_track_bookmarks(track_a).await.unwrap().is_empty());
    assert_eq!(db.get_track_bookmarks(track_b).await.unwrap().len(), 1);

    // Deleting from a track with no markers is a harmless no-op.
    assert_eq!(db.delete_all_track_bookmarks(track_a).await.unwrap(), 0);
}
