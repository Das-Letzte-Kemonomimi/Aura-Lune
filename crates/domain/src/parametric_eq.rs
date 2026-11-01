use serde::{Deserialize, Serialize};

/// Typ filtru biquad w korektorze parametrycznym.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ParametricFilterType {
    /// Filtr dzwonowy / szczytowy (Peak / Bell filter)
    #[default]
    #[serde(alias = "peak", alias = "pk", alias = "bell")]
    Peak,
    /// Półka dolna (Low Shelf filter)
    #[serde(alias = "low_shelf", alias = "lowshelf", alias = "lsc")]
    LowShelf,
    /// Półka górna (High Shelf filter)
    #[serde(alias = "high_shelf", alias = "highshelf", alias = "hsc")]
    HighShelf,
}

impl ParametricFilterType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Peak => "peak",
            Self::LowShelf => "low-shelf",
            Self::HighShelf => "high-shelf",
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::Peak => "PK",
            Self::LowShelf => "LSC",
            Self::HighShelf => "HSC",
        }
    }

    pub fn from_code(code: &str) -> Option<Self> {
        let normalized = code.trim().to_uppercase();
        match normalized.as_str() {
            "PK" | "PEAK" | "BELL" => Some(Self::Peak),
            "LSC" | "LSQ" | "LS" | "LOW_SHELF" | "LOWSHELF" => Some(Self::LowShelf),
            "HSC" | "HSQ" | "HS" | "HIGH_SHELF" | "HIGHSHELF" => Some(Self::HighShelf),
            _ => None,
        }
    }
}

pub const MIN_PARAMETRIC_FREQ: f64 = 10.0;
pub const MAX_PARAMETRIC_FREQ: f64 = 24000.0;
pub const MIN_PARAMETRIC_GAIN_DB: f64 = -24.0;
pub const MAX_PARAMETRIC_GAIN_DB: f64 = 12.0;
pub const MIN_PARAMETRIC_Q: f64 = 0.05;
pub const MAX_PARAMETRIC_Q: f64 = 20.0;
pub const MIN_PREAMP_DB: f64 = -30.0;
pub const MAX_PREAMP_DB: f64 = 12.0;

/// Pojedyncze pasmo korektora parametrycznego.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParametricBand {
    /// Identyfikator pasma (np. "band-1", "pk-1000")
    pub id: String,
    /// Typ filtru (Peak, LowShelf, HighShelf)
    pub filter_type: ParametricFilterType,
    /// Częstotliwość środkowa/odcięcia w Hz (10.0 Hz do 24000.0 Hz)
    pub freq: f64,
    /// Wzmocnienie w dB (-30.0 dB do +24.0 dB)
    pub gain_db: f64,
    /// Dobroć filtru Q (0.05 do 20.0)
    pub q: f64,
    /// Flaga aktywności pasma
    pub enabled: bool,
}

impl ParametricBand {
    pub fn new(
        id: impl Into<String>,
        filter_type: ParametricFilterType,
        freq: f64,
        gain_db: f64,
        q: f64,
    ) -> Self {
        Self {
            id: id.into(),
            filter_type,
            freq: freq.clamp(MIN_PARAMETRIC_FREQ, MAX_PARAMETRIC_FREQ),
            gain_db: gain_db.clamp(MIN_PARAMETRIC_GAIN_DB, MAX_PARAMETRIC_GAIN_DB),
            q: q.clamp(MIN_PARAMETRIC_Q, MAX_PARAMETRIC_Q),
            enabled: true,
        }
    }

    /// Oblicza szerokość pasma w Hz (bandwidth = freq / Q) dla GStreamera.
    pub fn bandwidth_hz(&self) -> f64 {
        let q = self.q.max(MIN_PARAMETRIC_Q);
        (self.freq / q).clamp(1.0, 20000.0)
    }
}

