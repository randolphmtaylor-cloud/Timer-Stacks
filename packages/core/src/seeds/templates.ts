// ---------------------------------------------------------------------------
// Seed templates — initial data for all platforms
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from 'uuid';
import type { TimerStack } from '../types/stack.js';
import { minutesToMs } from '../utils/time.js';

function makeStack(
  name: string,
  segments: Array<{ label: string; minutes: number; color?: string }>,
  opts: { description?: string; icon?: string } = {},
): TimerStack {
  const segs = segments.map((s) => ({
    segmentId: uuidv4(),
    label: s.label,
    durationMs: minutesToMs(s.minutes),
    color: s.color,
  }));
  const now = Date.now();
  return {
    stackId: uuidv4(),
    name,
    totalDurationMs: segs.reduce((acc, s) => acc + s.durationMs, 0),
    segments: segs,
    isTemplate: true,
    createdAt: now,
    updatedAt: now,
    description: opts.description,
    icon: opts.icon,
  };
}

export const SEED_TEMPLATES: TimerStack[] = [
  makeStack(
    'Music Practice Session',
    [
      { label: 'Lip Slurs', minutes: 7.5, color: '#6366f1' },
      { label: 'Tonguing Exercise', minutes: 7.5, color: '#8b5cf6' },
      { label: 'Long Tone Exercise', minutes: 15, color: '#a78bfa' },
      { label: 'Arpeggios', minutes: 12, color: '#c4b5fd' },
      { label: 'Doodle Tonguing', minutes: 12, color: '#818cf8' },
      { label: 'Work Out a Lick or Passage', minutes: 6, color: '#4f46e5' },
    ],
    { description: '60-minute structured brass practice routine', icon: '🎺' },
  ),

  makeStack(
    'Pomodoro Deep Work',
    [
      { label: 'Focus Block 1', minutes: 25, color: '#ef4444' },
      { label: 'Short Break', minutes: 5, color: '#fca5a5' },
      { label: 'Focus Block 2', minutes: 25, color: '#ef4444' },
      { label: 'Long Break', minutes: 15, color: '#fca5a5' },
    ],
    { description: '70-minute Pomodoro session with two focus blocks', icon: '🍅' },
  ),

  makeStack(
    'Workout Circuit',
    [
      { label: 'Warm-Up', minutes: 5, color: '#f59e0b' },
      { label: 'Squats', minutes: 3, color: '#f97316' },
      { label: 'Rest', minutes: 1, color: '#fdba74' },
      { label: 'Push-Ups', minutes: 3, color: '#f97316' },
      { label: 'Rest', minutes: 1, color: '#fdba74' },
      { label: 'Lunges', minutes: 3, color: '#f97316' },
      { label: 'Rest', minutes: 1, color: '#fdba74' },
      { label: 'Plank', minutes: 2, color: '#f97316' },
      { label: 'Cool-Down', minutes: 6, color: '#fbbf24' },
    ],
    { description: '25-minute bodyweight strength circuit', icon: '💪' },
  ),
];
