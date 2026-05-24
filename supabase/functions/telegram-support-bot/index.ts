import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Você é o assistente virtual do Shark Green, uma plataforma premium de procedimentos para apostas esportivas no Brasil. Responda SEMPRE em português brasileiro. Seja direto, amigável e conciso.

## QUEM É VOCÊ
Você é "Shark IA" — assistente de suporte do Shark Green no Telegram. Objetivos: resolver dúvidas, explicar os procedimentos e incentivar a assinatura quando natural.

## O QUE É O SHARK GREEN
Plataforma que oferece procedimentos de apostas esportivas com foco em lucro seguro e consistente. Membros recebem sinais em tempo real com instruções para casas de apostas parceiras.

## TIPOS DE PROCEDIMENTOS
- GANHAR FB: Execute para GANHAR uma freebet da casa de apostas.
- QUEIMAR FB: Use uma freebet já obtida para gerar lucro real.
- ASR (Aposta Sem Risco): A casa reembolsa se perder.
- SUPER ODD / LUCRO DIRETO: Apostas com odds elevadas para lucro direto.
- DUPLO GREEN: Estratégia para dobrar o lucro.

## STATUS DOS PROCEDIMENTOS
- Enviado: Chegou, aguarde a partida começar.
- Ao Vivo: EXECUTE AGORA!
- Aguardando Resultado: Aposta feita, aguarde.
- Falta Girar Freebet: Use a freebet em outro procedimento.
- Concluído: Sucesso! ✅

## ACESSO AO APP
O Shark Green tem um app exclusivo para membros. Para acessar: link de acesso enviado após assinar ou iniciar o trial em sharkgreen.com.br

## SUPORTE
- Problema de acesso → logout e login novamente no app.
- Dúvidas sobre pagamento → acesse o app e toque em "Assinar".
- Problema grave → diga que vai escalar para o time humano.

## REGRAS
- Seja BREVE — máximo 3 parágrafos por mensagem no Telegram.
- Use emojis com moderação (1-2 por mensagem).
- NÃO prometa garantias absolutas de lucro.
- NÃO peça dados bancários ou senhas.
- Se não souber, diga que vai verificar.
- Ao final de conversas sobre dúvidas gerais, convide para conhecer a plataforma.

Seja o melhor suporte possível! 🦈`

async function getChatHistory(supabase: any, chatId: number): Promise<{ role: string; content: string }[]> {
  const { data } = await supabase
    .from('telegram_support_chat')
    .select('role, content')
    .eq('telegram_chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(20)
  return data ?? []
}

async function callClaude(apiKey: string, history: { role: string; content: string }[], newMessage: string): Promise<string> {
  const messages = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: newMessage },
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })

  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? 'Desculpe, tente novamente!'
}

async function sendTelegram(botToken: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Registro de webhook ──
  const url = new URL(req.url)
  if (url.searchParams.get('action') === 'register-webhook') {
    const botToken = Deno.env.get('TELEGRAM_SUPPORT_BOT_TOKEN')
    if (!botToken) return new Response(JSON.stringify({ error: 'TELEGRAM_SUPPORT_BOT_TOKEN não configurado' }), { status: 503, headers: corsHeaders })
    const hookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-support-bot`
    const r = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: hookUrl }),
    })
    const d = await r.json()
    return new Response(JSON.stringify(d), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_SUPPORT_BOT_TOKEN')
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!botToken) return new Response('no bot token', { status: 503 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const update = await req.json()
    const msg = update.message
    if (!msg?.text || !msg.from) return new Response('ok')

    const chatId: number = msg.chat.id
    const userId: number = msg.from.id
    const username: string = msg.from.username ?? ''
    const firstName: string = msg.from.first_name ?? 'Usuário'
    const text: string = msg.text.trim()

    // Ignorar comandos especiais
    if (text === '/start') {
      await sendTelegram(botToken, chatId,
        `👋 Olá, *${firstName}*! Sou o Shark IA, assistente virtual do Shark Green.\n\nPosso te ajudar com:\n• Dúvidas sobre os procedimentos\n• Como usar o app\n• Suporte geral\n\nDigite sua pergunta! 🦈`)
      return new Response('ok')
    }

    // Indicador de digitando
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    })

    let reply: string
    if (!apiKey) {
      reply = 'Olá! Nosso assistente está sendo configurado. Em breve responderei todas as suas dúvidas automaticamente! Por enquanto, o suporte humano entrará em contato. 🦈'
    } else {
      const history = await getChatHistory(supabase, chatId)
      reply = await callClaude(apiKey, history, text)
    }

    // Salva no histórico
    await supabase.from('telegram_support_chat').insert([
      { telegram_chat_id: chatId, telegram_user_id: userId, username, first_name: firstName, role: 'user', content: text },
      { telegram_chat_id: chatId, telegram_user_id: userId, username, first_name: firstName, role: 'assistant', content: reply },
    ])

    await sendTelegram(botToken, chatId, reply)
    return new Response('ok')
  } catch (err: any) {
    console.error('[telegram-support-bot] error:', err)
    return new Response('ok')
  }
})
