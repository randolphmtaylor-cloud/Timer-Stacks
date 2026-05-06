import React from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { useSettingsStore } from '../src/stores/settingsStore.js';
import { useStackStore } from '../src/stores/stackStore.js';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const syncApiBaseUrl = env.EXPO_PUBLIC_SYNC_API_URL ?? '';

export default function SettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { theme, notificationsEnabled, soundEnabled, setTheme, setNotifications, setSound } = useSettingsStore();
  const { syncCloud } = useStackStore();
  const [syncStatus, setSyncStatus] = React.useState<'checking' | 'connected' | 'unavailable'>('checking');
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  React.useEffect(() => {
    refreshSyncStatus().catch(() => {});
  }, []);

  async function refreshSyncStatus() {
    setSyncStatus('checking');
    try {
      const response = await fetch(`${syncApiBaseUrl}/api/sync/status`);
      if (!response.ok) throw new Error(`Sync API failed with status ${response.status}`);
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error ?? 'Sync API is unavailable');
      setSyncStatus('connected');
      setSyncError(null);
    } catch (error) {
      setSyncStatus('unavailable');
      setSyncError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      await syncCloud();
      await refreshSyncStatus();
    } catch (error) {
      setSyncStatus('unavailable');
      setSyncError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Cloud sync */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>CLOUD SYNC</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.authBlock}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {syncStatus === 'connected'
              ? 'Cloud sync connected'
              : syncStatus === 'checking'
                ? 'Checking cloud sync'
                : 'Cloud sync unavailable'}
          </Text>
          <Text style={[styles.rowSub, { color: colors.muted }]}>
            Timer Stacks syncs through the Turso API using server-side credentials.
          </Text>
          {syncError && <Text style={styles.errorInline}>{syncError}</Text>}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#6366f1' }]}
              onPress={handleSyncNow}
              disabled={isSyncing}
            >
              <Text style={styles.buttonText}>Sync Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.soft }]}
              onPress={refreshSyncStatus}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Check Status</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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

const LIGHT = { bg: '#fafafa', card: '#ffffff', text: '#111113', muted: '#9ca3af', divider: '#f3f4f6', soft: '#f3f4f6' };
const DARK  = { bg: '#111113', card: '#1c1c1e', text: '#f9fafb', muted: '#6b7280', divider: '#374151', soft: '#374151' };

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
  authBlock: { padding: 18, gap: 12 },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  errorInline: { color: '#ef4444', fontSize: 13 },
});
