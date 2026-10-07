import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnvConfig, getServerConfig } from '../config/env';

/**
 * Server-only Supabase client. Never import this module from browser code.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const { supabaseUrl } = getEnvConfig();
  const { supabaseServiceRoleKey } = getServerConfig();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service-role credentials are not configured.');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
