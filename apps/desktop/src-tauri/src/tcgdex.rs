use reqwest::Client;
use serde_json::{json, Value};

use crate::utils::is_pocket_card;

const BASE: &str = "https://api.tcgdex.net/v2/en";
const TIMEOUT_SECS: u64 = 15;

fn series_from_set_id(id: &str) -> &'static str {
    if id.starts_with("sv")         { "Scarlet & Violet" }
    else if id.starts_with("swsh")  { "Sword & Shield" }
    else if id.starts_with("sm")    { "Sun & Moon" }
    else if id.starts_with("xy")    { "XY" }
    else if id.starts_with("bw")    { "Black & White" }
    else if id.starts_with("hgss")  { "HeartGold & SoulSilver" }
    else if id.starts_with("dp")    { "Diamond & Pearl" }
    else if id.starts_with("me")    { "Mega Evolution" }
    else if id.starts_with("ecard") { "E-Card" }
    else if id.starts_with("ex")    { "EX" }
    else if id.starts_with("pop")   { "POP" }
    else if id.starts_with("neo")   { "Neo" }
    else if id.starts_with("gym")   { "Gym" }
    else if id.starts_with("base")  { "Base" }
    else if id.starts_with("col")   { "Call of Legends" }
    else if id.starts_with("pl")    { "Platinum" }
    else                             { "" }
}

fn extract_set_id(card_id: &str, local_id: &str) -> String {
    if card_id.is_empty() {
        return String::new();
    }
    if !local_id.is_empty() {
        let suffix = format!("-{}", local_id);
        if card_id.ends_with(&suffix) {
            return card_id[..card_id.len() - suffix.len()].to_string();
        }
    }
    if let Some(last) = card_id.rfind('-') {
        if last > 0 {
            return card_id[..last].to_string();
        }
    }
    String::new()
}

fn local_id_str(d: &Value) -> String {
    d["localId"]
        .as_str()
        .map(|s| s.to_string())
        .or_else(|| d["localId"].as_i64().map(|n| n.to_string()))
        .unwrap_or_default()
}

fn map_card(d: &Value, fallback_name: &str, fallback_series: &str, fallback_release_date: &str) -> Value {
    // TCGdex list endpoint returns `image` as a URL prefix; detail endpoint may also
    // include `images.small` already fully formed. Check both formats.
    let small = d["images"]["small"]
        .as_str()
        .map(|s| json!(s))
        .or_else(|| {
            d["image"].as_str().filter(|s| !s.is_empty()).map(|s| json!(format!("{}/low.webp", s)))
        })
        .unwrap_or(Value::Null);
    let large = d["images"]["high"]
        .as_str()
        .map(|s| json!(s))
        .or_else(|| {
            d["image"].as_str().filter(|s| !s.is_empty()).map(|s| json!(format!("{}/high.webp", s)))
        })
        .unwrap_or(Value::Null);

    let local_id = local_id_str(d);
    let card_id = d["id"].as_str().unwrap_or("");

    let set_id = d["set"]["id"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| extract_set_id(card_id, &local_id));

    let set_name = d["set"]["name"].as_str().unwrap_or(fallback_name);
    let set_series = d["set"]["series"].as_str().unwrap_or_else(|| {
        if !fallback_series.is_empty() {
            fallback_series
        } else {
            series_from_set_id(&set_id)
        }
    });
    let release_date = d["set"]["releaseDate"]
        .as_str()
        .unwrap_or(fallback_release_date);

    // TCGdex uses "illustrator" for the card artist, not "artist"
    let artist = d["illustrator"]
        .as_str()
        .or_else(|| d["artist"].as_str())
        .unwrap_or("");

    json!({
        "id": card_id,
        "name": d["name"].as_str().unwrap_or(""),
        "number": local_id,
        "rarity": d["rarity"],
        "types": d["types"],
        "subtypes": d["subtypes"],
        "artist": artist,
        "set": { "id": set_id, "name": set_name, "series": set_series, "logo": d["set"]["logo"], "releaseDate": release_date },
        // Flat aliases consumed by cards_add
        "setSeries": set_series,
        "setId": set_id,
        "images": { "small": small.clone(), "large": large.clone() },
        "imageUrl": small,
        "imageUrlLarge": large,
    })
}

