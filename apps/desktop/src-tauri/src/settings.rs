use serde_json::{json, Value};
use tauri::State;

use crate::auth::valid_token_pub;
use crate::state::AppState;
use crate::supabase::SupabaseClient;
use crate::utils::{read_json, write_json};

pub fn read_settings(state: &AppState) -> Value {
    state
        .settings_file()
        .and_then(|f| read_json::<Value>(&f))
        .unwrap_or(json!({}))
}

pub fn write_settings(state: &AppState, s: &Value) {
    if let Some(f) = state.settings_file() {
        write_json(&f, s);
    }
}

fn get_sb(state: &AppState) -> Option<SupabaseClient> {
    if state.supabase_url.is_empty() || state.supabase_anon_key.is_empty() {
        return None;
    }
    Some(SupabaseClient::new(&state.supabase_url, &state.supabase_anon_key))
}

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> Value {
    read_settings(&state)
}

#[tauri::command]
pub async fn settings_set(state: State<'_, AppState>, s: Value) -> Result<bool, String> {
    let current = read_settings(&state);
    let merged = if let (Some(cur), Some(new)) = (current.as_object(), s.as_object()) {
        let mut m = cur.clone();
        for (k, v) in new {
            m.insert(k.clone(), v.clone());
        }
        Value::Object(m)
    } else {
        s.clone()
    };
    write_settings(&state, &merged);

    // Sync profile fields to Supabase if profile is being updated
    if s.get("profile").is_some() {
        if let (Some(sb), Some((at, uid))) =
            (get_sb(&state), valid_token_pub(&state).await)
        {
            let p = &s["profile"];
            let mut patch = serde_json::Map::new();
            patch.insert("id".into(), Value::String(uid));
            if let Some(v) = p.get("firstName") {
                patch.insert("first_name".into(), v.clone());
            }
            if let Some(v) = p.get("currency") {
                patch.insert("currency".into(), v.clone());
            }
            if let Some(v) = p.get("state") {
                patch.insert("state".into(), v.clone());
            }
            if let Some(v) = p.get("zipCode") {
                patch.insert("zip_code".into(), v.clone());
            }
            if let Some(v) = p.get("profilePicture") {
                patch.insert("profile_picture".into(), v.clone());
            }
            if patch.len() > 1 {
                let _ = sb.upsert(&at, "user_profiles", Value::Object(patch)).await;
            }
        }
    }

    Ok(true)
}
