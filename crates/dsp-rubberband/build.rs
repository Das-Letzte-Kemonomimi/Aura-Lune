fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "linux" && pkg_config::Config::new().probe("rubberband").is_err() {
        println!("cargo:rustc-link-lib=rubberband");
    }
}
