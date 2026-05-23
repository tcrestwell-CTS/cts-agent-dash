-- Migration: Fix articles table for webhook ingestion
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv) SQL Editor

-- 1. Add external_id to store the webhook's string ID (separate from PK)
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source      TEXT DEFAULT 'webhook';

-- 2. Ensure slug is unique for upsert
ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS articles_slug_key;
ALTER TABLE articles
  ADD CONSTRAINT articles_slug_key UNIQUE (slug);

-- 3. Index for fast lookup by external_id
CREATE INDEX IF NOT EXISTS idx_articles_external_id
  ON articles(external_id) WHERE external_id IS NOT NULL;

-- 4. RLS — allow service role full access (webhook uses service role key)
-- Service role bypasses RLS by default — no policy needed
-- But ensure anon cannot insert (public read only)
DROP POLICY IF EXISTS "articles_public_read" ON articles;
CREATE POLICY "articles_public_read" ON articles
  FOR SELECT TO anon USING (published_at IS NOT NULL AND published_at <= NOW());

-- 5. Verify table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;
