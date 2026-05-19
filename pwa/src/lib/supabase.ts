import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type TrialLead = {
  id: string
  name: string | null
  email: string | null
  whatsapp: string | null
  telegram_username: string | null
  telegram_chat_id: string | null
  status: string | null
  cohort: string | null
  trial_expires_at: string | null
  subscribed_at: string | null
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
  kickoff_at: string | null
  esporte: string | null
  duplo_green_confirmado: boolean | null
  duplo_green_lucro: number | null
  freebet_value: number | null
  freebet_creditada: string | null
  tachado: boolean | null
  archived: boolean | null
  reenviado_em: string | null
  reenviado_count: number | null
}
