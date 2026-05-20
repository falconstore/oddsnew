import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/procedimentos': 'Procedimentos',
  '/ao-vivo': 'Ao Vivo',
  '/duplo-green': 'Duplo Green',
  '/perfil': 'Perfil',
  '/assinatura': 'Assinatura',
  '/paywall': 'Paywall',
  '/login': 'Login',
}

function getPageName(pathname: string): string {
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname]
  if (pathname.startsWith('/procedimentos/')) return 'Procedimento Detalhe'
  return pathname
}

// session_id: único por aba/sessão de browser
const SESSION_ID = (() => {
  const key = 'pwa_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id) }
  return id
})()

async function track(event_type: string, page: string, user_id: string, lead_id: string | null) {
  try {
    await supabase.from('pwa_events').insert({
      user_id,
      lead_id: lead_id ?? undefined,
      event_type,
      page,
      session_id: SESSION_ID,
    })
  } catch {
    // silencioso — nunca bloqueia o app
  }
}

export function useAppTracking() {
  const location = useLocation()
  const { user, lead } = useAuth()
  const sessionStarted = useRef(false)

  // session_start — uma vez por tab/sessão
  useEffect(() => {
    if (!user?.id || sessionStarted.current) return
    sessionStarted.current = true
    track('session_start', getPageName(location.pathname), user.id, lead?.id ?? null)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // page_view — em cada mudança de rota
  useEffect(() => {
    if (!user?.id) return
    track('page_view', getPageName(location.pathname), user.id, lead?.id ?? null)
  }, [location.pathname, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}
