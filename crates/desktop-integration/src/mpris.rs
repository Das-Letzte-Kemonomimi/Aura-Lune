//! Implementacja interfejsów D-Bus MPRIS 2.2 dla Auralune.

use audio_engine::AudioEngine;
use domain::PlaybackState;
use mpris_server::zbus::fdo;
use mpris_server::{
    LoopStatus, Metadata, PlaybackRate, PlaybackStatus, PlayerInterface, Property, RootInterface,
    Server, Signal, Time, TrackId, Volume,
};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{debug, info};

/// Kontekst i stan pojedynczego utworu dla D-Bus MPRIS.
#[derive(Debug, Clone, Default)]
pub struct MprisTrackInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub art_url: Option<String>,
}

/// Obiekt obsługujący wywołania RPC ze środowiska graficznego (KDE/GNOME/Waybar/playerctl).
#[derive(Clone)]
pub struct AuraluneMprisHandler {
    engine: Arc<AudioEngine>,
    current_track: Arc<Mutex<Option<MprisTrackInfo>>>,
}

impl AuraluneMprisHandler {
    pub fn new(engine: Arc<AudioEngine>) -> Self {
        Self {
            engine,
            current_track: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_track_info(&self, info: MprisTrackInfo) {
        let mut cur = self.current_track.lock().unwrap();
        *cur = Some(info);
    }
}

impl RootInterface for AuraluneMprisHandler {
    async fn raise(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Raise()");
        Ok(())
    }

    async fn quit(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Quit()");
        let _ = self.engine.stop();
        Ok(())
    }

    async fn can_quit(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn fullscreen(&self) -> fdo::Result<bool> {
        Ok(false)
    }

    async fn set_fullscreen(&self, _fullscreen: bool) -> mpris_server::zbus::Result<()> {
        Ok(())
    }

    async fn can_set_fullscreen(&self) -> fdo::Result<bool> {
        Ok(false)
    }

    async fn can_raise(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn has_track_list(&self) -> fdo::Result<bool> {
        Ok(false)
    }

    async fn identity(&self) -> fdo::Result<String> {
        Ok("Auralune".to_string())
    }

    async fn desktop_entry(&self) -> fdo::Result<String> {
        Ok("auralune-desktop".to_string())
    }

    async fn supported_uri_schemes(&self) -> fdo::Result<Vec<String>> {
        Ok(vec!["file".into(), "http".into(), "https".into()])
    }

    async fn supported_mime_types(&self) -> fdo::Result<Vec<String>> {
        Ok(vec![
            "audio/flac".into(),
            "audio/mpeg".into(),
            "audio/ogg".into(),
            "audio/opus".into(),
            "audio/x-wav".into(),
            "audio/aac".into(),
            "audio/mp4".into(),
        ])
    }
}

impl PlayerInterface for AuraluneMprisHandler {
    async fn next(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Next()");
        Ok(())
    }

    async fn previous(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Previous() - restart utworu");
        let _ = self.engine.seek(Duration::from_millis(0));
        Ok(())
    }

    async fn pause(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Pause()");
        let _ = self.engine.pause();
        Ok(())
    }

    async fn play_pause(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: PlayPause()");
        if self.engine.state() == PlaybackState::Playing {
            let _ = self.engine.pause();
        } else {
            let _ = self.engine.play();
        }
        Ok(())
    }

    async fn stop(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Stop()");
        let _ = self.engine.stop();
        Ok(())
    }

    async fn play(&self) -> fdo::Result<()> {
        info!("MPRIS D-Bus: Play()");
        let _ = self.engine.play();
        Ok(())
    }

    async fn seek(&self, offset: Time) -> fdo::Result<()> {
        let offset_ms = offset.as_millis();
        info!("MPRIS D-Bus: Seek({} ms)", offset_ms);
        let cur = self
            .engine
            .position()
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let target = (cur + offset_ms).max(0) as u64;
        let _ = self.engine.seek(Duration::from_millis(target));
        Ok(())
    }

    async fn set_position(&self, _track_id: TrackId, position: Time) -> fdo::Result<()> {
        let pos_ms = position.as_millis().max(0) as u64;
        info!("MPRIS D-Bus: SetPosition({} ms)", pos_ms);
        let _ = self.engine.seek(Duration::from_millis(pos_ms));
        Ok(())
    }

    async fn open_uri(&self, uri: String) -> fdo::Result<()> {
        info!("MPRIS D-Bus: OpenUri({})", uri);
        let _ = self.engine.load_uri(&uri);
        let _ = self.engine.play();
        Ok(())
    }

    async fn playback_status(&self) -> fdo::Result<PlaybackStatus> {
        let s = match self.engine.state() {
            PlaybackState::Playing => PlaybackStatus::Playing,
            PlaybackState::Paused => PlaybackStatus::Paused,
            PlaybackState::Stopped => PlaybackStatus::Stopped,
        };
        Ok(s)
    }

    async fn loop_status(&self) -> fdo::Result<LoopStatus> {
        Ok(LoopStatus::None)
    }

    async fn set_loop_status(&self, _loop_status: LoopStatus) -> mpris_server::zbus::Result<()> {
        Ok(())
    }

    async fn rate(&self) -> fdo::Result<PlaybackRate> {
        Ok(self.engine.dsp_params().rate_ratio)
    }

    async fn set_rate(&self, rate: PlaybackRate) -> mpris_server::zbus::Result<()> {
        let _ = self.engine.set_rate_ratio(rate);
        Ok(())
    }

    async fn shuffle(&self) -> fdo::Result<bool> {
        Ok(false)
    }

    async fn set_shuffle(&self, _shuffle: bool) -> mpris_server::zbus::Result<()> {
        Ok(())
    }

    async fn metadata(&self) -> fdo::Result<Metadata> {
        let cur = self.current_track.lock().unwrap();
        if let Some(track) = cur.as_ref() {
            let mut builder = Metadata::builder()
                .title(&track.title)
                .artist([&track.artist])
                .album(&track.album)
                .length(Time::from_millis(track.duration_ms as i64));

            if let Some(art) = &track.art_url {
                builder = builder.art_url(art);
            }
            Ok(builder.build())
        } else {
            let dur_ms = self
                .engine
                .duration()
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            let meta = Metadata::builder()
                .title("Auralune Player")
                .artist(["Kitsune"])
                .length(Time::from_millis(dur_ms))
                .build();
            Ok(meta)
        }
    }

    async fn volume(&self) -> fdo::Result<Volume> {
        Ok(self.engine.volume())
    }

    async fn set_volume(&self, volume: Volume) -> mpris_server::zbus::Result<()> {
        let _ = self.engine.set_volume(volume);
        Ok(())
    }

    async fn position(&self) -> fdo::Result<Time> {
        let pos_ms = self
            .engine
            .position()
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        Ok(Time::from_millis(pos_ms))
    }

    async fn minimum_rate(&self) -> fdo::Result<PlaybackRate> {
        Ok(0.25)
    }

    async fn maximum_rate(&self) -> fdo::Result<PlaybackRate> {
        Ok(4.0)
    }

    async fn can_go_next(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn can_go_previous(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn can_play(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn can_pause(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn can_seek(&self) -> fdo::Result<bool> {
        Ok(true)
    }

    async fn can_control(&self) -> fdo::Result<bool> {
        Ok(true)
    }
}

/// Kontroler D-Bus MPRIS zarządzający serwerem i wysyłaniem sygnałów PropertiesChanged.
pub struct MprisController {
    server: Server<AuraluneMprisHandler>,
    handler: AuraluneMprisHandler,
}

impl MprisController {
    /// Inicjalizuje i rejestruje odtwarzacz w sesyjnej magistrali D-Bus jako org.mpris.MediaPlayer2.auralune.
    pub async fn start(engine: Arc<AudioEngine>) -> Result<Self, mpris_server::zbus::Error> {
        let handler = AuraluneMprisHandler::new(engine);
        let server = Server::new("auralune", handler.clone()).await?;

        info!("Zarejestrowano serwis MPRIS D-Bus: org.mpris.MediaPlayer2.auralune");
        Ok(Self { server, handler })
    }

    /// Aktualizuje metadane odtwarzanego utworu i emituje sygnał PropertiesChanged na magistrali D-Bus.
    pub async fn update_track(&self, info: MprisTrackInfo) {
        let mut builder = Metadata::builder()
            .title(&info.title)
            .artist([&info.artist])
            .album(&info.album)
            .length(Time::from_millis(info.duration_ms as i64));

        if let Some(art) = &info.art_url {
            builder = builder.art_url(art);
        }

        let metadata = builder.build();
        self.handler.set_track_info(info);

        if let Err(e) = self
            .server
            .properties_changed([Property::Metadata(metadata)])
            .await
        {
            debug!("Błąd wysyłania PropertiesChanged(Metadata): {}", e);
        }
    }

    /// Aktualizuje status odtwarzania na magistrali D-Bus.
    pub async fn update_playback_status(&self, state: PlaybackState) {
        let mpris_status = match state {
            PlaybackState::Playing => PlaybackStatus::Playing,
            PlaybackState::Paused => PlaybackStatus::Paused,
            PlaybackState::Stopped => PlaybackStatus::Stopped,
        };

        if let Err(e) = self
            .server
            .properties_changed([Property::PlaybackStatus(mpris_status)])
            .await
        {
            debug!("Błąd wysyłania PropertiesChanged(PlaybackStatus): {}", e);
        }
    }

    /// Informuje środowisko graficzne o wykonaniu skoku (Seeked signal).
    pub async fn emit_seeked(&self, position_ms: u64) {
        let time = Time::from_millis(position_ms as i64);
        if let Err(e) = self.server.emit(Signal::Seeked { position: time }).await {
            debug!("Błąd wysyłania sygnału Seeked: {}", e);
        }
    }

    /// Aktualizuje głośność na magistrali D-Bus.
    pub async fn update_volume(&self, volume: f64) {
        if let Err(e) = self
            .server
            .properties_changed([Property::Volume(volume)])
            .await
        {
            debug!("Błąd wysyłania PropertiesChanged(Volume): {}", e);
        }
    }
}
