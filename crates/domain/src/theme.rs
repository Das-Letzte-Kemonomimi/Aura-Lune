//! Domena motywów wizualnych (Anime Theme Engine).
//!
//! Zgodnie z ADR 0006 i AGENTS.md:
//! Motyw zawiera zestaw tokenów CSS, opcjonalne tło użytkowniczki,
//! suwaki przezroczystości (overlay) i rozmycia (blur) oraz atrybucję.

use serde::{Deserialize, Serialize};

/// Tokeny wizualne CSS variables dla motywu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThemeTokens {
    pub bg_deep: String,
    pub bg_surface: String,
    pub bg_surface_hover: String,
    pub bg_card: String,
    pub border_subtle: String,
    pub border_accent: String,
    pub accent_pink: String,
    pub accent_purple: String,
    pub accent_cyan: String,
    pub accent_green: String,
    pub accent_amber: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub text_muted: String,
    pub shadow_glow: String,
    pub shadow_card: String,
}

/// Pełna definicja motywu interfejsu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub schema_version: u32,
    pub tokens: ThemeTokens,
    pub background_ref: Option<String>,
    pub overlay_opacity: f32, // Zakres: 0.0 - 0.9
    pub blur_radius: f32,     // Zakres: 0.0 - 30.0 px
    pub attribution: Option<String>,
}

impl Theme {
    /// Waliduje parametry motywu pod kątem bezpieczeństwa i zakresów UI.
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err(format!(
                "Nieobsługiwana wersja schematu: {}",
                self.schema_version
            ));
        }
        if self.id.trim().is_empty() {
            return Err("ID motywu nie może być puste".to_string());
        }
        if self.name.trim().is_empty() {
            return Err("Nazwa motywu nie może być pusta".to_string());
        }
        if !(0.0..=0.9).contains(&self.overlay_opacity) {
            return Err(
                "Współczynnik overlay_opacity musi mieścić się w przedziale 0.0 - 0.9".to_string(),
            );
        }
        if !(0.0..=30.0).contains(&self.blur_radius) {
            return Err(
                "Promień rozmycia blur_radius musi mieścić się w przedziale 0.0 - 30.0 px"
                    .to_string(),
            );
        }
        Ok(())
    }
}

