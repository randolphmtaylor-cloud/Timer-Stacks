import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '../../src/stores/sessionStore.js';
import { useStackStore } from '../../src/stores/stackStore.js';
import { useSessionTick } from '../../src/hooks/useSessionTick.js';
import { formatMs, formatMsHuman } from '@timer-stacks/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function triggerMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
function triggerSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SessionScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const C = dark ? DARK : LIGHT;

  const { sessions, pause, resume, skip, reset, cancel } = useSessionStore();
  const { stacks } = useStackStore();

  const session = sessions.find((s) => s.sessionId === sessionId);
  const stack = session ? stacks.find((s) => s.stackId === session.stackId) : undefined;
  const tick = useSessionTick(sessionId ?? null);

  // Fire haptic when a segment transition happens
  const prevSegmentIndex = useRef(session?.activeSegmentIndex ?? 0);
  useEffect(() => {
    if (!session) return;
    if (session.activeSegmentIndex !== prevSegmentIndex.current) {
      prevSegmentIndex.current = session.activeSegmentIndex;
      triggerMedium();
    }
  }, [session?.activeSegmentIndex]);

  // Fire haptic on completion
  useEffect(() => {
    if (session?.status === 'completed') triggerSuccess();
  }, [session?.status]);

  // ---------------------------------------------------------------------------
  // Not found / ended
  // ---------------------------------------------------------------------------
  if (!session || !stack) {
    return (
      <SafeAreaView style={[s.centered, { backgroundColor: C.bg }]}>
        <Text style={s.heroEmoji}>🏁</Text>
        <Text style={[s.heroTitle, { color: C.text }]}>Session ended</Text>
        <Pill label="Back to Dashboard" onPress={() => router.replace('/')} color="#6366f1" />
      </SafeAreaView>
    );
  }

  const isRunning = session.status === 'running';
  const isCompleted = session.status === 'completed';
  const activeSegment = stack.segments[session.activeSegmentIndex];
  const upcoming = stack.segments.slice(session.activeSegmentIndex + 1, session.activeSegmentIndex + 4);

  // Extract primitives so TS narrowing holds inside Alert callback lambdas
  const sid = session.sessionId;
  const resolvedStack = stack;

  function onPauseResume() {
    triggerLight();
    isRunning ? pause(sid) : resume(sid);
  }

  function onSkip() {
    triggerMedium();
    Alert.alert(
      'Skip Segment',
      `Skip "${activeSegment?.label ?? 'this segment'}" and move to the next?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => skip(sid) },
      ],
    );
  }

  function onReset() {
    Alert.alert(
      'Reset Session',
      'Start over from the beginning? All progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => reset(sid) },
      ],
    );
  }

  function onStop() {
    Alert.alert(
      'Stop Session',
      'This will end the session and record it as cancelled.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            await cancel(sid, resolvedStack);
            router.replace('/');
          },
        },
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Completion screen
  // ---------------------------------------------------------------------------
  if (isCompleted) {
    return (
      <SafeAreaView style={[s.centered, { backgroundColor: C.bg }]}>
        <Text style={s.heroEmoji}>🎉</Text>
        <Text style={[s.heroTitle, { color: C.text }]}>Complete!</Text>
        <Text style={[s.heroSub, { color: C.muted }]}>{stack.name}</Text>
        <Pill label="Done" onPress={() => router.replace('/')} color="#6366f1" />
      </SafeAreaView>
    );
  }

  const segColor = activeSegment?.color ?? '#6366f1';
  const segProgress = tick?.segmentProgress ?? 0;
  const stackProgress = tick?.stackProgress ?? 0;

  // ---------------------------------------------------------------------------
  // Main layout — three fixed zones, nothing scrolls off screen
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]}>

      {/* ── ZONE 1: Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backTap} hitSlop={12}>
          <Text style={[s.backChevron, { color: C.muted }]}>‹</Text>
        </TouchableOpacity>

        <View style={s.headerCenter}>
          {stack.icon ? <Text style={s.headerIcon}>{stack.icon}</Text> : null}
          <Text style={[s.headerTitle, { color: C.text }]} numberOfLines={1}>
            {stack.name}
          </Text>
        </View>

        {session.status === 'paused' ? (
          <View style={[s.statusPill, { backgroundColor: '#fef3c7' }]}>
            <Text style={[s.statusPillText, { color: '#b45309' }]}>Paused</Text>
          </View>
        ) : (
          <View style={[s.statusPill, { backgroundColor: `${segColor}20` }]}>
            <View style={[s.liveDot, { backgroundColor: segColor }]} />
            <Text style={[s.statusPillText, { color: segColor }]}>Live</Text>
          </View>
        )}
      </View>

      {/* ── ZONE 2: Timer hero — takes all remaining space ─────────── */}
      <View style={s.heroZone}>

        {/* Segment color ring + label */}
        <View style={s.segmentHeader}>
          <View style={[s.segmentSwatch, { backgroundColor: segColor }]} />
          <Text style={[s.segmentName, { color: C.muted }]} numberOfLines={1}>
            {activeSegment?.label ?? '—'}
          </Text>
          <Text style={[s.segmentCount, { color: C.dim }]}>
            {session.activeSegmentIndex + 1} / {stack.segments.length}
          </Text>
        </View>

        {/* Big countdown */}
        <Text style={[s.bigTimer, { color: C.text }]}>
          {formatMs(tick?.segmentRemainingMs ?? 0)}
        </Text>

        {/* Segment progress bar */}
        <View style={[s.progressTrack, { backgroundColor: C.track }]}>
          <View
            style={[
              s.progressFill,
              { flex: segProgress, backgroundColor: segColor },
            ]}
          />
          <View style={{ flex: 1 - segProgress }} />
        </View>

        {/* Stack summary row */}
        <View style={[s.stackRow, { backgroundColor: C.card }]}>
          <View>
            <Text style={[s.stackRowLabel, { color: C.muted }]}>Stack remaining</Text>
            <Text style={[s.stackRowTimer, { color: C.text }]}>
              {formatMs(tick?.stackRemainingMs ?? 0)}
            </Text>
          </View>
          <View style={s.stackRowProgress}>
            <Text style={[s.stackRowLabel, { color: C.muted }]}>
              {Math.round(stackProgress * 100)}% done
            </Text>
            <View style={[s.progressTrackSm, { backgroundColor: C.track }]}>
              <View style={[s.progressFill, { flex: stackProgress, backgroundColor: '#a5b4fc' }]} />
              <View style={{ flex: 1 - stackProgress }} />
            </View>
          </View>
        </View>

        {/* Upcoming segments (compact — 3 max) */}
        {upcoming.length > 0 && (
          <View style={s.upcomingStrip}>
            {upcoming.map((seg, i) => (
              <View
                key={seg.segmentId}
                style={[
                  s.upcomingChip,
                  { backgroundColor: C.card, opacity: i === 0 ? 1 : 0.5 },
                ]}
              >
                <View style={[s.upcomingDot, { backgroundColor: seg.color ?? '#6366f1' }]} />
                <Text style={[s.upcomingLabel, { color: C.text }]} numberOfLines={1}>
                  {seg.label}
                </Text>
                <Text style={[s.upcomingDur, { color: C.muted }]}>
                  {formatMsHuman(seg.durationMs)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── ZONE 3: Controls — always pinned at bottom ─────────────── */}
      <View style={[s.controlsZone, { borderTopColor: C.divider }]}>
        {/* Primary: Pause / Resume */}
        <TouchableOpacity
          style={[s.primaryControl, { backgroundColor: isRunning ? segColor : '#10b981' }]}
          onPress={onPauseResume}
          activeOpacity={0.82}
        >
          <Text style={s.primaryControlText}>{isRunning ? '⏸  Pause' : '▶  Resume'}</Text>
        </TouchableOpacity>

        {/* Secondary row */}
        <View style={s.secondaryRow}>
          <SecondaryBtn label="⏭  Skip" onPress={onSkip} color={C} />
          <SecondaryBtn label="↺  Reset" onPress={onReset} color={C} />
          <SecondaryBtn label="■  Stop" onPress={onStop} color={C} danger />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Pill({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      style={[s.pill, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={s.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryBtn({
  label,
  onPress,
  color,
  danger,
}: {
  label: string;
  onPress: () => void;
  color: typeof LIGHT;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.secondaryBtn, { backgroundColor: color.card }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.secondaryBtnText, { color: danger ? '#ef4444' : color.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const LIGHT = {
  bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af',
  dim: '#c4c9d4', track: '#e5e7eb', divider: '#f0f0f0',
};
const DARK = {
  bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280',
  dim: '#4b5563', track: '#374151', divider: '#2a2a2e',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },

  // Hero states
  heroEmoji: { fontSize: 72, marginBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  heroSub:   { fontSize: 16, textAlign: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backTap: { padding: 4 },
  backChevron: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIcon: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  liveDot: { width: 6, height: 6, borderRadius: 3 },

  // Hero zone
  heroZone: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 16 },

  segmentHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    justifyContent: 'center',
  },
  segmentSwatch: { width: 12, height: 12, borderRadius: 6 },
  segmentName: { fontSize: 17, fontWeight: '500', flexShrink: 1 },
  segmentCount: { fontSize: 13 },

  bigTimer: {
    fontSize: 88,
    fontWeight: '700',
    letterSpacing: -3,
    textAlign: 'center',
    // tabular-nums via fontVariant isn't valid on all RN versions; we use monospace-like spacing naturally
  },

  progressTrack: {
    height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden',
  },
  progressTrackSm: {
    height: 4, borderRadius: 2, flexDirection: 'row', overflow: 'hidden', width: 100,
  },
  progressFill: { borderRadius: 3 },

  stackRow: {
    borderRadius: 20, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  stackRowLabel: { fontSize: 11, marginBottom: 4 },
  stackRowTimer: { fontSize: 26, fontWeight: '700' },
  stackRowProgress: { alignItems: 'flex-end', gap: 6 },

  upcomingStrip: { gap: 6 },
  upcomingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
  },
  upcomingDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  upcomingLabel: { flex: 1, fontSize: 14 },
  upcomingDur: { fontSize: 13 },

  // Controls zone
  controlsZone: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    gap: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryControl: {
    borderRadius: 18, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryControlText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '500' },

  pill: { paddingHorizontal: 32, paddingVertical: 15, borderRadius: 18 },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
