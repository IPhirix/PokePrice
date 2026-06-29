CREATE TABLE IF NOT EXISTS card_shows_cache (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  date        TEXT        NOT NULL,
  venue       TEXT,
  address     TEXT,
  city_state  TEXT,
  time        TEXT,
  state_code  TEXT        NOT NULL,
  state_name  TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_shows_state ON card_shows_cache(state_code);
