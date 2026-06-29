use reqwest::Client;
use serde_json::{json, Value};

pub struct SupabaseDb {
    url: String,
    key: String,
    http: Client,
}

impl SupabaseDb {
    pub fn new(url: &str, key: &str) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            key: key.to_string(),
            http: Client::new(),
        }
    }

    pub async fn upsert(&self, table: &str, rows: &[Value]) -> Result<(), String> {
        if rows.is_empty() {
            return Ok(());
        }
        let url = format!("{}/rest/v1/{}", self.url, table);
        let resp = self
            .http
            .post(&url)
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
            .header("Prefer", "resolution=merge-duplicates")
            .json(rows)
            .send()
            .await
            .map_err(|e| format!("Supabase upsert failed: {}", e))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Supabase upsert {} error {}: {}", table, status, body));
        }
        Ok(())
    }

    pub async fn get_card_shows_by_state(&self, state_code: &str) -> Vec<Value> {
        let filter = format!("eq.{}", state_code);
        match self.get("card_shows_cache", &[
            ("state_code", filter.as_str()),
            ("select", "id,name,date,venue,address,city_state,time"),
            ("order", "date.asc"),
        ]).await {
            Ok(rows) => rows.into_iter().map(|r| json!({
                "id": r["id"],
                "name": r["name"],
                "date": r["date"],
                "venue": r["venue"],
                "address": r["address"],
                "cityState": r["city_state"],
                "time": r["time"],
            })).collect(),
            Err(e) => {
                log::error!("[db] get_card_shows_by_state error: {}", e);
                vec![]
            }
        }
    }

    async fn get(&self, table: &str, params: &[(&str, &str)]) -> Result<Vec<Value>, String> {
        let url = format!("{}/rest/v1/{}", self.url, table);
        let resp = self
            .http
            .get(&url)
            .query(params)
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
            .send()
            .await
            .map_err(|e| format!("Supabase request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Supabase error {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
        }

        resp.json::<Vec<Value>>()
            .await
            .map_err(|e| format!("Supabase parse failed: {}", e))
    }
}

fn cond_col(condition: &str) -> &'static str {
    match condition {
        "psa10" => "manual_only_price",
        "psa9" | "cgc10" | "cgc9" => "graded_price",
        "psa8" => "new_price",
        _ => "loose_price",
    }
}

/// Extracts integer id from a row (id column is a JSON Number, not a string).
fn row_id(r: &Value) -> Option<i64> {
    r["id"].as_i64()
}

/// Resolves a card to its integer id in pokemon_cards.
/// Priority: pricechartingId → pricechartingName → name+number (with/without set).
pub async fn resolve_card_id(db: &SupabaseDb, card: &Value) -> Option<i64> {
    // 1. Direct pricechartingId (stored as integer in DB)
    if let Some(pc_id) = card["pricechartingId"].as_str().filter(|s| !s.is_empty()) {
        let filter = format!("eq.{}", pc_id);
        if let Ok(rows) = db.get("pokemon_cards", &[
            ("pricecharting_id", filter.as_str()),
            ("select", "id"),
            ("limit", "1"),
        ]).await {
            if let Some(id) = rows.first().and_then(row_id) {
                return Some(id);
            }
        }
    }

    // 2. pricechartingName exact ilike match
    if let Some(name) = card["pricechartingName"].as_str().filter(|s| !s.is_empty()) {
        let filter = format!("ilike.{}", name);
        if let Ok(rows) = db.get("pokemon_cards", &[
            ("product_name", filter.as_str()),
            ("select", "id"),
            ("limit", "1"),
        ]).await {
            if let Some(id) = rows.first().and_then(row_id) {
                return Some(id);
            }
        }
    }

    // 3. "{Name} #{number}" — reqwest.query() handles encoding so # is safe
    if let (Some(name), Some(number)) = (card["name"].as_str(), card["number"].as_str()) {
        if !name.is_empty() && !number.is_empty() {
            let product_name = format!("{} #{}", name, number);
            let name_filter = format!("ilike.{}", product_name);

            // With set filter
            if let Some(set_name) = card["setName"].as_str().filter(|s| !s.is_empty()) {
                let set_filter = format!("ilike.*{}*", set_name);
                if let Ok(rows) = db.get("pokemon_cards", &[
                    ("product_name", name_filter.as_str()),
                    ("console_name", set_filter.as_str()),
                    ("select", "id"),
                    ("limit", "1"),
                ]).await {
                    if let Some(id) = rows.first().and_then(row_id) {
                        return Some(id);
                    }
                }
            }

            // Fallback: name+number only (no set filter)
            if let Ok(rows) = db.get("pokemon_cards", &[
                ("product_name", name_filter.as_str()),
                ("select", "id"),
                ("limit", "1"),
            ]).await {
                if let Some(id) = rows.first().and_then(row_id) {
                    return Some(id);
                }
            }
        }
    }

    None
}

