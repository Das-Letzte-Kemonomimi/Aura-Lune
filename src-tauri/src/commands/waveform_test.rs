use super::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

fn unique_path(name: &str) -> PathBuf {
    PathBuf::from(format!(
        "/nonexistent/auralune-waveform-job-{name}-{}.flac",
        std::process::id()
    ))
}

#[test]
fn only_one_waveform_job_runs_per_file() {
    let path = unique_path("single");
    let job = begin_waveform_job(&path).expect("first job");
    assert!(
        begin_waveform_job(&path).is_none(),
        "a second job for the same file"
    );
    assert!(
        begin_waveform_job(&unique_path("other")).is_some(),
        "another file is independent"
    );
    drop(job);
    assert!(
        begin_waveform_job(&path).is_some(),
        "the slot is free once the job ends"
    );
}

#[tokio::test]
async fn waiters_wake_when_the_job_ends() {
    let path = unique_path("wait");
    assert!(
        !wait_for_waveform_job(&path).await,
        "no job: nothing to wait for"
    );

    let job = begin_waveform_job(&path).expect("job");
    let finished = Arc::new(AtomicBool::new(false));
    let waiter = {
        let (path, finished) = (path.clone(), finished.clone());
        tokio::spawn(async move {
            let waited = wait_for_waveform_job(&path).await;
            finished.store(true, Ordering::SeqCst);
            waited
        })
    };
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(
        !finished.load(Ordering::SeqCst),
        "the waiter returned before the job ended"
    );

    drop(job);
    let waited = tokio::time::timeout(Duration::from_secs(2), waiter)
        .await
        .expect("the waiter woke up")
        .expect("waiter task");
    assert!(waited);
}

#[test]
fn memory_cache_is_keyed_by_path_mtime_and_count() {
    let path = unique_path("memory");
    let data = TrackWaveformData {
        track_id: None,
        sample_count: 2,
        peaks: vec![0.5, 1.0],
        bands: vec![[0.1, 0.2, 0.3]; 2],
        analyzer_version: WAVEFORM_ANALYZER_VERSION.to_string(),
    };
    write_memory_waveform(path.clone(), 42, 2, data.clone());
    assert_eq!(
        read_memory_waveform(&path, 42, 2).map(|d| d.peaks),
        Some(data.peaks)
    );
    assert!(
        read_memory_waveform(&path, 43, 2).is_none(),
        "a newer file version"
    );
    assert!(
        read_memory_waveform(&path, 42, 160).is_none(),
        "another bucket count"
    );
}
