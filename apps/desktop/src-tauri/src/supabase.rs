use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[derive(Debug, Deserialize)]
struct AuthResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    user: Option<AuthUser>,
    error_description: Option<String>,
    error: Option<String>,
    msg: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: Option<String>,
}

pub struct SupabaseClient {
    client: Client,
    url: String,
    anon_key: String,
}

impl SupabaseClient {
    pub fn new(url: &str, anon_key: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.trim_end_matches('/').to_string(),
            anon_key: anon_key.to_string(),
        }
    }

    fn bearer(&self, access_token: &str) -> String {
        if access_token.is_empty() {
            format!("Bearer {}", self.anon_key)
        } else {
            format!("Bearer {}", access_token)
        }
    }

    fn auth(&self, path: &str) -> String {
        format!("{}/auth/v1{}", self.url, path)
    }

    fn rest(&self, table: &str) -> String {
        format!("{}/rest/v1/{}", self.url, table)
    }

    fn rpc_url(&self, func: &str) -> String {
        format!("{}/rest/v1/rpc/{}", self.url, func)
    }

    fn err_from(r: &AuthResponse) -> Option<String> {
        r.error_description
            .clone()
            .or_else(|| r.error.clone())
            .or_else(|| r.msg.clone())
            .or_else(|| r.message.clone())
    }

    // ── Auth API ──────────────────────────────────────────────────────────────

    pub async fn sign_in_with_password(
        &self,
        email: &str,
        password: &str,
    ) -> Result<(String, String, u64, String, String), String> {
        let res = self
            .client
            .post(self.auth("/token?grant_type=password"))
            .header("apikey", &self.anon_key)
            .json(&json!({ "email": email, "password": password }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let body: AuthResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(e) = Self::err_from(&body) {
            return Err(e);
        }

        let at = body.access_token.ok_or("Missing access_token")?;
        let rt = body.refresh_token.ok_or("Missing refresh_token")?;
        let exp = now_secs() + body.expires_in.unwrap_or(3600);
        let user = body.user.ok_or("Missing user")?;
        let uid = user.id;
        let uemail = user.email.unwrap_or_else(|| email.to_string());

        Ok((at, rt, exp, uid, uemail))
    }

    pub async fn sign_up(
        &self,
        email: &str,
        password: &str,
    ) -> Result<(String, Option<(String, String, u64)>), String> {
        let res = self
            .client
            .post(self.auth("/signup"))
            .header("apikey", &self.anon_key)
            .json(&json!({ "email": email, "password": password }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let body: AuthResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(e) = Self::err_from(&body) {
            return Err(e);
        }

        let user = body.user.ok_or("No user returned from signup")?;
        let uid = user.id;

        let session = match (body.access_token, body.refresh_token) {
            (Some(at), Some(rt)) => {
                let exp = now_secs() + body.expires_in.unwrap_or(3600);
                Some((at, rt, exp))
            }
            _ => None,
        };

        Ok((uid, session))
    }

    pub async fn sign_out(&self, access_token: &str) -> Result<(), String> {
        self.client
            .post(self.auth("/logout"))
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn refresh_token(
        &self,
        refresh_token: &str,
    ) -> Result<(String, String, u64), String> {
        let res = self
            .client
            .post(self.auth("/token?grant_type=refresh_token"))
            .header("apikey", &self.anon_key)
            .json(&json!({ "refresh_token": refresh_token }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let body: AuthResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(e) = Self::err_from(&body) {
            return Err(e);
        }

        let at = body.access_token.ok_or("Missing access_token")?;
        let rt = body.refresh_token.ok_or("Missing refresh_token")?;
        let exp = now_secs() + body.expires_in.unwrap_or(3600);

        Ok((at, rt, exp))
    }

    pub async fn send_otp(&self, email: &str) -> Result<(), String> {
        let res = self
            .client
            .post(self.auth("/otp"))
            .header("apikey", &self.anon_key)
            .json(&json!({ "email": email, "options": { "shouldCreateUser": false } }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let body: Value = res.json().await.unwrap_or_default();
            return Err(body["error_description"]
                .as_str()
                .or_else(|| body["msg"].as_str())
                .unwrap_or("Failed to send OTP")
                .to_string());
        }
        Ok(())
    }

    pub async fn verify_otp(
        &self,
        email: &str,
        token: &str,
    ) -> Result<(String, String, u64, String), String> {
        let res = self
            .client
            .post(self.auth("/verify"))
            .header("apikey", &self.anon_key)
            .json(&json!({ "email": email, "token": token, "type": "email" }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let body: AuthResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(e) = Self::err_from(&body) {
            return Err(e);
        }

        let at = body.access_token.ok_or("Missing access_token")?;
        let rt = body.refresh_token.ok_or("Missing refresh_token")?;
        let exp = now_secs() + body.expires_in.unwrap_or(3600);
        let uid = body.user.map(|u| u.id).unwrap_or_default();

        Ok((at, rt, exp, uid))
    }

    pub async fn update_password(&self, access_token: &str, new_password: &str) -> Result<(), String> {
        let res = self
            .client
            .put(self.auth("/user"))
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .json(&json!({ "password": new_password }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let body: Value = res.json().await.unwrap_or_default();
            return Err(body["error_description"]
                .as_str()
                .or_else(|| body["msg"].as_str())
                .unwrap_or("Failed to update password")
                .to_string());
        }
        Ok(())
    }

    // ── PostgREST API ─────────────────────────────────────────────────────────

    pub async fn select(
        &self,
        access_token: &str,
        table: &str,
        query: &str,
    ) -> Result<Value, String> {
        let url = format!("{}?{}", self.rest(table), query);
        let res = self
            .client
            .get(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let body: Value = res.json().await.unwrap_or_default();
            return Err(body["message"]
                .as_str()
                .unwrap_or("Query failed")
                .to_string());
        }
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn insert(
        &self,
        access_token: &str,
        table: &str,
        data: Value,
    ) -> Result<Value, String> {
        let res = self
            .client
            .post(self.rest(table))
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .header("Prefer", "return=representation")
            .json(&data)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let body: Value = res.json().await.unwrap_or_default();
            return Err(body["message"].as_str().unwrap_or("Insert failed").to_string());
        }
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn upsert(
        &self,
        access_token: &str,
        table: &str,
        data: Value,
    ) -> Result<Value, String> {
        let res = self
            .client
            .post(self.rest(table))
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .header("Prefer", "return=representation,resolution=merge-duplicates")
            .json(&data)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let body: Value = res.json().await.unwrap_or_default();
            return Err(body["message"].as_str().unwrap_or("Upsert failed").to_string());
        }
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn delete(&self, access_token: &str, table: &str, query: &str) -> Result<(), String> {
        let url = format!("{}?{}", self.rest(table), query);
        self.client
            .delete(&url)
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_auth_user(&self, service_key: &str, user_id: &str) -> Result<(), String> {
        let url = format!("{}/auth/v1/admin/users/{}", self.url, user_id);
        self.client
            .delete(&url)
            .header("apikey", service_key)
            .header("Authorization", format!("Bearer {}", service_key))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn rpc(
        &self,
        access_token: &str,
        func: &str,
        params: Value,
    ) -> Result<Value, String> {
        let res = self
            .client
            .post(self.rpc_url(func))
            .header("apikey", &self.anon_key)
            .header("Authorization", self.bearer(access_token))
            .json(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let body: Value = res.json().await.unwrap_or_default();
            return Err(body["message"].as_str().unwrap_or("RPC failed").to_string());
        }
        res.json().await.map_err(|e| e.to_string())
    }
}
