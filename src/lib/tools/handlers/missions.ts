import { missionEngine } from '../../missions/mission-engine.js';
import { missionScheduler } from '../../missions/mission-scheduler.js';
import { getMissionEvents } from '../../db/missions-repo.js';
import { MissionInputSchema } from '../../../types/mission.js';

interface CreateMissionParams {
  description: string;
  channel?: string;
  userId?: string;
}

interface CreateMissionResult {
  missionId: string;
  status: string;
  stepCount: number;
  steps: Array<{ order: number; type: string; target: string; context: string }>;
  error?: string;
}

/**
 * Tool handler for create_mission.
 *
 * Validates input, creates a mission via the engine (create -> plan -> start),
 * enqueues steps in the scheduler for background execution, and returns
 * a summary of what was scheduled.
 */
export async function createMissionHandler(params: CreateMissionParams): Promise<CreateMissionResult> {
  try {
    // Validate description (and optional channel) via Zod schema
    MissionInputSchema.parse({ description: params.description, channel: params.channel });

    const channel = (params.channel as 'voice' | 'sms' | 'chat') ?? 'voice';
    const userId = params.userId ?? 'unknown';

    console.log(`[tools:missions] Creating mission for user ${userId}, channel ${channel}`);

    // Lifecycle: create -> plan -> start
    const missionId = await missionEngine.create(userId, channel, params.description);
    const steps = await missionEngine.plan(missionId);
    await missionEngine.start(missionId);

    // Fetch persisted events and enqueue for background execution
    const events = await getMissionEvents(missionId);
    missionScheduler.enqueue(missionId, events).catch((err) => {
      console.error(`[tools:missions] Failed to enqueue mission ${missionId}:`, err);
      void missionEngine.fail(missionId, `Scheduling failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    console.log(`[tools:missions] Mission ${missionId} executing with ${steps.length} steps`);

    return {
      missionId,
      status: 'executing',
      stepCount: steps.length,
      steps: steps.map((s) => ({
        order: s.order,
        type: s.type,
        target: s.target,
        context: s.context,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tools:missions] createMissionHandler failed: ${message}`);
    return {
      missionId: '',
      status: 'failed',
      stepCount: 0,
      steps: [],
      error: message,
    };
  }
}

interface GetMissionStatusParams {
  mission_id: string;
  userId?: string;
}

interface GetMissionStatusResult {
  missionId: string;
  status: string;
  description: string;
  stepsTotal: number;
  stepsCompleted: number;
  stepsFailed: number;
}

/**
 * Tool handler for get_mission_status.
 *
 * Retrieves the current mission status and step completion counts.
 * Validates ownership via userId to prevent cross-user data access.
 */
export async function getMissionStatusHandler(
  params: GetMissionStatusParams,
): Promise<GetMissionStatusResult> {
  try {
    const mission = await missionEngine.getStatus(params.mission_id);

    if (!mission) {
      return {
        missionId: params.mission_id,
        status: 'not_found',
        description: '',
        stepsTotal: 0,
        stepsCompleted: 0,
        stepsFailed: 0,
      };
    }

    // Ownership check — prevent cross-user data access (IDOR)
    if (params.userId && mission.userId !== params.userId) {
      return {
        missionId: params.mission_id,
        status: 'not_found',
        description: '',
        stepsTotal: 0,
        stepsCompleted: 0,
        stepsFailed: 0,
      };
    }

    const events = await getMissionEvents(params.mission_id);
    const stepsCompleted = events.filter((e) => e.status === 'completed').length;
    const stepsFailed = events.filter((e) => e.status === 'failed').length;

    return {
      missionId: mission.id,
      status: mission.status,
      description: mission.description,
      stepsTotal: events.length,
      stepsCompleted,
      stepsFailed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tools:missions] getMissionStatusHandler failed: ${message}`);
    return {
      missionId: params.mission_id,
      status: 'error',
      description: '',
      stepsTotal: 0,
      stepsCompleted: 0,
      stepsFailed: 0,
    };
  }
}
