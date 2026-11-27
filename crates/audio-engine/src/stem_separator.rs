//! Stem separation (instrumental and vocal tracks).
//!
//! ARCHITECTURE RULE:
//! Separation is an asynchronous job that runs in the background, off the audio thread.
//! The output tracks (WAV/FLAC) are written to the cache directory `~/.cache/auralune/stems/<hash>/`.
//! The source track file is NEVER modified.
//!
//! Memory: a 6-minute 44.1 kHz stereo track is ~127 MB per stereo signal, so every buffer is
//! freed as soon as it has been written. The HPSS split reuses the decoded input as "other",
//! each stem file is written and dropped in turn, and filter chains run in place on one buffer.

use crate::analysis::decode_stereo_for_stems;
use crate::error::AudioEngineError;
use crate::hpss::separate_stereo_hpss;
use crate::model_manager::{cached_file_sha256, get_stem_projects_cache_dir, get_stems_cache_dir};
use domain::analysis::StemSeparationData;
use domain::{default_stem_color, default_stem_label, StemChannel, StemQualityTier};
use std::f64::consts::PI;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info};

pub use crate::wav::{write_wav_file, write_wav_file_stereo};

pub type ProgressCallback = Box<dyn FnMut(f32, &str) + Send>;

/// A stereo signal (left, right).
type Stereo = (Vec<f32>, Vec<f32>);

pub struct StemSeparator;

impl StemSeparator {
    /// Splits a track into 4 stems: vocals, drums, bass, other.
    ///
    /// If separated files already exist in the cache for this file hash,
    /// the existing metadata is returned right away (no overhead).
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

        let file_hash = cached_file_sha256(input_path)
            .map_err(|e| AudioEngineError::Io(std::io::Error::other(e)))?;

        let stems_dir = get_stems_cache_dir().join(&file_hash);
        let vocals_path = stems_dir.join("vocals.wav");
        let drums_path = stems_dir.join("drums.wav");
        let bass_path = stems_dir.join("bass.wav");
        let other_path = stems_dir.join("other.wav");
        let result = StemSeparationData {
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
        };

        // 1. Check whether the stems were generated before (cache hit)
        if vocals_path.exists() && drums_path.exists() && bass_path.exists() && other_path.exists()
        {
            debug!(
                "Stems for hash {} found in the cache: {}",
                result.file_hash,
                stems_dir.display()
            );
            return Ok(result);
        }

        // 2. Decode up to 360 seconds of input in full 44.1 kHz stereo
        if let Some(ref mut cb) = progress_cb {
            cb(0.10, "Decoding the source track (stereo 44.1 kHz)...");
        }

        let uri = crate::uri::media_uri(&input_path.to_string_lossy());
        // No fallback to a mono decode with a short timeout: a truncated result would end up
        // in the stem cache permanently.
        let (left, right, sample_rate) = decode_stereo_for_stems(&uri, 360.0)
            .map_err(|e| AudioEngineError::Pipeline(format!("Decoding failed: {e}")))?;

        if let Some(ref mut cb) = progress_cb {
            cb(0.30, "Spectral HPSS and stereo panorama separation...");
        }

