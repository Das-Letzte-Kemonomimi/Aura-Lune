use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey, ItemValue, TagItem};
use serde::{Deserialize, Serialize};

/// Struktura DTO do odczytu i zapisu pełnych tagów audio utworu.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct TrackMetadataFullDto {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub track_no: Option<u32>,
    pub track_total: Option<u32>,
    pub disc_no: Option<u32>,
    pub disc_total: Option<u32>,
    pub comment: Option<String>,
}

/// Odczytuje pełne metadane pliku audio za pomocą biblioteki lofty.
pub fn read_track_metadata(path: &str) -> Result<TrackMetadataFullDto, String> {
    let tagged_file = Probe::open(path)
        .map_err(|e| format!("Błąd otwarcia pliku {}: {}", path, e))?
        .read()
        .map_err(|e| format!("Błąd odczytu tagów: {}", e))?;

    let tag = match tagged_file.primary_tag() {
        Some(primary) => primary,
        None => match tagged_file.first_tag() {
            Some(first) => first,
            None => {
                return Ok(TrackMetadataFullDto::default());
            }
        },
    };

    let title = tag.title().map(|s| s.to_string()).unwrap_or_default();
    let artist = tag.artist().map(|s| s.to_string()).unwrap_or_default();
    let album = tag.album().map(|s| s.to_string());
    let genre = tag.genre().map(|s| s.to_string());
    let year = tag
        .get_string(ItemKey::Year)
        .and_then(|s| s.parse::<u32>().ok());
    let track_no = tag.track();
    let track_total = tag.track_total();
    let disc_no = tag.disk();
    let disc_total = tag.disk_total();
    let comment = tag.comment().map(|s| s.to_string());

    let album_artist = tag.get_string(ItemKey::AlbumArtist).map(|s| s.to_string());

    Ok(TrackMetadataFullDto {
        title,
        artist,
        album,
        album_artist,
        year,
        genre,
        track_no,
        track_total,
        disc_no,
        disc_total,
        comment,
    })
}

/// Zapisuje zmodyfikowane tagi bezpośrednio do pliku audio.
pub fn write_track_metadata(path: &str, meta: &TrackMetadataFullDto) -> Result<(), String> {
    let mut tagged_file = Probe::open(path)
        .map_err(|e| format!("Błąd otwarcia pliku {}: {}", path, e))?
        .read()
        .map_err(|e| format!("Błąd odczytu tagów: {}", e))?;

    let tag = match tagged_file.primary_tag_mut() {
        Some(primary) => primary,
        None => {
            if let Some(first) = tagged_file.first_tag_mut() {
                first
            } else {
                return Err("Brak obsługiwanego kontenera tagów w pliku audio".to_string());
            }
        }
    };

    tag.set_title(meta.title.clone());
    tag.set_artist(meta.artist.clone());

    if let Some(ref al) = meta.album {
        tag.set_album(al.clone());
    } else {
        tag.remove_album();
    }

    if let Some(ref aa) = meta.album_artist {
        tag.insert(TagItem::new(
            ItemKey::AlbumArtist,
            ItemValue::Text(aa.clone()),
        ));
    } else {
        tag.remove_key(ItemKey::AlbumArtist);
    }

    if let Some(y) = meta.year {
        tag.insert(TagItem::new(ItemKey::Year, ItemValue::Text(y.to_string())));
    } else {
        tag.remove_key(ItemKey::Year);
    }

    if let Some(ref g) = meta.genre {
        tag.set_genre(g.clone());
    } else {
        tag.remove_genre();
    }

    if let Some(tn) = meta.track_no {
        tag.set_track(tn);
    } else {
        tag.remove_track();
    }

    if let Some(tt) = meta.track_total {
        tag.set_track_total(tt);
    } else {
        tag.remove_track_total();
    }

    if let Some(dn) = meta.disc_no {
        tag.set_disk(dn);
    } else {
        tag.remove_disk();
    }

    if let Some(dt) = meta.disc_total {
        tag.set_disk_total(dt);
    } else {
        tag.remove_disk_total();
    }

    if let Some(ref c) = meta.comment {
        tag.set_comment(c.clone());
    } else {
        tag.remove_comment();
    }

    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Błąd zapisu tagów do pliku {}: {}", path, e))?;

    Ok(())
}
