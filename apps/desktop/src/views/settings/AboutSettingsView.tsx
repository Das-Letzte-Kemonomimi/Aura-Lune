import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity,
  History,
  Music,
  HeartHandshake,
  ExternalLink,
  Keyboard,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';

export interface AboutSettingsViewProps {
  appIconStyle: 'lineout' | 'classic';
  language: Language;
  loc: Translations;
  onOpenHealthCheck: () => void;
  onOpenChangelog: () => void;
  onOpenOnboarding: () => void;
}

export const AboutSettingsView: React.FC<AboutSettingsViewProps> = ({
  appIconStyle,
  language,
  loc,
  onOpenHealthCheck,
  onOpenChangelog,
  onOpenOnboarding,
}) => {
  const currentLang = language;

  const handleOpenExternalUrl = async (url: string) => {
    try {
      await invoke('open_external_url', { url });
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '750px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <img
          src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
          alt="Auralune Logo"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            objectFit: 'contain',
            background: 'rgba(0, 0, 0, 0.3)',
            boxShadow: appIconStyle === 'classic' ? '0 0 24px rgba(168, 85, 247, 0.55)' : '0 0 24px rgba(236, 72, 153, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: appIconStyle === 'classic' ? '0' : '4px',
          }}
        />
        <div>
          <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Auralune</span>
            <span style={{ color: 'var(--accent-pink)', fontSize: '1.15rem' }}>狐 Kitsune</span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))', color: '#fff', fontWeight: 800 }}>v1.0.0 Golden Master</span>
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--accent-pink)', fontSize: '0.88rem', fontWeight: 700 }}>
            {loc.settings.version} 1.0.0 „Kitsune Golden Master” • {loc.settings.author}: Das Letzte Kemonomimi
          </p>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            Linux High-Fidelity DSP & PipeWire Audio Engine • Extensible foobar2000-like flexibility, anime aesthetics & real-time pitch/tempo modulation.
          </p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', fontWeight: 600 }}>
              Oficjalne Wydanie Stabilne 1.0.0
            </span>
            <button
              onClick={onOpenHealthCheck}
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                borderRadius: '6px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                color: '#4ade80',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <Activity size={13} />
              Test Środowiska Audio (Health Check)
            </button>
            <button
              onClick={onOpenChangelog}
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <History size={13} />
              {loc.settings.changelog}
            </button>
          </div>
        </div>
      </div>

      {/* Sekcja Twórczyni: Bandcamp & Aplikacja Sorta dla AuDHD / ADHD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
        {/* Karta Bandcamp: Muzyka Autorki */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(244, 63, 94, 0.08) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            boxShadow: '0 4px 20px rgba(168, 85, 247, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Music size={18} color="var(--accent-purple)" />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>
                  {currentLang === 'pl' ? 'Muzyka Autorki na Bandcampie' : 'Original Music on Bandcamp'}
                </h4>
              </div>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.25)', color: 'var(--accent-purple)', fontWeight: 700 }}>
                Bandcamp
              </span>
            </div>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.6 }}>
              {currentLang === 'pl'
                ? 'Posłuchaj autorskich kompozycji twórczyni Auralune (Das Letzte Kemonomimi), w tym utworu testowego „Skrzydła Białe”. Sprawdź wydania i wesprzyj twórczość bezpośrednio na profilu Bandcamp!'
                : 'Listen to original releases by Auralune’s creator (Das Letzte Kemonomimi), including our sample track "Skrzydła Białe". Support music production directly on Bandcamp!'}
            </p>
          </div>
          <button
            onClick={() => handleOpenExternalUrl('https://dasletztekemonomimi.bandcamp.com/track/skrzyd-a-bia-e')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
            }}
          >
            <ExternalLink size={14} />
            {currentLang === 'pl' ? 'Odwiedź Bandcamp (Skrzydła Białe)' : 'Listen on Bandcamp (Skrzydła Białe)'}
          </button>
        </div>

        {/* Karta Sorta: Aplikacja dla AuDHD / ADHD */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            boxShadow: '0 4px 20px rgba(6, 182, 212, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HeartHandshake size={18} color="var(--accent-cyan)" />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>
                  Sorta • AuDHD & ADHD Focus
                </h4>
              </div>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.25)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                AuDHD
              </span>
            </div>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.6 }}>
              {currentLang === 'pl'
                ? 'Sama żyję z AuDHD i wiem, jak ciężki potrafi być paraliż zadaniowy i chaos w głowie. Stworzyłam Sorta z myślą o neuroatypowych umysłach — rozbija zadania na mikrokroki, redukuje przytłoczenie i wspiera z empatią. Wypróbuj ją i zobacz, czy Ci pomoże!'
                : 'As someone living with AuDHD, I know how heavy executive dysfunction and task paralysis can be. I created Sorta specifically for neurodivergent minds — breaking chaos into gentle micro-steps without overwhelm. Try it out or share with someone who might benefit!'}
            </p>
          </div>
          <button
            onClick={() => handleOpenExternalUrl('https://sortaofficial.lovable.app/')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
            }}
          >
            <ExternalLink size={14} />
            {currentLang === 'pl' ? 'Wypróbuj Sorta (Web App dla AuDHD)' : 'Try Sorta (AuDHD Web App)'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutAudioEngine}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            GStreamer + PipeWire Pro Audio
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutAudioEngineDesc}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutDsp}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
            SoundTouch & Rubber Band
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutDspDesc}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutLibrary}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-purple)' }}>
            SQLite (sqlx) + Cover Art Archive
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutLibraryDesc}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            {loc.settings.aboutLicense}
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-green)' }}>
            GPL-3.0-or-later
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {loc.settings.aboutLicenseDesc}
          </p>
        </div>
      </div>

      {/* Karta Skrótów Klawiszowych */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
          <Keyboard size={18} color="var(--accent-pink)" /> {loc.shortcuts.title}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
          {[
            { key: 'Space', desc: loc.shortcuts.playPause },
            { key: '← / →', desc: loc.shortcuts.seekFwdBack },
            { key: 'Ctrl + ← / →', desc: `${loc.shortcuts.prevTrack} / ${loc.shortcuts.nextTrack}` },
            { key: '↑ / ↓', desc: loc.shortcuts.volUpDown },
            { key: 'M', desc: loc.shortcuts.muteUnmute },
            { key: 'N / P', desc: `${loc.shortcuts.nextTrack} / ${loc.shortcuts.prevTrack}` },
            { key: 'Q', desc: loc.nav.queue },
            { key: 'F / Ctrl+F', desc: loc.library.searchPlaceholder },
            { key: '1, 2, 3, 4', desc: `${loc.nav.nowPlaying}, ${loc.nav.library}, ${loc.nav.playlists}, ${loc.nav.dsp}` },
            { key: 'Esc', desc: loc.common.close },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
              <kbd
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  color: 'var(--accent-pink)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Karta Zastrzeżenia / Brak Gwarancji */}
      <div
        style={{
          padding: '18px 22px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(234,88,12,0.06) 100%)',
          border: '1px solid rgba(245,158,11,0.30)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.08)',
        }}
      >
        <h4 style={{
          margin: '0 0 10px 0',
          fontSize: '0.95rem',
          fontWeight: 800,
          color: '#fbbf24',
          letterSpacing: '0.01em',
        }}>
          {loc.settings.disclaimerTitle}
        </h4>
        <p style={{
          margin: 0,
          fontSize: '0.78rem',
          color: 'rgba(251,191,36,0.85)',
          lineHeight: 1.7,
        }}>
          {loc.settings.disclaimerBody}
        </p>
      </div>

      {/* Karta Ponownego uruchomienia kreatora powitalnego */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
            {currentLang === 'pl' ? 'Kreator konfiguracji początkowej' : 'Initial Setup Wizard'}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {currentLang === 'pl' ? 'Pozwala ponownie przejść wprowadzenie i przewodnik po odtwarzaczu' : 'Relaunch the welcome guide and onboarding tour'}
          </div>
        </div>
        <button
          onClick={onOpenOnboarding}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
          }}
        >
          {currentLang === 'pl' ? '🚀 Uruchom Onboarding' : '🚀 Relaunch Onboarding'}
        </button>
      </div>
    </div>
  );
};
