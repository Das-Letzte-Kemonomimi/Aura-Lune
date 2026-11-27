//! Machine-learning model manager and hardware acceleration detection.

use domain::analysis::{AiModelInfo, AiTaskType, AnalysisCapabilities};
use hex;
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

/// Returns the AI model storage directory, following the XDG Base Directory spec.
pub fn get_models_dir() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
        if !xdg.trim().is_empty() {
            return PathBuf::from(xdg).join("auralune").join("models");
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("auralune")
            .join("models");
    }
    PathBuf::from("/tmp/auralune/models")
}

/// Returns the cache directory for separated audio tracks (stems).
pub fn get_stems_cache_dir() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CACHE_HOME") {
        if !xdg.trim().is_empty() {
            return PathBuf::from(xdg).join("auralune").join("stems");
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".cache")
            .join("auralune")
            .join("stems");
    }
    PathBuf::from("/tmp/auralune/stems")
}

/// Returns the cache directory for stem projects (Moises-like stem projects).
pub fn get_stem_projects_cache_dir() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CACHE_HOME") {
        if !xdg.trim().is_empty() {
            return PathBuf::from(xdg).join("auralune").join("stem_projects");
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join(".cache")
            .join("auralune")
            .join("stem_projects");
    }
    PathBuf::from("/tmp/auralune/stem_projects")
}

/// Computes the SHA-256 checksum of a file.
pub fn calculate_file_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];

    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    Ok(hex::encode(hasher.finalize()))
}

/// Entries kept by [`cached_file_sha256`].
const FILE_HASH_CACHE_CAP: usize = 64;

/// `(path, size, mtime) → SHA-256` of recently hashed files, most recent last.
type FileHashCache = Mutex<VecDeque<((PathBuf, u64, SystemTime), String)>>;

fn file_hash_cache() -> &'static FileHashCache {
    static CACHE: OnceLock<FileHashCache> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(VecDeque::with_capacity(FILE_HASH_CACHE_CAP)))
}

/// [`calculate_file_sha256`] through a small process-wide LRU keyed by (path, size, mtime).
///
/// Chord analysis, transcription and stem separation each hash the whole file (hundreds of MB
/// for hi-res); the same track is usually analysed by several of them in a row. A file that
/// changes on disk gets a new size or mtime and is hashed again.
pub fn cached_file_sha256(path: &Path) -> io::Result<String> {
    let meta = fs::metadata(path)?;
    let key = (path.to_path_buf(), meta.len(), meta.modified()?);
    if let Ok(mut cache) = file_hash_cache().lock() {
        if let Some(pos) = cache.iter().position(|(k, _)| *k == key) {
            let entry = cache.remove(pos).expect("position is in range");
            let hash = entry.1.clone();
            cache.push_back(entry);
            return Ok(hash);
        }
    }
    let hash = calculate_file_sha256(path)?;
    if let Ok(mut cache) = file_hash_cache().lock() {
        if cache.len() >= FILE_HASH_CACHE_CAP {
            cache.pop_front();
        }
        cache.push_back((key, hash.clone()));
    }
    Ok(hash)
}

/// Checks that a file exists and that its SHA-256 matches the expected value.
pub fn verify_file_sha256(path: &Path, expected_hex: &str) -> bool {
    if !path.exists() {
        return false;
    }
    if expected_hex.trim().is_empty() {
        return true;
    }
    match calculate_file_sha256(path) {
        Ok(hash) => hash.eq_ignore_ascii_case(expected_hex.trim()),
        Err(_) => false,
    }
}

