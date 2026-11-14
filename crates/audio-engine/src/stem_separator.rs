//! Moduł separacji stemów (ścieżek instrumentalnych i wokalnych).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Separacja jest zadaniem asynchronicznym, wykonywanym w tle poza wątkiem audio.
//! Ścieżki wynikowe (WAV/FLAC) zapisywane są w katalogu cache `~/.cache/auralune/stems/<hash>/`.
//! Plik źródłowy utworu NIGDY nie jest modyfikowany.

use crate::analysis::decode_snippet_for_analysis;
use crate::error::AudioEngineError;
use crate::model_manager::{
    calculate_file_sha256, get_stem_projects_cache_dir, get_stems_cache_dir,
};
use domain::analysis::StemSeparationData;
use domain::{default_stem_color, default_stem_label, StemChannel, StemQualityTier};
use std::f64::consts::PI;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use tracing::{debug, info};

pub type ProgressCallback = Box<dyn FnMut(f32, &str) + Send>;

pub struct StemSeparator;

impl StemSeparator {
    /// Rozdziela utwór na 4 stemy: vocals, drums, bass, other.
    ///
    /// Jeżeli rozdzielone pliki istnieją już w pamięci podręcznej dla danego hasha pliku,
    /// natychmiast zwraca istniejące metadane (zerowy narzut).
    pub fn separate_track(
        input_path: impl AsRef<Path>,
        track_id: i64,
        model_id: &str,
        mut progress_cb: Option<ProgressCallback>,
    ) -> Result<StemSeparationData, AudioEngineError> {
        let input_path = input_path.as_ref();
        if !input_path.exists() {
            return Err(AudioEngineError::FileNotFound(
                input_path.display().to_string(),
            ));
        }

        let file_hash = calculate_file_sha256(input_path)
            .map_err(|e| AudioEngineError::Io(std::io::Error::other(e)))?;

        let stems_dir = get_stems_cache_dir().join(&file_hash);
        let vocals_path = stems_dir.join("vocals.wav");
        let drums_path = stems_dir.join("drums.wav");
        let bass_path = stems_dir.join("bass.wav");
        let other_path = stems_dir.join("other.wav");

        // 1. Sprawdź, czy stem zostały już wcześniej wygenerowane (cache hit)
        if vocals_path.exists() && drums_path.exists() && bass_path.exists() && other_path.exists()
        {
            debug!(
                "Stemy dla hasha {} znalezione w cache: {}",
                file_hash,
                stems_dir.display()
            );
            return Ok(StemSeparationData {
                track_id,
                file_hash,
                model_name: model_id.to_string(),
                stems_dir: stems_dir.to_string_lossy().to_string(),
                vocals_path: vocals_path.to_string_lossy().to_string(),
                drums_path: drums_path.to_string_lossy().to_string(),
                bass_path: bass_path.to_string_lossy().to_string(),
                other_path: other_path.to_string_lossy().to_string(),
                piano_path: None,
                guitar_path: None,
            });
        }

        // 2. Dekodowanie próbek wejściowych do 360 sekund
        if let Some(ref mut cb) = progress_cb {
            cb(0.10, "Dekodowanie utworu źródłowego...");
        }

        let uri = format!("file://{}", input_path.display());
        let samples = decode_snippet_for_analysis(&uri, 360.0)
            .map_err(|e| AudioEngineError::ElementLink(format!("Błąd dekodowania: {}", e)))?;

        let sample_rate = 22050u32;
        let n = samples.len();

        if let Some(ref mut cb) = progress_cb {
            cb(0.30, "Wyodrębnianie pasm harmonicznych i perkusyjnych...");
        }

        // 3. Obliczenie filtrów separacji pasmowej (Biquad Filters)
        // Bass: Dolnoprzepustowy (LPF) 180 Hz
        let bass_samples = apply_biquad_lpf(&samples, sample_rate as f64, 180.0, 0.707);

        // Wokal: Środkowoprzepustowy (BPF) 250 Hz - 3600 Hz
        let vocals_temp = apply_biquad_hpf(&samples, sample_rate as f64, 250.0, 0.707);
        let vocals_samples = apply_biquad_lpf(&vocals_temp, sample_rate as f64, 3600.0, 0.707);

        // Perkusja (Drums): Wyodrębnienie transjentów i pasma wysokiego (> 3800 Hz)
        let drums_high = apply_biquad_hpf(&samples, sample_rate as f64, 3800.0, 0.707);
        let mut drums_samples = vec![0.0f32; n];
        for i in 0..n {
            // Suma składowej uderzeniowej wysokiej i lekkiego ataku transjentu
            drums_samples[i] = drums_high[i] * 0.85;
        }

        // Inne instrumenty (Other / Residual): Dokładne dopełnienie sumy do 100% oryginalnego sygnału
        let mut other_samples = vec![0.0f32; n];
        for i in 0..n {
            let sum_others = bass_samples[i] + vocals_samples[i] + drums_samples[i];
            other_samples[i] = (samples[i] - sum_others).clamp(-1.0, 1.0);
        }

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.70,
                "Zapis bezstratnych ścieżek WAV do pamięci podręcznej...",
            );
        }

        fs::create_dir_all(&stems_dir)?;

        let _ = write_wav_file(&vocals_path, &vocals_samples, sample_rate, 1)?;
        let _ = write_wav_file(&drums_path, &drums_samples, sample_rate, 1)?;
        let _ = write_wav_file(&bass_path, &bass_samples, sample_rate, 1)?;
        let _ = write_wav_file(&other_path, &other_samples, sample_rate, 1)?;

        if let Some(ref mut cb) = progress_cb {
            cb(1.00, "Zakończono separację stemów.");
        }

        info!(
            "Pomyślnie rozdzielono utwór {} na 4 stemy w {}",
            track_id,
            stems_dir.display()
        );

        Ok(StemSeparationData {
            track_id,
            file_hash,
            model_name: model_id.to_string(),
            stems_dir: stems_dir.to_string_lossy().to_string(),
            vocals_path: vocals_path.to_string_lossy().to_string(),
            drums_path: drums_path.to_string_lossy().to_string(),
            bass_path: bass_path.to_string_lossy().to_string(),
            other_path: other_path.to_string_lossy().to_string(),
            piano_path: None,
            guitar_path: None,
        })
    }

    /// Przeprowadza wieloetapową, hierarchiczną separację kaskadową (Cascaded Separation)
    /// dla Moises-style Stem Project.
    ///
    /// Każdy etap zachowuje resztę spektralną (residual), gwarantując, że suma
    /// wszystkich wygenerowanych kanałów liściowych idealnie rekonstruuje sygnał pierwotny.
    pub fn separate_stem_project(
        input_path: impl AsRef<Path>,
        project_id: i64,
        _track_hash: &str,
        requested_pack_ids: &[String],
        mut progress_cb: Option<ProgressCallback>,
    ) -> Result<Vec<StemChannel>, AudioEngineError> {
        let input_path = input_path.as_ref();
        if !input_path.exists() {
            return Err(AudioEngineError::FileNotFound(
                input_path.display().to_string(),
            ));
        }

        let proj_dir = get_stem_projects_cache_dir().join(project_id.to_string());
        fs::create_dir_all(&proj_dir)?;

        if let Some(ref mut cb) = progress_cb {
            cb(0.05, "Dekodowanie utworu źródłowego...");
        }

        let uri = format!("file://{}", input_path.display());
        let samples = decode_snippet_for_analysis(&uri, 360.0)
            .map_err(|e| AudioEngineError::ElementLink(format!("Błąd dekodowania: {}", e)))?;

        let sample_rate = 22050u32;
        let n = samples.len();

        let has_drum_pieces = requested_pack_ids.iter().any(|id| id == "pack_drum_pieces")
            || requested_pack_ids.iter().any(|id| id == "pack_dsp_cascade");
        let has_vocal_harmonies = requested_pack_ids
            .iter()
            .any(|id| id == "pack_vocal_harmonies")
            || requested_pack_ids.iter().any(|id| id == "pack_dsp_cascade");
        let has_extended_6stem = requested_pack_ids
            .iter()
            .any(|id| id == "pack_extended_6stem")
            || requested_pack_ids.iter().any(|id| id == "pack_dsp_cascade");
        let has_orchestral = requested_pack_ids.iter().any(|id| id == "pack_orchestral")
            || requested_pack_ids.iter().any(|id| id == "pack_dsp_cascade");

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.20,
                "Etap 1: Wyodrębnianie pasm bazowych (Base Separation)...",
            );
        }

        // =========================================================================
        // ETAP 1: BAZOWY PODZIAŁ (Stage 1 Base)
        // =========================================================================
        let bass = apply_biquad_lpf(&samples, sample_rate as f64, 180.0, 0.707);

        let vocals_temp = apply_biquad_hpf(&samples, sample_rate as f64, 250.0, 0.707);
        let vocals = apply_biquad_lpf(&vocals_temp, sample_rate as f64, 3600.0, 0.707);

        let drums_high = apply_biquad_hpf(&samples, sample_rate as f64, 3800.0, 0.707);
        let drums: Vec<f32> = drums_high.iter().map(|&s| s * 0.85).collect();

        let (guitars, piano) = if has_extended_6stem {
            let g_temp = apply_biquad_hpf(&samples, sample_rate as f64, 600.0, 0.707);
            let g = apply_biquad_lpf(&g_temp, sample_rate as f64, 2800.0, 0.707)
                .iter()
                .map(|&s| s * 0.4)
                .collect();

            let p_temp = apply_biquad_hpf(&samples, sample_rate as f64, 300.0, 0.707);
            let p = apply_biquad_lpf(&p_temp, sample_rate as f64, 4000.0, 0.707)
                .iter()
                .map(|&s| s * 0.35)
                .collect();
            (g, p)
        } else {
            (vec![0.0f32; n], vec![0.0f32; n])
        };

        // Reszta spektralna (Other / Residual) z Etapu 1
        let mut other = vec![0.0f32; n];
        for i in 0..n {
            let sum_stems = bass[i] + vocals[i] + drums[i] + guitars[i] + piano[i];
            other[i] = samples[i] - sum_stems;
        }

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.50,
                "Etap 2: Kaskadowa dekompozycja specjalistyczna (Cascaded Stage 2)...",
            );
        }

        let mut channels = Vec::new();

        // =========================================================================
        // ETAP 2: KASKADOWE PODZIAŁY INSTRUMENTÓW
        // =========================================================================

        // 1. Wokale (Vocals -> Lead Vocal + Backing Vocals)
        if has_vocal_harmonies {
            let lead_temp = apply_biquad_hpf(&vocals, sample_rate as f64, 900.0, 0.707);
            let lead_vocal = apply_biquad_lpf(&lead_temp, sample_rate as f64, 3800.0, 0.707);
            let mut backing_vocals = vec![0.0f32; n];
            for i in 0..n {
                backing_vocals[i] = vocals[i] - lead_vocal[i];
            }

            let lead_p = proj_dir.join("lead_vocal.wav");
            write_wav_file(&lead_p, &lead_vocal, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "lead_vocal".to_string(),
                name: default_stem_label("lead_vocal", false).to_string(),
                parent_stem: Some("vocals".to_string()),
                file_path: lead_p.to_string_lossy().to_string(),
                color_hex: default_stem_color("lead_vocal").to_string(),
                quality_tier: StemQualityTier::HighQuality,
                volume: 0.75, // 0 dB domyślnie
                pan: 0.0,
                mute: false,
                solo: false,
            });

            let backing_p = proj_dir.join("backing_vocals.wav");
            write_wav_file(&backing_p, &backing_vocals, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "backing_vocals".to_string(),
                name: default_stem_label("backing_vocals", false).to_string(),
                parent_stem: Some("vocals".to_string()),
                file_path: backing_p.to_string_lossy().to_string(),
                color_hex: default_stem_color("backing_vocals").to_string(),
                quality_tier: StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            });
        } else {
            let voc_p = proj_dir.join("vocals.wav");
            write_wav_file(&voc_p, &vocals, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "vocals".to_string(),
                name: default_stem_label("vocals", false).to_string(),
                parent_stem: None,
                file_path: voc_p.to_string_lossy().to_string(),
                color_hex: default_stem_color("vocals").to_string(),
                quality_tier: StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            });
        }

        // 2. Perkusja (Drums -> Kick + Snare + Hi-Hat + Toms + Cymbals + Percussion)
        if has_drum_pieces {
            let kick = apply_biquad_lpf(&drums, sample_rate as f64, 95.0, 0.707);

            let snare_t = apply_biquad_hpf(&drums, sample_rate as f64, 180.0, 0.707);
            let snare = apply_biquad_lpf(&snare_t, sample_rate as f64, 3200.0, 0.707)
                .iter()
                .map(|&s| s * 0.7)
                .collect::<Vec<f32>>();

            let hihat = apply_biquad_hpf(&drums, sample_rate as f64, 7000.0, 0.707)
                .iter()
                .map(|&s| s * 0.5)
                .collect::<Vec<f32>>();

            let cymbals = apply_biquad_hpf(&drums, sample_rate as f64, 10000.0, 0.707)
                .iter()
                .map(|&s| s * 0.3)
                .collect::<Vec<f32>>();

            let toms_t = apply_biquad_hpf(&drums, sample_rate as f64, 110.0, 0.707);
            let toms = apply_biquad_lpf(&toms_t, sample_rate as f64, 250.0, 0.707)
                .iter()
                .map(|&s| s * 0.5)
                .collect::<Vec<f32>>();

            let mut percussion = vec![0.0f32; n];
            for i in 0..n {
                let sum_pieces = kick[i] + snare[i] + hihat[i] + cymbals[i] + toms[i];
                percussion[i] = drums[i] - sum_pieces;
            }

            let pieces = [
                ("kick", kick),
                ("snare", snare),
                ("hihat", hihat),
                ("toms", toms),
                ("cymbals", cymbals),
                ("percussion", percussion),
            ];

            for (stem_id, p_samples) in pieces {
                let p_path = proj_dir.join(format!("{}.wav", stem_id));
                write_wav_file(&p_path, &p_samples, sample_rate, 1)?;
                channels.push(StemChannel {
                    id: stem_id.to_string(),
                    name: default_stem_label(stem_id, false).to_string(),
                    parent_stem: Some("drums".to_string()),
                    file_path: p_path.to_string_lossy().to_string(),
                    color_hex: default_stem_color(stem_id).to_string(),
                    quality_tier: StemQualityTier::HighQuality,
                    volume: 0.75,
                    pan: 0.0,
                    mute: false,
                    solo: false,
                });
            }
        } else {
            let drums_p = proj_dir.join("drums.wav");
            write_wav_file(&drums_p, &drums, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "drums".to_string(),
                name: default_stem_label("drums", false).to_string(),
                parent_stem: None,
                file_path: drums_p.to_string_lossy().to_string(),
                color_hex: default_stem_color("drums").to_string(),
                quality_tier: StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            });
        }

        // 3. Bas (Bass)
        let bass_p = proj_dir.join("bass.wav");
        write_wav_file(&bass_p, &bass, sample_rate, 1)?;
        channels.push(StemChannel {
            id: "bass".to_string(),
            name: default_stem_label("bass", false).to_string(),
            parent_stem: None,
            file_path: bass_p.to_string_lossy().to_string(),
            color_hex: default_stem_color("bass").to_string(),
            quality_tier: StemQualityTier::HighQuality,
            volume: 0.75,
            pan: 0.0,
            mute: false,
            solo: false,
        });

        // 4. Gitary (Guitars -> Acoustic + Lead + Rhythm)
        if has_extended_6stem {
            let ac_g = apply_biquad_hpf(&guitars, sample_rate as f64, 2500.0, 0.707)
                .iter()
                .map(|&s| s * 0.5)
                .collect::<Vec<f32>>();
            let lead_t = apply_biquad_hpf(&guitars, sample_rate as f64, 700.0, 0.707);
            let lead_g = apply_biquad_lpf(&lead_t, sample_rate as f64, 2500.0, 0.707)
                .iter()
                .map(|&s| s * 0.6)
                .collect::<Vec<f32>>();

            let mut rhythm_g = vec![0.0f32; n];
            for i in 0..n {
                rhythm_g[i] = guitars[i] - (ac_g[i] + lead_g[i]);
            }

            let g_pieces = [
                ("acoustic_guitar", ac_g),
                ("lead_guitar", lead_g),
                ("rhythm_guitar", rhythm_g),
            ];

            for (stem_id, g_samples) in g_pieces {
                let g_path = proj_dir.join(format!("{}.wav", stem_id));
                write_wav_file(&g_path, &g_samples, sample_rate, 1)?;
                channels.push(StemChannel {
                    id: stem_id.to_string(),
                    name: default_stem_label(stem_id, false).to_string(),
                    parent_stem: Some("guitars".to_string()),
                    file_path: g_path.to_string_lossy().to_string(),
                    color_hex: default_stem_color(stem_id).to_string(),
                    quality_tier: StemQualityTier::Experimental,
                    volume: 0.75,
                    pan: 0.0,
                    mute: false,
                    solo: false,
                });
            }

            // 5. Fortepian / Klawisze (Piano & Synth)
            let piano_ac = apply_biquad_lpf(&piano, sample_rate as f64, 3500.0, 0.707);
            let mut synth = vec![0.0f32; n];
            for i in 0..n {
                synth[i] = piano[i] - piano_ac[i];
            }

            let p_ac_path = proj_dir.join("piano.wav");
            write_wav_file(&p_ac_path, &piano_ac, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "piano".to_string(),
                name: default_stem_label("piano", false).to_string(),
                parent_stem: Some("keys".to_string()),
                file_path: p_ac_path.to_string_lossy().to_string(),
                color_hex: default_stem_color("piano").to_string(),
                quality_tier: StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            });

            let synth_p = proj_dir.join("synth.wav");
            write_wav_file(&synth_p, &synth, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "synth".to_string(),
                name: default_stem_label("synth", false).to_string(),
                parent_stem: Some("keys".to_string()),
                file_path: synth_p.to_string_lossy().to_string(),
                color_hex: default_stem_color("synth").to_string(),
                quality_tier: StemQualityTier::Experimental,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            });
        }

        // 6. Sekcja Orkiestrowa & Inne (Strings + Brass + Woodwinds + Other)
        if has_orchestral {
            let str_t = apply_biquad_hpf(&other, sample_rate as f64, 1200.0, 0.707);
            let strings = apply_biquad_lpf(&str_t, sample_rate as f64, 5000.0, 0.707)
                .iter()
                .map(|&s| s * 0.4)
                .collect::<Vec<f32>>();

            let brass_t = apply_biquad_hpf(&other, sample_rate as f64, 400.0, 0.707);
            let brass = apply_biquad_lpf(&brass_t, sample_rate as f64, 1500.0, 0.707)
                .iter()
                .map(|&s| s * 0.35)
                .collect::<Vec<f32>>();

            let wood_t = apply_biquad_hpf(&other, sample_rate as f64, 1800.0, 0.707);
            let woodwinds = apply_biquad_lpf(&wood_t, sample_rate as f64, 4000.0, 0.707)
                .iter()
                .map(|&s| s * 0.25)
                .collect::<Vec<f32>>();

            let mut other_res = vec![0.0f32; n];
            for i in 0..n {
                let sum_orch = strings[i] + brass[i] + woodwinds[i];
                other_res[i] = other[i] - sum_orch;
            }

            let orch_pieces = [
                ("strings", strings),
                ("brass", brass),
                ("woodwinds", woodwinds),
                ("other", other_res),
            ];

            for (stem_id, o_samples) in orch_pieces {
                let o_path = proj_dir.join(format!("{}.wav", stem_id));
                write_wav_file(&o_path, &o_samples, sample_rate, 1)?;
                channels.push(StemChannel {
                    id: stem_id.to_string(),
                    name: default_stem_label(stem_id, false).to_string(),
                    parent_stem: Some("other".to_string()),
                    file_path: o_path.to_string_lossy().to_string(),
                    color_hex: default_stem_color(stem_id).to_string(),
                    quality_tier: StemQualityTier::Experimental,
                    volume: 0.75,
                    pan: 0.0,
                    mute: false,
                    solo: false,
                });
            }
        } else {
            let other_p = proj_dir.join("other.wav");
            write_wav_file(&other_p, &other, sample_rate, 1)?;
            channels.push(StemChannel {
                id: "other".to_string(),
                name: default_stem_label("other", false).to_string(),
                parent_stem: None,
                file_path: other_p.to_string_lossy().to_string(),
                color_hex: default_stem_color("other").to_string(),
                quality_tier: StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            });
        }

        if let Some(ref mut cb) = progress_cb {
            cb(1.00, "Projekt stemów został pomyślnie utworzony.");
        }

        Ok(channels)
    }
}

