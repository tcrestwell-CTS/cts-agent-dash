ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS ai_score        integer,
  ADD COLUMN IF NOT EXISTS ai_stage        text,
  ADD COLUMN IF NOT EXISTS ai_summary      text,
  ADD COLUMN IF NOT EXISTS ai_tags         text[],
  ADD COLUMN IF NOT EXISTS ai_next_action  text,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS wants_financing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_type      text;

CREATE INDEX IF NOT EXISTS idx_quote_requests_ai_stage ON quote_requests(ai_stage);
CREATE INDEX IF NOT EXISTS idx_quote_requests_ai_score ON quote_requests(ai_score DESC);