fn build_set_map(sets: &[Value]) -> std::collections::HashMap<String, (String, String, String)> {
    sets.iter()
        .filter_map(|s| {
            let id = s["id"].as_str()?.to_string();
            let name = s["name"].as_str().unwrap_or("").to_string();
            // TCGdex returns series under "serie.name" in the sets list
            let series = s["serie"]["name"]
                .as_str()
                .unwrap_or_else(|| s["series"].as_str().unwrap_or(""))
                .to_string();
            let release_date = s["releaseDate"].as_str().unwrap_or("").to_string();
            Some((id, (name, series, release_date)))
        })
        .collect()
}

async fn fetch_raw_sets(http: &Client) -> Vec<Value> {
    let Ok(resp) = http
        .get(format!("{}/sets", BASE))
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .send()
        .await
    else {
        return vec![];
    };
    let Ok(data) = resp.json::<Value>().await else {
        return vec![];
    };
    data.as_array().cloned().unwrap_or_default()
}

pub async fn list_sets(http: &Client) -> Vec<Value> {
    fetch_raw_sets(http)
        .await
        .into_iter()
        .map(|s| {
            let id = s["id"].as_str().unwrap_or("").to_string();
            let series = s["serie"]["name"]
                .as_str()
                .unwrap_or_else(|| series_from_set_id(&id))
                .to_string();
            json!({ "id": id, "name": s["name"], "series": series, "releaseDate": s["releaseDate"] })
        })
        .collect()
}

// "4/102" → "4", "swsh1-123" → "123"
fn parse_number_query(query: &str) -> Option<String> {
    if let Some(pos) = query.find('/') {
        let left = &query[..pos];
        if !left.is_empty() && left.chars().all(|c| c.is_ascii_digit()) {
            return Some(left.to_string());
        }
    }
    if let Some(pos) = query.rfind('-') {
        let right = &query[pos + 1..];
        let left = &query[..pos];
        if !right.is_empty()
            && right.chars().all(|c| c.is_ascii_digit())
            && !left.is_empty()
            && left.chars().all(|c| c.is_ascii_alphanumeric())
        {
            return Some(right.to_string());
        }
    }
    None
}

fn map_results(raw_cards: Value, set_map: &std::collections::HashMap<String, (String, String, String)>) -> Vec<Value> {
    raw_cards
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|card| {
            let local_id = local_id_str(&card);
            let card_id = card["id"].as_str().unwrap_or("").to_string();
            let set_id = extract_set_id(&card_id, &local_id);
            let (set_name, set_series, release_date) = set_map.get(&set_id).cloned().unwrap_or_default();
            let mapped = map_card(&card, &set_name, &set_series, &release_date);
            if is_pocket_card(&mapped) { None } else { Some(mapped) }
        })
        .collect()
}

pub async fn search_cards(http: &Client, query: &str) -> Vec<Value> {
    let mut params: Vec<(&str, String)> = vec![("pagination:itemsPerPage", "30".into())];
    if let Some(num) = parse_number_query(query) {
        params.push(("eq:localId", num));
    } else {
        params.push(("name", query.to_string()));
        params.push(("sort:field", "releaseDate".into()));
        params.push(("sort:order", "DESC".into()));
    }

    let (raw_sets, cards_res) = tokio::join!(
        fetch_raw_sets(http),
        http.get(format!("{}/cards", BASE))
            .query(&params)
            .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
            .send()
    );

    let Ok(resp) = cards_res else { return vec![] };
    let Ok(data) = resp.json::<Value>().await else { return vec![] };

    map_results(data, &build_set_map(&raw_sets))
}

/// Parse a Lucene-style query string into key→value pairs.
/// Example: `name:"Pikachu*" set.name:"Crown Zenith" rarity:"Rare"`
fn parse_lucene_query(s: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let mut rest = s.trim();
    while !rest.is_empty() {
        let colon = match rest.find(':') {
            Some(p) => p,
            None => break,
        };
        let key = rest[..colon].trim().to_string();
        rest = &rest[colon + 1..];
        let value = if rest.starts_with('"') {
            rest = &rest[1..];
            match rest.find('"') {
                Some(end) => {
                    let v = rest[..end].to_string();
                    rest = rest[end + 1..].trim_start();
                    v
                }
                None => {
                    let v = rest.to_string();
                    rest = "";
                    v
                }
            }
        } else {
            let end = rest.find(' ').unwrap_or(rest.len());
            let v = rest[..end].to_string();
            rest = rest[end..].trim_start();
            v
        };
        if !key.is_empty() {
            map.insert(key, value);
        }
    }
    map
}

