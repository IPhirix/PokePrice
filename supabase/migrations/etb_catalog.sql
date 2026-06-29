-- Run this once in your Supabase SQL editor.
CREATE TABLE IF NOT EXISTS etb_catalog (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  release_date DATE,
  msrp_usd     NUMERIC(6,2),
  cameos       TEXT[],
  image_url    TEXT,        -- Supabase Storage URL (or CDN fallback)
  source_url   TEXT,        -- Original CDN URL from elitefourum.com
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS etb_catalog_name_idx ON etb_catalog (name);

-- Create the storage bucket for ETB images (run separately in Supabase dashboard
-- or uncomment if using service role key with storage API access)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('etb-images', 'etb-images', true)
-- ON CONFLICT (id) DO NOTHING;
