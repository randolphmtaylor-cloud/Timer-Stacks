// ---------------------------------------------------------------------------
// PasteImportSheet — native iOS paste-import flow.
// Reuses parsePastedTimerTasks from @timer-stacks/core; no parsing logic here.
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { parsePastedTimerTasks, type ParsedTask } from '@timer-stacks/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4'];

function formatDuration(minutes: number): string {
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatTotalTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const h = Math.floor(m / 60);
  const remainM = m % 60;
  if (h > 0) return `${h}h ${remainM}m (${m} min)`;
  return `${m} min`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PasteImportSheetProps {
  visible: boolean;
  onClose: () => void;
  onImport: (tasks: ParsedTask[]) => void;
}

type Step = 'paste' | 'preview';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PasteImportSheet({ visible, onClose, onImport }: PasteImportSheetProps) {
  const dark = useColorScheme() === 'dark';
  const C = dark ? DARK : LIGHT;

  const [step, setStep] = useState<Step>('paste');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parsePastedTimerTasks> | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    // Reset after animation
    setTimeout(() => { setStep('paste'); setRawText(''); setParsed(null); }, 300);
  }, [onClose]);

  function handlePreview() {
    setParsed(parsePastedTimerTasks(rawText));
    setStep('preview');
  }

  function handleImport() {
    if (parsed && parsed.tasks.length > 0) onImport(parsed.tasks);
    handleClose();
  }

  const totalSeconds = parsed?.tasks.reduce((acc, t) => acc + t.durationSeconds, 0) ?? 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: C.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: C.divider }]}>
          <TouchableOpacity onPress={step === 'preview' ? () => setStep('paste') : handleClose} style={s.headerBtn}>
            <Text style={[s.headerBtnText, { color: C.accent }]}>
              {step === 'preview' ? '← Back' : 'Cancel'}
            </Text>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.text }]}>Paste Tasks</Text>
          <View style={s.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {step === 'paste' ? (
            <>
              <Text style={[s.hint, { color: C.muted }]}>
                Paste tasks one per line, each ending with the duration in minutes:{'\n'}
                <Text style={[s.code, { backgroundColor: C.codeBg, color: C.text }]}>Write report (25)</Text>
                {' or '}
                <Text style={[s.code, { backgroundColor: C.codeBg, color: C.text }]}>Quick review (7.5)</Text>
              </Text>
              <TextInput
                value={rawText}
                onChangeText={setRawText}
                placeholder={
                  "Finalize report (30)\nResearch task (45)\nQuick email review (7.5)"
                }
                placeholderTextColor={C.muted}
                multiline
                autoFocus
                style={[s.textarea, { backgroundColor: C.card, color: C.text, borderColor: C.divider }]}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[s.primaryBtn, { opacity: rawText.trim().length === 0 ? 0.4 : 1 }]}
                onPress={handlePreview}
                disabled={rawText.trim().length === 0}
                activeOpacity={0.82}
              >
                <Text style={s.primaryBtnText}>Preview →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Valid tasks */}
              {parsed && parsed.tasks.length > 0 ? (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={[s.sectionLabel, { color: C.muted }]}>
                      {parsed.tasks.length} TASK{parsed.tasks.length !== 1 ? 'S' : ''} TO IMPORT
                    </Text>
                    <Text style={[s.totalTime, { color: C.accent }]}>
                      {formatTotalTime(totalSeconds)}
                    </Text>
                  </View>
                  {parsed.tasks.map((task, i) => (
                    <View key={i} style={[s.taskRow, { backgroundColor: C.card, borderColor: C.divider }]}>
                      <View style={[s.dot, { backgroundColor: COLORS[i % COLORS.length] }]} />
                      <Text style={[s.taskLabel, { color: C.text }]} numberOfLines={1}>{task.title}</Text>
                      <Text style={[s.taskDur, { color: C.muted }]}>{formatDuration(task.durationMinutes)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[s.noTasks, { color: C.muted }]}>No valid tasks found.</Text>
              )}

              {/* Skipped lines */}
              {parsed && parsed.skippedLines.length > 0 && (
                <View style={s.section}>
                  <Text style={[s.sectionLabel, { color: '#f59e0b' }]}>
                    {parsed.skippedLines.length} LINE{parsed.skippedLines.length !== 1 ? 'S' : ''} SKIPPED
                  </Text>
                  {parsed.skippedLines.map((sl, i) => (
                    <View key={i} style={[s.skippedRow, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                      <Text style={[s.skippedLine, { color: C.text }]} numberOfLines={1}>{sl.line}</Text>
                      <Text style={s.skippedReason}>{sl.reason}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  { opacity: !parsed || parsed.tasks.length === 0 ? 0.4 : 1 },
                ]}
                onPress={handleImport}
                disabled={!parsed || parsed.tasks.length === 0}
                activeOpacity={0.82}
              >
                <Text style={s.primaryBtnText}>
                  Import{parsed && parsed.tasks.length > 0 ? ` ${parsed.tasks.length} Task${parsed.tasks.length !== 1 ? 's' : ''}` : ''}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const LIGHT = {
  bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af',
  divider: '#e5e7eb', accent: '#6366f1', codeBg: '#f3f4f6',
};
const DARK = {
  bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280',
  divider: '#374151', accent: '#818cf8', codeBg: '#27272a',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 12, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 60 },
  headerBtnText: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  body: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, borderRadius: 4, paddingHorizontal: 4 },
  textarea: {
    minHeight: 180, borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#6366f1', borderRadius: 18,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  totalTime: { fontSize: 13, fontWeight: '600' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  taskLabel: { flex: 1, fontSize: 14 },
  taskDur: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  noTasks: { textAlign: 'center', marginTop: 40 },
  skippedRow: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 6,
  },
  skippedLine: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  skippedReason: { fontSize: 12, color: '#d97706', marginTop: 2 },
});
