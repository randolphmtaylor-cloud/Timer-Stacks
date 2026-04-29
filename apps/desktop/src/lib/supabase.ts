import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Env = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const env = ((import.meta as ImportMeta & { env?: Env }).env ?? {}) as Env;

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL ?? '',
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured =
  supabaseConfig.url.length > 0 && supabaseConfig.anonKey.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
