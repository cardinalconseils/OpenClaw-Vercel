import { createMission, getMission, updateMissionStatus, createMissionEvent } from '../db/missions-repo.js';
import { planMission } from './mission-planner.js';
import type { Mission, MissionChannel, MissionStatus, MissionStep, MissionStepType } from '../../types/mission.js';

/**
 * Valid state transitions for the mission lifecycle.
 * Enforces legal status changes — no arbitrary jumps.
 */
const VALID_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  created: ['planning'],
  planning: ['planned', 'failed'],
  planned: ['executing'],
  executing: ['paused', 'completed', 'failed'],
  paused: ['executing', 'failed'],
  completed: [],
  failed: [],
};

/**
 * Assert that a transition from `current` to `target` is valid.
 * Throws a descriptive error if not.
 */
function assertTransition(current: MissionStatus, target: MissionStatus): void {
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target)) {
    throw new Error(
      `Cannot transition mission from '${current}' to '${target}'. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }
}

/**
 * MissionEngine orchestrates the full mission lifecycle.
 *
 * Lifecycle: created -> planning -> planned -> executing -> completed | failed
 *
 * - create(): Insert a new mission record in the DB
 * - plan(): Decompose description via LLM into steps, persist events
 * - start(): Transition from planned to executing
 * - complete(): Mark mission done with timestamp
 * - fail(): Mark mission failed (allowed from any state)
 * - pause(): Suspend an executing mission
 * - resume(): Resume a paused mission
 * - getStatus(): Retrieve current mission state
 */
export class MissionEngine {
  /**
   * Create a new mission record in the database.
   * @returns The new mission's ID.
   */
  async create(userId: string, channel: MissionChannel, description: string): Promise<string> {
    console.log(`[mission-engine] Creating mission for user ${userId}`);
    const mission = await createMission({ userId, channel, description });
    return mission.id;
  }

  /**
   * Plan a mission: decompose its description into steps via LLM,
   * persist each step as a mission_event, and transition status.
   *
   * Transitions: created -> planning -> planned (or failed on error)
   *
   * @returns Array of planned steps.
   * @throws Error if mission is not in 'created' status.
   */
  async plan(missionId: string): Promise<MissionStep[]> {
    const mission = await getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    assertTransition(mission.status, 'planning');
    await updateMissionStatus(missionId, 'planning');

    let plannedSteps: Array<{ type: MissionStepType; target: string; context: string; order: number }>;
    try {
      plannedSteps = await planMission(mission.description);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await updateMissionStatus(missionId, 'failed', { summary: `Planning failed: ${reason}` });
      throw err;
    }

    // Persist each step as a mission_event
    const createdSteps: MissionStep[] = [];
    for (const step of plannedSteps) {
      const { id } = await createMissionEvent({
        missionId,
        stepOrder: step.order,
        type: step.type,
        target: step.target,
        context: step.context,
      });
      createdSteps.push({
        id,
        missionId,
        order: step.order,
        type: step.type,
        target: step.target,
        context: step.context,
        status: 'pending',
      });
    }

    await updateMissionStatus(missionId, 'planned');
    console.log(`[mission-engine] Mission ${missionId} planned with ${createdSteps.length} steps`);
    return createdSteps;
  }

  /**
   * Transition a planned mission to executing.
   * @throws Error if mission is not in 'planned' status.
   */
  async start(missionId: string): Promise<void> {
    const mission = await getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }
    assertTransition(mission.status, 'executing');
    await updateMissionStatus(missionId, 'executing');
    console.log(`[mission-engine] Mission ${missionId} started`);
  }

  /**
   * Mark a mission as completed with optional summary.
   * @throws Error if mission is not in 'executing' status.
   */
  async complete(missionId: string, summary?: string): Promise<void> {
    const mission = await getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }
    assertTransition(mission.status, 'completed');
    await updateMissionStatus(missionId, 'completed', {
      completedAt: new Date().toISOString(),
      ...(summary ? { summary } : {}),
    });
    console.log(`[mission-engine] Mission ${missionId} completed`);
  }

  /**
   * Mark a mission as failed. Can be called from any state.
   */
  async fail(missionId: string, reason: string): Promise<void> {
    await updateMissionStatus(missionId, 'failed', { summary: reason });
    console.log(`[mission-engine] Mission ${missionId} failed: ${reason}`);
  }

  /**
   * Pause an executing mission.
   * @throws Error if mission is not in 'executing' status.
   */
  async pause(missionId: string): Promise<void> {
    const mission = await getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }
    assertTransition(mission.status, 'paused');
    await updateMissionStatus(missionId, 'paused');
    console.log(`[mission-engine] Mission ${missionId} paused`);
  }

  /**
   * Resume a paused mission.
   * @throws Error if mission is not in 'paused' status.
   */
  async resume(missionId: string): Promise<void> {
    const mission = await getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }
    assertTransition(mission.status, 'executing');
    await updateMissionStatus(missionId, 'executing');
    console.log(`[mission-engine] Mission ${missionId} resumed`);
  }

  /**
   * Get the current status of a mission.
   * @returns The mission or null if not found.
   */
  async getStatus(missionId: string): Promise<Mission | null> {
    return getMission(missionId);
  }
}

/** Singleton instance for use throughout the application. */
export const missionEngine = new MissionEngine();
