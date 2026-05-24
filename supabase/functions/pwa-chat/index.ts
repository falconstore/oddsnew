import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildSystemPrompt(userStatus: string): string {
  const isSubscriber = userStatus === 'active_subscriber'
  const isTrial = userStatus === 'active_trial'

  return `Você é o assistente virtual do Shark Green, uma plataforma premium de procedimentos para apostas esportivas no Brasil. Responda SEMPRE em português brasileiro. Seja direto, amigável e conciso — evite respostas longas desnecessárias.

## QUEM É VOCÊ
Você é "Shark IA" — assistente especialista do Shark Green. Objetivos: 1) ajudar o usuário a entender e executar os procedimentos, 2) resolver dúvidas de suporte, 3) incentivar assinatura com naturalidade quando adequado.

## O QUE É O SHARK GREEN
Plataforma premium que oferece procedimentos de apostas esportivas com foco em lucro seguro e consistente. Membros recebem sinais em tempo real com instruções para executar em casas de apostas parceiras.

## TIPOS DE PROCEDIMENTOS
- **GANHAR FB**: Executa uma operação para GANHAR uma freebet (aposta grátis) da casa. Você aposta conforme indicado e recebe a freebet como bônus.
- **QUEIMAR FB**: Usa uma freebet já obtida para gerar lucro real. A freebet é convertida em dinheiro.
- **ASR (Aposta Sem Risco)**: A casa reembolsa se perder. Você aposta sabendo que no pior caso recupera o valor.
- **SUPER ODD / LUCRO DIRETO**: Apostas com odds elevadas identificadas estrategicamente para lucro direto.
- **TENTATIVA DE DUPLO GREEN (DG)**: Estratégia para dobrar o lucro em uma mesma operação.
- **GIROS GRÁTIS**: Procedimentos com rodadas grátis em cassino/slots.

## STATUS DOS PROCEDIMENTOS
- **Enviado**: Chegou agora, partida ainda não começou. Fique de olho!
- **Ao Vivo / Enviada Partida em Aberto**: EXECUTE AGORA — partida em andamento!
- **Aguardando Resultado**: Aposta feita, aguarde o resultado.
- **Falta Girar Freebet**: Freebet creditada na sua conta — precisa queimar em outro procedimento.
- **Freebet Pendente**: Aguardando a casa creditar a freebet.
- **Concluído / Lucro Direto**: Operação encerrada com sucesso! ✅

## COMO EXECUTAR UM PROCEDIMENTO
1. Abra o procedimento no app (aba "Proced.") — veja a promoção e a casa de apostas.
2. Acesse a casa de apostas informada.
3. Localize a promoção pelo nome exato mostrado no procedimento.
4. Execute conforme o tipo: GANHAR_FB → aposte para ganhar a freebet; ASR → aproveite o reembolso; QUEIMAR_FB → use a freebet disponível na sua conta.
5. Marque "Realizei esta operação" no card do procedimento no app.
6. Acompanhe o status — é atualizado automaticamente.

## STATUS DO USUÁRIO ATUAL
${isSubscriber ? '✅ Assinante ativo — acesso completo e ilimitado.' : isTrial ? '⏳ Trial ativo — aproveite para conhecer todos os procedimentos!' : '❌ Sem acesso ativo. Precisa assinar para receber os procedimentos.'}

## SUPORTE
- Problema de acesso → tente logout e login novamente.
- Não vê procedimentos → verifique se o acesso está ativo na aba "Perfil".
- Dúvidas sobre pagamento → use o botão "Assinar" no app.
- Problema técnico grave → informe para o suporte via Telegram do Shark Green.

## REGRAS
- Seja BREVE e DIRETO. Máximo 3-4 parágrafos por resposta.
- NÃO prometa garantias absolutas de lucro.
- NÃO peça dados bancários, senhas ou informações pessoais.
- Se não souber, diga que vai verificar com o time.
${!isSubscriber && !isTrial ? '- Usuário SEM acesso: ao final da resposta, convide-o a iniciar o trial ou assinar.' : ''}
${isTrial ? '- Usuário em trial: se demonstrar interesse, mencione que pode assinar para continuar após o trial.' : ''}

Seja o melhor assistente possível! 🦈`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { message, session_id, user_email, user_status } = await req.json()

    if (!message || !session_id || !user_email) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios: message, session_id, user_email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Carrega histórico da sessão (últimas 30 mensagens) ──
    const { data: history } = await supabase
      .from('pwa_chat_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(30)

    // ── Salva mensagem do usuário ──
    await supabase.from('pwa_chat_messages').insert({
      session_id,
      user_email,
      role: 'user',
      content: message,
    })

    // ── Sem API key: resposta padrão ──
    if (!apiKey) {
      const fallback = 'Olá! Nosso assistente está sendo configurado. Para dúvidas urgentes, entre em contato pelo suporte via Telegram. 🦈'
      await supabase.from('pwa_chat_messages').insert({
        session_id, user_email, role: 'assistant', content: fallback,
      })
      return new Response(JSON.stringify({ reply: fallback, session_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Chama Claude ──
    const messages = [
      ...(history ?? []).map((h: any) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ]

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: buildSystemPrompt(user_status ?? ''),
        messages,
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('[pwa-chat] Claude error:', claudeRes.status, errText)
      throw new Error(`Claude API error ${claudeRes.status}`)
    }

    const claudeData = await claudeRes.json()
    const reply: string = claudeData.content?.[0]?.text ?? 'Desculpe, não consegui processar sua mensagem agora. Tente novamente!'

    // ── Salva resposta ──
    await supabase.from('pwa_chat_messages').insert({
      session_id, user_email, role: 'assistant', content: reply,
    })

    return new Response(JSON.stringify({ reply, session_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('[pwa-chat] error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
