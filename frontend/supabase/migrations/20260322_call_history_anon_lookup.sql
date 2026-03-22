-- Migration: Allow anonymous SELECT on call_history for /history page
-- Phase 7 (DASH-01): Phone number lookup without authentication
-- Security: API route always filters by caller_phone; this policy enables anon role access
-- Does NOT replace existing "Users can view own call history" policy

CREATE POLICY "Anon caller_phone lookup"
  ON call_history FOR SELECT
  TO anon
  USING (true);

-- Index for phone number lookups (not covered by existing user_id index)
CREATE INDEX IF NOT EXISTS idx_call_history_caller_phone ON call_history(caller_phone);