/// Fetches full price history for a card+condition.
pub async fn fetch_price_history(db: &SupabaseDb, card: &Value) -> Vec<Value> {
    let condition = card["condition"].as_str().unwrap_or("raw");
    let col = cond_col(condition);

    let card_id = match resolve_card_id(db, card).await {
        Some(id) => id,
        None => return vec![],
    };

    let history = fetch_history_for_col(db, card_id, col).await;
    if !history.is_empty() {
        return history;
    }

    if col != "loose_price" {
        return fetch_history_for_col(db, card_id, "loose_price").await;
    }

    vec![]
}

async fn fetch_history_for_col(db: &SupabaseDb, card_id: i64, col: &str) -> Vec<Value> {
    let id_filter = format!("eq.{}", card_id);
    let not_null = "not.is.null".to_string();
    let select = format!("snapshot_date,{}", col);
    match db.get("pokemon_card_prices", &[
        ("card_id", id_filter.as_str()),
        (col, &not_null),
        ("select", select.as_str()),
        ("order", "snapshot_date.asc"),
    ]).await {
        Ok(rows) => rows
            .into_iter()
            .filter_map(|r| {
                let date = r["snapshot_date"].as_str()?.get(..10)?.to_string();
                let price = r[col].as_f64()?;
                Some(json!({ "date": date, "price": price, "source": "supabase" }))
            })
            .collect(),
        Err(e) => {
            log::error!("[db] fetch_history_for_col error: {}", e);
            vec![]
        }
    }
}

/// Fetches latest snapshot across all conditions (grade → price map).
pub async fn fetch_all_conditions(db: &SupabaseDb, card: &Value) -> Value {
    let card_id = match resolve_card_id(db, card).await {
        Some(id) => id,
        None => return json!({}),
    };

    let id_filter = format!("eq.{}", card_id);
    match db.get("pokemon_card_prices", &[
        ("card_id", id_filter.as_str()),
        ("select", "snapshot_date,loose_price,manual_only_price,graded_price,new_price"),
        ("order", "snapshot_date.desc"),
        ("limit", "1"),
    ]).await {
        Ok(rows) if !rows.is_empty() => {
            let r = &rows[0];
            let date = r["snapshot_date"].as_str().unwrap_or("").get(..10).unwrap_or("").to_string();
            json!({
                "_snapshotDate": date,
                "Ungraded": r["loose_price"],
                "PSA 10":   r["manual_only_price"],
                "PSA 9":    r["graded_price"],
                "PSA 8":    r["new_price"],
                "CGC 10":   Value::Null,
                "CGC 9":    r["graded_price"],
            })
        }
        _ => json!({}),
    }
}