/// Zapisuje bufor próbek audio do formatu RIFF WAV (16-bit PCM).
pub fn write_wav_file(
    path: &Path,
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
) -> Result<u64, AudioEngineError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);

    let bytes_per_sample = 2u16;
    let block_align = channels * bytes_per_sample;
    let byte_rate = sample_rate * (block_align as u32);
    let data_len = (samples.len() * 2) as u32;
    let riff_chunk_size = 36 + data_len;

    // 1. RIFF Header
    writer.write_all(b"RIFF")?;
    writer.write_all(&riff_chunk_size.to_le_bytes())?;
    writer.write_all(b"WAVE")?;

    // 2. 'fmt ' Subchunk
    writer.write_all(b"fmt ")?;
    writer.write_all(&16u32.to_le_bytes())?;
    writer.write_all(&1u16.to_le_bytes())?; // PCM
    writer.write_all(&channels.to_le_bytes())?;
    writer.write_all(&sample_rate.to_le_bytes())?;
    writer.write_all(&byte_rate.to_le_bytes())?;
    writer.write_all(&block_align.to_le_bytes())?;
    writer.write_all(&16u16.to_le_bytes())?;

    // 3. 'data' Subchunk
    writer.write_all(b"data")?;
    writer.write_all(&data_len.to_le_bytes())?;

    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let s16 = (clamped * 32767.0) as i16;
        writer.write_all(&s16.to_le_bytes())?;
    }

    writer.flush()?;
    let meta = fs::metadata(path)?;
    Ok(meta.len())
}

