//! Integracja odtwarzacza z pulpitem Linuksa przez specyfikację MPRIS 2.2 na magistrali D-Bus,
//! Discord Rich Presence (RPC), eksport statusu do Waybar/Hyprland (/tmp/auralune.json)
//! oraz kanały bezpośredniego sterowania IPC FIFO/Socket (/tmp/auralune_ctl, /tmp/auralune.sock).

pub mod control_ipc;
pub mod discord_rpc;
pub mod mpris;
pub mod waybar;

pub use control_ipc::{ControlIpcServer, DEFAULT_FIFO_PATH, DEFAULT_SOCKET_PATH};
pub use discord_rpc::{
    build_activity_payload, DiscordRpcController, DiscordRpcStatus, DiscordTrackInfo,
    DEFAULT_DISCORD_CLIENT_ID,
};
pub use mpris::{MprisController, MprisTrackInfo};
pub use waybar::{
    cleanup_waybar_status, write_waybar_status, write_waybar_status_to_path, WaybarStatus,
    DEFAULT_WAYBAR_STATUS_PATH,
};