/// Searches pokemon_cards for sealed products.
/// ETBs are stored as product_name="Elite Trainer Box" with set in console_name.
/// Queries by product keyword, post-filters by set name, then batch-fetches
/// image URLs from sealed_images (pricecharting_id TEXT PK → image_url).
pub async fn search_sealed_products(db: &SupabaseDb, product_kw: &str, set_name: Option<&str>) -> Vec<Value> {
    let filter = format!("ilike.*{}*", product_kw);
    let rows = match db.get("pokemon_cards", &[
        ("product_name", filter.as_str()),
        ("select", "id,product_name,console_name,pricecharting_id"),
        ("limit", "200"),
    ]).await {
        Ok(r) => r,
        Err(e) => { log::error!("[db] search_sealed_products error: {}", e); return vec![]; }
    };

    let filtered: Vec<Value> = rows.into_iter().filter(|r| {
        if let Some(set) = set_name {
            r["console_name"].as_str().unwrap_or("").to_lowercase().contains(set)
        } else {
            true
        }
    }).collect();

    if filtered.is_empty() { return vec![]; }

    // Batch-fetch image URLs — sealed_images uses pricecharting_id as TEXT PK
    let pc_ids: Vec<String> = filtered.iter()
        .filter_map(|r| r["pricecharting_id"].as_i64().map(|n| n.to_string()))
        .collect();

    let image_map: std::collections::HashMap<String, String> = if !pc_ids.is_empty() {
        let ids_filter = format!("in.({})", pc_ids.join(","));
        match db.get("sealed_images", &[
            ("pricecharting_id", ids_filter.as_str()),
            ("select", "pricecharting_id,image_url"),
        ]).await {
            Ok(img_rows) => img_rows.into_iter().filter_map(|r| {
                let pc_id = r["pricecharting_id"].as_str()?.to_string();
                let url   = r["image_url"].as_str()?.to_string();
                Some((pc_id, url))
            }).collect(),
            Err(e) => { log::warn!("[db] sealed_images fetch error: {}", e); Default::default() }
        }
    } else {
        Default::default()
    };

    filtered.into_iter().map(|r| {
        let pc_id     = r["pricecharting_id"].as_i64().map(|n| n.to_string()).unwrap_or_default();
        let image_url = image_map.get(&pc_id).cloned();
        json!({
            "id":             r["id"].as_i64().map(|n| n.to_string()).unwrap_or_default(),
            "pricechartingId": pc_id,
            "name":           r["product_name"],
            "setName":        r["console_name"],
            "currentPrice":   null,
            "imageUrl":       image_url,
            "isSealed":       true,
        })
    }).collect()
}

pub fn new_db(supabase_url: &str, supabase_service_key: &str) -> SupabaseDb {
    SupabaseDb::new(supabase_url, supabase_service_key)
}

