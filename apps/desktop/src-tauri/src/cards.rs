use serde_json::{json, Value};
use std::collections::HashSet;
use tauri::State;
use uuid::Uuid;

use crate::settings::{read_settings, write_settings};
use crate::state::AppState;
use crate::utils::{calc_change, is_pocket_card, is_valid_uuid, local_date_str, read_json, write_json};

// ── Card storage ──────────────────────────────────────────────────────────────

pub fn read_cards(state: &AppState) -> Vec<Value> {
    state
        .cards_file()
        .and_then(|f| read_json::<Vec<Value>>(&f))
        .unwrap_or_default()
}

pub fn write_cards(state: &AppState, cards: &[Value]) {
    let Some(f) = state.cards_file() else { return };
    // Refuse to overwrite non-empty data with empty array (stale-read guard)
    if cards.is_empty() {
        let existing = read_cards(state);
        if !existing.is_empty() {
            log::error!("[write_cards] blocked overwrite of {} cards with empty array", existing.len());
            return;
        }
    }
    // Rolling backup
    if f.exists() {
        let backup = f.with_extension("json.bak");
        let _ = std::fs::copy(&f, &backup);
    }
    write_json(&f, &cards);
}

// ── Price storage ─────────────────────────────────────────────────────────────

pub fn read_prices(state: &AppState, card_id: &str) -> Vec<Value> {
    if !is_valid_uuid(card_id) {
        return vec![];
    }
    state
        .prices_file(card_id)
        .and_then(|f| read_json::<Vec<Value>>(&f))
        .unwrap_or_default()
}

pub fn write_prices(state: &AppState, card_id: &str, entries: &[Value]) {
    if !is_valid_uuid(card_id) {
        return;
    }
    if let Some(f) = state.prices_file(card_id) {
        write_json(&f, &entries);
    }
}

pub fn append_price(state: &AppState, card_id: &str, price: f64, source: &str) {
    let today = local_date_str();
    let mut history: Vec<Value> = read_prices(state, card_id)
        .into_iter()
        .filter(|e| e["date"].as_str() != Some(&today))
        .collect();
    history.push(json!({ "date": today, "price": price, "source": source }));
    history.sort_by(|a, b| {
        a["date"].as_str().unwrap_or("").cmp(b["date"].as_str().unwrap_or(""))
    });
    write_prices(state, card_id, &history);
}

pub fn delete_card_data(state: &AppState, card_id: &str) {
    if !is_valid_uuid(card_id) {
        return;
    }
    if let Some(f) = state.prices_file(card_id) {
        let _ = std::fs::remove_file(f);
    }
}

// ── Activity ──────────────────────────────────────────────────────────────────

const VALID_ACTIVITY_TYPES: &[&str] = &[
    "card_added_collection", "card_added_watchlist", "card_added_binder",
    "card_sold", "card_traded",
    "binder_created",
    "alert_set",
    "trade_logged", "trade_executed", "trade_undone",
    "pokemon_favorited", "pokemon_unfavorited",
];

pub fn append_activity(state: &AppState, entry: Value) {
    let entry_type = entry["type"].as_str().unwrap_or("");
    if !entry_type.is_empty() && !VALID_ACTIVITY_TYPES.contains(&entry_type) {
        return;
    }
    let full_entry = {
        let mut obj = entry.as_object().cloned().unwrap_or_default();
        obj.insert("id".into(), Value::String(Uuid::new_v4().to_string()));
        obj.insert("date".into(), Value::String(chrono::Utc::now().to_rfc3339()));
        Value::Object(obj)
    };
    let Some(f) = state.activity_file() else { return };
    let mut log: Vec<Value> = read_json(&f).unwrap_or_default();
    log.insert(0, full_entry);
    log.truncate(50);
    write_json(&f, &log);
}

// ── List helpers ──────────────────────────────────────────────────────────────

