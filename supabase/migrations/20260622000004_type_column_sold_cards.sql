-- Add type column to collections and watchlists (distinguishes 'card' from 'sealed')
ALTER TABLE collections ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'card';
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'card';

-- Sold / traded cards table (replaces section=sold in cards.json)
CREATE TABLE IF NOT EXISTS sold_cards (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tcg_id text NOT NULL,
  name text NOT NULL,
  set_name text,
  set_id text,
  number text,
  rarity text,
  condition text NOT NULL DEFAULT 'raw',
  quantity integer NOT NULL DEFAULT 1,
  type text NOT NULL DEFAULT 'card',
  purchase_price numeric(10,2),
  current_price numeric(10,2),
  image_url text,
  image_url_large text,
  pricecharting_id text,
  pricecharting_name text,
  sale_price numeric(10,2),
  sale_date text,
  is_trade boolean NOT NULL DEFAULT false,
  trade_cards_received jsonb NOT NULL DEFAULT '[]',
  added_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sold_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users see own sold cards" ON sold_cards FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own sold cards" ON sold_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own sold cards" ON sold_cards FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own sold cards" ON sold_cards FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS sold_cards_user_id_idx ON sold_cards(user_id);
