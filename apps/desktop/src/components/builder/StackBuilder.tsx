import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { formatMsHuman } from '@timer-stacks/core';
import { useStackStore } from '../../stores/stackStore.js';
import { SegmentRow, type SegmentDraft } from './SegmentRow.js';
import { Button } from '../ui/Button.js';

const DEFAULT_COLOR = '#6366f1';
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4'];

function makeSegment(index: number): SegmentDraft {
  return {
    id: uuidv4(),
    label: '',
    durationMs: 5 * 60 * 1000,
    color: COLORS[index % COLORS.length] ?? DEFAULT_COLOR,
  };
}

export function StackBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const { stacks, create, update } = useStackStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [segments, setSegments] = useState<SegmentDraft[]>([makeSegment(0), makeSegment(1)]);
  const [isTemplate, setIsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing stack for editing
  useEffect(() => {
    if (!editId) return;
    const stack = stacks.find((s) => s.stackId === editId);
    if (!stack) return;
    setName(stack.name);
    setIcon(stack.icon ?? '');
    setDescription(stack.description ?? '');
    setIsTemplate(stack.isTemplate);
    setSegments(
      stack.segments.map((s) => ({
        id: uuidv4(),
        label: s.label,
        durationMs: s.durationMs,
        color: s.color ?? DEFAULT_COLOR,
      })),
    );
  }, [editId, stacks]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalMs = segments.reduce((acc, s) => acc + s.durationMs, 0);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSegments((prev) => {
        const oldIdx = prev.findIndex((s) => s.id === active.id);
        const newIdx = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function updateSegment(id: string, patch: Partial<SegmentDraft>) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSegment() {
    setSegments((prev) => [...prev, makeSegment(prev.length)]);
  }

  function removeSegment(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  const isValid =
    name.trim().length > 0 &&
    segments.length > 0 &&
    segments.every((s) => s.label.trim().length > 0 && s.durationMs > 0);

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      if (editId) {
        await update({
          stackId: editId,
          name: name.trim(),
          totalDurationMs: totalMs,
          segments: segments.map((s) => ({ label: s.label, durationMs: s.durationMs, color: s.color })),
          isTemplate,
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
        });
      } else {
        await create({
          name: name.trim(),
          totalDurationMs: totalMs,
          segments: segments.map((s) => ({ label: s.label, durationMs: s.durationMs, color: s.color })),
          isTemplate,
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
        });
      }
      navigate('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-5 sm:px-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <button
          onClick={() => navigate(-1)}
          className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors md:min-h-0 md:min-w-0"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {editId ? 'Edit Stack' : 'New Stack'}
          </h1>
        </div>
      </div>

      {/* Stack meta */}
      <div className="space-y-4 mb-8">
        <div className="flex gap-3">
          {/* Icon */}
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🎯"
            maxLength={2}
            className="w-14 text-center text-xl border border-surface-300 dark:border-gray-600 rounded-xl px-2 py-3 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stack name…"
            className="min-w-0 flex-1 text-lg font-medium border border-surface-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full text-sm border border-surface-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-surface-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={isTemplate}
            onChange={(e) => setIsTemplate(e.target.checked)}
            className="accent-accent"
          />
          Save as template
        </label>
      </div>

      {/* Segments */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Segments</h2>
          <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
            Total: {formatMsHuman(totalMs)}
          </span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {segments.map((seg, i) => (
                <SegmentRow
                  key={seg.id}
                  seg={seg}
                  index={i}
                  onChange={(patch) => updateSegment(seg.id, patch)}
                  onRemove={() => removeSegment(seg.id)}
                  canRemove={segments.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full border border-dashed border-surface-300 dark:border-gray-600 hover:border-accent/50"
          onClick={addSegment}
        >
          + Add Segment
        </Button>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3 pt-4 border-t border-surface-100 dark:border-gray-700/50 sm:flex sm:justify-end">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isValid}>
          {editId ? 'Save Changes' : 'Create Stack'}
        </Button>
      </div>
    </div>
  );
}
