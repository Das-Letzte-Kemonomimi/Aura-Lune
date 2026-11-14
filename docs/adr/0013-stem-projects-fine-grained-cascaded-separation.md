# ADR 0013: Moises-Style Stem Projects, Hierarchical Fine-Grained Stem Taxonomy, and Cascaded Separation Architecture

- **Status**: Zaakceptowany (Accepted)
- **Data**: 2026-11-14
- **Autorka**: Das Letzte Kemonomimi
- **Kontekst**: Wprowadzenie zaawansowanego modułu „Stem Projects” (w stylu Moises / RipX / DAW), pozwalającego na tworzenie wielościeżkowych projektów mikserskich z dowolnego utworu z biblioteki, z hierarchicznym podziałem na szczegółowe instrumenty, suwakami głośności 0–100% (domyślnie 75% = 0 dB), mikserem studyjnym, zapamiętywaniem miksów oraz eksportem.

---

## 1. Problem i Kontekst

W dotychczasowej implementacji (ADR 0012) odtwarzacz wspierał 4 podstawowe stemy (*Vocals*, *Drums*, *Bass*, *Other*) jako globalną pamięć podręczną utworu. Użytkowniczka potrzebuje jednak przepływu pracy w stylu aplikacji Moises:
1. **Encja Projektu (Stem Project)**: Z każdego utworu można utworzyć niezależny projekt (lub kilka projektów z różnymi miksami i wersjami modeli). Oryginalny plik audio ani wpis w bibliotece nigdy nie są modyfikowane ani powielane na dysku.
2. **Drobnoziarnista Taksonomia Stemów (Fine-Grained Stem Taxonomy)**: Zamiast ograniczać się do 4 ścieżek, system powinien wspierać hierarchiczne rozbicie:
   - *Vocals*: Lead Vocal, Backing Vocals / Choir.
   - *Drums*: Kick, Snare, Hi-Hat, Toms, Cymbals, Percussion (oraz nadrzędny *Full Drums*).
   - *Bass*: Bass (Electric / Upright / Synth).
   - *Guitars*: Lead Electric, Rhythm Electric, Acoustic Guitar (oraz nadrzędny *All Guitars*).
   - *Keys*: Piano, Electric Piano / Organ, Synth / Pads.
   - *Orchestral & Other*: Strings, Brass, Woodwinds, Other / Residual.
3. **Kaskadowa Architektura Separacji (Cascaded Separation)**: Ponieważ żaden pojedynczy model ML nie dzieli jednocześnie utworu na 15 instrumentów o wysokiej jakości, stosujemy 2-etapową kaskadę:
   - **Etap 1 (Baza)**: Model bazowy (4-stem lub 6-stem HTDemucs 6s) lub wbudowany filtr Linkwitz-Riley DSP.
   - **Etap 2 (Specjaliści)**: Modele dedykowane uruchamiane na wyodrębnionych stemach nadrzędnych (np. model perkusyjny na ścieżce *Drums*, model wokalny na ścieżce *Vocals*).
   - **Warunek Rekonstrukcji**: Każdy etap zachowuje resztę spektralną (residual), gwarantując, że suma wszystkich liści w drzewie stemów matematycznie rekonstruuje oryginał bez zniekształceń fazowych.
4. **Krzywa Głośności (Volume Mapping)**:
   - $0\%$ = wyciszenie (cisza / $-\infty\text{ dB}$).
   - $75\%$ = unity gain ($0.0\text{ dB}$, mnożnik liniowy $1.0\times$ — domyślny miks brzmi identycznie jak oryginalny utwór).
   - $100\%$ = headroom boost ($+6.02\text{ dB}$, mnożnik liniowy $\approx 2.0\times$).
   - Płynna regulacja w audio callbacku GStreamera zapobiegająca trzaskom oraz zintegrowany True-Peak Limiter na szynie Master.

---

## 2. Decyzje Architektoniczne

