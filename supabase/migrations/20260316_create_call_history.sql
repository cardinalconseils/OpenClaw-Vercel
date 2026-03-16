-- Migration: Create call_history table for dashboard (Phase 9)
-- Required by: WEB-03 (call history dashboard page)
-- Shape matches: frontend/src/lib/types.ts CallHistoryRecord interface

CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  service_type TEXT,
  location TEXT,
  urgency TEXT,
  providers_contacted JSONB NOT NULL DEFAULT '[]'::jsonb,
  connected_provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'no_match', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard queries (filter by user, order by date)
CREATE INDEX idx_call_history_user_id ON call_history(user_id);
CREATE INDEX idx_call_history_created_at ON call_history(created_at DESC);

-- RLS: users can only read their own call history
ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own call history"
  ON call_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert call history"
  ON call_history FOR INSERT
  WITH CHECK (true);
