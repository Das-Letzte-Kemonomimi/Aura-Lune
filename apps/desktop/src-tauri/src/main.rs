#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Zapobieganie zawieszaniu, czarnemu/białemu ekranowi WebKitGTK na Linuksie (NVIDIA/Wayland/Mesa)
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    auralune_desktop::run();
}
