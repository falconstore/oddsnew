import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CHECKOUT_URL = 'https://lastlink.com/p/CEAEE6585/checkout-payment'

// ─── Cenários de notificação ──────────────────────────────────────────────────

type Scenario = {
  type: string
  title: string
  body: string
  dedupHours: number
  getCandidates(sb: ReturnType<typeof createClient>): Promise<{ id: string }[]>
}

const SCENARIOS: Scenario[] = [
  // ── Trial expirando em 48h ──────────────────────────────────────────────
  {
    type: 'trial_expiring_48h',
    title: '⏰ Faltam menos de 48h do seu trial!',
    body: 'Não perca o acesso — garanta sua assinatura agora.',
    dedupHours: 48,
    async getCandidates(sb) {
      const now = new Date()
      const in48h = new Date(now.getTime() + 48 * 3600_000)
      const in24h = new Date(now.getTime() + 24 * 3600_000)
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('status', 'active')
        .lte('expires_at', in48h.toISOString())
        .gt('expires_at', in24h.toISOString())
      return data ?? []
    },
  },

  // ── Trial expirando em 24h ──────────────────────────────────────────────
  {
    type: 'trial_expiring_24h',
    title: '🚨 Último dia de trial!',
    body: 'Hoje é o último dia — assina agora pra continuar recebendo os procedimentos.',
    dedupHours: 24,
    async getCandidates(sb) {
      const now = new Date()
      const in24h = new Date(now.getTime() + 24 * 3600_000)
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('status', 'active')
        .lte('expires_at', in24h.toISOString())
        .gt('expires_at', now.toISOString())
      return data ?? []
    },
  },

  // ── Trial expirou (até 4h atrás → notifica imediatamente) ──────────────
  {
    type: 'trial_expired',
    title: '😢 Seu trial expirou',
    body: 'Sente falta dos procedimentos? Volta com 7 dias de garantia total.',
    dedupHours: 72,
    async getCandidates(sb) {
      const now = new Date()
      const since4h = new Date(now.getTime() - 4 * 3600_000)
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('status', 'expired')
        .gte('expires_at', since4h.toISOString())
        .lt('expires_at', now.toISOString())
      return data ?? []
    },
  },

  // ── Remarketing 3 dias após expirar ────────────────────────────────────
  {
    type: 'trial_remarketing_3d',
    title: '🔥 O VIP tá bombando sem você!',
    body: 'O pessoal fez mais de R$ 700 ontem. Volta com 7 dias de garantia 🦈',
    dedupHours: 168,
    async getCandidates(sb) {
      const from = new Date(Date.now() - 4 * 24 * 3600_000)
      const to   = new Date(Date.now() - 2 * 24 * 3600_000)
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('status', 'expired')
        .gte('expires_at', from.toISOString())
        .lte('expires_at', to.toISOString())
      return data ?? []
    },
  },

  // ── Remarketing 7 dias após expirar ────────────────────────────────────
  {
    type: 'trial_remarketing_7d',
    title: '💰 Você perdeu R$ 1.200 essa semana',
    body: 'Os membros do VIP continuaram ganhando. Reativa agora com garantia.',
    dedupHours: 336,
    async getCandidates(sb) {
      const from = new Date(Date.now() - 8 * 24 * 3600_000)
      const to   = new Date(Date.now() - 6 * 24 * 3600_000)
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('status', 'expired')
        .gte('expires_at', from.toISOString())
        .lte('expires_at', to.toISOString())
      return data ?? []
    },
  },

  // ── Assinatura vencendo em 3 dias ───────────────────────────────────────
  {
    type: 'subscription_expiring',
    title: '⚠️ Assinatura vence em 3 dias',
    body: 'Renova agora pra não perder o acesso aos procedimentos do dia.',
    dedupHours: 72,
    async getCandidates(sb) {
      const in3d = new Date(Date.now() + 3 * 24 * 3600_000)
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('subscription_status', 'active')
        .lte('next_billing_at', in3d.toISOString())
        .gt('next_billing_at', new Date().toISOString())
      return data ?? []
    },
  },

  // ── Pagamento pendente ──────────────────────────────────────────────────
  {
    type: 'subscription_pending',
    title: '💳 Pagamento pendente',
    body: 'Confirma o pagamento pra não perder acesso aos procedimentos de hoje.',
    dedupHours: 24,
    async getCandidates(sb) {
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('subscription_status', 'pending')
      return data ?? []
    },
  },

  // ── Pagamento atrasado ──────────────────────────────────────────────────
  {
    type: 'subscription_past_due',
    title: '🚨 Pagamento atrasado!',
    body: 'Seu acesso está em risco — regulariza o pagamento agora.',
    dedupHours: 24,
    async getCandidates(sb) {
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('subscription_status', 'past_due')
      return data ?? []
    },
  },

  // ── Assinatura cancelada ────────────────────────────────────────────────
  {
    type: 'subscription_canceled',
    title: '❌ Assinatura cancelada',
    body: 'Sentimos sua falta 🦈 Reativa com 7 dias de garantia quando quiser.',
    dedupHours: 168,
    async getCandidates(sb) {
      const { data } = await sb.from('trial_leads')
        .select('id')
        .eq('subscription_status', 'canceled')
      return data ?? []
    },
  },
]

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`

  const summary: Record<string, { candidates: number; sent: number; skipped: number }> = {}

  for (const scenario of SCENARIOS) {
    try {
      // 1. Get candidates
      const candidates = await scenario.getCandidates(sb)
      if (!candidates.length) {
        summary[scenario.type] = { candidates: 0, sent: 0, skipped: 0 }
        continue
      }

      // 2. Dedup: check who was already notified recently
      const cutoff = new Date(Date.now() - scenario.dedupHours * 3600_000).toISOString()
      const { data: recentLogs } = await sb
        .from('push_notification_logs')
        .select('target')
        .eq('type', scenario.type)
        .gte('created_at', cutoff)

      const notifiedTargets = new Set(recentLogs?.map((l: any) => l.target) ?? [])

      const toSend = candidates.filter(c => !notifiedTargets.has(`lead:${c.id}`))

      let sent = 0
      let skipped = candidates.length - toSend.length

      // 3. For each unnotified lead, check push subscription exists and send
      for (const lead of toSend) {
        const { data: subs } = await sb
          .from('push_subscriptions')
          .select('id')
          .eq('lead_id', lead.id)
          .limit(1)

        if (!subs?.length) { skipped++; continue }

        // 4. Call send-push
        try {
          await fetch(sendPushUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              type: 'custom',
              lead_id: lead.id,
              title: scenario.title,
              body_text: scenario.body,
              url: CHECKOUT_URL,
              triggered_by: `lifecycle:${scenario.type}`,
            }),
          })

          // 5. Log this send for dedup tracking
          await sb.from('push_notification_logs').insert({
            type: scenario.type,
            title: scenario.title,
            body: scenario.body,
            url: CHECKOUT_URL,
            target: `lead:${lead.id}`,
            sent_count: 1,
            triggered_by: `lifecycle:${scenario.type}`,
          })

          sent++
        } catch (e: any) {
          console.error(`[push-lifecycle] send failed for lead ${lead.id}:`, e.message)
          skipped++
        }
      }

      summary[scenario.type] = { candidates: candidates.length, sent, skipped }

    } catch (e: any) {
      console.error(`[push-lifecycle] scenario ${scenario.type} error:`, e.message)
      summary[scenario.type] = { candidates: -1, sent: 0, skipped: -1 }
    }
  }

  console.log('[push-lifecycle] summary:', JSON.stringify(summary))

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