/// Step-by-step diagnostic: tests connection, resolves a card, fetches history.
pub async fn diagnose(db: &SupabaseDb, card: &Value) -> Value {
    let conn = db.get("pokemon_cards", &[("select", "id,product_name"), ("limit", "3")]).await;
    if let Err(ref e) = conn {
        return json!({ "step": "connection_failed", "error": e });
    }
    let sample_cards = conn.unwrap();

    let card_id = resolve_card_id(db, card).await;

    let history = match card_id {
        Some(_) => fetch_price_history(db, card).await,
        None => vec![],
    };

    json!({
        "step": "complete",
        "connection": "ok",
        "sample_product_names": sample_cards.iter().map(|r| &r["product_name"]).collect::<Vec<_>>(),
        "card_looked_up": {
            "name": card["name"],
            "number": card["number"],
            "setName": card["setName"],
            "pricechartingId": card["pricechartingId"],
            "pricechartingName": card["pricechartingName"],
        },
        "resolved_card_id": card_id,
        "history_count": history.len(),
        "latest_entry": history.last(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_db() -> SupabaseDb {
        dotenvy::dotenv().ok();
        let url = std::env::var("SUPABASE_URL").expect("SUPABASE_URL not set");
        // Service role key bypasses RLS — required for reading pokemon_cards / pokemon_card_prices
        let key = std::env::var("SUPABASE_SERVICE_ROLE_KEY").expect("SUPABASE_SERVICE_ROLE_KEY not set");
        SupabaseDb::new(&url, &key)
    }

    #[tokio::test]
    async fn test_connection_and_table_access() {
        let db = make_db();
        let rows = db.get("pokemon_cards", &[
            ("select", "id,product_name,console_name"),
            ("limit", "5"),
        ]).await;
        assert!(rows.is_ok(), "Supabase connection failed: {:?}", rows.err());
        let rows = rows.unwrap();
        assert!(!rows.is_empty(), "pokemon_cards table empty or not accessible");
        println!("Sample rows:");
        for r in &rows { println!("  {:?}", r); }
    }

    #[tokio::test]
    async fn test_search_charizard_names() {
        let db = make_db();
        let rows = db.get("pokemon_cards", &[
            ("product_name", "ilike.*Charizard*"),
            ("select", "id,product_name,console_name,pricecharting_id"),
            ("limit", "10"),
        ]).await.expect("Query failed");
        println!("Charizard entries ({}):", rows.len());
        for r in &rows {
            println!("  id={} product_name={:?} console={:?} pc_id={:?}",
                r["id"], r["product_name"], r["console_name"], r["pricecharting_id"]);
        }
    }

    #[tokio::test]
    async fn test_resolve_charizard_base_set() {
        let db = make_db();
        let card = json!({
            "name": "Charizard",
            "number": "4",
            "setName": "Base Set",
            "pricechartingId": "",
            "pricechartingName": "",
            "condition": "raw",
        });
        let id = resolve_card_id(&db, &card).await;
        println!("Charizard #4 Base Set card_id: {:?}", id);
        assert!(id.is_some(), "Could not resolve Charizard #4 Base Set");
    }

    #[tokio::test]
    async fn test_fetch_price_history_charizard() {
        let db = make_db();
        let card = json!({
            "name": "Charizard",
            "number": "4",
            "setName": "Base Set",
            "pricechartingId": "",
            "pricechartingName": "",
            "condition": "raw",
        });
        let history = fetch_price_history(&db, &card).await;
        println!("History entries: {}", history.len());
        println!("Latest: {:?}", history.last());
        assert!(!history.is_empty(), "No price history for Charizard #4");
    }

    #[tokio::test]
    async fn test_price_history_has_recent_entry() {
        let db = make_db();
        let card = json!({
            "name": "Charizard",
            "number": "4",
            "setName": "Base Set",
            "pricechartingId": "",
            "pricechartingName": "",
            "condition": "raw",
        });
        let history = fetch_price_history(&db, &card).await;
        assert!(!history.is_empty(), "Empty history");
        let latest = history.last().unwrap();
        let latest_date = latest["date"].as_str().unwrap_or("");
        println!("Latest price date: {}", latest_date);
        // Should have data within the last 7 days
        let cutoff = (chrono::Local::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string();
        assert!(
            latest_date >= cutoff.as_str(),
            "Latest price ({}) is older than 7 days — DB may need seeding",
            latest_date
        );
    }

    // ── Sealed product search tests ───────────────────────────────────────────

    #[tokio::test]
    async fn test_etb_query_lowercase_direct() {
        let db = make_db();
        // Same as search_sealed_products would produce — format! with lowercase
        let filter = format!("ilike.*{}*", "elite trainer box");
        println!("DEBUG filter string: {:?}", filter);
        let rows = db.get("pokemon_cards", &[
            ("product_name", filter.as_str()),
            ("select", "id,product_name,console_name"),
            ("limit", "20"),
        ]).await.expect("Query failed");
        println!("Lowercase ETB direct query → {} results", rows.len());
        for r in &rows { println!("  {:?}", r["product_name"]); }
        assert!(!rows.is_empty(), "ilike.*elite trainer box* returned 0 rows — encoding issue?");
    }

    #[tokio::test]
    async fn test_elite_trainer_box_in_db() {
        let db = make_db();
        // Check if ETBs exist WITHOUT "Sealed" filter — they may be stored without that word
        let rows = db.get("pokemon_cards", &[
            ("product_name", "ilike.*Elite Trainer Box*"),
            ("select", "id,product_name,console_name"),
            ("limit", "20"),
        ]).await.expect("Query failed");
        println!("Elite Trainer Box entries ({}):", rows.len());
        for r in &rows {
            println!("  {:?}  |  {:?}", r["product_name"], r["console_name"]);
        }
    }

    #[tokio::test]
    async fn test_all_sealed_products_list() {
        let db = make_db();
        let rows = db.get("pokemon_cards", &[
            ("product_name", "ilike.*Sealed*"),
            ("select", "id,product_name,console_name"),
            ("limit", "100"),
        ]).await.expect("Query failed");
        println!("ALL sealed products ({}):", rows.len());
        for r in &rows {
            println!("  {:?}  |  {:?}", r["product_name"], r["console_name"]);
        }
    }

    #[tokio::test]
    async fn test_sealed_products_exist_in_db() {
        let db = make_db();
        let rows = db.get("pokemon_cards", &[
            ("product_name", "ilike.*Sealed*"),
            ("select", "id,product_name,console_name"),
            ("limit", "10"),
        ]).await.expect("Query failed");
        println!("Sample sealed products ({}):", rows.len());
        for r in &rows {
            println!("  product_name={:?}  console_name={:?}", r["product_name"], r["console_name"]);
        }
        assert!(!rows.is_empty(), "Expected sealed products in pokemon_cards (product_name ILIKE '%Sealed%')");
    }

    #[tokio::test]
    async fn test_search_sealed_products_elite_trainer_box() {
        // ETBs in DB: product_name="Elite Trainer Box", console_name="Pokemon [Set]"
        // No "Sealed" in product_name — the old Sealed filter was wrong
        let db = make_db();
        let results = search_sealed_products(&db, "elite trainer box", None).await;
        println!("search_sealed_products('elite trainer box', None) → {} results", results.len());
        for r in &results {
            println!("  name={:?}  setName={:?}  price={:?}", r["name"], r["setName"], r["currentPrice"]);
        }
        assert!(!results.is_empty(), "Expected ETBs in DB: product_name ILIKE '%Elite Trainer Box%'");
        for r in &results {
            let name = r["name"].as_str().unwrap_or("");
            assert!(
                name.to_lowercase().contains("trainer box"),
                "Result '{}' doesn't look like an ETB", name
            );
        }
    }

    #[tokio::test]
    async fn test_search_sealed_with_set_filter() {
        // "Evolving Skies ETB" → product_kw="elite trainer box", set_name=Some("evolving skies")
        // console_name="Pokemon Evolving Skies" contains "evolving skies"
        let db = make_db();
        let results = search_sealed_products(&db, "elite trainer box", Some("evolving skies")).await;
        println!("'elite trainer box' + set 'evolving skies' → {} results", results.len());
        for r in &results { println!("  name={:?}  setName={:?}", r["name"], r["setName"]); }
        assert!(!results.is_empty(), "Expected Evolving Skies ETB in DB");
        for r in &results {
            let set_name = r["setName"].as_str().unwrap_or("").to_lowercase();
            assert!(set_name.contains("evolving skies"), "setName '{}' doesn't match filter", set_name);
        }
    }

    #[tokio::test]
    async fn test_search_sealed_crown_zenith_etb() {
        let db = make_db();
        let results = search_sealed_products(&db, "elite trainer box", Some("crown zenith")).await;
        println!("crown zenith ETB → {} results", results.len());
        for r in &results { println!("  name={:?}  setName={:?}", r["name"], r["setName"]); }
        assert!(!results.is_empty(), "Expected Crown Zenith ETB in DB");
    }

    #[tokio::test]
    async fn test_sealed_search_returns_image_url() {
        // Verify imageUrl is populated (not null) for at least some ETBs with sealed_images entries
        let db = make_db();
        let results = search_sealed_products(&db, "elite trainer box", None).await;
        assert!(!results.is_empty(), "No ETB results");
        let with_images: Vec<_> = results.iter()
            .filter(|r| !r["imageUrl"].is_null())
            .collect();
        println!("ETBs with imageUrl: {}/{}", with_images.len(), results.len());
        for r in &with_images {
            println!("  name={:?} imageUrl={:?}", r["name"], r["imageUrl"]);
        }
        assert!(
            !with_images.is_empty(),
            "All {} ETBs returned null imageUrl — sealed_images batch-fetch may be broken",
            results.len()
        );
    }
}
