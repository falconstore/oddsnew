
# Plano: Monitoramento de Status dos Scrapers

## Problema Identificado

Atualmente não existe forma de saber se um scraper está realmente funcionando:

| Situação | PM2 mostra | Banco de dados |
|----------|------------|----------------|
| Scraper funcionando | online | Recebendo dados |
| Scraper travado (loop vazio) | online | Sem dados novos |
| Scraper com erro silencioso | online | Sem dados novos |
| Scraper crasheado | stopping/restarting | Sem dados novos |

O PM2 só sabe se o processo está rodando, mas não se ele está **produzindo dados**.

---

## Solucao: Tabela de Heartbeat + Dashboard de Status

```text
┌─────────────────────────────────────────────────────────────┐
│                   SISTEMA DE MONITORAMENTO                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Scraper Betano]  ──► INSERT odds_history                  │
│                    ──► UPSERT scraper_status (heartbeat)    │
│                                                             │
│  [Scraper Bet365]  ──► INSERT odds_history                  │
│                    ──► UPSERT scraper_status (heartbeat)    │
│                                                             │
│  ...                                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Dashboard Admin]                                          │
│                                                             │
│  ┌─────────────┬──────────┬─────────────┬──────────────┐   │
│  │ Scraper     │ Status   │ Ultimo Dado │ Odds/Ciclo   │   │
│  ├─────────────┼──────────┼─────────────┼──────────────┤   │
│  │ Betano      │ OK       │ 12s atras   │ 45           │   │
│  │ Bet365      │ ALERTA   │ 3min atras  │ 0            │   │
│  │ Superbet    │ OK       │ 8s atras    │ 38           │   │
│  │ Novibet     │ OFFLINE  │ 10min atras │ 0            │   │
│  └─────────────┴──────────┴─────────────┴──────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Parte 1: Nova Tabela no Supabase

### Arquivo: `docs/migration-scraper-status.sql`

```sql
-- Tabela para rastrear status de cada scraper
CREATE TABLE IF NOT EXISTS public.scraper_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraper_name TEXT NOT NULL UNIQUE,
    bookmaker_id UUID REFERENCES public.bookmakers(id),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success TIMESTAMPTZ,
    odds_collected INTEGER DEFAULT 0,
    odds_inserted INTEGER DEFAULT 0,
    cycle_count INTEGER DEFAULT 0,
    last_error TEXT,
    status TEXT DEFAULT 'unknown', -- ok, warning, error, offline
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para consultas rapidas
CREATE INDEX idx_scraper_status_name ON public.scraper_status(scraper_name);
CREATE INDEX idx_scraper_status_heartbeat ON public.scraper_status(last_heartbeat);

-- View para monitoramento com tempo desde ultimo heartbeat
CREATE OR REPLACE VIEW public.scraper_status_view AS
SELECT 
    ss.*,
    b.name AS bookmaker_display_name,
    b.logo_url AS bookmaker_logo,
    EXTRACT(EPOCH FROM (NOW() - ss.last_heartbeat)) AS seconds_since_heartbeat,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - ss.last_heartbeat)) < 60 THEN 'ok'
        WHEN EXTRACT(EPOCH FROM (NOW() - ss.last_heartbeat)) < 180 THEN 'warning'
        ELSE 'error'
    END AS computed_status
FROM public.scraper_status ss
LEFT JOIN public.bookmakers b ON ss.bookmaker_id = b.id
ORDER BY ss.scraper_name;
```

---

## Parte 2: Atualizar run_scraper.py

Adicionar envio de heartbeat a cada ciclo:

```python
# No loop principal, apos inserir odds:
async def update_heartbeat(
    supabase: SupabaseClient,
    scraper_name: str,
    bookmaker_id: str,
    odds_collected: int,
    odds_inserted: int,
    cycle_count: int,
    error: str = None
):
    """Envia heartbeat para tabela de status."""
    try:
        data = {
            "scraper_name": scraper_name,
            "bookmaker_id": bookmaker_id,
            "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            "odds_collected": odds_collected,
            "odds_inserted": odds_inserted,
            "cycle_count": cycle_count,
            "last_error": error,
            "status": "error" if error else ("warning" if odds_inserted == 0 else "ok"),
        }
        
        if odds_inserted > 0:
            data["last_success"] = datetime.now(timezone.utc).isoformat()
        
        supabase.client.table("scraper_status").upsert(
            data,
            on_conflict="scraper_name"
        ).execute()
    except Exception as e:
        logger.warning(f"Failed to update heartbeat: {e}")
```

---

## Parte 3: Nova Pagina Admin - Scraper Status

### Arquivo: `src/pages/admin/ScraperStatus.tsx`

Dashboard visual com:

1. **Cards de Resumo**
   - Total de scrapers ativos
   - Scrapers com problemas
   - Ultima atualizacao geral

2. **Tabela de Status**
   | Scraper | Status | Ultimo Heartbeat | Odds Coletadas | Odds Inseridas | Erro |
   |---------|--------|------------------|----------------|----------------|------|
   | Betano | OK | 12s | 45 | 42 | - |
   | Bet365 | ALERTA | 3min | 0 | 0 | Connection closed |
   | Novibet | OFFLINE | 10min | 0 | 0 | - |

3. **Indicadores Visuais**
   - Verde: heartbeat < 60s
   - Amarelo: heartbeat 60s-180s
   - Vermelho: heartbeat > 180s

4. **Auto-refresh** a cada 30 segundos

---

## Parte 4: Hook de Dados

### Arquivo: `src/hooks/useScraperStatus.ts`

```typescript
export const useScraperStatus = () => {
  return useQuery({
    queryKey: ['scraper_status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_status_view')
        .select('*')
        .order('scraper_name');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // 30 segundos
  });
};
```

---

## Parte 5: Adicionar Rota no Sidebar

Atualizar `src/components/Sidebar.tsx` para incluir link para `/admin/scraper-status`

---

## Resumo das Mudancas

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `docs/migration-scraper-status.sql` | Novo | Tabela e view de status |
| `docs/scraper/supabase_client.py` | Editar | Metodo `upsert_scraper_status` |
| `docs/scraper/standalone/run_scraper.py` | Editar | Enviar heartbeat a cada ciclo |
| `src/pages/admin/ScraperStatus.tsx` | Novo | Dashboard de monitoramento |
| `src/hooks/useScraperStatus.ts` | Novo | Hook para buscar status |
| `src/components/Sidebar.tsx` | Editar | Link para nova pagina |
| `src/App.tsx` | Editar | Rota `/admin/scraper-status` |

---

## Beneficios

| Antes | Depois |
|-------|--------|
| Nao sabe se scraper esta funcionando | Heartbeat mostra ultimo sinal de vida |
| Nao sabe quantas odds foram coletadas | Contador de odds por ciclo |
| Nao sabe se houve erro | Ultimo erro registrado |
| Precisa ver logs do PM2 | Dashboard visual no admin |
| Dificil identificar scraper silencioso | Status automatico: OK/Warning/Error |

---

## Notas Tecnicas

1. **Upsert**: Usa `ON CONFLICT` para atualizar registro existente ou criar novo
2. **Heartbeat leve**: Apenas 1 upsert por ciclo (~30s), nao sobrecarrega o banco
3. **View computada**: Calcula status baseado em tempo desde ultimo heartbeat
4. **Fallback**: Se heartbeat falhar, scraper continua funcionando normalmente
