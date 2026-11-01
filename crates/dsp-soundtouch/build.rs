fn main() {
    println!("cargo:rerun-if-changed=src/c_bridge.h");
    println!("cargo:rerun-if-changed=src/c_bridge.cpp");
    println!("cargo:rerun-if-changed=soundtouch-src");

    let mut build = cc::Build::new();
    build.cpp(true);
    build.std("c++17");
    build.file("src/c_bridge.cpp");

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    if target_os != "android" && pkg_config::Config::new().probe("soundtouch").is_ok() {
        // System SoundTouch na Linuksie
    } else {
        // Kompiluj SoundTouch bezpośrednio ze źródeł (dla Androida i fallbacku)
        build.include("soundtouch-src/include");
        build.include("soundtouch-src/source");
        build.file("soundtouch-src/source/AAFilter.cpp");
        build.file("soundtouch-src/source/FIFOSampleBuffer.cpp");
        build.file("soundtouch-src/source/FIRFilter.cpp");
        build.file("soundtouch-src/source/InterpolateCubic.cpp");
        build.file("soundtouch-src/source/InterpolateLinear.cpp");
        build.file("soundtouch-src/source/InterpolateShannon.cpp");
        build.file("soundtouch-src/source/RateTransposer.cpp");
        build.file("soundtouch-src/source/SoundTouch.cpp");
        build.file("soundtouch-src/source/TDStretch.cpp");
        build.file("soundtouch-src/source/PeakFinder.cpp");
        build.file("soundtouch-src/source/BPMDetect.cpp");

        build.file("soundtouch-src/source/cpu_detect_x86.cpp");

        let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
        if target_arch == "x86" || target_arch == "x86_64" {
            build.file("soundtouch-src/source/sse_optimized.cpp");
            build.file("soundtouch-src/source/mmx_optimized.cpp");
        }
    }

    build.compile("soundtouch_c_bridge");
}