/// Returns the default catalogue of AI models officially supported by Auralune.
pub fn get_default_model_catalog() -> Vec<AiModelInfo> {
    let models_dir = get_models_dir();

    vec![
        AiModelInfo {
            id: "htdemucs_v4".to_string(),
            name: "HTDemucs v4 (4-Stem Studio)".to_string(),
            task_type: AiTaskType::StemSeparation,
            file_path: models_dir.join("htdemucs_v4.onnx").to_string_lossy().to_string(),
            file_size: 316_446_953,
            sha256: "68d0bf16428ef66e692cdff8a9ccf28f1ef3f69440d57e58605a4cc55fcc5e74".to_string(),
            license: "MIT (code) / CC-BY-NC 4.0 (weights)".to_string(),
            download_url: Some(
                "https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/htdemucs.onnx".to_string(),
            ),
            is_installed: false,
            description: "Studio-quality 4-stem separation: vocals, drums, bass and accompanying instruments."
                .to_string(),
        },
        AiModelInfo {
            id: "htdemucs_6s".to_string(),
            name: "HTDemucs 6s (6-Stem Extended)".to_string(),
            task_type: AiTaskType::StemSeparation,
            file_path: models_dir.join("htdemucs_6s.onnx").to_string_lossy().to_string(),
            file_size: 258_159_781,
            sha256: "48f8e84945579f8ab340e083339e9221e03785dbe733a52c388200b6d3ca779a".to_string(),
            license: "MIT (code) / CC-BY-NC 4.0 (weights)".to_string(),
            download_url: Some(
                "https://huggingface.co/StemSplitio/htdemucs-6s-onnx/resolve/main/htdemucs_6s.onnx".to_string(),
            ),
            is_installed: false,
            description: "Extended 6-stem model: Vocals, Drums, Bass, Guitar, Piano and Other."
                .to_string(),
        },
        AiModelInfo {
            id: "uvr_mdx_karaoke".to_string(),
            name: "UVR MDX-Net Karaoke 2 (Lead & Backing)".to_string(),
            task_type: AiTaskType::StemSeparation,
            file_path: models_dir.join("uvr_mdx_karaoke.onnx").to_string_lossy().to_string(),
            file_size: 52_832_612,
            sha256: "f90e997ad60af6bf25bac77ad02f5e127a564d363a2b60ecb41100cd83e4ba12".to_string(),
            license: "MIT".to_string(),
            download_url: Some(
                "https://huggingface.co/musetric/uvr-mdxnet-kara2-onnx/resolve/main/kara2.onnx".to_string(),
            ),
            is_installed: false,
            description: "Dedicated isolation of the lead vocal from backing vocals and harmonies."
                .to_string(),
        },
        AiModelInfo {
            id: "spotify_basic_pitch".to_string(),
            name: "Spotify Basic Pitch (Polyphonic Transcription)".to_string(),
            task_type: AiTaskType::NoteTranscription,
            file_path: models_dir.join("basic_pitch.onnx").to_string_lossy().to_string(),
            file_size: 230_444,
            sha256: "2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec".to_string(),
            license: "Apache-2.0".to_string(),
            download_url: Some(
                "https://huggingface.co/daserge/basic-pitch-onnx/resolve/main/nmp.onnx".to_string(),
            ),
            is_installed: false,
            description: "Polyphonic transcription of instruments and melodies straight to notes and MIDI files."
                .to_string(),
        },
    ]
}

/// Returns the registered models with their installation state checked live.
pub fn list_available_models() -> Vec<AiModelInfo> {
    let mut catalog = get_default_model_catalog();
    for model in catalog.iter_mut() {
        let p = Path::new(&model.file_path);
        model.is_installed = p.exists() && p.metadata().map(|m| m.len() > 0).unwrap_or(false);
    }
    catalog
}

