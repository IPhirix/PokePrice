-- Drop old jsonb-based table and recreate with per-row schema
DROP TABLE IF EXISTS card_shows_cache;

CREATE TABLE card_shows_cache (
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

ALTER TABLE card_shows_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users read card shows cache"
    ON card_shows_cache FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
