use audio_engine::{
    calculate_file_sha256, get_analysis_capabilities, get_models_dir, get_stems_cache_dir,
    verify_file_sha256, DeviceManager,
};
use domain::device::BluetoothCodec;
use std::fs;

#[test]
fn test_parse_sample_pactl_output() {
    let sample = r#"
Card #44
	Name: alsa_card.usb-Focusrite_Scarlett_Solo
	Active Profile: HiFi
	Profiles:
		HiFi: Default (sinks: 1, sources: 2, priority: 8500, available: yes)
		pro-audio: Dźwięk w zastosowaniach profesjonalnych (sinks: 1, sources: 1, priority: 1, available: yes)
	Ports:
		[Out] Direct: Direct

Card #766
	Name: bluez_card.78_44_05_D6_DF_61
	Active Profile: a2dp-sink-sbc_xq
	Profiles:
		a2dp-sink: SBC (sinks: 1, sources: 0, priority: 131, available: yes)
		a2dp-sink-sbc_xq: SBC-XQ (sinks: 1, sources: 0, priority: 130, available: yes)
		a2dp-sink-ldac: Sony LDAC (sinks: 1, sources: 0, priority: 140, available: yes)
	Ports:
		headset-output: Słuchawki
"#;
    let cards = DeviceManager::parse_cards(sample);
    assert_eq!(cards.len(), 2);

    let scarlett = &cards[0];
    assert_eq!(scarlett.name, "alsa_card.usb-Focusrite_Scarlett_Solo");
    assert!(scarlett.supports_pro_audio());
    assert!(!scarlett.is_bluetooth);

    let bt = &cards[1];
    assert!(bt.is_bluetooth);
    let codecs = bt.available_bluetooth_codecs();
    assert!(codecs.contains(&BluetoothCodec::Sbc));
    assert!(codecs.contains(&BluetoothCodec::SbcXq));
    assert!(codecs.contains(&BluetoothCodec::Ldac));
}

#[test]
fn test_models_and_stems_dir_resolution() {
    let models_dir = get_models_dir();
    assert!(models_dir.to_str().unwrap().contains("models"));

    let stems_dir = get_stems_cache_dir();
    assert!(stems_dir.to_str().unwrap().contains("stems"));
}

#[test]
fn test_file_sha256_calculation() {
    let temp_dir = std::env::temp_dir();
    let test_file = temp_dir.join("auralune_sha256_test.txt");
    fs::write(&test_file, b"Auralune Kitsune Player Test").unwrap();

    let hash = calculate_file_sha256(&test_file).unwrap();
    assert_eq!(hash.len(), 64);

    let verified = verify_file_sha256(&test_file, &hash);
    assert!(verified);

    let failed = verify_file_sha256(
        &test_file,
        "0000000000000000000000000000000000000000000000000000000000000000",
    );
    assert!(!failed);

    let _ = fs::remove_file(test_file);
}

#[test]
fn test_model_catalog_and_capabilities() {
    let caps = get_analysis_capabilities();
    assert!(!caps.acceleration_provider.is_empty());
    assert!(!caps.models.is_empty());
    assert!(caps.models.iter().any(|m| m.id == "htdemucs_v4"));
    assert!(caps.models.iter().any(|m| m.id == "htdemucs_6s"));
    assert!(caps.models.iter().any(|m| m.id == "uvr_mdx_karaoke"));
    assert!(caps.models.iter().any(|m| m.id == "spotify_basic_pitch"));
}
