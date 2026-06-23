-- Migration: Add root_hash_dim_views to saved_models, remove dim_views from chat_messages

-- 1. Add dim views root hash column to saved_models
ALTER TABLE saved_models ADD COLUMN IF NOT EXISTS root_hash_dim_views TEXT;

-- 2. Remove dim_views column from chat_messages
ALTER TABLE chat_messages DROP COLUMN IF EXISTS dim_views;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
