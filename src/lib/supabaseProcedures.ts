import { createClient, SupabaseClient } from '@supabase/supabase-js';

const proceduresUrl = import.meta.env.VITE_PROCEDURES_SUPABASE_URL;
const proceduresKey = import.meta.env.VITE_PROCEDURES_SUPABASE_ANON_KEY;

// Verifica se as variáveis estão configuradas
export const isProceduresSupabaseConfigured = () => {
  return Boolean(proceduresUrl && proceduresKey);
};

// Cria o cliente apenas se as credenciais existirem
let proceduresClient: SupabaseClient | null = null;

if (proceduresUrl && proceduresKey) {
  proceduresClient = createClient(proceduresUrl, proceduresKey);
} else {
  console.warn('Procedures Supabase environment variables are not configured. Please set VITE_PROCEDURES_SUPABASE_URL and VITE_PROCEDURES_SUPABASE_ANON_KEY');
}

// Export com fallback seguro
export const supabaseProcedures = proceduresClient as SupabaseClient;

// Helper para compatibilidade
export const getProceduresSupabase = () => supabaseProcedures;
