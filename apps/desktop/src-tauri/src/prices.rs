use serde_json::{json, Value};
use tauri::State;

use crate::cards::{append_price, read_cards, read_prices, write_cards, write_prices};
use crate::db;
use crate::settings::{read_settings, write_settings};
use crate::state::AppState;
use crate::utils::{is_pocket_card, is_valid_uuid, local_date_str};

#[tauri::command]
pub fn prices_history(state: State<'_, AppState>, #[allow(non_snake_case)] cardId: String) -> Vec<Value> {
    let mut history = read_prices(&state, &cardId);
    history.sort_by(|a, b| {
        a["date"].as_str().unwrap_or("").cmp(b["date"].as_str().unwrap_or(""))
    });
    history
}

#[tauri::command]
pub fn prices_set_manual(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] cardId: String,
    price: f64,
) -> bool {
    append_price(&state, &cardId, price, "manual");
    let mut cards = read_cards(&state);
    let today = local_date_str();
    if let Some(card) = cards.iter_mut().find(|c| c["id"].as_str() == Some(&cardId)) {
        if let Some(obj) = card.as_object_mut() {
            obj.insert("lastPriceUpdate".into(), json!(today));
            obj.insert("currentPrice".into(), json!(price));
            obj.insert("priceSource".into(), json!("manual"));
        }
    }
    write_cards(&state, &cards);
    true
}

#[tauri::command]
pub fn prices_update_entry(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] cardId: String,
    date: String,
    price: f64,
) -> bool {
    if !is_valid_uuid(&cardId) { return false; }
    let mut history = read_prices(&state, &cardId);
    if let Some(entry) = history.iter_mut().find(|e| e["date"].as_str() == Some(&date)) {
        if let Some(obj) = entry.as_object_mut() {
            obj.insert("price".into(), json!(price));
        }
    }
    history.sort_by(|a, b| {
        a["date"].as_str().unwrap_or("").cmp(b["date"].as_str().unwrap_or(""))
    });
    write_prices(&state, &cardId, &history);
    true
}

#[tauri::command]
pub fn prices_delete_entry(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] cardId: String,
    date: String,
) -> bool {
    if !is_valid_uuid(&cardId) { return false; }
    let history: Vec<Value> = read_prices(&state, &cardId)
        .into_iter()
        .filter(|e| e["date"].as_str() != Some(&date))
        .collect();
    write_prices(&state, &cardId, &history);
    true
}

#[tauri::command]
pub fn prices_clear_history(state: State<'_, AppState>) -> bool {
    let cards = read_cards(&state);
    for card in &cards {
        if let Some(id) = card["id"].as_str() {
            if is_valid_uuid(id) {
                if let Some(f) = state.prices_file(id) {
                    let _ = std::fs::remove_file(f);
                }
            }
        }
    }
    true
}

