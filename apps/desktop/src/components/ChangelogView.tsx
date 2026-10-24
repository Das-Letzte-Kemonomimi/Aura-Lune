import React from 'react';
import { Sparkles, Wrench, Tag, User, Calendar } from 'lucide-react';
import type { Language } from '../i18n';

interface ChangelogViewProps {
  currentLang?: Language;
}

interface ChangelogRelease {
  version: string;
  codename: string;
  date: string;
  author: string;
  isLatest?: boolean;
  added: { pl: string; en: string; de: string; fi: string; la: string }[];
  fixed: { pl: string; en: string; de: string; fi: string; la: string }[];
}

const RELEASES: ChangelogRelease[] = [
  {
    version: '0.2.1',
    codename: 'Harmony & Precision',
    date: '2026-10-24',
    author: 'Das Letzte Kemonomimi',
    isLatest: true,
    added: [
      {
        pl: 'Wykrywanie tonacji muzycznej i tempa BPM: analiza Krumhansl-Schmuckler (Major/Minor), autokorelacja spektralna BPM, okno KeyBpmModal z kołem Camelot.',
        en: 'Musical Key & BPM Detection: Krumhansl-Schmuckler harmonic analysis, spectral flux BPM autocorrelation, and Camelot wheel recommendations in KeyBpmModal.',
        de: 'Musikalische Tonart- & BPM-Erkennung: Krumhansl-Schmuckler-Analyse, spektrale Autokorrelation und Camelot-Wheel-Empfehlungen.',
        fi: 'Musiikin sävellajin ja BPM-tempon tunnistus: Krumhansl-Schmuckler-analyysi, spektrinen autokorrelaatio ja Camelot-pyörä KeyBpmModalissa.',
        la: 'Detectio toni musici et BPM: Krumhansl-Schmuckler harmonicus, autocoordinatio BPM et rota Camelot in KeyBpmModal.',
      },
      {
        pl: 'Wyszukiwanie okładek online HD z Deezer API i Apple Music / iTunes Search API z automatycznym oczyszczaniem tagów wydań.',
        en: 'Online HD cover art search via Deezer API and Apple Music / iTunes Search API with smart release tag cleaning.',
        de: 'Online-HD-Cover-Suche über Deezer API und Apple Music / iTunes mit intelligenter Tag-Bereinigung.',
        fi: 'Verkon HD-kansikuvahaku Deezer API:n ja Apple Music / iTunes -haun kautta älykkäällä nimenpuhdistuksella.',
        la: 'Investigatio tegumentorum HD per Deezer API et Apple Music / iTunes cum purgatione titulorum.',
      },
      {
        pl: 'Otwieranie folderu z plikiem utworu w menedżerze plików (Dolphin / Nautilus) bezpośrednio z menu utworu.',
        en: 'Open containing folder in native file manager (Dolphin / Nautilus) directly from track context menu.',
        de: 'Enthaltenden Ordner im nativen Dateimanager (Dolphin / Nautilus) direkt aus dem Track-Menü öffnen.',
        fi: 'Avaa kappaleen kansio tiedostonhallinnassa (Dolphin / Nautilus) suoraan kappalevalikosta.',
        la: 'Aperitio capsulae carminis in directore fasciculorum (Dolphin / Nautilus) ex indice carminis.',
      },
      {
        pl: 'Precyzyjna regulacja parametrów DSP co ±0.1 oraz ręczne wpisywanie wartości z klawiatury w polach liczbowych.',
        en: 'Fine DSP stepping (±0.1) and manual direct numeric keyboard input for Pitch, Tempo, and Playback Speed.',
        de: 'DSP-Feinabstimmung (±0.1) und direkte manuelle Tastatureingabe für Tonhöhe, Tempo und Geschwindigkeit.',
        fi: 'DSP:n hienosäätö (±0.1) ja manuaalinen numeroiden syöttö näppäimistöltä sävelkorkeudelle, tempolle ja nopeudelle.',
        la: 'Modulatio subtilis DSP (±0.1) et scriptio manualis numerorum pro tono, tempore et celeritate.',
      },
      {
        pl: 'Pogłos studyjny Freeverb (Reverb) z kontrolkami wielkości pomieszczenia, tłumienia i nasycenia w DSP Studio.',
        en: 'Freeverb studio reverb engine with room size, damping, stereo width, and wet level controls in DSP Studio.',
        de: 'Freeverb-Studio-Hall mit Raumgröße-, Dämpfungs- und Raumbreite-Reglern im DSP Studio.',
        fi: 'Freeverb-studiokaiku huoneen koon, vaimennuksen ja tason säätimillä DSP Studiossa.',
        la: 'Reverberatio Freeverb cum moderatione spatii, absorptionis et gradus soni in DSP Studio.',
      },
    ],
    fixed: [
      {
        pl: 'Eliminacja zawieszenia aplikacji przy uruchamianiu utworu z biblioteki: usunięcie zakleszczenia prerollu GStreamera, natychmiastowe drenowanie próbek DSP oraz powiększony bufor zlewu.',
        en: 'Eliminated app freeze when starting tracks from library: fixed GStreamer preroll deadlock, instant DSP buffer draining, and enlarged sink queue.',
        de: 'Beseitigung des App-Einfrierens beim Starten von Tracks aus der Bibliothek: GStreamer-Preroll-Deadlock behoben und sofortige DSP-Pufferentleerung.',
        fi: 'Sovelluksen jäätymisen poisto käynnistettäessä kappaleita kirjastosta: korjattu GStreamer-preroll-lukkiutuminen ja välitön DSP-puskurin tyhjennys.',
        la: 'Eliminatio congelationis applicationis in initio carminis e bibliotheca: extinctus deadlock preroll GStreamer et evacuatio instantanea receptaculi DSP.',
      },
      {
        pl: 'Synchronizacja osi czasu ze spowolnionym DSP: kalkulacja pozycji w utworze źródłowym oraz brak skoków przy zmianie tempa w locie.',
        en: 'Timeline position synchronization with DSP speed scaling: accurate media track position and seamless dynamic tempo adjustments without jumps.',
        de: 'Zeitleistensynchronisation bei verändertem DSP-Tempo: exakte Position und nahtlose Tempoanpassung ohne Sprünge.',
        fi: 'Aika-akselin synkronointi muunnetun DSP-tempon kanssa: tarkka sijainti ja saumaton tempon säätö lennossa ilman hyppyjä.',
        la: 'Syncronizatio subtilis lineae temporis cum celeritate DSP: locus verus carminis et mutatio lenis sine saltu.',
      },
      {
        pl: 'Eliminacja przerywania dźwięku i głodzenia bufora: płynne opróżnianie FIFO, optymalizacja silnika Rubber Band R2 oraz natychmiastowa reakcja suwaków DSP (<150ms).',
        en: 'Eliminated audio stuttering and buffer underruns: smooth FIFO draining, Rubber Band R2 engine optimization, and instant DSP slider response (<150ms).',
        de: 'Audioaussetzer und Pufferleerlauf behoben: reibungsloses FIFO-Draining, Rubber Band R2 Optimierung und sofortige DSP-Reaktion (<150ms).',
        fi: 'Äänen pätkimisen ja puskurin nääntymisen poisto: tasainen FIFO-tyhjennys, Rubber Band R2 -optimointi ja välitön liukusäätimien vaste (<150ms).',
        la: 'Intermissio soni et inopia receptaculi deleta: evacuatio aequalis FIFO, optimatio Rubber Band R2 et responsio instantanea moderatorum (<150ms).',
      },
      {
        pl: 'Eliminacja zacinania przy odtwarzaniu FLAC: powiększenie bufora queue_sink do 800ms oraz przetwarzanie bloków w oknach 1024 ramek (max_process_size=8192).',
        en: 'Eliminated stuttering during FLAC playback: increased queue_sink capacity to 800ms and 1024-frame chunking in Rubber Band (max_process_size=8192).',
        de: 'Beseitigung von FLAC-Rucklern: vergrößerter queue_sink (800ms) und 1024-Frame-Chunking in Rubber Band (max_process_size=8192).',
        fi: 'FLAC-toiston pätkimisen poisto: suurempi queue_sink (800ms) ja 1024-kehyksen käsittely Rubber Bandissa (max_process_size=8192).',
        la: 'Eliminatio interruptionis in FLAC: capacitas aucta queue_sink (800ms) et segmentatio 1024 framium in Rubber Band.',
      },
      {
        pl: 'Eliminacja efektu flangera i poszarpanego dźwięku przy przełączaniu na Bypass: bit-perfect passthrough bez modyfikacji PTS oraz automatyczny seek/flush kolejki.',
        en: 'Eliminated flanger comb-filtering and ragged audio on switching to Bypass: bit-perfect passthrough without PTS tampering and automatic seek/flush.',
        de: 'Beseitigung des Flanger- und Zerr-Effekts beim Umschalten auf Bypass: bit-perfekter Passthrough und automatischer Seek/Flush.',
        fi: 'Flanger- ja säröhäiriöiden poisto vaihdettaessa Bypass-tilaan: bittitarkka läpivienti ja automaattinen seek/flush.',
        la: 'Eliminatio effectus flanger et soni lacerati in transitione ad Bypass: emissio perfecta bit-per-bit sine corruptione PTS et purgatio meatus per seek.',
      },
    ],
  },
  {
    version: '0.2.0',
    codename: 'Kitsune',
    date: '2026-10-18',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Wbudowana przeglądarka dziennika zmian (In-App Changelog) w Ustawieniach i sekcji O programie.',
        en: 'In-app Changelog Viewer integrated into Settings and the About section.',
        de: 'Integriertes Änderungsprotokoll in den Einstellungen und im Über-Bereich.',
        fi: 'Sisäänrakennettu muutoslokin katseluohjelma Asetuksissa ja Tietoja-osiossa.',
        la: 'Actorum diarium directum in Optionibus et sectione De Auralune.',
      },
      {
        pl: 'Wybór z 5 języków interfejsu (i18n): Angielski, Polski, Niemiecki, Fiński oraz Łacina z natychmiastowym przełączaniem.',
        en: 'Choice of 5 UI languages (i18n): English, Polish, German, Finnish, and Latin with instant switching.',
        de: 'Auswahl aus 5 UI-Sprachen (i18n): Englisch, Polnisch, Deutsch, Finnisch und Latein mit sofortigem Wechsel.',
        fi: 'Valinta 5 käyttöliittymäkielestä (i18n): englanti, puola, saksa, suomi ja latina välittömällä vaihdolla.',
        la: 'Optio e 5 linguis (i18n): Anglica, Polonica, Theodisca, Finnica et Latina cum commutatione instantanea.',
      },
      {
        pl: 'Wyszukiwanie i dopasowywanie okładek online HD z sieci i Cover Art Archive.',
        en: 'Online HD cover art search and matcher powered by Web and Cover Art Archive.',
        de: 'Online-HD-Cover-Suche und -Abstimmung über Web und Cover Art Archive.',
        fi: 'Verkon HD-kansikuvahaku ja sovitus verkosta ja Cover Art Archivesta.',
        la: 'Investigatio et adaptatio tegumentorum HD ex interrete et Cover Art Archive.',
      },
      {
        pl: 'Pełne narzędzia synchronizacji tekstów piosenek (Lyrics Sync Tools): Offset (±100ms, ±500ms), Tap-to-Sync, Auto-Sync oraz zapis do plików .lrc.',
        en: 'Full Lyrics Sync Tools in LyricsView: Offset compensation (±100ms, ±500ms), Tap-to-Sync, Auto-Sync, and .lrc file export.',
        de: 'Umfassende Songtext-Synchronisationstools: Offset (±100ms, ±500ms), Tap-to-Sync, Auto-Sync und .lrc-Export.',
        fi: 'Kattavat sanoitusten synkronointityökalut: Siirtymä (±100ms, ±500ms), Tap-to-Sync, Auto-Sync ja .lrc-tallennus.',
        la: 'Instrumenta syncronizationis lyricorum: Compensatio temporis, Tap-to-Sync, Auto-Sync et scriptio .lrc.',
      },
      {
        pl: 'Bezpieczne wyłączanie trybu Pro Audio i bezpośredni selektor profili kart dźwiękowych PipeWire/WirePlumber.',
        en: 'Safe Pro Audio bypass and direct PipeWire/WirePlumber hardware card profile selector.',
        de: 'Sichere Pro-Audio-Deaktivierung und direkte Profilauswahl für PipeWire/WirePlumber-Soundkarten.',
        fi: 'Pro Audio -tilan turvallinen poiskytkentä ja suora PipeWire/WirePlumber-äänikorttiprofiilien valitsin.',
        la: 'Tuta deactivatio Pro Audio et selector directus profiliorum chartarum PipeWire/WirePlumber.',
      },
      {
        pl: 'Trwała preferencja automatycznego startu korektora graficznego (EQ) oraz domyślny stan Bypass 0 dB.',
        en: 'Persistent EQ startup preference in SQLite and safe default Bypass state at 0 dB.',
        de: 'Dauerhafte EQ-Starteinstellung in SQLite und standardmäßiger Bypass-Modus bei 0 dB.',
        fi: 'Pysyvä taajuuskorjaimen käynnistysasetus ja oletuksena Bypass-tila 0 dB.',
        la: 'Praeferentia perpetua aequatoris (EQ) in SQLite et status defectus Bypass 0 dB.',
      },
      {
        pl: 'Widescreen UI: automatyczne skalowanie szerokości kontenerów do min(1500px, 95vw) dla monitorów panoramicznych.',
        en: 'Widescreen layout: automatic responsive container scaling up to min(1500px, 95vw) for ultrawide monitors.',
        de: 'Breitbild-Layout: automatische Skalierung bis min(1500px, 95vw) für Ultrawide-Monitore.',
        fi: 'Laajakuva-asettelu: automaattinen skaalaus jopa min(1500px, 95vw) ultrawide-näytöille.',
        la: 'Dispositio lata: scalatio automatica vasorum usque ad min(1500px, 95vw) pro monitoribus latissimis.',
      },
      {
        pl: 'Wyłącznik czasowy (Sleep Timer): presety (15-90 min), tryb zatrzymania po bieżącym utworze, 30-sekundowy łagodny Fade-Out głośności oraz wskaźnik odliczania na żywo w nagłówku.',
        en: 'Sleep Timer: presets (15-90m), end-of-track mode, gentle 30s volume fade-out before pausing, and live countdown pill in the header.',
        de: 'Schlaftimer: Voreinstellungen (15-90 Min.), Stopp am Track-Ende, sanftes 30-Sekunden-Fade-Out und Live-Countdown in der Kopfzeile.',
        fi: 'Uniajastin: esiasetukset (15-90 min), kappaleen lopetus, 30 sekunnin pehmeä häivytys ja reaaliaikainen laskuri yläpalkissa.',
        la: 'Temporizator somni: praedefinitiones (15-90m), modus finis cantus, deminutio lenis voluminis 30s et computus temporis.',
      },
      {
        pl: 'Szybkie profile klimatyczne DSP (Quick Vibes): 1-kliknięciowe profile Nightcore (+25% playback speed), Slowed & Lo-Fi, Anime Vocal Boost, Bass Impact i Audiophile Reset.',
        en: 'Quick DSP Vibes: 1-click profiles for Nightcore (+25% playback speed), Slowed & Lo-Fi, Anime Vocal Boost, Bass Impact, and Audiophile Reset.',
        de: 'DSP Quick Vibes: 1-Klick-Profile für Nightcore (+25% Playback-Speed), Slowed & Lo-Fi, Anime Vocal Boost, Bass Impact und Reset.',
        fi: 'DSP Quick Vibes: yhden napsautuksen profiilit Nightcorelle (+25% toistonopeus), Slowed & Lo-Fi:lle, Anime Vocal Boostille ja Bass Impactille.',
        la: 'Modi DSP celeres: configurationes 1-tactu pro Nightcore (+25% celeritas canendi), Slowed & Lo-Fi, Anime Vocal Boost et Bass Impact.',
      },
      {
        pl: 'Kolisty wizualizator Halo 360° (Circular Radial Rays) w Now Playing oraz dynamiczna poświata okładki reagująca na spektrum częstotliwości basowych.',
        en: '360° Circular Halo Visualizer in Now Playing and dynamic audio-reactive cover glow reacting to bass frequencies.',
        de: '360° Circular-Halo-Visualisierer in Now Playing und reaktiver Cover-Leuchteffekt nach Bass-Frequenzen.',
        fi: '360° Circular Halo -visualisoija Now Playingissä ja bassotaajuuksiin reagoiva kansikuvan dynaaminen hohde.',
        la: 'Visualizator circularis Halo 360° in Now Playing et aura reactiva tegumenti secundum frequentias bassi.',
      },
      {
        pl: 'Widok Wykonawców (Artists View) w Bibliotece: grupowanie utworów wg artystów z liczbą albumów, utworów, łącznymi odtworzeniami i odtwarzaniem 1-kliknięciem.',
        en: 'Artists View in Library: grouping tracks by artist with album/track count, total play counts, and 1-click play all.',
        de: 'Künstler-Ansicht in der Bibliothek: Gruppierung nach Künstlern mit Album-/Track-Anzahl, Gesamtwiedergaben und 1-Klick-Wiedergabe.',
        fi: 'Artistinäkymä kirjastossa: kappaleiden ryhmittely artistin mukaan albumi- ja toistomäärillä sekä pika-toistolla.',
        la: 'Visus artificum in bibliotheca: dispositio carminum per artifices cum numero albumorum et lusionum.',
      },
      {
        pl: 'Centrum Statystyk & Podsumowanie Słuchania („Auralune Recap”): nowa dedykowana zakładka z medalami Top 5 utworów i artystów, łącznym czasem słuchania i rozkładem formatów (FLAC, MP3, Hi-Res).',
        en: 'Listening Stats & Recap Dashboard: dedicated tab featuring Top 5 medal tracks and artists, total listening time, format breakdown (FLAC, MP3, Hi-Res), and recent history.',
        de: 'Statistik- & Recap-Dashboard: dedizierter Bereich mit Top-5-Medaillen für Titel und Künstler, Gesamthördauer und Formatverteilung.',
        fi: 'Tilastokeskus ja Auralune Recap: erillinen välilehti Top 5 -mitaleilla kappaleille ja artisteille, kokonaiskuunteluajalla ja tiedostomuotojakaumalla.',
        la: 'Tabula statistica et Auralune Recap: sectio dedicata cum numismatibus Top 5 cantuum, tempore totali et proportione formatuum.',
      },
      {
        pl: 'Natywny dialog wyboru plików (Dolphin / zenity) oraz obsługa Drag & Drop dla tapet tła oraz eksportu do Opus bez ręcznego wpisywania ścieżek.',
        en: 'Native system file dialogs (Dolphin / zenity) and Drag & Drop for custom wallpapers and Opus transcode exports.',
        de: 'Nativer Dateidialog (Dolphin / zenity) und Drag & Drop für Hintergrundbilder und Opus-Transkodierung ohne manuelle Pfadeingabe.',
        fi: 'Natiivit tiedostovalitsimet (Dolphin / zenity) ja Drag & Drop taustakuville ja Opus-viennille ilman polun kirjoittamista.',
        la: 'Dialogi nativi systematis (Dolphin / zenity) et Drag & Drop pro picturis et exportatione Opus sine scriptione tramitis.',
      },
      {
        pl: 'Oficjalna ikona aplikacji Auralune zintegrowana w pakiecie Tauri dla paska zadań i środowiska graficznego Linuksa.',
        en: 'Official Auralune application icon integrated across Tauri, desktop environment, and taskbar.',
        de: 'Offizielles Auralune-App-Icon integriert in Tauri, Desktop-Umgebung und Taskleiste.',
        fi: 'Virallinen Auralune-sovelluskuvake integroitu Taurille, työpöytäympäristölle ja tehtäväpalkille.',
        la: 'Icon officialis Auralune in fasciculo Tauri pro fenestris et tabula systematis Linux.',
      },
      {
        pl: 'Aktywne podświetlenie wybranego profilu klimatycznego Quick DSP Vibes (Nightcore, Slowed, Vocal, Bass, Flat) z neonową poświatą.',
        en: 'Active visual highlighting and neon glow indicator for selected Quick DSP Vibes (Nightcore, Slowed, Vocal, Bass, Flat).',
        de: 'Visuelle Hervorhebung und Neon-Leuchteffekt für ausgewählte DSP Quick Vibes (Nightcore, Slowed, Vocal, Bass, Flat).',
        fi: 'Visuaalinen korostus ja neonhohde valitulle DSP Quick Vibes -profiilille (Nightcore, Slowed, Vocal, Bass, Flat).',
        la: 'Illustratio visualis et aura neonica pro modo DSP Quick Vibes selecto (Nightcore, Slowed, Vocal, Bass, Flat).',
      },
      {
        pl: 'Zapamiętywanie i przywracanie ustawień DSP przy starcie programu (opcja w DSP Studio i Ustawieniach oraz przycisk „Zapisz jako startowe”).',
        en: 'Persistent DSP settings on application launch with auto-restore toggle in DSP Studio and Settings, plus "Save as startup" button.',
        de: 'Dauerhafte DSP-Einstellungen beim Anwendungsstart mit Umschalter im DSP Studio und in den Einstellungen sowie "Als Startwert speichern"-Schaltfläche.',
        fi: 'Pysyvät DSP-asetukset sovelluksen käynnistyksessä automaattipalautuskytkimellä DSP Studiossa ja Asetuksissa sekä "Tallenna oletukseksi" -painikkeella.',
        la: 'Optiones DSP perpetuae in initio programmatis cum commutatore in DSP Studio et Optionibus atque bulla "Serva ut primigenium".',
      },
      {
        pl: 'Styl ikony aplikacji: nowa ikona Neon Lineout (kontur Kitsune z gradientem) oraz selektor w Ustawieniach do wyboru między Neon Lineout a Klasyczną Anime.',
        en: 'App Icon Style: bespoke Neon Lineout vector icon (gradient Kitsune contour) and options selector to choose between Neon Lineout and Classic Anime.',
        de: 'App-Symbol-Stil: Vektor-Neon-Lineout-Symbol (Kitsune-Kontur mit Farbverlauf) und Einstellungs-Auswahl zwischen Neon-Lineout und klassischem Anime.',
        fi: 'Sovelluskuvakkeen tyyli: räätälöity Neon-viivapiirros (kitsune-gradienttikontuuri) ja valitsin asetuksissa Neon Lineoutin ja klassisen animen välillä.',
        la: 'Stylus iconis applicationis: nova icon Lineamenti Neonei (figura Kitsune cum gradu colorum) et selector in Optionibus.',
      },
      {
        pl: 'Wgrywanie własnych okładek z dysku: bezpośredni wybór pliku graficznego (PNG, JPG, WebP, GIF) przez Dolphin, przeciągnij-i-upuść oraz dedykowany przycisk w Now Playing i BigScreenView.',
        en: 'Custom Cover Upload from disk: direct local image file selection (PNG, JPG, WebP, GIF) via Dolphin, Drag-and-Drop, and direct upload buttons in Now Playing and BigScreenView.',
        de: 'Eigenes Cover hochladen: Direkte Bildauswahl (PNG, JPG, WebP, GIF) über Dolphin, Drag & Drop sowie Schaltflächen in Now Playing und BigScreenView.',
        fi: 'Oman kansikuvan lataus levyltä: suora kuvatiedoston valinta (PNG, JPG, WebP, GIF) Dolphinin kautta, Drag & Drop sekä painikkeet Now Playingissä ja BigScreenViewissä.',
        la: 'Tegumenta propria e disco: selectio directa imaginum (PNG, JPG, WebP, GIF) per Dolphin, Drag & Drop atque bullae in Now Playing et BigScreenView.',
      },
      {
        pl: 'Precyzyjna edycja pętli A-B w milisekundach: okno LoopEditorModal z wpisywaniem czasu co do milisekundy (np. 860ms, 860 lub 0:00.860), mikro-korektą Nudge (±10ms, ±100ms, ±1s) i natychmiastowym odsłuchem.',
        en: 'Millisecond Loop Editor: LoopEditorModal for typing exact loop boundary times down to milliseconds (e.g. 860ms, 860, 0:00.860), micro-nudge buttons (±10ms, ±100ms, ±1s), and direct preview.',
        de: 'Millisekunden-Schleifen-Editor: LoopEditorModal zur Eingabe exakter Schleifenzeiten auf Millisekunden (z. B. 860ms, 860, 0:00.860), Feinjustierung (±10ms, ±100ms, ±1s) und Vorschau.',
        fi: 'Millisekuntitarkka A-B silmukan muokkaus: LoopEditorModal tarkkojen aikojen syöttämiseen millisekunteina (esim. 860ms, 860, 0:00.860), hienosäätöpainikkeilla (±10ms, ±100ms, ±1s) ja esikuuntelulla.',
        la: 'Gyrus A-B in millisecundis: LoopEditorModal pro tempore exacto (ut 860ms, 860 vel 0:00.860) cum globulis minutis (±10ms, ±100ms, ±1s) et auditione directa.',
      },
      {
        pl: 'Wskaźnik i synchronizacja zakładek (Bookmarks): wyświetlanie zapamiętanej pozycji na przycisku i osi czasu, skok do zakładki 1-kliknięciem oraz opcja usuwania zakładek (delete_bookmark).',
        en: 'Enhanced Playback Bookmarks: live display of saved position on toolbar and seekbar pin, 1-click jump to bookmark, and bookmark deletion capability (delete_bookmark).',
        de: 'Erweiterte Wiedergabe-Lesezeichen: Anzeige der gespeicherten Position in der Symbolleiste und auf der Zeitleiste, 1-Klick-Sprung und Löschfunktion (delete_bookmark).',
        fi: 'Parannetut toiston kirjanmerkit: tallennetun kohdan näyttö työkalupalkissa ja aikajanalla, yhden napsautuksen hyppy ja kirjanmerkin poisto (delete_bookmark).',
        la: 'Indices auditionis aucti: monstratio loci servati in tabula et linea temporis, saltus 1-tactu et deletio indicis (delete_bookmark).',
      },
    ],
    fixed: [
      {
        pl: 'Eliminacja domyślnej ikony WebKitGTK (żółtego „W”) na pasku zadań w KDE Plasma Wayland dzięki poprawnej konfiguracji app_id, .desktop oraz cache ikon hicolor.',
        en: 'Fixed taskbar yellow WebKitGTK fallback icon on KDE Plasma Wayland via proper app_id, .desktop mapping, and hicolor multi-resolution icon cache installation.',
        de: 'Standardmäßiges gelbes WebKitGTK-Ersatzsymbol in der KDE-Plasma-Wayland-Taskleiste durch app_id- und .desktop-Zuordnung sowie hicolor-Cache behoben.',
        fi: 'Korjattu KDE Plasma Waylandin tehtäväpalkin keltainen WebKitGTK-varakuvake app_id-, .desktop- ja hicolor-kuvakevälimuistin korjauksilla.',
        la: 'Emendatio iconis subsidiariae luteae WebKitGTK in tabula KDE Plasma Wayland per app_id et adaptationem tabulae hicolor.',
      },
      {
        pl: 'Ochrona parametrów DSP przy przełączaniu na wyjście bez DSP (Direct Bypass): pitch, tempo i szybkość nie są już resetowane do wartości zerowych przy powrocie do Rubber Band lub SoundTouch.',
        en: 'DSP parameter preservation when switching to Direct Bypass: custom pitch, tempo, and speed are no longer wiped upon returning to Rubber Band or SoundTouch.',
        de: 'DSP-Parameter-Erhalt beim Umschalten auf Direct Bypass: benutzerdefinierte Tonhöhe, Tempo und Geschwindigkeit werden bei der Rückkehr zu Rubber Band oder SoundTouch nicht mehr zurückgesetzt.',
        fi: 'DSP-parametrien säilytys Direct Bypass -tilaan siirryttäessä: äänenkorkeus, tempo ja nopeus eivät enää nollaudu palattaessa Rubber Band- tai SoundTouch-silmukoihin.',
        la: 'Conservatio parametrorum DSP ad transitum in Direct Bypass: modulatio vocis, temporis et celeritatis non amplius delentur redeundo ad Rubber Band vel SoundTouch.',
      },
      {
        pl: 'Korekta suwaka głośności w dolnym pasku: normalizacja zakresu do 100% (usunięcie pustego pola za suwakiem) oraz inteligentny powrót z wyciszenia.',
        en: 'Fixed bottom dock volume slider: normalized range to 100% (eliminated dead space past max volume) and smart unmute restoration.',
        de: 'Lautstärkeregler im unteren Dock korrigiert: Bereich auf 100% normiert (toter Bereich am Ende entfernt) und intelligente Stummschaltungs-Rückkehr.',
        fi: 'Alapalkin äänenvoimakkuuden säädin korjattu: asteikko normalisoitu 100%:iin (tyhjä tila poistettu) ja älykäs mykistyksen palautus.',
        la: 'Correctio indicis voluminis: normalizatio ad 100% (spatium inane sublatum) et restitutio intellegens e muto.',
      },
      {
        pl: 'Autentyczny tryb Nightcore przez Playback Speed: płynne przyspieszenie odtwarzania (+25% prędkości z proporcjonalnym wzrostem tonacji) oraz szybki przycisk 1.25x.',
        en: 'Authentic Nightcore varispeed: implemented true playback speed (+25% speed with coupled pitch scaling) and quick 1.25x preset button.',
        de: 'Echter Nightcore-Varispeed: Authentische Wiedergabegeschwindigkeit (+25% gekoppelt mit Tonhöhe) und 1,25x-Schnellwahltaste.',
        fi: 'Aito Nightcore-varispeed: aito toistonopeuden nosto (+25% nopeus yhdistetyllä korkeudella) sekä nopea 1.25x-painike.',
        la: 'Verus modus Nightcore: celeritas canendi (+25% varispeed cum tono coniuncto) et globulus celer 1.25x.',
      },
      {
        pl: 'Wyeliminowanie błędu startu WebKitGTK (SyntaxError w Canvas addColorStop) powodującego znikanie okna po 1 sekundzie na Linuksie Wayland.',
        en: 'Fixed WebKitGTK startup crash (SyntaxError in Canvas addColorStop) causing window disappearance after 1 second on Linux Wayland.',
        de: 'WebKitGTK-Startabsturz behoben (SyntaxError in Canvas addColorStop), der unter Linux Wayland zum Schließen des Fensters führte.',
        fi: 'Korjattu WebKitGTK-käynnistysvirhe (SyntaxError Canvas addColorStopissa), joka sulki ikkunan 1 sekunnin jälkeen Linux Waylandilla.',
        la: 'Emendatio erroris initialis WebKitGTK (SyntaxError in addColorStop Canvas) qui fenestram claudebat in Linux Wayland.',
      },
      {
        pl: 'Aliasy komend Tauri i odporność wywołań DSP (`set_tempo_ratio`, `set_pitch_semitones`, `set_rate_ratio`) zapobiegające błędom braku argumentów.',
        en: 'Tauri command compatibility aliases (`set_tempo_ratio`, `set_pitch_semitones`, `set_rate_ratio`) preventing argument mismatch errors.',
        de: 'Tauri-Befehlskompatibilitätsaliase (`set_tempo_ratio`, `set_pitch_semitones`, `set_rate_ratio`) zur Vermeidung von Aufruffehlern.',
        fi: 'Tauri-komentojen yhteensopivuusaliakset (`set_tempo_ratio`, `set_pitch_semitones`, `set_rate_ratio`) kutsurikkoutumisten estämiseksi.',
        la: 'Aliasa mandatorum Tauri adiecta (`set_tempo_ratio`, `set_pitch_semitones`, `set_rate_ratio`) ad errores arcendos.',
      },
      {
        pl: 'Optymalizacja kompozytora WebKitGTK na Linuksie: usunięcie ciężkich filtrów backdrop-filter oraz cieni canvas, eliminacja lagów i płynne 60 FPS.',
        en: 'WebKitGTK Linux compositor optimization: eliminated heavy nested backdrop-filter and canvas shadowBlur to guarantee smooth 60 FPS.',
        de: 'WebKitGTK-Linux-Kompositor-Optimierung: Entfernung schwerer Filter und Schatten für flüssige 60 FPS.',
        fi: 'WebKitGTK Linux -optisointi: poistettu raskaat sumennussuodattimet ja varjot tasaisen 60 FPS saavuttamiseksi.',
        la: 'Optimizatio WebKitGTK pro Linux: amotio formularum gravium nebulae et umbrarum pro 60 FPS lenibus.',
      },
      {
        pl: 'Korekta wyświetlania autorki: usunięto podwójne drukowanie etykiety („Autorka: Das Letzte Kemonomimi: Das Letzte Kemonomimi”).',
        en: 'Fixed author credits: eliminated duplicate author label printing in the About section across all languages.',
        de: 'Autorin-Anzeige korrigiert: doppelte Namensausgabe im Über-Bereich behoben.',
        fi: 'Korjattu tekijän näyttö: poistettu kaksinkertainen nimitulostus Tietoja-osiosta.',
        la: 'Correctio auctricis: duplicata scriptio nominis in sectione De Auralune amota.',
      },
      {
        pl: 'Synchronizacja osi czasu, paska postępu i falogramu Waveform z tempem procesora DSP (odporność na tempo 0.25x – 3.0x).',
        en: 'Precise timeline, progress bar, and waveform bar sync with DSP tempo stretching (0.25x - 3.0x).',
        de: 'Exakte Zeitleisten-, Fortschrittsbalken- und Wellenformsynchronisation mit dem DSP-Tempo (0,25x - 3,0x).',
        fi: 'Aika-akselin, edistymispalkin ja aaltomuodon tarkka synkronointi DSP-tempon kanssa (0.25x - 3.0x).',
        la: 'Syncronizatio subtilis lineae temporis et formae undarum cum tempestate DSP (0.25x - 3.0x).',
      },
      {
        pl: 'Analizator widma FFT (Spectrum Analyzer): poprawna obsługa gst::ListRef w GStreamer stereo/mono dla trybów Bars, Wave i Mirrored.',
        en: 'Live FFT Spectrum Analyzer: fixed gst::ListRef parsing in GStreamer for mono/stereo across Bars, Wave, and Mirrored modes.',
        de: 'Echtzeit-FFT-Spektrumanalysator: gst::ListRef-Parsing für Stereo/Mono in den Modi Balken, Welle und Spiegelung behoben.',
        fi: 'Reaaliaikainen FFT-spektrianalysaattori: korjattu gst::ListRef-jäsennys stereo/mono-äänelle kaikissa tiloissa.',
        la: 'Analysator spectri FFT: correctio gst::ListRef in GStreamer pro modis Columnarum, Undae et Speculi.',
      },
      {
        pl: 'Eliminacja zniekształceń fazowych w silniku Rubber Band (flagi CHANNELS_TOGETHER, SMOOTHING_ON, bufor wyjściowy 300ms).',
        en: 'Eliminated phase distortion in Rubber Band engine (CHANNELS_TOGETHER, SMOOTHING_ON, 300ms output queue).',
        de: 'Phasenverzerrungen in der Rubber-Band-Engine eliminiert (CHANNELS_TOGETHER, SMOOTHING_ON, 300ms Puffer).',
        fi: 'Vaihevääristymät poistettu Rubber Band -moottorista (CHANNELS_TOGETHER, SMOOTHING_ON, 300ms puskuri).',
        la: 'Distorsio phasis in machina Rubber Band deleta (CHANNELS_TOGETHER, SMOOTHING_ON, 300ms receptaculum).',
      },
    ],
  },
];

