use serde::{Deserialize, Serialize};

/// Target formats for exporting / transcoding tracks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExportFormat {
    /// Ogg Opus with a configurable bitrate (kbps, e.g. 128, 192, 256, 320).
    Opus { bitrate_kbps: u32 },
    /// Lossless FLAC with a compression level (0-8, default 5).
    Flac { compression_level: u32 },
    /// Uncompressed PCM WAV (16-bit or 24-bit).
    Wav,
}

impl Default for ExportFormat {
    fn default() -> Self {
        Self::Opus { bitrate_kbps: 192 }
    }
}

impl ExportFormat {
    /// Returns the standard file extension of the format.
    pub fn extension(&self) -> &'static str {
        match self {
            Self::Opus { .. } => "opus",
            Self::Flac { .. } => "flac",
            Self::Wav => "wav",
        }
    }

    /// Readable format name.
    pub fn display_name(&self) -> String {
        match self {
            Self::Opus { bitrate_kbps } => format!("Opus ({} kbps)", bitrate_kbps),
            Self::Flac { compression_level } => format!("FLAC (compression {})", compression_level),
            Self::Wav => "WAV (PCM)".to_string(),
        }
    }
}

/// Optional DSP parameters applied while exporting / transcoding a track.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DspExportSettings {
    /// Pitch shift in semitones (-12.0 to +12.0).
    #[serde(alias = "pitchSemitones")]
    pub pitch_semitones: f64,
    /// Tempo multiplier (0.25 to 4.0).
    #[serde(alias = "tempoRatio")]
    pub tempo_ratio: f64,
    /// Playback rate multiplier (0.25 to 4.0).
    #[serde(alias = "rateRatio")]
    pub rate_ratio: f64,
    /// DSP engine choice: "RubberBand" or "SoundTouch" (default "RubberBand").
    #[serde(default)]
    pub engine: Option<String>,
    /// Reverb level (0.0 to 1.0).
    #[serde(alias = "reverbLevel")]
    pub reverb_level: f32,
    /// The 10 graphic equaliser bands (-24.0 to +12.0 dB).
    #[serde(alias = "eqBands")]
    pub eq_bands: Option<Vec<f64>>,
}

impl Default for DspExportSettings {
    fn default() -> Self {
        Self {
            pitch_semitones: 0.0,
            tempo_ratio: 1.0,
            rate_ratio: 1.0,
            engine: None,
            reverb_level: 0.0,
            eq_bands: None,
        }
    }
}

impl DspExportSettings {
    /// Checks whether any DSP parameter differs from the defaults (Bypass).
    pub fn is_active(&self) -> bool {
        self.pitch_semitones.abs() > 0.001
            || (self.tempo_ratio - 1.0).abs() > 0.001
            || (self.rate_ratio - 1.0).abs() > 0.001
            || self.reverb_level > 0.001
            || self
                .eq_bands
                .as_ref()
                .is_some_and(|bands| bands.iter().any(|b| b.abs() > 0.1))
    }
}

/// Time range for exporting / transcoding part of a track (e.g. cutting out an A-B loop).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRange {
    /// Czas startu w milisekundach (Marker A).
    #[serde(alias = "startMs")]
    pub start_ms: u64,
    /// End time in milliseconds (marker B). If `None`, the export runs to the end of the track.
    #[serde(alias = "endMs")]
    pub end_ms: Option<u64>,
}

impl TimeRange {
    /// Creates a new A-B time range, validating the marker order.
    pub fn new(start_ms: u64, end_ms: Option<u64>) -> Result<Self, &'static str> {
        if let Some(end) = end_ms {
            if end <= start_ms {
                return Err("The end time (point B) must be later than the start time (point A)");
            }
        }
        Ok(Self { start_ms, end_ms })
    }

    /// Checks whether the range is active (limits the track time).
    pub fn is_active(&self) -> bool {
        self.start_ms > 0 || self.end_ms.is_some()
    }

    /// Returns the segment length in milliseconds if point B is set.
    pub fn duration_ms(&self) -> Option<u64> {
        self.end_ms.map(|end| end.saturating_sub(self.start_ms))
    }
}
