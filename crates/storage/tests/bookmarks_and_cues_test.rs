mod common;

use common::{make_dummy_track, setup_test_db};

#[tokio::test]
async fn test_single_track_bookmark() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/bookmark_track.flac", "Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    // Na początku brak zakładki
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);

    // Zapis zakładki
    db.save_bookmark(track_id, 125000).await.unwrap();
    let pos = db.get_bookmark(track_id).await.unwrap();
    assert_eq!(pos, Some(125000));

    // Usunięcie zakładki
    db.delete_bookmark(track_id).await.unwrap();
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);
}

#[tokio::test]
async fn test_multi_cue_track_bookmarks() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/cues_track.flac", "Track with Cues", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    // Dodanie znaczników
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

    // Zmiana nazwy znacznika
    db.update_track_bookmark(bm1.id, "Main Verse")
        .await
        .unwrap();
    let updated_bms = db.get_track_bookmarks(track_id).await.unwrap();
    assert_eq!(updated_bms[0].name, "Main Verse");

    // Usunięcie znacznika
    db.delete_track_bookmark(bm2.id).await.unwrap();
    let bms_after_del = db.get_track_bookmarks(track_id).await.unwrap();
    assert_eq!(bms_after_del.len(), 1);
    assert_eq!(bms_after_del[0].id, bm1.id);
}
