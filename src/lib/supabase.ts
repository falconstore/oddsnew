import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_MAIN_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => !!supabaseUrl && !!supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabase = () => supabase;