fn enrich_card(state: &AppState, card: Value) -> Value {
    let card_id = card["id"].as_str().unwrap_or("");
    let history = read_prices(state, card_id);
    let latest = history.last();
    let prev = history.get(history.len().saturating_sub(2));

    let now = chrono::Local::now();
    let d7 = (now - chrono::Duration::days(7)).format("%Y-%m-%d").to_string();
    let d30 = (now - chrono::Duration::days(30)).format("%Y-%m-%d").to_string();
    let d90 = (now - chrono::Duration::days(90)).format("%Y-%m-%d").to_string();

    let week_ago = history.iter().find(|e| e["date"].as_str().unwrap_or("") >= d7.as_str());
    let month_ago = history.iter().find(|e| e["date"].as_str().unwrap_or("") >= d30.as_str());
    let recent: Vec<&Value> = history.iter().filter(|e| e["date"].as_str().unwrap_or("") >= d90.as_str()).collect();

    let current_price = latest.and_then(|e| e["price"].as_f64());
    let yesterday_price = prev.and_then(|e| e["price"].as_f64());
    let week_price = week_ago.and_then(|e| e["price"].as_f64());
    let month_price = month_ago.and_then(|e| e["price"].as_f64());

    let mut obj = card.as_object().cloned().unwrap_or_default();
    if !obj.contains_key("section") {
        obj.insert("section".into(), Value::String("watchlist".into()));
    }
    obj.insert("currentPrice".into(), current_price.map(|p| json!(p)).unwrap_or(Value::Null));
    obj.insert("priceSource".into(), latest.and_then(|e| e["source"].as_str()).map(|s| json!(s)).unwrap_or(Value::Null));
    obj.insert("changeDay".into(), calc_change(current_price, yesterday_price).map(|v| json!(v)).unwrap_or(Value::Null));
    obj.insert("changeWeek".into(), calc_change(current_price, week_price).map(|v| json!(v)).unwrap_or(Value::Null));
    obj.insert("changeMonth".into(), calc_change(current_price, month_price).map(|v| json!(v)).unwrap_or(Value::Null));
    obj.insert("recentHistory".into(), json!(recent));
    Value::Object(obj)
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn cards_list(state: State<'_, AppState>) -> Vec<Value> {
    read_cards(&state)
        .into_iter()
        .filter(|c| c["section"].as_str() != Some("sold") && !is_pocket_card(c))
        .map(|c| enrich_card(&state, c))
        .collect()
}

#[tauri::command]
pub fn cards_list_sold(state: State<'_, AppState>) -> Vec<Value> {
    let d90 = (chrono::Local::now() - chrono::Duration::days(90))
        .format("%Y-%m-%d")
        .to_string();
    read_cards(&state)
        .into_iter()
        .filter(|c| c["section"].as_str() == Some("sold") && !is_pocket_card(c))
        .map(|card| {
            let card_id = card["id"].as_str().unwrap_or("").to_string();
            let history = read_prices(&state, &card_id);
            let latest = history.last();
            let recent: Vec<&Value> = history.iter().filter(|e| e["date"].as_str().unwrap_or("") >= d90.as_str()).collect();
            let mut obj = card.as_object().cloned().unwrap_or_default();
            obj.insert("currentPrice".into(), latest.and_then(|e| e["price"].as_f64()).map(|p| json!(p)).unwrap_or(Value::Null));
            obj.insert("priceSource".into(), latest.and_then(|e| e["source"].as_str()).map(|s| json!(s)).unwrap_or(Value::Null));
            obj.insert("recentHistory".into(), json!(recent));
            Value::Object(obj)
        })
        .collect()
}

#[tauri::command]
pub fn cards_add(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] tcgCard: Value,
    condition: String,
    quantity: u32,
    section: String,
    #[allow(non_snake_case)] purchasePrice: Option<f64>,
    binder: Option<String>,
    #[allow(non_snake_case)] addedDate: Option<String>,
) -> Result<Value, String> {
    let section = if section == "collection" || section == "watchlist" {
        section
    } else {
        "watchlist".to_string()
    };

    let added_date = addedDate
        .and_then(|d| chrono::DateTime::parse_from_rfc3339(&d).ok().or_else(|| chrono::DateTime::parse_from_str(&d, "%Y-%m-%d").ok()))
        .map(|d| d.to_rfc3339())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    let new_card = json!({
        "id": Uuid::new_v4().to_string(),
        "tcgId": tcgCard["id"],
        "name": tcgCard["name"],
        "setName": tcgCard["set"]["name"].as_str().unwrap_or("Unknown Set"),
        "setSeries": tcgCard["set"]["series"].as_str().or_else(|| tcgCard["setSeries"].as_str()).unwrap_or(""),
        "setId": tcgCard["set"]["id"].as_str().or_else(|| tcgCard["setId"].as_str()).unwrap_or(""),
        "number": tcgCard["number"].as_str().unwrap_or(""),
        "rarity": tcgCard["rarity"].as_str().unwrap_or(""),
        "artist": tcgCard["artist"].as_str().unwrap_or(""),
        "types": tcgCard["types"],
        "subtypes": tcgCard["subtypes"],
        "condition": condition,
        "quantity": quantity,
        "section": section,
        "binder": binder,
        "purchasePrice": purchasePrice.filter(|&p| p > 0.0).map(|p| (p * 100.0).round() / 100.0),
        "imageUrl": tcgCard["images"]["small"].as_str().or_else(|| tcgCard["imageUrl"].as_str()).unwrap_or(""),
        "imageUrlLarge": tcgCard["images"]["large"].as_str().or_else(|| tcgCard["imageUrlLarge"].as_str()).unwrap_or(""),
        "pricechartingId": tcgCard["pricechartingId"],
        "pricechartingName": tcgCard["pricechartingName"],
        "addedDate": added_date,
        "lastPriceUpdate": Value::Null,
        "alertPrice": Value::Null,
        "alertPct": Value::Null,
    });

    let mut cards = read_cards(&state);
    cards.push(new_card.clone());
    write_cards(&state, &cards);

    let section_label = if new_card["section"].as_str() == Some("collection") { "collection" } else { "watchlist" };
    let cond = new_card["condition"].as_str().unwrap_or("raw");
    let cond_label = if cond == "raw" { "Raw".to_string() } else {
        let re = regex_cond_label(cond);
        re
    };
    let set_name = new_card["setName"].as_str().unwrap_or("");
    let number = new_card["number"].as_str().unwrap_or("");
    let detail = format!("{} · {}{}", cond_label, set_name, if !number.is_empty() { format!(" #{}", number) } else { String::new() });
    let card_name = new_card["name"].as_str().unwrap_or("").to_string();
    let card_id = new_card["id"].as_str().unwrap_or("").to_string();
    let binder_val = new_card["binder"].as_str().map(|s| s.to_string());

    append_activity(&state, json!({
        "type": format!("card_added_{}", section_label),
        "message": format!("Added {} to {}", card_name, section_label),
        "cardId": card_id,
        "detail": detail,
    }));
    if let Some(b) = &binder_val {
        append_activity(&state, json!({
            "type": "card_added_binder",
            "message": format!("Added {} to binder \"{}\"", card_name, b),
            "cardId": card_id,
            "detail": detail,
        }));
    }

    Ok(new_card)
}

