//! Sound card management, Pro Audio mode and Bluetooth codecs (PipeWire / WirePlumber).

use crate::error::AudioEngineError;
use domain::device::{AudioCard, AudioCardProfile, BluetoothCodec};
use std::process::Command;
use tracing::info;

/// Manager for audio devices and PipeWire profiles.
pub struct DeviceManager;

impl DeviceManager {
    /// Lists every detected sound card and its profiles.
    pub fn list_cards() -> Result<Vec<AudioCard>, AudioEngineError> {
        // The parser expects English labels ("Card #", "Name:", "Profiles:"), so
        // force untranslated output regardless of the system language.
        let output = Command::new("pactl")
            .env("LC_ALL", "C")
            .arg("list")
            .arg("cards")
            .output()
            .map_err(AudioEngineError::Io)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AudioEngineError::External(format!(
                "Failed to query sound cards with pactl: {}",
                stderr
            )));
        }

        let text = String::from_utf8_lossy(&output.stdout);
        Ok(Self::parse_cards(&text))
    }

    /// Switches a sound card's profile (e.g. to pro-audio or a Bluetooth codec).
    pub fn set_card_profile(card_name: &str, profile_name: &str) -> Result<(), AudioEngineError> {
        info!(
            "Switching card '{}' to profile '{}'",
            card_name, profile_name
        );

        // `--`: names from the UI are never interpreted as pactl options (`--server=…`).
        let status = Command::new("pactl")
            .arg("set-card-profile")
            .arg("--")
            .arg(card_name)
            .arg(profile_name)
            .status()
            .map_err(AudioEngineError::Io)?;

        if !status.success() {
            return Err(AudioEngineError::External(format!(
                "Failed to activate profile '{}' on card '{}'",
                profile_name, card_name
            )));
        }

        Ok(())
    }

    /// Switches the Bluetooth codec profile on the given Bluetooth card.
    pub fn set_bluetooth_codec(
        card_name: &str,
        codec: &BluetoothCodec,
    ) -> Result<(), AudioEngineError> {
        let profile = codec.to_profile_name();
        Self::set_card_profile(card_name, profile)
    }

    /// Enables Pro Audio mode (the pro-audio profile) on the given sound card.
    pub fn enable_pro_audio(card_name: &str) -> Result<(), AudioEngineError> {
        Self::set_card_profile(card_name, "pro-audio")
    }

    /// Disables Pro Audio and safely restores the standard stereo profile (e.g. output:analog-stereo).
    pub fn disable_pro_audio(card_name: &str) -> Result<String, AudioEngineError> {
        let cards = Self::list_cards()?;
        let card = cards
            .iter()
            .find(|c| c.name == card_name)
            .ok_or_else(|| AudioEngineError::NotFound(format!("card {}", card_name)))?;

        let fallback_profile = card
            .profiles
            .iter()
            .find(|p| {
                p.available
                    && !p.is_pro_audio
                    && (p.name.contains("analog-stereo") || p.name.contains("stereo"))
            })
            .or_else(|| {
                card.profiles
                    .iter()
                    .find(|p| p.available && !p.is_pro_audio && p.name != "off")
            })
            .map(|p| p.name.clone())
            .unwrap_or_else(|| "output:analog-stereo+input:analog-stereo".to_string());

        info!(
            "Disabling Pro Audio on card '{}', restoring profile '{}'",
            card_name, fallback_profile
        );
        Self::set_card_profile(card_name, &fallback_profile)?;
        Ok(fallback_profile)
    }

    /// Parses the output of `pactl list cards`.
    pub fn parse_cards(text: &str) -> Vec<AudioCard> {
        let mut cards = Vec::new();
        let card_blocks = text.split("Card #");

        for block in card_blocks {
            let block = block.trim();
            if block.is_empty() {
                continue;
            }

            let lines: Vec<&str> = block.lines().collect();
            let first_line = lines[0].trim();
            let index: u32 = first_line.parse().unwrap_or(0);

            let mut name = String::new();
            let mut description = String::new();
            let mut active_profile = None;
            let mut profiles = Vec::new();

            let mut in_profiles_section = false;

            for line in lines.iter().skip(1) {
                let trimmed = line.trim();

                if let Some(stripped) = trimmed.strip_prefix("Name: ") {
                    name = stripped.to_string();
                } else if let Some(stripped) = trimmed.strip_prefix("device.description = \"") {
                    if let Some(end) = stripped.find('\"') {
                        description = stripped[..end].to_string();
                    }
                } else if let Some(stripped) = trimmed.strip_prefix("Active Profile: ") {
                    active_profile = Some(stripped.to_string());
                } else if trimmed == "Profiles:" {
                    in_profiles_section = true;
                } else if trimmed.starts_with("Ports:") {
                    in_profiles_section = false;
                } else if in_profiles_section {
                    if trimmed.is_empty() || trimmed.starts_with("Part of profile") {
                        continue;
                    }
                    if let Some(colon_idx) = trimmed.find(':') {
                        let prof_name = trimmed[..colon_idx].trim().to_string();
                        let rest = trimmed[colon_idx + 1..].trim();

                        let is_pro_audio = prof_name == "pro-audio";
                        let bluetooth_codec = BluetoothCodec::from_profile_name(&prof_name);
                        let available = !rest.contains("available: no");

                        profiles.push(AudioCardProfile {
                            name: prof_name,
                            description: rest.to_string(),
                            available,
                            is_pro_audio,
                            bluetooth_codec,
                        });
                    }
                }
            }

            if !name.is_empty() {
                let is_bluetooth = name.starts_with("bluez_card");
                if description.is_empty() {
                    description = name.clone();
                }

                cards.push(AudioCard {
                    index,
                    name,
                    description,
                    is_bluetooth,
                    active_profile,
                    profiles,
                });
            }
        }

        cards
    }
}
