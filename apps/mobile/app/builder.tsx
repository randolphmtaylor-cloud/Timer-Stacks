// ---------------------------------------------------------------------------
// Builder screen — create or edit a timer stack.
// Route params:
//   stackId (optional) — when present, load and edit the existing stack.
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { formatMsHuman, type ParsedTask } from '@timer-stacks/core';
import { useStackStore } from '../src/stores/stackStore.js';
import { PasteImportSheet } from '../src/components/PasteImportSheet.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SegmentDraft {
  id: string;
  label: string;
  durationMs: number;
  color: string;
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4'];
const DEFAULT_COLOR = '#6366f1';

function makeSegment(index: number): SegmentDraft {
  return { id: uuidv4(), label: '', durationMs: 5 * 60_000, color: COLORS[index % COLORS.length] ?? DEFAULT_COLOR };
}

function parseMinutes(text: string): number | null {
  const n = parseFloat(text);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 60_000);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BuilderScreen() {
  const router = useRouter();
  const { stackId } = useLocalSearchParams<{ stackId?: string }>();
  const dark = useColorScheme() === 'dark';
  const C = dark ? DARK : LIGHT;
  const { stacks, create, update } = useStackStore();

  const isEditMode = Boolean(stackId);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [segments, setSegments] = useState<SegmentDraft[]>([makeSegment(0), makeSegment(1)]);
  const [saving, setSaving] = useState(false);
  const [pasteVisible, setPasteVisible] = useState(false);
  const formInitialized = useRef(false);

  // Populate form when editing — guard with a ref so background syncs never
  // reset an in-progress edit. We keep `stacks` in deps to handle the case
  // where the builder mounts before the store has finished loading.
  useEffect(() => {
    if (!stackId || formInitialized.current) return;
    const stack = stacks.find((s) => s.stackId === stackId);
    if (!stack) return;
    formInitialized.current = true;
    setName(stack.name);
    setIcon(stack.icon ?? '');
    setDescription(stack.description ?? '');
    setIsTemplate(stack.isTemplate);
    setSegments(
      stack.segments.map((s) => ({
        id: s.segmentId,
        label: s.label,
        durationMs: s.durationMs,
        color: s.color ?? DEFAULT_COLOR,
      })),
    );
  }, [stackId, stacks]);

  const totalMs = segments.reduce((acc, s) => acc + s.durationMs, 0);

  function updateSegment(id: string, patch: Partial<SegmentDraft>) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSegment(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  function duplicateSegment(id: string) {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx]!, id: uuidv4() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function handlePasteImport(tasks: ParsedTask[]) {
    const imported: SegmentDraft[] = tasks.map((t, i) => ({
      id: uuidv4(),
      label: t.title,
      durationMs: t.durationSeconds * 1000,
      color: COLORS[i % COLORS.length] ?? DEFAULT_COLOR,
    }));
    // Replace current segments with imported ones
    setSegments(imported);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a stack name.');
      return;
    }
    if (segments.length === 0) {
      Alert.alert('Segments required', 'Add at least one segment.');
      return;
    }
    const emptyIdx = segments.findIndex((s) => !s.label.trim());
    if (emptyIdx !== -1) {
      Alert.alert('Segment labels required', `Segment ${emptyIdx + 1} needs a label.`);
      return;
    }

    setSaving(true);
    try {
      const segmentInputs = segments.map((s) => ({
        segmentId: isEditMode ? s.id : undefined,
        label: s.label.trim(),
        durationMs: s.durationMs,
        color: s.color,
      }));

      if (isEditMode && stackId) {
        await update({
          stackId,
          name: name.trim(),
          icon: icon.trim() || undefined,
          description: description.trim() || undefined,
          isTemplate,
          totalDurationMs: totalMs,
          segments: segmentInputs,
        });
      } else {
        await create({
          name: name.trim(),
          icon: icon.trim() || undefined,
          description: description.trim() || undefined,
          isTemplate,
          totalDurationMs: totalMs,
          segments: segmentInputs,
        });
      }
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: C.bg }]}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stack identity row */}
        <View style={s.nameRow}>
          <TextInput
            value={icon}
            onChangeText={setIcon}
            placeholder="🎯"
            maxLength={2}
            style={[s.iconInput, { backgroundColor: C.card, color: C.text }]}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Stack name…"
            placeholderTextColor={C.muted}
            style={[s.nameInput, { backgroundColor: C.card, color: C.text }]}
          />
        </View>

        {/* Description */}
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={C.muted}
          style={[s.descInput, { backgroundColor: C.card, color: C.text, borderColor: C.border }]}
          multiline
        />

        {/* Template toggle */}
        <View style={[s.toggleRow, { backgroundColor: C.card }]}>
          <Text style={[s.toggleLabel, { color: C.text }]}>Save as Template</Text>
          <Switch
            value={isTemplate}
            onValueChange={setIsTemplate}
            trackColor={{ true: '#6366f1' }}
          />
        </View>

        {/* Segments header */}
        <View style={s.segmentsHeader}>
          <Text style={[s.sectionLabel, { color: C.muted }]}>SEGMENTS</Text>
          <View style={s.segmentsHeaderRight}>
            <Text style={[s.totalLabel, { color: C.muted }]}>{formatMsHuman(totalMs)}</Text>
            <TouchableOpacity
              style={[s.pasteBtn, { backgroundColor: C.card }]}
              onPress={() => setPasteVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.pasteBtnText, { color: '#6366f1' }]}>📋 Paste Tasks</Text>
            </TouchableOpacity>
          </View>
        </View>

        {segments.map((seg, i) => (
          <SegmentRow
            key={seg.id}
            seg={seg}
            index={i}
            canRemove={segments.length > 1}
            colors={C}
            onUpdate={(patch) => updateSegment(seg.id, patch)}
            onRemove={() => removeSegment(seg.id)}
            onDuplicate={() => duplicateSegment(seg.id)}
            onMoveUp={() => {
              if (i === 0) return;
              setSegments((p) => {
                const a = [...p];
                [a[i - 1], a[i]] = [a[i]!, a[i - 1]!];
                return a;
              });
            }}
            onMoveDown={() => {
              if (i === segments.length - 1) return;
              setSegments((p) => {
                const a = [...p];
                [a[i], a[i + 1]] = [a[i + 1]!, a[i]!];
                return a;
              });
            }}
          />
        ))}

        <TouchableOpacity
          style={[s.addSegmentBtn, { borderColor: C.border }]}
          onPress={() => setSegments((p) => [...p, makeSegment(p.length)])}
        >
          <Text style={[s.addSegmentText, { color: C.muted }]}>+ Add Segment</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnText}>
            {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Stack'}
          </Text>
        </TouchableOpacity>

        {isEditMode && (
          <TouchableOpacity
            style={s.cancelLink}
            onPress={() => router.back()}
          >
            <Text style={[s.cancelLinkText, { color: C.muted }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PasteImportSheet
        visible={pasteVisible}
        onClose={() => setPasteVisible(false)}
        onImport={handlePasteImport}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// SegmentRow sub-component
// ---------------------------------------------------------------------------

interface SegmentRowProps {
  seg: SegmentDraft;
  index: number;
  canRemove: boolean;
  colors: typeof LIGHT;
  onUpdate: (patch: Partial<SegmentDraft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SegmentRow({ seg, index, canRemove, colors, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown }: SegmentRowProps) {
  const [durText, setDurText] = useState(String(seg.durationMs / 60_000));

  // Keep durText in sync when paste import replaces segments
  useEffect(() => {
    setDurText(String(seg.durationMs / 60_000));
  }, [seg.durationMs]);

  function commitDuration(text: string) {
    const ms = parseMinutes(text);
    if (ms) onUpdate({ durationMs: ms });
    else setDurText(String(seg.durationMs / 60_000));
  }

  return (
    <View style={[s.segmentCard, { backgroundColor: colors.card }]}>
      {/* Top row: color dot + label + duration */}
      <View style={s.segmentTopRow}>
        <View style={[s.colorDot, { backgroundColor: seg.color }]} />
        <TextInput
          value={seg.label}
          onChangeText={(t) => onUpdate({ label: t })}
          placeholder={`Segment ${index + 1}`}
          placeholderTextColor={colors.muted}
          style={[s.segmentLabel, { color: colors.text }]}
        />
        <TextInput
          value={durText}
          onChangeText={setDurText}
          onBlur={() => commitDuration(durText)}
          onSubmitEditing={() => commitDuration(durText)}
          keyboardType="decimal-pad"
          style={[s.durationInput, { color: colors.text, borderColor: colors.border }]}
        />
        <Text style={[s.minLabel, { color: colors.muted }]}>min</Text>
      </View>

      {/* Color picker row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.colorRow}>
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onUpdate({ color: c })}
            style={[
              s.colorChip,
              { backgroundColor: c },
              seg.color === c && s.colorChipSelected,
            ]}
          />
        ))}
      </ScrollView>

      {/* Action row */}
      <View style={s.segmentActions}>
        <ActionBtn label="↑" onPress={onMoveUp} color={colors.muted} />
        <ActionBtn label="↓" onPress={onMoveDown} color={colors.muted} />
        <ActionBtn label="⧉" onPress={onDuplicate} color={colors.muted} />
        {canRemove && (
          <ActionBtn label="✕" onPress={onRemove} color="#ef4444" />
        )}
      </View>
    </View>
  );
}

function ActionBtn({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.actionBtnTap} hitSlop={6} activeOpacity={0.7}>
      <Text style={[s.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af', border: '#e5e7eb' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280', border: '#374151' };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },

  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  iconInput: { width: 56, textAlign: 'center', fontSize: 24, borderRadius: 14, paddingVertical: 10 },
  nameInput: { flex: 1, fontSize: 17, fontWeight: '600', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },

  descInput: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, minHeight: 52, marginBottom: 10 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, marginBottom: 20 },
  toggleLabel: { fontSize: 15 },

  segmentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  segmentsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  totalLabel: { fontSize: 13 },
  pasteBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  pasteBtnText: { fontSize: 13, fontWeight: '600' },

  segmentCard: { borderRadius: 16, padding: 14, marginBottom: 10 },
  segmentTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  colorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  segmentLabel: { flex: 1, fontSize: 15 },
  durationInput: { width: 56, textAlign: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 6, fontSize: 15 },
  minLabel: { fontSize: 12 },

  colorRow: { marginBottom: 8 },
  colorChip: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  colorChipSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },

  segmentActions: { flexDirection: 'row', gap: 8 },
  actionBtnTap: { padding: 4 },
  actionBtnText: { fontSize: 16, fontWeight: '600' },

  addSegmentBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  addSegmentText: { fontSize: 15 },

  saveBtn: { backgroundColor: '#6366f1', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  cancelLink: { alignItems: 'center', paddingVertical: 8 },
  cancelLinkText: { fontSize: 15 },
});