pub async fn search_advanced(http: &Client, q: &Value) -> Vec<Value> {
    // Accept either a Lucene-style string (e.g. `set.name:"Crown Zenith"`) or
    // a structured JSON object { name, setId, rarity }.  The renderer always
    // passed strings; the Pokedex view was later fixed to pass objects.
    // Both formats are now supported so every call site works.
    let (name, rarity_opt, set_id_opt, set_name_opt, card_id_opt, artist_opt, types_opt, supertype_opt, subtypes_opt) =
        if let Some(s) = q.as_str() {
            let p = parse_lucene_query(s);
            (
                p.get("name").map(|v| v.trim_end_matches('*').to_string()).unwrap_or_default(),
                p.get("rarity").cloned(),
                p.get("set.id").or_else(|| p.get("setId")).cloned(),
                p.get("set.name").cloned(),
                p.get("id").cloned(),
                p.get("artist").cloned(),
                p.get("types").cloned(),
                p.get("supertype").cloned(),
                p.get("subtypes").cloned(),
            )
        } else {
            (
                q["name"].as_str().unwrap_or("").to_string(),
                q["rarity"].as_str().map(|s| s.to_string()),
                q["setId"].as_str().map(|s| s.to_string()),
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
            )
        };

    // id:"swsh1-1" — fetch single card by TCGdex ID
    if let Some(cid) = card_id_opt {
        return match get_card_by_id(http, &cid).await {
            Some(card) => vec![card],
            None => vec![],
        };
    }

    if name.is_empty() && set_id_opt.is_none() && set_name_opt.is_none()
        && rarity_opt.is_none() && artist_opt.is_none()
        && types_opt.is_none() && supertype_opt.is_none()
    {
        return vec![];
    }

    // Fetch sets: needed to resolve set_name→set_id and to enrich results.
    let raw_sets = fetch_raw_sets(http).await;
    let set_map = build_set_map(&raw_sets);

    // Resolve set.name → set.id via the sets list (case-insensitive).
    let resolved_set_id: Option<String> = set_id_opt.or_else(|| {
        set_name_opt.as_ref().and_then(|sn| {
            let sn_lower = sn.to_lowercase();
            raw_sets.iter().find_map(|s| {
                let n = s["name"].as_str()?;
                if n.to_lowercase() == sn_lower {
                    s["id"].as_str().map(|id| id.to_string())
                } else {
                    None
                }
            })
        })
    });

    let mut params: Vec<(&str, String)> = vec![("pagination:itemsPerPage", "60".into())];
    if !name.is_empty() {
        params.push(("name", name));
        params.push(("sort:field", "releaseDate".into()));
        params.push(("sort:order", "DESC".into()));
    }
    if let Some(rarity) = rarity_opt {
        params.push(("rarity", rarity));
    }
    if let Some(set_id) = resolved_set_id {
        params.push(("set", set_id));
    }
    // TCGdex uses "illustrator" for the artist filter
    if let Some(artist) = artist_opt {
        params.push(("illustrator", artist));
    }
    if let Some(types) = types_opt {
        params.push(("types", types));
    }
    if let Some(supertype) = supertype_opt {
        params.push(("supertype", supertype));
    }
    if let Some(subtypes) = subtypes_opt {
        params.push(("subtypes", subtypes));
    }

    let Ok(resp) = http
        .get(format!("{}/cards", BASE))
        .query(&params)
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
        .send()
        .await
    else {
        return vec![];
    };

    let Ok(data) = resp.json::<Value>().await else {
        return vec![];
    };

    map_results(data, &set_map)
}

// All cards sharing the same Pokémon name, excluding the current printing.
pub async fn get_variations(http: &Client, name: &str, number: &str, set_name: &str) -> Vec<Value> {
    search_cards(http, name)
        .await
        .into_iter()
        .filter(|c| {
            let same_num = c["number"].as_str() == Some(number);
            let same_set = c["set"]["name"].as_str() == Some(set_name);
            !(same_num && same_set)
        })
        .collect()
}

