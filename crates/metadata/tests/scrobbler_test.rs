use metadata::lastfm::{md5_hex, LastFmClient};
use metadata::listenbrainz::{
    AdditionalInfoPayload, ListenItemPayload, SubmitListensRequest, TrackMetadataPayload,
};
use std::collections::BTreeMap;

#[test]
fn test_md5_rfc1321_vectors() {
    assert_eq!(md5_hex(b""), "d41d8cd98f00b204e9800998ecf8427e");
    assert_eq!(md5_hex(b"a"), "0cc175b9c0f1b6a831c399e269772661");
    assert_eq!(md5_hex(b"abc"), "900150983cd24fb0d6963f7d28e17f72");
    assert_eq!(
        md5_hex(b"message digest"),
        "f96b697d7cb7938d525a2f31aaf161d0"
    );
    assert_eq!(
        md5_hex(b"abcdefghijklmnopqrstuvwxyz"),
        "c3fcd3d76192e4007dfb496cca67e13b"
    );
}

#[test]
fn test_lastfm_signature_calculation() {
    let client = LastFmClient::new();
    let mut params = BTreeMap::new();
    params.insert("method", "auth.getSession".to_string());
    params.insert("api_key", "test_key".to_string());
    params.insert("token", "test_token".to_string());
    params.insert("format", "json".to_string());

    let secret = "my_secret_key";
    let sig = client.calculate_signature(&params, secret);

    let expected_pre_hash = "api_keytest_keymethodauth.getSessiontokentest_tokenmy_secret_key";
    let expected_sig = md5_hex(expected_pre_hash.as_bytes());

    assert_eq!(sig, expected_sig);
}

#[test]
fn test_listenbrainz_payload_serialization() {
    let payload = SubmitListensRequest {
        listen_type: "single".to_string(),
        payload: vec![ListenItemPayload {
            listened_at: Some(1698200000),
            track_metadata: TrackMetadataPayload {
                artist_name: "Das Letzte Kemonomimi".to_string(),
                track_name: "Skrzydła Białe".to_string(),
                release_name: Some("Auralune OST".to_string()),
                additional_info: AdditionalInfoPayload {
                    duration_ms: Some(215000),
                    ..Default::default()
                },
            },
        }],
    };

    let json = serde_json::to_string(&payload).unwrap();
    assert!(json.contains("\"listen_type\":\"single\""));
    assert!(json.contains("\"artist_name\":\"Das Letzte Kemonomimi\""));
    assert!(json.contains("\"track_name\":\"Skrzydła Białe\""));
    assert!(json.contains("\"media_player\":\"Auralune\""));
    assert!(json.contains("\"listened_at\":1698200000"));
}

#[tokio::test]
async fn test_empty_credentials_are_rejected_as_validation_errors_without_network() {
    use metadata::listenbrainz::ListenBrainzClient;
    use metadata::ScrobbleError;

    let err = ListenBrainzClient::new()
        .validate_token("   ")
        .await
        .unwrap_err();
    assert!(matches!(err, ScrobbleError::Validation(_)), "{err:?}");

    let err = LastFmClient::new()
        .validate_session("", None, None)
        .await
        .unwrap_err();
    assert!(matches!(err, ScrobbleError::Validation(_)), "{err:?}");
}
