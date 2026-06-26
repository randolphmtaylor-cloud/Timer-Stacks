// ---------------------------------------------------------------------------
// Standalone Timer screen — Apple Clock-style countdown timer with presets.
// Reuses useTimerStore (mobile) which mirrors the desktop timerStore.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTimerStore, computeRemainingMs, type TimerPreset } from '../src/stores/timerStore.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDurationShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0 && m === 0 && s === 0) return `${h}h`;
  if (h > 0 && s === 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0 && s === 0) return `${m}m`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// Circular progress ring (pure RN — no external SVG library)
// Uses the "two half-circles" clip technique.
// ---------------------------------------------------------------------------

interface RingProps {
  progress: number; // 0–1
  color: string;
  size: number;
  stroke: number;
}

function CircularProgress({ progress, color, size, stroke }: RingProps) {
  const p = Math.max(0, Math.min(1, progress));

  // We rotate two half-covers to reveal the ring.
  // Right half: always visible up to 0.5, rotates from 0° to 180°.
  // Left half: only visible when progress > 0.5.
  const rightDeg = Math.min(p, 0.5) * 360;
  const leftDeg  = Math.max(0, p - 0.5) * 360;

  const half = size / 2;
  const innerSize = size - stroke * 2;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {/* Track ring */}
      <View
        style={{
          position: 'absolute', width: size, height: size,
          borderRadius: half, borderWidth: stroke,
          borderColor: 'rgba(0,0,0,0.08)',
        }}
      />

      {/* Right half fill (clip view hides the left side) */}
      <View style={{ position: 'absolute', width: half, height: size, left: half, overflow: 'hidden' }}>
        <View
          style={{
            width: size, height: size, borderRadius: half,
            borderWidth: stroke, borderColor: color,
            transform: [{ rotate: `${rightDeg}deg` }],
            position: 'absolute', left: -half,
          }}
        />
      </View>

      {/* Left half fill — only shown when progress > 50% */}
      {p > 0.5 && (
        <View style={{ position: 'absolute', width: half, height: size, overflow: 'hidden' }}>
          <View
            style={{
              width: size, height: size, borderRadius: half,
              borderWidth: stroke, borderColor: color,
              transform: [{ rotate: `${leftDeg}deg` }],
              position: 'absolute',
            }}
          />
        </View>
      )}

      {/* Inner white/dark circle to create "ring" appearance */}
      <View
        style={{
          position: 'absolute',
          top: stroke, left: stroke,
          width: innerSize, height: innerSize,
          borderRadius: innerSize / 2,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Drum-roll wheel picker (H, M, S)
// ---------------------------------------------------------------------------

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;

interface WheelPickerProps {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  label: string;
  colors: typeof LIGHT;
}

function WheelPicker({ values, selected, onSelect, label, colors }: WheelPickerProps) {
  const flatRef = useRef<FlatList<number>>(null);
  const currentIdx = values.indexOf(selected);

  useEffect(() => {
    if (flatRef.current && currentIdx >= 0) {
      flatRef.current.scrollToIndex({ index: currentIdx, animated: false });
    }
  }, [currentIdx]);

  return (
    <View style={wheel.col}>
      <FlatList
        ref={flatRef}
        data={values}
        keyExtractor={(v) => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          const val = values[idx];
          if (val !== undefined) onSelect(val);
        }}
        renderItem={({ item }) => (
          <View style={[wheel.item, { height: ITEM_HEIGHT }]}>
            <Text
              style={[
                wheel.itemText,
                { color: item === selected ? colors.text : colors.muted },
                item === selected && wheel.selectedText,
              ]}
            >
              {String(item).padStart(2, '0')}
            </Text>
          </View>
        )}
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
      />
      {/* Selection highlight band */}
      <View
        pointerEvents="none"
        style={[
          wheel.highlight,
          { top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2), borderColor: colors.accent + '40' },
        ]}
      />
      <Text style={[wheel.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const wheel = StyleSheet.create({
  col: { alignItems: 'center', flex: 1, position: 'relative' },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 36, fontWeight: '300', fontVariant: ['tabular-nums'] },
  selectedText: { fontWeight: '500' },
  highlight: {
    position: 'absolute', left: 4, right: 4,
    height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1,
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 4 },
});

// ---------------------------------------------------------------------------
// Preset chip
// ---------------------------------------------------------------------------

function PresetChip({
  preset,
  active,
  colors,
  onPress,
}: {
  preset: TimerPreset;
  active: boolean;
  colors: typeof LIGHT;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        p.chip,
        { backgroundColor: active ? preset.color ?? colors.accent : colors.card },
        active && p.chipActive,
      ]}
      activeOpacity={0.8}
    >
      {preset.icon ? <Text style={p.chipIcon}>{preset.icon}</Text> : null}
      <Text style={[p.chipLabel, { color: active ? '#fff' : colors.text }]}>
        {formatDurationShort(preset.durationSeconds)}
      </Text>
    </TouchableOpacity>
  );
}

const p = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  chipActive: {},
  chipIcon: { fontSize: 14 },
  chipLabel: { fontSize: 13, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Manage Presets Modal
// ---------------------------------------------------------------------------

interface ManagePresetsModalProps {
  visible: boolean;
  onClose: () => void;
  colors: typeof LIGHT;
}

function ManagePresetsModal({ visible, onClose, colors }: ManagePresetsModalProps) {
  const { presets, addPreset, updatePreset, deletePreset } = useTimerStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState('0');
  const [newMins, setNewMins] = useState('5');
  const [newSecs, setNewSecs] = useState('0');

  const sorted = [...presets].sort((a, b) => a.order - b.order);

  function handleAdd() {
    const h = parseInt(newHours, 10) || 0;
    const m = parseInt(newMins, 10) || 0;
    const s = parseInt(newSecs, 10) || 0;
    const total = h * 3600 + m * 60 + s;
    if (total <= 0) { Alert.alert('Invalid duration', 'Duration must be greater than 0.'); return; }
    addPreset({ name: newName.trim() || formatDurationShort(total), durationSeconds: total });
    setAdding(false); setNewName(''); setNewHours('0'); setNewMins('5'); setNewSecs('0');
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pm.root, { backgroundColor: colors.bg }]}>
        <View style={[pm.header, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose}><Text style={[pm.done, { color: colors.accent }]}>Done</Text></TouchableOpacity>
          <Text style={[pm.title, { color: colors.text }]}>Presets</Text>
          <TouchableOpacity onPress={() => setAdding(true)}><Text style={[pm.done, { color: colors.accent }]}>+ Add</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={pm.body}>
          {adding && (
            <View style={[pm.addCard, { backgroundColor: colors.card }]}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Preset name (optional)"
                placeholderTextColor={colors.muted}
                style={[pm.input, { color: colors.text, borderColor: colors.divider }]}
              />
              <View style={pm.durationRow}>
                {[
                  { label: 'H', value: newHours, set: setNewHours },
                  { label: 'M', value: newMins, set: setNewMins },
                  { label: 'S', value: newSecs, set: setNewSecs },
                ].map(({ label, value, set }) => (
                  <View key={label} style={pm.durCol}>
                    <TextInput
                      value={value}
                      onChangeText={set}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={[pm.durInput, { color: colors.text, borderColor: colors.divider }]}
                    />
                    <Text style={[pm.durLabel, { color: colors.muted }]}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={pm.addActions}>
                <TouchableOpacity onPress={() => setAdding(false)} style={[pm.addBtn, { backgroundColor: colors.bg }]}>
                  <Text style={[pm.addBtnText, { color: colors.muted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} style={[pm.addBtn, { backgroundColor: colors.accent }]}>
                  <Text style={[pm.addBtnText, { color: '#fff' }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {sorted.map((preset) => (
            <View key={preset.id} style={[pm.row, { backgroundColor: colors.card }]}>
              {preset.icon ? <Text style={pm.presetIcon}>{preset.icon}</Text> : <View style={{ width: 24 }} />}
              <View style={{ flex: 1 }}>
                <Text style={[pm.presetName, { color: colors.text }]} numberOfLines={1}>{preset.name}</Text>
                <Text style={[pm.presetDur, { color: colors.muted }]}>{formatDurationShort(preset.durationSeconds)}</Text>
              </View>
              {!preset.id.startsWith('default-') && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete Preset', `Delete "${preset.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deletePreset(preset.id) },
                    ]);
                  }}
                  hitSlop={8}
                >
                  <Text style={pm.deleteBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const ACCENT = '#6366f1';
const pm = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '600' },
  done: { fontSize: 16 },
  body: { padding: 20, gap: 10, paddingBottom: 40 },
  addCard: { borderRadius: 20, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  durationRow: { flexDirection: 'row', gap: 10 },
  durCol: { flex: 1, alignItems: 'center', gap: 4 },
  durInput: { width: '100%', borderWidth: 1, borderRadius: 12, paddingVertical: 10, textAlign: 'center', fontSize: 20, fontWeight: '500' },
  durLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  addActions: { flexDirection: 'row', gap: 10 },
  addBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18 },
  presetIcon: { fontSize: 22 },
  presetName: { fontSize: 15, fontWeight: '500' },
  presetDur: { fontSize: 13, marginTop: 2 },
  deleteBtn: { color: '#ef4444', fontSize: 16, paddingHorizontal: 4 },
});

// ---------------------------------------------------------------------------
// Main Timer Screen
// ---------------------------------------------------------------------------

// Hour/minute/second arrays for wheel pickers
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const SECONDS = Array.from({ length: 60 }, (_, i) => i);

export default function TimerScreen() {
  const dark = useColorScheme() === 'dark';
  const C: typeof LIGHT = dark ? DARK : LIGHT;

  const { timer, presets, recentDurations, settings, hydrate, start, pause, resume, cancel, reset, _complete, setDuration, startPreset, updateSettings } = useTimerStore();

  // Hydrate from AsyncStorage on first mount
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      hydrate().catch(() => {});
    }
  }, [hydrate]);

  // Completion check interval
  useEffect(() => {
    if (timer.status !== 'running') return;
    const id = setInterval(() => {
      if (computeRemainingMs(timer) <= 0) {
        _complete();
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [timer, _complete]);

  // Live countdown refresh
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (timer.status !== 'running') return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [timer.status]);

  // Picker state (synced with timer.durationSeconds when idle)
  const [pickerH, setPickerH] = useState(() => Math.floor(timer.durationSeconds / 3600));
  const [pickerM, setPickerM] = useState(() => Math.floor((timer.durationSeconds % 3600) / 60));
  const [pickerS, setPickerS] = useState(() => timer.durationSeconds % 60);
  const [presetsOpen, setPresetsOpen] = useState(false);

  // Sync picker → store on change (only when idle)
  useEffect(() => {
    if (timer.status !== 'idle') return;
    const secs = pickerH * 3600 + pickerM * 60 + pickerS;
    if (secs !== timer.durationSeconds) setDuration(secs);
  }, [pickerH, pickerM, pickerS, timer.status, timer.durationSeconds, setDuration]);

  // Sync store → picker when a preset is started externally
  useEffect(() => {
    if (timer.status === 'idle') {
      setPickerH(Math.floor(timer.durationSeconds / 3600));
      setPickerM(Math.floor((timer.durationSeconds % 3600) / 60));
      setPickerS(timer.durationSeconds % 60);
    }
  }, [timer.durationSeconds, timer.status]);

  const remainingMs  = computeRemainingMs(timer);
  const totalMs      = timer.durationSeconds * 1000;
  const progress     = totalMs > 0 ? Math.max(0, 1 - remainingMs / totalMs) : 0;
  const isIdle       = timer.status === 'idle';
  const isRunning    = timer.status === 'running';
  const isPaused     = timer.status === 'paused';
  const isCompleted  = timer.status === 'completed';
  const isActive     = isRunning || isPaused;
  const accentColor  = presets.find((pr) => pr.id === timer.activePresetId)?.color ?? ACCENT;

  const RING_SIZE = 260;

  const sorted = [...presets].sort((a, b) => a.order - b.order);

  function handleStart() {
    const secs = pickerH * 3600 + pickerM * 60 + pickerS;
    if (secs === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    start();
  }

  function handlePauseResume() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    isRunning ? pause() : resume();
  }

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    cancel();
  }

  function handleReset() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    reset();
  }

  function handlePresetChip(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isActive) {
      Alert.alert('Start Preset', 'This will replace the running timer.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => startPreset(id) },
      ]);
    } else {
      startPreset(id);
    }
  }

  function handleRecentChip(secs: number) {
    if (!isIdle) return;
    setDuration(secs);
    setPickerH(Math.floor(secs / 3600));
    setPickerM(Math.floor((secs % 3600) / 60));
    setPickerS(secs % 60);
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Status label ─────────────────────────────────────────── */}
        {!isIdle && (
          <View style={s.statusRow}>
            {isRunning && <View style={[s.liveDot, { backgroundColor: accentColor }]} />}
            <Text style={[
              s.statusLabel,
              isCompleted && { color: '#10b981' },
              isPaused && { color: '#f59e0b' },
              isRunning && { color: C.muted },
            ]}>
              {isRunning   ? (presets.find((pr) => pr.id === timer.activePresetId)?.name ?? 'Running')
               : isPaused  ? 'Paused'
               : "Time's Up! 🎉"}
            </Text>
          </View>
        )}

        {/* ── Timer display ─────────────────────────────────────────── */}
        <View style={s.timerZone}>
          {isIdle ? (
            /* Wheel pickers */
            <View style={s.pickerRow}>
              <WheelPicker values={HOURS}   selected={pickerH} onSelect={setPickerH} label="HRS" colors={C} />
              <Text style={[s.pickerSep, { color: C.muted }]}>:</Text>
              <WheelPicker values={MINUTES} selected={pickerM} onSelect={setPickerM} label="MIN" colors={C} />
              <Text style={[s.pickerSep, { color: C.muted }]}>:</Text>
              <WheelPicker values={SECONDS} selected={pickerS} onSelect={setPickerS} label="SEC" colors={C} />
            </View>
          ) : (
            /* Circular countdown */
            <View style={[s.ringContainer, { width: RING_SIZE, height: RING_SIZE }]}>
              <CircularProgress
                progress={progress}
                color={isCompleted ? '#10b981' : accentColor}
                size={RING_SIZE}
                stroke={10}
              />
              <View style={[StyleSheet.absoluteFill, s.ringCenter]}>
                <Text
                  style={[
                    s.countdown,
                    { color: isCompleted ? '#10b981' : C.text },
                    isPaused && { opacity: 0.6 },
                  ]}
                >
                  {isCompleted ? '00:00' : formatCountdown(remainingMs)}
                </Text>
                {isCompleted && <Text style={s.checkmark}>✓</Text>}
              </View>
            </View>
          )}
        </View>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <View style={s.controls}>
          {isIdle && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: accentColor, opacity: (pickerH + pickerM + pickerS) === 0 ? 0.35 : 1 }]}
              onPress={handleStart}
              disabled={(pickerH + pickerM + pickerS) === 0}
              activeOpacity={0.82}
            >
              <Text style={s.primaryBtnText}>Start</Text>
            </TouchableOpacity>
          )}

          {isActive && (
            <View style={s.activeControls}>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: isPaused ? accentColor : C.card, flex: 1 }]}
                onPress={handlePauseResume}
                activeOpacity={0.82}
              >
                <Text style={[s.primaryBtnText, { color: isPaused ? '#fff' : C.text }]}>
                  {isRunning ? '⏸  Pause' : '▶  Resume'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.cancelBtn, { backgroundColor: C.card }]}
                onPress={handleCancel}
                activeOpacity={0.82}
              >
                <Text style={[s.cancelBtnText, { color: '#ef4444' }]}>✕  Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {isCompleted && (
            <View style={s.activeControls}>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: '#10b981', flex: 1 }]}
                onPress={handleReset}
                activeOpacity={0.82}
              >
                <Text style={s.primaryBtnText}>↺  Reset</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Settings toggles (idle only) ──────────────────────────── */}
        {isIdle && (
          <View style={s.settingsRow}>
            <TouchableOpacity
              onPress={() => updateSettings({ autoRepeat: !settings.autoRepeat })}
              style={[s.settingChip, { backgroundColor: settings.autoRepeat ? accentColor + '20' : C.card }]}
            >
              <Text style={[s.settingChipText, { color: settings.autoRepeat ? accentColor : C.muted }]}>
                ↻ Auto-repeat
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              style={[s.settingChip, { backgroundColor: settings.soundEnabled ? accentColor + '20' : C.card }]}
            >
              <Text style={[s.settingChipText, { color: settings.soundEnabled ? accentColor : C.muted }]}>
                {settings.soundEnabled ? '🔔 Sound' : '🔕 Sound'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Preset strip ─────────────────────────────────────────── */}
        <View style={[s.sectionDivider, { borderTopColor: C.divider }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetStrip}>
            {sorted.map((preset) => (
              <PresetChip
                key={preset.id}
                preset={preset}
                active={timer.activePresetId === preset.id && isActive}
                colors={C}
                onPress={() => handlePresetChip(preset.id)}
              />
            ))}
            <TouchableOpacity onPress={() => setPresetsOpen(true)} style={s.manageBtn}>
              <Text style={[s.manageBtnText, { color: C.muted }]}>⋯ Manage</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── Recent timers ────────────────────────────────────────── */}
        {recentDurations.length > 0 && isIdle && (
          <View style={[s.sectionDivider, { borderTopColor: C.divider }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetStrip}>
              <Text style={[s.recentLabel, { color: C.muted }]}>Recent</Text>
              {recentDurations.slice(0, 8).map((secs) => (
                <TouchableOpacity
                  key={secs}
                  onPress={() => handleRecentChip(secs)}
                  style={[s.recentChip, { backgroundColor: C.card }]}
                >
                  <Text style={[s.recentChipText, { color: C.text }]}>{formatDurationShort(secs)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <ManagePresetsModal visible={presetsOpen} onClose={() => setPresetsOpen(false)} colors={C} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const LIGHT = {
  bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af',
  divider: '#f0f0f0', accent: '#6366f1',
};
const DARK = {
  bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280',
  divider: '#2a2a2e', accent: '#818cf8',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32 },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 16, paddingHorizontal: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },

  timerZone: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, minHeight: 280 },

  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  pickerSep: { fontSize: 36, fontWeight: '200', marginBottom: 24, paddingHorizontal: 4 },

  ringContainer: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  countdown: { fontSize: 64, fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  checkmark: { fontSize: 28, color: '#10b981', marginTop: 4 },

  controls: { paddingHorizontal: 20, marginBottom: 16 },
  primaryBtn: { borderRadius: 18, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  activeControls: { flexDirection: 'row', gap: 10 },
  cancelBtn: { borderRadius: 18, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontWeight: '600', fontSize: 15 },

  settingsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8, paddingHorizontal: 20 },
  settingChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  settingChipText: { fontSize: 13, fontWeight: '500' },

  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  presetStrip: { paddingHorizontal: 20, gap: 4, flexDirection: 'row', alignItems: 'center' },
  manageBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  manageBtnText: { fontSize: 13, fontWeight: '500' },
  recentLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginRight: 4, alignSelf: 'center' },
  recentChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  recentChipText: { fontSize: 13, fontWeight: '500' },
});