fn regex_cond_label(cond: &str) -> String {
    // e.g. "psa10" → "PSA 10", "cgc9" → "CGC 9"
    let mut prefix = String::new();
    let mut num = String::new();
    for ch in cond.chars() {
        if ch.is_ascii_digit() {
            num.push(ch);
        } else {
            prefix.push(ch.to_ascii_uppercase());
        }
    }
    if num.is_empty() { prefix } else { format!("{} {}", prefix, num) }
}

#[tauri::command]
pub fn cards_remove(state: State<'_, AppState>, id: String) -> bool {
    let cards: Vec<Value> = read_cards(&state)
        .into_iter()
        .filter(|c| c["id"].as_str() != Some(&id))
        .collect();
    write_cards(&state, &cards);
    delete_card_data(&state, &id);
    true
}

const UPDATABLE_FIELDS: &[&str] = &[
    "condition", "quantity", "section", "binder", "purchasePrice",
    "alertPrice", "alertPct", "targetBuyPrice", "targetSellPrice",
    "pricechartingId", "pricechartingName", "addedDate", "soldInfo",
    "lastPriceUpdate", "changeDay", "changeWeek", "changeMonth",
    "currentPrice", "priceSource", "recentHistory", "imageUrl",
];

#[tauri::command]
pub fn cards_update(state: State<'_, AppState>, id: String, updates: Value) -> Result<Value, String> {
    let mut cards = read_cards(&state);
    let idx = cards.iter().position(|c| c["id"].as_str() == Some(&id))
        .ok_or("Card not found")?;

    let allowed: HashSet<&str> = UPDATABLE_FIELDS.iter().copied().collect();
    let obj = cards[idx].as_object_mut().ok_or("Invalid card")?;

    if let Some(upd) = updates.as_object() {
        for (k, v) in upd {
            if allowed.contains(k.as_str()) {
                obj.insert(k.clone(), v.clone());
            }
        }
        // Clear alertPct when alertPrice cleared
        if upd.get("alertPrice") == Some(&Value::Null) {
            obj.insert("alertPct".into(), Value::Null);
        }
    }

    let updated = cards[idx].clone();

    // Log alert activity
    if let Some(price) = updates["alertPrice"].as_f64() {
        let card_name = updated["name"].as_str().unwrap_or("").to_string();
        let set_name = updated["setName"].as_str().unwrap_or("").to_string();
        let cid = updated["id"].as_str().unwrap_or("").to_string();
        append_activity(&state, json!({
            "type": "alert_set",
            "message": format!("Price alert on {}", card_name),
            "cardId": cid,
            "detail": format!("Target: ${:.2} · {}", price, set_name),
        }));
    }

    write_cards(&state, &cards);
    Ok(updated)
}

