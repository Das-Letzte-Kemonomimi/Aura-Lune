/** Kontrakty komend aktualizacji (`commands/updates.rs`, `updater/mod.rs`). */

export type InstallKind = 'app_image_managed' | 'app_image_other' | 'system' | 'dev_server';

export type UpdateChannel = 'stable' | 'dev';

export interface BuildInfo {
  version: string;
  commit: string;
  commit_short: string;
  channel: UpdateChannel;
  install_kind: InstallKind;
}

export interface UpdateAsset {
  name: string;
  url: string;
  size: number;
  sha256: string | null;
  checksums_url: string | null;
}

export interface UpdateInfo {
  available: boolean;
  channel: UpdateChannel;
  current_version: string;
  current_commit: string;
  /** Wersja (stable) albo `dev-<krótki commit>` (dev); klucz ustawienia „pomiń”. */
  latest_version: string | null;
  latest_commit: string | null;
  release_url: string | null;
  release_notes: string | null;
  asset: UpdateAsset | null;
  install_kind: InstallKind;
  can_install: boolean;
  /** Unix (s). */
  checked_at: number;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}
