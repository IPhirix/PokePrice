use serde_json::{json, Value};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use crate::utils::{read_json, write_json};

fn read_shows(state: &AppState) -> Vec<Value> {
    state
        .upcoming_shows_file()
        .and_then(|f| read_json::<Vec<Value>>(&f))
        .unwrap_or_default()
}

fn write_shows(state: &AppState, shows: &[Value]) {
    if let Some(f) = state.upcoming_shows_file() {
        write_json(&f, &shows);
    }
}

#[tauri::command]
pub fn upcoming_list(state: State<'_, AppState>) -> Vec<Value> {
    read_shows(&state)
}

#[tauri::command]
pub fn upcoming_add(state: State<'_, AppState>, show: Value) -> Value {
    let mut shows = read_shows(&state);
    let entry = {
        let mut obj = show.as_object().cloned().unwrap_or_default();
        if !obj.contains_key("id") || obj["id"].as_str().map(|s| s.is_empty()).unwrap_or(true) {
            obj.insert("id".into(), Value::String(Uuid::new_v4().to_string()));
        }
        Value::Object(obj)
    };
    shows.push(entry.clone());
    write_shows(&state, &shows);
    entry
}

#[tauri::command]
pub fn upcoming_remove(state: State<'_, AppState>, #[allow(non_snake_case)] showId: String) -> bool {
    let shows: Vec<Value> = read_shows(&state)
        .into_iter()
        .filter(|s| s["id"].as_str() != Some(&showId))
        .collect();
    write_shows(&state, &shows);
    true
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.trim()
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .trim()
        .to_string()
}

fn is_date_text(text: &str) -> bool {
    const DAYS: &[&str] = &["Monday,", "Tuesday,", "Wednesday,", "Thursday,", "Friday,", "Saturday,", "Sunday,"];
    const MONTHS: &[&str] = &["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    DAYS.iter().any(|d| text.contains(d))
        && MONTHS.iter().any(|m| text.contains(m))
        && text.chars().any(|c| c.is_ascii_digit())
}

fn has_time(s: &str) -> bool {
    let lower = s.to_lowercase();
    s.contains(':') && (lower.contains("am") || lower.contains("pm"))
}

fn extract_href_and_text(li_content: &str) -> (String, String) {
    let lower = li_content.to_lowercase();
    let Some(a_pos) = lower.find("<a ") else { return (String::new(), String::new()) };
    let Some(gt_rel) = li_content[a_pos..].find('>') else { return (String::new(), String::new()) };
    let tag = &li_content[a_pos..a_pos + gt_rel];

    let href = if let Some(h_pos) = tag.to_lowercase().find("href=\"") {
        let h_start = a_pos + h_pos + 6;
        li_content[h_start..].split('"').next().unwrap_or("").to_string()
    } else {
        String::new()
    };

    let content_start = a_pos + gt_rel + 1;
    let text = if let Some(close_rel) = li_content[content_start..].to_lowercase().find("</a>") {
        strip_html(&li_content[content_start..content_start + close_rel])
    } else {
        String::new()
    };

    (href, text)
}

fn extract_id_from_href(href: &str) -> String {
    let lower = href.to_lowercase();
    for prefix in &["?id=", "&id="] {
        if let Some(pos) = lower.find(prefix) {
            let id_start = pos + prefix.len();
            return href[id_start..]
                .split(|c: char| !c.is_ascii_digit())
                .next()
                .unwrap_or("")
                .to_string();
        }
    }
    String::new()
}

fn split_by_br<'a>(html: &'a str) -> Vec<&'a str> {
    let mut parts: Vec<&'a str> = Vec::new();
    let mut last = 0;
    let bytes = html.as_bytes();
    let len = bytes.len();
    let mut i = 0;
    while i < len {
        if bytes[i] == b'<' {
            let rem = &html[i..];
            let peek: String = rem.chars().take(4).map(|c| c.to_ascii_lowercase()).collect();
            if peek.starts_with("<br") {
                if let Some(gt) = rem.find('>') {
                    parts.push(&html[last..i]);
                    last = i + gt + 1;
                    i = last;
                    continue;
                }
            }
        }
        i += 1;
    }
    parts.push(&html[last..]);
    parts
}

