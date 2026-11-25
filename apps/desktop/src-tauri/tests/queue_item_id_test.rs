use auralune_desktop::commands::queue::new_queue_item_id;
use std::collections::HashSet;

#[test]
fn queue_item_ids_are_unique_in_a_tight_loop() {
    let ids: HashSet<String> = (0..1000).map(|_| new_queue_item_id("file")).collect();
    assert_eq!(ids.len(), 1000);
    assert!(ids.iter().all(|id| id.starts_with("file-")));
}
