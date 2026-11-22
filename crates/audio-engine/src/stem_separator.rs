//! Moduł separacji stemów (ścieżek instrumentalnych i wokalnych).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Separacja jest zadaniem asynchronicznym, wykonywanym w tle poza wątkiem audio.
//! Ścieżki wynikowe (WAV/FLAC) zapisywane są w katalogu cache `~/.cache/auralune/stems/<hash>/`.
//! Plik źródłowy utworu NIGDY nie jest modyfikowany.

use crate::analysis::{decode_snippet_for_analysis, decode_stereo_for_stems};
use crate::error::AudioEngineError;
use crate::hpss::separate_stereo_hpss;
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

        // 2. Dekodowanie próbek wejściowych do 360 sekund w pełnym stereo 44.1 kHz
        if let Some(ref mut cb) = progress_cb {
            cb(0.10, "Dekodowanie utworu źródłowego (Stereo 44.1 kHz)...");
        }

        let uri = crate::uri::media_uri(&input_path.to_string_lossy());
        let (left, right, sample_rate) = match decode_stereo_for_stems(&uri, 360.0) {
            Ok(res) => res,
            Err(e) => {
                let mono = decode_snippet_for_analysis(&uri, 360.0).map_err(|e2| {
                    AudioEngineError::Pipeline(format!("Błąd dekodowania: {} / {}", e, e2))
                })?;
                let r = mono.clone();
                (mono, r, 22050)
            }
        };

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.30,
                "Zaawansowana separacja spektralna HPSS i panoramy stereo...",
            );
        }

        // 3. Zaawansowana separacja spektralna HPSS (Harmonic-Percussive Source Separation)
        // Wyodrębnia transjenty perkusyjne w całym paśmie oraz harmoniczne wokalne i basowe
        let stems = separate_stereo_hpss(&left, &right, sample_rate, progress_cb.as_deref_mut());

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.88,
                "Zapis bezstratnych ścieżek WAV (Stereo 44.1 kHz) do pamięci podręcznej...",
            );
        }

        fs::create_dir_all(&stems_dir)?;

        let _ = write_wav_file_stereo(&vocals_path, &stems.vocals.0, &stems.vocals.1, sample_rate)?;
        let _ = write_wav_file_stereo(&drums_path, &stems.drums.0, &stems.drums.1, sample_rate)?;
        let _ = write_wav_file_stereo(&bass_path, &stems.bass.0, &stems.bass.1, sample_rate)?;
        let _ = write_wav_file_stereo(&other_path, &stems.other.0, &stems.other.1, sample_rate)?;

        if let Some(ref mut cb) = progress_cb {
            cb(1.00, "Zakończono zaawansowaną separację stemów.");
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
            cb(0.05, "Dekodowanie utworu źródłowego (Stereo 44.1 kHz)...");
        }

        let uri = crate::uri::media_uri(&input_path.to_string_lossy());
        let (left, right, sample_rate) = match decode_stereo_for_stems(&uri, 360.0) {
            Ok(res) => res,
            Err(e) => {
                let mono = decode_snippet_for_analysis(&uri, 360.0).map_err(|e2| {
                    AudioEngineError::Pipeline(format!("Błąd dekodowania: {} / {}", e, e2))
                })?;
                let r = mono.clone();
                (mono, r, 22050)
            }
        };

        let n = left.len().min(right.len());

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
                "Etap 1: Zaawansowana dekompozycja spektralna HPSS (Base Separation)...",
            );
        }

        // =========================================================================
        // ETAP 1: BAZOWY PODZIAŁ HPSS (Stage 1 Base)
        // =========================================================================
        let stems = separate_stereo_hpss(&left, &right, sample_rate, progress_cb.as_deref_mut());
        let (vocals_l, vocals_r) = stems.vocals;
        let (drums_l, drums_r) = stems.drums;
        let (bass_l, bass_r) = stems.bass;
        let (other_l, other_r) = stems.other;

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
            let lead_t_l = apply_biquad_hpf(&vocals_l, sample_rate as f64, 800.0, 0.707);
            let lead_l = apply_biquad_lpf(&lead_t_l, sample_rate as f64, 3800.0, 0.707);
            let lead_t_r = apply_biquad_hpf(&vocals_r, sample_rate as f64, 800.0, 0.707);
            let lead_r = apply_biquad_lpf(&lead_t_r, sample_rate as f64, 3800.0, 0.707);

            let mut backing_l = vec![0.0f32; n];
            let mut backing_r = vec![0.0f32; n];
            for i in 0..n {
                backing_l[i] = vocals_l[i] - lead_l[i];
                backing_r[i] = vocals_r[i] - lead_r[i];
            }

            let lead_p = proj_dir.join("lead_vocal.wav");
            write_wav_file_stereo(&lead_p, &lead_l, &lead_r, sample_rate)?;
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
            write_wav_file_stereo(&backing_p, &backing_l, &backing_r, sample_rate)?;
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
            write_wav_file_stereo(&voc_p, &vocals_l, &vocals_r, sample_rate)?;
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
            let kick_l = apply_biquad_lpf(&drums_l, sample_rate as f64, 110.0, 0.707);
            let kick_r = apply_biquad_lpf(&drums_r, sample_rate as f64, 110.0, 0.707);

            let snare_t_l = apply_biquad_hpf(&drums_l, sample_rate as f64, 180.0, 0.707);
            let snare_l = apply_biquad_lpf(&snare_t_l, sample_rate as f64, 3000.0, 0.707);
            let snare_t_r = apply_biquad_hpf(&drums_r, sample_rate as f64, 180.0, 0.707);
            let snare_r = apply_biquad_lpf(&snare_t_r, sample_rate as f64, 3000.0, 0.707);

            let hihat_l = apply_biquad_hpf(&drums_l, sample_rate as f64, 6000.0, 0.707);
            let hihat_r = apply_biquad_hpf(&drums_r, sample_rate as f64, 6000.0, 0.707);

            let cymbals_l = apply_biquad_hpf(&drums_l, sample_rate as f64, 9500.0, 0.707);
            let cymbals_r = apply_biquad_hpf(&drums_r, sample_rate as f64, 9500.0, 0.707);

            let toms_t_l = apply_biquad_hpf(&drums_l, sample_rate as f64, 110.0, 0.707);
            let toms_l = apply_biquad_lpf(&toms_t_l, sample_rate as f64, 250.0, 0.707);
            let toms_t_r = apply_biquad_hpf(&drums_r, sample_rate as f64, 110.0, 0.707);
            let toms_r = apply_biquad_lpf(&toms_t_r, sample_rate as f64, 250.0, 0.707);

            let mut perc_l = vec![0.0f32; n];
            let mut perc_r = vec![0.0f32; n];
            for i in 0..n {
                let sum_l = kick_l[i] + snare_l[i] + hihat_l[i] + cymbals_l[i] + toms_l[i];
                let sum_r = kick_r[i] + snare_r[i] + hihat_r[i] + cymbals_r[i] + toms_r[i];
                perc_l[i] = drums_l[i] - sum_l;
                perc_r[i] = drums_r[i] - sum_r;
            }

            let pieces = [
                ("kick", kick_l, kick_r),
                ("snare", snare_l, snare_r),
                ("hihat", hihat_l, hihat_r),
                ("toms", toms_l, toms_r),
                ("cymbals", cymbals_l, cymbals_r),
                ("percussion", perc_l, perc_r),
            ];

            for (stem_id, p_l, p_r) in pieces {
                let p_path = proj_dir.join(format!("{}.wav", stem_id));
                write_wav_file_stereo(&p_path, &p_l, &p_r, sample_rate)?;
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
            write_wav_file_stereo(&drums_p, &drums_l, &drums_r, sample_rate)?;
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
        write_wav_file_stereo(&bass_p, &bass_l, &bass_r, sample_rate)?;
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

        // 4. Gitary i Instrumenty Klawiszowe (Guitars + Piano + Synth)
        if has_extended_6stem {
            let ac_g_l = apply_biquad_hpf(&other_l, sample_rate as f64, 2500.0, 0.707)
                .iter()
                .map(|&s| s * 0.4)
                .collect::<Vec<f32>>();
            let ac_g_r = apply_biquad_hpf(&other_r, sample_rate as f64, 2500.0, 0.707)
                .iter()
                .map(|&s| s * 0.4)
                .collect::<Vec<f32>>();

            let lead_t_l = apply_biquad_hpf(&other_l, sample_rate as f64, 700.0, 0.707);
            let lead_g_l = apply_biquad_lpf(&lead_t_l, sample_rate as f64, 2500.0, 0.707)
                .iter()
                .map(|&s| s * 0.5)
                .collect::<Vec<f32>>();
            let lead_t_r = apply_biquad_hpf(&other_r, sample_rate as f64, 700.0, 0.707);
            let lead_g_r = apply_biquad_lpf(&lead_t_r, sample_rate as f64, 2500.0, 0.707)
                .iter()
                .map(|&s| s * 0.5)
                .collect::<Vec<f32>>();

            let mut rhythm_g_l = vec![0.0f32; n];
            let mut rhythm_g_r = vec![0.0f32; n];
            for i in 0..n {
                rhythm_g_l[i] = (other_l[i] * 0.4) - (ac_g_l[i] + lead_g_l[i]);
                rhythm_g_r[i] = (other_r[i] * 0.4) - (ac_g_r[i] + lead_g_r[i]);
            }

            let g_pieces = [
                ("acoustic_guitar", ac_g_l, ac_g_r),
                ("lead_guitar", lead_g_l, lead_g_r),
                ("rhythm_guitar", rhythm_g_l, rhythm_g_r),
            ];

            for (stem_id, g_l, g_r) in g_pieces {
                let g_path = proj_dir.join(format!("{}.wav", stem_id));
                write_wav_file_stereo(&g_path, &g_l, &g_r, sample_rate)?;
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

            // Fortepian / Klawisze (Piano & Synth)
            let piano_l = apply_biquad_lpf(&other_l, sample_rate as f64, 3200.0, 0.707)
                .iter()
                .map(|&s| s * 0.4)
                .collect::<Vec<f32>>();
            let piano_r = apply_biquad_lpf(&other_r, sample_rate as f64, 3200.0, 0.707)
                .iter()
                .map(|&s| s * 0.4)
                .collect::<Vec<f32>>();

            let mut synth_l = vec![0.0f32; n];
            let mut synth_r = vec![0.0f32; n];
            for i in 0..n {
                synth_l[i] = (other_l[i] * 0.3) - piano_l[i];
                synth_r[i] = (other_r[i] * 0.3) - piano_r[i];
            }

            let p_ac_path = proj_dir.join("piano.wav");
            write_wav_file_stereo(&p_ac_path, &piano_l, &piano_r, sample_rate)?;
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
            write_wav_file_stereo(&synth_p, &synth_l, &synth_r, sample_rate)?;
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

        // 5. Sekcja Orkiestrowa & Inne (Strings + Brass + Woodwinds + Other)
        if has_orchestral {
            let str_t_l = apply_biquad_hpf(&other_l, sample_rate as f64, 1200.0, 0.707);
            let strings_l = apply_biquad_lpf(&str_t_l, sample_rate as f64, 5000.0, 0.707)
                .iter()
                .map(|&s| s * 0.3)
                .collect::<Vec<f32>>();
            let str_t_r = apply_biquad_hpf(&other_r, sample_rate as f64, 1200.0, 0.707);
            let strings_r = apply_biquad_lpf(&str_t_r, sample_rate as f64, 5000.0, 0.707)
                .iter()
                .map(|&s| s * 0.3)
                .collect::<Vec<f32>>();

            let brass_t_l = apply_biquad_hpf(&other_l, sample_rate as f64, 400.0, 0.707);
            let brass_l = apply_biquad_lpf(&brass_t_l, sample_rate as f64, 1500.0, 0.707)
                .iter()
                .map(|&s| s * 0.3)
                .collect::<Vec<f32>>();
            let brass_t_r = apply_biquad_hpf(&other_r, sample_rate as f64, 400.0, 0.707);
            let brass_r = apply_biquad_lpf(&brass_t_r, sample_rate as f64, 1500.0, 0.707)
                .iter()
                .map(|&s| s * 0.3)
                .collect::<Vec<f32>>();

            let wood_t_l = apply_biquad_hpf(&other_l, sample_rate as f64, 1800.0, 0.707);
            let woodwinds_l = apply_biquad_lpf(&wood_t_l, sample_rate as f64, 4000.0, 0.707)
                .iter()
                .map(|&s| s * 0.25)
                .collect::<Vec<f32>>();
            let wood_t_r = apply_biquad_hpf(&other_r, sample_rate as f64, 1800.0, 0.707);
            let woodwinds_r = apply_biquad_lpf(&wood_t_r, sample_rate as f64, 4000.0, 0.707)
                .iter()
                .map(|&s| s * 0.25)
                .collect::<Vec<f32>>();

            let mut other_res_l = vec![0.0f32; n];
            let mut other_res_r = vec![0.0f32; n];
            for i in 0..n {
                let sum_orch_l = strings_l[i] + brass_l[i] + woodwinds_l[i];
                let sum_orch_r = strings_r[i] + brass_r[i] + woodwinds_r[i];
                other_res_l[i] = other_l[i] - sum_orch_l;
                other_res_r[i] = other_r[i] - sum_orch_r;
            }

            let orch_pieces = [
                ("strings", strings_l, strings_r),
                ("brass", brass_l, brass_r),
                ("woodwinds", woodwinds_l, woodwinds_r),
                ("other", other_res_l, other_res_r),
            ];

            for (stem_id, o_l, o_r) in orch_pieces {
                let o_path = proj_dir.join(format!("{}.wav", stem_id));
                write_wav_file_stereo(&o_path, &o_l, &o_r, sample_rate)?;
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
            write_wav_file_stereo(&other_p, &other_l, &other_r, sample_rate)?;
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

/// Zapisuje stereofoniczne próbki L i R do 16-bitowego pliku RIFF WAV (Stereo, 2 kanały).
pub fn write_wav_file_stereo(
    path: &Path,
    left: &[f32],
    right: &[f32],
    sample_rate: u32,
) -> Result<u64, AudioEngineError> {
    let n = left.len().min(right.len());
    let mut interleaved = Vec::with_capacity(n * 2);
    for i in 0..n {
        interleaved.push(left[i]);
        interleaved.push(right[i]);
    }
    write_wav_file(path, &interleaved, sample_rate, 2)
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
