//! Komunikat o błędzie krytycznym przy starcie (zanim powstanie okno aplikacji).

use tracing::error;

/// Loguje błąd i próbuje pokazać systemowe okno dialogowe (zenity / kdialog).
/// Bez tych narzędzi pozostaje wpis w logu i komunikat na stderr.
pub fn report_fatal_startup_error(message: &str) {
    error!("Błąd krytyczny przy starcie Auralune: {}", message);
    eprintln!("Auralune: {message}");
    let text = format!("Auralune nie może się uruchomić:\n\n{message}");
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