#[tauri::command]
pub fn prices_portfolio(state: State<'_, AppState>, binder: Option<String>) -> Value {
    let all_cards = read_cards(&state);

    let portfolio: Vec<&Value> = all_cards.iter()
        .filter(|c| c["section"].as_str() == Some("collection") && !is_pocket_card(c))
        .filter(|c| binder.as_deref().map(|b| {
            c["binder"].as_str() == Some(b) || c["folder"].as_str() == Some(b)
        }).unwrap_or(true))
        .collect();

    let sold: Vec<&Value> = all_cards.iter()
        .filter(|c| c["section"].as_str() == Some("sold") && !is_pocket_card(c))
        .collect();

    let mut total_value = 0.0f64;
    let mut total_invested = 0.0f64;
    let mut has_invested = false;
    let mut cards_with_price = 0usize;
    let mut cards_with_cost = 0usize;
    let mut up_alerts = 0usize;
    let mut down_alerts = 0usize;

    // Per-card data for timeline aggregation
    let mut all_dates: std::collections::BTreeSet<String> = Default::default();
    // (added_date[..10], purchase_cost_with_qty, qty, sorted history)
    let mut card_histories: Vec<(String, Option<f64>, f64, Vec<Value>)> = vec![];
    let mut card_added_dates: std::collections::HashMap<String, Vec<String>> =
        Default::default();
    let mut invested_added_cards: std::collections::HashMap<String, Vec<String>> =
        Default::default();

    for card in &portfolio {
        let id = card["id"].as_str().unwrap_or("");
        let qty = card["quantity"].as_f64().unwrap_or(1.0);
        let is_trade = card["isTrade"].as_bool().unwrap_or(false);

        let mut hist = read_prices(&state, id);
        hist.sort_by(|a, b| {
            a["date"].as_str().unwrap_or("").cmp(b["date"].as_str().unwrap_or(""))
        });

        let latest_price = hist.last().and_then(|e| e["price"].as_f64());

        if let Some(p) = latest_price {
            total_value += p * qty;
            cards_with_price += 1;
        }

        let purchase_cost = if !is_trade {
            card["purchasePrice"].as_f64().map(|pp| {
                total_invested += pp * qty;
                has_invested = true;
                cards_with_cost += 1;
                pp * qty
            })
        } else {
            None
        };

        // Alert check: targetSellPrice → up alert, targetBuyPrice → down alert
        if let Some(current) = latest_price {
            if let Some(sell_target) = card["targetSellPrice"].as_f64() {
                if current >= sell_target {
                    up_alerts += 1;
                }
            }
            if let Some(buy_target) = card["targetBuyPrice"].as_f64() {
                if current <= buy_target {
                    down_alerts += 1;
                }
            }
        }

        // Collect all dates across all cards for timeline
        for entry in &hist {
            if let Some(d) = entry["date"].as_str() {
                all_dates.insert(d.to_string());
            }
        }

        let added_date_part = card["addedDate"].as_str()
            .map(|a| a[..a.len().min(10)].to_string())
            .unwrap_or_default();
        let name = card["name"].as_str().unwrap_or("").to_string();

        // Card added date → name mapping (for value history dots)
        if !added_date_part.is_empty() {
            card_added_dates.entry(added_date_part.clone()).or_default().push(name.clone());
        }

        // Invested added cards → name mapping (only cards with purchase price)
        if purchase_cost.is_some() && !added_date_part.is_empty() {
            invested_added_cards.entry(added_date_part.clone()).or_default().push(name);
        }

        card_histories.push((added_date_part, purchase_cost, qty, hist));
    }

    // Build valueHistory: for each date, sum latest price per card ≤ that date × qty
    let value_history: Vec<Value> = all_dates.iter().map(|date| {
        let mut total = 0.0f64;
        for (_, _, qty, hist) in &card_histories {
            let price = hist.iter()
                .filter(|e| e["date"].as_str().map(|d| d <= date.as_str()).unwrap_or(false))
                .last()
                .and_then(|e| e["price"].as_f64())
                .unwrap_or(0.0);
            total += price * qty;
        }
        json!({ "date": date, "value": (total * 100.0).round() / 100.0 })
    }).collect();

    // Build investedHistory: cumulative purchase cost for cards added on or before each date
    let invested_history: Vec<Value> = all_dates.iter().map(|date| {
        let mut total = 0.0f64;
        for (added_date, purchase_cost, _, _) in &card_histories {
            if let Some(cost) = purchase_cost {
                if !added_date.is_empty() && added_date.as_str() <= date.as_str() {
                    total += cost;
                }
            }
        }
        json!({ "date": date, "value": (total * 100.0).round() / 100.0 })
    }).collect();

    // Day change: today's value vs most recent prior day's value
    let today = local_date_str();
    let today_val = value_history.iter()
        .filter(|e| e["date"].as_str().map(|d| d <= today.as_str()).unwrap_or(false))
        .last()
        .and_then(|e| e["value"].as_f64())
        .unwrap_or(total_value);
    let yest_val = value_history.iter()
        .filter(|e| e["date"].as_str().map(|d| d < today.as_str()).unwrap_or(false))
        .last()
        .and_then(|e| e["value"].as_f64());
    let total_day_change = yest_val
        .map(|yv| ((today_val - yv) * 100.0).round() / 100.0)
        .unwrap_or(0.0);

    // Realized P&L from sold cards
    let realized_pnl: f64 = sold.iter()
        .filter_map(|c| {
            let sale = c["soldInfo"]["salePrice"].as_f64()?;
            let cost = c["purchasePrice"].as_f64().unwrap_or(0.0);
            Some(sale - cost)
        })
        .sum();

    let total_invested_val = if has_invested { Some((total_invested * 100.0).round() / 100.0) } else { None };
    let total_profit = total_invested_val.map(|ti| ((total_value - ti) * 100.0).round() / 100.0);
    let total_roi = total_invested_val
        .filter(|&ti| ti > 0.0)
        .map(|ti| ((total_value - ti) / ti * 10000.0).round() / 100.0);

    let card_added_dates_json: serde_json::Map<String, Value> = card_added_dates
        .into_iter()
        .map(|(k, v)| (k, json!(v)))
        .collect();
    let invested_added_cards_json: serde_json::Map<String, Value> = invested_added_cards
        .into_iter()
        .map(|(k, v)| (k, json!(v)))
        .collect();

    json!({
        "portfolioCount": portfolio.len(),
        "cardsWithPrice": cards_with_price,
        "cardsWithCost": cards_with_cost,
        "totalValue": (total_value * 100.0).round() / 100.0,
        "totalInvested": total_invested_val,
        "totalProfit": total_profit,
        "totalROI": total_roi,
        "totalDayChange": total_day_change,
        "upAlertCount": up_alerts,
        "downAlertCount": down_alerts,
        "realizedPnL": if realized_pnl != 0.0 { json!((realized_pnl * 100.0).round() / 100.0) } else { Value::Null },
        "valueHistory": value_history,
        "investedHistory": invested_history,
        "cardDataCounts": [],
        "cardAddedDates": Value::Object(card_added_dates_json),
        "investedAddedCards": Value::Object(invested_added_cards_json),
    })
}

