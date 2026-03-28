
-- lead_followups table
CREATE TABLE IF NOT EXISTS lead_followups (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid        NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  step         integer     NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL,
  sent_at      timestamptz,
  status       text        NOT NULL DEFAULT 'pending',
  resend_id    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_pending ON lead_followups(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_followups_lead    ON lead_followups(lead_id);

ALTER TABLE lead_followups ENABLE ROW LEVEL SECURITY;

-- Sequence control columns on quote_requests
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS sequence_started boolean DEFAULT false;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS sequence_paused  boolean DEFAULT false;
