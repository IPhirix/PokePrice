-- Run this once in your Supabase SQL editor to create the sealed product images table.
CREATE TABLE IF NOT EXISTS sealed_images (
  pricecharting_id  TEXT        PRIMARY KEY,
  product_name      TEXT        NOT NULL,
  image_url         TEXT        NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