        // 3. Spectral HPSS (harmonic-percussive source separation)
        // Extracts percussive transients across the full range plus vocal and bass harmonics
        let stems = separate_stereo_hpss(left, right, sample_rate, progress_cb.as_deref_mut());

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.88,
                "Writing lossless WAV tracks (stereo 44.1 kHz) to the cache...",
            );
        }

        fs::create_dir_all(&stems_dir)?;
        for (path, stem) in [
            (&vocals_path, stems.vocals),
            (&drums_path, stems.drums),
            (&bass_path, stems.bass),
            (&other_path, stems.other),
        ] {
            write_wav_file_stereo(path, &stem.0, &stem.1, sample_rate)?;
        }

        if let Some(ref mut cb) = progress_cb {
            cb(1.00, "Stem separation finished.");
        }

        info!(
            "Split track {} into 4 stems in {}",
            track_id,
            stems_dir.display()
        );

        Ok(result)
    }

    /// Runs a multi-stage, hierarchical cascaded separation
    /// for a Moises-style stem project.
    ///
    /// Every stage keeps the spectral residual, so the sum of
    /// all generated leaf channels reconstructs the original signal exactly.
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
            cb(0.05, "Decoding the source track (stereo 44.1 kHz)...");
        }

        let uri = crate::uri::media_uri(&input_path.to_string_lossy());
        // No fallback to a mono decode with a short timeout: a truncated result would end up
        // in the stem cache permanently.
        let (left, right, sample_rate) = decode_stereo_for_stems(&uri, 360.0)
            .map_err(|e| AudioEngineError::Pipeline(format!("Decoding failed: {e}")))?;

        let requested = |pack: &str| {
            requested_pack_ids
                .iter()
                .any(|id| id == pack || id == "pack_dsp_cascade")
        };
        let has_drum_pieces = requested("pack_drum_pieces");
        let has_vocal_harmonies = requested("pack_vocal_harmonies");
        let has_extended_6stem = requested("pack_extended_6stem");
        let has_orchestral = requested("pack_orchestral");

        if let Some(ref mut cb) = progress_cb {
            cb(
                0.20,
                "Stage 1: spectral HPSS decomposition (base separation)...",
            );
        }

        // =========================================================================
        // STAGE 1: BASE HPSS SPLIT
        // =========================================================================
        let stems = separate_stereo_hpss(left, right, sample_rate, progress_cb.as_deref_mut());

        if let Some(ref mut cb) = progress_cb {
            cb(0.50, "Stage 2: cascaded specialist decomposition...");
        }

        // =========================================================================
        // STAGE 2: CASCADED INSTRUMENT SPLITS
        // =========================================================================
        let mut out = ProjectWriter {
            dir: proj_dir,
            sample_rate,
            channels: Vec::new(),
        };
        let filters = Filters {
            sample_rate: sample_rate as f64,
        };

        // 1. Vocals (Vocals -> Lead Vocal + Backing Vocals)
        let mut vocals = stems.vocals;
        if has_vocal_harmonies {
            let lead = stereo_map(&vocals, |ch| {
                filters.chain(ch, &[Hpf(800.0), Lpf(3800.0)], 1.0)
            });
            out.write(
                "lead_vocal",
                Some("vocals"),
                StemQualityTier::HighQuality,
                &lead,
            )?;
            // Backing vocals = vocals − lead, computed in the vocals buffer.
            subtract_in_place(&mut vocals, &lead);
            drop(lead);
            out.write(
                "backing_vocals",
                Some("vocals"),
                StemQualityTier::HighQuality,
                &vocals,
            )?;
        } else {
            out.write("vocals", None, StemQualityTier::HighQuality, &vocals)?;
        }
        drop(vocals);

        // 2. Drums (Drums -> Kick + Snare + Hi-Hat + Toms + Cymbals + Percussion)
        let drums = stems.drums;
        if has_drum_pieces {
            // The pieces' sum, accumulated in the original order (kick + snare + hihat + cymbals + toms).
            let mut pieces_sum: Stereo = (vec![0.0; drums.0.len()], vec![0.0; drums.1.len()]);
            for (id, stages) in [
                ("kick", &[Lpf(110.0)][..]),
                ("snare", &[Hpf(180.0), Lpf(3000.0)]),
                ("hihat", &[Hpf(6000.0)]),
            ] {
                let piece = stereo_map(&drums, |ch| filters.chain(ch, stages, 1.0));
                add_in_place(&mut pieces_sum, &piece);
                out.write(id, Some("drums"), StemQualityTier::HighQuality, &piece)?;
            }
            let toms = stereo_map(&drums, |ch| {
                filters.chain(ch, &[Hpf(110.0), Lpf(250.0)], 1.0)
            });
            let cymbals = stereo_map(&drums, |ch| filters.chain(ch, &[Hpf(9500.0)], 1.0));
            add_in_place(&mut pieces_sum, &cymbals);
            add_in_place(&mut pieces_sum, &toms);
            out.write("toms", Some("drums"), StemQualityTier::HighQuality, &toms)?;
            out.write(
                "cymbals",
                Some("drums"),
                StemQualityTier::HighQuality,
                &cymbals,
            )?;
            drop((toms, cymbals));
            // Percussion = drums − Σ pieces, computed in the sum buffer.
            let mut percussion = pieces_sum;
            reverse_subtract_in_place(&mut percussion, &drums);
            out.write(
                "percussion",
                Some("drums"),
                StemQualityTier::HighQuality,
                &percussion,
            )?;
        } else {
            out.write("drums", None, StemQualityTier::HighQuality, &drums)?;
        }
        drop(drums);

        // 3. Bass
        out.write("bass", None, StemQualityTier::HighQuality, &stems.bass)?;
        drop(stems.bass);

        let other = stems.other;

        // 4. Guitars and keys (guitars + piano + synth)
        if has_extended_6stem {
            let mut guitars_rest = stereo_map(&other, |ch| filters.chain(ch, &[Hpf(2500.0)], 0.4));
            let lead_guitar = stereo_map(&other, |ch| {
                filters.chain(ch, &[Hpf(700.0), Lpf(2500.0)], 0.5)
            });
            out.write(
                "acoustic_guitar",
                Some("guitars"),
                StemQualityTier::Experimental,
                &guitars_rest,
            )?;
            out.write(
                "lead_guitar",
                Some("guitars"),
                StemQualityTier::Experimental,
                &lead_guitar,
            )?;
            // Rhythm guitar = other·0.4 − (acoustic + lead), computed in the acoustic buffer.
            for (rest, (lead, src)) in [
                (&mut guitars_rest.0, (&lead_guitar.0, &other.0)),
                (&mut guitars_rest.1, (&lead_guitar.1, &other.1)),
            ] {
                for ((r, &l), &o) in rest.iter_mut().zip(lead.iter()).zip(src.iter()) {
                    *r = (o * 0.4) - (*r + l);
                }
            }
            drop(lead_guitar);
            out.write(
                "rhythm_guitar",
                Some("guitars"),
                StemQualityTier::Experimental,
                &guitars_rest,
            )?;
            drop(guitars_rest);

            // Piano / keys (Piano & Synth)
            let mut keys = stereo_map(&other, |ch| filters.chain(ch, &[Lpf(3200.0)], 0.4));
            out.write("piano", Some("keys"), StemQualityTier::HighQuality, &keys)?;
            // Synth = other·0.3 − piano, computed in the piano buffer.
            for (k, src) in [(&mut keys.0, &other.0), (&mut keys.1, &other.1)] {
                for (p, &o) in k.iter_mut().zip(src.iter()) {
                    *p = (o * 0.3) - *p;
                }
            }
            out.write("synth", Some("keys"), StemQualityTier::Experimental, &keys)?;
        }

        // 5. Orchestral section and others (strings + brass + woodwinds + other)
        if has_orchestral {
            let mut orch_sum: Stereo = (vec![0.0; other.0.len()], vec![0.0; other.1.len()]);
            for (id, stages, gain) in [
                ("strings", [Hpf(1200.0), Lpf(5000.0)], 0.3),
                ("brass", [Hpf(400.0), Lpf(1500.0)], 0.3),
                ("woodwinds", [Hpf(1800.0), Lpf(4000.0)], 0.25),
            ] {
                let section = stereo_map(&other, |ch| filters.chain(ch, &stages, gain));
                add_in_place(&mut orch_sum, &section);
                out.write(id, Some("other"), StemQualityTier::Experimental, &section)?;
            }
            // Other = other − Σ sections, computed in the sum buffer.
            let mut residual = orch_sum;
            reverse_subtract_in_place(&mut residual, &other);
            out.write(
                "other",
                Some("other"),
                StemQualityTier::Experimental,
                &residual,
            )?;
        } else {
            out.write("other", None, StemQualityTier::HighQuality, &other)?;
        }

        if let Some(ref mut cb) = progress_cb {
            cb(1.00, "Stem project created.");
        }

        Ok(out.channels)
    }
}

