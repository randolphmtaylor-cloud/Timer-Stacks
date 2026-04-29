import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useSessionStore } from '../src/stores/sessionStore.js';
import { formatMsHuman } from '@timer-stacks/core';

export default function HistoryScreen() {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { history, loadHistory } = useSessionStore();

  useEffect(() => { loadHistory(); }, [loadHistory]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16, marginBottom: 10 },
  statusBar: { width: 4, height: 40, borderRadius: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowName: { flex: 1, fontWeight: '600', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  rowSub: { fontSize: 13 },
});
