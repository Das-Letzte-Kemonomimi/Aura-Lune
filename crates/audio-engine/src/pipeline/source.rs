//! Sound sources: loading files/streams, stems and multitrack projects.

use super::*;

impl AudioEngine {
    /// Loads a local file or URI for playback, including Japanese characters and spaces in the URI.
    pub fn load_uri(&self, uri_or_path: &str) -> Result<(), AudioEngineError> {
        let uri = crate::uri::media_uri_checked(uri_or_path)?;

        let mut inner = self.inner.lock_safe();
        let queue_sink_pad = Self::teardown_source(&mut inner)?;

        let uri_decoder = gst::ElementFactory::make("uridecodebin")
            .property("uri", &uri)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("uridecodebin"))?;

        inner.pipeline.add(&uri_decoder)?;

        let queue_pad_clone = queue_sink_pad.clone();
        uri_decoder.connect_pad_added(move |_bin, src_pad| {
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            if let Some(structure) = caps.structure(0) {
                if structure.name().starts_with("audio/") {
                    if queue_pad_clone.is_linked() {
                        if let Some(peer) = queue_pad_clone.peer() {
                            let _ = peer.unlink(&queue_pad_clone);
                        }
                    }
                    if let Err(err) = src_pad.link(&queue_pad_clone) {
                        error!(
                            "Failed to link the decodebin audio stream to queue_in: {:?}",
                            err
                        );
                    } else {
                        debug!("Linked the decoded audio stream to queue_in");
                    }
                }
            }
        });

        // Safely sync the new element's state with the pipeline
        if let Err(err) = uri_decoder.sync_state_with_parent() {
            debug!(
                "sync_state_with_parent info (normal in State::Null): {:?}",
                err
            );
        }
        inner.uri_decoder = Some(uri_decoder);
        inner.current_uri = Some(uri.to_string());
        if !uri.starts_with("stem") {
            inner.original_track_uri = Some(uri.to_string());
            inner.active_stem_project_id = None;
        }
        inner.state = PlaybackState::Stopped;

