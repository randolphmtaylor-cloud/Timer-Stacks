import type { SessionRecord, TimerStack } from '@timer-stacks/core';
import { supabase } from './supabase.js';

type RemoteSegment = {
  id: string;
  label: string;
  duration_ms: number;
  color: string | null;
  position: number;
};

type RemoteStack = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  total_duration_ms: number;
  is_template: boolean;
  created_at: string;
  updated_at: string;
  segments?: RemoteSegment[];
};

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function msFromIso(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function fromRemoteStack(stack: RemoteStack): TimerStack {
  const segments = [...(stack.segments ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((segment) => ({
      segmentId: segment.id,
      label: segment.label,
      durationMs: segment.duration_ms,
      color: segment.color ?? undefined,
    }));

  return {
    stackId: stack.id,
    name: stack.name,
    description: stack.description ?? undefined,
    icon: stack.icon ?? undefined,
    totalDurationMs: stack.total_duration_ms,
    segments,
    isTemplate: stack.is_template,
    createdAt: msFromIso(stack.created_at),
    updatedAt: msFromIso(stack.updated_at),
  };
}

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchCloudStacks(): Promise<TimerStack[]> {
  if (!supabase) return [];
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('stacks')
    .select(
      'id,name,description,icon,total_duration_ms,is_template,created_at,updated_at,segments(id,label,duration_ms,color,position)',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RemoteStack[]).map(fromRemoteStack);
}

export async function upsertCloudStack(stack: TimerStack): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;

  const { error: stackError } = await supabase.from('stacks').upsert(
    {
      id: stack.stackId,
      user_id: userId,
      name: stack.name,
      description: stack.description ?? null,
      icon: stack.icon ?? null,
      total_duration_ms: stack.totalDurationMs,
      is_template: stack.isTemplate,
      created_at: isoFromMs(stack.createdAt),
      updated_at: isoFromMs(stack.updatedAt),
    },
    { onConflict: 'id' },
  );
  if (stackError) throw stackError;

  const { error: deleteError } = await supabase
    .from('segments')
    .delete()
    .eq('stack_id', stack.stackId)
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  if (stack.segments.length === 0) return;

  const { error: segmentError } = await supabase.from('segments').insert(
    stack.segments.map((segment, position) => ({
      id: segment.segmentId,
      user_id: userId,
      stack_id: stack.stackId,
      label: segment.label,
      duration_ms: segment.durationMs,
      color: segment.color ?? null,
      position,
    })),
  );
  if (segmentError) throw segmentError;
}

export async function deleteCloudStack(stackId: string): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase.from('stacks').delete().eq('id', stackId).eq('user_id', userId);
  if (error) throw error;
}

export async function mergeCloudStacks(localStacks: TimerStack[]): Promise<TimerStack[]> {
  if (!supabase) return localStacks;
  const userId = await getUserId();
  if (!userId) return localStacks;

  const remoteStacks = await fetchCloudStacks();
  const merged = new Map<string, TimerStack>();

  for (const stack of remoteStacks) merged.set(stack.stackId, stack);

  for (const local of localStacks) {
    const remote = merged.get(local.stackId);
    if (!remote || local.updatedAt > remote.updatedAt) {
      merged.set(local.stackId, local);
      upsertCloudStack(local).catch(() => {});
    }
  }

  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCloudSessionRecord(record: SessionRecord): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('sessions').upsert(
    {
      id: record.sessionId,
      user_id: userId,
      stack_id: record.stackId,
      stack_name: record.stackName,
      status: record.status,
      started_at: isoFromMs(record.startedAt),
      ended_at: isoFromMs(record.endedAt),
      total_elapsed_ms: record.totalElapsedMs,
      segments_completed: record.segmentsCompleted,
      total_segments: record.totalSegments,
    },
    { onConflict: 'id' },
  );
}
