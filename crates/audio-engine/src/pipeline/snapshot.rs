//! Single-lock playback status snapshot for the UI ticker and commands.

use super::*;

/// Complete engine state captured under a single `inner` + `queue` pass.
#[derive(Debug, Clone)]
pub struct EngineStatusSnapshot {
    pub state: PlaybackState,
    pub position: Option<Duration>,
    pub duration: Option<Duration>,
    pub volume: f64,
    pub dsp_params: DspParams,
    pub capabilities: DspCapabilities,
    pub loop_mode: LoopMode,
    pub shuffle: bool,
    pub stop_after_current: bool,
    pub current_item: Option<QueueItem>,
    pub current_uri: Option<String>,
    pub equalizer_enabled: bool,
    pub equalizer_bands: [f64; 10],
    pub parametric_eq_enabled: bool,
    pub compressor_enabled: bool,
    pub saturator_enabled: bool,
    pub limiter_enabled: bool,
    pub clip_detected: bool,
    pub replaygain_config: ReplayGainConfig,
    pub replaygain_status: (f64, f64, bool),
    pub is_stems_active: bool,
    pub active_stem_project_id: Option<i64>,
}

impl AudioEngine {
    /// Captures the full playback state while holding `inner` once and `queue` once
    /// (respecting the `inner` -> `queue` lock order).
    pub fn status_snapshot(&self) -> EngineStatusSnapshot {
        let mut inner = self.inner.lock_safe();
        let duration = Self::duration_locked(&mut inner);
        let position = Self::calculate_media_position(&mut inner);

        let state = inner.state;
        let dsp_params = inner.dsp_params;
        let capabilities = inner.cached_capabilities.clone();
        let current_uri = inner.current_uri.clone();
        let equalizer_enabled = inner.equalizer_state.enabled;
        let equalizer_bands = inner.equalizer_state.bands;
        let parametric_eq_enabled = inner.parametric_eq_state.enabled;
        let compressor_enabled = inner.dynamics_state.compressor.enabled;
        let saturator_enabled = inner.dynamics_state.saturator.enabled;
        let limiter_enabled = inner.dynamics_state.limiter.enabled;
        let replaygain_config = inner.replaygain_config;
        let replaygain_status = if replaygain_config.mode == ReplayGainMode::Off {
            (0.0, 0.0, inner.effective_limiter_enabled())
        } else {
            let target: f64 = inner.rgvolume.property("target-gain");
            let result: f64 = inner.rgvolume.property("result-gain");
            (target, result, inner.effective_limiter_enabled())
        };
        let is_stems_active = inner.stem_mixer_elements.is_some();
        let active_stem_project_id = inner.active_stem_project_id;

        let (loop_mode, shuffle, current_item) = {
            let q = self.queue.lock_safe();
            (q.loop_mode, q.shuffle, q.current_item().cloned())
        };
        drop(inner);

        EngineStatusSnapshot {
            state,
            position,
            duration,
            volume: self.volume(),
            dsp_params,
            capabilities,
            loop_mode,
            shuffle,
            stop_after_current: self.stop_after_current(),
            current_item,
            current_uri,
            equalizer_enabled,
            equalizer_bands,
            parametric_eq_enabled,
            compressor_enabled,
            saturator_enabled,
            limiter_enabled,
            clip_detected: self.clip_detected(),
            replaygain_config,
            replaygain_status,
            is_stems_active,
            active_stem_project_id,
        }
    }
}

impl AudioEngine {
    /// Names of the elements from `queue_in` to the sink, following the linked src pads
    /// (diagnostics and graph-order tests; runs on the control plane).
    pub fn element_chain(&self) -> Vec<String> {
        let mut chain = Vec::new();
        let mut current = Some(self.inner.lock_safe().queue_in.clone());
        while let Some(element) = current {
            chain.push(element.name().to_string());
            if chain.len() > 64 {
                break; // defensive: a loop would be a broken graph
            }
            current = element
                .static_pad("src")
                .and_then(|pad| pad.peer())
                .and_then(|peer| peer.parent_element());
        }
        chain
    }
}
