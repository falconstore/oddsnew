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
      type: 'new_procedure' | 'daily_summary' | 'subscription_pending'
      user_id?: string
      title?: string
      body_text?: string
      tag?: string
      url?: string
      procedure_number?: number
      profit_loss?: number | null
      tipo?: string
      platform?: string
      freebet_value?: number | null
      duplo_green_confirmado?: boolean
      // daily_summary — optional: computed from DB if omitted
      total_profit?: number
      count?: number
      freebets_count?: number
    }

    let title = body.title ?? 'Shark Green 🦈'
    let bodyText = body.body_text ?? ''
    let tag = body.tag ?? 'sg'
    let url = body.url ?? '/'

    // ─── Build notification text ──────────────────────────────────────────
    if (body.type === 'new_procedure') {
      const isDG = body.duplo_green_confirmado
      const isFB = body.tipo === 'GANHAR_FB' || body.tipo === 'QUEIMAR_FB'
      const profit = body.profit_loss ? Math.abs(body.profit_loss) : null

      if (isDG) {
        title = '⚡ Duplo Green confirmado!'
        bodyText = body.platform ? `${body.platform} — 2× Green garantido` : 'Confira o resultado da operação'
        url = '/duplo-green'
        tag = 'dg'
      } else if (isFB && body.freebet_value) {
        title = `🎯 Freebet de R$${body.freebet_value.toFixed(0)} disponível`
        bodyText = body.platform ? `Queime a freebet em ${body.platform}` : 'Acesse o procedimento'
        url = '/procedimentos'
        tag = 'fb'
      } else if (profit) {
        title = `💰 Lucro: +R$${profit.toFixed(0)}`
        bodyText = body.platform ? `via ${body.platform}` : 'Novo resultado confirmado'
        url = '/procedimentos'
        tag = `proc-${body.procedure_number}`
      } else {
        title = `📋 Procedimento #${body.procedure_number ?? ''}`
        bodyText = body.platform ? `${body.platform} — ${body.tipo ?? ''}` : 'Novo procedimento disponível'
        url = '/procedimentos'
        tag = 'proc'
      }

    } else if (body.type === 'daily_summary') {
      // Compute today's stats from DB if not provided
      let totalProfit = body.total_profit
      let count = body.count
      let freebetsCount = body.freebets_count

      if (totalProfit === undefined || count === undefined) {
        // today in UTC-3 (BRT)
        const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const { data: procs } = await supabase
          .from('procedures')
          .select('profit_loss, resultado_lucro, duplo_green_lucro, freebet_creditada, duplo_green_confirmado')
          .eq('date', todayBRT)
          .eq('archived', false)
          .eq('tachado', false)

        if (procs) {
          count = procs.length
          totalProfit = procs.reduce((sum, p) => {
            const lucro = p.duplo_green_lucro != null ? Number(p.duplo_green_lucro)
              : p.resultado_lucro != null ? Number(p.resultado_lucro)
              : Number(p.profit_loss ?? 0)
            return sum + lucro
          }, 0)
          freebetsCount = procs.filter(p => p.freebet_creditada === 'SIM').length
        }
      }

      totalProfit = totalProfit ?? 0
      count = count ?? 0
      freebetsCount = freebetsCount ?? 0

      if (count === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: 'no procedures today' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sign = totalProfit >= 0 ? '+' : ''
      title = `📊 Fechamento: ${sign}R$${Math.abs(totalProfit).toFixed(0)} hoje`
      bodyText = `${count} procedimento${count !== 1 ? 's' : ''} · ${freebetsCount} freebet${freebetsCount !== 1 ? 's' : ''} ganha${freebetsCount !== 1 ? 's' : ''}`
      url = '/'
      tag = 'daily-summary'

    } else if (body.type === 'subscription_pending') {
      title = '⚠️ Assinatura pendente'
      bodyText = 'Seu acesso expira em breve. Regularize agora.'
      url = '/assinatura'
      tag = 'subscription'
    }

    // ─── Fetch subscriptions ─────────────────────────────────────────────
    let query = supabase.from('push_subscriptions').select('*')
    if (body.user_id) query = query.eq('user_id', body.user_id)
    const { data: subs, error } = await query

    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Send to all subscriptions ───────────────────────────────────────
    const payload = JSON.stringify({ title, body: bodyText, tag, data: { url } })
    let sent = 0
    const expired: string[] = []

    await Promise.allSettled(
      subs.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 86400 }
          )
          sent++
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) expired.push(sub.endpoint)
        }
      })
    )

    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
