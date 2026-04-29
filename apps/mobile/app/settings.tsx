import React from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { useSettingsStore } from '../src/stores/settingsStore.js';

export default function SettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { theme, notificationsEnabled, soundEnabled, setTheme, setNotifications, setSound } = useSettingsStore();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Appearance */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {(['light', 'dark', 'system'] as const).map((t, i) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTheme(t)}
            style={[styles.row, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
            {theme === t && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>NOTIFICATIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Notifications</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>Alerts when segments complete</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotifications}
            trackColor={{ true: '#6366f1' }}
          />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Sound Cues</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>Play audio on transitions</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSound}
            trackColor={{ true: '#6366f1' }}
          />
        </View>
      </View>

      <Text style={[styles.version, { color: colors.muted }]}>Timer Stacks v0.1</Text>
    </ScrollView>
  );
}

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af', divider: '#f3f4f6' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280', divider: '#374151' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  card: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  rowLabel: { fontSize: 16 },
  rowSub: { fontSize: 13, marginTop: 2 },
  check: { color: '#6366f1', fontSize: 18 },
  version: { textAlign: 'center', fontSize: 13, marginTop: 40 },
});