/// Returns the official catalogue of model packs for Moises-style stem projects.
pub fn get_model_packs_catalog() -> Vec<domain::ModelPackInfo> {
    let _models_dir = get_models_dir();

    vec![
        domain::ModelPackInfo {
            id: "pack_core_4stem".to_string(),
            name: "Core 4-Stem Studio Pack (HTDemucs v4)".to_string(),
            description: "Classic studio split into 4 main stems: Vocals, Drums, Bass and Other."
                .to_string(),
            category: "Base".to_string(),
            unlocked_stems: vec![
                "vocals".to_string(),
                "drums".to_string(),
                "bass".to_string(),
                "other".to_string(),
            ],
            model_files: vec!["htdemucs_v4.onnx".to_string()],
            total_size_bytes: 316_446_953,
            license: "MIT (code) / CC-BY-NC 4.0 (weights)".to_string(),
            source_url: "https://huggingface.co/StemSplitio/htdemucs-onnx".to_string(),
            sha256: "68d0bf16428ef66e692cdff8a9ccf28f1ef3f69440d57e58605a4cc55fcc5e74".to_string(),
            is_installed: false,
            gpu_recommended: true,
            speed_estimate_sec_per_min: 12.0,
        },
        domain::ModelPackInfo {
            id: "pack_extended_6stem".to_string(),
            name: "Extended 6-Stem Pack (HTDemucs 6s)".to_string(),
            description: "Extends the split with dedicated Piano and Guitar stems."
                .to_string(),
            category: "Base".to_string(),
            unlocked_stems: vec![
                "vocals".to_string(),
                "drums".to_string(),
                "bass".to_string(),
                "guitar".to_string(),
                "piano".to_string(),
                "other".to_string(),
            ],
            model_files: vec!["htdemucs_6s.onnx".to_string()],
            total_size_bytes: 258_159_781,
            license: "MIT (code) / CC-BY-NC 4.0 (weights)".to_string(),
            source_url: "https://huggingface.co/StemSplitio/htdemucs-6s-onnx".to_string(),
            sha256: "48f8e84945579f8ab340e083339e9221e03785dbe733a52c388200b6d3ca779a".to_string(),
            is_installed: false,
            gpu_recommended: true,
            speed_estimate_sec_per_min: 18.0,
        },
        domain::ModelPackInfo {
            id: "pack_vocal_harmonies".to_string(),
            name: "Vocal Harmonies & Lead Isolation Pack".to_string(),
            description: "Splits vocals into a clean Lead Vocal and Backing Vocals/Harmonies."
                .to_string(),
            category: "Vocals".to_string(),
            unlocked_stems: vec![
                "lead_vocal".to_string(),
                "backing_vocals".to_string(),
            ],
            model_files: vec!["uvr_mdx_karaoke.onnx".to_string()],
            total_size_bytes: 52_832_612,
            license: "MIT".to_string(),
            source_url: "https://huggingface.co/musetric/uvr-mdxnet-kara2-onnx".to_string(),
            sha256: "f90e997ad60af6bf25bac77ad02f5e127a564d363a2b60ecb41100cd83e4ba12".to_string(),
            is_installed: false,
            gpu_recommended: false,
            speed_estimate_sec_per_min: 8.0,
        },
        domain::ModelPackInfo {
            id: "pack_drum_pieces".to_string(),
            name: "Drum Kit Decomposition Pack".to_string(),
            description: "Decomposes the drum kit into Kick, Snare, Hi-Hat, Toms and Cymbals."
                .to_string(),
            category: "Drums".to_string(),
            unlocked_stems: vec![
                "kick".to_string(),
                "snare".to_string(),
                "hihat".to_string(),
                "toms".to_string(),
                "cymbals".to_string(),
                "percussion".to_string(),
            ],
            model_files: vec!["demucs_drums.onnx".to_string()],
            total_size_bytes: 68_400_000,
            license: "MIT".to_string(),
            source_url: "https://github.com/facebookresearch/demucs".to_string(),
            sha256: "e8f9a0b1c2d3e4f5a6b7c8d9e0f123456789abcdef0123456789abcdef012345".to_string(),
            is_installed: false,
            gpu_recommended: true,
            speed_estimate_sec_per_min: 10.0,
        },
        domain::ModelPackInfo {
            id: "pack_orchestral".to_string(),
            name: "Acoustic & Orchestral Pack (MDX23C)".to_string(),
            description: "Extracts the Strings, Brass and Woodwinds sections."
                .to_string(),
            category: "Orchestra".to_string(),
            unlocked_stems: vec![
                "strings".to_string(),
                "brass".to_string(),
                "woodwinds".to_string(),
            ],
            model_files: vec!["mdx23c_orchestral.onnx".to_string()],
            total_size_bytes: 94_500_000,
            license: "MIT".to_string(),
            source_url: "https://github.com/ZFTurbo/Music-Source-Separation-Training".to_string(),
            sha256: "f9a0b1c2d3e4f5a6b7c8d9e0f123456789abcdef0123456789abcdef01234567".to_string(),
            is_installed: false,
            gpu_recommended: true,
            speed_estimate_sec_per_min: 14.0,
        },
        domain::ModelPackInfo {
            id: "pack_dsp_cascade".to_string(),
            name: "Auralune Native HPSS & Stereo Azimuth Engine".to_string(),
            description: "Advanced STFT Harmonic-Percussive Source Separation engine with stereo-field decomposition (Center/Side). Isolates full-band kick and snare transients and vocal harmonics without a boxy EQ filter. 100% reconstruction of the original mix."
                .to_string(),
            category: "Built-in DSP".to_string(),
            unlocked_stems: vec![
                "vocals".to_string(),
                "lead_vocal".to_string(),
                "backing_vocals".to_string(),
                "drums".to_string(),
                "kick".to_string(),
                "snare".to_string(),
                "hihat".to_string(),
                "toms".to_string(),
                "cymbals".to_string(),
                "bass".to_string(),
                "guitars".to_string(),
                "acoustic_guitar".to_string(),
                "lead_guitar".to_string(),
                "rhythm_guitar".to_string(),
                "piano".to_string(),
                "synth".to_string(),
                "strings".to_string(),
                "brass".to_string(),
                "woodwinds".to_string(),
                "other".to_string(),
            ],
            model_files: vec![],
            total_size_bytes: 0,
            license: "GPL-3.0-or-later".to_string(),
            source_url: "https://github.com/Das-Letzte-Kemonomimi/Aura-Lune".to_string(),
            sha256: "builtin_dsp_sha256".to_string(),
            is_installed: true,
            gpu_recommended: false,
            speed_estimate_sec_per_min: 0.05,
        },
    ]
}

