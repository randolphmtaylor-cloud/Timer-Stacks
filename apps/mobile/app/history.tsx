import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Share,
  Alert,
} from 'react-native';
import { useSessionStore } from '../src/stores/sessionStore.js';
import { useStackStore } from '../src/stores/stackStore.js';
import { formatMsHuman, buildSessionExport } from '@timer-stacks/core';
import type { SessionRecord } from '@timer-stacks/core';

export default function HistoryScreen() {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { history, loadHistory } = useSessionStore();
  const { stacks } = useStackStore();

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleExport(record: SessionRecord) {
    const stack = stacks.find((s) => s.stackId === record.stackId);
    let json: string;

    if (stack) {
      const payload = buildSessionExport(record, stack);
      json = JSON.stringify(payload, null, 2);
    } else {
      // Stack deleted — export minimal record
      json = JSON.stringify({
        exportVersion: 1,
        exportedAt: new Date().toISOString(),
        stackId: record.stackId,
        stackName: record.stackName,
        sessionId: record.sessionId,
        sessionStatus: record.status,
        startedAt: new Date(record.startedAt).toISOString(),
        endedAt: new Date(record.endedAt).toISOString(),
        totalActualDurationMs: record.totalElapsedMs,
        segmentsCompleted: record.segmentsCompleted,
        totalSegments: record.totalSegments,
        note: 'Stack definition was deleted — segment detail unavailable.',
      }, null, 2);
    }

    const datePart = new Date(record.startedAt).toISOString().slice(0, 10);
    const namePart = record.stackName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `session-${namePart}-${datePart}.json`;

    try {
      await Share.share({
        title: filename,
        message: json,
      });
    } catch (err) {
      if ((err as Error).message !== 'The user did not share') {
        Alert.alert('Export failed', String(err));
      }
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>◷</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No history yet</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Completed sessions will appear here.
          </Text>
        </View>
      ) : (
        history.map((record) => {
          const date = new Date(record.startedAt);
          const isComplete = record.status === 'completed';
          return (
            <View key={record.recordId} style={[styles.row, { backgroundColor: colors.card }]}>
              <View style={[styles.statusBar, { backgroundColor: isComplete ? '#10b981' : '#d1d5db' }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.topLine}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                    {record.stackName}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: isComplete ? '#d1fae5' : '#f3f4f6' }]}>
                    <Text style={[styles.badgeText, { color: isComplete ? '#059669' : '#6b7280' }]}>
                      {isComplete ? 'Done' : 'Cancelled'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.rowSub, { color: colors.muted }]}>
                  {date.toLocaleDateString()} · {record.segmentsCompleted}/{record.totalSegments} segments · {formatMsHuman(record.totalElapsedMs)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleExport(record)}
                style={styles.exportBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={[styles.exportBtnText, { color: colors.muted }]}>↑</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, padding: 16, marginBottom: 10,
  },
  statusBar: { width: 4, height: 40, borderRadius: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowName: { flex: 1, fontWeight: '600', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  exportBtn: { padding: 6 },
  exportBtnText: { fontSize: 20, fontWeight: '700' },
});
