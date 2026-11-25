//! Integracja odtwarzacza z pulpitem Linuksa przez specyfikację MPRIS 2.2 na magistrali D-Bus,
//! Discord Rich Presence (RPC), eksport statusu do Waybar/Hyprland
//! (`$XDG_RUNTIME_DIR/auralune/auralune.json`) oraz kanały bezpośredniego sterowania IPC
//! FIFO/Socket (`$XDG_RUNTIME_DIR/auralune/ctl`, `$XDG_RUNTIME_DIR/auralune/auralune.sock`).

pub mod control_ipc;
pub mod discord_rpc;
pub mod mpris;
pub mod runtime_dir;
pub mod waybar;

pub use control_ipc::ControlIpcServer;
pub use discord_rpc::{
    build_activity_payload, DiscordRpcController, DiscordRpcStatus, DiscordTrackInfo,
    DEFAULT_DISCORD_CLIENT_ID,
};
pub use mpris::{MprisController, MprisTrackInfo};
pub use runtime_dir::{control_fifo_path, control_socket_path, waybar_status_path};
pub use waybar::{
    cleanup_waybar_status, write_waybar_status, write_waybar_status_to_path, WaybarStatus,
};