/// Fetch a single card's full detail from the TCGdex detail endpoint.
/// Returns the mapped card or None on network / parse failure.
pub async fn get_card_by_id(http: &Client, card_id: &str) -> Option<Value> {
    let (raw_sets, card_res) = tokio::join!(
        fetch_raw_sets(http),
        http.get(format!("{}/cards/{}", BASE, card_id))
            .timeout(std::time::Duration::from_secs(TIMEOUT_SECS))
            .send()
    );
    let resp = card_res.ok()?;
    let d: Value = resp.json().await.ok()?;
    // Detail endpoint returns a single object, not an array
    if d.is_null() || !d.is_object() {
        return None;
    }
    let set_map = build_set_map(&raw_sets);
    let local_id = local_id_str(&d);
    let card_id_str = d["id"].as_str().unwrap_or("").to_string();
    let set_id = d["set"]["id"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| extract_set_id(&card_id_str, &local_id));
    let (set_name, set_series, release_date) = set_map.get(&set_id).cloned().unwrap_or_default();
    let mapped = map_card(&d, &set_name, &set_series, &release_date);
    if is_pocket_card(&mapped) { None } else { Some(mapped) }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── parse_lucene_query ────────────────────────────────────────────────────

    #[test]
    fn lucene_name_only() {
        let m = parse_lucene_query(r#"name:"Pikachu*""#);
        assert_eq!(m.get("name").map(String::as_str), Some("Pikachu*"));
        assert!(m.get("set.name").is_none());
    }

    #[test]
    fn lucene_set_name_only() {
        let m = parse_lucene_query(r#"set.name:"Crown Zenith""#);
        assert_eq!(m.get("set.name").map(String::as_str), Some("Crown Zenith"));
        assert!(m.get("name").is_none());
    }

    #[test]
    fn lucene_name_and_set_name() {
        let m = parse_lucene_query(r#"name:"Pikachu*" set.name:"Crown Zenith""#);
        assert_eq!(m.get("name").map(String::as_str), Some("Pikachu*"));
        assert_eq!(m.get("set.name").map(String::as_str), Some("Crown Zenith"));
    }

    #[test]
    fn lucene_set_id() {
        let m = parse_lucene_query(r#"set.id:"swsh12pt5""#);
        assert_eq!(m.get("set.id").map(String::as_str), Some("swsh12pt5"));
    }

    #[test]
    fn lucene_card_id() {
        let m = parse_lucene_query(r#"id:"swsh12pt5-72""#);
        assert_eq!(m.get("id").map(String::as_str), Some("swsh12pt5-72"));
    }

    #[test]
    fn lucene_rarity_only() {
        let m = parse_lucene_query(r#"rarity:"Special Illustration Rare""#);
        assert_eq!(m.get("rarity").map(String::as_str), Some("Special Illustration Rare"));
    }

    #[test]
    fn lucene_combined_name_rarity_set() {
        let m = parse_lucene_query(r#"name:"Charizard*" rarity:"Rare Holo" set.name:"Base Set""#);
        assert_eq!(m.get("name").map(String::as_str), Some("Charizard*"));
        assert_eq!(m.get("rarity").map(String::as_str), Some("Rare Holo"));
        assert_eq!(m.get("set.name").map(String::as_str), Some("Base Set"));
    }

    #[test]
    fn lucene_empty_string() {
        let m = parse_lucene_query("");
        assert!(m.is_empty());
    }

    #[test]
    fn lucene_wildcard_stripped_when_used_as_name() {
        let m = parse_lucene_query(r#"name:"Charizard*""#);
        let name = m.get("name").map(|v| v.trim_end_matches('*').to_string()).unwrap_or_default();
        assert_eq!(name, "Charizard");
    }

    #[test]
    fn lucene_supertype_and_subtypes() {
        let m = parse_lucene_query(r#"supertype:"Trainer" subtypes:"Item""#);
        assert_eq!(m.get("supertype").map(String::as_str), Some("Trainer"));
        assert_eq!(m.get("subtypes").map(String::as_str), Some("Item"));
    }

    #[test]
    fn lucene_set_with_ampersand() {
        let m = parse_lucene_query(r#"set.name:"Sword & Shield""#);
        assert_eq!(m.get("set.name").map(String::as_str), Some("Sword & Shield"));
    }

    // ── set_name → set_id resolution ─────────────────────────────────────────

    #[test]
    fn resolve_set_name_crown_zenith() {
        let sets = vec![json!({
            "id": "swsh12pt5",
            "name": "Crown Zenith",
            "serie": { "name": "Sword & Shield" },
            "releaseDate": "2023-01-20"
        })];
        let sn = "Crown Zenith";
        let found = sets.iter().find_map(|s| {
            let n = s["name"].as_str()?;
            if n.to_lowercase() == sn.to_lowercase() {
                s["id"].as_str().map(|id| id.to_string())
            } else {
                None
            }
        });
        assert_eq!(found.as_deref(), Some("swsh12pt5"));
    }

    #[test]
    fn resolve_set_name_case_insensitive() {
        let sets = vec![json!({ "id": "base1", "name": "Base Set", "serie": {} })];
        let sn = "base set";
        let found = sets.iter().find_map(|s| {
            let n = s["name"].as_str()?;
            if n.to_lowercase() == sn.to_lowercase() {
                s["id"].as_str().map(|id| id.to_string())
            } else {
                None
            }
        });
        assert_eq!(found.as_deref(), Some("base1"));
    }

    #[test]
    fn resolve_set_name_not_found_returns_none() {
        let sets = vec![json!({ "id": "base1", "name": "Base Set", "serie": {} })];
        let sn = "Nonexistent Set";
        let found: Option<String> = sets.iter().find_map(|s| {
            let n = s["name"].as_str()?;
            if n.to_lowercase() == sn.to_lowercase() {
                s["id"].as_str().map(|id| id.to_string())
            } else {
                None
            }
        });
        assert!(found.is_none());
    }

    fn make_card(image: &str) -> Value {
        json!({
            "id": "base1-58",
            "localId": "58",
            "name": "Pikachu",
            "image": image,
            "rarity": "Common",
            "illustrator": "Ken Sugimori",
            "types": ["Lightning"],
            "set": { "id": "base1", "name": "Base Set", "series": "Base", "releaseDate": "1999-01-09" }
        })
    }

    #[test]
    fn map_card_builds_image_url_from_prefix() {
        let d = make_card("https://assets.tcgdex.net/en/base/base1/58");
        let mapped = map_card(&d, "", "", "");
        assert_eq!(
            mapped["images"]["small"].as_str().unwrap(),
            "https://assets.tcgdex.net/en/base/base1/58/low.webp"
        );
        assert_eq!(
            mapped["images"]["large"].as_str().unwrap(),
            "https://assets.tcgdex.net/en/base/base1/58/high.webp"
        );
    }

    #[test]
    fn map_card_falls_back_to_images_small_if_already_formed() {
        let d = json!({
            "id": "base1-58",
            "localId": "58",
            "name": "Pikachu",
            "images": {
                "small": "https://assets.tcgdex.net/en/base/base1/58/low.webp",
                "high":  "https://assets.tcgdex.net/en/base/base1/58/high.webp"
            },
            "set": {}
        });
        let mapped = map_card(&d, "", "", "");
        assert_eq!(
            mapped["images"]["small"].as_str().unwrap(),
            "https://assets.tcgdex.net/en/base/base1/58/low.webp"
        );
    }

    #[test]
    fn map_card_images_null_when_no_image_field() {
        let d = json!({ "id": "x-1", "localId": "1", "name": "Test", "set": {} });
        let mapped = map_card(&d, "", "", "");
        assert!(mapped["images"]["small"].is_null());
        assert!(mapped["images"]["large"].is_null());
    }

    #[test]
    fn map_card_uses_illustrator_field_for_artist() {
        let d = make_card("https://example.com/img");
        let mapped = map_card(&d, "", "", "");
        assert_eq!(mapped["artist"].as_str().unwrap(), "Ken Sugimori");
    }

    #[test]
    fn map_card_falls_back_to_artist_field() {
        let d = json!({
            "id": "x-1", "localId": "1", "name": "Test",
            "artist": "Mitsuhiro Arita",
            "set": {}
        });
        let mapped = map_card(&d, "", "", "");
        assert_eq!(mapped["artist"].as_str().unwrap(), "Mitsuhiro Arita");
    }

    #[test]
    fn map_card_includes_release_date_in_set() {
        let d = make_card("https://example.com/img");
        let mapped = map_card(&d, "Base Set", "Base", "1999-01-09");
        assert_eq!(mapped["set"]["releaseDate"].as_str().unwrap(), "1999-01-09");
    }

    #[test]
    fn map_card_fallback_release_date_used_when_set_has_none() {
        let d = json!({ "id": "x-1", "localId": "1", "name": "Test", "set": { "id": "base1" } });
        let mapped = map_card(&d, "", "", "1999-01-09");
        assert_eq!(mapped["set"]["releaseDate"].as_str().unwrap(), "1999-01-09");
    }

    #[test]
    fn build_set_map_includes_release_date() {
        let sets = vec![json!({
            "id": "base1",
            "name": "Base Set",
            "serie": { "name": "Base" },
            "releaseDate": "1999-01-09"
        })];
        let map = build_set_map(&sets);
        let (name, series, release_date) = map.get("base1").unwrap();
        assert_eq!(name, "Base Set");
        assert_eq!(series, "Base");
        assert_eq!(release_date, "1999-01-09");
    }
}
