fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    if pkg_config::Config::new().probe("rubberband").is_err() {
        println!("cargo:rustc-link-lib=rubberband");
    }
}
