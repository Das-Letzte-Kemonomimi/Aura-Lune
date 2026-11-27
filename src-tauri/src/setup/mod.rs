//! App initialisation and lifecycle (Linux environment, app state, tray, lifecycle).

pub mod app_init;
pub mod background_covers;
pub mod fatal;
pub mod linux_env;
pub mod playback_ticker;
pub mod shutdown;
pub mod silence_trim;
pub mod tray;
pub mod update_checker;

pub use app_init::init_app;
pub use background_covers::spawn_background_cover_worker;
pub use linux_env::init_linux_environment;
pub use playback_ticker::spawn_playback_ticker;
pub use tray::setup_tray_and_window_events;
pub use update_checker::spawn_update_checker;
