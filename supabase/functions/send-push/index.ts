import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    webpush.setVapidDetails('mailto:admin@sharkgreen.com.br', vapidPublic, vapidPrivate)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json() as {
      type: 'new_procedure' | 'daily_summary' | 'subscription_pending' | 'subscription_canceled' | 'subscription_expired' | 'custom'
      user_id?: string     // envia só pra esse auth user
      lead_id?: string     // envia pra push_subscriptions.lead_id
      triggered_by?: string
      // custom / manual
      title?: string
      body_text?: string
      tag?: string
      url?: string
      // new_procedure
      procedure_number?: number
      profit_loss?: number | null
      tipo?: string
      platform?: string
      freebet_value?: number | null
      duplo_green_confirmado?: boolean
      // daily_summary — computed from DB if omitted
      total_profit?: number
      count?: number
      freebets_count?: number
    }

    let title = body.title ?? 'Shark Green 🦈'
    let bodyText = body.body_text ?? ''
    let tag = body.tag ?? 'sg'
    let url = body.url ?? '/'

    // ─── Build notification payload ───────────────────────────────────────
    if (body.type === 'new_procedure') {
      const isDG = body.duplo_green_confirmado
      const isFB = body.tipo === 'GANHAR_FB' || body.tipo === 'QUEIMAR_FB'
      const profit = body.profit_loss ? Math.abs(body.profit_loss) : null
      if (isDG) {
        title = '⚡ Duplo Green confirmado!'; bodyText = body.platform ? `${body.platform} — 2× Green garantido` : 'Confira o resultado'; url = '/duplo-green'; tag = 'dg'
      } else if (isFB && body.freebet_value) {
        title = `🎯 Freebet de R$${body.freebet_value.toFixed(0)} disponível`; bodyText = body.platform ? `Queime em ${body.platform}` : 'Acesse o procedimento'; url = '/procedimentos'; tag = 'fb'
      } else if (profit) {
        title = `💰 Lucro: +R$${profit.toFixed(0)}`; bodyText = body.platform ? `via ${body.platform}` : 'Resultado confirmado'; url = '/procedimentos'; tag = `proc-${body.procedure_number}`
      } else {
        title = `📋 Procedimento #${body.procedure_number ?? ''}`; bodyText = body.platform ? `${body.platform} — ${body.tipo ?? ''}` : 'Novo procedimento'; url = '/procedimentos'; tag = 'proc'
      }
    } else if (body.type === 'daily_summary') {
      let totalProfit = body.total_profit
      let count = body.count
      let freebetsCount = body.freebets_count
      if (totalProfit === undefined || count === undefined) {
        const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const { data: procs } = await supabase.from('procedures').select('profit_loss,resultado_lucro,duplo_green_lucro,freebet_creditada').eq('date', todayBRT).eq('archived', false).eq('tachado', false)
        if (procs) {
          count = procs.length
          totalProfit = procs.reduce((s, p) => s + (p.duplo_green_lucro != null ? Number(p.duplo_green_lucro) : p.resultado_lucro != null ? Number(p.resultado_lucro) : Number(p.profit_loss ?? 0)), 0)
          freebetsCount = procs.filter(p => p.freebet_creditada === 'SIM').length
        }
      }
      totalProfit = totalProfit ?? 0; count = count ?? 0; freebetsCount = freebetsCount ?? 0
      if (count === 0) return new Response(JSON.stringify({ sent: 0, reason: 'no procedures today' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const sign = totalProfit >= 0 ? '+' : ''
      title = `📊 Fechamento: ${sign}R$${Math.abs(totalProfit).toFixed(0)} hoje`
      bodyText = `${count} procedimento${count !== 1 ? 's' : ''} · ${freebetsCount} freebet${freebetsCount !== 1 ? 's' : ''} ganha${freebetsCount !== 1 ? 's' : ''}`
      url = '/'; tag = 'daily-summary'
    } else if (body.type === 'subscription_pending') {
      title = '⚠️ Pagamento pendente'; bodyText = 'Confirme o pagamento para manter seu acesso ativo.'; url = '/assinatura'; tag = 'sub-pending'
    } else if (body.type === 'subscription_canceled') {
      title = '😢 Assinatura cancelada'; bodyText = 'Seu acesso foi encerrado. Renove para continuar.'; url = '/assinatura'; tag = 'sub-canceled'
    } else if (body.type === 'subscription_expired') {
      title = '⌛ Pedido expirado'; bodyText = 'Complete o pagamento para ativar seu acesso.'; url = '/assinatura'; tag = 'sub-expired'
    } else if (body.type === 'custom') {
      // title / body_text / url / tag already set from body
    }

    // ─── Resolve subscriptions ────────────────────────────────────────────
    let query = supabase.from('push_subscriptions').select('*')
    if (body.user_id) query = query.eq('user_id', body.user_id)
    else if (body.lead_id) query = query.eq('lead_id', body.lead_id)
    const { data: subs, error } = await query

    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ─── Send ─────────────────────────────────────────────────────────────
    const payload = JSON.stringify({ title, body: bodyText, tag, data: { url } })
    let sent = 0
    const expired: string[] = []

    await Promise.allSettled(subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 86400 })
        sent++
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) expired.push(sub.endpoint)
      }
    }))

    if (expired.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', expired)

    // ─── Log ──────────────────────────────────────────────────────────────
    await supabase.from('push_notification_logs').insert({
      type: body.type,
      title,
      body: bodyText,
      url,
      target: body.user_id ? `user:${body.user_id}` : body.lead_id ? `lead:${body.lead_id}` : 'all',
      sent_count: sent,
      triggered_by: body.triggered_by ?? 'api',
    }).catch(() => {})

    return new Response(JSON.stringify({ sent, expired: expired.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