/// Kompletny stan wielopasmowego korektora parametrycznego.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParametricEqState {
    /// Czy korektor parametryczny jest włączony
    pub enabled: bool,
    /// Wzmocnienie przedwzmacniacza (preamp) w dB w celu uniknięcia cyfrowego przesterowania (clippingu)
    pub preamp_db: f64,
    /// Lista pasm filtrów
    pub bands: Vec<ParametricBand>,
}

impl Default for ParametricEqState {
    fn default() -> Self {
        Self {
            enabled: false,
            preamp_db: 0.0,
            bands: Vec::new(),
        }
    }
}

impl ParametricEqState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Tworzy nowy stan z domyślnym zestawem 5 uniwersalnych pasm parametrycznych.
    pub fn with_default_bands() -> Self {
        Self {
            enabled: false,
            preamp_db: 0.0,
            bands: vec![
                ParametricBand::new("band-1", ParametricFilterType::LowShelf, 80.0, 0.0, 0.707),
                ParametricBand::new("band-2", ParametricFilterType::Peak, 250.0, 0.0, 1.414),
                ParametricBand::new("band-3", ParametricFilterType::Peak, 1000.0, 0.0, 1.414),
                ParametricBand::new("band-4", ParametricFilterType::Peak, 4000.0, 0.0, 1.414),
                ParametricBand::new(
                    "band-5",
                    ParametricFilterType::HighShelf,
                    10000.0,
                    0.0,
                    0.707,
                ),
            ],
        }
    }

    /// Oblicza maksymalne łączne wzmocnienie (preamp + max gain pasm), aby wykryć ryzyko przesterowania.
    pub fn max_effective_boost_db(&self) -> f64 {
        let max_band_gain = self
            .bands
            .iter()
            .filter(|b| b.enabled)
            .map(|b| b.gain_db.max(0.0))
            .fold(0.0f64, f64::max);
        self.preamp_db + max_band_gain
    }

    /// Sugeruje bezpieczną wartość preamp_db zapobiegającą clippingowi przy aktualnych pasmach.
    pub fn calculate_safe_preamp(&self) -> f64 {
        let max_boost = self
            .bands
            .iter()
            .filter(|b| b.enabled && b.gain_db > 0.0)
            .map(|b| b.gain_db)
            .fold(0.0f64, f64::max);
        if max_boost > 0.0 {
            -max_boost
        } else {
            0.0
        }
    }

    /// Resetuje wszystkie pasma do poziomu 0.0 dB i preamp do 0.0 dB.
    pub fn reset_flat(&mut self) {
        self.preamp_db = 0.0;
        for band in &mut self.bands {
            band.gain_db = 0.0;
        }
    }

    /// Eksportuje konfigurację do powszechnego formatu tekstowego EqualizerAPO / Peace.
    pub fn export_to_equalizer_apo(&self) -> String {
        let mut out = String::new();
        out.push_str("# Konfiguracja EqualizerAPO wygenerowana przez Auralune (Kitsune Player)\n");
        out.push_str(&format!("Preamp: {:.1} dB\n", self.preamp_db));

        for (idx, band) in self.bands.iter().enumerate() {
            let state = if band.enabled { "ON" } else { "OFF" };
            let ftype = band.filter_type.code();
            out.push_str(&format!(
                "Filter {}: {} {} Fc {:.1} Hz Gain {:.1} dB Q {:.2}\n",
                idx + 1,
                state,
                ftype,
                band.freq,
                band.gain_db,
                band.q
            ));
        }

        out
    }

    /// Parsuje konfigurację tekstową w formacie EqualizerAPO / AutoEQ / Peace.
    ///
    /// Obsługuje formaty linii:
    /// `Preamp: -6.5 dB`
    /// `Filter 1: ON PK Fc 35 Hz Gain 4.8 dB Q 1.41`
    /// `Filter: ON LSC Fc 105 Hz Gain 3.2 dB Q 0.71`
    /// `Filter 3: OFF HSC Fc 8500 Hz Gain -2.0 dB Q 0.71`
    pub fn parse_equalizer_apo(text: &str) -> Result<Self, String> {
        let mut preamp_db = 0.0;
        let mut bands = Vec::new();
        let mut band_counter = 1;

        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
                continue;
            }

            // 1. Parsowanie Preamp
            if trimmed.to_lowercase().starts_with("preamp:") {
                let parts: Vec<&str> = trimmed.split(':').collect();
                if parts.len() >= 2 {
                    let val_str = parts[1]
                        .trim()
                        .trim_end_matches("dB")
                        .trim_end_matches("db")
                        .trim();
                    if let Ok(val) = val_str.parse::<f64>() {
                        preamp_db = val.clamp(MIN_PREAMP_DB, MAX_PREAMP_DB);
                    }
                }
                continue;
            }

            // 2. Parsowanie Filter
            // Przykłady:
            // Filter 1: ON PK Fc 31.0 Hz Gain 4.8 dB Q 1.41
            // Filter: ON LSC Fc 105 Hz Gain 3.5 dB Q 0.71
            if trimmed.to_lowercase().starts_with("filter") {
                let colon_pos = trimmed.find(':');
                let filter_body = if let Some(pos) = colon_pos {
                    trimmed[pos + 1..].trim()
                } else {
                    // Brak dwukropka, np. "Filter ON PK..."
                    trimmed.strip_prefix("Filter").unwrap_or(trimmed).trim()
                };

                let tokens: Vec<&str> = filter_body.split_whitespace().collect();
                if tokens.is_empty() {
                    continue;
                }

                let mut enabled = true;
                let mut filter_type = ParametricFilterType::Peak;
                let mut freq = 1000.0;
                let mut gain_db = 0.0;
                let mut q = 1.414;

                let mut i = 0;
                while i < tokens.len() {
                    let token = tokens[i].to_uppercase();

                    if token == "ON" {
                        enabled = true;
                        i += 1;
                    } else if token == "OFF" {
                        enabled = false;
                        i += 1;
                    } else if let Some(ftype) = ParametricFilterType::from_code(&token) {
                        filter_type = ftype;
                        i += 1;
                    } else if token == "FC" && i + 1 < tokens.len() {
                        if let Ok(f) = tokens[i + 1].parse::<f64>() {
                            freq = f;
                        }
                        i += 2;
                        // Pomiń opcjonalne "Hz"
                        if i < tokens.len() && tokens[i].eq_ignore_ascii_case("hz") {
                            i += 1;
                        }
                    } else if token == "GAIN" && i + 1 < tokens.len() {
                        if let Ok(g) = tokens[i + 1].parse::<f64>() {
                            gain_db = g;
                        }
                        i += 2;
                        // Pomiń opcjonalne "dB"
                        if i < tokens.len() && tokens[i].eq_ignore_ascii_case("db") {
                            i += 1;
                        }
                    } else if token == "Q" && i + 1 < tokens.len() {
                        if let Ok(val) = tokens[i + 1].parse::<f64>() {
                            q = val;
                        }
                        i += 2;
                    } else {
                        i += 1;
                    }
                }

                let band_id = format!("band-{}", band_counter);
                band_counter += 1;

                let mut band = ParametricBand::new(band_id, filter_type, freq, gain_db, q);
                band.enabled = enabled;
                bands.push(band);
            }
        }

        if bands.is_empty() {
            return Err(
                "Nie znaleziono żadnych pasm filtrów (Filter: ...) w podanym tekście.".into(),
            );
        }

        Ok(Self {
            enabled: true,
            preamp_db,
            bands,
        })
    }
}

