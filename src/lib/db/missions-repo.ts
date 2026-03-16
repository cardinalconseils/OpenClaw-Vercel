import { getSupabaseClient } from './supabase-client.js';
import type { Mission, MissionChannel, MissionStatus, MissionStep } from '../../types/mission.js';

/**
 * Map a Supabase missions row (snake_case) to the Mission interface (camelCase).
 */
function rowToMission(row: Record<string, unknown>): Mission {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    channel: row.channel as MissionChannel,
    description: row.description as string,
    status: row.status as MissionStatus,
    steps: (row.steps as MissionStep[]) ?? [],
    results: [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: row.completed_at as string | undefined,
  };
}

/**
 * Map a Supabase mission_events row (snake_case) to MissionStep (camelCase).
 */
function rowToStep(row: Record<string, unknown>): MissionStep {
  return {
    id: row.id as string,
    missionId: row.mission_id as string,
    order: row.step_order as number,
    type: row.type as MissionStep['type'],
    target: row.target as string,
    context: row.context as string,
    scheduledAt: row.scheduled_at as string | undefined,
    status: row.status as MissionStep['status'],
    callLegId: row.call_leg_id as string | undefined,
  };
}

/**
 * Insert a new mission into the missions table.
 */
export async function createMission(params: {
  userId: string;
  channel: MissionChannel;
  description: string;
}): Promise<Mission> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('missions')
    .insert({
      user_id: params.userId,
      channel: params.channel,
      description: params.description,
      status: 'created',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[missions-repo] createMission failed: ${error.message}`);
  }
  return rowToMission(data as Record<string, unknown>);
}

/**
 * Retrieve a mission by ID. Returns null if not found.
 */
export async function getMission(id: string): Promise<Mission | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Supabase "no rows" for .single()
    throw new Error(`[missions-repo] getMission failed: ${error.message}`);
  }
  if (!data) return null;
  return rowToMission(data as Record<string, unknown>);
}

/**
 * Update the status (and optional extras) on a mission.
 */
export async function updateMissionStatus(
  id: string,
  status: MissionStatus,
  extra?: { summary?: string; completedAt?: string },
): Promise<void> {
  const supabase = getSupabaseClient();
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra?.summary !== undefined) {
    updates.summary = extra.summary;
  }
  if (extra?.completedAt !== undefined) {
    updates.completed_at = extra.completedAt;
  }

  const { error } = await supabase.from('missions').update(updates).eq('id', id);
  if (error) {
    throw new Error(`[missions-repo] updateMissionStatus failed: ${error.message}`);
  }
}

/**
 * Insert a new mission event (step execution record) into mission_events.
 */
export async function createMissionEvent(params: {
  missionId: string;
  stepOrder: number;
  type: string;
  target: string;
  context?: string;
}): Promise<{ id: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('mission_events')
    .insert({
      mission_id: params.missionId,
      step_order: params.stepOrder,
      type: params.type,
      target: params.target,
      context: params.context,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[missions-repo] createMissionEvent failed: ${error.message}`);
  }
  return { id: (data as Record<string, unknown>).id as string };
}

/**
 * Retrieve all events for a mission, ordered by step_order ascending.
 */
export async function getMissionEvents(missionId: string): Promise<MissionStep[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('mission_events')
    .select('*')
    .eq('mission_id', missionId)
    .order('step_order', { ascending: true });

  if (error) {
    throw new Error(`[missions-repo] getMissionEvents failed: ${error.message}`);
  }
  return ((data as Record<string, unknown>[]) ?? []).map(rowToStep);
}

/**
 * Update specified fields on a mission event.
 */
export async function updateMissionEvent(
  id: string,
  updates: {
    status?: string;
    result?: Record<string, unknown>;
    callLegId?: string;
    startedAt?: string;
    completedAt?: string;
  },
): Promise<void> {
  const supabase = getSupabaseClient();
  const patch: Record<string, unknown> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.result !== undefined) patch.result = updates.result;
  if (updates.callLegId !== undefined) patch.call_leg_id = updates.callLegId;
  if (updates.startedAt !== undefined) patch.started_at = updates.startedAt;
  if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt;

  const { error } = await supabase.from('mission_events').update(patch).eq('id', id);
  if (error) {
    throw new Error(`[missions-repo] updateMissionEvent failed: ${error.message}`);
  }
}
