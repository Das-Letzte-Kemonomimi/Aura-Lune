//! Fatal start-up error message (before the app window exists).

use tracing::error;

/// Logs the error and tries to show a system dialog (zenity / kdialog).
/// Without these tools, a log entry and a message on stderr remain.
pub fn report_fatal_startup_error(message: &str) {
    error!("Fatal error while starting Auralune: {}", message);
    eprintln!("Auralune: {message}");
    let text = format!("Auralune cannot start:\n\n{message}");
    let shown = std::process::Command::new("zenity")
        .args(["--error", "--title=Auralune", "--no-wrap", "--text"])
        .arg(&text)
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !shown {
        let _ = std::process::Command::new("kdialog")
            .args(["--title", "Auralune", "--error"])
            .arg(&text)
            .status();
    }
}
