use serde::{Deserialize, Serialize};

/// Tryb jakości dźwięku wyjściowego.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum AudioQualityMode {
    /// Standardowy mikser systemowy.
    #[default]
    Standard,
    /// Dźwięk profesjonalny (bit-perfect, unikanie resamplingu, bezpośredni profil ALSA / PipeWire).
    ProAudio,
}

/// Zaawansowane kodeki Bluetooth A2DP.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BluetoothCodec {
    /// Sony LDAC (do 990 kbps, 96 kHz / 24-bit).
    Ldac,
    /// Qualcomm aptX HD (do 576 kbps, 48 kHz / 24-bit).
    AptxHd,
    /// Qualcomm aptX.
    Aptx,
    /// MPEG-4 AAC.
    Aac,
    /// SBC-XQ (Subband Codec - eXtra Quality).
    SbcXq,
    /// Standardowy SBC.
    Sbc,
    /// Inny/niestandardowy kodek.
    Other(String),
}

impl BluetoothCodec {
    /// Rozpoznaje kodek na podstawie nazwy profilu PipeWire / PulseAudio.
    pub fn from_profile_name(profile: &str) -> Option<Self> {
        let p = profile.to_lowercase();
        if p.contains("ldac") {
            Some(Self::Ldac)
        } else if p.contains("aptx_hd") || p.contains("aptx-hd") {
            Some(Self::AptxHd)
        } else if p.contains("aptx") {
            Some(Self::Aptx)
        } else if p.contains("aac") {
            Some(Self::Aac)
        } else if p.contains("sbc_xq") || p.contains("sbc-xq") {
            Some(Self::SbcXq)
        } else if p.contains("sbc") || p == "a2dp-sink" || p == "a2dp_sink" {
            Some(Self::Sbc)
        } else {
            None
        }
    }

    /// Zwraca identyfikator profilu PipeWire odpowiadający temu kodekowi.
    pub fn to_profile_name(&self) -> &'static str {
        match self {
            Self::Ldac => "a2dp-sink-ldac",
            Self::AptxHd => "a2dp-sink-aptx_hd",
            Self::Aptx => "a2dp-sink-aptx",
            Self::Aac => "a2dp-sink-aac",
            Self::SbcXq => "a2dp-sink-sbc_xq",
            Self::Sbc => "a2dp-sink",
            Self::Other(_) => "a2dp-sink",
        }
    }

    /// Czytelna nazwa kodeka do prezentacji w UI.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Ldac => "Sony LDAC (High-Res 990 kbps)",
            Self::AptxHd => "Qualcomm aptX HD (48 kHz / 24-bit)",
            Self::Aptx => "Qualcomm aptX",
            Self::Aac => "AAC (MPEG-4)",
            Self::SbcXq => "SBC-XQ (High Quality)",
            Self::Sbc => "SBC (Standard)",
            Self::Other(_) => "Inny kodek",
        }
    }
}

/// Profil karty dźwiękowej.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AudioCardProfile {
    pub name: String,
    pub description: String,
    pub available: bool,
    pub is_pro_audio: bool,
    pub bluetooth_codec: Option<BluetoothCodec>,
}

/// Reprezentacja karty dźwiękowej w systemie PipeWire.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AudioCard {
    pub index: u32,
    pub name: String,
    pub description: String,
    pub is_bluetooth: bool,
    pub active_profile: Option<String>,
    pub profiles: Vec<AudioCardProfile>,
}

impl AudioCard {
    /// Sprawdza, czy karta wspiera profil Pro Audio.
    pub fn supports_pro_audio(&self) -> bool {
        self.profiles.iter().any(|p| p.is_pro_audio)
    }

    /// Zwraca listę dostępnych kodeków Bluetooth dla tej karty.
    pub fn available_bluetooth_codecs(&self) -> Vec<BluetoothCodec> {
        self.profiles
            .iter()
            .filter_map(|p| p.bluetooth_codec.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_codec_parsing() {
        assert_eq!(
            BluetoothCodec::from_profile_name("a2dp-sink-ldac"),
            Some(BluetoothCodec::Ldac)
        );
        assert_eq!(
            BluetoothCodec::from_profile_name("a2dp-sink-aptx_hd"),
            Some(BluetoothCodec::AptxHd)
        );
        assert_eq!(
            BluetoothCodec::from_profile_name("a2dp-sink-aac"),
            Some(BluetoothCodec::Aac)
        );
        assert_eq!(
            BluetoothCodec::from_profile_name("a2dp-sink-sbc_xq"),
            Some(BluetoothCodec::SbcXq)
        );
        assert_eq!(
            BluetoothCodec::from_profile_name("a2dp-sink"),
            Some(BluetoothCodec::Sbc)
        );
        assert_eq!(BluetoothCodec::from_profile_name("headset-head-unit"), None);
    }
}
