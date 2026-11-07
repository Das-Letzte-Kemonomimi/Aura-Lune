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
    version: '0.9.1',
    codename: 'Kitsune Kinetic Groove',
    date: '2026-11-08',
    author: 'Das Letzte Kemonomimi',
    isLatest: true,
    added: [
      {
        pl: 'Fizyka obrotu płyty winylowej zsynchronizowana z DSP i BPM: płyta wiruje z realistyczną bezwładnością silnika Direct-Drive zsynchronizowaną na żywo z suwakiem DSP Tempo (0.25x – 3.00x), szybkością odtwarzania oraz tempem utworu. Płynny rozruch, wyhamowywanie na pauzie bez szarpnięć i odczyt RPM na żywo.',
        en: 'Dynamic Vinyl Turntable physics synced with DSP & BPM: record spins with realistic Direct-Drive inertia dynamically scaling with DSP Tempo (0.25x – 3.00x), playback rate, and song BPM. Smooth motor acceleration, deceleration on pause, and live RPM readout.',
        de: 'Dynamische Plattenspieler-Physik synchronisiert mit DSP & BPM: Schallplatte dreht sich mit Direktantriebs-Trägheit, abgestimmt auf DSP-Tempo (0.25x – 3.00x), Wiedergaberate und BPM.',
        fi: 'Dynaaminen vinyylisoittimen pyörimisfysiikka synkronoituna DSP:n ja BPM:n kanssa: levy pyörii suoravetomoottorin inertialla DSP-tempon (0.25x – 3.00x), toistonopeuden ja BPM:n mukaan.',
        la: 'Physica gyrandi disci vinylei synchronizata cum DSP et BPM: discus gyratur cum inertia motoris Direct-Drive secundum DSP velocitatem et cantus rhythmum.',
      },
      {
        pl: 'Udoskonalona geometria i skalowanie Stereo VU-Meter: precyzyjne proporcje skali IEC VU, pełne obramowanie tarczy bez wychodzenia skali poza obudowę, czytelny cyfrowy odczyt dB w okienku LCD bez kolizji z igłą oraz kompaktowe selektory motywów Amber/Sakura/Cyan.',
        en: 'Refined Stereo VU-Meter geometry & scaling: precise IEC VU scale proportions, clipped faceplate eliminating gauge overflow, recessed LCD dB readout without needle collision, and compact Amber/Sakura/Cyan theme selectors.',
        de: 'Verbesserte Stereo-VU-Meter-Geometrie: Präzise IEC VU-Skalenproportionen, saubere Gehäusekanten ohne Überlauf, versenktes LCD-dB-Display ohne Zeigerkollision und kompakte Themenknöpfe.',
        fi: 'Tarkennettu stereo-VU-mittarin geometria ja skaalaus: tarkat IEC VU -asteikkosuhteet, rajattu mittaripohja ilman reunan ylitystä, upotettu LCD-dB-lukema ja kompaktit teemavalitsimet.',
        la: 'Geometria emendata indicis stereo VU-Meter: proportiones accuratae scalae IEC VU, tabula circumscripta sine overflow, numerus dB in fenestra LCD et electores compendiarii.',
      },
      {
        pl: 'Dedykowane paski parametrów pod wizualizacją: rozdzielenie kontrolek w sekcji Now Playing – przyciski okładki tylko w trybie Cover, wskaźnik pracy gramofonu w trybie Vinyl, a w trybie VU-Meter parametry kalibracji studyjnej (0 VU = +4 dBu / 1.23V).',
        en: 'Dedicated context bars beneath visualizer: cover buttons only in Cover mode, turntable status in Vinyl mode, and studio calibration info (0 VU = +4 dBu / 1.23V) in VU-Meter mode.',
        de: 'Kontextbezogene Statusleisten unter der Visualisierung: Cover-Schaltflächen nur im Cover-Modus, Plattenspieler-Status im Vinyl-Modus und Studiokalibrierung im VU-Modus.',
        fi: 'Omat tilapalkit visualisoinnin alla: kansipainikkeet vain kansitilassa, äänivarren tila vinyylitilassa ja studiokalibrointitieto VU-mittaritilassa.',
        la: 'Fasciae contextuales sub imagine: globuli operculi tantum in modo Cover, status brachii in modo Vinyl, et calibratio studii in modo VU-Meter.',
      },
    ],
    fixed: [
      {
        pl: 'Usunięto ucinanie przycisków motywu podświetlenia w ciasnych widokach VU-Meter oraz nachodzenie na siebie napisów nagłówka.',
        en: 'Fixed backlight theme button clipping and header label text wrapping in narrow VU-Meter layouts.',
        de: 'Behoben: Abschneiden der Themenknöpfe und Überlappen von Überschriften bei schmaler VU-Meter-Ansicht.',
        fi: 'Korjattu taustavaloteemapainikkeiden leikkautuminen ja otsikkotekstien päällekkäisyys kapeissa VU-näkymissä.',
        la: 'Correcta intersectio textuum et praecisio globulorum in angustis spatiis indicis VU-Meter.',
      },
    ],
  },
  {
    version: '0.9.0',
    codename: 'Kitsune Infinity & Analog Warmth',
    date: '2026-11-07',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Bauer Headphone Crossfeed (bs2b) w DSP Studio: dedykowana karta z presetami Default, Chu Moy, Jan Meier i suwakami Custom dostępna bezpośrednio w zakładce DSP.',
        en: 'Bauer Headphone Crossfeed (bs2b) in DSP Studio: dedicated card with Default, Chu Moy, Jan Meier presets and Custom sliders directly inside the DSP tab.',
        de: 'Bauer Kopfhörer-Crossfeed (bs2b) im DSP Studio: Eigene Karte mit Presets (Default, Chu Moy, Jan Meier) und Schiebereglern direkt im DSP-Reiter.',
        fi: 'Bauer-kuulokeristisyöttö (bs2b) DSP Studiossa: oma kortti esiasetuksilla (Default, Chu Moy, Jan Meier) ja liukusäätimillä suoraan DSP-välilehdellä.',
        la: 'Transmissio aurium Bauer (bs2b) in DSP Studio: tabula dedicata cum modis et elapsoribus directe in DSP indice.',
      },
      {
        pl: 'Analogowy wskaźnik stereo VU-Meter (VuMeterWidget): dwuigłowy wskaźnik wychyłowy L/R z balistyką analogową, skalą dB, Peak LED oraz 3 motywami podświetlenia (Amber Glow, Sakura Pink, Cyber Neon).',
        en: 'Analog Stereo VU-Meter (VuMeterWidget): dual ballistic needles L/R with vintage dB scale, Peak LEDs, and 3 backlight themes (Amber Glow, Sakura Pink, Cyber Neon).',
        de: 'Analoger Stereo-VU-Meter (VuMeterWidget): Doppelzeiger-Instrument L/R mit Ballistik, dB-Skala, Peak-LED und 3 Hintergrundbeleuchtungs-Themen.',
        fi: 'Analoginen stereo-VU-mittari (VuMeterWidget): kaksi neulaa (V/O) analogisella ballistiikalla, dB-asteikolla, Peak-LEDillä ja 3 taustavaloteemalla.',
        la: 'Index analogicus stereo VU-Meter: binae acus L/R cum physica ballistica, scala dB, Peak LED et tribus coloribus illuminationis.',
      },
      {
        pl: 'Interaktywny gramofon winylowy Hi-Fi (VinylTurntable): wirująca płyta z odbiciami rowków, okładką w centrum, animowanym ramieniem opadającym na płytę i przełącznikiem 33⅓ / 45 RPM.',
        en: 'Interactive Hi-Fi Vinyl Turntable (VinylTurntable): spinning grooved record with optical reflections, center artwork spindle, moving tonearm, and 33⅓ / 45 RPM switch.',
        de: 'Interaktiver Hi-Fi-Plattenspieler (VinylTurntable): Drehende Vinyl-Schallplatte mit Rillenreflexionen, Cover-Etikett, animiertem Tonarm und 33⅓ / 45 RPM-Umschalter.',
        fi: 'Interaktiivinen Hi-Fi-vinyylisoitin (VinylTurntable): pyörivä vinyylilevy valoheijastuksilla, kansitaiteella, liikkuvalla äänivarrella ja 33⅓ / 45 RPM -kytkimellä.',
        la: 'Grammophonum vinyleum interactivum (VinylTurntable): discus gyrans cum reflexione sulcorum, imagine operculi, brachio mobili et electore 33⅓ / 45 RPM.',
      },
      {
        pl: 'Inteligentny Auto-DJ / Infinity Queue: automatyczne dobieranie harmonicznie zgodnych utworów z biblioteki (Camelot Wheel & BPM) pod koniec kolejki, gwarantujące nieprzerwane odtwarzanie.',
        en: 'Smart Auto-DJ / Infinity Queue: automatic Camelot Wheel & BPM harmonic match from library when queue is ending, ensuring endless continuous playback.',
        de: 'Smart Auto-DJ / Infinity Queue: Automatisches Anhängen harmonisch kompatibler Titel (Camelot-Rad & BPM) am Ende der Warteschlange.',
        fi: 'Älykäs Auto-DJ / Infinity Queue: harmonisesti yhteensopivien kappaleiden (Camelot Wheel & BPM) automaattinen lisäys jonon loppuun loputtomaan toistoon.',
        la: 'Auto-DJ / Infinity Queue callidus: electio harmonica cantuum ex bibliotheca (Camelot & BPM) ad finem ordinis pro perpetuo cantu.',
      },
      {
        pl: 'Linux Ricing IPC (/tmp/auralune.json) oraz kanał sterowania FIFO/Socket (/tmp/auralune_ctl, /tmp/auralune.sock): natywna integracja z Waybarem, Hyprlandem, Sway, Polybarem i skryptami WM.',
        en: 'Linux Ricing IPC (/tmp/auralune.json) and Control FIFO/Socket (/tmp/auralune_ctl, /tmp/auralune.sock): native integration with Waybar, Hyprland, Sway, Polybar, and WM binds.',
        de: 'Linux Ricing IPC (/tmp/auralune.json) und Steuerungs-FIFO/Socket: Native Integration mit Waybar, Hyprland, Sway, Polybar und WM-Shortcuts.',
        fi: 'Linux Ricing IPC (/tmp/auralune.json) ja ohjaus-FIFO/Socket: natiivi integraatio Waybarin, Hyprlandin, Swayn, Polybarin ja WM-pikanäppäinten kanssa.',
        la: 'Linux Ricing IPC (/tmp/auralune.json) et canalis FIFO/Socket: integratio nativa cum Waybar, Hyprland, Sway et clavibus fenestrarum curatoris.',
      },
    ],
    fixed: [],
  },
  {
    version: '0.8.3',
    codename: 'Resonance & Harmonic Flow',
    date: '2026-11-07',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Wybór jednostki głośności (% vs studyjne dB): wprowadzono profesjonalną skalę logarytmiczną decybeli (-∞ dB do 0.0 dB) w Ustawieniach, OSD oraz z 1-klikowym przełącznikiem na plakietce głośności.',
        en: 'Volume display unit selection (% vs studio dB): added logarithmic decibel scale (-∞ dB to 0.0 dB) in Settings, on-screen OSD, and via 1-click toggle on volume badges.',
        de: 'Auswahl der Lautstärkeeinheit (% vs. Studio-dB): Logarithmische Dezibelskala (-∞ dB bis 0,0 dB) in den Einstellungen, im OSD und per 1-Klick-Umschalter an Lautstärke-Badges hinzugefügt.',
        fi: 'Äänenvoimakkuuden yksikön valinta (% vs studio-dB): lisätty logaritminen desibeliasteikko (-∞ dB – 0.0 dB) asetuksiin, näyttöön (OSD) ja yhdellä napsautuksella vaihdettavaan arvoon.',
        la: 'Electio unitatis voluminis (% vs decibelia dB): scala logarithmica decibeliorum (-∞ dB ad 0.0 dB) addita in Optionibus, OSD et per unum ictum mutabilis.',
      },
      {
        pl: 'Asynchroniczny eksport w tle z pływającym wskaźnikiem HUD: potok transkodera raportuje postęp w czasie rzeczywistym bez zamrażania UI, z dedykowanym widżetem i stoperem.',
        en: 'Asynchronous background audio export with floating HUD: transcode pipeline reports real-time progress without freezing the UI, complete with dedicated floating badge and timer.',
        de: 'Asynchroner Hintergrund-Audioexport mit schwebendem HUD: Der Transkodierungs-Pipeline meldet den Fortschritt in Echtzeit ohne Einfrieren der Benutzeroberfläche.',
        fi: 'Asynkroninen taustavienti kelluvalla HUD-ilmaisimella: muuntoputki raportoi reaaliaikaisen edistymisen jäädyttämättä käyttöliittymää, varustettuna kelluvalla ilmaisimella ja ajastimella.',
        la: 'Exportatio asynchrona in curriculo cum signo HUD fluitante: canalis transcodificandi profectum in tempore reali nuntiat sine congelatione usoris faciei.',
      },
      {
        pl: 'GitHub Actions CI/CD Pipeline: automatyczna weryfikacja cargo fmt, clippy, testów jednostkowych i kompilacji frontendu przy każdym pull requeście i pushu na gałąź main.',
        en: 'GitHub Actions CI/CD Pipeline: automated verification of cargo fmt, clippy, unit tests, and frontend build on every pull request and push to main.',
        de: 'GitHub Actions CI/CD Pipeline: Automatische Überprüfung von cargo fmt, clippy, Unit-Tests und Frontend-Build bei jedem Pull-Request und Push auf main.',
        fi: 'GitHub Actions CI/CD -automaatioputki: koodin muotoilun (cargo fmt), linterin (clippy), yksikkötestien ja käyttöliittymän kääntämisen automaattinen tarkistus.',
        la: 'GitHub Actions CI/CD canalis: automatica probatio cargo fmt, clippy, probationum unitariarum et aedificationis antecessoris in omni missione ad ramum main.',
      },
    ],
    fixed: [
      {
        pl: 'Harmonic Queue Assistant & DJ Beat-Matched Crossfade: naprawiono synchronizację podświetlenia przycisków taktów (1/2/4 takty), dodano przeliczone czasy w sekundach, wybór utworu bazowego i automatyczną detekcję klucza/BPM w tle.',
        en: 'Harmonic Queue Assistant & DJ Beat-Matched Crossfade: fixed bar button highlight synchronization (1/2/4 bars), added exact calculated seconds, base track selector, and auto key/BPM background detection.',
        de: 'Harmonischer DJ-Assistent & Beat-Matched Crossfade: Hervorhebung der Taktschaltflächen (1/2/4 Takte) synchronisiert, Sekundenanzeige ergänzt, Referenztitel-Auswahl und Hintergrund-BPM/Tonart-Erkennung implementiert.',
        fi: 'Harmoninen DJ-avustaja ja Beat-Matched Crossfade: korjattu tahtipainikkeiden korostuksen synkronointi (1/2/4 tahtia), lisätty lasketut sekunnit, peruskappaleen valitsin ja automaattinen sävellajin/BPM:n tunnistus.',
        la: 'Adiutor Harmonicus & DJ Beat-Matched Crossfade: synchronizatio illuminationis pugaellarum emendata, tempora in secundis addita, electio carminis basalis et agnitio toni/BPM in curriculo.',
      },
      {
        pl: 'Płynny Equal-Power Crossfade (0.0s – 8.0s): usunięto sztywne ograniczenie 3 sekund, wprowadzono 20-milisekundową mikrokosmetykę krzywej sinusoidalnej (50 Hz), asynchroniczny preroll i wyeliminowano pauzy ciszy pre-EOS.',
        en: 'Smooth Equal-Power Crossfade (0.0s – 8.0s): eliminated 3-second hard clamp, introduced 50 Hz (20ms) sinusoidal micro-stepping, async preroll, and removed pre-EOS silence gaps.',
        de: 'Nahtloses Equal-Power Crossfade (0,0s – 8,0s): 3-Sekunden-Limit aufgehoben, 50 Hz (20ms) Sinus-Mikroschritte eingeführt, asynchroner Preroll und pre-EOS-Stillepausen beseitigt.',
        fi: 'Tasainen Equal-Power Crossfade (0.0s – 8.0s): poistettu 3 sekunnin raja, otettu käyttöön 50 Hz (20ms) sinimuotoiset mikroaskeleet, asynkroninen esilataus ja poistettu katkokset ennen kappaleen loppua.',
        la: 'Transitus aequalis potestatis (Equal-Power Crossfade 0.0s – 8.0s): terminus 3 secundorum deletus, gradus sinusoidales 20ms (50 Hz) inducti, prae-oneratio asynchrona et hiatus silentii sublati.',
      },
      {
        pl: 'Skróty klawiszowe głośności (↑ / ↓): usunięto przechwytywanie strzałek przez suwak głośności po kliknięciu myszą (krok 1% zamiast 5%) poprzez automatyczny blur i ujednolicenie globalnych słuchaczy.',
        en: 'Keyboard volume shortcuts (↑ / ↓): resolved DOM slider capturing arrow keys at 1% increments after mouse click via automatic input blur and unified global listeners.',
        de: 'Tastatur-Lautstärkekürzel (↑ / ↓): Fokuserfassung durch Schieberegler nach Mausklick (1%-Schritte) durch automatisches Blur und vereinheitlichte globale Listener behoben.',
        fi: 'Äänenvoimakkuuden pikanäppäimet (↑ / ↓): korjattu liukusäätimen nuolinäppäinten kaappaus (1% askellus) hiirellä napsauttamisen jälkeen automaattisella kohdistuksen poistolla.',
        la: 'Compendia claviaturae voluminis (↑ / ↓): interceptio sagittarum per indicem post ictum muris (1% loco 5%) correcta per amotionem automaticae attentionis.',
      },
      {
        pl: 'Natywny Stereo Widener bez rwania dźwięku: zastąpiono wadliwy element GStreamera stereo autorską 32-bitową sondą F32LE w matrycy Mid-Side z kompensacją energii i ochroną mono.',
        en: 'Native click-free Stereo Widener: replaced buggy GStreamer stereo element with proprietary 32-bit F32LE Mid-Side matrix probe with energy compensation and mono guard.',
        de: 'Nativer, ruckelfreier Stereo-Verbreiterer (Stereo Widener): Fehlerhaftes GStreamer-stereo-Element durch eigene 32-Bit F32LE Mid-Side-Matrix-Sonde ersetzt.',
        fi: 'Natiivi häiriötön stereokuvan laajennin (Stereo Widener): korvattu viallinen GStreamerin stereo-elementti omalla 32-bittisellä F32LE Mid-Side -matriisilla.',
        la: 'Dilatator Stereo nativus sine scissura soni: elementum vitiosum GStreamer stereo substitutum est specula propria 32-bit F32LE Mid-Side cum compensatione energiae.',
      },
      {
        pl: 'Lokalizacja i układ interfejsu: przetłumaczono pozostałe etykiety w trybie języka angielskiego, zabezpieczono zawijanie tekstu w zakładkach Ustawień oraz dodano obsługę przecinków dziesiętnych w polach czasu.',
        en: 'Localization & layout refinements: translated remaining Polish strings in English mode, prevented button text-wrapping on settings tabs, and supported decimal commas in time crops.',
        de: 'Lokalisierung & Layout-Verfeinerungen: Verbleibende polnische Texte im englischen Modus übersetzt, Textumbruch bei Einstellungs-Tabs verhindert und Dezimalkommas in Zeitfeldern unterstützt.',
        fi: 'Kansainvälistäminen ja ulkoasun parannukset: käännetty loput puolankieliset tekstit englanniksi, estetty välilehtien tekstin rivitys ja tuettu desimaalipilkkuja aikakentissä.',
        la: 'Emendationes linguae et dispositionis: sententiae relictae in linguam anglicam translatae, complicatio verborum in tabulis Optionum prohibita et commata decimalia comprobata.',
      },
    ],
  },
  {
    version: '0.8.2',
    codename: 'Pure Flow & Transcode Stability',
    date: '2026-11-01',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [],
    fixed: [
      {
        pl: 'Eliminacja zawieszenia (100% CPU deadlock) przy wyłączaniu ReplayGain: naprawiono pętlę zwrotną w powiadomieniach właściwości GStreamera; element wewnętrzny rgvolume-volume jest teraz przełączany w natywny tryb zero-overhead passthrough.',
        en: 'Elimination of hang (100% CPU deadlock) when disabling ReplayGain (Off): removed circular property notify loop in GStreamer pipeline; rgvolume-volume now seamlessly switches to native zero-overhead passthrough.',
        de: 'Behebung des Einfrierens (100% CPU Deadlock) beim Deaktivieren von ReplayGain: Zirkuläre Eigenschaftsbenachrichtigungen behoben; rgvolume-volume wechselt nun in den nativen Zero-Overhead-Passthrough-Modus.',
        fi: 'ReplayGainin poiskytkennän jäätymisen (100% CPU deadlock) korjaus: poistettu kiertävä ominaisuusilmoitussilmukka; rgvolume-volume kytkeytyy nyt suoraan häviöttömään passthrough-tilaan.',
        la: 'Solutio suspensionis (100% CPU deadlock) in ReplayGain avertendo: circulus notificationum sublatus; rgvolume-volume nunc in modum passthrough sine onere commutatur.',
      },
      {
        pl: 'Eliminacja zawieszenia przy eksporcie pliku (pusty plik 0 bajtów): dodano uniwersalny blok audioconvert przed enkoderami (FLAC/Opus/WAV), zabezpieczono pętlę magistrali limitem czasu oraz przeniesiono transkodowanie do asynchronicznego wątku z animowanym wskaźnikiem ładowania.',
        en: 'Elimination of hang during audio export (empty 0 byte file): added universal audioconvert format negotiation block before encoders (FLAC/Opus/WAV), bounded bus message loop with safety timeout, and moved transcode to async worker with UI spinner.',
        de: 'Behebung des Einfrierens beim Audioexport (leere 0-Byte-Datei): Universeller audioconvert-Block vor Encodern (FLAC/Opus/WAV) hinzugefügt, Bus-Schleife mit Timeout abgesichert und Transkodierung in asynchronen Thread mit Ladeanimation verlegt.',
        fi: 'Ääniviennin jäätymisen (tyhjä 0 tavun tiedosto) korjaus: lisätty yleinen audioconvert-muunnoslohko ennen koodereita (FLAC/Opus/WAV), suojattu väyläsilmukka aikakatkaisulla ja siirretty koodaus asynkroniseen säikeeseen latausosoittimella.',
        la: 'Solutio suspensionis in fasciculo exportando (vacuus 0 byte fasciculus): additus est gradus audioconvert ante codicatores (FLAC/Opus/WAV), laqueus magistratus tempore praefinito munitus et translatio in filum asynchronum translata.',
      },
      {
        pl: 'Stabilizacja i auto-aktywacja Korektora Parametrycznego (PEQ Studio): zabezpieczono pasma przed przekroczeniem zakresu GStreamera (-24..+12 dB) eliminując panikę glib FFI, oraz wprowadzono automatyczne włączanie korektora przy modyfikacji parametrów filtrów.',
        en: 'Stabilization & auto-activation of Parametric EQ (PEQ Studio): clamped filter gains to GStreamer hardware range (-24..+12 dB) preventing glib FFI panics, and auto-enabled EQ upon user editing.',
        de: 'Stabilisierung & Auto-Aktivierung des Parametrischen EQs (PEQ Studio): Filterverstärkung auf GStreamer-Bereich (-24..+12 dB) begrenzt, um FFI-Panics zu verhindern, und automatische EQ-Aktivierung bei Bearbeitung eingeführt.',
        fi: 'Parametrisen taajuuskorjaimen (PEQ Studio) stabilointi ja automaattinen aktivointi: suodatinvahvistukset rajattu GStreamerin rajoihin (-24..+12 dB) estäen FFI-kaatumiset, ja EQ aktivoituu automaattisesti parametreja muokattaessa.',
        la: 'Stabilizatio et activatio automatica Aequatoris Parametrici (PEQ Studio): amplificatio ad fines GStreamer (-24..+12 dB) cohibita ad panicam vitandam, et aequator automatice excitatur cum parametri mutantur.',
      },
    ],
  },
  {
    version: '0.8.1',
    codename: 'Parametric Warmth & Studio Dynamics',
    date: '2026-11-01',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Wielopasmowy Korektor Parametryczny (Parametric EQ Studio): zaawansowany procesor PEQ (od 1 do 32 pasm) z filtrami Peak, Low Shelf i High Shelf, precyzyjną dobrocią Q, kalkulacją bezpiecznego zapasu dynamiki (Safe Preamp), fabrycznymi presetami (Harman Target Baseline, Vocal Clarity, Sub-Bass Punch) oraz pełnym importem/eksportem profili EqualizerAPO / AutoEQ .txt.',
        en: 'Multi-Band Parametric Equalizer Studio (PEQ Studio): advanced parametric equalizer (1 to 32 bands) with Peak, Low Shelf, and High Shelf filters, Q bandwidth control, Safe Preamp clipping prevention, factory presets (Harman Target, Vocal Clarity, Sub-Bass Punch), and full EqualizerAPO / AutoEQ .txt import/export.',
        de: 'Parametrisches Equalizer-Studio (PEQ): Fortschrittlicher parametrischer EQ (1 bis 32 Bänder) mit Peak-, Low-Shelf- und High-Shelf-Filtern, Q-Gütefaktor, Safe Preamp Headroom-Schutz, Werksvoreinstellungen (Harman Target, Vocal Clarity) und vollständigem EqualizerAPO / AutoEQ .txt Import/Export.',
        fi: 'Parametrinen taajuuskorjainstudio (PEQ): monikaistainen parametrinen EQ (1-32 kaistaa) Peak-, Low Shelf- ja High Shelf -suodattimilla, Q-arvon säädöllä, Safe Preamp -suojauksella, esiasetuksilla (Harman Target, Vocal Clarity) ja täydellä EqualizerAPO / AutoEQ .txt -tuonnilla ja -viennillä.',
        la: 'Aequatoris Parametrici Officina (PEQ): provectus aequator parametricus (1 ad 32 fasces) cum filtrorum Peak, Low Shelf et High Shelf, moderatione Q, praemunitione Safe Preamp, formis praefinitis et plena translatione EqualizerAPO / AutoEQ .txt.',
      },
      {
        pl: 'Studio Dynamiki & Lampy (Dynamics & Warmth Studio): kompresor dynamiki z regulacją progu (-60..0 dBFS), stosunku ratio (1:1..20:1), przełączaniem Soft/Hard Knee i wzmocnieniem Makeup Gain, połączony z bezalokacyjną emulacją nasycenia lampowego (parzyste harmoniczne triody), taśmy magnetofonowej (arctan) i master limiterem słuchawkowym chroniącym słuch.',
        en: 'Dynamics & Analog Warmth Studio: Dynamic Range Compressor (audiodynamic with threshold, ratio, soft/hard knee, and makeup gain) paired with zero-allocation waveshaping saturation (Triode even harmonic warmth, tape saturation arctan compression) and headphone protection limiter.',
        de: 'Dynamik- & Röhrenwärme-Studio: Dynamikbereichs-Kompressor (mit Threshold, Ratio, Soft/Hard Knee und Makeup Gain) kombiniert mit analoger Sättigung (Trioden-Röhrenwärme, Bandsättigung) und Kopfhörerschutz-Limiter.',
        fi: 'Dynamiikka- & putkilämpöstudio: dynamiikkakompressori (Threshold, Ratio, Soft/Hard Knee, Makeup Gain) yhdistettynä analogiseen saturaatioon (triodiputken parilliset harmoniset, nauhasaturaatio) ja kuulokkeita suojaavaan master-limitteriin.',
        la: 'Officina Dynamicae et Caloris: compressor dynamicae cum moderatione Threshold, Ratio, Knee et Makeup Gain, coniunctus cum saturatione tubi electronici (harmonicae pares), taeniae magneticae et limite tutelae auricularum.',
      },
    ],
    fixed: [],
  },
  {
    version: '0.8.0',
    codename: 'Harmonic Flow & Ambient Focus',
    date: '2026-11-01',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Dźwiękowy generator tła (Soundscape / Lofi Ambience): 5 nieskończonych, proceduralnych warstw syntezy Web Audio API miksowanych na żywo z muzyką (deszcz z kroplami, trzask winyla, ognisko z iskrami, wiatr z dzwonkami Furin w japońskiej skali Insen, szum brązowy kawiarni). Zawiera presety i synchronizację z cząsteczkami anime.',
        en: 'Soundscape & Lofi Ambience generator: 5 endless procedural Web Audio API synthesis layers mixed live with playback (rain with droplets, vinyl crackle, campfire embers, wind with Japanese Furin chimes in Insen scale, cafe brown noise). Features quick presets and anime particle auto-sync.',
        de: 'Klanglandschaft & Lofi-Ambiente-Generator: 5 endlose prozedurale Web-Audio-Syntheseschichten gemischt mit der Musik (Regen mit Tropfen, Vinylknistern, Lagerfeuer, Wind mit Furin-Glocken in Insen-Skala, braunes Café-Rauschen). Mit Presets und Anime-Partikel-Sync.',
        fi: 'Äänimaisema & Lofi-tunnelmageneraattori: 5 loputonta proseduraalista Web Audio -syntetisaatiokerrosta reaaliaikaisessa miksauksessa (sade pisaroineen, vinyylin rahina, nuotio, tuuli ja japanilaiset Furin-kellot Insen-asteikossa, kahvilan ruskea kohina). Esiasetukset ja anime-partikkelisynkronointi.',
        la: 'Sonitus & Lofi generator: 5 perpetua strata synthesis Web Audio API cum cantu mixta (pluvia cum guttis, crepitus disci, ignis, ventus cum campanis Furin in scala Insen, sonitus fuscus). Modis praefinitis et particulis anime congruentibus.',
      },
      {
        pl: 'Harmonic Queue Assistant & DJ Beat-Matched Crossfade: inteligentny asystent kolejki dopasowujący tonacje koła Camelota (Camelot Wheel ±1 krok, relacje mol/dur, modulacje energii) oraz zbliżone BPM (±6% i half/double time). Wprowadza DJ Crossfade dopasowany do 1, 2 lub 4 taktów (4, 8, 16 beatów) oraz synchronizację tempa DSP.',
        en: 'Harmonic Queue Assistant & DJ Beat-Matched Crossfade: intelligent harmonic mixing assistant based on Camelot Wheel (same key, ±1 step, relative major/minor, energy boosts) and BPM compatibility (±6% and half/double-time). Features beat-matched crossfades (1, 2, or 4 bars / 4, 8, 16 beats) and DSP tempo sync.',
        de: 'Harmonischer Warteschlangen-Assistent & DJ-Crossfade: Intelligentes harmonisches Mischen basierend auf dem Camelot-Rad (gleiche Tonart, ±1 Schritt, Dur/Moll-Wechsel, Energieschübe) und BPM (±6%). Bietet Beat-angepassten Crossfade (1, 2 oder 4 Takte) und DSP-Tempo-Sync.',
        fi: 'Harmoninen jonoavustaja & DJ Beat-Matched Crossfade: älykäs harmoninen miksausavustaja Camelot-pyörän (sama sävellaji, ±1 askel, duuri/molli, energiannostot) ja BPM-yhteensopivuuden (±6%) perusteella. Sisältää rytmiin sovitun crossfaden (1, 2 tai 4 tahtia) ja DSP-temposynkronoinnin.',
        la: 'Adiutor ordinis harmonicus & DJ Beat-Matched Crossfade: mixtura harmonica secundum rotam Camelot (idem tonus, ±1 gradus, mol/dur, vis augmentum) et BPM congruentia. Praebet transitum ritmicum (1, 2 vel 4 mensurae) et congruitionem celeritatis DSP.',
      },
      {
        pl: 'Baza profili słuchawkowych AutoEQ (1-klikowy Parametric EQ): baza ponad 160 precyzyjnych pomiarów słuchawek nausznych i dokanałowych IEM (Moondrop, Sennheiser, Sony, Beyerdynamic, Apple, Hifiman, Truthear) skalowana do 10-pasmowego korektora Auralune z kompensacją Harmana i zabezpieczeniem Preamp.',
        en: 'AutoEQ Headphone Profiles Database (1-click EQ): curated database of 160+ measured over-ear and IEM headphones (Moondrop, Sennheiser, Sony, Beyerdynamic, Apple, Hifiman, Truthear) mapped to Auralune 10-band graphic EQ with Harman Target curve and digital clipping prevention preamp.',
        de: 'AutoEQ-Kopfhörerdatenbank (1-Klick-EQ): Kuratierte Datenbank von über 160 gemessenen Kopfhörern und IEMs (Moondrop, Sennheiser, Sony, Beyerdynamic, Apple, Hifiman, Truthear), angepasst an den 10-Band-EQ von Auralune mit Harman-Kurve und Preamp-Clippingschutz.',
        fi: 'AutoEQ-kuulokeprofiilitietokanta (1-klikkauksen EQ): yli 160 kuuloke- ja IEM-mallin mittaustietokanta (Moondrop, Sennheiser, Sony, Beyerdynamic, Apple, Hifiman, Truthear) sovitettuna Auralunen 10-kaistaiseen taajuuskorjaimeen Harman Target -käyrällä ja Preamp-suojauksella.',
        la: 'AutoEQ index auricularum formarum: plus quam 160 mensurae auricularum et IEM (Moondrop, Sennheiser, Sony, Beyerdynamic, Apple, Hifiman, Truthear) ad aequatorem 10-fascium Auralune aptatae cum curva Harman et tutela Preamp.',
      },
    ],
    fixed: [],
  },
  {
    version: '0.7.7',
    codename: 'Precision Loop & Seamless Flow',
    date: '2026-11-01',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Precyzyjne kolejkowanie pojedynczych utworów (Single-Track Playback): kliknięcie utworu w tabeli biblioteki, wynikach wyszukiwania, palecie komend (Ctrl+K) lub statystykach odtwarza wyłącznie ten konkretny utwór (jako 1-elementową kolejkę w trybie replace lub dopisując go na koniec w trybie append), eliminując niepożądane dodawanie całej biblioteki.',
        en: 'Single-track playback queuing: clicking a track in library table, search results, command palette (Ctrl+K) or stats plays only that specific track (as a 1-item queue in replace mode or appending it in append mode), eliminating accidental queuing of the entire library.',
        de: 'Präzise Einzeltitel-Wiedergabe: Das Anklicken eines Titels in der Bibliothekstabelle, der Suche, der Befehlspalette (Strg+K) oder den Statistiken spielt nur diesen einzelnen Titel ab, anstatt die gesamte Bibliothek einzureihen.',
        fi: 'Tarkka yksittäiskappaleiden jonotus: kappaleen klikkaaminen kirjastotaulukossa, haussa, komentovalikossa (Ctrl+K) tai tilastoissa toistaa vain kyseisen kappaleen korvaamatta jonoa koko kirjastolla.',
        la: 'Ordinatio carminum singularium: carmine in indice bibliothecae, inquisitione vel mandato electo tantum id carmen canitur, ne universa bibliotheca in ordinem temere adiciatur.',
      },
      {
        pl: 'Pływający dolny dock odtwarzacza (Now Playing Floating Dock): gdy kolejka lub widok odtwarzacza jest przewijany w dół, na dole ekranu pojawia się dokujący pasek sterowania (Play/Pause, Seek, głośność, okładka) wraz z przyciskiem szybkiego powrotu na górę.',
        en: 'Floating Now Playing dock on scroll: scrolling down a long queue smoothly docks the essential player controls (Play/Pause, seekbar, volume, cover) at the bottom edge with a one-click scroll-to-top button.',
        de: 'Schwebendes Wiedergabe-Dock beim Scrollen: Beim Herabscrollen einer langen Warteschlange dockt die kompakte Steuerleiste (Play/Pause, Suchleiste, Lautstärke, Cover) mit Schnellrückkehr nach oben an.',
        fi: 'Kelluva toistopalkki vieritettäessä: pitkää jonoa alaspäin vieritettäessä tärkeimmät toisto-ohjaimet (Play/Pause, aikajana, äänenvoimakkuus, kansi) kiinnittyvät alareunaan pikanäppäimellä ylös palaamiseen.',
        la: 'Navicula canendi fluens in volutatione: cum ordo longus deorsum volvitur, gubernacula princeps (Play/Pause, linea temporis, sonus, imago) ad imam paginam alligantur cum reditu celeri.',
      },
    ],
    fixed: [
      {
        pl: 'Precyzyjny eksport fragmentu A-B z DSP: seek potoku transkodera przeniesiono przed filtr DSP pitch (bezpośrednio na audioresample). Zapobiega to przesunięciu punktów startu i końca przez współczynnik tempa/szybkości (Nightcore/Slowed) i gwarantuje eksport zgodny z zaznaczeniem co do próbki.',
        en: 'Accurate A-B loop DSP export: moved transcoder seek upstream of the pitch DSP filter (directly onto audioresample). This prevents tempo/rate scaling from shifting start and end cut points (Nightcore/Slowed), ensuring sample-accurate range export.',
        de: 'Präziser A-B-Schleifenexport mit DSP: Transcoder-Seek vor den Pitch-DSP-Filter verlegt (direkt auf audioresample). Verhindert, dass Tempo/Rate-Faktoren Schnittpunkte verschieben (Nightcore/Slowed) und garantiert sample-genauen Export.',
        fi: 'Tarkka A-B-silukan DSP-vienti: transkooderin seek siirretty ennen pitch-DSP-suodatinta (suoraan audioresample-elementtiin). Estää tempo/rate-kertoimien leikkauspisteiden siirtymisen (Nightcore/Slowed) ja takaa tarkan viennin.',
        la: 'Exitus accuratus A-B fragmenti cum DSP: transcodatri seek ante filtrum pitch positus est (ad audioresample). Hoc prohibet ne gradus celeritatis puncta secandi moveant (Nightcore/Slowed) et accurate exportat.',
      },
      {
        pl: 'Naprawa 3 trybów kolejkowania (albumPlaybackMode) i eliminacja zalewania kolejki: poprawiono tryby Replace, Append i Single w Ustawieniach, naprawiono dodawanie plików zewnętrznych oraz przycisków w kolejce, a także usunięto błąd wirtualizacji Virtual Scroll.',
        en: 'Fixed 3 queuing modes (albumPlaybackMode) & library overflow: resolved Replace, Append, and Single modes in Settings, fixed external file opening and queue action buttons, and corrected row offset calculation in Virtual Scroll.',
        de: '3 Warteschlangen-Modi (albumPlaybackMode) & Überfüllung behoben: Korrektur der Modi Replace, Append und Single in den Einstellungen, Behebung des Öffnens externer Dateien sowie Behebung von Versatzfehlern im Virtual Scroll.',
        fi: 'Korjattu 3 jonotustilaa (albumPlaybackMode) ja jonon ylitäyttyminen: korjattu Replace-, Append- ja Single-tilat asetuksissa, korjattu ulkoisten tiedostojen avaaminen ja virtuaalivierityksen rivisiirtymät.',
        la: '3 modi ordinandi (albumPlaybackMode) et impletio superflua emendati: modi Replace, Append et Single correcti sunt, apertio fasciculorum externorum atque computatio ordinis in volutatione emendata.',
      },
    ],
  },
  {
    version: '0.7.5',
    codename: 'Single Flow & Harmonic Resonance',
    date: '2026-11-01',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Architektura Single-Instance: wdrożono blokadę wielokrotnych instancji – klikanie plików audio w menedżerze plików (Dolphin, Nautilus, Thunar) nie otwiera nowych okien, lecz przywraca aktywne okno i natychmiast odtwarza utwór przez gniazdo IPC.',
        en: 'Single-Instance architecture: implemented single-instance lock – opening audio files from file managers (Dolphin, Nautilus, Thunar) no longer spawns multiple windows, but focuses the running window and plays via IPC.',
        de: 'Single-Instance-Architektur: Verhindert mehrfache App-Fenster beim Öffnen von Audiodateien im Dateimanager; das aktive Fenster wird fokussiert und der Titel per IPC wiedergegeben.',
        fi: 'Single-Instance-arkkitehtuuri: estää useiden sovellusikkunoiden avautumisen tiedostonhallinnasta; olemassa oleva ikkuna aktivoidaan ja kappale toistetaan suoraan IPC-kanavan kautta.',
        la: 'Architectura Instantiae Singularis: impedit quominus plures fenestrae aperiantur; fenestra currens ad frontem revocatur et carmen per IPC statim canitur.',
      },
      {
        pl: 'Konfigurowalne odtwarzanie albumów i playlist: nowa opcja w Ustawieniach pozwalająca wybrać zachowanie przy kliknięciu albumu lub pliku (zastąpienie kolejki, dopisanie do kolejki lub pojedynczy utwór).',
        en: 'Configurable album & playlist playback: new Settings option allowing users to choose queue behavior when clicking an album or track (replace queue, append to queue, or single track).',
        de: 'Konfigurierbare Album- und Wiedergabelistenwiedergabe: Neue Einstellung zur Auswahl des Verhaltens beim Anklicken (Warteschlange ersetzen, anhängen oder Einzeltitel).',
        fi: 'Mukautettava albumien ja soittolistojen toisto: uusi asetus toistokäyttäytymiselle (korvaa jono, lisää jonoon tai toista vain yksi kappale).',
        la: 'Modus canendi album et indicem electio: nova optio in ordinationibus ad ordinem agendi definiendum (substitutio ordinis, adiectio vel carmen singulare).',
      },
    ],
    fixed: [
      {
        pl: 'Odtwarzanie całych albumów i autoplay: naprawiono błąd, w którym kliknięcie albumu nie zasilało kolejki utworów, przez co odtwarzacz nie przechodził do kolejnych piosenek (EOS) a przyciski Dalej / Poprzedni nie działały.',
        en: 'Album playback & autoplay: fixed an issue where playing an album did not populate the queue, preventing automatic playback advance (EOS) and disabling skip buttons.',
        de: 'Albumwiedergabe und Autoplay: Fehler behoben, bei dem das Abspielen eines Albums die Warteschlange nicht füllte, sodass der nächste Titel nicht automatisch abgespielt wurde.',
        fi: 'Albumien toisto ja automaattitoisto: korjattu ongelma, jossa albumin toistaminen ei täyttänyt jonoa, estäen automaattisen siirtymisen seuraavaan kappaleeseen.',
        la: 'Albumi cantus et autoplay: sublatus defectus ubi cantus albi ordinem non implebat, quominus proximum carmen sponte incipere posset.',
      },
      {
        pl: 'Analizator widma FFT w czasie rzeczywistym: zwiększono rozdzielczość FFT do 64 pasm z logarytmicznym grupowaniem percepcyjnym, obniżono próg czułości do -75 dBFS i przeniesiono element spectrum przed regulator głośności.',
        en: 'Real-time FFT spectrum visualizer: increased FFT resolution to 64 bands with logarithmic pooling, lowered sensitivity threshold to -75 dBFS, and moved spectrum element before volume control.',
        de: 'Echtzeit-FFT-Spektrumanalysator: Erhöhte Auflösung auf 64 Bänder mit logarithmischer Bündelung, gesenkte Empfindlichkeitsschwelle auf -75 dBFS und Spektrum vor den Lautstärkeregler verlegt.',
        fi: 'Reaaliaikainen FFT-spektrianalysaattori: resoluutio nostettu 64 kaistaan logaritmisella ryhmittelyllä, herkkyyskynnys laskettu -75 dBFS:ään ja spektrielementti siirretty ennen äänenvoimakkuutta.',
        la: 'Spectri FFT visualizator: resolutio ad 64 fascias aucta cum glomeratione logarithmica, limes ad -75 dBFS deductus et elementum ante soni gubernaculum positum.',
      },
    ],
  },
  {
    version: '0.7.4',
    codename: 'Presence & Recap Harmony',
    date: '2026-10-31',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Kompatybilność z Bazzite, SteamOS i dystrybucjami immutable: dedykowana paczka AppImage zlinkowana w hermetycznym kontenerze Fedora Atomic Desktop, eliminująca konflikty symboli glibc i webkit2gtk.',
        en: 'Bazzite, SteamOS & immutable distribution compatibility: dedicated AppImage package built in an isolated Fedora Atomic Desktop container, eliminating glibc and webkit2gtk symbol conflicts.',
        de: 'Kompatibilität mit Bazzite, SteamOS und Immutable-Distributionen: dediziertes AppImage-Paket, erstellt in einem isolierten Fedora Atomic Desktop-Container, ohne glibc- und webkit2gtk-Konflikte.',
        fi: 'Bazzite-, SteamOS- ja immutable-jakelujen yhteensopivuus: erillinen AppImage-paketti koottu eristetyssä Fedora Atomic Desktop -kontissa, poistaen glibc- ja webkit2gtk-symboliristiriidat.',
        la: 'Compatibilitas cum Bazzite, SteamOS et distributionibus immutabilibus: sarcina AppImage dedicata intra vas Fedora Atomic Desktop constructa, certamina symbolorum glibc et webkit2gtk eliminans.',
      },
    ],
    fixed: [
      {
        pl: 'Discord Rich Presence i zapętlanie utworu: naprawiono zawieszanie się paska postępu na końcu utworu (np. 1:48 / 1:48) w trybie powtarzania (Repeat Track/All/A-B loop) – timestampy natychmiast resetują się do 0:00 przy każdym powtórzeniu.',
        en: 'Discord Rich Presence & track looping: fixed playback progress bar getting stuck at track end (e.g. 1:48 / 1:48) when repeat is enabled (Repeat Track/All/A-B loop) – timestamps now reset immediately to 0:00 on each iteration.',
        de: 'Discord Rich Presence & Titel-Wiederholung: Behebung des Einfrierens der Fortschrittsleiste am Titelende (z. B. 1:48 / 1:48) im Wiederholungsmodus (Repeat Track/All/A-B loop) – Zeitstempel werden bei jedem Umlauf sofort auf 0:00 zurückgesetzt.',
        fi: 'Discord Rich Presence & kappaleen toisto: korjattu edistymispalkin juuttuminen kappaleen loppuun (esim. 1:48 / 1:48) toistotilassa (Repeat Track/All/A-B loop) – aikaleimat nollautuvat välittömästi arvoon 0:00 jokaisella kierroksella.',
        la: 'Discord Rich Presence & carminis iteratio: sublatus haesitus indicis progressus in fine carminis (e.g. 1:48 / 1:48) in modo iterandi – tempora statim ad 0:00 in quoque circulo rediguntur.',
      },
      {
        pl: 'Auralune Recap (Wrapped): usunięto błędy formatowania NaN min w łącznym czasie odsłuchu, poprawiono sortowanie najpopularniejszych utworów i wykonawców oraz zlikwidowano puste etykiety odtworzeń.',
        en: 'Auralune Recap (Wrapped): fixed NaN min formatting in total listening time, corrected sorting queries for top tracks and artists, and eliminated blank play count labels.',
        de: 'Auralune Recap (Wrapped): Behebung von NaN min-Formatierungsfehlern bei der gesamten Hörzeit, korrigierte Sortierabfragen für Top-Titel und -Künstler sowie Beseitigung leerer Wiedergabezähler.',
        fi: 'Auralune Recap (Wrapped): korjattu NaN min -muotoiluvirheet kokonaiskuunteluajassa, korjattu suosituimpien kappaleiden ja artistien lajittelukyselyt ja poistettu tyhjät toistolaskurit.',
        la: 'Auralune Recap (Wrapped): sublatus error formae NaN min in tempore auditionis totali, emendatae quaestiones ordinandi carminum et artificum summorum ac vacuae notae numerationis.',
      },
    ],
  },
  {
    version: '0.7.3',
    codename: 'SoundCloud & Playlist Harvester',
    date: '2026-10-31',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Filtry jakości i wyboru bitratu audio: precyzyjne profile FFmpeg dla MP3 (320 kbps CBR Studio, 256k, 192k, V0 VBR), OPUS (160 kbps Studio, 128k, 96k) oraz M4A/AAC (256 kbps iTunes Plus, 192k, 128k) z zachowaniem bezstratnego bit-perfect FLAC.',
        en: 'Audio quality & bitrate filters: accurate FFmpeg encoding profiles for MP3 (320 kbps CBR Studio, 256k, 192k, V0 VBR), OPUS (160 kbps Studio, 128k, 96k) and M4A/AAC (256 kbps iTunes Plus, 192k, 128k) alongside lossless bit-perfect FLAC.',
        de: 'Audio-Qualitäts- und Bitratenfilter: präzise FFmpeg-Codierungsprofile für MP3 (320 kbps CBR, 256k, 192k, V0 VBR), OPUS (160k, 128k, 96k) und M4A/AAC (256k, 192k, 128k) neben verlustfreiem Bit-Perfect-FLAC.',
        fi: 'Äänenlaatu- ja bittinopeussuodattimet: tarkat FFmpeg-koodausprofiilit MP3:lle (320 kbps CBR, 256k, 192k, V0 VBR), OPUS:lle (160k, 128k, 96k) ja M4A/AAC:lle (256k, 192k, 128k) häviöttömän FLAC:n rinnalla.',
        la: 'Filtra qualitatis et velocitatis bitorum: moduli accurati FFmpeg pro MP3 (320 kbps CBR, 256k, 192k, V0 VBR), OPUS (160k, 128k, 96k) et M4A/AAC (256k, 192k, 128k) cum FLAC sine detrimento.',
      },
      {
        pl: 'Pobieranie całych playlist, albumów i kanałów SoundCloud: przełącznik zbiorczego pobierania (--yes-playlist), opcjonalny limit utworów (5..100 lub bez limitu) oraz organizacja folderów w stylu foobar2000 (podkatalogi playlisty lub hierarchia Wykonawca/Album).',
        en: 'Download full playlists, albums & SoundCloud channels: batch harvesting toggle (--yes-playlist), optional track download limit (5..100 or unlimited) and foobar2000-style folder hierarchy (playlist subfolders or Artist/Album tree).',
        de: 'Herunterladen ganzer Playlists, Alben und SoundCloud-Kanäle: Stapel-Harvesting-Schalter (--yes-playlist), optionales Download-Limit (5..100 oder unbegrenzt) und Ordnerhierarchien im foobar2000-Stil.',
        fi: 'Koko soittolistojen, albumien ja SoundCloud-kanavien lataus: erälatauskytkin (--yes-playlist), valinnainen kappalerajoitus (5..100 tai rajaton) ja foobar2000-tyylinen kansiorakenne.',
        la: 'Collectio integra indicum, carminum et canalium SoundCloud: electio conlectionis integrae (--yes-playlist), limes carminum optivus et ordinatio loculorum more foobar2000.',
      },
      {
        pl: 'Widok przeglądu pobranej playlisty (Multi-track Review): podsumowanie pobranych utworów z czasami trwania, formatem, przyciskami „Odtwórz wszystkie”, „Dodaj wszystkie do kolejki” oraz kontrolkami per utwór.',
        en: 'Multi-track playlist review view: summary of downloaded tracks with durations, format badges, “Play all”, “Queue all” buttons, and individual track playback controls.',
        de: 'Multi-Track-Playlist-Übersicht: Zusammenfassung der heruntergeladenen Titel mit Dauer, Format-Badges, „Alle abspielen“, „Alle einreihen“ und Einzelsteuerelementen.',
        fi: 'Moniraitainen soittolistan esikatselunäkymä: ladattujen raitojen yhteenveto kestoineen, formaattimerkkeineen, ”Toista kaikki”-, ”Lisää kaikki jonoon” -painikkeineen.',
        la: 'Conspectus plurium carminum collectis: compendium carminum cum temporibus, insigne formae, globulis „Canta omnia”, „Adde omnia ad ordinem” et moderationibus singularibus.',
      },
    ],
    fixed: [
      {
        pl: 'Obsługa kodu 101 yt-dlp (MaxDownloadsReached) jako kontrolowanego sukcesu przy zadanym limicie oraz odporne rekurencyjne wykrywanie i indeksowanie nowych plików w SQLite.',
        en: 'Handled yt-dlp exit code 101 (MaxDownloadsReached) as clean success when download limit is set, with resilient recursive file discovery and SQLite indexing.',
        de: 'Handhabung des yt-dlp-Exit-Codes 101 (MaxDownloadsReached) als sauberer Erfolg bei Download-Limits sowie robuste rekursive Dateierkennung und SQLite-Indizierung.',
        fi: 'Käsitelty yt-dlp-koodi 101 (MaxDownloadsReached) onnistuneena tuloksena latausrajaa käytettäessä sekä varmistettu rekursiivinen tiedostojen tunnistus ja SQLite-indisointi.',
        la: 'Tractatus indicis 101 yt-dlp (MaxDownloadsReached) ut felix successus et detectio recursiva fidelis cum indice SQLite.',
      },
    ],
  },
  {
    version: '0.7.2',
    codename: 'Stream Harvester & Precision Playback',
    date: '2026-10-31',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Wbudowany legalny importer audio z URL (yt-dlp): wklejanie linków z YouTube, SoundCloud, Bandcamp itp., automatyczne wyodrębnianie dźwięku (FLAC/MP3/OPUS) z osadzoną okładką i tagami oraz natychmiastowe zindeksowanie w bibliotece.',
        en: 'Built-in URL Audio Importer (yt-dlp): paste links from YouTube, SoundCloud, Bandcamp, extract audio (FLAC/MP3/OPUS) with embedded thumbnail and metadata, and immediately index into library.',
        de: 'Integrierter URL-Audio-Importer (yt-dlp): Links von YouTube, SoundCloud, Bandcamp einfügen, Audio (FLAC/MP3/OPUS) mit Cover und Tags extrahieren und sofort in die Bibliothek indizieren.',
        fi: 'Sisäänrakennettu URL-äänituoja (yt-dlp): liitä linkkejä YouTubesta, SoundCloudista jne., pura ääni (FLAC/MP3/OPUS) kansikuvalla ja tunnisteilla suoraan kirjastoon.',
        la: 'Invector sonorum ex URL (yt-dlp): nexus ex YouTube vel SoundCloud imponere, sonos (FLAC/MP3/OPUS) cum imagine extrahere et statim in bibliothecam indicare.',
      },
      {
        pl: 'Przełącznik „Stop After Current Track” (Zatrzymaj po bieżącym utworze): klasyk z foobar2000 zatrzymujący potok audio po dojściu do końca obecnego utworu — dostępny na dolnym docku, w nagłówku kolejki i w palecie komend (Ctrl+K).',
        en: '“Stop After Current Track” toggle: classic foobar2000 feature stopping audio playback cleanly when the current track finishes — available in bottom bar, queue header, and Command Palette (Ctrl+K).',
        de: '„Nach aktuellem Titel anhalten“-Umschalter: foobar2000-Klassiker zum sauberen Stoppen der Wiedergabe nach dem aktuellen Titel — verfügbar in der unteren Leiste, Warteschlange und Befehlspalette.',
        fi: '”Pysäytä nykyisen kappaleen jälkeen” -kytkin: foobar2000-klassikko, joka pysäyttää toiston siististi nykyisen raidan päättyessä — saatavilla alapalkissa, jonossa ja komentovalikossa.',
        la: 'Optio „Siste post carmen currens”: foobar2000 classicus qui sonum finite carmine currente sistit — in tabula ima, ordine et indice mandatorum prompta.',
      },
    ],
    fixed: [
      {
        pl: 'Automatyczne resetowanie flagi zatrzymania po dojściu do końca strumienia (EOS) i pełna synchronizacja stanu we wszystkich kontrolkach UI.',
        en: 'Automatic reset of stop-after-current flag upon reaching EOS and robust state synchronization across all UI player controls.',
        de: 'Automatisches Zurücksetzen des Anhalte-Flags bei EOS und vollständige Statussynchronisation in allen UI-Bedienelementen.',
        fi: 'Pysäytyslipun automaattinen nollaus EOS-tapahtumassa ja luotettava tilan synkronointi kaikissa käyttöliittymän säätimissä.',
        la: 'Reinitializatio automatica indicis sistendi in fine fluxus (EOS) et synchronizatio fidelis status in omnibus moderatoribus.',
      },
    ],
  },
  {
    version: '0.7.1',
    codename: 'Gothic Embers & Loop Integrity',
    date: '2026-10-31',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Anulowanie nakładki Drag & Drop: przycisk zamknięcia, obsługa klawisza Escape oraz kliknięcie w tło nakładki upuszczania plików.',
        en: 'Cancelable Drag & Drop overlay: dedicated close button, Escape key support, and backdrop click dismiss.',
        de: 'Abbrechbares Drag & Drop-Overlay: Eigener Schließen-Button, Escape-Taste und Klick auf den Hintergrund zum Schließen.',
        fi: 'Peruutettava vedä ja pudota -peittokuva: sulkemispainike, Escape-näppäintuki ja taustan napsautuksella sulkeminen.',
        la: 'Superpositio trahendi cancellabilis: clavis clausurae, subsidium clavis Escape et ictus in fundamentum.',
      },
      {
        pl: 'Czytelne nazwy stacji Anime Radio: odtwarzacz i zakładka Now Playing prezentują właściwą nazwę wybranej stacji oraz czyste metadane na żywo zamiast technicznych hashy strumieni.',
        en: 'Readable Anime Radio station names: the player and Now Playing view display the friendly station title and clean live tags instead of raw stream mount hashes.',
        de: 'Lesbare Anime-Radio-Stationstitel: Player und Now-Playing-Ansicht zeigen den Sendernamen und saubere Live-Tags statt technischer Stream-Hashes.',
        fi: 'Selkeät Anime Radio -asemien nimet: soitin ja Now Playing -näkymä näyttävät aseman nimen ja puhtaat livetiedot teknisten tiivisteiden sijaan.',
        la: 'Nomina perspicua stationum radiophonicarum Anime: lusor et prospectus praesens titulum stationis et notas mundas demonstrant.',
      },
    ],
    fixed: [
      {
        pl: 'Poprawka zapętlania utworów (Repeat Track): wyeliminowano problem cichego przelotu paska po zakończeniu utworu poprzez reset flagi EOS w pipeline GStreamer.',
        en: 'Repeat Track fix: resolved silent playback pass after track completion by properly resetting EOS in GStreamer sinks via State::Null transition.',
        de: 'Repeat Track-Fehlerbehebung: Stumme Wiedergabe nach Trackende behoben durch korrektes EOS-Zurücksetzen in GStreamer-Sinks.',
        fi: 'Kappaleen toiston (Repeat Track) korjaus: hiljainen toistokerta raidan päätyttyä korjattu nollaamalla EOS GStreamer-nieluissa.',
        la: 'Emendatio circuli cantus (Repeat Track): silentium post finem cantus deletum per restitutionem signi EOS in receptaculo GStreamer.',
      },
      {
        pl: 'Ochrona kolejki użytkowniczki: klikanie utworów w bibliotece ani upuszczanie folderów nie nadpisuje już manualnej kolejki odtwarzania.',
        en: 'Queue preservation: clicking library tracks or dropping folders no longer overwrites or auto-populates the manual playback queue.',
        de: 'Warteschlangen-Schutz: Das Anklicken von Bibliothekstiteln oder Ablegen von Ordnern überschreibt die manuelle Playlist-Warteschlange nicht mehr.',
        fi: 'Jonon suojaus: kirjastoraitojen napsauttaminen tai kansioiden pudottaminen ei enää korvaa käyttäjän manuaalista toistojonoa.',
        la: 'Tuitio seriei canendi: ictus in cantus bibliothecae vel demissio scriniorum seriem manualem non iam delet.',
      },
      {
        pl: 'Zliczanie odtworzeń i statystyk: zliczanie odsłuchań rejestruje się poprawnie przy zapętleniach Repeat Track oraz dla krótkich utworów (<15 s).',
        en: 'Play counts and recap stats: listening counts and time accurately record on Repeat Track loop iterations and for short tracks (<15s).',
        de: 'Wiedergabezählung und Statistiken: Hörzeiten und Zähler werden bei Repeat-Track-Schleifen und kurzen Tracks (<15s) präzise erfasst.',
        fi: 'Toistokertojen ja tilastojen laskenta: kuuntelukerrat tallentuvat oikein toistosilmukoissa sekä lyhyillä kappaleilla (<15s).',
        la: 'Numeratio cantuum et rationes: auditus accurate computantur in circulis et cantibus brevibus (<15s).',
      },
      {
        pl: 'Koegzystencja Discord Rich Presence z grami: usunięto cykliczny spam ramkami SET_ACTIVITY co 15 sekund, dzięki czemu Discord nie kasuje statusu aktywnej gry.',
        en: 'Discord Rich Presence game coexistence: stopped redundant SET_ACTIVITY frames from wiping active game presences (e.g. Corpse Factory) every 15 seconds.',
        de: 'Discord RPC-Koexistenz mit Spielen: Redundanter SET_ACTIVITY-Spam alle 15 Sekunden entfernt, damit Discord aktive Spiele nicht überschreibt.',
        fi: 'Discord RPC ja pelitila: estetty ylimääräiset SET_ACTIVITY-lähetykset 15 sekunnin välein, jotta Discord ei pyyhi aktiivista pelitilaa.',
        la: 'Coexistentia Discord RPC cum ludis: transmissio supervacua SET_ACTIVITY sublata ne status ludi deleatur.',
      },
      {
        pl: 'Eliminacja fałszywego okna dropu przy wewnętrznym przeciąganiu: przeciąganie elementów wewnątrz aplikacji nie wyświetla już pełnoekranowej nakładki.',
        en: 'Ignored internal element drags: reordering queue or dragging inside the UI no longer triggers the full-screen file drop overlay.',
        de: 'Internes Ziehen von UI-Elementen gefiltert: Das Umsortieren der Queue löst kein Vollbild-Drop-Overlay mehr aus.',
        fi: 'Sisäisen raahauksen korjaus: elementtien siirtely käyttöliittymässä ei enää aktivoi koko ruudun tiedostopudotusnäyttöä.',
        la: 'Filtratio tractus interni: motus elementorum intra applicationem superimpositionem demittendi non iam excitat.',
      },
      {
        pl: 'Stabilność skanowania biblioteki: asynchroniczne komendy Tauri oraz 15-sekundowy busy_timeout w SQLite eliminują zawieszanie się programu (Not Responding).',
        en: 'Library scanner stability: native async Tauri commands and a 15-second SQLite busy timeout eliminate application freezes (Not Responding).',
        de: 'Stabilität des Bibliotheksscanners: Native asynchrone Tauri-Befehle und 15s SQLite busy_timeout verhindern Einfrieren (Not Responding).',
        fi: 'Kirjastoskannerin vakaus: natiivit asynkroniset Tauri-komennot ja 15s SQLite-aikakatkaisu estävät sovelluksen jäätymisen (Not Responding).',
        la: 'Firmitas scrutatoris bibliothecae: mandata nativa asynchrona et mora 15s SQLite impediunt applicationem ne deficiat.',
      },
    ],
  },
  {
    version: '0.7.0',
    codename: 'Gothic Embers & Verehrt 1999',
    date: '2026-10-31',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Nowy motyw Gothic 1999 (In Extremo): mroczna, gotycka estetyka ery Verehrt und Angespien z kutej stali, obsydianu, karmazynowej krwi i żaru pochodni.',
        en: 'New Gothic 1999 (In Extremo) theme: dark medieval gothic rock aesthetic from the Verehrt und Angespien era with forged steel, obsidian, crimson blood, and torchlight.',
        de: 'Neues Theme Gothic 1999 (In Extremo): Dunkle mittelalterliche Gothic-Rock-Ästhetik der Verehrt und Angespien-Ära mit geschmiedetem Stahl, Obsidian und Fackellicht.',
        fi: 'Uusi Gothic 1999 (In Extremo) -teema: tumma keskiaikainen goottilainen estetiikka taotulla teräksellä, obsidiaanilla ja soihdun loisteella.',
        la: 'Novus modus Gothic 1999 (In Extremo): obscuritas medii aevi cum ferro fabricato, obsidiano et igne facis.',
      },
      {
        pl: 'Efekt otoczenia Płonące Iskry / Embers 🔥: wznoszące się w górę, pulsujące żarem iskry ognia z pochodni i paleniska z subtelnym znoszeniem przez wiatr.',
        en: 'Burning Embers Ambience FX 🔥: rising, pulsing sparks from torch fire and fortress hearths with gentle atmospheric wind drift.',
        de: 'Glut & Funken Ambiente-Effekt 🔥: Aufsteigende, glühende Fackelfunken und Kaminfeuer mit sanftem Winddrift.',
        fi: 'Palavat Kipinät -ympäristöefekti 🔥: nousevat, hehkuvat soihdun kipinät ja tulisijan hehku hienovaraisella tuulella.',
        la: 'Effectus Scintillarum Ignis 🔥: scintillae ardentes sursum ascendentes ex facibus et fornace castelli.',
      },
      {
        pl: 'Responsywny układ biblioteki albumów (Siatka / Lista): elastyczny rozmiar kafelków (S/M/L), kompaktowy widok listy, filtrowanie okładek i sortowanie wg czasu trwania.',
        en: 'Responsive Album Library Layout (Grid / List): adjustable tile sizing (S/M/L), compact list view, cover status filter, and duration/track count sorting.',
        de: 'Responsives Album-Layout (Gitter / Liste): Wählbare Kachelgrößen (S/M/L), kompakte Listenansicht, Cover-Filter und Sortierung nach Spieldauer.',
        fi: 'Responsiivinen albumikirjaston asettelu (Ruudukko / Lista): säädettävä laattakoko (S/M/L), kompakti listanäkymä, kansisuodatin ja keston mukaan lajittelu.',
        la: 'Dispositio tabularum alborum: scala tessellarum (S/M/L), prospectus indicis compactus, spargens teguminum et ordo secundum tempus.',
      },
      {
        pl: 'Sterowanie buforem audio i DSP: manualna konfiguracja bufora PipeWire (10–250 ms) oraz rozmiaru bloku DSP (256–8192 próbek) z przyciskiem przywracania wartości domyślnych.',
        en: 'Audio Buffer & DSP Block Controls: manual tuning of PipeWire output buffer (10–250 ms) and DSP block size (256–8192 samples) with 1-click restore default values.',
        de: 'Audio-Puffer- und DSP-Block-Steuerung: Manuelle Einstellung des PipeWire-Puffers (10–250 ms) und der DSP-Blockgröße mit Standard-Rücksetztaste.',
        fi: 'Äänipuskurin ja DSP-lohkon säätö: PipeWire-lähtöpuskurin (10–250 ms) ja DSP-lohkon manuaalinen viritys oletusten palautuspainikkeella.',
        la: 'Gubernacula receptaculi soni et DSP: regulatio manualis receptaculi PipeWire et magnitudinis DSP cum clavi ad statum primum.',
      },
      {
        pl: 'Usprawniony dolny pasek odtwarzacza: dedykowane przyciski Shuffle i Loop oraz 1-klikowy przełącznik silnika DSP z podręcznym menu wyboru.',
        en: 'Enhanced Bottom Player Bar: dedicated Shuffle and Loop buttons plus a 1-click split-button DSP engine switcher with contextual popover menu.',
        de: 'Erweiterte untere Player-Leiste: Eigene Shuffle- und Loop-Tasten sowie 1-Klick-DSP-Engine-Umschalter mit Kontextmenü.',
        fi: 'Uudistettu alatoistopalkki: omat Shuffle- ja Loop-painikkeet sekä yhden klikkauksen DSP-moottorin valitsin ponnahdusvalikolla.',
        la: 'Barra cantus inferior aucta: claves dedicatae aleae et circuli, cum electore machinae DSP uno ictu.',
      },
      {
        pl: 'Wsparcie arkuszy CUE Sheet (.cue): odtwarzanie pojedynczych utworów ze scalonych plików dźwiękowych oraz dodawanie ścieżek CUE do kolejki.',
        en: 'CUE Sheet Support (.cue): split track navigation from single-file album containers and seamless queuing of cue indices.',
        de: 'CUE-Sheet-Unterstützung (.cue): Einzeltrack-Wiedergabe aus großen Audiodateicontainern und Einreihung in die Playlist-Warteschlange.',
        fi: 'CUE-arkkituki (.cue): yksittäisten raitojen toisto yhtenäisistä äänitiedostoista ja lisäys toistojonoon.',
        la: 'Subsidium chartarum CUE (.cue): cantus singuli ex archivo composito et additio ad seriem canendi.',
      },
      {
        pl: 'Pływające powiadomienie głośności (Volume OSD): centralny wskaźnik poziomu dźwięku pojawiający się przy regulacji kółkiem myszy i klawiaturą.',
        en: 'Volume HUD Overlay (Volume OSD): floating center-screen volume badge appearing during scrollwheel and key shortcuts adjustments.',
        de: 'Schwebendes Lautstärke-OSD: Elegante Anzeige in Bildschirmmitte bei Lautstärkeänderung per Mausrad oder Tastenkürzel.',
        fi: 'Kelluva äänenvoimakkuuden OSD: ruudun keskelle ilmestyvä mittari hiiren rullalla ja pikanäppäimillä säädettäessä.',
        la: 'Index voluminis fluctuans: index visualis in medio scrinio appariens cum rota muris vel clavi movetur.',
      },
    ],
    fixed: [
      {
        pl: 'Wyeliminowano problem z gigantycznymi kartami albumów przy szerokich oknach dzięki zastosowaniu siatki z limitem maxWidth i auto-fill.',
        en: 'Resolved giant album card stretching on wide displays by adopting auto-fill grid columns with strict max tile width constraints.',
        de: 'Problem mit übergroßen Album-Kacheln auf breiten Bildschirmen durch Auto-Fill-Gitter mit Maximalbreite behoben.',
        fi: 'Korjattu jättimäisten albumikorttien venyminen leveillä näytöillä käyttämällä auto-fill-ruudukkoa enimmäisleveydellä.',
        la: 'Emendatum nimium spatium tabularum in latis scriniis per craticulam cum limite maximo.',
      },
      {
        pl: 'Uporządkowano nagłówek odtwarzacza, przenosząc rozbudowane manifesty i opisy techniczne do dedykowanej sekcji O aplikacji (About).',
        en: 'Cleaned up the top-left player header, moving extensive project manifests and technical credits to a dedicated About settings tab.',
        de: 'Oberen Player-Header aufgeräumt und ausführliche Projektbeschreibungen in den dedizierten Info-Reiter (About) verschoben.',
        fi: 'Siistitty soittimen yläpalkki ja siirretty laajat projektikuvaukset ja tiedot omaan Tietoja-välilehteen (About).',
        la: 'Caput superius cantoris expolitum et longae descriptiones ad tabulam De Auralune translatae.',
      },
    ],
  },
  {
    version: '0.6.0',
    codename: 'foobar2000 Power Tools & Kitsune Facets',
    date: '2026-10-25',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Transliteracja Romaji tekstów japońskich (Hepburn Romanization): silnik Hiragana/Katakana z digrafami Youon, podwajaniem sokuon, choonpu i trybem dwuwiersza karaoke (JOYSOUND/DAM).',
        en: 'Romaji Lyrics Transliteration (Hepburn Romanization): Hiragana/Katakana engine with Youon digraphs, sokuon doubling, choonpu, and dual karaoke display mode (JOYSOUND/DAM style).',
        de: 'Romaji-Songtext-Umschrift (Hepburn): Hiragana/Katakana-Engine mit Youon-Digraphen, Sokuon-Verdopplung, Choonpu und Karaoke-Dual-Modus.',
        fi: 'Romaji-sanoituslatinisointi (Hepburn): Hiragana/Katakana-moottori Youon-digrafeilla, sokuon-kahdennuksella, choonpulla ja kaksoisrivisellä karaoke-tilalla.',
        la: 'Translatio Romaji versuum (Hepburniana): machina Hiragana/Katakana cum digraphis Youon, geminatione sokuon et modo versuum bilineari karaoke.',
      },
      {
        pl: 'Pływający pasek tekstu na pulpicie (Desktop Lyrics Overlay): półprzezroczysty, przesuwalny widżet karaoke z podglądem nadchodzącego wersu, przełącznikiem Romaji i kontrolkami.',
        en: 'Floating Desktop Lyrics Overlay: draggable glass karaoke HUD bar with upcoming line preview, Romaji toggle, and compact playback controls.',
        de: 'Schwebendes Desktop-Songtext-Overlay: verschiebbares Glas-Karaoke-Widget mit Zeilenvorschau, Romaji-Umschaltung und Audiosteuerung.',
        fi: 'Kelluva työpöydän sanoitusleiju: siirrettävä lasinen karaoke-palkki seuraavan säkeen esikatselulla, Romaji-valinnalla ja toistosäätimillä.',
        la: 'Instrumentum versuum fluctuans: tabula vitrea karaoke motabilis cum praevisu versus insequentis, Romaji optione et clavibus cantus.',
      },
      {
        pl: 'Tryb Wirującego Winylu i Retro Kasety Magnetofonowej w BigScreenView: realistyczna płyta LP z metalicznym ramieniem gramofonu oraz kaseta magnetofonowa z lat 90. z kręcącymi się szpulami.',
        en: 'Spinning Vinyl LP & Retro Cassette Visualizer in BigScreenView: realistic grooved vinyl record with moving tonearm, plus authentic 90s audio cassette with rotating tape spools.',
        de: 'Vinyl-Schallplatte & Retro-Kassette im BigScreenView: authentische LP mit Tonarm sowie 90er-Jahre-Kassette mit rotierenden Spulen und dynamischem Magnetband.',
        fi: 'Pyörivä vinyylilevy ja retro-kasetti BigScreenViewssä: aito uritettu vinyyli äänivarrella sekä 90-luvun C-kasetti pyörivillä keloilla ja magneettinauhalla.',
        la: 'Discus Vinyleus et Capsula Retronica in BigScreenView: discus canorus cum brachio gramophoni et capsula magnetica saeculi XX cum rotulis vertentibus.',
      },
      {
        pl: 'Bauer Crossfeed dla słuchawek (bs2b): wirtualizacja akustyki głośników stereo redukująca zmęczenie uszu (presety Default 30°/3m, Chu Moy, Jan Meier Corda oraz Custom).',
        en: 'Bauer Headphone Crossfeed (bs2b): binaural speaker virtualization reducing ear fatigue on hard-panned stereo recordings (Default 30°/3m, Chu Moy, Jan Meier Corda, and Custom presets).',
        de: 'Bauer Kopfhörer-Crossfeed (bs2b): Binaurale Lautsprecher-Simulation zur Reduzierung von Hörermüdung (Standard 30°/3m, Chu Moy, Jan Meier Corda und benutzerdefinierte Voreinstellungen).',
        fi: 'Bauer-kuulokeristisyöttö (bs2b): virtuaalikaiutinsimulaatio vähentää korvien väsymistä (Oletus 30°/3m, Chu Moy, Jan Meier Corda ja mukautetut esiasetukset).',
        la: 'Transmissio aurium Bauer (bs2b): simulatio soni loquentis ad lassitudinem minuendam (modi Consuetum 30°/3m, Chu Moy, Jan Meier Corda et Proprium).',
      },
      {
        pl: 'Automatyczne pomijanie ciszy (Silence Trimming): płynne przeskakiwanie cichych przerw i intencji bezdźwięcznych poniżej konfigurowalnego progu dBFS.',
        en: 'Automatic Silence Trimming: instant seamless skip over silent intros, outros, and excessive gaps below configurable dBFS threshold.',
        de: 'Automatische Stillekürzung: Nahtloses Überspringen stummer Intros, Outros und langer Pausen unterhalb des konfigurierten dBFS-Schwellenwerts.',
        fi: 'Automaattinen hiljaisuuden ohitus: ohittaa saumattomasti hiljaiset alku- ja loppuosiot sekä pitkät tauot säädettävän dBFS-kynnyksen alapuolella.',
        la: 'Praeteritio silentii automatica: statim praeterire silentia initio et fine cantuum sub limite dBFS definito.',
      },
      {
        pl: 'Inteligentny ReplayGain (Smart Gain): tryb Auto samoczynnie dobierający Album Gain dla spójnych albumów lub Track Gain dla trybu losowego i miksów, z suwakiem Fallback Gain.',
        en: 'Smart ReplayGain (Auto Track/Album Gain): dynamically selects Album Gain for sequential albums or Track Gain for shuffle/mixes, with untagged Fallback Gain slider.',
        de: 'Intelligenter ReplayGain: Wählt dynamisch Album-Verstärkung für sequentielle Alben oder Titel-Verstärkung für Shuffle/Mixe, inklusive Fallback-Verstärkung.',
        fi: 'Älykäs ReplayGain: valitsee automaattisesti albumivahvistuksen peräkkäisille albumeille tai kappalevahvistuksen sekoitustilalle, mukana oletusvahvistus.',
        la: 'ReplayGain callidus: sponte eligit ganiam albi pro cantibus continuis aut ganiam tractus pro modo fortuito, cum amplificatione defectus.',
      },
      {
        pl: 'Oficjalne scrobblowanie do Last.fm (Last.fm 2.0 API): autoryzacja sesji w przeglądarce, status Teraz Odtwarzane, scrobblowanie po 50% czasu utworu i wsparcie własnych kluczy API.',
        en: 'Official Last.fm 2.0 Scrobbler: web browser authentication, Now Playing status, scrobbling after 50% playtime, and custom API key support.',
        de: 'Offizieller Last.fm 2.0 Scrobbler: Browser-Authentifizierung, Jetzt-Spielen-Status, Scrobbeln nach 50% Spielzeit und benutzerdefinierte API-Schlüssel.',
        fi: 'Virallinen Last.fm 2.0 Scrobbler: selaintunnistautuminen, Nyt toistetaan -tila, scrobblaus 50% soittoajan jälkeen ja omien API-avainten tuki.',
        la: 'Scrobblator Last.fm 2.0 officialis: auctoritas per navigatrum, status cantus currentis, scrobblatio post dimidium temporis et claves API propriae.',
      },
      {
        pl: 'Wielopunktowe znaczniki CUE / Bookmarks: dodawanie nazwanych punktów w czasie odtwarzania, edycja i diamentowe markery na osi czasu z szybkim skokiem.',
        en: 'Multi-point Track Bookmarks / Cue Points: add named cue points during playback, inline editing, and clickable diamond timeline markers.',
        de: 'Mehrpunkt-Lesezeichen & Cue-Punkte: benannte Lesezeichen zur Laufzeit hinzufügen, Inline-Bearbeitung und anklickbare Diamant-Marker auf der Zeitleiste.',
        fi: 'Monipisteiset kirjanmerkit ja Cue-pisteet: lisää nimettyjä pisteitä toiston aikana ja hyppää niihin aikajanan timanttimerkeistä.',
        la: 'Multi-notae et puncta CUE: notare tempora cantus, nomina mutare et per diamantes in linea temporis saltare.',
      },
      {
        pl: 'Masowy Auto-Renamer / Organizator plików: zmiana nazw i ścieżek na dysku według wzorców tagów (%track%, %artist%, %album%, %title%) z podglądem na żywo i aktualizacją bazy.',
        en: 'Batch Auto-Renamer & File Organizer: tag-based file renaming and folder reorganization (%track%, %artist%, %album%, %title%) with live preview and DB synchronization.',
        de: 'Massen-Dateiumbenennung & Datei-Organisator: Tag-basierte Dateimuster (%track%, %artist%, %album%, %title%) mit Live-Vorschau und Datenbank-Aktualisierung.',
        fi: 'Massan nimeäjä ja tiedostojen järjestäjä: tunnistepohjainen nimeäminen (%track%, %artist%, %album%, %title%) esikatselulla ja tietokannan päivityksellä.',
        la: 'Ordinator et mutator nominum fasciculorum: formare nomina secundum notas (%track%, %artist%, %album%, %title%) cum praevisu et renovatione tabularii.',
      },
      {
        pl: 'Panel filtrów fasetowych (Facets): 3-kolumnowe błyskawiczne filtrowanie biblioteki [Format -> Artysta -> Album] w stylu Columns UI foobar2000.',
        en: 'Facets Filter Pane: 3-column instant library browsing [Format -> Artist -> Album] in foobar2000 Columns UI style.',
        de: 'Facetten-Filterleiste: 3-Spalten-Sofortfilterung der Musiksammlung [Format -> Interpret -> Album] im Stil von foobar2000.',
        fi: 'Fasettisuodatin: 3-sarakkeinen kirjaston selaus [Muoto -> Esittäjä -> Albumi] foobar2000:n Columns UI -tyyliin.',
        la: 'Tabula colatorum fasetarum: triplex ordo [Forma -> Cantator -> Album] ad musicam celeriter inveniendam.',
      },
      {
        pl: 'Wyszukiwarka duplikatów audio: wykrywanie zdublowanych utworów, porównywanie bitrate/sample rate i bezpieczne usuwanie z dysku lub biblioteki.',
        en: 'Audio Duplicate Finder: detects identical songs across formats, compares bitrate/sample rate, and safely removes files from disk or library.',
        de: 'Audio-Duplikat-Finder: erkennt identische Titel über Formate hinweg, vergleicht Bitrate/Samplerate und entfernt Dateien sicher.',
        fi: 'Äänikappaleiden kaksoiskappaleiden etsijä: tunnistaa tuplat, vertaa äänenlaatua ja poistaa tiedostot turvallisesti.',
        la: 'Repertorium cantuum duplicium: geminatos cantus invenire, qualitatem conferre et de disco vel bibliotheca delere.',
      },
      {
        pl: 'Eksport i transkodowanie pętli A-B z DSP: zapis zaznaczonego fragmentu utworu do formatów FLAC, MP3, OGG lub WAV z uwzględnieniem pitch/tempo.',
        en: 'A-B Loop Export & Transcoding with DSP: export loop selections to FLAC, MP3, OGG, or WAV while preserving pitch-shift and tempo-stretch.',
        de: 'A-B-Schleifen-Export mit DSP: Speichern von Teilstücken als FLAC, MP3, OGG oder WAV unter Beibehaltung von Pitch und Tempo.',
        fi: 'A-B-silmukan vienti ja transkoodaus DSP:llä: tallenna valittu aikaväli FLAC-, MP3-, OGG- tai WAV-tiedostona sävelkorkeus ja tempo säilyttäen.',
        la: 'Exportatio segmenti A-B cum DSP: particulam electam in FLAC, MP3, OGG aut WAV servare cum effectu soni.',
      },
    ],
    fixed: [
      {
        pl: 'Wydajność wirtualizacji listy utworów oraz optymalizacja zapytań indeksowanych w bazie SQLite.',
        en: 'Library track list rendering performance and optimized indexed queries in SQLite storage.',
        de: 'Verbesserte Rendering-Leistung der Titelliste und optimierte Indexabfragen in SQLite.',
        fi: 'Kappaleluettelon suorituskyvyn parannus ja optimoidut SQLite-indeksikyselyt.',
        la: 'Celeritas monstrandi indices cantuum aucta et quaestiones tabularii SQLite optimizatae.',
      },
    ],
  },
  {
    version: '0.5.0',
    codename: 'Velvet Discord & Kitsune Resonance',
    date: '2026-10-25',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Natywna integracja Discord Rich Presence (RPC) dla Linuksa: bezpośrednia, bezblokadowa obsługa gniazda Unix Domain Socket ($XDG_RUNTIME_DIR/discord-ipc-0..9) wspierająca oficjalnego Discorda, Vesktop, WebCord, ArmCord oraz Flatpak.',
        en: 'Native Discord Rich Presence (RPC) for Linux: direct, non-blocking Unix Domain Socket client ($XDG_RUNTIME_DIR/discord-ipc-0..9) supporting official Discord, Vesktop, WebCord, ArmCord, and Flatpak.',
        de: 'Natives Discord Rich Presence (RPC) für Linux: direkter, sperrenfreier Unix-Domain-Socket-Client mit Unterstützung für offizielles Discord, Vesktop, WebCord, ArmCord und Flatpak.',
        fi: 'Natiivi Discord Rich Presence (RPC) Linuxille: suora, lukkovapaa Unix Domain Socket -asiakas ($XDG_RUNTIME_DIR/discord-ipc-0..9) tukee virallista Discordia, Vesktopia, WebCordia ja Flatpakia.',
        la: 'Nativa Praesentia Dives Discord (RPC) pro Linux: cliens sine sera per Unix Domain Socket cum auxilio pro Discord, Vesktop, WebCord et Flatpak.',
      },
      {
        pl: 'Status „Słucha” (Listening) z tytułem utworu, artystą, albumem, okładką, czasem na żywo (pasek postępu) oraz przyciskiem do Auralune.',
        en: 'Listening activity with track title, artist, album, cover artwork, live progress bar, and clickable button to Auralune player.',
        de: 'Listening-Aktivität mit Tracktitel, Interpret, Album, Cover-Artwork, Live-Fortschrittsbalken und Auralune-Button.',
        fi: 'Listening-tila kappaleen nimellä, esittäjällä, albumilla, kansikuvalla, edistymispalkilla ja linkillä Auralune-soittimeen.',
        la: 'Status audientis cum titulo, cantatore, albo, imagine, cursu temporis et ligamine ad Auralune.',
      },
      {
        pl: 'Dedykowana szklana karta w Ustawieniach z neonowym wskaźnikiem połączenia na żywo, przełącznikiem i konfigurowalnym Client ID.',
        en: 'Dedicated glassmorphic card in Settings with live glowing connection indicator, toggle switch, and custom Discord Client ID.',
        de: 'Eigene Glassmorphism-Karte in den Einstellungen mit Live-Verbindungsstatus, Umschalter und konfigurierbarer Client-ID.',
        fi: 'Oma lasikortti Asetuksissa reaaliaikaisella yhteyden tilavalolla, kytkimellä ja mukautettavalla Client ID:llä.',
        la: 'Charta vitrea propria in Optionibus cum indice lucido coniunctionis, interruptore et Client ID.',
      },
    ],
    fixed: [
      {
        pl: 'Ciche wznawianie sesji IPC w tle po restarcie klienta Discord bez blokowania wątków odtwarzacza ani UI.',
        en: 'Silent background IPC session recovery on Discord client restarts without blocking audio threads or UI.',
        de: 'Geräuschlose automatische IPC-Wiederverbindung im Hintergrund ohne Blockieren von Audio-Threads oder UI.',
        fi: 'Hiljainen IPC-istunnon palautus taustalla Discord-sovelluksen käynnistyessä uudelleen ilman toiston lukittumista.',
        la: 'Recuperatio tacita IPC nexus in curriculo sine intermissione soni vel faciei programmatis.',
      },
    ],
  },
  {
    version: '0.4.0',
    codename: 'Kitsune Horizons & Poweramp Legacy',
    date: '2026-10-25',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,

    added: [
      {
        pl: 'Crate crates/downloads & Legal Download Hub: bezpieczny moduł pobierania legalnych nagrań audio (Archive.org, Creative Commons, podcasty i feedy RSS) z weryfikacją SHA-256 i atomowym zapisem do biblioteki.',
        en: 'Crate crates/downloads & Legal Download Hub: secure download manager for legal audio sources (Archive.org, Creative Commons, RSS podcasts) with SHA-256 verification and atomic library import.',
        de: 'Crate crates/downloads & Legal Download Hub: sicheres Download-Modul für legale Audioquellen mit SHA-256-Prüfung und atomarem Bibliotheksimport.',
        fi: 'Crate crates/downloads & Legal Download Hub: turvallinen lataushallinta laillisille audiolähteille SHA-256-tarkistuksella ja atomisella kirjastotuonnilla.',
        la: 'Crate crates/downloads & Legal Download Hub: modulus securus deonerandi fontium audialium legitimorum cum probatione SHA-256 et scriptione atomica in bibliothecam.',
      },
      {
        pl: 'Płynny Crossfade (krzywa equal-power cos/sin) oraz zaawansowane efekty DSP: Bass Boost (pobudzenie sub-basu 31-125 Hz), Stereo Widener (baza stereo) i True-Peak Limiter chroniący przed clippingiem.',
        en: 'Smooth Crossfade (equal-power cos/sin curve) and advanced DSP: Bass Boost (sub-bass exciter 31-125 Hz), Stereo Widener, and True-Peak Limiter protecting against digital clipping.',
        de: 'Sanfter Crossfade (Equal-Power-Kurve) und erweiterte DSP-Effekte: Bass Boost (Sub-Bass 31-125 Hz), Stereo Widener und True-Peak Limiter gegen Übersteuerung.',
        fi: 'Pehmeä Crossfade (equal-power-käyrä) ja edistyneet DSP-efektit: Bass Boost (sub-basso 31-125 Hz), Stereo Widener ja True-Peak Limiter säröytymisen estoon.',
        la: 'Crossfade mollis (curva equal-power cos/sin) et effectus provecti DSP: Bass Boost (excitator sub-bass 31-125 Hz), Stereo Widener et True-Peak Limiter contra distorsionem.',
      },
      {
        pl: 'Import i Eksport Playlist M3U / M3U8 & Kopia zapasowa profilu: pełne wsparcie standardu UTF-8 M3U8 oraz eksport/import motywów, presetów DSP i konfiguracji jako JSON.',
        en: 'M3U / M3U8 Playlist Import & Export & Profile Backup: full UTF-8 M3U8 standard support and complete JSON profile backup/restore (themes, DSP presets, playlists).',
        de: 'M3U / M3U8 Playlist-Import/-Export & Profilsicherung: vollständige UTF-8 M3U8-Unterstützung und JSON-Profil-Backup (Themes, DSP-Presets, Playlists).',
        fi: 'M3U / M3U8 -soittolistojen tuonti ja vienti sekä profiilivarmuuskopiointi: täysi UTF-8 M3U8 -tuki ja JSON-profiilin varmuuskopiointi/palautus.',
        la: 'Exportatio et importatio indicum carminum M3U/M3U8 atque conservatio profili: sustentatio UTF-8 M3U8 et conservatio/restitutio JSON profili.',
      },
      {
        pl: 'Scrobbler ListenBrainz (ekosystem MetaBrainz): oficjalna integracja REST API z automatycznym scroblowaniem odtworzeń (>50% czasu utworu) oraz statusem Playing Now.',
        en: 'ListenBrainz Scrobbler (MetaBrainz ecosystem): official REST API client with automatic scrobbling (>50% elapsed) and Playing Now status.',
        de: 'ListenBrainz-Scrobbler (MetaBrainz-Ökosystem): offizielle REST-API-Integration mit automatischem Scrobbeln (>50% gespielt) und Playing Now Status.',
        fi: 'ListenBrainz Scrobbler (MetaBrainz-ekosysteemi): virallinen REST API -integraatio automaattisella scrobbauksella (>50% toistettu) ja Playing Now -tilalla.',
        la: 'Scrobbler ListenBrainz (oeconomia MetaBrainz): integratio officialis REST API cum scrobblatione automatica (>50% audito) et statu Playing Now.',
      },
      {
        pl: 'Linux System Tray & Odtwarzanie w tle: ikona w tacce systemowej z szybkim menu sterowania oraz konfigurowalna opcja minimalizacji do zasobnika zamiast zamykania.',
        en: 'Linux System Tray & Background Playback: tray icon with quick control menu and configurable close-to-tray mode.',
        de: 'Linux System-Tray & Hintergrundwiedergabe: Taskleistensymbol mit Schnellmenü und konfigurierbarem Close-to-Tray.',
        fi: 'Linux-ilmoitusalue & taustatoisto: kuvake ilmoitusalueella pikavalikolla ja säädettävä sulkeminen ilmoitusalueelle.',
        la: 'System Tray Linux et Cantus in scaena: icon in capsa systematis cum indice mandatorum et modus minimisationis.',
      },
    ],
    fixed: [
      {
        pl: 'Eliminacja zakleszczenia (deadlock) przy uruchamianiu odtwarzania: bezblokadowe sygnały GStreamer (AtomicU8) oraz zmiana stanu potoku i mikro-fade poza blokadą mutexu.',
        en: 'Eliminated audio engine deadlock when starting playback: lock-free GStreamer notifications (AtomicU8) and non-blocking pipeline state changes outside mutex.',
        de: 'Beseitigung von Audio-Engine-Deadlocks beim Wiedergabestart: sperrenfreie GStreamer-Signale (AtomicU8) und Zustandsänderungen außerhalb des Mutex.',
        fi: 'Lukkiutumisen (deadlock) poisto toiston käynnistyksessä: lukkovapaat GStreamer-signaalit (AtomicU8) ja potkun tilamuutokset mutexin ulkopuolella.',
        la: 'Eliminatio deadlock in initio cantus: signa sine sera GStreamer (AtomicU8) et mutatio status potus extra seram mutex.',
      },
      {
        pl: 'Pojedyncze kliknięcie w kolejce odtwarzania: natychmiastowe uruchomienie utworu jednym kliknięciem zamiast wymaganego podwójnego kliknięcia.',
        en: 'Playback queue single click: clicking any track in the queue now starts playback immediately instead of requiring a double click.',
        de: 'Wiedergabewarteschlange Einzelklick: Ein Klick startet den Titel nun sofort, kein Doppelklick mehr nötig.',
        fi: 'Toistojonon kertanapsautus: kappaleen napsauttaminen jonossa aloittaa toiston välittömästi ilman tuplanapsautusta.',
        la: 'Unus ictus in ordine cantuum: pulsatio unius carminis in ordine statim cantum incipit sine duplici ictu.',
      },
      {
        pl: 'Stylowanie pól wyboru (select) odporne na jasne motywy GTK: wyłączenie natywnego widgetu GTK w WebKit, ciemne tło z akcentem i wysoki kontrast białych liter.',
        en: 'Dropdown (select) styling immune to light GTK themes: disabled native WebKit GTK widget, dark anime glassmorphism style, and high-contrast white text.',
        de: 'Dropdown-Styling (select) immun gegen helle GTK-Themes: natives WebKit GTK Widget deaktiviert, dunkles Theme mit hohem Textkontrast.',
        fi: 'Pudotusvalikoiden (select) tyylitys GTK-teemoilta suojattuna: estetty WebKit GTK -natiivityyli, tumma lasimainen teema ja selkeä valkoinen teksti.',
        la: 'Stilus capsulae selectivae immunis a thematibus claris GTK: widget nativum WebKit GTK extinctum, thema obscurum et litterae albae manifestae.',
      },
      {
        pl: 'Rozdzielenie kolumn czasu i akcji w kolejce: poszerzenie kolumny akcji do 140px, całkowicie eliminujące nakładanie się ikony Play na cyfry czasu trwania.',
        en: 'Fixed queue layout overlap: expanded actions column to 140px and adjusted padding, fully preventing Play button collision with track duration.',
        de: 'Kollision im Warteschlangen-Layout behoben: Aktionsspalte auf 140px erweitert, Play-Button überlappt die Zeitangabe nicht mehr.',
        fi: 'Korjattu toistojonon asettelu: laajennettu toimintosarake 140 pikseliin, estäen Toista-painikkeen päällekkäisyys kestoajan kanssa.',
        la: 'Reparata dispositio ordinis cantuum: columna actionum ad 140px amplificata, Play button non iam tempus carminis tegit.',
      },
      {
        pl: 'Pełne tłumaczenia Ustawień: dodanie brakujących kluczy wielojęzycznych dla sekcji ListenBrainz i Crossfade we wszystkich 5 językach.',
        en: 'Complete Settings translations: added missing i18n keys for ListenBrainz and Crossfade across all 5 supported languages.',
        de: 'Vollständige Einstellungen-Übersetzungen: fehlende i18n-Schlüssel für ListenBrainz und Crossfade in allen 5 Sprachen ergänzt.',
        fi: 'Täydelliset asetusten käännökset: lisätty puuttuvat i18n-avaimet ListenBrainzille ja Crossfadelle kaikilla 5 kielellä.',
        la: 'Translationes integrae Optionum: claves i18n pro ListenBrainz et Crossfade in omnibus 5 linguis additae.',
      },
    ],
  },
  {
    version: '0.3.0',
    codename: 'Omniscience & Starlight',
    date: '2026-10-25',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [
      {
        pl: 'Tag Editor (Properties Dialog): zaawansowane okno edycji metadanych w stylu foobar2000 z bezpośrednim zapisem tagów przez bibliotekę lofty i transakcyjną aktualizacją SQLite.',
        en: 'Tag Editor (Properties Dialog): foobar2000-style metadata properties editor with direct tag write via lofty and transactional SQLite synchronization.',
        de: 'Tag Editor (Eigenschaften-Dialog): foobar2000-artiger Metadaten-Editor mit direktem Tag-Schreiben über lofty und Transaktions-SQLite-Synchronisation.',
        fi: 'Tag Editor (Ominaisuudet-dialogi): foobar2000-tyylinen metatietojen muokkaus, suora tallennus lofty-kirjastolla ja transaktiopohjainen SQLite-päivitys.',
        la: 'Tag Editor (Dialogus Proprietatum): editor metadatorum more foobar2000 cum scriptione directa per lofty et synchronisatione transactionali SQLite.',
      },
      {
        pl: 'Parser arkuszy CUE (.cue sheet parser): obsługa wydań anime/doujin zripowanych do pojedynczego pliku audio z automatycznym podziałem na wirtualne utwory i precyzyjnym czasem startu.',
        en: 'CUE Sheet Parser: full support for anime/doujin single-file album rips with automatic track splitting, accurate millisecond offsets, and queue integration.',
        de: 'CUE-Sheet-Parser: Unterstützung für Einzeldatei-Album-Rips mit automatischer Track-Aufteilung, millisekundengenauen Offsets und Warteschlangen-Integration.',
        fi: 'CUE Sheet -jäsennin: tuki yhden tiedoston anime/doujin-albumeille automaattisella kappalejaolla ja millisekuntitarkoilla aikaleimoilla.',
        la: 'Parser schedis CUE: sustentatio albumorum uno fasciculo compactis cum partitione automatica carminum et offset accurato.',
      },
      {
        pl: 'Smart Playlists (Dynamiczne inteligentne playlisty): kolekcje generowane w czasie rzeczywistym z SQLite (Top 25, Ostatnio odtwarzane, Zapomniane perełki, Hi-Res Lossless, High BPM, Top Rated).',
        en: 'Smart Playlists: real-time dynamic collections from SQLite (Top 25 Played, Recently Played, Forgotten Gems, Hi-Res Lossless, High BPM, Top Rated).',
        de: 'Smart Playlists: dynamische Echtzeit-Sammlungen aus SQLite (Top 25 meistgespielt, Kürzlich gehört, Vergessene Perlen, Hi-Res Lossless, High BPM, Top-Bewertungen).',
        fi: 'Älykkäät soittolistat: reaaliaikaiset dynaamiset kokoelmat SQLite-tietokannasta (Top 25, Äskettäin soitetut, Unohdetut helmet, Hi-Res Lossless, High BPM, Parhaat arviot).',
        la: 'Index Carminum Callidus: collectiones dynamicae ex SQLite (Top 25, Nuper audita, Gemmae oblitae, Hi-Res Lossless, High BPM, Optime aestimata).',
      },
      {
        pl: 'Command Palette / Szybkie wyszukiwanie (Ctrl+K): panel Spotlight Omnibar do natychmiastowego przeszukiwania utworów, albumów i wywoływania komend systemowych/DSP.',
        en: 'Command Palette / Quick Omnibar (Ctrl+K): Spotlight-style command bar for instant search over tracks, albums, and executing playback/DSP actions.',
        de: 'Befehlspalette / Schnellsuchleiste (Strg+K): Spotlight-artige Omnibar zur sofortigen Suche nach Titeln, Alben und Ausführung von Wiedergabe-/DSP-Aktionen.',
        fi: 'Komentovalikko / Pikaetsintä (Ctrl+K): Spotlight-tyylinen komentopalkki kappaleiden, albumien ja DSP-toimintojen välittömään hakuun.',
        la: 'Capsula Mandatorum (Ctrl+K): tabula velocis inquisitionis carminum, albumorum et executionis mandatorum systematis vel DSP.',
      },
      {
        pl: 'Oceny gwiazdkowe (1–5 gwiazdek): interaktywny widżet oceniania utworów z natychmiastowym filtrowaniem widoku biblioteki.',
        en: 'Star Ratings (1–5 stars): interactive track rating widget with instant library filtering.',
        de: 'Sterne-Bewertungen (1–5 Sterne): interaktives Bewertungswidget mit Sofortfilter in der Bibliothek.',
        fi: 'Tähtiarviot (1–5 tähteä): interaktiivinen kappaleiden arviointityökalu välittömällä kirjastosuodatuksella.',
        la: 'Aestimatio stellaris (1–5 stellae): modulus aestimandi carmina cum filtro instantaneo bibliothecae.',
      },
      {
        pl: 'Nowe tryby AnimeAmbienceFX: Meteor Shower / Starlight (spadające gwiazdy i komety), Cyber Matrix Rain (kaskadowy deszcz katakany) oraz Momiji (jesienne liście klonu na wietrze).',
        en: 'New AnimeAmbienceFX modes: Meteor Shower / Starlight (shooting stars and comets), Cyber Matrix Rain (neon katakana rain), and Momiji (fluttering Japanese maple leaves).',
        de: 'Neue AnimeAmbienceFX-Modi: Sternschnuppenregen / Starlight, Cyber Matrix Rain (Katakana-Regen) und Momiji (japanische Ahornblätter im Wind).',
        fi: 'Uudet AnimeAmbienceFX-tilat: Tähdenlento / Starlight, Cyber Matrix Rain ja Momiji (japanilaiset vaahteranlehdet tuulessa).',
        la: 'Novi modi AnimeAmbienceFX: Pluvia Meteororum / Starlight, Cyber Matrix Rain et Momiji (folia acerna Iaponica in vento).',
      },
      {
        pl: 'Powiadomienia OSD Linuksa (libnotify / D-Bus): banery na pulpicie przy zmianie utworu w tle z okładką albumu, tytułem i wykonawcą.',
        en: 'Linux Desktop Notifications (libnotify / D-Bus): desktop banner on background track change with album cover, title, and artist.',
        de: 'Linux Desktop-Benachrichtigungen (libnotify / D-Bus): Desktop-Banner beim Titelwechsel im Hintergrund mit Album-Cover und Metadaten.',
        fi: 'Linux-työpöytäilmoitukset (libnotify / D-Bus): työpöytäilmoitus taustatoiston kappaleen vaihtuessa kansikuvan kera.',
        la: 'Notificationes OSD Linux (libnotify / D-Bus): nuntius in scrinio cum mutatione carminis in scaena cum imagine et titulo.',
      },
    ],
    fixed: [],
  },
  {
    version: '0.2.2',
    codename: 'Resonance & Flow',
    date: '2026-10-24',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
    added: [],
    fixed: [
      {
        pl: 'Eliminacja zawieszenia aplikacji przy uruchamianiu utworu z biblioteki: usunięcie zakleszczenia prerollu GStreamera, natychmiastowe drenowanie próbek DSP oraz powiększony bufor zlewu.',
        en: 'Eliminated app freeze when starting tracks from library: fixed GStreamer preroll deadlock, instant DSP buffer draining, and enlarged sink queue.',
        de: 'Beseitigung des App-Einfrierens beim Starten von Tracks aus der Bibliothek: GStreamer-Preroll-Deadlock behoben und sofortige DSP-Pufferentleerung.',
        fi: 'Sovelluksen jäätymisen poisto käynnistettäessä kappaleita kirjastosta: korjattu GStreamer-preroll-lukkiutuminen ja välitön DSP-puskurin tyhjennys.',
        la: 'Eliminatio congelationis applicationis in initio carminis e bibliotheca: extinctus deadlock preroll GStreamer et evacuatio instantanea receptaculi DSP.',
      },
      {
        pl: 'Eliminacja zacinania przy odtwarzaniu FLAC: powiększenie bufora queue_sink do 800ms oraz przetwarzanie bloków w oknach 1024 ramek (max_process_size=8192).',
        en: 'Eliminated stuttering during FLAC playback: increased queue_sink capacity to 800ms and 1024-frame chunking in Rubber Band (max_process_size=8192).',
        de: 'Beseitigung von FLAC-Rucklern: vergrößerter queue_sink (800ms) und 1024-Frame-Chunking in Rubber Band (max_process_size=8192).',
        fi: 'FLAC-toiston pätkimisen poisto: suurempi queue_sink (800ms) ja 1024-kehyksen käsittely Rubber Bandissa (max_process_size=8192).',
        la: 'Eliminatio interruptionis in FLAC: capacitas aucta queue_sink (800ms) et segmentatio 1024 framium in Rubber Band.',
      },
    ],
  },
  {
    version: '0.2.1',
    codename: 'Harmony & Precision',
    date: '2026-10-24',
    author: 'Das Letzte Kemonomimi',
    isLatest: false,
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

const LATEST_RELEASE = RELEASES.find((r) => r.isLatest) || RELEASES[0];

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
            v{LATEST_RELEASE.version} • {LATEST_RELEASE.codename}
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
