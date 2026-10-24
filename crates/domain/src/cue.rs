use serde::{Deserialize, Serialize};

/// Reprezentacja pojedynczego utworu w arkuszu CUE.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CueTrack {
    pub number: u32,
    pub title: String,
    pub performer: Option<String>,
    pub start_offset_ms: u64,
    pub end_offset_ms: Option<u64>,
    pub duration_ms: Option<u64>,
}

/// Reprezentacja całego arkusza CUE (.cue sheet).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CueSheet {
    pub file_path: String,
    pub album_title: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub date: Option<String>,
    pub tracks: Vec<CueTrack>,
}

impl CueSheet {
    /// Parsuje zawartość pliku `.cue`.
    pub fn parse(content: &str) -> Result<Self, String> {
        let mut album_title = None;
        let mut album_artist = None;
        let mut genre = None;
        let mut date = None;
        let mut audio_file = String::new();

        let mut tracks: Vec<CueTrack> = Vec::new();
        let mut current_track_num: Option<u32> = None;
        let mut current_title: Option<String> = None;
        let mut current_performer: Option<String> = None;
        let mut current_start_ms: Option<u64> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }

            let cmd = parts[0].to_uppercase();

            if cmd == "REM" && parts.len() >= 3 {
                let rem_type = parts[1].to_uppercase();
                let rem_val = clean_quotes(&trimmed[trimmed.find(parts[2]).unwrap_or(0)..]);
                if rem_type == "GENRE" {
                    genre = Some(rem_val);
                } else if rem_type == "DATE" || rem_type == "YEAR" {
                    date = Some(rem_val);
                }
            } else if cmd == "PERFORMER" {
                let val = extract_quoted_or_rest(trimmed, "PERFORMER");
                if current_track_num.is_some() {
                    current_performer = Some(val);
                } else {
                    album_artist = Some(val);
                }
            } else if cmd == "TITLE" {
                let val = extract_quoted_or_rest(trimmed, "TITLE");
                if current_track_num.is_some() {
                    current_title = Some(val);
                } else {
                    album_title = Some(val);
                }
            } else if cmd == "FILE" {
                audio_file = extract_file_target(trimmed);
            } else if cmd == "TRACK" && parts.len() >= 2 {
                // Zapisz poprzedni utwór jeśli istnieje
                if let (Some(num), Some(start_ms)) = (current_track_num, current_start_ms) {
                    tracks.push(CueTrack {
                        number: num,
                        title: current_title
                            .take()
                            .unwrap_or_else(|| format!("Track {:02}", num)),
                        performer: current_performer.take().or_else(|| album_artist.clone()),
                        start_offset_ms: start_ms,
                        end_offset_ms: None,
                        duration_ms: None,
                    });
                }

                current_track_num = parts[1].parse::<u32>().ok();
                current_title = None;
                current_performer = None;
                current_start_ms = None;
            } else if cmd == "INDEX" && parts.len() >= 3 {
                let index_num = parts[1];
                let time_str = parts[2];
                // Interesuje nas INDEX 01 jako punkt startowy utworu
                if index_num == "01" || (index_num == "00" && current_start_ms.is_none()) {
                    if let Some(ms) = parse_cue_timestamp(time_str) {
                        current_start_ms = Some(ms);
                    }
                }
            }
        }

        // Dodaj ostatni utwór
        if let (Some(num), Some(start_ms)) = (current_track_num, current_start_ms) {
            tracks.push(CueTrack {
                number: num,
                title: current_title
                    .take()
                    .unwrap_or_else(|| format!("Track {:02}", num)),
                performer: current_performer.take().or_else(|| album_artist.clone()),
                start_offset_ms: start_ms,
                end_offset_ms: None,
                duration_ms: None,
            });
        }

        if tracks.is_empty() {
            return Err("Nie znaleziono poprawnych wpisów TRACK w pliku CUE".to_string());
        }

        // Oblicz czas trwania utworów pośrednich (różnica pomiędzy startem kolejnego a bieżącego)
        for i in 0..tracks.len() {
            if i + 1 < tracks.len() {
                let next_start = tracks[i + 1].start_offset_ms;
                let cur_start = tracks[i].start_offset_ms;
                if next_start >= cur_start {
                    let dur = next_start - cur_start;
                    tracks[i].duration_ms = Some(dur);
                    tracks[i].end_offset_ms = Some(next_start);
                }
            }
        }

        Ok(CueSheet {
            file_path: audio_file,
            album_title,
            album_artist,
            genre,
            date,
            tracks,
        })
    }
}

