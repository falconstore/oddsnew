import { createClient } from '@supabase/supabase-js'

// PWA usa wspsuempnswljkphatur — variáveis com prefixo MAIN_ para não conflitar
// com as VITE_SUPABASE_* do painel admin (hyccrhpvedvfnzhetxkz) no userenv.shared
const SUPABASE_URL =
  import.meta.env.VITE_MAIN_SUPABASE_URL as string ||
  'https://wspsuempnswljkphatur.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_MAIN_SUPABASE_ANON_KEY as string ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHN1ZW1wbnN3bGprcGhhdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTc1NTEsImV4cCI6MjA3NTkzMzU1MX0.zgEcoHFulNHrSxyHOZTbCCtDKfqjppHLRh1junsmsoA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Sessão de longa duração — refresh token roda automaticamente
    // enquanto o usuário usar o app pelo menos 1x por semana
    storageKey: 'sg-pwa-session',
  },
})

export type TrialLead = {
  id: string
  name: string | null
  email: string | null
  whatsapp: string | null
  telegram_username: string | null
  telegram_user_id: number | null
  status: string | null
  cohort: string | null
  expires_at: string | null
  paid_at: string | null
  subscription_status: string | null
  created_at: string
}

export type Procedure = {
  id: string
  procedure_number: number
  date: string
  status: string | null
  tipo: string | null
  platform: string | null
  promotion_name: string | null
  profit_loss: number | null
  resultado_lucro: number | null
  lucro_prejuizo_previsto: number | null
  kickoff_at: string | null
  esporte: string | null
  duplo_green_confirmado: boolean | null
  duplo_green_lucro: number | null
  freebet_value: number | null
  freebet_valor_previsto: number | null
  freebet_creditada: string | null
  tachado: boolean | null
  archived: boolean | null
  reenviado_em: string | null
  reenviado_count: number | null
  telegram_images: string[] | null
}
