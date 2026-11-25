//! Prywatny katalog uruchomieniowy Auraluny dla plików IPC (status Waybara, FIFO, socket).
//!
//! Pliki IPC nie mogą leżeć bezpośrednio we wspólnym `/tmp`: inny użytkownik systemu mógłby
//! wcześniej utworzyć `/tmp/auralune.json` lub socket i przejąć albo zablokować kanał.
//! Dlatego wszystkie trafiają do `$XDG_RUNTIME_DIR/auralune/` (zwykle `/run/user/<uid>/auralune`),
//! a gdy `XDG_RUNTIME_DIR` nie jest ustawione — do `/tmp/auralune-<uid>/`. Katalog ma tryb `0700`
//! i jest weryfikowany (właściciel, brak dowiązania, brak dostępu dla innych) przed każdym użyciem.

use std::fs;
use std::io;
use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};

/// Nazwa pliku statusu Waybara w katalogu uruchomieniowym.
pub const WAYBAR_STATUS_FILE: &str = "auralune.json";
/// Nazwa kolejki FIFO sterowania w katalogu uruchomieniowym.
pub const CONTROL_FIFO_FILE: &str = "ctl";
/// Nazwa gniazda Unix sterowania w katalogu uruchomieniowym.
pub const CONTROL_SOCKET_FILE: &str = "auralune.sock";

/// UID bieżącego procesu (właściciel `/proc/self`), bez `unsafe` i zależności od libc.
pub fn current_uid() -> Option<u32> {
    fs::metadata("/proc/self").ok().map(|m| m.uid())
}

/// Ścieżka katalogu uruchomieniowego (bez tworzenia go).
pub fn runtime_dir_path() -> PathBuf {
    match std::env::var_os("XDG_RUNTIME_DIR") {
        Some(dir) if !dir.is_empty() && Path::new(&dir).is_absolute() => {
            PathBuf::from(dir).join("auralune")
        }
        _ => {
            let uid = current_uid().unwrap_or(0);
            std::env::temp_dir().join(format!("auralune-{uid}"))
        }
    }
}

/// Tworzy (w razie potrzeby) i weryfikuje prywatny katalog uruchomieniowy.
pub fn ensure_runtime_dir() -> io::Result<PathBuf> {
    let dir = runtime_dir_path();
    ensure_private_dir(&dir)?;
    Ok(dir)
}

/// Tworzy katalog `0700` i sprawdza, że jest prywatnym katalogiem bieżącego użytkownika.
pub fn ensure_private_dir(dir: &Path) -> io::Result<()> {
    match fs::DirBuilder::new().mode(0o700).create(dir) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(e),
    }
    let meta = fs::symlink_metadata(dir)?;
    if !meta.file_type().is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("{} is not a directory", dir.display()),
        ));
    }
    if Some(meta.uid()) != current_uid() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("{} is owned by another user", dir.display()),
        ));
    }
    if meta.mode() & 0o077 != 0 {
        fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

/// Pełna ścieżka pliku statusu Waybara.
pub fn waybar_status_path() -> PathBuf {
    runtime_dir_path().join(WAYBAR_STATUS_FILE)
}

/// Pełna ścieżka kolejki FIFO sterowania.
pub fn control_fifo_path() -> PathBuf {
    runtime_dir_path().join(CONTROL_FIFO_FILE)
}

/// Pełna ścieżka gniazda Unix sterowania.
pub fn control_socket_path() -> PathBuf {
    runtime_dir_path().join(CONTROL_SOCKET_FILE)
}
