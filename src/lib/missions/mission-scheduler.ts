import { smsLimiter, callLimiter, TokenBucketRateLimiter } from './rate-limiter.js';
import { executeTool } from '../tools/registry.js';
import { updateMissionEvent } from '../db/missions-repo.js';
import type { MissionStep, MissionStepType } from '../../types/mission.js';

/**
 * Map each step type to the corresponding tool name in the registry.
 */
const STEP_TOOL_MAP: Record<MissionStepType, string> = {
  search: 'search_providers',
  call: 'call_provider',
  sms: 'send_sms',
};

/**
 * Map each step type to its rate limiter (null = no limiting needed).
 */
const STEP_LIMITER_MAP: Record<MissionStepType, TokenBucketRateLimiter | null> = {
  search: null,
  call: callLimiter,
  sms: smsLimiter,
};

/**
 * Build tool params from a mission step based on its type.
 * - search: { service_type: step.context (service category), location: step.target (geographic query) }
 * - call:   { phone_number: step.target, provider_name: step.context }
 * - sms:    { to: step.target, message: step.context }
 */
function buildToolParams(step: MissionStep): Record<string, unknown> {
  switch (step.type) {
    case 'search':
      return { service_type: step.context, location: step.target };
    case 'call':
      return { phone_number: step.target, provider_name: step.context };
    case 'sms':
      return { to: step.target, message: step.context };
  }
}

/**
 * MissionScheduler — in-process job queue for mission step execution.
 *
 * Processes steps sequentially (not in parallel) to preserve ordering.
 * Applies rate limiting per Telnyx throughput constraints before each step.
 * Persists step status changes to the DB via updateMissionEvent.
 *
 * Callbacks:
 * - onStepComplete(stepId, result) — fired after each step (success or failure)
 * - onMissionComplete(missionId) — fired when all steps for a mission finish
 *
 * Failure handling: failed steps are marked 'failed' but processing continues
 * to the next step (no abort on failure).
 */
export class MissionScheduler {
  private queue: Array<{ missionId: string; step: MissionStep }> = [];
  private processing = false;

  /** Optional callback invoked after each step completes (or fails). */
  onStepComplete?: (stepId: string, result: Record<string, unknown>) => Promise<void> | void;

  /** Optional callback invoked when all steps for a mission have been processed. */
  onMissionComplete?: (missionId: string) => Promise<void> | void;

  /**
   * Add steps to the queue and start processing if not already running.
   */
  async enqueue(missionId: string, steps: MissionStep[]): Promise<void> {
    for (const step of steps) {
      this.queue.push({ missionId, step });
    }

    if (!this.processing) {
      await this.processNext();
    }
  }

  /**
   * Main processing loop: drains the queue sequentially.
   */
  private async processNext(): Promise<void> {
    this.processing = true;
    const processedMissions = new Set<string>();

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      processedMissions.add(item.missionId);

      const limiter = STEP_LIMITER_MAP[item.step.type];
      if (limiter) {
        await limiter.acquire();
      }

      await this.executeStep(item.missionId, item.step);
    }

    this.processing = false;

    // Notify mission complete for all missions whose steps we processed
    for (const missionId of processedMissions) {
      const stillQueued = this.queue.some((q) => q.missionId === missionId);
      if (!stillQueued) {
        try {
          await this.onMissionComplete?.(missionId);
        } catch (err) {
          console.error(`[missions:scheduler] onMissionComplete callback failed for ${missionId}:`, err);
        }
      }
    }
  }

  /**
   * Execute a single step: update DB status, run tool, persist result.
   */
  private async executeStep(missionId: string, step: MissionStep): Promise<void> {
    const toolName = STEP_TOOL_MAP[step.type];
    const params = buildToolParams(step);

    // Mark step as in-progress
    await updateMissionEvent(step.id, {
      status: 'in-progress',
      startedAt: new Date().toISOString(),
    });

    let result: Record<string, unknown>;
    try {
      result = await executeTool(toolName, params) as Record<string, unknown>;
      await updateMissionEvent(step.id, {
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = { error: message };
      console.error(`[missions:scheduler] Step ${step.id} failed: ${message}`);
      await updateMissionEvent(step.id, {
        status: 'failed',
        result,
        completedAt: new Date().toISOString(),
      });
    }

    try {
      await this.onStepComplete?.(step.id, result);
    } catch (err) {
      console.error(`[missions:scheduler] onStepComplete callback failed for step ${step.id}:`, err);
    }
  }

  /**
   * Returns true if the scheduler is currently processing steps.
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Returns the number of steps currently in the queue.
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/** Singleton instance for use throughout the application. */
export const missionScheduler = new MissionScheduler();
