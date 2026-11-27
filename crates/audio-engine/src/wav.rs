//! 16-bit PCM RIFF WAV writer for stems and test fixtures.
//!
//! Files are written to `<name>.partial` and renamed into place, so an interrupted write never
//! leaves a truncated file under the target name (the stem cache would treat it as complete).
//! Samples are converted in fixed-size chunks and streamed through a `BufWriter`: no interleaved
//! copy of the signal and no `write_all` per sample.

use crate::error::AudioEngineError;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;

/// Write buffer of the WAV writer (bytes).
const WRITE_BUFFER_BYTES: usize = 1 << 16;
/// Samples converted to bytes per chunk.
const CHUNK_SAMPLES: usize = 4096;

/// Writes a buffer of interleaved audio samples as RIFF WAV (16-bit PCM).
pub fn write_wav_file(
    path: &Path,
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
) -> Result<u64, AudioEngineError> {
    write_atomically(path, |writer| {
        write_header(writer, samples.len(), sample_rate, channels)?;
        write_samples(writer, samples.iter().copied())
    })
}

/// Writes stereo L and R samples to a 16-bit RIFF WAV file (stereo, 2 channels), interleaving
/// them on the fly.
pub fn write_wav_file_stereo(
    path: &Path,
    left: &[f32],
    right: &[f32],
    sample_rate: u32,
) -> Result<u64, AudioEngineError> {
    let n = left.len().min(right.len());
    write_atomically(path, |writer| {
        write_header(writer, n * 2, sample_rate, 2)?;
        write_samples(
            writer,
            left[..n]
                .iter()
                .zip(&right[..n])
                .flat_map(|(&l, &r)| [l, r]),
        )
    })
}

fn write_atomically(
    path: &Path,
    write: impl FnOnce(&mut BufWriter<File>) -> std::io::Result<()>,
) -> Result<u64, AudioEngineError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut partial_name = path.as_os_str().to_owned();
    partial_name.push(".partial");
    let partial = std::path::PathBuf::from(partial_name);

    let result = File::create(&partial)
        .and_then(|file| {
            let mut writer = BufWriter::with_capacity(WRITE_BUFFER_BYTES, file);
            write(&mut writer)?;
            writer.flush()?;
            writer.get_ref().sync_all()
        })
        .and_then(|()| fs::rename(&partial, path));
    if let Err(e) = result {
        let _ = fs::remove_file(&partial);
        return Err(e.into());
    }
    Ok(fs::metadata(path)?.len())
}

fn write_header(
    writer: &mut impl Write,
    sample_count: usize,
    sample_rate: u32,
    channels: u16,
) -> std::io::Result<()> {
    let bytes_per_sample = 2u16;
    let block_align = channels * bytes_per_sample;
    let byte_rate = sample_rate * (block_align as u32);
    let data_len = (sample_count * 2) as u32;
    let riff_chunk_size = 36 + data_len;

    // 1. RIFF header
    writer.write_all(b"RIFF")?;
    writer.write_all(&riff_chunk_size.to_le_bytes())?;
    writer.write_all(b"WAVE")?;

    // 2. 'fmt ' subchunk
    writer.write_all(b"fmt ")?;
    writer.write_all(&16u32.to_le_bytes())?;
    writer.write_all(&1u16.to_le_bytes())?; // PCM
    writer.write_all(&channels.to_le_bytes())?;
    writer.write_all(&sample_rate.to_le_bytes())?;
    writer.write_all(&byte_rate.to_le_bytes())?;
    writer.write_all(&block_align.to_le_bytes())?;
    writer.write_all(&16u16.to_le_bytes())?;

    // 3. 'data' subchunk header
    writer.write_all(b"data")?;
    writer.write_all(&data_len.to_le_bytes())
}

fn write_samples(
    writer: &mut impl Write,
    samples: impl Iterator<Item = f32>,
) -> std::io::Result<()> {
    let mut bytes = [0u8; CHUNK_SAMPLES * 2];
    let mut len = 0;
    for sample in samples {
        let s16 = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
        bytes[len..len + 2].copy_from_slice(&s16.to_le_bytes());
        len += 2;
        if len == bytes.len() {
            writer.write_all(&bytes)?;
            len = 0;
        }
    }
    writer.write_all(&bytes[..len])
}
