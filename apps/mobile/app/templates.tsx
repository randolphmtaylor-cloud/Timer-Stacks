import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMsHuman } from '@timer-stacks/core';
import { useStackStore } from '../src/stores/stackStore.js';
import { useSessionStore } from '../src/stores/sessionStore.js';

export default function TemplatesScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { stacks, duplicate, delete: deleteStack } = useStackStore();
  const { start } = useSessionStore();

  const templates = stacks.filter((s) => s.isTemplate);

  function handleStart(stackId: string) {
    const stack = stacks.find((s) => s.stackId === stackId);
    if (!stack) return;
    const session = start(stack);
    router.push(`/session/${session.sessionId}`);
  }

  function confirmDelete(stackId: string, name: string) {
    Alert.alert(
      'Delete Template',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteStack(stackId) },
      ],
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {templates.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>◫</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No templates</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Save a stack as a template to reuse it quickly.
          </Text>
        </View>
      ) : (
        templates.map((template) => (
          <View key={template.stackId} style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              {template.icon ? <Text style={styles.icon}>{template.icon}</Text> : null}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{template.name}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>
                  {template.segments.length} segments · {formatMsHuman(template.totalDurationMs)}
                </Text>
              </View>
            </View>

            {template.segments.map((seg) => (
              <View key={seg.segmentId} style={styles.segRow}>
                <View style={[styles.dot, { backgroundColor: seg.color ?? '#6366f1' }]} />
                <Text style={[styles.segName, { color: colors.text }]}>{seg.label}</Text>
                <Text style={[styles.segDur, { color: colors.muted }]}>{formatMsHuman(seg.durationMs)}</Text>
              </View>
            ))}

            <View style={[styles.colorBar, { marginVertical: 12 }]}>
              {template.segments.map((seg) => (
                <View key={seg.segmentId} style={[styles.colorBarSeg, { flex: seg.durationMs, backgroundColor: seg.color ?? '#6366f1' }]} />
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleStart(template.stackId)}>
                <Text style={styles.primaryBtnText}>▶ Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.track }]} onPress={() => duplicate(template.stackId)}>
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Duplicate</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(template.stackId, template.name)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af', track: '#f3f4f6' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280', track: '#374151' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 20, padding: 18, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  icon: { fontSize: 22 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  segName: { flex: 1, fontSize: 14 },
  segDur: { fontSize: 13 },
  colorBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', gap: 2 },
  colorBarSeg: { borderRadius: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  secondaryBtnText: { fontWeight: '500', fontSize: 14 },
  deleteText: { color: '#ef4444', fontSize: 14, marginLeft: 'auto' },
});
