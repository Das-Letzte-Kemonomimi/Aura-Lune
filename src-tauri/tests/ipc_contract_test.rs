//! IPC contract: every command the frontend calls through `invoke('…')` must be
//! registered in `tauri::generate_handler![…]` in `src/lib.rs`.
//!
//! The test scans the sources statically: it guards against typos and commands removed from the backend
//! (e.g. `set_shuffle` / `set_active_track` calls that once went nowhere).

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Extracts the command names from the `generate_handler![ ... ]` block.
fn registered_commands() -> BTreeSet<String> {
    let lib_rs = fs::read_to_string(manifest_dir().join("src/lib.rs")).unwrap();
    let start = lib_rs
        .find("generate_handler![")
        .expect("lib.rs must contain generate_handler!")
        + "generate_handler![".len();
    let end = start
        + lib_rs[start..]
            .find(']')
            .expect("closing of generate_handler!");
    lib_rs[start..end]
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.starts_with("//"))
        .map(|s| s.rsplit("::").next().unwrap().to_string())
        .collect()
}

fn collect_frontend_sources(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            collect_frontend_sources(&path, out);
            continue;
        }
        let name = path.file_name().unwrap().to_string_lossy();
        let is_source = name.ends_with(".ts") || name.ends_with(".tsx");
        let is_test = name.contains(".test.");
        if is_source && !is_test {
            out.push(path);
        }
    }
}

/// Finds command name literals in `invoke('name'…)` and `invoke<T>('name'…)` calls
/// (also split across lines). Calls with the name in a variable are skipped.
fn invoked_commands_in(source: &str) -> Vec<String> {
    let bytes = source.as_bytes();
    let mut found = Vec::new();
    let mut search_from = 0;
    while let Some(rel) = source[search_from..].find("invoke") {
        let start = search_from + rel;
        search_from = start + "invoke".len();
        // Only a standalone `invoke` identifier (not e.g. `safeInvoke` / `invokeAll`).
        if start > 0 && (bytes[start - 1].is_ascii_alphanumeric() || bytes[start - 1] == b'_') {
            continue;
        }
        let mut i = search_from;
        let skip_ws = |i: &mut usize| {
            while *i < bytes.len() && bytes[*i].is_ascii_whitespace() {
                *i += 1;
            }
        };
        skip_ws(&mut i);
        if i < bytes.len() && bytes[i] == b'<' {
            let mut depth = 0;
            while i < bytes.len() {
                match bytes[i] {
                    b'<' => depth += 1,
                    b'>' => {
                        depth -= 1;
                        if depth == 0 {
                            i += 1;
                            break;
                        }
                    }
                    _ => {}
                }
                i += 1;
            }
            skip_ws(&mut i);
        }
        if i >= bytes.len() || bytes[i] != b'(' {
            continue;
        }
        i += 1;
        skip_ws(&mut i);
        if i >= bytes.len() || !(bytes[i] == b'\'' || bytes[i] == b'"' || bytes[i] == b'`') {
            continue;
        }
        let quote = bytes[i];
        let name_start = i + 1;
        let mut j = name_start;
        while j < bytes.len() && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'_') {
            j += 1;
        }
        if j < bytes.len() && bytes[j] == quote && j > name_start {
            found.push(source[name_start..j].to_string());
        }
    }
    found
}

#[test]
fn test_invoked_command_scanner_handles_generics_and_multiline_calls() {
    let src = r#"
        await invoke('play');
        const s = await invoke<PlaybackStatus>('get_status');
        const r = await invoke<Record<string, Array<number>>>(
            'get_library_stats',
            { a: 1 },
        );
        safeInvoke('not_a_command');
        invoke(dynamicName);
    "#;
    assert_eq!(
        invoked_commands_in(src),
        vec!["play", "get_status", "get_library_stats"]
    );
}

#[test]
fn test_every_frontend_invoke_targets_a_registered_command() {
    let registered = registered_commands();
    assert!(
        registered.len() > 100,
        "The generate_handler! parser returned suspiciously few commands: {}",
        registered.len()
    );

    let mut files = Vec::new();
    collect_frontend_sources(&manifest_dir().join("../src"), &mut files);
    assert!(!files.is_empty(), "No frontend sources found");

    let mut missing = BTreeSet::new();
    for file in &files {
        let source = fs::read_to_string(file).unwrap();
        for cmd in invoked_commands_in(&source) {
            if !registered.contains(&cmd) {
                let rel = file.strip_prefix(manifest_dir().join("..")).unwrap_or(file);
                missing.insert(format!("{cmd} ({})", rel.display()));
            }
        }
    }
    assert!(
        missing.is_empty(),
        "The frontend calls unregistered Tauri commands:\n  {}",
        missing.into_iter().collect::<Vec<_>>().join("\n  ")
    );
}

/// `src/api/commands.generated.ts` (the `CommandName` type used by `invoke` in the frontend)
/// must contain exactly the registered commands. After changing the list, run `npm run gen:commands`.
#[test]
fn test_generated_frontend_command_names_match_registered_commands() {
    let generated =
        fs::read_to_string(manifest_dir().join("../src/api/commands.generated.ts")).unwrap();
    let in_ts: BTreeSet<String> = generated
        .lines()
        .map(str::trim)
        .filter_map(|l| l.strip_prefix('\'').and_then(|l| l.strip_suffix("',")))
        .map(str::to_string)
        .collect();
    let registered = registered_commands();

    let missing: Vec<_> = registered.difference(&in_ts).collect();
    let stale: Vec<_> = in_ts.difference(&registered).collect();
    assert!(
        missing.is_empty() && stale.is_empty(),
        "src/api/commands.generated.ts is out of date: run `npm run gen:commands` in the repository root.\n  missing: {missing:?}\n  stale: {stale:?}"
    );
}
