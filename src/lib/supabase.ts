import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These will be configured via environment or localStorage
const getSupabaseConfig = () => {
  const storedUrl = localStorage.getItem('supabase_url');
  const storedKey = localStorage.getItem('supabase_anon_key');
  
  return {
    url: storedUrl || import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: storedKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  };
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.url, config.anonKey);
  }
  return supabaseInstance;
};

// For backward compatibility - but will throw if not configured
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const instance = getSupabase();
    if (!instance) {
      throw new Error('Supabase not configured. Please configure your Supabase connection first.');
    }
    return (instance as any)[prop];
  }
});

export const isSupabaseConfigured = () => {
  const config = getSupabaseConfig();
  return config.url !== '' && config.anonKey !== '';
};

export const updateSupabaseConfig = (url: string, anonKey: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', anonKey);
  // Reload to apply new config
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  window.location.reload();
};