fn parse_card_shows_html(html: &str, state_code: &str) -> Vec<Value> {
    let mut results = Vec::new();
    let html_lower = html.to_lowercase();

    // Collect all <strong>DATE TEXT</strong> positions
    let mut strong_dates: Vec<(usize, String)> = Vec::new();
    let mut search_pos = 0;
    loop {
        let Some(rel) = html_lower[search_pos..].find("<strong") else { break };
        let s_pos = search_pos + rel;
        let Some(gt_rel) = html[s_pos..].find('>') else { break };
        let content_start = s_pos + gt_rel + 1;
        let Some(close_rel) = html_lower[content_start..].find("</strong>") else { break };
        let text = strip_html(&html[content_start..content_start + close_rel]);
        if is_date_text(&text) {
            // end of </strong> = content_start + close_rel + 9
            strong_dates.push((content_start + close_rel + 9, text));
        }
        search_pos = content_start + close_rel + 9;
    }

    // For each date, find the next <ul>…</ul> and parse its <li> items
    for (i, (end_pos, date_text)) in strong_dates.iter().enumerate() {
        let next_date_pos = strong_dates.get(i + 1).map(|(p, _)| *p).unwrap_or(html.len());
        let slice = &html[*end_pos..next_date_pos];
        let slice_lower = slice.to_lowercase();

        let Some(ul_rel) = slice_lower.find("<ul") else { continue };
        let Some(ul_gt_rel) = slice[ul_rel..].find('>') else { continue };
        let ul_content_start = ul_rel + ul_gt_rel + 1;
        let Some(ul_close_rel) = slice_lower[ul_content_start..].find("</ul>") else { continue };
        let ul_content = &slice[ul_content_start..ul_content_start + ul_close_rel];
        let ul_lower = ul_content.to_lowercase();

        let mut li_search = 0;
        loop {
            let Some(li_rel) = ul_lower[li_search..].find("<li") else { break };
            let li_pos = li_search + li_rel;
            let Some(li_gt_rel) = ul_content[li_pos..].find('>') else { break };
            let li_content_start = li_pos + li_gt_rel + 1;
            let Some(li_close_rel) = ul_lower[li_content_start..].find("</li>") else { break };
            let li_content = &ul_content[li_content_start..li_content_start + li_close_rel];
            li_search = li_content_start + li_close_rel + 5;

            let (href, name) = extract_href_and_text(li_content);
            if name.is_empty() {
                continue;
            }

            let show_id = extract_id_from_href(&href);

            // Split li content by <br>, skip first chunk (contains the <a> link)
            let parts: Vec<String> = split_by_br(li_content)
                .into_iter()
                .skip(1)
                .map(|p| strip_html(p))
                .filter(|p| !p.is_empty())
                .collect();

            let time_idx = parts.iter().position(|p| has_time(p));

            let venue = parts.first().cloned().unwrap_or_default();
            let (address, city_state, show_time) = match time_idx {
                Some(ti) if ti >= 3 => (
                    parts.get(1).cloned().unwrap_or_default(),
                    parts.get(2).cloned().unwrap_or_default(),
                    parts.get(ti).cloned().unwrap_or_default(),
                ),
                Some(2) => (
                    String::new(),
                    parts.get(1).cloned().unwrap_or_default(),
                    parts.get(2).cloned().unwrap_or_default(),
                ),
                Some(ti) => (
                    String::new(),
                    parts.get(1).cloned().unwrap_or_default(),
                    parts.get(ti).cloned().unwrap_or_default(),
                ),
                None => (
                    String::new(),
                    parts.get(1).cloned().unwrap_or_default(),
                    String::new(),
                ),
            };

            let final_id = if show_id.is_empty() {
                format!("{}|{}|{}|{}", state_code, date_text, name, venue)
                    .chars()
                    .take(250)
                    .collect()
            } else {
                show_id
            };

            results.push(json!({
                "id": final_id,
                "name": name,
                "date": date_text,
                "venue": venue,
                "address": address,
                "cityState": city_state,
                "time": show_time,
            }));
        }
    }

    results
}

