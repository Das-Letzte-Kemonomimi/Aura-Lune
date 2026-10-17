# ADR 0010: 10-pasmowy korektor graficzny (Equalizer) oraz wizualizator widma (Spectrum Analyzer)

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Wymóg rozszerzeń post-MVP zainspirowanych Powerampem i foobar2000: profesjonalny 10-pasmowy korektor graficzny (IIR Equalizer) z gotowymi presetami brzmieniowymi oraz neonowy analizator pasm częstotliwościowych czasu rzeczywistego (FFT Spectrum Visualizer) w estetyce anime, bez naruszania żelaznej zasady izolacji ścieżki audio.

---

## 1. Wybór elementów potoku GStreamer

1. **Element `equalizer-10bands` (`GstIirEqualizer10Bands`)**:
   - 10 pasm IIR o stałych częstotliwościach środkowych:
     - Band 0: 29 Hz (Sub-bass)
     - Band 1: 59 Hz (Bass)
     - Band 2: 119 Hz (Upper Bass)
     - Band 3: 237 Hz (Low Mids)
     - Band 4: 474 Hz (Mids)
     - Band 5: 947 Hz (Upper Mids)
     - Band 6: 1889 Hz (Presence)
     - Band 7: 3770 Hz (Treble)
     - Band 8: 7523 Hz (High Treble)
     - Band 9: 15011 Hz (Air)
   - Zakres wzmocnienia: od -24.0 dB do +12.0 dB na pasmo (krok 0.5 dB).
   - Płynna modyfikacja właściwości `band0`..`band9` w locie bez restartu potoku.

2. **Element `spectrum` (`GstSpectrum`)**:
   - Analiza FFT sygnału audio z interwałem 50 ms (20 Hz) dla 16 pasm częstotliwości.
   - Zdarzenia wysyłane są asynchronicznie przez pętlę komunikatów magistrali GStreamera (`gst::BusMessage`), zawierając tablicę magnitud w dB.
   - **Żelazna zasada nienaruszona**: Surowe próbki PCM **nie** trafiają do Webview. Do frontendu Tauri emitowany jest jedynie 16-elementowy wektor znormalizowanych magnitud `[f32]` w zakresie [0.0, 1.0].

---

## 2. Kolejność w potoku audio

```
[ decodebin ] -> [ audioconvert ] -> [ audioresample ] -> [ queue ]
       -> [ DSP: pitch (SoundTouch / Rubber Band) ]
       -> [ equalizer-10bands ]
       -> [ spectrum ]
       -> [ audioconvert ]
       -> [ volume ]
       -> [ pipewiresink / autoaudiosink ]
```

---

## 3. Presety korektora graficznego

Domyślne profile brzmieniowe dostarczane w domenie:
- **Flat**: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
- **Anime OST / Clear Voice**: [-1.0, 0.0, 1.0, 2.5, 3.5, 4.0, 3.0, 2.0, 1.5, 2.0]
- **Bass Boost**: [6.0, 5.0, 4.0, 2.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0]
- **Electronic / Dance**: [5.0, 4.0, 2.0, 0.0, -1.0, 1.5, 3.0, 4.0, 4.5, 4.0]
- **Rock**: [4.5, 3.5, 2.0, 0.5, -0.5, 1.0, 2.5, 3.5, 4.0, 3.5]
- **Pop**: [1.5, 3.0, 4.0, 3.5, 2.0, 0.0, -1.0, 1.0, 2.5, 3.0]
- **Classical / Acoustic**: [3.5, 2.5, 1.5, 0.5, 0.0, 0.0, 1.0, 2.0, 2.5, 3.0]
