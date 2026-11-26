use audio_engine::rt::{
    extend_f32_samples, f32_samples, map_f32_samples_in_place, map_stereo_frames_in_place,
    RateLimiter,
};

fn bytes_of(samples: &[f32]) -> Vec<u8> {
    samples.iter().flat_map(|s| s.to_ne_bytes()).collect()
}

/// Bytes offset by 1 from 4-byte alignment, which forces the copying path.
fn misaligned(samples: &[f32]) -> (Vec<u8>, usize) {
    let mut buf = vec![0u8; samples.len() * 4 + 8];
    let base = buf.as_ptr() as usize;
    let offset = (0..4).find(|o| !(base + o).is_multiple_of(4)).unwrap();
    buf[offset..offset + samples.len() * 4].copy_from_slice(&bytes_of(samples));
    (buf, offset)
}

#[test]
fn test_aligned_bytes_cast_without_copy() {
    let samples = [0.25f32, -0.5, 1.0];
    let aligned: Vec<f32> = samples.to_vec();
    let bytes: &[u8] = bytemuck::cast_slice(&aligned);
    assert_eq!(f32_samples(bytes), Some(&samples[..]));
}

#[test]
fn test_misaligned_bytes_fall_back_to_copy() {
    let samples = [0.1f32, 0.2, 0.3, 0.4];
    let (buf, off) = misaligned(&samples);
    let view = &buf[off..off + 16];
    assert_eq!(
        f32_samples(view),
        None,
        "an unaligned buffer must not be cast"
    );

    let mut out = Vec::new();
    extend_f32_samples(view, &mut out);
    assert_eq!(out, samples);
}

#[test]
fn test_trailing_partial_sample_is_ignored() {
    let mut bytes = bytes_of(&[1.0, 2.0]);
    bytes.push(0xFF);
    let mut out = Vec::new();
    extend_f32_samples(&bytes, &mut out);
    assert_eq!(out, [1.0, 2.0]);
}

#[test]
fn test_in_place_maps_work_on_aligned_and_misaligned_buffers() {
    let samples = [0.5f32, -0.5, 0.25, -0.25];

    let mut aligned = samples.to_vec();
    let bytes: &mut [u8] = bytemuck::cast_slice_mut(&mut aligned);
    map_f32_samples_in_place(bytes, |s| s * 2.0);
    assert_eq!(aligned, [1.0, -1.0, 0.5, -0.5]);

    let (mut buf, off) = misaligned(&samples);
    map_stereo_frames_in_place(&mut buf[off..off + 16], |l, r| (r, l));
    let mut out = Vec::new();
    extend_f32_samples(&buf[off..off + 16], &mut out);
    assert_eq!(out, [-0.5, 0.5, -0.25, 0.25]);
}

#[test]
fn test_rate_limiter_logs_first_and_every_nth() {
    let limiter = RateLimiter::new();
    let logged: Vec<bool> = (0..7).map(|_| limiter.should_log(3)).collect();
    assert_eq!(logged, [true, false, false, true, false, false, true]);
}
