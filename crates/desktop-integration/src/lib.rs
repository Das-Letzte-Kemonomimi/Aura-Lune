//! Integracja odtwarzacza z pulpitem Linuksa przez specyfikację MPRIS 2.2 na magistrali D-Bus oraz Discord Rich Presence (RPC).

pub mod discord_rpc;
pub mod mpris;

pub use discord_rpc::{
    build_activity_payload, DiscordRpcController, DiscordRpcStatus, DiscordTrackInfo,
    DEFAULT_DISCORD_CLIENT_ID,
};
pub use mpris::{MprisController, MprisTrackInfo};
