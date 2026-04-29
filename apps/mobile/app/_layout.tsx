import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useStackStore } from '../src/stores/stackStore.js';
import { useSessionStore } from '../src/stores/sessionStore.js';
import { useAuthStore } from '../src/stores/authStore.js';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { load: loadStacks, stacks } = useStackStore();
  const { hydrate } = useSessionStore();
  const { initialize: initializeAuth, user } = useAuthStore();
  const { syncCloud } = useStackStore();

  useEffect(() => {
    initializeAuth();
    loadStacks();
  }, [initializeAuth, loadStacks]);

  useEffect(() => {
    if (user) syncCloud();
  }, [user, syncCloud]);

  useEffect(() => {
    if (stacks.length > 0) hydrate(stacks);
  }, [stacks, hydrate]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            borderTopColor: colorScheme === 'dark' ? '#374151' : '#f3f4f6',
            backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#ffffff',
          },
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#ffffff',
          },
          headerTintColor: colorScheme === 'dark' ? '#f9fafb' : '#111113',
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="⊞" color={color} /> }}
        />
        <Tabs.Screen
          name="builder"
          options={{ title: 'New Stack', tabBarLabel: 'Build', tabBarIcon: ({ color }) => <TabIcon emoji="+" color={color} /> }}
        />
        <Tabs.Screen
          name="templates"
          options={{ title: 'Templates', tabBarLabel: 'Templates', tabBarIcon: ({ color }) => <TabIcon emoji="◫" color={color} /> }}
        />
        <Tabs.Screen
          name="history"
          options={{ title: 'History', tabBarLabel: 'History', tabBarIcon: ({ color }) => <TabIcon emoji="◷" color={color} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarLabel: 'Settings', tabBarIcon: ({ color }) => <TabIcon emoji="⚙" color={color} /> }}
        />
        {/* Hidden session route */}
        <Tabs.Screen
          name="session/[id]"
          options={{ href: null, title: 'Active Session', headerShown: false }}
        />
      </Tabs>
    </>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, color }}>{emoji}</Text>;
}
