use serde_json::{json, Value};
use tauri::State;
use uuid::Uuid;

use crate::cards::append_activity;
use crate::state::AppState;
use crate::utils::{read_json, write_json};

fn read_trades(state: &AppState) -> Vec<Value> {
    state
        .trades_file()
        .and_then(|f| read_json::<Vec<Value>>(&f))
        .unwrap_or_default()
}

fn write_trades(state: &AppState, trades: &[Value]) {
    if let Some(f) = state.trades_file() {
        write_json(&f, &trades);
    }
}

#[tauri::command]
pub fn trades_list(state: State<'_, AppState>) -> Vec<Value> {
    read_trades(&state)
}

#[tauri::command]
pub fn trades_save(state: State<'_, AppState>, trade: Value) -> Value {
    let mut trades = read_trades(&state);
    let entry = {
        let mut obj = trade.as_object().cloned().unwrap_or_default();
        obj.insert("id".into(), Value::String(Uuid::new_v4().to_string()));
        obj.insert("savedAt".into(), Value::String(chrono::Utc::now().to_rfc3339()));
        Value::Object(obj)
    };
    trades.insert(0, entry.clone());
    write_trades(&state, &trades);

    let sent = trade["youCards"].as_array().map(|a| a.len()).unwrap_or(0);
    let recv = trade["themCards"].as_array().map(|a| a.len()).unwrap_or(0);
    let them_name = trade["themName"].as_str().unwrap_or("").to_string();
    append_activity(&state, json!({
        "type": "trade_logged",
        "message": if !them_name.is_empty() { format!("Trade with {}", them_name) } else { "Logged a trade".to_string() },
        "detail": format!("{} card{} sent · {} received", sent, if sent != 1 { "s" } else { "" }, recv),
    }));

    entry
}

#[tauri::command]
pub fn trades_update(state: State<'_, AppState>, id: String, trade: Value) -> bool {
    let mut trades = read_trades(&state);
    if let Some(idx) = trades.iter().position(|t| t["id"].as_str() == Some(&id)) {
        if let Some(existing) = trades[idx].as_object() {
            let mut merged = existing.clone();
            if let Some(upd) = trade.as_object() {
                for (k, v) in upd {
                    merged.insert(k.clone(), v.clone());
                }
            }
            trades[idx] = Value::Object(merged);
        }
        write_trades(&state, &trades);
        true
    } else {
        false
    }
}

#[tauri::command]
pub fn trades_delete(state: State<'_, AppState>, id: String) -> bool {
    let trades: Vec<Value> = read_trades(&state)
        .into_iter()
        .filter(|t| t["id"].as_str() != Some(&id))
        .collect();
    write_trades(&state, &trades);
    true
}

// Stubs — trades:execute and trades:undo are complex and require card mutations;
// porting them fully is Phase 5.
#[tauri::command]
pub async fn trades_execute(_state: State<'_, AppState>, _payload: Value) -> Result<Value, String> {
    Err("trades:execute not yet implemented in Tauri build".into())
}

#[tauri::command]
pub async fn trades_undo(_state: State<'_, AppState>, _trade_id: String) -> Result<Value, String> {
    Err("trades:undo not yet implemented in Tauri build".into())
}