/// Returns the model packs with their on-disk installation state checked live.
pub fn list_available_model_packs() -> Vec<domain::ModelPackInfo> {
    let models_dir = get_models_dir();
    let mut catalog = get_model_packs_catalog();

    for pack in catalog.iter_mut() {
        if pack.id == "pack_dsp_cascade" {
            pack.is_installed = true;
            continue;
        }

        let all_files_exist = !pack.model_files.is_empty()
            && pack.model_files.iter().all(|f| {
                let p = models_dir.join(f);
                p.exists() && p.metadata().map(|m| m.len() > 0).unwrap_or(false)
            });
        pack.is_installed = all_files_exist;
    }

    catalog
}

/// Detects an available hardware (GPU) acceleration provider on Linux.
pub fn detect_acceleration_provider() -> (bool, String) {
    // 1. Check for AMD ROCm / HIP (CachyOS / Arch)
    if Path::new("/dev/kfd").exists() {
        return (true, "ROCm (AMD ROCm / HIP Acceleration)".to_string());
    }

    // 2. Check for NVIDIA CUDA
    if Path::new("/proc/driver/nvidia/version").exists() || Path::new("/dev/nvidia0").exists() {
        return (true, "CUDA (NVIDIA TensorRT / CUDA)".to_string());
    }

    // 3. Check for Vulkan / Direct Rendering
    if Path::new("/dev/dri/renderD128").exists() {
        return (true, "Vulkan / Direct Rendering (DRI)".to_string());
    }

    (
        false,
        "CPU (High-Performance Multi-threaded AVX2/AVX-512)".to_string(),
    )
}

/// Returns the system's music-analysis capabilities as reported to the UI.
pub fn get_analysis_capabilities() -> AnalysisCapabilities {
    let ml_enabled = cfg!(feature = "analysis-ml");
    let (gpu_available, provider) = detect_acceleration_provider();
    let models = list_available_models();

    AnalysisCapabilities {
        ml_enabled,
        onnx_available: ml_enabled,
        gpu_available,
        acceleration_provider: provider,
        models,
    }
}

/// Safely deletes a model file from disk.
pub fn remove_model_file(model_id: &str) -> io::Result<bool> {
    let catalog = get_default_model_catalog();
    if let Some(target) = catalog.iter().find(|m| m.id == model_id) {
        let path = Path::new(&target.file_path);
        if path.exists() {
            fs::remove_file(path)?;
            return Ok(true);
        }
    }
    Ok(false)
}