#[tauri::command]
pub async fn card_shows_fetch(
    state: State<'_, AppState>,
    state_code: Option<String>,
    state_name: Option<String>,
) -> Result<Value, String> {
    let code = state_code.as_deref().unwrap_or("OH");
    let name = state_name.as_deref().unwrap_or("Ohio");

    let db = crate::db::new_db(&state.supabase_url, &state.supabase_service_key);

    let http = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .unwrap_or_default();

    // Establish session cookies by hitting homepage first (TCDB blocks cold requests)
    let _ = http
        .get("https://www.tcdb.com/")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await;

    let fetch_result = http
        .get("https://www.tcdb.com/CardShows.cfm")
        .query(&[
            ("MODE", "Location"),
            ("State", code),
            ("Display", name),
            ("Country", "United States"),
        ])
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .header("Referer", "https://www.tcdb.com/")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await;

    let live_shows = match fetch_result {
        Ok(resp) if resp.status().is_success() => {
            match resp.text().await {
                Ok(html) => parse_card_shows_html(&html, code),
                Err(e) => {
                    log::warn!("[shows] failed to read TCDB response: {}", e);
                    vec![]
                }
            }
        }
        Ok(resp) => {
            log::warn!("[shows] TCDB returned HTTP {} — falling back to cache", resp.status());
            vec![]
        }
        Err(e) => {
            log::warn!("[shows] TCDB fetch failed: {} — falling back to cache", e);
            vec![]
        }
    };

    // Upsert live shows into cache so past shows are preserved over time
    if !live_shows.is_empty() {
        let now = chrono::Utc::now().to_rfc3339();
        let cache_rows: Vec<Value> = live_shows.iter().map(|s| json!({
            "id": s["id"],
            "name": s["name"],
            "date": s["date"],
            "venue": s["venue"],
            "address": s["address"],
            "city_state": s["cityState"],
            "time": s["time"],
            "state_code": code,
            "state_name": name,
            "fetched_at": now,
        })).collect();
        if let Err(e) = db.upsert("card_shows_cache", &cache_rows).await {
            log::warn!("[shows] cache upsert failed: {}", e);
        }
    }

    // Return full cache for this state (includes all past shows ever fetched)
    let cached = db.get_card_shows_by_state(code).await;
    if !cached.is_empty() {
        return Ok(json!({ "shows": cached }));
    }

    if live_shows.is_empty() {
        return Err("Failed to load card shows: TCDB unavailable and no cached data found".to_string());
    }

    Ok(json!({ "shows": live_shows }))
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async fn geocode_zip(http: &reqwest::Client, zip: &str) -> Option<(f64, f64)> {
    if zip.len() != 5 || !zip.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let url = format!("https://api.zippopotam.us/us/{}", zip);
    let data: Value = http
        .get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    let place = data["places"].get(0)?;
    let lat: f64 = place["latitude"].as_str()?.parse().ok()?;
    let lon: f64 = place["longitude"].as_str()?.parse().ok()?;
    Some((lat, lon))
}

async fn geocode_city(http: &reqwest::Client, city: &str) -> Option<(f64, f64)> {
    let q = format!("{}, USA", city.split(',').map(|s| s.trim()).collect::<Vec<_>>().join(", "));
    for attempt in 0..3u32 {
        let res = http
            .get("https://nominatim.openstreetmap.org/search")
            .query(&[("q", &q), ("format", &"json".to_string()), ("limit", &"1".to_string()), ("countrycodes", &"us".to_string())])
            .header("User-Agent", "PokePrice/1.0 (pokeprice-card-shows)")
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;

        match res {
            Ok(r) if r.status() == 429 => {
                let wait = r
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(10)
                    + 2;
                tokio::time::sleep(std::time::Duration::from_secs(wait)).await;
            }
            Ok(r) => {
                let data: Value = r.json().await.ok()?;
                let hit = data.as_array()?.first()?;
                let lat: f64 = hit["lat"].as_str()?.parse().ok()?;
                let lon: f64 = hit["lon"].as_str()?.parse().ok()?;
                return Some((lat, lon));
            }
            Err(_) if attempt < 2 => {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
            Err(_) => return None,
        }
    }
    None
}

/// Accepts { zip?: string, cities: string[] }.
/// Returns { userLocation: {lat,lon} | null, cities: { cityString: {lat,lon} | null } }.
#[tauri::command]
pub async fn geocode_batch(_state: State<'_, AppState>, data: Value) -> Result<Value, String> {
    let zip = data["zip"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string());
    let cities: Vec<String> = data["cities"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let http = reqwest::Client::new();

    let user_location = if let Some(z) = &zip {
        geocode_zip(&http, z)
            .await
            .map(|(lat, lon)| json!({ "lat": lat, "lon": lon }))
    } else {
        None
    };

    let mut cities_map = serde_json::Map::new();
    let mut last_nominatim = std::time::Instant::now() - std::time::Duration::from_secs(2);

    for city in &cities {
        let elapsed = last_nominatim.elapsed();
        if elapsed < std::time::Duration::from_millis(1500) {
            tokio::time::sleep(std::time::Duration::from_millis(1500) - elapsed).await;
        }
        let result = geocode_city(&http, city).await;
        last_nominatim = std::time::Instant::now();

        let value = result
            .map(|(lat, lon)| json!({ "lat": lat, "lon": lon }))
            .unwrap_or(Value::Null);
        cities_map.insert(city.clone(), value);
    }

    Ok(json!({
        "userLocation": user_location,
        "cities": Value::Object(cities_map),
    }))
}
