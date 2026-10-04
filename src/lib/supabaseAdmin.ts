import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnvConfig, getServerConfig } from '../config/env';

let adminClient: SupabaseClient | undefined;

/** Server-only Supabase service-role client. Never expose this key to Vite. */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('The Supabase service-role client is server-only.');
  }

  if (adminClient) return adminClient;

  const { supabaseUrl } = getEnvConfig();
  const { supabaseServiceRoleKey } = getServerConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase server configuration is incomplete.');
  }

  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

