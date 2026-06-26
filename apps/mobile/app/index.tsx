import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStackStore } from '../src/stores/stackStore.js';
import { useSessionStore } from '../src/stores/sessionStore.js';
import { useSessionTick } from '../src/hooks/useSessionTick.js';
import { formatMsHuman, formatMs } from '@timer-stacks/core';
import type { Session, TimerStack } from '@timer-stacks/core';

export default function DashboardScreen() {
  const router = useRouter();
  const { stacks, delete: deleteStack, duplicate } = useStackStore();
  const { sessions, start, previousSegment, resetSegment, getSessionState } = useSessionStore();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;

  const activeSessions = sessions.filter((s) => {
    if (s.completedAt !== null) return false;
    if (s.status !== 'running' && s.status !== 'paused') return false;
    const state = getSessionState(s.sessionId);
    return s.status === 'paused' || (state?.stackRemainingMs ?? 1) > 0;
  });

  function handleStart(stack: TimerStack) {
    const session = start(stack);
    router.push(`/session/${session.sessionId}`);
  }

  function showStackMenu(stack: TimerStack) {
    const options = ['Edit Stack', 'Duplicate', 'Delete', 'Cancel'];
    const destructiveIndex = 2;
    const cancelIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        (idx) => {
          if (idx === 0) router.push(`/builder?stackId=${stack.stackId}`);
          if (idx === 1) duplicate(stack.stackId).catch(() => {});
          if (idx === 2) confirmDelete(stack);
        },
      );
    } else {
      Alert.alert(stack.name, 'Choose an action', [
        { text: 'Edit', onPress: () => router.push(`/builder?stackId=${stack.stackId}`) },
        { text: 'Duplicate', onPress: () => duplicate(stack.stackId).catch(() => {}) },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(stack) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function confirmDelete(stack: TimerStack) {
    Alert.alert(
      'Delete Stack',
      `Delete "${stack.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteStack(stack.stackId).catch(() => {}) },
      ],
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>RUNNING NOW</Text>
          {activeSessions.map((session) => {
            const stack = stacks.find((s) => s.stackId === session.stackId);
            if (!stack) return null;
            return (
              <RunningCard
                key={session.sessionId}
                session={session}
                stack={stack}
                colors={colors}
                onPress={() => router.push(`/session/${session.sessionId}`)}
                onPrevious={() => previousSegment(session.sessionId)}
                onResetSegment={() => resetSegment(session.sessionId)}
              />
            );
          })}
        </View>
      )}

      {/* All stacks */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>STACKS</Text>
        {stacks.filter((s) => !s.isTemplate).length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={styles.emptyEmoji}>⏱</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No stacks yet</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Create a timer stack to build structured routines.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/builder')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>+ Create Stack</Text>
            </TouchableOpacity>
          </View>
        ) : (
          stacks.filter((s) => !s.isTemplate).map((stack) => (
            <StackCard
              key={stack.stackId}
              stack={stack}
              colors={colors}
              onPress={() => handleStart(stack)}
              onMenu={() => showStackMenu(stack)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// StackCard
// ---------------------------------------------------------------------------

function StackCard({
  stack,
  colors,
  onPress,
  onMenu,
}: {
  stack: TimerStack;
  colors: typeof LIGHT;
  onPress: () => void;
  onMenu: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.stackCard, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.stackCardTop}>
        <View style={styles.stackMeta}>
          {stack.icon ? <Text style={styles.stackIcon}>{stack.icon}</Text> : null}
          <View style={{ flex: 1 }}>
            <Text style={[styles.stackName, { color: colors.text }]} numberOfLines={1}>{stack.name}</Text>
            <Text style={[styles.stackSub, { color: colors.muted }]}>
              {stack.segments.length} segments · {formatMsHuman(stack.totalDurationMs)}
            </Text>
          </View>
        </View>
        <View style={styles.stackCardRight}>
          <TouchableOpacity onPress={onMenu} hitSlop={8} style={styles.menuBtn} activeOpacity={0.6}>
            <Text style={[styles.menuBtnText, { color: colors.muted }]}>⋯</Text>
          </TouchableOpacity>
          <View style={styles.startBadge}>
            <Text style={styles.startBadgeText}>▶</Text>
          </View>
        </View>
      </View>
      {/* Color bar */}
      <View style={styles.colorBar}>
        {stack.segments.map((seg) => (
          <View
            key={seg.segmentId}
            style={[
              styles.colorBarSegment,
              { flex: seg.durationMs, backgroundColor: seg.color ?? '#6366f1' },
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// RunningCard
// ---------------------------------------------------------------------------

function RunningCard({
  session,
  stack,
  colors,
  onPress,
  onPrevious,
  onResetSegment,
}: {
  session: Session;
  stack: TimerStack;
  colors: typeof LIGHT;
  onPress: () => void;
  onPrevious: () => void;
  onResetSegment: () => void;
}) {
  const tick = useSessionTick(session.sessionId);
  const activeSegment = stack.segments[session.activeSegmentIndex];
  const canGoPrevious = session.activeSegmentIndex > 0;

  return (
    <TouchableOpacity
      style={[styles.runningCard, { backgroundColor: colors.card, borderLeftColor: '#6366f1' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.runningCardRow}>
        <View>
          <Text style={[styles.stackName, { color: colors.text }]}>{stack.name}</Text>
          <Text style={[styles.stackSub, { color: '#6366f1' }]}>
            {session.status === 'paused' ? 'Paused · ' : ''}{activeSegment?.label}
          </Text>
        </View>
        <Text style={[styles.timerLg, { color: colors.text }]}>
          {formatMs(tick?.stackRemainingMs ?? 0)}
        </Text>
      </View>
      {tick && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${tick.stackProgress * 100}%` as unknown as number, backgroundColor: '#6366f1' },
            ]}
          />
        </View>
      )}
      <View style={styles.runningActions}>
        <TouchableOpacity
          style={[styles.runningActionBtn, { backgroundColor: colors.bg, opacity: canGoPrevious ? 1 : 0.45 }]}
          onPress={onPrevious}
          disabled={!canGoPrevious}
          activeOpacity={0.8}
        >
          <Text style={[styles.runningActionText, { color: colors.text }]}>⏮ Previous Segment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.runningActionBtn, { backgroundColor: colors.bg }]}
          onPress={onResetSegment}
          activeOpacity={0.8}
        >
          <Text style={[styles.runningActionText, { color: colors.text }]}>↺ Reset Segment</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Colors & styles
// ---------------------------------------------------------------------------

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },

  emptyCard: { borderRadius: 20, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyBody: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  primaryBtn: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  stackCard: {
    borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  stackCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  stackMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  stackIcon: { fontSize: 24 },
  stackName: { fontSize: 16, fontWeight: '600' },
  stackSub: { fontSize: 13, marginTop: 2 },
  stackCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBtn: { padding: 6 },
  menuBtnText: { fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  startBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  startBadgeText: { color: '#fff', fontSize: 14 },
  colorBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', gap: 2 },
  colorBarSegment: { borderRadius: 2 },

  runningCard: {
    borderRadius: 20, padding: 16, marginBottom: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  runningCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  timerLg: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  runningActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  runningActionBtn: { flexGrow: 1, flexBasis: '45%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  runningActionText: { fontSize: 13, fontWeight: '600' },
});
