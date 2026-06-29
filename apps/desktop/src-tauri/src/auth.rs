use hex;
use pbkdf2::pbkdf2_hmac;
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha512;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::state::{AppState, OtpEntry, StoredSession};
use crate::supabase::SupabaseClient;

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn generate_hex_token() -> String {
    let bytes: [u8; 32] = rand::thread_rng().gen();
    hex::encode(bytes)
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut dk = [0u8; 64];
    pbkdf2_hmac::<Sha512>(password.as_bytes(), salt.as_bytes(), 100_000, &mut dk);
    hex::encode(dk)
}

fn is_valid_username(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

// ── File helpers ──────────────────────────────────────────────────────────────

fn read_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Option<T> {
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_json<T: Serialize>(path: &PathBuf, data: &T) {
    if let Ok(content) = serde_json::to_string_pretty(data) {
        let _ = std::fs::write(path, content);
    }
}

// ── Known users ───────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct KnownUser {
    pub username: String,
    #[serde(rename = "firstName", skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    pub email: String,
}

fn read_known_users(state: &AppState) -> Vec<KnownUser> {
    read_json(&state.known_users_file()).unwrap_or_default()
}

fn write_known_users(state: &AppState, list: &[KnownUser]) {
    write_json(&state.known_users_file(), &list);
}

fn upsert_known_user(state: &AppState, entry: KnownUser) {
    let mut list = read_known_users(state);
    if let Some(idx) = list.iter().position(|u| u.username == entry.username) {
        list[idx] = entry;
    } else {
        list.push(entry);
    }
    write_known_users(state, &list);
}

// ── Auth prefs ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct AuthPrefs {
    #[serde(rename = "stayLoggedIn")]
    stay_logged_in: Option<bool>,
}

fn read_auth_prefs(state: &AppState) -> AuthPrefs {
    read_json(&state.auth_prefs_file()).unwrap_or(AuthPrefs { stay_logged_in: None })
}

fn write_auth_prefs(state: &AppState, prefs: &AuthPrefs) {
    write_json(&state.auth_prefs_file(), prefs);
}

// ── Session ───────────────────────────────────────────────────────────────────

fn save_session(state: &AppState, session: &StoredSession) {
    write_json(&state.session_file(), session);
    *state.session.lock().unwrap() = Some(session.clone());
}

fn load_session(state: &AppState) -> Option<StoredSession> {
    let s: StoredSession = read_json(&state.session_file())?;
    *state.session.lock().unwrap() = Some(s.clone());
    Some(s)
}

fn clear_session(state: &AppState) {
    *state.session.lock().unwrap() = None;
    let _ = std::fs::remove_file(state.session_file());
}

fn get_sb(state: &AppState) -> Option<SupabaseClient> {
    if state.supabase_url.is_empty() || state.supabase_anon_key.is_empty() {
        return None;
    }
    Some(SupabaseClient::new(&state.supabase_url, &state.supabase_anon_key))
}

// Returns (access_token, user_id), refreshing if needed.
pub async fn valid_token_pub(state: &AppState) -> Option<(String, String)> {
    valid_token(state).await
}