/// Domyślne presety motywów Anime Auralune.
pub fn default_themes() -> Vec<Theme> {
    vec![
        Theme {
            id: "cyber-kitsune".to_string(),
            name: "Cyber-Kitsune".to_string(),
            schema_version: 1,
            tokens: ThemeTokens {
                bg_deep: "#090a12".to_string(),
                bg_surface: "rgba(18, 20, 36, 0.75)".to_string(),
                bg_surface_hover: "rgba(28, 32, 54, 0.85)".to_string(),
                bg_card: "rgba(25, 28, 48, 0.6)".to_string(),
                border_subtle: "rgba(255, 255, 255, 0.08)".to_string(),
                border_accent: "rgba(168, 85, 247, 0.35)".to_string(),
                accent_pink: "#f43f5e".to_string(),
                accent_purple: "#a855f7".to_string(),
                accent_cyan: "#06b6d4".to_string(),
                accent_green: "#10b981".to_string(),
                accent_amber: "#f59e0b".to_string(),
                text_primary: "#f8fafc".to_string(),
                text_secondary: "#94a3b8".to_string(),
                text_muted: "#64748b".to_string(),
                shadow_glow: "0 0 25px rgba(168, 85, 247, 0.25)".to_string(),
                shadow_card: "0 10px 30px rgba(0, 0, 0, 0.45)".to_string(),
            },
            background_ref: None,
            overlay_opacity: 0.4,
            blur_radius: 8.0,
            attribution: Some("Auralune Core Design System".to_string()),
        },
        Theme {
            id: "sakura-blossom".to_string(),
            name: "Sakura Blossom".to_string(),
            schema_version: 1,
            tokens: ThemeTokens {
                bg_deep: "#1a0f18".to_string(),
                bg_surface: "rgba(45, 22, 38, 0.75)".to_string(),
                bg_surface_hover: "rgba(65, 30, 55, 0.85)".to_string(),
                bg_card: "rgba(50, 25, 42, 0.6)".to_string(),
                border_subtle: "rgba(244, 114, 182, 0.15)".to_string(),
                border_accent: "rgba(236, 72, 153, 0.45)".to_string(),
                accent_pink: "#f472b6".to_string(),
                accent_purple: "#db2777".to_string(),
                accent_cyan: "#fbcfe8".to_string(),
                accent_green: "#a7f3d0".to_string(),
                accent_amber: "#fde047".to_string(),
                text_primary: "#fff1f2".to_string(),
                text_secondary: "#fbcfe8".to_string(),
                text_muted: "#be185d".to_string(),
                shadow_glow: "0 0 25px rgba(244, 114, 182, 0.3)".to_string(),
                shadow_card: "0 10px 30px rgba(26, 15, 24, 0.6)".to_string(),
            },
            background_ref: None,
            overlay_opacity: 0.35,
            blur_radius: 12.0,
            attribution: Some("Pastel anime sakura aesthetics".to_string()),
        },
        Theme {
            id: "tokyo-midnight".to_string(),
            name: "Tokyo Midnight".to_string(),
            schema_version: 1,
            tokens: ThemeTokens {
                bg_deep: "#030712".to_string(),
                bg_surface: "rgba(15, 23, 42, 0.75)".to_string(),
                bg_surface_hover: "rgba(30, 41, 59, 0.85)".to_string(),
                bg_card: "rgba(15, 23, 42, 0.6)".to_string(),
                border_subtle: "rgba(56, 189, 248, 0.12)".to_string(),
                border_accent: "rgba(2, 132, 199, 0.45)".to_string(),
                accent_pink: "#38bdf8".to_string(),
                accent_purple: "#0284c7".to_string(),
                accent_cyan: "#06b6d4".to_string(),
                accent_green: "#14b8a6".to_string(),
                accent_amber: "#38bdf8".to_string(),
                text_primary: "#f0f9ff".to_string(),
                text_secondary: "#bae6fd".to_string(),
                text_muted: "#0369a1".to_string(),
                shadow_glow: "0 0 25px rgba(2, 132, 199, 0.3)".to_string(),
                shadow_card: "0 10px 30px rgba(3, 7, 18, 0.7)".to_string(),
            },
            background_ref: None,
            overlay_opacity: 0.45,
            blur_radius: 10.0,
            attribution: Some("Deep night cyber neon".to_string()),
        },
        Theme {
            id: "retro-synthwave".to_string(),
            name: "Retro Synthwave".to_string(),
            schema_version: 1,
            tokens: ThemeTokens {
                bg_deep: "#13091f".to_string(),
                bg_surface: "rgba(36, 14, 56, 0.75)".to_string(),
                bg_surface_hover: "rgba(52, 20, 82, 0.85)".to_string(),
                bg_card: "rgba(40, 16, 64, 0.6)".to_string(),
                border_subtle: "rgba(245, 158, 11, 0.15)".to_string(),
                border_accent: "rgba(244, 63, 94, 0.45)".to_string(),
                accent_pink: "#f43f5e".to_string(),
                accent_purple: "#9333ea".to_string(),
                accent_cyan: "#06b6d4".to_string(),
                accent_green: "#10b981".to_string(),
                accent_amber: "#f59e0b".to_string(),
                text_primary: "#fffbeb".to_string(),
                text_secondary: "#fde68a".to_string(),
                text_muted: "#b45309".to_string(),
                shadow_glow: "0 0 25px rgba(245, 158, 11, 0.35)".to_string(),
                shadow_card: "0 10px 30px rgba(19, 9, 31, 0.65)".to_string(),
            },
            background_ref: None,
            overlay_opacity: 0.4,
            blur_radius: 14.0,
            attribution: Some("80s Outrun Sunset aesthetics".to_string()),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_theme_validation() {
        let themes = default_themes();
        assert_eq!(themes.len(), 4);
        for t in themes {
            assert!(t.validate().is_ok());
        }

        let mut invalid_theme = default_themes()[0].clone();
        invalid_theme.overlay_opacity = 1.5;
        assert!(invalid_theme.validate().is_err());

        invalid_theme.overlay_opacity = 0.5;
        invalid_theme.blur_radius = 50.0;
        assert!(invalid_theme.validate().is_err());
    }
}
