use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

pub fn read_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Option<T> {
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn write_json<T: Serialize>(path: &PathBuf, data: &T) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(data) {
        let _ = std::fs::write(path, content);
    }
}

pub fn local_date_str() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

pub fn calc_change(current: Option<f64>, previous: Option<f64>) -> Option<f64> {
    let c = current?;
    let p = previous?;
    if p == 0.0 {
        return None;
    }
    Some(((c - p) / p * 10_000.0).round() / 100.0)
}

pub fn is_pocket_card(card: &Value) -> bool {
    let series = card
        .get("setSeries")
        .or_else(|| card.get("set").and_then(|s| s.get("series")))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    if series.contains("pocket") {
        return true;
    }
    let set_id = card
        .get("setId")
        .or_else(|| card.get("set").and_then(|s| s.get("id")))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    // Pocket IDs: A1, A1a, A2, B1, B1a, B2 ... and promos P-A, P-B
    is_pocket_set_id(set_id)
}

fn is_pocket_set_id(set_id: &str) -> bool {
    if set_id.is_empty() {
        return false;
    }
    let bytes = set_id.as_bytes();
    // P-X pattern (Pocket promos: P-A, P-B, ...)
    if bytes.len() >= 3 && bytes[0].to_ascii_uppercase() == b'P' && bytes[1] == b'-' && bytes[2].is_ascii_alphabetic() {
        return true;
    }
    // Pocket expansion IDs are UPPERCASE letter + digit (A1, A1a, B1, B1a, ...).
    // Lowercase-letter + digit sets (e.g. g1 = Generations) are real TCG sets, not Pocket.
    bytes[0].is_ascii_uppercase() && bytes.get(1).map(|b| b.is_ascii_digit()).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pocket_sets_correctly_identified() {
        assert!(is_pocket_set_id("A1"));
        assert!(is_pocket_set_id("A1a"));
        assert!(is_pocket_set_id("A2"));
        assert!(is_pocket_set_id("B1"));
        assert!(is_pocket_set_id("B1a"));
        assert!(is_pocket_set_id("B2"));
        assert!(is_pocket_set_id("P-A"));
        assert!(is_pocket_set_id("P-B"));
    }

    #[test]
    fn real_tcg_sets_not_flagged_as_pocket() {
        assert!(!is_pocket_set_id("g1"));   // Generations
        assert!(!is_pocket_set_id("sv1"));  // Scarlet & Violet Base
        assert!(!is_pocket_set_id("swsh1"));
        assert!(!is_pocket_set_id("base1"));
        assert!(!is_pocket_set_id("xy1"));
        assert!(!is_pocket_set_id("mep"));  // MEP Black Star Promos
        assert!(!is_pocket_set_id("me02"));
        assert!(!is_pocket_set_id(""));
    }
}

pub fn is_valid_uuid(s: &str) -> bool {
    let parts: Vec<&str> = s.splitn(6, '-').collect();
    if parts.len() != 5 {
        return false;
    }
    let expected = [8usize, 4, 4, 4, 12];
    parts.iter().zip(expected.iter()).all(|(p, &len)| {
        p.len() == len && p.chars().all(|c| c.is_ascii_hexdigit())
    })
}