/// Writes the channels of a stem project and records their metadata.
struct ProjectWriter {
    dir: PathBuf,
    sample_rate: u32,
    channels: Vec<StemChannel>,
}

impl ProjectWriter {
    fn write(
        &mut self,
        id: &str,
        parent: Option<&str>,
        quality_tier: StemQualityTier,
        signal: &Stereo,
    ) -> Result<(), AudioEngineError> {
        let path = self.dir.join(format!("{id}.wav"));
        write_wav_file_stereo(&path, &signal.0, &signal.1, self.sample_rate)?;
        self.channels.push(StemChannel {
            id: id.to_string(),
            name: default_stem_label(id, false).to_string(),
            parent_stem: parent.map(str::to_string),
            file_path: path.to_string_lossy().to_string(),
            color_hex: default_stem_color(id).to_string(),
            quality_tier,
            volume: 0.75, // 0 dB by default
            pan: 0.0,
            mute: false,
            solo: false,
        });
        Ok(())
    }
}

fn stereo_map(signal: &Stereo, mut f: impl FnMut(&[f32]) -> Vec<f32>) -> Stereo {
    (f(&signal.0), f(&signal.1))
}

/// `acc += x`, sample by sample.
fn add_in_place(acc: &mut Stereo, x: &Stereo) {
    for (a, b) in [(&mut acc.0, &x.0), (&mut acc.1, &x.1)] {
        a.iter_mut().zip(b.iter()).for_each(|(a, &b)| *a += b);
    }
}

