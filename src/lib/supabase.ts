import { createClient } from '@supabase/supabase-js';

// Supabase externo - projeto principal com auth e dados
const supabaseUrl = 'https://wspsuempnswljkphatur.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHN1ZW1wbnN3bGprcGhhdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTc1NTEsImV4cCI6MjA3NTkzMzU1MX0.zgEcoHFulNHrSxyHOZTbCCtDKfqjppHLRh1junsmsoA';

export const isSupabaseConfigured = () => true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabase = () => supabase;