#[tauri::command]
pub fn cards_sell(
    state: State<'_, AppState>,
    id: String,
    #[allow(non_snake_case)] soldInfo: Value,
) -> bool {
    let mut cards = read_cards(&state);
    let Some(idx) = cards.iter().position(|c| c["id"].as_str() == Some(&id)) else {
        return false;
    };

    let today = local_date_str();
    let sale_price = soldInfo["salePrice"].as_f64().unwrap_or(0.0);
    let is_trade = soldInfo["isTrade"].as_bool().unwrap_or(false);
    let trade_cards = soldInfo["tradeCardsReceived"].as_array().cloned().unwrap_or_default();

    // Mark card as sold
    if let Some(obj) = cards[idx].as_object_mut() {
        obj.insert("section".into(), json!("sold"));
        obj.insert("soldInfo".into(), json!({
            "salePrice": (sale_price * 100.0).round() / 100.0,
            "saleDate": soldInfo["saleDate"],
            "isTrade": is_trade,
            "tradeCardsReceived": trade_cards.clone(),
        }));
    }

    let card_name = cards[idx]["name"].as_str().unwrap_or("").to_string();
    let purchase_price = cards[idx]["purchasePrice"].as_f64();

    // Add received trade cards to collection
    let new_cards: Vec<Value> = trade_cards.iter()
        .filter(|tc| tc["name"].as_str().map(|n| !n.trim().is_empty()).unwrap_or(false))
        .map(|tc| {
            let mp = tc["marketPrice"].as_f64().map(|p| (p * 100.0).round() / 100.0);
            json!({
                "id": Uuid::new_v4().to_string(),
                "tcgId": tc["tcgId"],
                "name": tc["name"],
                "setName": tc["setName"].as_str().unwrap_or(""),
                "setId": tc["setId"].as_str().unwrap_or(""),
                "number": tc["number"].as_str().unwrap_or(""),
                "rarity": tc["rarity"].as_str().unwrap_or(""),
                "condition": tc["condition"].as_str().unwrap_or("raw"),
                "quantity": 1,
                "section": "collection",
                "binder": Value::Null,
                "isTrade": true,
                "purchasePrice": mp,
                "currentPrice": mp,
                "priceSource": mp.map(|_| json!("ppt")).unwrap_or(Value::Null),
                "imageUrl": tc["imageUrl"].as_str().unwrap_or(""),
                "imageUrlLarge": tc["imageUrlLarge"].as_str().unwrap_or(""),
                "addedDate": today,
                "lastPriceUpdate": mp.map(|_| json!(today)).unwrap_or(Value::Null),
                "alertPrice": Value::Null,
                "alertPct": Value::Null,
            })
        })
        .collect();

    cards.extend(new_cards.iter().cloned());
    write_cards(&state, &cards);

    // Activity for the sold/traded card
    let pl = purchase_price.map(|pp| (sale_price - pp) * 100.0 / 100.0);
    let pl_str = pl.map(|p| format!(" · P&L: {}${:.2}", if p >= 0.0 { "+" } else { "" }, p)).unwrap_or_default();
    let detail = if sale_price > 0.0 { format!("${:.2}{}", sale_price, pl_str) } else { "Pure trade".to_string() };
    append_activity(&state, json!({
        "type": if is_trade { "card_traded" } else { "card_sold" },
        "message": format!("{} {}", if is_trade { "Traded" } else { "Sold" }, card_name),
        "cardId": id,
        "detail": detail,
    }));

    // Activity for received trade cards
    for nc in &new_cards {
        let nc_name = nc["name"].as_str().unwrap_or("").to_string();
        let nc_id = nc["id"].as_str().unwrap_or("").to_string();
        let cond = nc["condition"].as_str().unwrap_or("raw");
        let cond_label = if cond == "raw" { "Raw".to_string() } else { regex_cond_label(cond) };
        let nc_set = nc["setName"].as_str().unwrap_or("");
        append_activity(&state, json!({
            "type": "card_added_collection",
            "message": format!("Added {} to collection", nc_name),
            "cardId": nc_id,
            "detail": format!("{}{} · received in trade", cond_label, if !nc_set.is_empty() { format!(" · {}", nc_set) } else { String::new() }),
        }));
        if let Some(p) = nc["currentPrice"].as_f64() {
            append_price(&state, &nc_id, p, "ppt");
        }
    }

    true
}

