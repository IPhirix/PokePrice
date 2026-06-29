mod auth;
mod cards;
mod db;
mod misc;
mod prices;
mod settings;
mod shows;
mod state;
mod supabase;
mod tcgdex;
mod trades;
mod utils;

use state::AppState;
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env from project root in dev, or next to exe in production
    #[cfg(debug_assertions)]
    {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        // src-tauri → apps/desktop → apps → PokePrice
        let root = manifest
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.join(".env"));
        if let Some(path) = root {
            dotenvy::from_path(path).ok();
        }
    }
    #[cfg(not(debug_assertions))]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                dotenvy::from_path(dir.join(".env")).ok();
            }
        }
    }

    let supabase_url = std::env::var("SUPABASE_URL").unwrap_or_default();
    let supabase_anon_key = std::env::var("SUPABASE_ANON_KEY").unwrap_or_default();
    let supabase_service_key = std::env::var("SUPABASE_SERVICE_ROLE_KEY").unwrap_or_default();
    let database_url = std::env::var("DATABASE_URL").unwrap_or_default();

    // Match Electron's userData path: {appData}/pokeprice
    let data_dir = dirs::data_dir()
        .expect("Cannot locate app data directory")
        .join("pokeprice");
    std::fs::create_dir_all(&data_dir).expect("Cannot create data directory");

    let app_state = AppState::new(data_dir, supabase_url, supabase_anon_key, supabase_service_key, database_url);

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth::auth_is_setup,
            auth::auth_is_session_valid,
            auth::auth_create_user,
            auth::auth_login,
            auth::auth_logout,
            auth::auth_get_username,
            auth::auth_get_user_list,
            auth::auth_get_security_question,
            auth::auth_get_security_question_for_user,
            auth::auth_verify_security_answer,
            auth::auth_verify_security_answer_for_user,
            auth::auth_send_reset_email,
            auth::auth_verify_email_code,
            auth::auth_reset_password,
            auth::auth_change_password,
            auth::auth_update_security_question,
            auth::auth_set_stay_logged_in,
            auth::auth_get_stay_logged_in,
            // Settings
            settings::settings_get,
            settings::settings_set,
            // Cards
            cards::cards_list,
            cards::cards_list_sold,
            cards::cards_add,
            cards::cards_remove,
            cards::cards_update,
            cards::cards_sell,
            cards::cards_apply_default_targets,
            cards::cards_clear_all_targets,
            // Binders
            cards::binders_list,
            cards::binders_add,
            cards::binders_delete,
            cards::binders_rename,
            // Account
            cards::account_get_stats,
            cards::account_append_activity,
            cards::account_get_activity,
            cards::account_remove_activity,
            cards::account_clear,
            cards::account_delete,
            cards::alerts_get_triggered,
            // Prices
            prices::prices_history,
            prices::prices_set_manual,
            prices::prices_update_entry,
            prices::prices_delete_entry,
            prices::prices_clear_history,
            prices::prices_portfolio,
            prices::prices_refresh,
            prices::prices_all_conditions,
            prices::prices_for_tcg_card,
            prices::prices_diagnose,
            // Trades
            trades::trades_list,
            trades::trades_save,
            trades::trades_update,
            trades::trades_delete,
            trades::trades_execute,
            trades::trades_undo,
            // Shows / geocode
            shows::upcoming_list,
            shows::upcoming_add,
            shows::upcoming_remove,
            shows::card_shows_fetch,
            shows::geocode_batch,
            // Misc / stubs
            misc::app_version,
            misc::app_locale,
            misc::shell_open_external,
            misc::cards_search,
            misc::cards_search_advanced,
            misc::cards_get_by_id,
            misc::cards_get_variations,
            misc::cards_export,
            misc::sets_list,
            misc::etb_lookup,
            misc::etb_get_all,
            misc::sealed_search,
            misc::sealed_add,
            misc::email_test,
            misc::pick_profile_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
