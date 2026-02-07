

# Fix: Estrelabet mostrando apenas PA ou SO (nunca ambos)

## Diagnostico

Tracei todo o pipeline de dados:

1. **Scraper** (OK) - Estrelabet produz PA e SO corretamente (logs confirmam "13 PA + 4 SO = 17 total")
2. **Orchestrator** (OK) - Passa `odds_type` para o banco (linha 505: `"odds_type": odds.odds_type`)
3. **Banco de dados** (PROBLEMA) - O trigger `mark_old_odds_not_latest()` provavelmente NAO inclui `odds_type` no WHERE. Quando SO e inserido, marca PA como `is_latest = FALSE` (ou vice-versa)
4. **View** `odds_comparison` (OK se trigger estiver correto) - Filtra por `is_latest = TRUE`
5. **JSON Generator** (OK) - Sem deduplicacao por bookmaker
6. **Frontend** (OK) - Usa key `bookmaker_id-odds_type`, renderiza ambos

O problema esta no trigger. A funcao `mark_old_odds_not_latest()` precisa usar a combinacao `(match_id, bookmaker_id, odds_type)` para decidir qual registro marcar como nao mais recente. Sem o `odds_type`, inserir SO anula o PA.

## Correcoes

### 1. Banco de Dados (SQL no Supabase)

O usuario precisa executar no SQL Editor do Supabase:

```sql
-- Atualizar trigger para separar por odds_type
CREATE OR REPLACE FUNCTION public.mark_old_odds_not_latest()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.odds_history
    SET is_latest = FALSE
    WHERE match_id = NEW.match_id 
      AND bookmaker_id = NEW.bookmaker_id 
      AND odds_type = NEW.odds_type
      AND id != NEW.id
      AND is_latest = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Corrigir registros existentes: marcar ambos PA e SO como is_latest
-- para as entradas mais recentes de cada combinacao
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY match_id, bookmaker_id, odds_type
               ORDER BY scraped_at DESC
           ) AS rn
    FROM public.odds_history
)
UPDATE public.odds_history oh
SET is_latest = (ranked.rn = 1)
FROM ranked
WHERE oh.id = ranked.id;
```

A primeira parte corrige o trigger para futuras insercoes. A segunda parte corrige os dados existentes, garantindo que tanto PA quanto SO tenham seu proprio `is_latest = TRUE`.

### 2. Frontend - Correcao menor

**Arquivo: `src/pages/MatchDetails.tsx`** - Linha 822

Existe uma terceira instancia de `knownSOBookmakers` que ficou sem `tradeball`:

```
Antes:  const knownSOBookmakers = ['novibet', 'betbra', 'betnacional'];
Depois: const knownSOBookmakers = ['novibet', 'betbra', 'betnacional', 'tradeball'];
```

Isso afeta o calculo de melhor/pior odds por grupo (SO vs PA) na tabela detalhada.

## Resumo

| O que | Onde | Mudanca |
|---|---|---|
| Trigger com odds_type | Supabase SQL Editor | `CREATE OR REPLACE FUNCTION` com `AND odds_type = NEW.odds_type` |
| Corrigir dados existentes | Supabase SQL Editor | UPDATE com window function para remarcar `is_latest` |
| knownSOBookmakers | `src/pages/MatchDetails.tsx` linha 822 | Adicionar `'tradeball'` |

## Resultado esperado

Apos aplicar o SQL e o fix no frontend, ao abrir o jogo Alaves x Getafe CF, a tabela de odds mostrara:
- Estrelabet com badge **PA** na secao "Pagamento Antecipado"
- Estrelabet com badge **SO** na secao "Super Odds"
- Ambas com odds potencialmente diferentes

## Deploy

```text
1. Supabase SQL Editor: Executar os dois comandos SQL acima
2. Frontend: Automatico via Lovable (publicar apos aprovacao)
3. Aguardar 15-30 segundos para o JSON Generator gerar novo odds.json com ambos os tipos
4. Verificar no jogo Alaves x Getafe que Estrelabet aparece nas duas secoes
```