/// `target −= x`, sample by sample.
fn subtract_in_place(target: &mut Stereo, x: &Stereo) {
    for (t, b) in [(&mut target.0, &x.0), (&mut target.1, &x.1)] {
        t.iter_mut().zip(b.iter()).for_each(|(t, &b)| *t -= b);
    }
}

/// `target = x − target`, sample by sample.
fn reverse_subtract_in_place(target: &mut Stereo, x: &Stereo) {
    for (t, b) in [(&mut target.0, &x.0), (&mut target.1, &x.1)] {
        t.iter_mut().zip(b.iter()).for_each(|(t, &b)| *t = b - *t);
    }
}

/// One second-order biquad stage of a filter chain (cutoff in Hz, Q = 0.707).
#[derive(Clone, Copy)]
enum Stage {
    Lpf(f64),
    Hpf(f64),
}
use Stage::{Hpf, Lpf};

/// Biquad coefficients normalised by `a0`: `(b0, b1, b2, a1, a2)`.
type Coeffs = (f64, f64, f64, f64, f64);

const FILTER_Q: f64 = 0.707;

struct Filters {
    sample_rate: f64,
}

impl Filters {
    /// Runs `stages` in order over `samples` in one output buffer, then scales by `gain`.
    /// Each stage clamps to [-1, 1] like a separate filter pass would, and the gain multiplies the
    /// final stage's clamped `f32` output, the same values as filtering and then scaling.
    fn chain(&self, samples: &[f32], stages: &[Stage], gain: f32) -> Vec<f32> {
        let mut out = samples.to_vec();
        for (i, stage) in stages.iter().enumerate() {
            let stage_gain = if i + 1 == stages.len() { gain } else { 1.0 };
            run_biquad_in_place(&mut out, self.coeffs(*stage), stage_gain);
        }
        out
    }

    fn coeffs(&self, stage: Stage) -> Coeffs {
        let (cutoff, low_pass) = match stage {
            Lpf(c) => (c, true),
            Hpf(c) => (c, false),
        };
        let omega = 2.0 * PI * (cutoff / self.sample_rate);
        let alpha = omega.sin() / (2.0 * FILTER_Q);
        let cos_w = omega.cos();

        let (b0, b1, b2) = if low_pass {
            ((1.0 - cos_w) / 2.0, 1.0 - cos_w, (1.0 - cos_w) / 2.0)
        } else {
            ((1.0 + cos_w) / 2.0, -(1.0 + cos_w), (1.0 + cos_w) / 2.0)
        };
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w;
        let a2 = 1.0 - alpha;
        (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
    }
}

/// Direct-form I biquad over `samples`, in place; each output is clamped to [-1, 1] and then
/// multiplied by `gain`.
fn run_biquad_in_place(samples: &mut [f32], (b0, b1, b2, a1, a2): Coeffs, gain: f32) {
    let mut x1 = 0.0;
    let mut x2 = 0.0;
    let mut y1 = 0.0;
    let mut y2 = 0.0;

    for s in samples.iter_mut() {
        let x0 = *s as f64;
        let y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        *s = (y0.clamp(-1.0, 1.0) as f32) * gain;

        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
    }
}

#[cfg(test)]
#[path = "stem_separator_test.rs"]
mod tests;
