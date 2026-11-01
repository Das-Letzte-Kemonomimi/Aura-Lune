fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "android" {
        if let Ok(ndk) = std::env::var("NDK_HOME") {
            let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
            let android_target = match arch.as_str() {
                "aarch64" => "aarch64-linux-android",
                "x86_64" => "x86_64-linux-android",
                "arm" => "arm-linux-androideabi",
                "x86" => "i686-linux-android",
                _ => "aarch64-linux-android",
            };
            let lib_dir = format!(
                "{}/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/{}/26",
                ndk, android_target
            );
            println!("cargo:rustc-link-search={}", lib_dir);
            println!("cargo:rustc-link-lib=aaudio");
        }
    }
}