fn clean_quotes(s: &str) -> String {
    let t = s.trim();
    if t.starts_with('"') && t.ends_with('"') && t.len() >= 2 {
        t[1..t.len() - 1].to_string()
    } else {
        t.to_string()
    }
}

fn extract_quoted_or_rest(line: &str, keyword: &str) -> String {
    let after = line.trim().strip_prefix(keyword).unwrap_or("").trim();
    clean_quotes(after)
}

fn extract_file_target(line: &str) -> String {
    let after = line.trim().strip_prefix("FILE").unwrap_or("").trim();
    if let Some(start_idx) = after.find('"') {
        if let Some(end_idx) = after[start_idx + 1..].find('"') {
            return after[start_idx + 1..start_idx + 1 + end_idx].to_string();
        }
    }
    // Fallback: pierwsze słowo
    after.split_whitespace().next().unwrap_or("").to_string()
}

/// Konwertuje znacznik czasowy CUE MM:SS:FF na milisekundy.
/// 1 sekunda = 75 ramek (CD audio standard).
fn parse_cue_timestamp(ts: &str) -> Option<u64> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let minutes: u64 = parts[0].parse().ok()?;
    let seconds: u64 = parts[1].parse().ok()?;
    let frames: u64 = parts[2].parse().ok()?;

    let total_ms = (minutes * 60 + seconds) * 1000 + (frames * 1000) / 75;
    Some(total_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cue_sheet() {
        let sample_cue = r#"
REM GENRE Anime
REM DATE 2023
PERFORMER "Yuki Kajiura"
TITLE "FictionJunction OST"
FILE "FictionJunction.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Prologue ~ The Beginning"
    PERFORMER "FictionJunction"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Swordland Symphonic"
    PERFORMER "FictionJunction"
    INDEX 00 02:40:15
    INDEX 01 02:42:00
  TRACK 03 AUDIO
    TITLE "Lapis Lazuli (Ending Theme)"
    PERFORMER "Eir Aoi"
    INDEX 01 06:15:37
"#;

        let sheet = CueSheet::parse(sample_cue).expect("Parsowanie CUE powinno się udać");
        assert_eq!(sheet.file_path, "FictionJunction.flac");
        assert_eq!(sheet.album_title.as_deref(), Some("FictionJunction OST"));
        assert_eq!(sheet.album_artist.as_deref(), Some("Yuki Kajiura"));
        assert_eq!(sheet.genre.as_deref(), Some("Anime"));
        assert_eq!(sheet.date.as_deref(), Some("2023"));
        assert_eq!(sheet.tracks.len(), 3);

        // Track 1
        assert_eq!(sheet.tracks[0].number, 1);
        assert_eq!(sheet.tracks[0].title, "Prologue ~ The Beginning");
        assert_eq!(sheet.tracks[0].start_offset_ms, 0);
        // Track 2 start: 02:42:00 -> (2*60 + 42) * 1000 = 162000 ms
        assert_eq!(sheet.tracks[0].duration_ms, Some(162000));
        assert_eq!(sheet.tracks[0].end_offset_ms, Some(162000));

        // Track 2
        assert_eq!(sheet.tracks[1].number, 2);
        assert_eq!(sheet.tracks[1].title, "Swordland Symphonic");
        assert_eq!(sheet.tracks[1].start_offset_ms, 162000);

        // Track 3
        assert_eq!(sheet.tracks[2].number, 3);
        assert_eq!(sheet.tracks[2].title, "Lapis Lazuli (Ending Theme)");
        assert_eq!(sheet.tracks[2].performer.as_deref(), Some("Eir Aoi"));
        assert!(sheet.tracks[2].start_offset_ms > 162000);
        assert_eq!(sheet.tracks[2].duration_ms, None); // Ostatni utwór
    }
}
