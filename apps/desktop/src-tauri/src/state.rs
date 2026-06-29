use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
    pub user_id: String,
    pub email: String,
}

pub struct OtpEntry {
    pub _email: String,
    pub username: String,
}

pub struct AppState {
    pub current_user: Mutex<Option<String>>,
    pub login_lock: Mutex<bool>,
    pub session: Mutex<Option<StoredSession>>,
    pub reset_tokens: Mutex<HashMap<String, String>>,
    pub otp_send_cooldown: Mutex<HashMap<String, u64>>,
    pub otp_attempts: Mutex<HashMap<String, u32>>,
    pub otp_reset_emails: Mutex<HashMap<String, OtpEntry>>,
    pub data_dir: PathBuf,
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub supabase_service_key: String,
    pub database_url: String,
}

impl AppState {
    pub fn new(
        data_dir: PathBuf,
        supabase_url: String,
        supabase_anon_key: String,
        supabase_service_key: String,
        database_url: String,
    ) -> Self {
        Self {
            current_user: Mutex::new(None),
            login_lock: Mutex::new(false),
            session: Mutex::new(None),
            reset_tokens: Mutex::new(HashMap::new()),
            otp_send_cooldown: Mutex::new(HashMap::new()),
            otp_attempts: Mutex::new(HashMap::new()),
            otp_reset_emails: Mutex::new(HashMap::new()),
            data_dir,
            supabase_url,
            supabase_anon_key,
            supabase_service_key,
            database_url,
        }
    }

    // ── Global data dir paths ─────────────────────────────────────────────────

    pub fn session_file(&self) -> PathBuf {
        self.data_dir.join("tauri-session.json")
    }

    pub fn known_users_file(&self) -> PathBuf {
        self.data_dir.join("known-users.json")
    }

    pub fn auth_prefs_file(&self) -> PathBuf {
        self.data_dir.join("auth-prefs.json")
    }

    pub fn auth_file(&self) -> PathBuf {
        self.data_dir.join("auth.json")
    }

    // ── User-scoped paths ─────────────────────────────────────────────────────

    pub fn user_dir(&self, username: &str) -> PathBuf {
        self.data_dir.join("users").join(username)
    }

    pub fn current_user_dir(&self) -> Option<PathBuf> {
        let user = self.current_user.lock().unwrap().clone()?;
        Some(self.user_dir(&user))
    }

    pub fn cards_file(&self) -> Option<PathBuf> {
        Some(self.current_user_dir()?.join("cards.json"))
    }

    pub fn prices_file(&self, card_id: &str) -> Option<PathBuf> {
        Some(self.current_user_dir()?.join(format!("prices-{}.json", card_id)))
    }

    pub fn settings_file(&self) -> Option<PathBuf> {
        Some(self.current_user_dir()?.join("settings.json"))
    }

    pub fn trades_file(&self) -> Option<PathBuf> {
        Some(self.current_user_dir()?.join("trades.json"))
    }

    pub fn activity_file(&self) -> Option<PathBuf> {
        Some(self.current_user_dir()?.join("activity.json"))
    }

    pub fn upcoming_shows_file(&self) -> Option<PathBuf> {
        Some(self.current_user_dir()?.join("upcoming-shows.json"))
    }
}
