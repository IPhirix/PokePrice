use serde_json::{json, Value};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::cards::{read_cards, write_cards};
use crate::db;
use crate::state::AppState;
use crate::tcgdex;
use crate::utils::local_date_str;

fn http() -> reqwest::Client {
    reqwest::Client::new()
}

#[tauri::command]
pub fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn app_locale() -> String {
    std::env::var("LANG")
        .or_else(|_| std::env::var("LC_ALL"))
        .unwrap_or_else(|_| "en-US".to_string())
}

#[tauri::command]
pub async fn shell_open_external(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http/https URLs are allowed".into());
    }
    open::that(&url).map_err(|e| e.to_string())
}

// ── TCGdex commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cards_search(_state: State<'_, AppState>, query: String) -> Result<Vec<Value>, String> {
    Ok(tcgdex::search_cards(&http(), &query).await)
}

#[tauri::command]
pub async fn cards_search_advanced(_state: State<'_, AppState>, q: Value) -> Result<Vec<Value>, String> {
    Ok(tcgdex::search_advanced(&http(), &q).await)
}

#[tauri::command]
pub async fn cards_get_by_id(_state: State<'_, AppState>, id: String) -> Result<Option<Value>, String> {
    Ok(tcgdex::get_card_by_id(&http(), &id).await)
}

#[tauri::command]
pub async fn cards_get_variations(
    state: State<'_, AppState>,
    name: String,
    number: String,
    #[allow(non_snake_case)] setName: String,
) -> Result<Vec<Value>, String> {
    let db = db::new_db(&state.supabase_url, &state.supabase_service_key);
    Ok(db::get_card_variations(&db, &name, &number, &setName).await)
}

#[tauri::command]
pub async fn sets_list(_state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    Ok(tcgdex::list_sets(&http()).await)
}

// ── Stubs (Phase 4+) ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cards_export(_state: State<'_, AppState>, _opts: Value) -> Result<bool, String> {
    Err("Export not yet implemented in Tauri build".into())
}

#[tauri::command]
pub async fn etb_lookup(_state: State<'_, AppState>, _name: String) -> Result<Value, String> {
    Ok(json!(null))
}

#[tauri::command]
pub async fn etb_get_all(_state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    Ok(vec![])
}

/// Sealed product type keywords, checked longest-first to avoid partial matches.
const SEALED_PRODUCT_KEYWORDS: &[&str] = &[
    "elite trainer box",
    "booster bundle",
    "booster pack",
    "booster box",
    "collection box",
    "premium collection",
    "display box",
    "gift box",
    "mini tin",
    "theme deck",
    "starter deck",
    "blister",
    "bundle",
    "tin",
];

