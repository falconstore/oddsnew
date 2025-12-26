import { createClient } from '@supabase/supabase-js';

// These will be configured via environment or localStorage
const getSupabaseConfig = () => {
  const storedUrl = localStorage.getItem('supabase_url');
  const storedKey = localStorage.getItem('supabase_anon_key');
  
  return {
    url: storedUrl || import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: storedKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  };
};

const config = getSupabaseConfig();

export const supabase = createClient(config.url, config.anonKey);

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
