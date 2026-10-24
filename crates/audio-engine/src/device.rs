//! Zarządzanie kartami audio, trybem Pro Audio i kodekami Bluetooth (PipeWire / WirePlumber).

use crate::error::AudioEngineError;
use domain::device::{AudioCard, AudioCardProfile, BluetoothCodec};
use std::process::Command;
use tracing::info;

/// Menedżer urządzeń audio i profili PipeWire.
pub struct DeviceManager;

impl DeviceManager {
    /// Pobiera listę wszystkich wykrytych kart dźwiękowych i ich profili.
    pub fn list_cards() -> Result<Vec<AudioCard>, AudioEngineError> {
        let output = Command::new("pactl")
            .arg("list")
            .arg("cards")
            .output()
            .map_err(AudioEngineError::Io)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AudioEngineError::ElementLink(format!(
                "Błąd odpytywania kart audio przez pactl: {}",
                stderr
            )));
        }

        let text = String::from_utf8_lossy(&output.stdout);
        Ok(Self::parse_cards(&text))
    }

    /// Przełącza profil danej karty dźwiękowej (np. na pro-audio lub kodek Bluetooth).
    pub fn set_card_profile(card_name: &str, profile_name: &str) -> Result<(), AudioEngineError> {
        info!(
            "Przełączanie profilu karty '{}' na '{}'",
            card_name, profile_name
        );

        let status = Command::new("pactl")
            .arg("set-card-profile")
            .arg(card_name)
            .arg(profile_name)
            .status()
            .map_err(AudioEngineError::Io)?;

        if !status.success() {
            return Err(AudioEngineError::ElementLink(format!(
                "Nie udało się aktywować profilu '{}' na karcie '{}'",
                profile_name, card_name
            )));
        }

        Ok(())
    }

    /// Przełącza profil kodeka Bluetooth na wybranej karcie Bluetooth.
    pub fn set_bluetooth_codec(
        card_name: &str,
        codec: &BluetoothCodec,
    ) -> Result<(), AudioEngineError> {
        let profile = codec.to_profile_name();
        Self::set_card_profile(card_name, profile)
    }

    /// Włącza tryb Pro Audio (profil pro-audio) na danej karcie dźwiękowej.
    pub fn enable_pro_audio(card_name: &str) -> Result<(), AudioEngineError> {
        Self::set_card_profile(card_name, "pro-audio")
    }

    /// Wyłącza tryb Pro Audio i bezpiecznie przywraca standardowy profil stereo (np. output:analog-stereo).
    pub fn disable_pro_audio(card_name: &str) -> Result<String, AudioEngineError> {
        let cards = Self::list_cards()?;
        let card = cards.iter().find(|c| c.name == card_name).ok_or_else(|| {
            AudioEngineError::ElementLink(format!("Nie znaleziono karty {}", card_name))
        })?;

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
            "Wyłączanie Pro Audio na karcie '{}', przywracanie profilu '{}'",
            card_name, fallback_profile
        );
        Self::set_card_profile(card_name, &fallback_profile)?;
        Ok(fallback_profile)
    }

    /// Parsuje tekst wyjściowy z `pactl list cards`.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sample_pactl_output() {
        let sample = r#"
Card #44
	Name: alsa_card.usb-Focusrite_Scarlett_Solo
	Active Profile: HiFi
	Profiles:
		HiFi: Default (sinks: 1, sources: 2, priority: 8500, available: yes)
		pro-audio: Dźwięk w zastosowaniach profesjonalnych (sinks: 1, sources: 1, priority: 1, available: yes)
	Ports:
		[Out] Direct: Direct

Card #766
	Name: bluez_card.78_44_05_D6_DF_61
	Active Profile: a2dp-sink-sbc_xq
	Profiles:
		a2dp-sink: SBC (sinks: 1, sources: 0, priority: 131, available: yes)
		a2dp-sink-sbc_xq: SBC-XQ (sinks: 1, sources: 0, priority: 130, available: yes)
		a2dp-sink-ldac: Sony LDAC (sinks: 1, sources: 0, priority: 140, available: yes)
	Ports:
		headset-output: Słuchawki
"#;
        let cards = DeviceManager::parse_cards(sample);
        assert_eq!(cards.len(), 2);

        let scarlett = &cards[0];
        assert_eq!(scarlett.name, "alsa_card.usb-Focusrite_Scarlett_Solo");
        assert!(scarlett.supports_pro_audio());
        assert!(!scarlett.is_bluetooth);

        let bt = &cards[1];
        assert!(bt.is_bluetooth);
        let codecs = bt.available_bluetooth_codecs();
        assert!(codecs.contains(&BluetoothCodec::Sbc));
        assert!(codecs.contains(&BluetoothCodec::SbcXq));
        assert!(codecs.contains(&BluetoothCodec::Ldac));
    }
}
