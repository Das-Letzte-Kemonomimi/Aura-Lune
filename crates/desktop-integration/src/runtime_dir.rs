//! Auralune's private runtime directory for IPC files (Waybar status, FIFO, socket).
//!
//! IPC files must not live directly in the shared `/tmp`: another system user could
//! create `/tmp/auralune.json` or the socket first and hijack or block the channel.
//! So they all go to `$XDG_RUNTIME_DIR/auralune/` (usually `/run/user/<uid>/auralune`),
//! or to `/tmp/auralune-<uid>/` when `XDG_RUNTIME_DIR` is not set. The directory has mode `0700`
//! and is verified (owner, not a link, no access for others) before every use.

use std::fs;
use std::io;
use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// File name of the Waybar status in the runtime directory.
pub const WAYBAR_STATUS_FILE: &str = "auralune.json";
/// Name of the control FIFO in the runtime directory.
pub const CONTROL_FIFO_FILE: &str = "ctl";
/// Name of the control Unix socket in the runtime directory.
pub const CONTROL_SOCKET_FILE: &str = "auralune.sock";

static CURRENT_UID_CACHE: OnceLock<Option<u32>> = OnceLock::new();
static RUNTIME_DIR_CACHE: OnceLock<PathBuf> = OnceLock::new();

/// UID of the current process (the owner of `/proc/self`), without `unsafe` or a libc dependency.
pub fn current_uid() -> Option<u32> {
    *CURRENT_UID_CACHE.get_or_init(|| fs::metadata("/proc/self").ok().map(|m| m.uid()))
}

/// Path of the runtime directory (without creating it).
pub fn runtime_dir_path() -> PathBuf {
    if let Some(cached) = RUNTIME_DIR_CACHE.get() {
        return cached.clone();
    }
    resolve_runtime_dir_path()
}

fn resolve_runtime_dir_path() -> PathBuf {
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

/// Creates (if needed) and verifies the private runtime directory (cached once verified).
pub fn ensure_runtime_dir() -> io::Result<PathBuf> {
    if let Some(dir) = RUNTIME_DIR_CACHE.get() {
        return Ok(dir.clone());
    }
    let dir = resolve_runtime_dir_path();
    ensure_private_dir(&dir)?;
    Ok(RUNTIME_DIR_CACHE.get_or_init(|| dir).clone())
}

/// Creates the `0700` directory and checks that it is a private directory of the current user.
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

/// Full path of the Waybar status file.
pub fn waybar_status_path() -> PathBuf {
    runtime_dir_path().join(WAYBAR_STATUS_FILE)
}

/// Full path of the control FIFO.
pub fn control_fifo_path() -> PathBuf {
    runtime_dir_path().join(CONTROL_FIFO_FILE)
}

/// Full path of the control Unix socket.
pub fn control_socket_path() -> PathBuf {
    runtime_dir_path().join(CONTROL_SOCKET_FILE)
}
