//! Integracja odtwarzacza z pulpitem Linuksa przez specyfikację MPRIS 2.2 na magistrali D-Bus.

pub mod mpris;

pub use mpris::{MprisController, MprisTrackInfo};
