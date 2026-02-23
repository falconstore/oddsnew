import { createClient } from '@supabase/supabase-js';

// Supabase externo - projeto principal com auth e dados
const supabaseUrl = 'https://cjlsctsvzedrjzpcuire.supabase.co';
const supabaseAnonKey = 'sb_publishable_zZhAHFCjDF5zj3xFWIBJDw_GWigFnZh';

export const isSupabaseConfigured = () => true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabase = () => supabase;