#[tauri::command]
pub fn cards_apply_default_targets(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] upPct: Option<f64>,
    #[allow(non_snake_case)] downPct: Option<f64>,
    force: Option<bool>,
) -> bool {
    let force = force.unwrap_or(false);
    let mut cards = read_cards(&state);
    let mut changed = false;
    for card in &mut cards {
        if card["section"].as_str() != Some("collection") { continue; }
        if !force && card["alertPrice"].is_f64() { continue; }
        let Some(price) = card["currentPrice"].as_f64() else { continue };
        let obj = card.as_object_mut().unwrap();
        if let Some(up) = upPct {
            obj.insert("alertPrice".into(), json!((price * (1.0 + up / 100.0) * 100.0).round() / 100.0));
            obj.insert("alertPct".into(), json!(up));
            changed = true;
        } else if let Some(down) = downPct {
            obj.insert("alertPrice".into(), json!((price * (1.0 - down / 100.0) * 100.0).round() / 100.0));
            obj.insert("alertPct".into(), json!(-down));
            changed = true;
        }
    }
    if changed { write_cards(&state, &cards); }
    true
}

#[tauri::command]
pub fn cards_clear_all_targets(state: State<'_, AppState>, field: Option<String>) -> bool {
    let mut cards = read_cards(&state);
    for card in &mut cards {
        let obj = card.as_object_mut().unwrap();
        match field.as_deref() {
            Some("alertPrice") | None => {
                obj.insert("alertPrice".into(), Value::Null);
                obj.insert("alertPct".into(), Value::Null);
            }
            _ => {}
        }
    }
    write_cards(&state, &cards);
    true
}

// ── Binders ───────────────────────────────────────────────────────────────────

fn binder_key(section: &str) -> &'static str {
    if section == "collection" { "portfolioBinders" } else { "watchlistBinders" }
}

fn binder_fallback_key(section: &str) -> &'static str {
    if section == "collection" { "portfolioFolders" } else { "watchlistFolders" }
}

#[tauri::command]
pub fn binders_list(state: State<'_, AppState>, section: String) -> Vec<String> {
    let s = read_settings(&state);
    let key = binder_key(&section);
    let fbkey = binder_fallback_key(&section);
    let stored: Vec<String> = s[key].as_array()
        .or_else(|| s[fbkey].as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    // Recover binders referenced by cards but missing from settings
    let from_cards: Vec<String> = read_cards(&state)
        .into_iter()
        .filter(|c| c["section"].as_str() == Some(&section))
        .filter_map(|c| c["binder"].as_str().or_else(|| c["folder"].as_str()).map(|s| s.to_string()))
        .collect();

    let mut merged: Vec<String> = stored.iter().cloned()
        .chain(from_cards.into_iter())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    merged.sort();

    if merged.len() > stored.len() {
        let mut new_settings = s.clone();
        if let Some(obj) = new_settings.as_object_mut() {
            obj.insert(key.into(), json!(merged));
        }
        write_settings(&state, &new_settings);
    }
    merged
}

fn validate_binder_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 100
        && !name.contains("..")
        && !name.chars().any(|c| matches!(c, '/' | '\\' | '<' | '>' | ':' | '"' | '|' | '?' | '*' | '\x00'..='\x1f'))
}

