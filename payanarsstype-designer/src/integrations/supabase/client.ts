// Supabase client — lazy-initialized to avoid crash when env vars are missing.
// Import: import { supabase } from "@/integrations/supabase/client";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let _client: SupabaseClient<Database> | null = null;

function getClient(): SupabaseClient<Database> {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error(
        'Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env'
      );
    }
    _client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}

/**
 * Lazy proxy — modules can import `supabase` without crashing at load time.
 * The actual Supabase client is only created on first property access.
 * If env vars are missing, a console warning is shown and calls return
 * a safe error response instead of throwing.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    try {
      const client = getClient();
      const value = (client as Record<string | symbol, unknown>)[prop];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    } catch {
      // Env vars not set — return a stub so callers don't crash
      if (!_warnedOnce) {
        console.warn('⚠ Supabase env vars not set. Supabase features (AI, Embeddings) are disabled.');
        _warnedOnce = true;
      }
      // For method-like access (e.g. supabase.functions), return a nested proxy
      return new Proxy(() => {}, {
        get() {
          return (..._args: unknown[]) =>
            Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
        },
        apply() {
          return Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
        },
      });
    }
  },
});

let _warnedOnce = false;