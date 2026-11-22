//! Konfiguracja bezpieczeństwa WebView w `tauri.conf.json`.

fn security() -> serde_json::Value {
    let conf =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tauri.conf.json")).unwrap();
    serde_json::from_str::<serde_json::Value>(&conf).unwrap()["app"]["security"].clone()
}

#[test]
fn test_production_csp_is_strict() {
    let csp = &security()["csp"];
    assert!(csp.is_object(), "CSP musi być ustawione (nie null)");
    let script = csp["script-src"].as_str().unwrap();
    assert!(
        !script.contains("unsafe-inline"),
        "produkcyjne skrypty inline są zabronione"
    );
    assert!(!script.contains("unsafe-eval"));
    assert_eq!(csp["object-src"], "'none'");
    assert_eq!(csp["frame-ancestors"], "'none'");
    assert!(
        !csp["connect-src"].as_str().unwrap().contains("ws:"),
        "WebSocket tylko w devCsp"
    );
}

#[test]
fn test_style_nonce_injection_is_disabled_for_inline_style_attributes() {
    // Tauri dokleja nonce do style-src, co wyłącza 'unsafe-inline' i psuje atrybuty style={{…}} Reacta.
    let disabled = security()["dangerousDisableAssetCspModification"].clone();
    assert_eq!(disabled, serde_json::json!(["style-src"]));
}
