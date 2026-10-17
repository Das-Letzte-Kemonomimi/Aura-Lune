fn main() {
    println!("cargo:rerun-if-changed=src/c_bridge.h");
    println!("cargo:rerun-if-changed=src/c_bridge.cpp");

    let mut build = cc::Build::new();
    build.cpp(true);
    build.std("c++17");
    build.file("src/c_bridge.cpp");

    if let Ok(lib) = pkg_config::Config::new().probe("soundtouch") {
        for include in lib.include_paths {
            build.include(include);
        }
    } else {
        build.include("/usr/include/soundtouch");
        println!("cargo:rustc-link-lib=SoundTouch");
    }

    build.compile("soundtouch_c_bridge");
}
