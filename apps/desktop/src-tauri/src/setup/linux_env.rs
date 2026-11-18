//! Inicjalizacja specyficznych zmiennych środowiskowych i procesów dla systemu Linux/AppImage.

/// Inicjalizuje zmienne środowiskowe Linuksa (GStreamer, WebKit2GTK, glib).
pub fn init_linux_environment() {
    #[cfg(target_os = "linux")]
    {
        glib::set_prgname(Some("auralune"));
        glib::set_application_name("Auralune");

        // Rozwiązanie problemu brakujących wtyczek GStreamer i procesów pomocniczych WebKit2GTK w AppImage
        let host_gst_dirs = [
            "/usr/lib/gstreamer-1.0",
            "/usr/lib64/gstreamer-1.0",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
            "/usr/local/lib/gstreamer-1.0",
        ];
        let mut valid_gst_dirs = Vec::new();
        for dir in &host_gst_dirs {
            if std::path::Path::new(dir).is_dir() {
                valid_gst_dirs.push(*dir);
            }
        }
        if !valid_gst_dirs.is_empty() {
            let joined = valid_gst_dirs.join(":");
            if let Ok(current) = std::env::var("GST_PLUGIN_SYSTEM_PATH_1_0") {
                if !current.contains("/gstreamer-1.0") {
                    std::env::set_var(
                        "GST_PLUGIN_SYSTEM_PATH_1_0",
                        format!("{}:{}", current, joined),
                    );
                }
            } else {
                std::env::set_var("GST_PLUGIN_SYSTEM_PATH_1_0", &joined);
            }

            if let Ok(current) = std::env::var("GST_PLUGIN_PATH_1_0") {
                if !current.contains("/gstreamer-1.0") {
                    std::env::set_var("GST_PLUGIN_PATH_1_0", format!("{}:{}", current, joined));
                }
            } else {
                std::env::set_var("GST_PLUGIN_PATH_1_0", &joined);
            }

            if let Ok(current) = std::env::var("GST_PLUGIN_PATH") {
                if !current.contains("/gstreamer-1.0") {
                    std::env::set_var("GST_PLUGIN_PATH", format!("{}:{}", current, joined));
                }
            } else {
                std::env::set_var("GST_PLUGIN_PATH", &joined);
            }
        }

        // gst-plugin-scanner
        if std::env::var("GST_PLUGIN_SCANNER").is_err() {
            let scanner_paths = [
                "/usr/lib/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib64/gstreamer-1.0/gst-plugin-scanner",
                "/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-plugin-scanner",
                "/usr/libexec/gstreamer-1.0/gst-plugin-scanner",
            ];
            for scanner in &scanner_paths {
                if std::path::Path::new(scanner).is_file() {
                    std::env::set_var("GST_PLUGIN_SCANNER", scanner);
                    break;
                }
            }
        }

        // WebKit2GTK procesy pomocnicze (WebKitNetworkProcess, WebKitWebProcess)
        // W AppImage linuxdeploy ustawia GTK_EXE_PREFIX na zasoby wewnątrz AppDir, przez co WebKit nie znajduje procesów potomnych
        if std::env::var("WEBKIT_EXEC_PATH").is_err() {
            let webkit_paths = [
                "/usr/lib/webkit2gtk-4.1",
                "/usr/lib64/webkit2gtk-4.1",
                "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1",
                "/usr/libexec/webkit2gtk-4.1",
            ];
            for wp in &webkit_paths {
                if std::path::Path::new(wp).is_dir() {
                    std::env::set_var("WEBKIT_EXEC_PATH", wp);
                    break;
                }
            }
        }
    }
}
