//! Moduł inicjalizacji i cyklu życia aplikacji (Linux environment, app state, tray, lifecycle).

pub mod app_init;
pub mod linux_env;
pub mod tray;

pub use app_init::init_app;
pub use linux_env::init_linux_environment;
pub use tray::setup_tray_and_window_events;