async fn valid_token(state: &AppState) -> Option<(String, String)> {
    let session = {
        let g = state.session.lock().unwrap();
        g.clone()
    }
    .or_else(|| load_session(state))?;

    let sb = get_sb(state)?;

    if now_secs() + 60 >= session.expires_at {
        match sb.refresh_token(&session.refresh_token).await {
            Ok((at, rt, exp)) => {
                let new = StoredSession {
                    access_token: at.clone(),
                    refresh_token: rt,
                    expires_at: exp,
                    user_id: session.user_id.clone(),
                    email: session.email.clone(),
                };
                save_session(state, &new);
                Some((at, session.user_id))
            }
            Err(_) => None,
        }
    } else {
        Some((session.access_token, session.user_id))
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn auth_is_setup(state: State<'_, AppState>) -> Result<bool, String> {
    if !read_known_users(&state).is_empty() {
        return Ok(true);
    }
    Ok(state.auth_file().exists())
}

#[tauri::command]
pub async fn auth_is_session_valid(state: State<'_, AppState>) -> Result<bool, String> {
    if state.supabase_url.is_empty() {
        return Ok(false);
    }

    let prefs = read_auth_prefs(&state);
    if prefs.stay_logged_in == Some(false) {
        clear_session(&state);
        return Ok(false);
    }

    let Some((at, uid)) = valid_token(&state).await else {
        return Ok(false);
    };

    let sb = match get_sb(&state) {
        Some(s) => s,
        None => return Ok(false),
    };

    let rows = sb
        .select(&at, "user_profiles", &format!("id=eq.{}&select=username", uid))
        .await
        .ok();

    let username = rows
        .as_ref()
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|r| r["username"].as_str())
        .map(|s| s.to_string());

    match username {
        Some(u) => {
            *state.current_user.lock().unwrap() = Some(u);
            Ok(true)
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn auth_create_user(
    state: State<'_, AppState>,
    username: String,
    password: String,
    #[allow(non_snake_case)] securityQuestion: Option<String>,
    #[allow(non_snake_case)] securityAnswer: Option<String>,
    #[allow(non_snake_case)] stayLoggedIn: Option<bool>,
    profile: Option<Value>,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Cloud auth not configured.")?;

    let email = profile
        .as_ref()
        .and_then(|p| p["email"].as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if email.is_empty() {
        return Err("An email address is required.".into());
    }

    let uname = username.trim().to_lowercase();
    if !is_valid_username(&uname) {
        return Err("Username may only contain letters, numbers, hyphens, and underscores (max 64 characters).".into());
    }

    // Check username availability (best-effort; DB UNIQUE is the real guard)
    if let Ok(rows) = sb
        .select(
            "",
            "user_profiles",
            &format!("username=eq.{}&select=username", uname),
        )
        .await
    {
        if rows.as_array().map(|a| !a.is_empty()).unwrap_or(false) {
            return Err("That username is already taken.".into());
        }
    }

    let (uid, session) = sb.sign_up(&email, &password).await?;

    let sec_ans = securityAnswer.as_deref().unwrap_or("").trim().to_lowercase();
    let sec_salt = generate_hex_token();
    let sec_hash = hash_password(&sec_ans, &sec_salt);

    let (at, rt, exp) = session.ok_or("Account requires email confirmation.")?;

    sb.insert(
        &at,
        "user_profiles",
        json!({
            "id": uid,
            "username": uname,
            "first_name": profile.as_ref().and_then(|p| p["firstName"].as_str()).unwrap_or(""),
            "currency": profile.as_ref().and_then(|p| p["currency"].as_str()).unwrap_or("USD"),
            "state": profile.as_ref().and_then(|p| p["state"].as_str()),
            "zip_code": profile.as_ref().and_then(|p| p["zipCode"].as_str()),
            "profile_picture": profile.as_ref().and_then(|p| p["profilePicture"].as_str()),
            "security_question": securityQuestion.as_deref().unwrap_or(""),
            "security_answer_hash": sec_hash,
            "security_answer_salt": sec_salt,
        }),
    )
    .await
    .map_err(|e| format!("Failed to save profile: {}", e))?;

    let stay = stayLoggedIn.unwrap_or(true);
    write_auth_prefs(&state, &AuthPrefs { stay_logged_in: Some(stay) });

    let sess = StoredSession {
        access_token: at,
        refresh_token: rt,
        expires_at: exp,
        user_id: uid,
        email: email.clone(),
    };
    save_session(&state, &sess);

    upsert_known_user(
        &state,
        KnownUser {
            username: uname.clone(),
            first_name: profile.as_ref().and_then(|p| p["firstName"].as_str()).map(|s| s.to_string()),
            email,
        },
    );
    *state.current_user.lock().unwrap() = Some(uname);

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>,
    username: String,
    password: String,
    email: Option<String>,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Cloud auth not configured.")?;

    {
        let lock = state.login_lock.lock().unwrap();
        if *lock {
            return Err("A login is already in progress.".into());
        }
    }
    *state.login_lock.lock().unwrap() = true;

    let result = do_login(&state, &sb, username, password, email).await;
    *state.login_lock.lock().unwrap() = false;
    result
}

async fn do_login(
    state: &AppState,
    sb: &SupabaseClient,
    username: String,
    password: String,
    _email: Option<String>,
) -> Result<Value, String> {
    let uname = username.trim().to_lowercase();
    if !is_valid_username(&uname) {
        return Ok(json!({ "ok": false, "error": "Invalid username or password." }));
    }

    let known_users = read_known_users(state);
    let known = match known_users.iter().find(|u| u.username == uname) {
        Some(k) => k.clone(),
        None => return Ok(json!({ "ok": false, "error": "Invalid username or password." })),
    };

    let prefs = read_auth_prefs(state);
    let stay = prefs.stay_logged_in.unwrap_or(true);
    write_auth_prefs(state, &AuthPrefs { stay_logged_in: Some(stay) });

    match sb.sign_in_with_password(&known.email, &password).await {
        Ok((at, rt, exp, uid, uemail)) => {
            let sess = StoredSession {
                access_token: at,
                refresh_token: rt,
                expires_at: exp,
                user_id: uid,
                email: uemail,
            };
            save_session(state, &sess);
            *state.current_user.lock().unwrap() = Some(uname);
            Ok(json!({ "ok": true }))
        }
        Err(_) => Ok(json!({ "ok": false, "error": "Invalid username or password." })),
    }
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AppState>) -> Result<(), String> {
    let at = state.session.lock().unwrap().as_ref().map(|s| s.access_token.clone());
    if let (Some(at), Some(sb)) = (at, get_sb(&state)) {
        let _ = sb.sign_out(&at).await;
    }
    clear_session(&state);
    *state.current_user.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn auth_get_username(state: State<'_, AppState>) -> Option<String> {
    state.current_user.lock().unwrap().clone()
}

#[tauri::command]
pub fn auth_get_user_list(state: State<'_, AppState>) -> Vec<Value> {
    read_known_users(&state)
        .into_iter()
        .map(|u| json!({ "username": u.username, "firstName": u.first_name.unwrap_or_default() }))
        .collect()
}

#[tauri::command]
pub async fn auth_get_security_question_for_user(
    state: State<'_, AppState>,
    username: String,
) -> Result<Option<String>, String> {
    let Some(sb) = get_sb(&state) else { return Ok(None) };
    let u = username.trim().to_lowercase();
    let result = sb
        .rpc("", "get_security_question", json!({ "p_username": u }))
        .await
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()));
    Ok(result)
}

#[tauri::command]
pub async fn auth_get_security_question(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let Some(sb) = get_sb(&state) else { return Ok(None) };
    let Some((at, uid)) = valid_token(&state).await else { return Ok(None) };
    let rows = sb
        .select(&at, "user_profiles", &format!("id=eq.{}&select=security_question", uid))
        .await
        .ok();
    let result = rows
        .as_ref()
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|r| r["security_question"].as_str())
        .map(|s| s.to_string());
    Ok(result)
}

#[tauri::command]
pub async fn auth_verify_security_answer_for_user(
    state: State<'_, AppState>,
    username: String,
    answer: String,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Not configured")?;
    let u = username.trim().to_lowercase();
    let a = answer.trim().to_lowercase();

    let salt = sb
        .rpc("", "get_security_salt", json!({ "p_username": u }))
        .await
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("User not found.")?;

    let hash = hash_password(&a, &salt);
    let is_valid = sb
        .rpc("", "verify_security_answer_hash", json!({ "p_username": u, "p_hash": hash }))
        .await
        .ok()
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !is_valid {
        return Ok(json!({ "ok": false, "error": "Incorrect answer." }));
    }

    let token = generate_hex_token();
    state.reset_tokens.lock().unwrap().insert(token.clone(), u);
    Ok(json!({ "ok": true, "resetToken": token }))
}

#[tauri::command]
pub async fn auth_verify_security_answer(
    state: State<'_, AppState>,
    answer: String,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Not configured")?;
    let current = state
        .current_user
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated")?;
    let (at, uid) = valid_token(&state).await.ok_or("Session invalid")?;

    let rows = sb
        .select(
            &at,
            "user_profiles",
            &format!("id=eq.{}&select=security_answer_hash,security_answer_salt", uid),
        )
        .await?;
    let row = rows
        .as_array()
        .and_then(|a| a.first())
        .ok_or("Profile not found")?;

    let salt = row["security_answer_salt"].as_str().unwrap_or("");
    let stored = row["security_answer_hash"].as_str().unwrap_or("");
    let hash = hash_password(&answer.trim().to_lowercase(), salt);

    if hash != stored {
        return Ok(json!({ "ok": false, "error": "Incorrect answer." }));
    }

    let token = generate_hex_token();
    state.reset_tokens.lock().unwrap().insert(token.clone(), current);
    Ok(json!({ "ok": true, "resetToken": token }))
}

#[tauri::command]
pub async fn auth_send_reset_email(
    state: State<'_, AppState>,
    username: Option<String>,
    email: Option<String>,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Not configured")?;

    let known = username.as_deref().map(|u| {
        let u = u.trim().to_lowercase();
        read_known_users(&state).into_iter().find(|k| k.username == u)
    }).flatten();

    let resolved = known
        .as_ref()
        .map(|k| k.email.clone())
        .or(email)
        .unwrap_or_default()
        .trim()
        .to_lowercase();

    if resolved.is_empty() {
        return Ok(json!({ "ok": true }));
    }

    let now = now_secs();
    {
        let cd = state.otp_send_cooldown.lock().unwrap();
        if cd.get(&resolved).map(|t| now - t < 60).unwrap_or(false) {
            return Err("Please wait before requesting another code.".into());
        }
    }

    state.otp_send_cooldown.lock().unwrap().insert(resolved.clone(), now);
    state.otp_attempts.lock().unwrap().remove(&resolved);
    state.otp_reset_emails.lock().unwrap().insert(
        resolved.clone(),
        OtpEntry {
            _email: resolved.clone(),
            username: known.map(|k| k.username).unwrap_or_else(|| username.unwrap_or_default()),
        },
    );

    if let Err(_) = sb.send_otp(&resolved).await {
        state.otp_reset_emails.lock().unwrap().remove(&resolved);
        state.otp_send_cooldown.lock().unwrap().remove(&resolved);
        return Err("Failed to send code. Please try again.".into());
    }

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn auth_verify_email_code(
    state: State<'_, AppState>,
    code: String,
    email: String,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Not configured")?;
    let email = email.trim().to_lowercase();

    let entry_username = state
        .otp_reset_emails
        .lock()
        .unwrap()
        .get(&email)
        .map(|e| e.username.clone())
        .ok_or("No reset email on record. Request a new code.")?;

    let attempts = {
        let mut map = state.otp_attempts.lock().unwrap();
        let c = map.entry(email.clone()).or_insert(0);
        *c += 1;
        *c
    };
    if attempts > 10 {
        return Ok(json!({ "ok": false, "error": "Too many attempts. Request a new code." }));
    }

    match sb.verify_otp(&email, code.trim()).await {
        Err(_) => Ok(json!({ "ok": false, "error": "Incorrect or expired code." })),
        Ok((at, rt, exp, uid)) => {
            let token = generate_hex_token();
            state.reset_tokens.lock().unwrap().insert(token.clone(), entry_username);
            state.otp_attempts.lock().unwrap().remove(&email);
            state.otp_reset_emails.lock().unwrap().remove(&email);

            let sess = StoredSession {
                access_token: at,
                refresh_token: rt,
                expires_at: exp,
                user_id: uid,
                email: email.clone(),
            };
            save_session(&state, &sess);

            Ok(json!({ "ok": true, "resetToken": token }))
        }
    }
}

#[tauri::command]
pub async fn auth_reset_password(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] resetToken: String,
    #[allow(non_snake_case)] newPassword: String,
) -> Result<Value, String> {
    let _username = state
        .reset_tokens
        .lock()
        .unwrap()
        .remove(&resetToken)
        .ok_or("Invalid or expired reset token.")?;

    let sb = get_sb(&state).ok_or("Not configured")?;
    let (at, _) = valid_token(&state).await.ok_or("Session required for password reset.")?;

    sb.update_password(&at, &newPassword)
        .await
        .map_err(|e| format!("Failed to update password: {}", e))?;

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn auth_change_password(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] currentPassword: String,
    #[allow(non_snake_case)] newPassword: String,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Not configured")?;
    let current = state
        .current_user
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated.")?;

    let known_users = read_known_users(&state);
    let known = known_users
        .iter()
        .find(|u| u.username == current)
        .ok_or("No account found.")?;

    sb.sign_in_with_password(&known.email, &currentPassword)
        .await
        .map_err(|_| "Current password is incorrect.".to_string())?;

    let (at, _) = valid_token(&state).await.ok_or("Session invalid")?;
    sb.update_password(&at, &newPassword)
        .await
        .map_err(|_| "Failed to update password.".to_string())?;

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn auth_update_security_question(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] currentPassword: String,
    #[allow(non_snake_case)] securityQuestion: String,
    #[allow(non_snake_case)] securityAnswer: String,
) -> Result<Value, String> {
    let sb = get_sb(&state).ok_or("Not configured")?;
    let current = state
        .current_user
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated.")?;

    let known_users = read_known_users(&state);
    let known = known_users
        .iter()
        .find(|u| u.username == current)
        .ok_or("No account found.")?;

    sb.sign_in_with_password(&known.email, &currentPassword)
        .await
        .map_err(|_| "Current password is incorrect.".to_string())?;

    let (at, uid) = valid_token(&state).await.ok_or("Session invalid")?;

    let sec_salt = generate_hex_token();
    let sec_hash = hash_password(&securityAnswer.trim().to_lowercase(), &sec_salt);

    sb.upsert(
        &at,
        "user_profiles",
        json!({
            "id": uid,
            "security_question": securityQuestion,
            "security_answer_hash": sec_hash,
            "security_answer_salt": sec_salt,
        }),
    )
    .await
    .map_err(|_| "Failed to update security question.".to_string())?;

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn auth_set_stay_logged_in(state: State<'_, AppState>, #[allow(non_snake_case)] stayLoggedIn: bool) -> bool {
    write_auth_prefs(&state, &AuthPrefs { stay_logged_in: Some(stayLoggedIn) });
    true
}

#[tauri::command]
pub fn auth_get_stay_logged_in(state: State<'_, AppState>) -> bool {
    read_auth_prefs(&state).stay_logged_in.unwrap_or(true)
}
