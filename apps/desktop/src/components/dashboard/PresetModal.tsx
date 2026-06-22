import React, { useState, useRef } from 'react';
import { useTimerStore, type TimerPreset } from '../../stores/timerStore.js';
import { cn } from '../ui/cn.js';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#06b6d4',
];

function formatDur(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0 && m === 0 && s === 0) return `${h}h`;
  if (h > 0 && s === 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0 && s === 0) return `${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface PresetFormState {
  name: string;
  hours: string;
  minutes: string;
  seconds: string;
  icon: string;
  color: string;
}

const EMPTY_FORM: PresetFormState = {
  name: '',
  hours: '0',
  minutes: '5',
  seconds: '0',
  icon: '',
  color: '#6366f1',
};

function formToDurationSeconds(f: PresetFormState): number {
  return (
    (parseInt(f.hours) || 0) * 3600 +
    (parseInt(f.minutes) || 0) * 60 +
    (parseInt(f.seconds) || 0)
  );
}

function presetToForm(p: TimerPreset): PresetFormState {
  const h = Math.floor(p.durationSeconds / 3600);
  const m = Math.floor((p.durationSeconds % 3600) / 60);
  const s = p.durationSeconds % 60;
  return {
    name: p.name,
    hours: String(h),
    minutes: String(m),
    seconds: String(s),
    icon: p.icon ?? '',
    color: p.color ?? '#6366f1',
  };
}

// ---------------------------------------------------------------------------
// Inline form for add / edit
// ---------------------------------------------------------------------------
interface FormProps {
  initial: PresetFormState;
  onSave: (f: PresetFormState) => void;
  onCancel: () => void;
  submitLabel: string;
}

function PresetForm({ initial, onSave, onCancel, submitLabel }: FormProps) {
  const [form, setForm] = useState<PresetFormState>(initial);

  function numField(
    label: string,
    key: 'hours' | 'minutes' | 'seconds',
    max: number,
  ) {
    return (
      <div className="flex flex-col gap-0.5 items-center">
        <input
          type="number"
          min={0}
          max={max}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-14 text-center rounded-lg border border-surface-200 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 text-sm py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/50 tabular-nums"
        />
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
    );
  }

  const valid = form.name.trim().length > 0 && formToDurationSeconds(form) > 0;

  return (
    <div className="rounded-xl border border-surface-100 dark:border-gray-700 bg-surface-50 dark:bg-surface-900/50 p-4 space-y-3">
      {/* Name */}
      <input
        type="text"
        placeholder="Preset name…"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="w-full rounded-lg border border-surface-200 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/50"
        autoFocus
      />

      {/* Duration */}
      <div className="flex items-end gap-2">
        {numField('Hours', 'hours', 99)}
        <span className="text-gray-400 text-lg font-light pb-5">:</span>
        {numField('Min', 'minutes', 59)}
        <span className="text-gray-400 text-lg font-light pb-5">:</span>
        {numField('Sec', 'seconds', 59)}
      </div>

      {/* Icon + color row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <input
            type="text"
            placeholder="🍅"
            maxLength={2}
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            className="w-12 text-center rounded-lg border border-surface-200 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 text-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <span className="text-[10px] text-gray-400 uppercase tracking-wide text-center">Icon</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform',
                form.color === c ? 'border-white scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => valid && onSave(form)}
          disabled={!valid}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: form.color }}
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset row
// ---------------------------------------------------------------------------
interface PresetRowProps {
  preset: TimerPreset;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
}

function PresetRow({
  preset,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  onDelete,
  onStart,
}: PresetRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none',
        isDragging
          ? 'opacity-40 border-accent/50 bg-accent/5'
          : 'border-transparent hover:bg-surface-50 dark:hover:bg-surface-700/40',
        isDragOver && !isDragging ? 'border-t-2 border-t-accent' : '',
      )}
    >
      {/* Drag handle */}
      <span className="text-gray-300 dark:text-gray-600 text-xs leading-none select-none">⠿</span>

      {/* Color dot + icon */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ backgroundColor: (preset.color ?? '#6366f1') + '22' }}
      >
        {preset.icon ? (
          <span>{preset.icon}</span>
        ) : (
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: preset.color ?? '#6366f1' }}
          />
        )}
      </div>

      {/* Name + duration */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{preset.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDur(preset.durationSeconds)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onStart}
          className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: preset.color ?? '#6366f1' }}
        >
          ▶
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-xs"
          title="Edit"
        >
          ✏
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
interface PresetModalProps {
  onClose: () => void;
}

export function PresetModal({ onClose }: PresetModalProps) {
  const { presets, addPreset, updatePreset, deletePreset, reorderPresets, startPreset } =
    useTimerStore();

  const sorted = [...presets].sort((a, b) => a.order - b.order);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const fromIdx = sorted.findIndex((p) => p.id === draggingId);
    const toIdx = sorted.findIndex((p) => p.id === targetId);
    const newOrder = [...sorted];
    const moved = newOrder.splice(fromIdx, 1)[0];
    if (!moved) return;
    newOrder.splice(toIdx, 0, moved);
    reorderPresets(newOrder.map((p) => p.id));
    setDraggingId(null);
    setDragOverId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-surface-800 rounded-3xl shadow-2xl border border-surface-100 dark:border-gray-700/50 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-100 dark:border-gray-700/40">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Timer Presets</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {sorted.map((preset) =>
            editingId === preset.id ? (
              <div key={preset.id} className="mb-2">
                <PresetForm
                  initial={presetToForm(preset)}
                  submitLabel="Save changes"
                  onSave={(f) => {
                    updatePreset(preset.id, {
                      name: f.name.trim(),
                      durationSeconds: formToDurationSeconds(f),
                      icon: f.icon.trim() || undefined,
                      color: f.color,
                    });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : confirmDeleteId === preset.id ? (
              <div
                key={preset.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40"
              >
                <p className="flex-1 text-sm text-red-700 dark:text-red-400">
                  Delete <strong>{preset.name}</strong>?
                </p>
                <button
                  onClick={() => { deletePreset(preset.id); setConfirmDeleteId(null); }}
                  className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1 rounded-lg text-gray-500 dark:text-gray-400 text-xs hover:bg-surface-100 dark:hover:bg-surface-700"
                >
                  Keep
                </button>
              </div>
            ) : (
              <PresetRow
                key={preset.id}
                preset={preset}
                isDragging={draggingId === preset.id}
                isDragOver={dragOverId === preset.id && draggingId !== preset.id}
                onDragStart={() => setDraggingId(preset.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(preset.id); }}
                onDrop={() => handleDrop(preset.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                onEdit={() => { setEditingId(preset.id); setConfirmDeleteId(null); }}
                onDelete={() => { setConfirmDeleteId(preset.id); setEditingId(null); }}
                onStart={() => { startPreset(preset.id); onClose(); }}
              />
            ),
          )}

          {sorted.length === 0 && !showAddForm && (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-8">
              No presets yet. Add one below.
            </p>
          )}
        </div>

        {/* Add form / Add button */}
        <div className="px-4 pb-5 pt-3 border-t border-surface-100 dark:border-gray-700/40">
          {showAddForm ? (
            <PresetForm
              initial={EMPTY_FORM}
              submitLabel="Add preset"
              onSave={(f) => {
                addPreset({
                  name: f.name.trim(),
                  durationSeconds: formToDurationSeconds(f),
                  icon: f.icon.trim() || undefined,
                  color: f.color,
                });
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-surface-200 dark:border-gray-600 text-sm font-medium text-gray-400 dark:text-gray-500 hover:border-accent/50 hover:text-accent transition-colors"
            >
              + Add Preset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
