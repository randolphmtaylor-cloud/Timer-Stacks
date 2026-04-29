import React from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSettingsStore } from '../src/stores/settingsStore.js';
import { useAuthStore } from '../src/stores/authStore.js';
import { useStackStore } from '../src/stores/stackStore.js';

export default function SettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? DARK : LIGHT;
  const { theme, notificationsEnabled, soundEnabled, setTheme, setNotifications, setSound } = useSettingsStore();
  const { user, isConfigured, isLoading, error, signIn, signUp, signOut } = useAuthStore();
  const { syncCloud } = useStackStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  async function handleAuth(action: 'sign-in' | 'sign-up') {
    if (!email.trim() || !password) return;
    if (action === 'sign-in') {
      await signIn(email.trim(), password);
    } else {
      await signUp(email.trim(), password);
    }
    await syncCloud();
    setPassword('');
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Cloud sync */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>CLOUD SYNC</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {!isConfigured ? (
          <View style={styles.authBlock}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Supabase is not configured</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login and sync.
            </Text>
          </View>
        ) : user ? (
          <View style={styles.authBlock}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Signed in</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>{user.email}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#6366f1' }]}
                onPress={() => syncCloud()}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Sync Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.soft }]}
                onPress={() => signOut()}
                disabled={isLoading}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.authBlock}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { color: colors.text, borderColor: colors.divider }]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={[styles.input, { color: colors.text, borderColor: colors.divider }]}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#6366f1' }]}
                onPress={() => handleAuth('sign-in')}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.soft }]}
                onPress={() => handleAuth('sign-up')}
                disabled={isLoading}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
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
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 13, paddingHorizontal: 18, paddingBottom: 18 },
});
