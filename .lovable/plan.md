

# Adicionar Coluna "Tempo Médio" na Tabela de Status dos Scrapers

## Objetivo
Exibir uma nova coluna mostrando quanto tempo em média cada scraper demora entre atualizações (ciclos).

## Como Calcular

A fórmula mais precisa com os dados disponíveis:

```text
Tempo Médio = (tempo desde criação) / (número de ciclos)
            = (NOW - created_at) / cycle_count
```

Isso mostra o intervalo médio entre cada ciclo de coleta desde que o scraper começou a operar.

## Implementação

### 1. Atualizar a View SQL (migration)

**Arquivo:** `docs/migration-scraper-status.sql` (nova migration para aplicar)

Adicionar campo calculado na view:
```sql
-- Tempo médio entre ciclos em segundos
CASE 
    WHEN ss.cycle_count > 0 THEN 
        EXTRACT(EPOCH FROM (NOW() - ss.created_at))::INTEGER / ss.cycle_count
    ELSE 
        NULL
END AS avg_cycle_seconds
```

### 2. Atualizar o Tipo TypeScript

**Arquivo:** `src/types/scraperStatus.ts`

Adicionar:
```typescript
avg_cycle_seconds: number | null;
```

### 3. Atualizar a Tabela no Frontend

**Arquivo:** `src/pages/admin/ScraperStatus.tsx`

Mudancas:
- Adicionar funcao `formatDuration()` para exibir o tempo medio de forma legível (ex: "32s", "1m 15s")
- Adicionar coluna "Tempo Médio" na tabela entre "Ciclos" e "Último Erro"
- Exibir o valor formatado ou "-" se nao houver ciclos ainda

### Exemplo Visual da Nova Coluna

| Scraper | Status | ... | Ciclos | **Tempo Médio** | Último Erro |
|---------|--------|-----|--------|-----------------|-------------|
| betano  | OK     | ... | 156    | **35s**         | -           |
| bet365  | OK     | ... | 89     | **1m 02s**      | -           |
| stake   | Alerta | ... | 12     | **2m 45s**      | timeout     |

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `docs/migration-scraper-status.sql` | Adicionar `avg_cycle_seconds` na view |
| `src/types/scraperStatus.ts` | Adicionar campo `avg_cycle_seconds` |
| `src/pages/admin/ScraperStatus.tsx` | Adicionar coluna "Tempo Médio" com formatacao |

## Nota para o VPS

Apos aprovar, sera necessario rodar a migration atualizada no Supabase para recriar a view com o novo campo calculado.

