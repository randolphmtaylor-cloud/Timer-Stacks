import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DurationInput } from './DurationInput.js';
import { cn } from '../ui/cn.js';

const ACCENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

export interface SegmentDraft {
  id: string; // local draft id
  label: string;
  durationMs: number;
  color: string;
}

interface Props {
  seg: SegmentDraft;
  index: number;
  onChange: (updated: Partial<SegmentDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function SegmentRow({ seg, index, onChange, onRemove, canRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: seg.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 p-3 rounded-xl border bg-white dark:bg-surface-800 group sm:flex',
        isDragging
          ? 'border-accent/50 shadow-float opacity-80'
          : 'border-surface-200 dark:border-gray-700/50',
      )}
    >
      {/* Drag handle */}
      <button
        className="drag-handle min-h-10 min-w-8 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-lg leading-none select-none sm:min-h-0"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {/* Index */}
      <span className="text-xs text-gray-400 w-5 text-center shrink-0">{index + 1}</span>

      {/* Color dot */}
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <button
          className="h-6 w-6 rounded-full border-2 border-white dark:border-gray-700 shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: seg.color }}
          title="Choose color"
        />
        {/* Color picker popover would go here in a full impl — for now it cycles */}
        <input
          type="color"
          value={seg.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          title="Pick color"
        />
      </div>

      {/* Label */}
      <input
        type="text"
        value={seg.label}
        placeholder="Segment name"
        onChange={(e) => onChange({ label: e.target.value })}
        className="min-h-10 min-w-0 text-sm bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 sm:min-h-0 sm:flex-1"
      />

      {/* Duration */}
      <DurationInput
        valueMs={seg.durationMs}
        onChange={(ms) => onChange({ durationMs: ms })}
        size="sm"
        className="col-span-3 col-start-2 w-full sm:col-span-1 sm:col-start-auto sm:w-20"
      />

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="col-start-4 row-start-1 min-h-10 min-w-8 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-100 disabled:opacity-0 disabled:pointer-events-none sm:col-start-auto sm:row-start-auto sm:min-h-0 sm:min-w-0 md:opacity-0 md:group-hover:opacity-100"
        title="Remove segment"
      >
        ✕
      </button>
    </div>
  );
}
