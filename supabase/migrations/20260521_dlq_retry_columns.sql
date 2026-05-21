-- Migration: Add retry tracking columns to recon_dead_letter_queue
-- Run in CTS Supabase SQL Editor

ALTER TABLE recon_dead_letter_queue
  ADD COLUMN IF NOT EXISTS last_retry_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_type     TEXT;

-- Add "dead" status for items that have exhausted all retries
ALTER TABLE recon_dead_letter_queue
  DROP CONSTRAINT IF EXISTS recon_dead_letter_queue_status_check;

ALTER TABLE recon_dead_letter_queue
  ADD CONSTRAINT recon_dead_letter_queue_status_check
  CHECK (status IN ('pending', 'processing', 'resolved', 'failed', 'dead'));

-- Index for efficient DLQ queries
CREATE INDEX IF NOT EXISTS idx_dlq_retry
  ON recon_dead_letter_queue(status, retry_count, created_at)
  WHERE status = 'failed';

-- Populate event_type from existing source_record_type where null
UPDATE recon_dead_letter_queue
SET event_type = source_record_type
WHERE event_type IS NULL AND source_record_type IS NOT NULL;
