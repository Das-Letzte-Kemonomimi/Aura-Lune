export interface ThemeTokens {
  bg_deep: string;
  bg_surface: string;
  bg_surface_hover: string;
  bg_card: string;
  border_subtle: string;
  border_accent: string;
  accent_pink: string;
  accent_purple: string;
  accent_cyan: string;
  accent_green: string;
  accent_amber: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  shadow_glow: string;
  shadow_card: string;
}

export interface Theme {
  id: string;
  name: string;
  schema_version: number;
  tokens: ThemeTokens;
  background_ref: string | null;
  overlay_opacity: number;
  blur_radius: number;
  attribution: string | null;
}
