import { useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, TrialLead } from '@/lib/supabase'

export type MemberStatus = 'loading' | 'unauthenticated' | 'active_trial' | 'active_subscriber' | 'expired' | 'not_found'

export type AuthState = {
  session: Session | null
  user: User | null
  lead: TrialLead | null
  status: MemberStatus
  isLoading: boolean
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [lead, setLead] = useState<TrialLead | null>(null)
  const [status, setStatus] = useState<MemberStatus>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.email) {
      setLead(null)
      setStatus(user === null ? 'unauthenticated' : 'loading')
      return
    }

    let cancelled = false
    supabase
      .from('trial_leads')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setLead(null)
          setStatus('not_found')
          return
        }
        setLead(data as TrialLead)

        const now = new Date()
        const trialExpires = data.expires_at ? new Date(data.expires_at) : null
        const isSubscriber = Boolean(data.paid_at) || data.subscription_status === 'active'

        if (isSubscriber) {
          setStatus('active_subscriber')
        } else if (trialExpires && trialExpires > now) {
          setStatus('active_trial')
        } else {
          setStatus('expired')
        }
      })

    return () => { cancelled = true }
  }, [user?.email])

  return { session, user, lead, status, isLoading: status === 'loading' }
}

export async function signOut() {
  await supabase.auth.signOut()
}
