import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const env = process?.env ?? {};

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL ?? '',
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured =
  supabaseConfig.url.length > 0 && supabaseConfig.anonKey.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
