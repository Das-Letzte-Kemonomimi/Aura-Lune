//! Command error contract: the JSON shape the frontend sees (`src/api/ipc.ts`)
//! and the mapping of crate errors to `ErrorCode` categories.

use auralune_desktop::commands::error::{CommandError, ErrorCode};

fn code_of(e: impl Into<CommandError>) -> ErrorCode {
    e.into().code
}

#[test]
fn test_serializes_to_code_and_message_for_frontend() {
    let json = serde_json::to_value(CommandError::not_found("No track")).unwrap();
    assert_eq!(
        json,
        serde_json::json!({ "code": "not_found", "message": "No track" })
    );
}

#[test]
fn test_every_code_uses_snake_case_known_to_frontend() {
    // Must match the `IpcErrorCode` union in src/api/ipc.ts.
    let expected = [
        (ErrorCode::Storage, "storage"),
        (ErrorCode::Engine, "engine"),
        (ErrorCode::Io, "io"),
        (ErrorCode::NotFound, "not_found"),
        (ErrorCode::Validation, "validation"),
        (ErrorCode::Network, "network"),
        (ErrorCode::Internal, "internal"),
    ];
    let ipc_ts = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/api/ipc.ts"),
    )
    .unwrap();
    for (code, name) in expected {
        assert_eq!(serde_json::to_value(code).unwrap(), name);
        assert!(
            ipc_ts.contains(&format!("'{name}'")),
            "IpcErrorCode in src/api/ipc.ts does not contain '{name}'"
        );
    }
}

#[test]
fn test_display_is_the_plain_message() {
    let e = CommandError::validation("Empty name").context("Rename");
    assert_eq!(e.to_string(), "Rename: Empty name");
    assert_eq!(
        e.code,
        ErrorCode::Validation,
        "context() keeps the category"
    );
}

#[test]
fn test_crate_errors_map_to_meaningful_codes() {
    use std::io::{Error as IoError, ErrorKind};

    assert_eq!(
        code_of(IoError::from(ErrorKind::NotFound)),
        ErrorCode::NotFound
    );
    assert_eq!(
        code_of(IoError::from(ErrorKind::PermissionDenied)),
        ErrorCode::Io
    );

    assert_eq!(
        code_of(audio_engine::AudioEngineError::FileNotFound(
            "/x.flac".into()
        )),
        ErrorCode::NotFound
    );
    assert_eq!(
        code_of(audio_engine::AudioEngineError::Validation("A > B".into())),
        ErrorCode::Validation
    );
    assert_eq!(
        code_of(audio_engine::AudioEngineError::Pipeline("EOS".into())),
        ErrorCode::Engine
    );
    assert_eq!(
        code_of(audio_engine::AnalysisError::FileNotFound("/x".into())),
        ErrorCode::NotFound
    );
    assert_eq!(
        code_of(domain::DomainError::Parse("bad CUE".into())),
        ErrorCode::Validation
    );
    assert_eq!(
        code_of(storage::StorageError::Domain(
            domain::DomainError::Validation("empty name".into())
        )),
        ErrorCode::Validation
    );
    assert_eq!(
        code_of(metadata::ScrobbleError::Validation("empty token".into())),
        ErrorCode::Validation
    );
    assert_eq!(
        code_of(metadata::ScrobbleError::Network("timeout".into())),
        ErrorCode::Network
    );
    assert_eq!(
        code_of(downloads::DownloadError::PathTraversal("../x".into())),
        ErrorCode::Validation
    );
    assert_eq!(code_of("anything"), ErrorCode::Internal);
}

#[test]
fn test_domain_parse_errors_surface_through_commands() {
    let err = auralune_desktop::commands::playlists::parse_cue_sheet_content("".into())
        .expect_err("an empty CUE is not valid");
    assert_eq!(err.code, ErrorCode::Validation);
    assert!(!err.message.is_empty());
}
