import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const VAPID_PUBLIC_KEY = 'BLvI6e425udvYI0tMmBBBY_IOeS6H-55uXVDxos5vKgxtCkcrr9owkq0XlxkML-SP-HK5i1rbGQHQjwUmcQi5ZE'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

export function usePushNotifications() {
  const { user } = useAuth()
  const [state, setState] = useState<PushState>('loading')

  const isSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window

  useEffect(() => {
    if (!isSupported) { setState('unsupported'); return }
    if (Notification.permission === 'denied') { setState('denied'); return }

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription()
    ).then(sub => {
      setState(sub ? 'subscribed' : 'unsubscribed')
    }).catch(() => setState('unsubscribed'))
  }, [isSupported])

  async function subscribe() {
    if (!isSupported || !user) return
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('denied'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: json.endpoint!,
        p256dh: (json.keys as any).p256dh,
        auth: (json.keys as any).auth,
      }, { onConflict: 'endpoint' })

      setState('subscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    if (!isSupported) return
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
      setState('unsubscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  function toggle() {
    if (state === 'subscribed') unsubscribe()
    else subscribe()
  }

  return { state, isSupported, subscribe, unsubscribe, toggle }
}
