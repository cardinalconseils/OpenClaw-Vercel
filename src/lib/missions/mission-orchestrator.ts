import { missionEngine } from './mission-engine.js';
import { missionScheduler } from './mission-scheduler.js';
import { missionReporter } from './mission-reporter.js';
import { getMissionEvents } from '../db/missions-repo.js';
import { getSupabaseClient } from '../db/supabase-client.js';

/**
 * Recover incomplete missions on startup by re-enqueuing their pending steps.
 *
 * Queries the database for missions with status 'executing' and re-enqueues
 * any pending or in-progress events back into the scheduler.
 *
 * @returns The number of missions recovered.
 */
export async function recoverIncompleteMissions(): Promise<number> {
  const client = getSupabaseClient();
  const { data: incompleteMissions } = await client
    .from('missions')
    .select('id')
    .eq('status', 'executing');

  if (!incompleteMissions || incompleteMissions.length === 0) {
    console.log('[missions:orchestrator] No incomplete missions to recover');
    return 0;
  }

  for (const mission of incompleteMissions) {
    const missionId = (mission as { id: string }).id;
    const events = await getMissionEvents(missionId);

    // Re-enqueue steps that are pending or were interrupted mid-flight (in-progress)
    const pendingEvents = events.filter(
      (e) => e.status === 'pending' || e.status === 'in-progress',
    );

    await missionScheduler.enqueue(missionId, pendingEvents);
    console.log(
      `[missions:orchestrator] Recovered mission ${missionId} with ${pendingEvents.length} pending steps`,
    );
  }

  return incompleteMissions.length;
}

/**
 * Initialize the mission system.
 *
 * Wires the scheduler callbacks to the reporter and engine, then
 * runs startup recovery for any incomplete missions.
 *
 * Call this once on server startup.
 */
export async function initMissions(): Promise<void> {
  console.log('[missions:orchestrator] Initializing mission system');

  // Wire step completion: log progress from scheduler
  missionScheduler.onStepComplete = async (stepId, result) => {
    const detail = result.error
      ? `Failed: ${result.error}`
      : `Completed: ${JSON.stringify(result).slice(0, 100)}`;
    // Note: full progress reporting requires missionId context
    // which the scheduler passes via the enqueue association
    console.log(`[missions:orchestrator] Step ${stepId} complete: ${detail}`);
  };

  // Wire mission completion: generate summary via LLM then mark complete
  missionScheduler.onMissionComplete = async (missionId) => {
    console.log(
      `[missions:orchestrator] Mission ${missionId} all steps complete, generating summary`,
    );
    try {
      const summary = await missionReporter.generateSummary(missionId);
      await missionEngine.complete(missionId, summary);
      console.log(`[missions:orchestrator] Mission ${missionId} completed with summary`);
    } catch (err) {
      console.error(`[missions:orchestrator] Failed to complete mission ${missionId}:`, err);
      await missionEngine.fail(
        missionId,
        `Summary generation failed: ${(err as Error).message}`,
      );
    }
  };

  // Recover any missions that were executing when the server last stopped
  await recoverIncompleteMissions();

  console.log('[missions:orchestrator] Mission system initialized');
}