#[tauri::command]
pub fn binders_add(state: State<'_, AppState>, section: String, name: String) -> bool {
    if !validate_binder_name(&name) { return false; }
    let mut s = read_settings(&state);
    let key = binder_key(&section);
    let fbkey = binder_fallback_key(&section);
    let mut binders: Vec<String> = s[key].as_array()
        .or_else(|| s[fbkey].as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    if !binders.contains(&name) {
        binders.push(name.clone());
        binders.sort();
        if let Some(obj) = s.as_object_mut() {
            obj.insert(key.into(), json!(binders));
        }
        write_settings(&state, &s);
        append_activity(&state, json!({
            "type": "binder_created",
            "message": format!("Created {} binder \"{}\"", section, name),
        }));
    }
    true
}

#[tauri::command]
pub fn binders_delete(state: State<'_, AppState>, section: String, name: String) -> bool {
    let mut s = read_settings(&state);
    let key = binder_key(&section);
    let fbkey = binder_fallback_key(&section);
    let binders: Vec<String> = s[key].as_array()
        .or_else(|| s[fbkey].as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().filter(|n| *n != name).map(|s| s.to_string())).collect())
        .unwrap_or_default();
    if let Some(obj) = s.as_object_mut() {
        obj.insert(key.into(), json!(binders));
    }
    write_settings(&state, &s);

    let mut cards = read_cards(&state);
    let mut changed = false;
    for card in &mut cards {
        let card_section = card["section"].as_str().unwrap_or("watchlist");
        let binder = card["binder"].as_str().or_else(|| card["folder"].as_str());
        if binder == Some(&name) && card_section == section {
            if let Some(obj) = card.as_object_mut() {
                obj.insert("binder".into(), Value::Null);
            }
            changed = true;
        }
    }
    if changed { write_cards(&state, &cards); }
    true
}

#[tauri::command]
pub fn binders_rename(
    state: State<'_, AppState>,
    section: String,
    #[allow(non_snake_case)] oldName: String,
    #[allow(non_snake_case)] newName: String,
) -> bool {
    if !validate_binder_name(&newName) { return false; }
    let mut s = read_settings(&state);
    let key = binder_key(&section);
    let fbkey = binder_fallback_key(&section);
    let mut binders: Vec<String> = s[key].as_array()
        .or_else(|| s[fbkey].as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| if s == oldName { newName.clone() } else { s.to_string() })).collect())
        .unwrap_or_default();
    binders.sort();
    if let Some(obj) = s.as_object_mut() {
        obj.insert(key.into(), json!(binders));
    }
    write_settings(&state, &s);

    let mut cards = read_cards(&state);
    let mut changed = false;
    for card in &mut cards {
        let card_section = card["section"].as_str().unwrap_or("watchlist");
        let binder = card["binder"].as_str().or_else(|| card["folder"].as_str());
        if binder == Some(&oldName) && card_section == section {
            if let Some(obj) = card.as_object_mut() {
                obj.insert("binder".into(), json!(newName));
            }
            changed = true;
        }
    }
    if changed { write_cards(&state, &cards); }
    true
}

// ── Account ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn account_get_stats(state: State<'_, AppState>) -> Value {
    let cards: Vec<Value> = read_cards(&state)
        .into_iter()
        .filter(|c| !is_pocket_card(c))
        .collect();
    let trades_count = state.trades_file()
        .and_then(|f| read_json::<Vec<Value>>(&f))
        .map(|t| t.len())
        .unwrap_or(0);
    let settings = read_settings(&state);

    let collection: Vec<&Value> = cards.iter().filter(|c| c["section"].as_str() == Some("collection")).collect();
    let watchlist_count = cards.iter().filter(|c| c["section"].as_str() == Some("watchlist")).count();

    let mut total_value = 0.0f64;
    let mut total_invested = 0.0f64;
    for card in &collection {
        let card_id = card["id"].as_str().unwrap_or("");
        let history = read_prices(&state, card_id);
        if let Some(latest) = history.last().and_then(|e| e["price"].as_f64()) {
            total_value += latest;
        }
        if card["isTrade"].as_bool() != Some(true) {
            if let Some(pp) = card["purchasePrice"].as_f64() {
                total_invested += pp;
            }
        }
    }

    let total_profit = if total_invested > 0.0 {
        json!((( total_value - total_invested) * 100.0).round() / 100.0)
    } else {
        Value::Null
    };

    json!({
        "portfolioCount": collection.len(),
        "watchlistCount": watchlist_count,
        "pokemonCaught": settings["pokemonCollected"].as_i64().unwrap_or(0),
        "tradeCount": trades_count,
        "totalValue": (total_value * 100.0).round() / 100.0,
        "totalProfit": total_profit,
    })
}

