import type { MissionProgressEvent } from '../../types/mission.js';
import { getMission, getMissionEvents } from '../db/missions-repo.js';
import { chat } from '../ai/orchestrator.js';

/**
 * MissionReporter emits real-time progress events and generates
 * LLM-powered summaries when missions complete.
 *
 * Integrates with ClawdTalk via the onProgressEvent callback, which
 * allows callers to receive step-by-step progress notifications.
 */
export class MissionReporter {
  /** Optional callback invoked for each progress event (for ClawdTalk integration). */
  onProgressEvent?: (event: MissionProgressEvent) => void;

  /**
   * Emit a progress event after a mission step completes.
   *
   * Logs the event and invokes the onProgressEvent callback if set.
   *
   * @param missionId - The mission ID.
   * @param stepNumber - The current step number (1-indexed).
   * @param totalSteps - The total number of steps in the mission.
   * @param status - The step status (e.g., 'completed', 'failed').
   * @param detail - A human-readable description of the step outcome.
   */
  reportStepProgress(
    missionId: string,
    stepNumber: number,
    totalSteps: number,
    status: string,
    detail: string,
  ): void {
    const event: MissionProgressEvent = {
      type: 'mission.progress',
      missionId,
      step: stepNumber,
      totalSteps,
      status,
      detail,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[missions:reporter] Mission ${missionId} step ${stepNumber}/${totalSteps}: ${status} — ${detail}`,
    );

    this.onProgressEvent?.(event);
  }

  /**
   * Generate a human-readable summary of a completed mission.
   *
   * Fetches all mission events from the DB and uses the LLM to produce
   * a concise summary suitable for SMS delivery (< 500 characters).
   *
   * @param missionId - The mission ID to summarize.
   * @returns A plain-text summary or 'Mission not found' if the mission doesn't exist.
   */
  async generateSummary(missionId: string): Promise<string> {
    const mission = await getMission(missionId);
    if (!mission) {
      return 'Mission not found';
    }

    const events = await getMissionEvents(missionId);

    const total = events.length;
    const completed = events.filter((e) => e.status === 'completed').length;
    const failed = events.filter((e) => e.status === 'failed').length;

    const resultsText = events
      .map((e) => {
        const base = `Step ${e.order} (${e.type} -> ${e.target}): ${e.status}`;
        return base;
      })
      .join('\n');

    const summary = await chat(
      [
        {
          role: 'system',
          content:
            'You are a mission summary writer. Given mission details and step results, write a clear concise summary for the user. Include: what was requested, what happened at each step, and the overall outcome. Keep it under 500 characters for SMS delivery.',
        },
        {
          role: 'user',
          content: `Mission: ${mission.description}\nResults (${completed}/${total} completed, ${failed} failed):\n${resultsText}`,
        },
      ],
      'status-update',
    );

    return summary;
  }
}

/** Singleton instance for use throughout the application. */
export const missionReporter = new MissionReporter();
