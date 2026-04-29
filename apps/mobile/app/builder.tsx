import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { formatMsHuman } from '@timer-stacks/core';
import { useStackStore } from '../src/stores/stackStore.js';

interface SegmentDraft {
  id: string;
  label: string;
  durationMs: number;
  color: string;
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4'];

function makeSegment(index: number): SegmentDraft {
  return { id: uuidv4(), label: '', durationMs: 5 * 60_000, color: COLORS[index % COLORS.length]! };
}

export default function BuilderScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { create } = useStackStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [segments, setSegments] = useState<SegmentDraft[]>([makeSegment(0), makeSegment(1)]);
  const [saving, setSaving] = useState(false);

  const totalMs = segments.reduce((acc, s) => acc + s.durationMs, 0);

  function updateSegment(id: string, patch: Partial<SegmentDraft>) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function parseMinutes(text: string): number | null {
    const n = parseFloat(text);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 60_000);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a stack name.');
      return;
    }
    if (segments.some((s) => !s.label.trim())) {
      Alert.alert('Segment labels required', 'Please fill in all segment labels.');
      return;
    }
    setSaving(true);
    try {
      await create({
        name: name.trim(),
        totalDurationMs: totalMs,
        segments: segments.map((s) => ({ label: s.label, durationMs: s.durationMs, color: s.color })),
        icon: icon.trim() || undefined,
      });
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Stack name */}
      <View style={styles.nameRow}>
        <TextInput
          value={icon}
          onChangeText={setIcon}
          placeholder="🎯"
          maxLength={2}
          style={[styles.iconInput, { backgroundColor: colors.card, color: colors.text }]}
        />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Stack name…"
          placeholderTextColor={colors.muted}
          style={[styles.nameInput, { backgroundColor: colors.card, color: colors.text, flex: 1 }]}
        />
      </View>

      <Text style={[styles.totalLabel, { color: colors.muted }]}>
        Total: {formatMsHuman(totalMs)}
      </Text>

      {/* Segments */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>SEGMENTS</Text>
      {segments.map((seg, i) => (
        <View key={seg.id} style={[styles.segmentRow, { backgroundColor: colors.card }]}>
          <View style={[styles.colorDot, { backgroundColor: seg.color }]} />
          <TextInput
            value={seg.label}
            onChangeText={(t) => updateSegment(seg.id, { label: t })}
            placeholder={`Segment ${i + 1}`}
            placeholderTextColor={colors.muted}
            style={[styles.segmentLabel, { color: colors.text }]}
          />
          <TextInput
            value={String(seg.durationMs / 60_000)}
            onChangeText={(t) => {
              const ms = parseMinutes(t);
              if (ms) updateSegment(seg.id, { durationMs: ms });
            }}
            keyboardType="decimal-pad"
            style={[styles.durationInput, { color: colors.text, borderColor: colors.border }]}
          />
          <Text style={[styles.minLabel, { color: colors.muted }]}>min</Text>
          {segments.length > 1 && (
            <TouchableOpacity onPress={() => setSegments((p) => p.filter((s) => s.id !== seg.id))}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addSegmentBtn, { borderColor: colors.border }]}
        onPress={() => setSegments((p) => [...p, makeSegment(p.length)])}
      >
        <Text style={[styles.addSegmentText, { color: colors.muted }]}>+ Add Segment</Text>
      </TouchableOpacity>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Create Stack'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af', border: '#e5e7eb' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280', border: '#374151' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  iconInput: { width: 56, textAlign: 'center', fontSize: 24, borderRadius: 14, padding: 10 },
  nameInput: { fontSize: 17, fontWeight: '600', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  totalLabel: { textAlign: 'right', marginBottom: 24, fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, marginBottom: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  segmentLabel: { flex: 1, fontSize: 15 },
  durationInput: { width: 52, textAlign: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, fontSize: 15, fontVariant: ['tabular-nums'] },
  minLabel: { fontSize: 12 },
  removeBtn: { color: '#ef4444', fontSize: 16, paddingLeft: 4 },
  addSegmentBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 32 },
  addSegmentText: { fontSize: 15 },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
