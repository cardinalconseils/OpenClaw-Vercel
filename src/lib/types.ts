/**
 * Frontend type definitions.
 *
 * These types are duplicated from the backend (src/types/mission.ts and
 * src/lib/voice/call-state.ts) to avoid cross-package imports that break
 * Vercel's isolated Next.js build.
 *
 * Keep in sync with backend types manually when backend interfaces change.
 */

// ---------------------------------------------------------------------------
// Mission types (from src/types/mission.ts)
// ---------------------------------------------------------------------------

export type MissionStatus =
  | 'created'
  | 'planning'
  | 'planned'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed';

export type MissionChannel = 'voice' | 'sms' | 'chat';

export type MissionStepType = 'call' | 'sms' | 'search';

export type MissionStepStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface MissionStep {
  id: string;
  missionId: string;
  order: number;
  type: MissionStepType;
  target: string;
  context: string;
  scheduledAt?: string;
  status: MissionStepStatus;
  callLegId?: string;
}

export interface MissionEventResult {
  stepId: string;
  outcome: string;
  data: Record<string, unknown>;
  capturedAt: string;
}

export interface Mission {
  id: string;
  userId: string;
  channel: MissionChannel;
  description: string;
  status: MissionStatus;
  steps: MissionStep[];
  results: MissionEventResult[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Call history type (shaped for DB rows)
// ---------------------------------------------------------------------------

export interface CallHistoryRecord {
  id: string;
  user_id: string;
  caller_phone: string;
  service_type: string | null;
  location: string | null;
  urgency: string | null;
  providers_contacted: { name: string; phone: string; outcome: string }[];
  connected_provider: string | null;
  status: 'completed' | 'no_match' | 'abandoned';
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Call state shape (from src/lib/voice/call-state.ts)
// Frontend-safe version — excludes Node.js runtime types (setTimeout, etc.)
// ---------------------------------------------------------------------------

export type CallStage =
  | 'greeting'
  | 'name_capture'
  | 'intake'
  | 'consent'
  | 'searching'
  | 'calling'
  | 'complete';

export interface CallStateView {
  callControlId: string;
  callerPhone: string;
  language: 'en' | 'fr';
  stage: CallStage;
  intent: Partial<{ serviceType: string; location: string; urgency: string }>;
  clarificationTurns: number;
  callerName: string | undefined;
  smsConsent: boolean | undefined;
  currentProviderIndex: number;
}