/// Expands abbreviations for sealed product search.
/// "ETB" / "etb" → "elite trainer box"
pub fn normalize_sealed_query(query: &str) -> String {
    query
        .trim()
        .to_lowercase()
        .split_whitespace()
        .map(|w| if w == "etb" { "elite trainer box" } else { w })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Splits a normalized sealed query into (product_keyword, optional_set_name).
/// "ascended heroes elite trainer box" → ("elite trainer box", Some("ascended heroes"))
/// "elite trainer box" → ("elite trainer box", None)
/// "crown zenith booster box" → ("booster box", Some("crown zenith"))
pub fn parse_sealed_query(query: &str) -> (String, Option<String>) {
    let q = query.trim().to_lowercase();
    for &kw in SEALED_PRODUCT_KEYWORDS {
        if q.contains(kw) {
            let set_part = q
                .replace(kw, "")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            let set_name = if set_part.is_empty() { None } else { Some(set_part) };
            return (kw.to_string(), set_name);
        }
    }
    (q, None)
}

#[tauri::command]
pub async fn sealed_search(state: State<'_, AppState>, query: String) -> Result<Value, String> {
    let normalized = normalize_sealed_query(query.trim());
    let (product_kw, set_name) = parse_sealed_query(&normalized);
    let db = db::new_db(&state.supabase_url, &state.supabase_service_key);
    let products = db::search_sealed_products(&db, &product_kw, set_name.as_deref()).await;
    Ok(json!({ "products": products }))
}

#[tauri::command]
pub async fn sealed_add(
    state: State<'_, AppState>,
    product: Value,
    section: String,
    purchase_price: Option<f64>,
    binder: Option<String>,
) -> Result<Value, String> {
    let id = Uuid::new_v4().to_string();
    let name = product["name"].as_str().unwrap_or("Unknown").to_string();
    let set_name = product["setName"].as_str().map(|s| s.to_string());
    let current_price = product["currentPrice"].as_f64();
    let today = local_date_str();

    let entry = json!({
        "id": id,
        "tcgId": null,
        "name": name,
        "setName": set_name,
        "setId": null,
        "number": null,
        "rarity": null,
        "condition": "raw",
        "quantity": 1,
        "section": section,
        "binder": binder,
        "purchasePrice": purchase_price,
        "currentPrice": current_price,
        "priceSource": "supabase",
        "imageUrl": product["imageUrl"],
        "imageUrlLarge": null,
        "addedDate": today,
        "lastPriceUpdate": today,
        "targetBuyPrice": null,
        "targetSellPrice": null,
        "changeDay": null,
        "changeWeek": null,
        "changeMonth": null,
        "recentHistory": [],
        "pricechartingId": product["pricechartingId"],
        "pricechartingName": name,
        "isSealed": true,
    });

    let mut cards = read_cards(&state);
    cards.push(entry.clone());
    write_cards(&state, &cards);
    Ok(entry)
}

#[tauri::command]
pub async fn email_test(_state: State<'_, AppState>) -> Result<bool, String> {
    Err("Email not yet implemented in Tauri build".into())
}

#[tauri::command]
pub fn pick_profile_image() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── normalize_sealed_query ────────────────────────────────────────────────

    #[test]
    fn normalize_bare_etb() {
        assert_eq!(normalize_sealed_query("etb"), "elite trainer box");
    }

    #[test]
    fn normalize_uppercase_etb() {
        assert_eq!(normalize_sealed_query("ETB"), "elite trainer box");
    }

    #[test]
    fn normalize_mixed_case_etb() {
        assert_eq!(normalize_sealed_query("Etb"), "elite trainer box");
    }

    #[test]
    fn normalize_crown_zenith_etb() {
        assert_eq!(
            normalize_sealed_query("crown zenith etb"),
            "crown zenith elite trainer box"
        );
    }

    #[test]
    fn normalize_crown_zenith_etb_uppercase() {
        assert_eq!(
            normalize_sealed_query("Crown Zenith ETB"),
            "crown zenith elite trainer box"
        );
    }

    #[test]
    fn normalize_elite_trainer_box_unchanged() {
        assert_eq!(
            normalize_sealed_query("elite trainer box"),
            "elite trainer box"
        );
    }

    #[test]
    fn normalize_booster_box_unchanged() {
        assert_eq!(normalize_sealed_query("booster box"), "booster box");
    }

    #[test]
    fn normalize_trims_whitespace() {
        assert_eq!(normalize_sealed_query("  ETB  "), "elite trainer box");
    }

    // ── parse_sealed_query ────────────────────────────────────────────────────

    #[test]
    fn parse_etb_only() {
        let (kw, set) = parse_sealed_query("elite trainer box");
        assert_eq!(kw, "elite trainer box");
        assert_eq!(set, None);
    }

    #[test]
    fn parse_set_plus_etb() {
        let (kw, set) = parse_sealed_query("ascended heroes elite trainer box");
        assert_eq!(kw, "elite trainer box");
        assert_eq!(set, Some("ascended heroes".to_string()));
    }

    #[test]
    fn parse_crown_zenith_etb() {
        let (kw, set) = parse_sealed_query("crown zenith elite trainer box");
        assert_eq!(kw, "elite trainer box");
        assert_eq!(set, Some("crown zenith".to_string()));
    }

    #[test]
    fn parse_crown_zenith_booster_box() {
        let (kw, set) = parse_sealed_query("crown zenith booster box");
        assert_eq!(kw, "booster box");
        assert_eq!(set, Some("crown zenith".to_string()));
    }

    #[test]
    fn parse_booster_box_only() {
        let (kw, set) = parse_sealed_query("booster box");
        assert_eq!(kw, "booster box");
        assert_eq!(set, None);
    }

    #[test]
    fn parse_etb_before_set_name() {
        // keyword appears before set name in string
        let (kw, set) = parse_sealed_query("elite trainer box evolving skies");
        assert_eq!(kw, "elite trainer box");
        assert_eq!(set, Some("evolving skies".to_string()));
    }

    #[test]
    fn parse_booster_bundle_not_confused_with_booster_pack() {
        let (kw, set) = parse_sealed_query("booster bundle");
        assert_eq!(kw, "booster bundle");
        assert_eq!(set, None);
    }

    #[test]
    fn parse_full_flow_etb_abbreviation() {
        // Simulates full flow: user types "Ascended Heroes ETB"
        // normalize first, then parse
        let normalized = normalize_sealed_query("Ascended Heroes ETB");
        assert_eq!(normalized, "ascended heroes elite trainer box");
        let (kw, set) = parse_sealed_query(&normalized);
        assert_eq!(kw, "elite trainer box");
        assert_eq!(set, Some("ascended heroes".to_string()));
    }
}