### 2.1. Model Danych w SQLite
Wprowadzamy addytywne tabele w `storage`:
- `stem_projects`: `id`, `track_id`, `track_hash`, `title`, `cover_uri`, `created_at`, `updated_at`, `status` (`queued`, `separating`, `ready`, `failed`), `stage_mask`, `disk_size_bytes`, `metadata_json`.
- `stem_project_channels`: `id`, `project_id`, `stem_type` (np. `lead_vocal`, `kick`, `snare`, `bass`), `parent_stem`, `file_path`, `sample_rate`, `channels`, `duration_ms`, `quality_tier` (`high_quality`, `experimental`, `dsp_fallback`), `color_hex`.
- `stem_project_mixes`: `id`, `project_id`, `name`, `is_default`, `volumes_json` (mapa `stem_type -> { volume: 0.75, pan: 0.0, mute: false, solo: false }`), `master_volume`, `updated_at`.

### 2.2. Mapowanie Głośności Suwaka (Slider to Gain Mapping)
Dla wartości suwaka $v \in [0.0, 1.0]$:
```rust
pub fn slider_to_linear_gain(v: f32) -> f32 {
    let v = v.clamp(0.0, 1.0);
    if v <= 0.0001 {
        0.0
    } else if v <= 0.75 {
        // Płynna krzywa wykładniczo-potęgowa od ciszy (-60 dB) do 0 dB (1.0x) przy 75%
        let normalized = v / 0.75;
        normalized.powf(2.2)
    } else {
        // Płynny boost od 1.0x (0 dB) do 2.0x (+6.02 dB) przy 100%
        let boost_norm = (v - 0.75) / 0.25;
        1.0 + boost_norm * (2.0f32.powf(6.0206 / 20.0) - 1.0)
    }
}
```
Funkcja ta gwarantuje:
1. $v = 0.75 \implies g = 1.0$ ($0.0\text{ dB}$).
2. $v = 1.0 \implies g \approx 2.0$ ($+6.02\text{ dB}$).
3. $v = 0.0 \implies g = 0.0$ (cisza).
4. Subtelna, naturalna krzywa w stylu faderów studyjnych.

### 2.3. Pakiety Modeli (Model Packs) w Model Managerze
Dzielimy modele na przejrzyste pakiety:
1. **Core 4-Stem Pack**: HTDemucs v4 (Vocals, Drums, Bass, Other).
2. **Extended 6-Stem Pack**: HTDemucs 6s (dodaje Guitars, Piano).
3. **Vocal Isolation & Harmonies Pack**: UVR MDX-B Karaoke (Lead Vocal vs Backing Vocals).
4. **Drum Kit Decomposition Pack**: Demucs Drums / Spleeter drum piece model (Kick, Snare, Hi-Hat, Toms, Cymbals).
5. **Acoustic & Orchestral Pack**: Open-Unmix / MDX23C (Strings, Brass, Woodwinds).
6. **Native DSP Cascaded Fallback**: Wbudowany w kod Auralune, zerowe pobieranie danych, matematyczna rekonstrukcja $100\%$.

### 2.4. Integracja z GStreamer i Izolacja Wątku Audio
- Każdy wyodrębniony kanał projektu otrzymuje dedykowaną gałąź w elemencie `audiomixer` podłączonym do `queue_in -> AuraluneDsp`.
- Zmiana głośności i panoramy odbywa się poprzez właściwości elementów GStreamer bez blokowania wątku i bez alokacji w callbacku audio.
- Odtwarzacz zachowuje pełne wsparcie dla Rubber Band, SoundTouch, korektora graficznego 10-band, PEQ, limitera oraz pętli A-B.

---

## 3. Konsekwencje i Bezpieczeństwo
- **Bezpieczeństwo danych**: Żadne pliki źródłowe użytkowniczki nie są nadpisywane.
- **Pamięć dyskowa**: Stemy są buforowane w skompresowanym formacie FLAC lub WAV pod `~/.cache/auralune/stem_projects/<project_id>/` z możliwością wyczyszczenia jednym kliknięciem.
- **Licencje**: Wszystkie modele posiadają jawnie zadeklarowane licencje i sumy kontrolne SHA-256.