/// Gotowy preset korektora parametrycznego.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParametricEqPreset {
    pub name: String,
    pub description: String,
    pub state: ParametricEqState,
}

impl ParametricEqPreset {
    pub fn default_presets() -> Vec<Self> {
        vec![
            Self {
                name: "Płaski (Flat)".into(),
                description: "Neutralna, niezmieniona odpowiedź częstotliwościowa.".into(),
                state: ParametricEqState::with_default_bands(),
            },
            Self {
                name: "Krzywa Harmana (Harman Baseline)".into(),
                description: "Przyjemny basowy punch i czytelna góra pasma wzorowane na docelowej krzywej Harmana.".into(),
                state: ParametricEqState {
                    enabled: true,
                    preamp_db: -5.5,
                    bands: vec![
                        ParametricBand::new("p1", ParametricFilterType::LowShelf, 105.0, 5.2, 0.71),
                        ParametricBand::new("p2", ParametricFilterType::Peak, 200.0, -1.5, 1.4),
                        ParametricBand::new("p3", ParametricFilterType::Peak, 1200.0, -2.0, 1.8),
                        ParametricBand::new("p4", ParametricFilterType::Peak, 3000.0, 3.5, 2.0),
                        ParametricBand::new("p5", ParametricFilterType::HighShelf, 8000.0, -1.0, 0.71),
                    ],
                },
            },
            Self {
                name: "Czysty Wokal (Vocal Clarity)".into(),
                description: "Wzmocnienie pasma mowy i wokali (1 kHz - 3.5 kHz) z redukcją dudniącego basu.".into(),
                state: ParametricEqState {
                    enabled: true,
                    preamp_db: -3.0,
                    bands: vec![
                        ParametricBand::new("p1", ParametricFilterType::LowShelf, 120.0, -2.5, 0.71),
                        ParametricBand::new("p2", ParametricFilterType::Peak, 400.0, -1.0, 1.2),
                        ParametricBand::new("p3", ParametricFilterType::Peak, 2400.0, 3.0, 1.8),
                        ParametricBand::new("p4", ParametricFilterType::Peak, 4500.0, 2.0, 2.0),
                        ParametricBand::new("p5", ParametricFilterType::HighShelf, 10000.0, 1.5, 0.71),
                    ],
                },
            },
            Self {
                name: "Sub-Bass Punch (Czysty Bas)".into(),
                description: "Podbicie najniższych rejestrów (30-80 Hz) bez zamulania średnicy.".into(),
                state: ParametricEqState {
                    enabled: true,
                    preamp_db: -6.0,
                    bands: vec![
                        ParametricBand::new("p1", ParametricFilterType::Peak, 45.0, 5.8, 1.2),
                        ParametricBand::new("p2", ParametricFilterType::LowShelf, 90.0, 2.5, 0.71),
                        ParametricBand::new("p3", ParametricFilterType::Peak, 250.0, -2.0, 1.5),
                        ParametricBand::new("p4", ParametricFilterType::Peak, 1000.0, 0.0, 1.0),
                        ParametricBand::new("p5", ParametricFilterType::HighShelf, 12000.0, 1.0, 0.71),
                    ],
                },
            },
            Self {
                name: "Redukcja Sybilantów (De-Esser)".into(),
                description: "Precyzyjne wycięcie ostrych syków głosek s/sz/cz w okolicach 6-8 kHz.".into(),
                state: ParametricEqState {
                    enabled: true,
                    preamp_db: 0.0,
                    bands: vec![
                        ParametricBand::new("p1", ParametricFilterType::Peak, 6200.0, -4.5, 3.5),
                        ParametricBand::new("p2", ParametricFilterType::Peak, 7800.0, -3.5, 3.0),
                    ],
                },
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parametric_band_clamping_and_bandwidth() {
        let band = ParametricBand::new("b1", ParametricFilterType::Peak, 1000.0, 6.0, 2.0);
        assert_eq!(band.freq, 1000.0);
        assert_eq!(band.gain_db, 6.0);
        assert_eq!(band.q, 2.0);
        assert_eq!(band.bandwidth_hz(), 500.0);
    }

    #[test]
    fn test_parse_equalizer_apo_autoeq_format() {
        let apo_text = r#"
# EqualizerAPO configuration generated by AutoEQ
Preamp: -6.8 dB
Filter 1: ON PK Fc 28.0 Hz Gain 6.5 dB Q 1.41
Filter 2: ON LSC Fc 105.0 Hz Gain 3.2 dB Q 0.71
Filter 3: OFF PK Fc 2200.0 Hz Gain -1.8 dB Q 2.00
Filter 4: ON HSC Fc 8500.0 Hz Gain -2.5 dB Q 0.71
"#;

        let state = ParametricEqState::parse_equalizer_apo(apo_text)
            .expect("Prawidłowy tekst powinien się sparsować");
        assert_eq!(state.preamp_db, -6.8);
        assert_eq!(state.bands.len(), 4);

        assert_eq!(state.bands[0].filter_type, ParametricFilterType::Peak);
        assert_eq!(state.bands[0].freq, 28.0);
        assert_eq!(state.bands[0].gain_db, 6.5);
        assert_eq!(state.bands[0].q, 1.41);
        assert!(state.bands[0].enabled);

        assert_eq!(state.bands[1].filter_type, ParametricFilterType::LowShelf);
        assert_eq!(state.bands[1].freq, 105.0);

        assert_eq!(state.bands[2].filter_type, ParametricFilterType::Peak);
        assert!(!state.bands[2].enabled);

        assert_eq!(state.bands[3].filter_type, ParametricFilterType::HighShelf);
        assert_eq!(state.bands[3].freq, 8500.0);
    }

    #[test]
    fn test_export_and_roundtrip_equalizer_apo() {
        let original = ParametricEqState {
            enabled: true,
            preamp_db: -4.5,
            bands: vec![
                ParametricBand::new("p1", ParametricFilterType::LowShelf, 100.0, 4.0, 0.71),
                ParametricBand::new("p2", ParametricFilterType::Peak, 1500.0, -2.5, 1.8),
                ParametricBand::new("p3", ParametricFilterType::HighShelf, 9000.0, 2.0, 0.71),
            ],
        };

        let exported = original.export_to_equalizer_apo();
        let parsed = ParametricEqState::parse_equalizer_apo(&exported)
            .expect("Wyeksportowany tekst musi być poprawny");

        assert_eq!(parsed.preamp_db, -4.5);
        assert_eq!(parsed.bands.len(), 3);
        assert_eq!(parsed.bands[0].filter_type, ParametricFilterType::LowShelf);
        assert_eq!(parsed.bands[0].freq, 100.0);
        assert_eq!(parsed.bands[0].gain_db, 4.0);
        assert_eq!(parsed.bands[1].filter_type, ParametricFilterType::Peak);
        assert_eq!(parsed.bands[1].freq, 1500.0);
        assert_eq!(parsed.bands[1].gain_db, -2.5);
    }

    #[test]
    fn test_calculate_safe_preamp() {
        let state = ParametricEqState {
            enabled: true,
            preamp_db: 0.0,
            bands: vec![
                ParametricBand::new("p1", ParametricFilterType::Peak, 40.0, 7.5, 1.41),
                ParametricBand::new("p2", ParametricFilterType::Peak, 1000.0, 3.0, 1.41),
            ],
        };

        assert_eq!(state.calculate_safe_preamp(), -7.5);
    }

    #[test]
    fn test_deserialize_hyphenated_filter_types() {
        let json = r#"{"enabled":true,"preamp_db":0.0,"bands":[{"id":"b1","filter_type":"low-shelf","freq":80.0,"gain_db":0.0,"q":0.707,"enabled":true},{"id":"b5","filter_type":"high-shelf","freq":10000.0,"gain_db":0.0,"q":0.707,"enabled":true}]}"#;
        let res: Result<ParametricEqState, _> = serde_json::from_str(json);
        assert!(res.is_ok(), "Failed to deserialize: {:?}", res);
    }
}