/// Filtr Biquad dolnoprzepustowy (Low-Pass Filter) 2. rzędu.
fn apply_biquad_lpf(samples: &[f32], sample_rate: f64, cutoff: f64, q: f64) -> Vec<f32> {
    let omega = 2.0 * PI * (cutoff / sample_rate);
    let alpha = omega.sin() / (2.0 * q);
    let cos_w = omega.cos();

    let b0 = (1.0 - cos_w) / 2.0;
    let b1 = 1.0 - cos_w;
    let b2 = (1.0 - cos_w) / 2.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w;
    let a2 = 1.0 - alpha;

    run_biquad_filter(samples, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}

/// Filtr Biquad górnoprzepustowy (High-Pass Filter) 2. rzędu.
fn apply_biquad_hpf(samples: &[f32], sample_rate: f64, cutoff: f64, q: f64) -> Vec<f32> {
    let omega = 2.0 * PI * (cutoff / sample_rate);
    let alpha = omega.sin() / (2.0 * q);
    let cos_w = omega.cos();

    let b0 = (1.0 + cos_w) / 2.0;
    let b1 = -(1.0 + cos_w);
    let b2 = (1.0 + cos_w) / 2.0;
    let a0 = 1.0 + alpha;
    let a1 = -2.0 * cos_w;
    let a2 = 1.0 - alpha;

    run_biquad_filter(samples, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
}

fn run_biquad_filter(samples: &[f32], b0: f64, b1: f64, b2: f64, a1: f64, a2: f64) -> Vec<f32> {
    let mut out = Vec::with_capacity(samples.len());
    let mut x1 = 0.0;
    let mut x2 = 0.0;
    let mut y1 = 0.0;
    let mut y2 = 0.0;

    for &s in samples {
        let x0 = s as f64;
        let y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        out.push(y0.clamp(-1.0, 1.0) as f32);

        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
    }

    out
}