export const ChangelogView: React.FC<ChangelogViewProps> = ({ currentLang = 'pl' }) => {
  const getLocText = (obj: { pl: string; en: string; de: string; fi: string; la: string }) => {
    return obj[currentLang] || obj.pl || obj.en;
  };

  const labels = {
    pl: {
      title: 'Dziennik Zmian & Historia Wydań',
      subtitle: 'Semantyczne wersjonowanie SemVer • Nowości, ulepszenia i eliminacja błędów',
      version: 'Wersja',
      codename: 'Kryptonim',
      author: 'Autorka',
      date: 'Data wydania',
      added: 'Nowości i rozszerzenia (Added)',
      fixed: 'Poprawki i optymalizacje (Fixed)',
      latestBadge: 'NAJNOWSZE WYDANIE',
    },
    en: {
      title: 'Changelog & Release Notes',
      subtitle: 'Semantic Versioning (SemVer) • Features, improvements, and bug fixes',
      version: 'Version',
      codename: 'Codename',
      author: 'Author',
      date: 'Release Date',
      added: 'New Features & Enhancements (Added)',
      fixed: 'Bug Fixes & Optimizations (Fixed)',
      latestBadge: 'LATEST RELEASE',
    },
    de: {
      title: 'Änderungsprotokoll & Versionshinweise',
      subtitle: 'Semantische Versionierung (SemVer) • Neue Funktionen, Verbesserungen und Fixes',
      version: 'Version',
      codename: 'Codename',
      author: 'Autorin',
      date: 'Veröffentlichungsdatum',
      added: 'Neue Funktionen (Added)',
      fixed: 'Fehlerbehebungen (Fixed)',
      latestBadge: 'NEUESTE VERSION',
    },
    fi: {
      title: 'Muutosloki & Julkaisutiedot',
      subtitle: 'Semanttinen versiointi (SemVer) • Ominaisuudet, parannukset ja korjaukset',
      version: 'Versio',
      codename: 'Koodinimi',
      author: 'Tekijä',
      date: 'Julkaisupäivämäärä',
      added: 'Uudet ominaisuudet (Added)',
      fixed: 'Korjaukset ja optimoinnit (Fixed)',
      latestBadge: 'UUSIN JULKAISU',
    },
    la: {
      title: 'Actorum Diarium & Notae Editionis',
      subtitle: 'Ratio SemVer • Novae facultates, emendationes et correctiones',
      version: 'Editio',
      codename: 'Nomen',
      author: 'Auctrix',
      date: 'Dies editionis',
      added: 'Novae facultates (Added)',
      fixed: 'Emendationes (Fixed)',
      latestBadge: 'RECENTISSIMA EDITIO',
    },
  }[currentLang] || {
    title: 'Dziennik Zmian & Historia Wydań',
    subtitle: 'Semantyczne wersjonowanie SemVer • Nowości, ulepszenia i eliminacja błędów',
    version: 'Wersja',
    codename: 'Kryptonim',
    author: 'Autorka',
    date: 'Data wydania',
    added: 'Nowości i rozszerzenia (Added)',
    fixed: 'Poprawki i optymalizacje (Fixed)',
    latestBadge: 'NAJNOWSZE WYDANIE',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px', margin: '0 auto' }}>
      {/* Nagłówek sekcji */}
      <div
        className="glass-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderLeft: '4px solid var(--accent-pink)',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="var(--accent-pink)" />
            {labels.title}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {labels.subtitle}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(168, 85, 247, 0.2)',
              color: 'var(--accent-purple)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
            }}
          >
            v0.2.1 • Harmony & Precision
          </span>
        </div>
      </div>

      {/* Lista wydań */}
      {RELEASES.map((rel) => (
        <div
          key={rel.version}
          className="glass-card"
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Pasek wersji i metadanych */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  boxShadow: '0 2px 8px rgba(244, 63, 94, 0.35)',
                }}
              >
                <Tag size={15} />
                <span>v{rel.version}</span>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                  „{rel.codename}”
                </h4>
              </div>
              {rel.isLatest && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: 'var(--accent-green)',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                  }}
                >
                  {labels.latestBadge}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} />
                {rel.date}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-pink)', fontWeight: 600 }}>
                <User size={13} />
                {rel.author}
              </span>
            </div>
          </div>

          {/* Sekcja: Dodano (Added) */}
          <div>
            <h5
              style={{
                margin: '0 0 10px 0',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={15} />
              {labels.added}
            </h5>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {rel.added.map((item, idx) => (
                <li key={idx} style={{ lineHeight: 1.5 }}>
                  <span style={{ color: '#fff' }}>{getLocText(item)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sekcja: Naprawiono (Fixed) */}
          <div>
            <h5
              style={{
                margin: '0 0 10px 0',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--accent-pink)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Wrench size={15} />
              {labels.fixed}
            </h5>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {rel.fixed.map((item, idx) => (
                <li key={idx} style={{ lineHeight: 1.5 }}>
                  <span style={{ color: '#fff' }}>{getLocText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
};
