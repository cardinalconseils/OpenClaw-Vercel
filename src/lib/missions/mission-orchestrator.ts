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
  const { data: incompleteMissions, error } = await client
    .from('missions')
    .select('id')
    .eq('status', 'executing');

  if (error) {
    throw new Error(`[missions:orchestrator] Failed to query incomplete missions: ${error.message}`);
  }

  if (!incompleteMissions || incompleteMissions.length === 0) {
    console.log('[missions:orchestrator] No incomplete missions to recover');
    return 0;
  }

  let recovered = 0;
  for (const mission of incompleteMissions) {
    const missionId = (mission as { id: string }).id;
    try {
      const events = await getMissionEvents(missionId);

      // Re-enqueue steps that are pending or were interrupted mid-flight (in-progress)
      const pendingEvents = events.filter(
        (e) => e.status === 'pending' || e.status === 'in-progress',
      );

      await missionScheduler.enqueue(missionId, pendingEvents);
      console.log(
        `[missions:orchestrator] Recovered mission ${missionId} with ${pendingEvents.length} pending steps`,
      );
      recovered++;
    } catch (err) {
      console.error(`[missions:orchestrator] Failed to recover mission ${missionId}:`, err);
      try {
        await missionEngine.fail(missionId, `Recovery failed: ${err instanceof Error ? err.message : String(err)}`);
      } catch (failErr) {
        console.error(`[missions:orchestrator] Could not mark mission ${missionId} as failed:`, failErr);
      }
    }
  }

  return recovered;
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
    // Note: onStepComplete receives only stepId — missionId is not passed.
    // Full progress reporting would require extending the callback signature.
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
      try {
        await missionEngine.fail(missionId, 'Mission could not be completed — please try again.');
      } catch (failErr) {
        console.error(`[missions:orchestrator] Could not mark mission ${missionId} as failed:`, failErr);
      }
    }
  };

  // Recover any missions that were executing when the server last stopped
  await recoverIncompleteMissions();

  console.log('[missions:orchestrator] Mission system initialized');
}
