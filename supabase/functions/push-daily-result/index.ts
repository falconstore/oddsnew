import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mesma hierarquia do admin/PWA:
// duplo_green_lucro > resultado_lucro > profit_loss > lucro_prejuizo_previsto
function getLucroEfetivo(proc: any): number {
  if (proc.duplo_green_confirmado && proc.duplo_green_lucro != null) {
    return Number(proc.duplo_green_lucro)
  }
  if (proc.resultado_lucro != null && proc.resultado_lucro !== 0) {
    return Number(proc.resultado_lucro)
  }
  if (proc.profit_loss != null && proc.profit_loss !== 0) {
    return Number(proc.profit_loss)
  }
  if (proc.lucro_prejuizo_previsto != null) {
    return Number(proc.lucro_prejuizo_previsto)
  }
  return 0
}

function fmtBRL(n: number): string {
  const abs = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${n >= 0 ? '+' : '-'}${abs}`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // ── Data de hoje em America/Sao_Paulo ──
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const yyyy = nowBR.getFullYear()
    const mm = String(nowBR.getMonth() + 1).padStart(2, '0')
    const dd = String(nowBR.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`

    console.log('[push-daily-result] Calculando resultado para', today)

    // ── Busca procedimentos de hoje (não arquivados, não tachados) ──
    const { data: procs, error } = await supabase
      .from('procedures')
      .select('duplo_green_confirmado,duplo_green_lucro,resultado_lucro,profit_loss,lucro_prejuizo_previsto,status,tipo')
      .eq('date', today)
      .eq('archived', false)
      .eq('tachado', false)

    if (error) throw error

    const total = procs?.length ?? 0

    // ── Soma lucro com hierarquia correta ──
    let lucroTotal = 0
    for (const p of procs ?? []) {
      lucroTotal += getLucroEfetivo(p)
    }

    const lucro5cpf = lucroTotal * 5

    console.log(`[push-daily-result] Procedimentos: ${total} | Lucro: ${lucroTotal} | 5-CPF: ${lucro5cpf}`)

    if (total === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: 'sem procedimentos hoje' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Monta texto da notificação ──
    const dateLabel = fmtDate(nowBR)
    const lucroStr = fmtBRL(lucroTotal)
    const cpf5Str = fmtBRL(lucro5cpf)

    const title = `📊 Resultado — ${dateLabel}`
    const bodyText = `${lucroStr} hoje • ${cpf5Str} com 5 CPFs (${total} procedimento${total !== 1 ? 's' : ''})`

    // ── Chama send-push para todos os inscritos ──
    const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`
    const res = await fetch(sendPushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        type: 'custom',
        title,
        body_text: bodyText,
        tag: 'daily_result',
        url: '/app/',
        triggered_by: 'cron_daily_result',
      }),
    })

    const result = await res.json()
    console.log('[push-daily-result] send-push result:', JSON.stringify(result))

    return new Response(
      JSON.stringify({ today, total, lucroTotal, lucro5cpf, push: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[push-daily-result] error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