// ── Phase 4: live database commands ───────────────────────────────────────────

#[tauri::command]
pub async fn prices_refresh(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] cardId: Option<String>,
    section: Option<String>,
) -> Result<Value, String> {
    Ok(refresh_prices_impl(&state, cardId, section).await)
}

/// Core logic behind the `prices_refresh` command, extracted so it can be
/// exercised directly in tests against a plain `&AppState` (no Tauri runtime needed).
pub async fn refresh_prices_impl(
    state: &AppState,
    #[allow(non_snake_case)] cardId: Option<String>,
    section: Option<String>,
) -> Value {
    let db = db::new_db(&state.supabase_url, &state.supabase_service_key);
    let today = local_date_str();

    let all_cards = read_cards(state);
    let to_refresh: Vec<Value> = if let Some(ref id) = cardId {
        all_cards.into_iter().filter(|c| c["id"].as_str() == Some(id.as_str())).collect()
    } else if let Some(ref sec) = section {
        if sec == "all" {
            all_cards
        } else {
            all_cards.into_iter().filter(|c| c["section"].as_str() == Some(sec.as_str())).collect()
        }
    } else {
        all_cards
    };

    let mut refreshed = 0usize;
    // Ids of cards we actually wrote fresh price data for. Only these get their
    // lastPriceUpdate stamp bumped — a card whose DB lookup/fetch failed must not
    // be marked "up to date" or the UI silently hides a stale/missing refresh.
    let mut refreshed_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for card in &to_refresh {
        let card_id = match card["id"].as_str() {
            Some(id) if is_valid_uuid(id) => id.to_string(),
            _ => continue,
        };

        match db::fetch_price_history(&db, card).await {
            history if history.is_empty() => continue,
            history => {
                // Bulk-replace local history with database history
                write_prices(state, &card_id, &history);
                // Upsert today's price: use DB's today entry, else use most recent DB price.
                // This ensures cards always show a current price even when DB is one day behind.
                let today_price = history.iter()
                    .find(|e| e["date"].as_str() == Some(today.as_str()))
                    .or_else(|| history.last())
                    .and_then(|e| e["price"].as_f64());
                if let Some(price) = today_price {
                    append_price(state, &card_id, price, "supabase");
                }
                refreshed += 1;
                refreshed_ids.insert(card_id);
            }
        }
    }

    // Update lastPriceUpdate only on cards that actually got fresh price data written.
    let mut updated = read_cards(state);
    for card in &mut updated {
        let id = card["id"].as_str().unwrap_or("");
        if refreshed_ids.contains(id) {
            if let Some(obj) = card.as_object_mut() {
                obj.insert("lastPriceUpdate".into(), json!(today));
            }
        }
    }
    write_cards(state, &updated);

    // Update settings.lastRefreshed only if at least one card was actually refreshed,
    // so a fully-failed refresh doesn't get reported to the UI as "up to date".
    if refreshed > 0 {
        let mut settings = read_settings(state);
        if let Some(obj) = settings.as_object_mut() {
            obj.insert("lastRefreshed".into(), json!(chrono::Utc::now().to_rfc3339()));
        }
        write_settings(state, &settings);
    }

    json!({ "refreshed": refreshed, "attempted": to_refresh.len() })
}

