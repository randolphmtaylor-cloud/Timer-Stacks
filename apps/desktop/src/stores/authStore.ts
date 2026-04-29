import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

interface AuthState {
  user: User | null;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isConfigured: isSupabaseConfigured,
  isLoading: false,
  error: null,

  initialize: async () => {
    if (!supabase) return;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      set({ user: data.session?.user ?? null });
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null, error: null });
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load auth session' });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ user: data.user });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to sign in' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password) => {
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      set({
        user: data.session?.user ?? null,
        error: data.session ? null : 'Check your email to confirm the account before signing in.',
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to create account' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to sign out' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
