

# Plano: Corrigir Erro de Update do Bot Telegram

## Problema Identificado

O erro "Cannot coerce the result to a single JSON object" ocorre por duas razoes:

1. **Tabela sem dados ou inexistente**: A migration pode nao ter sido executada
2. **Falta policy de UPDATE**: O RLS bloqueia a atualizacao

---

## Correcoes Necessarias

### 1. Melhorar o Hook de Update

O `.single()` na linha 46 falha se nao houver dados retornados. Vamos trocar por `.maybeSingle()` e tratar o caso de erro.

**Arquivo**: `src/hooks/useTelegramBot.ts`

```typescript
// Linha 38-49: Trocar .single() por .maybeSingle() e validar
const { data, error } = await supabase
  .from('telegram_bot_config')
  .update({
    ...config,
    updated_at: new Date().toISOString(),
  })
  .eq('id', existing.id)
  .select()
  .maybeSingle();

if (error) throw error;
if (!data) throw new Error('Falha ao atualizar configuração');
return data;
```

### 2. Adicionar Policy de UPDATE na Migration

**Arquivo**: `docs/migration-telegram-bot.sql`

Adicionar ao final:

```sql
-- Permitir UPDATE para usuarios autenticados
CREATE POLICY "Allow authenticated update config" 
ON public.telegram_bot_config FOR UPDATE 
TO authenticated USING (true) WITH CHECK (true);
```

---

## Verificar no Supabase

Voce precisa verificar se a migration foi executada. Va no Supabase Dashboard > SQL Editor e rode:

```sql
-- Verificar se a tabela existe e tem dados
SELECT * FROM telegram_bot_config;

-- Se nao existir, rodar a migration completa
-- Se existir mas estiver vazia, inserir config inicial:
INSERT INTO telegram_bot_config (id) VALUES (gen_random_uuid());

-- Adicionar policy de UPDATE (se nao existir)
CREATE POLICY "Allow authenticated update config" 
ON public.telegram_bot_config FOR UPDATE 
TO authenticated USING (true) WITH CHECK (true);
```

---

## Comandos PM2 para Monitorar o Bot

```bash
# Ver status de todos os processos
pm2 list

# Ver logs do bot Telegram em tempo real
pm2 logs telegram-dg-bot

# Ver logs com mais detalhes (ultimas 100 linhas)
pm2 logs telegram-dg-bot --lines 100

# Ver erros apenas
pm2 logs telegram-dg-bot --err

# Reiniciar o bot
pm2 restart telegram-dg-bot

# Parar o bot
pm2 stop telegram-dg-bot

# Monitoramento em tempo real (CPU, memoria)
pm2 monit

# Ver status detalhado
pm2 show telegram-dg-bot
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useTelegramBot.ts` | Trocar `.single()` por `.maybeSingle()` |
| `docs/migration-telegram-bot.sql` | Adicionar policy de UPDATE |

---

## Ordem de Execucao

1. Atualizar o hook no frontend (corrigir `.single()`)
2. Verificar no Supabase se a tabela existe
3. Se nao existir, rodar a migration completa
4. Se existir, adicionar a policy de UPDATE
5. Verificar se existe registro inicial na config
6. Testar toggle do bot novamente

