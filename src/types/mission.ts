import { z } from 'zod';

/**
 * Lifecycle status of a mission.
 */
export type MissionStatus =
  | 'created'
  | 'planning'
  | 'planned'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed';

/**
 * Channel through which the mission was created.
 */
export type MissionChannel = 'voice' | 'sms' | 'chat';

/**
 * Type of action a mission step performs.
 */
export type MissionStepType = 'call' | 'sms' | 'search';

/**
 * Execution status of an individual mission step.
 */
export type MissionStepStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * An individual step within a mission (one call, one SMS, or one search).
 */
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

/**
 * Captured result from a completed mission step.
 */
export interface MissionEventResult {
  stepId: string;
  outcome: string;
  data: Record<string, unknown>;
  capturedAt: string;
}

/**
 * Top-level mission record.
 */
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

/**
 * Real-time progress event emitted via the OpenClaw gateway / ClawdTalk portal.
 */
export interface MissionProgressEvent {
  type: 'mission.progress';
  missionId: string;
  step: number;
  totalSteps: number;
  status: string;
  detail: string;
  timestamp: string;
}

/**
 * Zod schema for validating mission creation input from tool calls.
 */
export const MissionInputSchema = z.object({
  description: z.string().min(1, 'description is required'),
  channel: z.enum(['voice', 'sms', 'chat']).optional(),
});

export type MissionInput = z.infer<typeof MissionInputSchema>;