#[tauri::command]
pub fn account_append_activity(state: State<'_, AppState>, entry: Value) -> bool {
    append_activity(&state, entry);
    true
}

#[tauri::command]
pub fn account_get_activity(state: State<'_, AppState>) -> Vec<Value> {
    state.activity_file()
        .and_then(|f| read_json::<Vec<Value>>(&f))
        .unwrap_or_default()
}

#[tauri::command]
pub fn account_remove_activity(state: State<'_, AppState>, id: String) -> bool {
    let Some(f) = state.activity_file() else { return true };
    let mut log: Vec<Value> = read_json(&f).unwrap_or_default();
    log.retain(|e| e["id"].as_str() != Some(&id));
    write_json(&f, &log);
    true
}

#[tauri::command]
pub fn account_clear(state: State<'_, AppState>, target: String) -> bool {
    let sections: Vec<&str> = if target == "all" { vec!["collection", "watchlist"] }
        else if target == "trades" { vec![] }
        else { vec![target.as_str()] };

    if target == "trades" || target == "all" {
        if let Some(f) = state.trades_file() {
            write_json(&f, &Vec::<Value>::new());
        }
    }
    if target == "all" {
        if let Some(f) = state.activity_file() {
            write_json(&f, &Vec::<Value>::new());
        }
    }
    if target != "trades" {
        let cards = read_cards(&state);
        let (to_remove, to_keep): (Vec<Value>, Vec<Value>) = cards
            .into_iter()
            .partition(|c| sections.contains(&c["section"].as_str().unwrap_or("watchlist")));
        for c in &to_remove {
            if let Some(id) = c["id"].as_str() {
                delete_card_data(&state, id);
            }
        }
        write_cards(&state, &to_keep);
    }
    true
}

#[tauri::command]
pub async fn account_delete(state: State<'_, AppState>) -> Result<bool, String> {
    let username = state.current_user.lock().unwrap().clone();
    if let Some(ref uname) = username {
        let user_dir = state.user_dir(uname);
        let _ = std::fs::remove_dir_all(&user_dir);
        // Remove from known-users
        let known_file = state.known_users_file();
        if let Some(mut list) = read_json::<Vec<Value>>(&known_file) {
            list.retain(|u| u["username"].as_str() != Some(uname));
            write_json(&known_file, &list);
        }
    }

    // Supabase cleanup
    let at = state.session.lock().unwrap().as_ref().map(|s| s.access_token.clone());
    let uid = state.session.lock().unwrap().as_ref().map(|s| s.user_id.clone());
    if let (Some(at), Some(uid)) = (&at, &uid) {
        if !state.supabase_url.is_empty() {
            let sb = crate::supabase::SupabaseClient::new(&state.supabase_url, &state.supabase_anon_key);
            let _ = sb.delete(at, "user_profiles", &format!("id=eq.{}", uid)).await;
            // Auth user deletion requires service key — done via admin REST if available
            if !state.supabase_service_key.is_empty() {
                let sb_admin = crate::supabase::SupabaseClient::new(&state.supabase_url, &state.supabase_service_key);
                let _ = sb_admin.delete_auth_user(&state.supabase_service_key, uid).await;
            }
            let _ = sb.sign_out(at).await;
        }
    }

    *state.session.lock().unwrap() = None;
    let _ = std::fs::remove_file(state.session_file());
    *state.current_user.lock().unwrap() = None;

    Ok(true)
}

// ── Alerts ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn alerts_get_triggered(state: State<'_, AppState>) -> Vec<Value> {
    read_cards(&state)
        .into_iter()
        .filter(|c| {
            let Some(alert_price) = c["alertPrice"].as_f64() else { return false };
            let Some(current) = c["currentPrice"].as_f64() else { return false };
            let pct = c["alertPct"].as_f64().unwrap_or(0.0);
            if pct >= 0.0 { current >= alert_price } else { current <= alert_price }
        })
        .collect()
}