#[tauri::command]
pub async fn prices_all_conditions(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] cardId: String,
) -> Result<Value, String> {
    let cards = read_cards(&state);
    let card = match cards.iter().find(|c| c["id"].as_str() == Some(&cardId)) {
        Some(c) => c.clone(),
        None => return Ok(json!(null)),
    };

    let db = db::new_db(&state.supabase_url, &state.supabase_service_key);
    let result = db::fetch_all_conditions(&db, &card).await;

    if result.as_object().map(|o| o.is_empty()).unwrap_or(true) {
        return Ok(json!(null));
    }

    // Save own-condition price to local history if snapshot is today
    let condition = card["condition"].as_str().unwrap_or("raw");
    let grade_label = match condition {
        "raw" => "Ungraded",
        "psa10" => "PSA 10",
        "psa9" => "PSA 9",
        "psa8" => "PSA 8",
        "cgc10" => "CGC 10",
        "cgc9" => "CGC 9",
        _ => "Ungraded",
    };

    let today = local_date_str();
    let snapshot_is_today = result["_snapshotDate"].as_str() == Some(&today);
    if snapshot_is_today {
        if let Some(price) = result[grade_label].as_f64() {
            let existing = read_prices(&state, &cardId);
            if !existing.iter().any(|e| e["date"].as_str() == Some(&today)) {
                append_price(&state, &cardId, price, "supabase");
                // Update card's lastPriceUpdate
                let mut all = read_cards(&state);
                if let Some(c) = all.iter_mut().find(|c| c["id"].as_str() == Some(&cardId)) {
                    if let Some(obj) = c.as_object_mut() {
                        obj.insert("lastPriceUpdate".into(), json!(today));
                    }
                }
                write_cards(&state, &all);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn prices_for_tcg_card(
    state: State<'_, AppState>,
    opts: Value,
) -> Result<Value, String> {
    let mock_card = json!({
        "name": opts["name"],
        "number": opts["number"],
        "setName": opts["setName"],
        "condition": "raw",
    });

    let db = db::new_db(&state.supabase_url, &state.supabase_service_key);

    let (current, history) = tokio::join!(
        db::fetch_all_conditions(&db, &mock_card),
        db::fetch_price_history(&db, &mock_card),
    );

    Ok(json!({ "current": current, "history": history }))
}

#[tauri::command]
pub async fn prices_diagnose(state: State<'_, AppState>) -> Result<Value, String> {
    let db_client = db::new_db(&state.supabase_url, &state.supabase_service_key);
    let cards = read_cards(&state);
    let first = cards.iter()
        .find(|c| c["section"].as_str() == Some("collection") && !crate::utils::is_pocket_card(c))
        .cloned()
        .unwrap_or_else(|| serde_json::json!({
            "name": "Charizard", "number": "4", "setName": "Base Set",
            "pricechartingId": "", "pricechartingName": "", "condition": "raw",
        }));

    let result = db::diagnose(&db_client, &first).await;
    Ok(result)
}

#[cfg(test)]
mod refresh_tests {
    use super::*;
    use uuid::Uuid;

    /// Builds an AppState rooted at a fresh temp directory with `current_user`
    /// already set, so cards/prices/settings file helpers resolve normally.
    fn make_test_state() -> (AppState, std::path::PathBuf) {
        dotenvy::dotenv().ok();
        let url = std::env::var("SUPABASE_URL").expect("SUPABASE_URL not set");
        let key = std::env::var("SUPABASE_SERVICE_ROLE_KEY").expect("SUPABASE_SERVICE_ROLE_KEY not set");

        let data_dir = std::env::temp_dir().join(format!("pokeprice-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(data_dir.join("users").join("testuser")).unwrap();

        let state = AppState::new(data_dir.clone(), url, String::new(), key, String::new());
        *state.current_user.lock().unwrap() = Some("testuser".into());

        (state, data_dir)
    }

    fn cleanup(dir: &std::path::Path) {
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Regression test: a card whose DB lookup fails must NOT have its
    /// lastPriceUpdate stamped, and settings.lastRefreshed must NOT move —
    /// otherwise the UI believes prices are current when nothing was written.
    #[tokio::test]
    async fn refresh_does_not_stamp_cards_it_failed_to_update() {
        let (state, dir) = make_test_state();

        let card_id = Uuid::new_v4().to_string();
        let cards = vec![json!({
            "id": card_id,
            "name": "Definitely Not A Real Card Name Zzyzx",
            "number": "999999",
            "setName": "Nonexistent Set",
            "pricechartingId": "",
            "pricechartingName": "",
            "condition": "raw",
            "section": "collection",
        })];
        write_cards(&state, &cards);

        let result = refresh_prices_impl(&state, None, None).await;
        assert_eq!(result["refreshed"].as_u64(), Some(0), "unresolvable card should not count as refreshed");

        let updated = read_cards(&state);
        let card = updated.iter().find(|c| c["id"].as_str() == Some(card_id.as_str())).unwrap();
        assert!(
            card.get("lastPriceUpdate").is_none(),
            "lastPriceUpdate must not be stamped when no price data was actually written"
        );

        let settings = read_settings(&state);
        assert!(
            settings.get("lastRefreshed").is_none(),
            "settings.lastRefreshed must not be updated when nothing was refreshed"
        );

        cleanup(&dir);
    }

    /// Regression test for the reported bug: clicking refresh must actually
    /// persist fresh price history locally (including days since the last
    /// successful sync), not just silently mark the card as up to date.
    #[tokio::test]
    async fn refresh_writes_fresh_price_history_for_a_resolvable_card() {
        let (state, dir) = make_test_state();

        let card_id = Uuid::new_v4().to_string();
        let cards = vec![json!({
            "id": card_id,
            "name": "Charizard",
            "number": "4",
            "setName": "Base Set",
            "pricechartingId": "",
            "pricechartingName": "",
            "condition": "raw",
            "section": "collection",
        })];
        write_cards(&state, &cards);
        // Seed local history as stale/empty, mimicking a card that hasn't
        // synced in days — this is the exact state that reproduced the bug.
        write_prices(&state, &card_id, &[]);

        let result = refresh_prices_impl(&state, None, None).await;
        assert_eq!(result["refreshed"].as_u64(), Some(1), "resolvable card should be refreshed");

        let history = read_prices(&state, &card_id);
        assert!(!history.is_empty(), "price history file was not written by refresh");

        let latest_date = history.last().unwrap()["date"].as_str().unwrap_or("");
        let cutoff = (chrono::Local::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string();
        assert!(
            latest_date >= cutoff.as_str(),
            "refresh should pull recent data, latest entry was {}",
            latest_date
        );

        let updated = read_cards(&state);
        let card = updated.iter().find(|c| c["id"].as_str() == Some(card_id.as_str())).unwrap();
        assert_eq!(card["lastPriceUpdate"].as_str(), Some(local_date_str().as_str()));

        let settings = read_settings(&state);
        assert!(settings.get("lastRefreshed").is_some());

        cleanup(&dir);
    }
}
