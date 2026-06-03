-- Extends etb_catalog to cover all sealed product types.
-- Run in Supabase SQL editor.

-- Add product_type column to existing etb_catalog table
ALTER TABLE etb_catalog ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'etb';
ALTER TABLE etb_catalog ADD COLUMN IF NOT EXISTS set_name TEXT;

-- Update existing rows
UPDATE etb_catalog SET product_type = 'etb' WHERE product_type IS NULL OR product_type = 'etb';

-- Index for fast lookup by type and set
CREATE INDEX IF NOT EXISTS etb_catalog_type_idx ON etb_catalog (product_type);
CREATE INDEX IF NOT EXISTS etb_catalog_set_idx  ON etb_catalog (set_name);