        info!("Loaded URI: {}", uri);
        Ok(())
    }

    /// Loads a track's separated stems into the pipeline with a synchronous multitrack mixer (audiomixer).
    ///
    /// Each stem (vocals, drums, bass, other) has its own `volume` element,
    /// which allows smooth, silent balance changes, solo and instant vocal muting (karaoke mode).
    pub fn load_stems(
        &self,
        stems: &StemSeparationData,
        initial_state: StemMixerState,
        original_uri: Option<String>,
        seek_pos: Option<Duration>,
        start_playing: bool,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        let queue_sink_pad = Self::teardown_source(&mut inner)?;
        let audiomixer = Self::add_stem_mixer(&inner, &queue_sink_pad)?;

        let stem_list = [
            ("vocals", &stems.vocals_path),
            ("drums", &stems.drums_path),
            ("bass", &stems.bass_path),
            ("other", &stems.other_path),
        ];

        let mut stem_volumes = std::collections::HashMap::new();
        let mut stem_elements = Vec::new();

        for (name, path_str) in stem_list {
            let uri = crate::uri::media_uri(path_str);
            let gain = initial_state.get_effective_volume(name);
            let (volume, elements) = Self::add_stem_branch(&inner, &audiomixer, &uri, gain)?;
            stem_volumes.insert(name.to_string(), volume);
            stem_elements.extend(elements);
        }

        let _ = audiomixer.sync_state_with_parent();

        if let Some(orig) = original_uri {
            inner.original_track_uri = Some(orig);
        }
        inner.active_stem_project_id = None;
        inner.stem_mixer_elements = Some(StemMixerHandles {
            audiomixer,
            stem_volumes,
            stem_elements,
        });
        inner.stem_mixer_state = initial_state;
        inner.current_uri = Some(format!("stems://{}", stems.track_id));

        Self::start_stem_source(&mut inner, self.volume(), seek_pos, start_playing);

        info!("Loaded stems for track {}", stems.track_id);
        Ok(())
    }

    /// Updates the gain and mute state of each track in the stem mixer in real time.
    pub fn set_stem_mixer_state(&self, state: StemMixerState) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        inner.stem_mixer_state = state.clone();

        if let Some(ref handles) = inner.stem_mixer_elements {
            for (name, vol_el) in &handles.stem_volumes {
                let eff_vol = state.get_effective_volume(name);
                vol_el.set_property("volume", eff_vol);
            }
        }
        Ok(())
    }

    /// Returns the current stem mixer state.
    pub fn get_stem_mixer_state(&self) -> StemMixerState {
        let inner = self.inner.lock_safe();
        inner.stem_mixer_state.clone()
    }

    /// Loads the multitrack for a stem project (Moises-like stem project) with any number of channels.
    /// All channels are mixed sample-accurately by an `audiomixer`
    /// integrated with the main DSP chain (Rubber Band, SoundTouch, EQ, limiter).
    pub fn load_stem_project_channels(
        &self,
        project_id: i64,
        channels: &[StemChannel],
        master_volume: f32,
        original_uri: Option<String>,
        seek_pos: Option<Duration>,
        start_playing: bool,
    ) -> Result<(), AudioEngineError> {
        let mut inner = self.inner.lock_safe();
        let queue_sink_pad = Self::teardown_source(&mut inner)?;
        let audiomixer = Self::add_stem_mixer(&inner, &queue_sink_pad)?;

        let has_solo = channels.iter().any(|c| c.solo);
        let mut stem_volumes = std::collections::HashMap::new();
        let mut stem_elements = Vec::new();

        for ch in channels {
            let uri = crate::uri::media_uri(&ch.file_path);
            let gain = domain::effective_channel_gain(ch, has_solo, master_volume);
            let (volume, elements) = Self::add_stem_branch(&inner, &audiomixer, &uri, gain)?;
            stem_volumes.insert(ch.id.clone(), volume);
            stem_elements.extend(elements);
        }

        let _ = audiomixer.sync_state_with_parent();

        if let Some(orig) = original_uri {
            inner.original_track_uri = Some(orig);
        }
        inner.active_stem_project_id = Some(project_id);
        inner.stem_mixer_elements = Some(StemMixerHandles {
            audiomixer,
            stem_volumes,
            stem_elements,
        });
        inner.current_uri = Some(format!("stemproject://{}", project_id));

        Self::start_stem_source(&mut inner, self.volume(), seek_pos, start_playing);

        info!(
            "Loaded stem project {} ({} channels)",
            project_id,
            channels.len()
        );
        Ok(())
    }

    /// Updates the gains of every project channel in real time.
    pub fn apply_stem_project_mix(
        &self,
        channels: &[StemChannel],
        master_volume: f32,
    ) -> Result<(), AudioEngineError> {
        let inner = self.inner.lock_safe();
        let has_solo = channels.iter().any(|c| c.solo);

        if let Some(ref handles) = inner.stem_mixer_elements {
            for ch in channels {
                let gain = domain::effective_channel_gain(ch, has_solo, master_volume);

                if let Some(vol_el) = handles.stem_volumes.get(&ch.id) {
                    vol_el.set_property("volume", gain);
                }
            }
        }
        Ok(())
    }

    /// Restores playback of the original track (leaving the stem mixer / stem project),
    /// keeping the current playback position and state (Playing / Paused).
    pub fn restore_original_track(&self) -> Result<(), AudioEngineError> {
        let (orig_uri, pos, was_playing) = {
            let inner = self.inner.lock_safe();
            let pos = inner
                .pipeline
                .query_position::<gst::ClockTime>()
                .map(|t| Duration::from_nanos(t.nseconds()))
                .unwrap_or(inner.base_media_pos);
            let was_playing = inner.state == PlaybackState::Playing;
            let uri = inner.original_track_uri.clone().or_else(|| {
                self.queue
                    .lock_safe()
                    .current_item()
                    .map(|it| it.uri.clone())
            });
            (uri, pos, was_playing)
        };

        if let Some(uri) = orig_uri {
            info!(
                "Restoring the original track: {} (position: {:?}, was_playing: {})",
                uri, pos, was_playing
            );
            self.load_uri(&uri)?;
            if !pos.is_zero() {
                let _ = self.seek(pos);
            }
            if was_playing {
                let _ = self.play();
            }
            Ok(())
        } else {
            Err(AudioEngineError::FileNotFound(
                "No saved original track to restore".into(),
            ))
        }
    }

    /// Whether stems (audiomixer) are active in the audio pipeline.
    pub fn is_stems_active(&self) -> bool {
        let inner = self.inner.lock_safe();
        inner.stem_mixer_elements.is_some()
    }

    /// ID of the active stem project (if one is loaded).
    pub fn active_stem_project_id(&self) -> Option<i64> {
        let inner = self.inner.lock_safe();
        inner.active_stem_project_id
    }

    /// URI of the original track associated with the stems.
    pub fn original_track_uri(&self) -> Option<String> {
        let inner = self.inner.lock_safe();
        inner.original_track_uri.clone()
    }

    /// Returns the player's current loaded URI (global).
    pub fn current_uri(&self) -> Option<String> {
        let inner = self.inner.lock_safe();
        inner.current_uri.clone()
    }

    /// Stops the pipeline and removes the current source (decoder or stem mixer), leaving
    /// the `queue_in` input pad unlinked so a new source can be attached.
    ///
    /// `State::Null` fully resets EOS on the PipeWire audio sinks; the DSP reset drops
    /// pending samples to avoid clicks after a track change.
    fn teardown_source(inner: &mut PipelineInner) -> Result<gst::Pad, AudioEngineError> {
        let _ = inner.pipeline.set_state(gst::State::Null);
        inner.cached_duration = None;
        inner.base_media_pos = Duration::ZERO;
        inner.base_sink_pts = Duration::ZERO;
        inner.pending_seek = None;
        inner.dsp.reset();

        let queue_sink_pad = inner
            .queue_in
            .static_pad("sink")
            .ok_or_else(|| AudioEngineError::MissingElement("queue_in.sink"))?;
        if let Some(peer) = queue_sink_pad.peer() {
            let _ = peer.unlink(&queue_sink_pad);
        }

        if let Some(old_decoder) = inner.uri_decoder.take() {
            let _ = old_decoder.set_state(gst::State::Null);
            let _ = inner.pipeline.remove(&old_decoder);
        }
        if let Some(old_stems) = inner.stem_mixer_elements.take() {
            let _ = old_stems.audiomixer.set_state(gst::State::Null);
            for el in &old_stems.stem_elements {
                let _ = el.set_state(gst::State::Null);
                let _ = inner.pipeline.remove(el);
            }
            let _ = inner.pipeline.remove(&old_stems.audiomixer);
        }
        Ok(queue_sink_pad)
    }

    /// Adds an `audiomixer` linked to the `queue_in` input (the stem / project source).
    fn add_stem_mixer(
        inner: &PipelineInner,
        queue_sink_pad: &gst::Pad,
    ) -> Result<gst::Element, AudioEngineError> {
        let audiomixer = gst::ElementFactory::make("audiomixer")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audiomixer"))?;
        inner.pipeline.add(&audiomixer)?;
        audiomixer
            .static_pad("src")
            .ok_or(AudioEngineError::MissingElement("audiomixer.src"))?
            .link(queue_sink_pad)?;
        Ok(audiomixer)
    }

    /// Builds the branch of one stem: `uridecodebin → audioconvert → audioresample → volume → mixer`.
    /// Returns the `volume` element (for the mixer controls) and every element created.
    fn add_stem_branch(
        inner: &PipelineInner,
        audiomixer: &gst::Element,
        uri: &str,
        gain: f64,
    ) -> Result<(gst::Element, [gst::Element; 4]), AudioEngineError> {
        let make = |factory: &'static str| {
            gst::ElementFactory::make(factory)
                .build()
                .map_err(|_| AudioEngineError::MissingElement(factory))
        };
        let decoder = gst::ElementFactory::make("uridecodebin")
            .property("uri", uri)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("uridecodebin"))?;
        let audioconvert = make("audioconvert")?;
        let audioresample = make("audioresample")?;
        let volume = gst::ElementFactory::make("volume")
            .property("volume", gain)
            .build()
            .map_err(|_| AudioEngineError::MissingElement("volume"))?;

        inner
            .pipeline
            .add_many([&decoder, &audioconvert, &audioresample, &volume])?;
        gst::Element::link_many([&audioconvert, &audioresample, &volume])
            .map_err(|_| AudioEngineError::ElementLink("Failed to link the stem branch".into()))?;

        let mixer_sink_pad = audiomixer
            .request_pad_simple("sink_%u")
            .ok_or(AudioEngineError::MissingElement("audiomixer.sink_%u"))?;
        volume
            .static_pad("src")
            .ok_or(AudioEngineError::MissingElement("volume.src"))?
            .link(&mixer_sink_pad)?;

        let conv_sink_pad = audioconvert
            .static_pad("sink")
            .ok_or(AudioEngineError::MissingElement("audioconvert.sink"))?;
        decoder.connect_pad_added(move |_bin, src_pad| {
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            let is_audio = caps
                .structure(0)
                .is_some_and(|s| s.name().starts_with("audio/"));
            if is_audio && !conv_sink_pad.is_linked() {
                let _ = src_pad.link(&conv_sink_pad);
            }
        });

        for el in [&decoder, &audioconvert, &audioresample, &volume] {
            let _ = el.sync_state_with_parent();
        }
        Ok((
            volume.clone(),
            [decoder, audioconvert, audioresample, volume],
        ))
    }

    /// Shared tail of loading stems / a project: the base position after the switch
    /// (keeping the place in the track) and an optional start of playback with a seek.
    fn start_stem_source(
        inner: &mut PipelineInner,
        user_volume: f64,
        seek_pos: Option<Duration>,
        start_playing: bool,
    ) {
        inner.pending_seek = None;
        if let Some(pos) = seek_pos {
            inner.base_media_pos = pos;
            inner.base_sink_pts = pos;
        }
        if !start_playing {
            inner.state = PlaybackState::Stopped;
            return;
        }
        inner.state = PlaybackState::Playing;
        inner.volume.set_property("volume", user_volume);
        let _ = inner.pipeline.set_state(gst::State::Playing);
        if let Some(pos) = seek_pos {
            let _ = inner.pipeline.seek_simple(
                gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                gst::ClockTime::from_nseconds(pos.as_nanos() as u64),
            );
        }
    }
}
