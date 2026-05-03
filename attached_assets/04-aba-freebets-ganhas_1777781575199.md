# 04 — Aba "FreeBets Ganhas"

> **Objetivo:** Documentar a tela "FreeBets Ganhas" do FreeBet PRO (Painel de Envios → 3ª aba) pro time do Shark replicar — assim o usuário tem controle visual do **ciclo da FB** sem precisar abrir o painel do FreeBet.

---

## 1. O que essa aba mostra

Lista todos os procedimentos que **ganharam freebet** (`resultado_freebet_ganha > 0`), com 3 estados derivados:

| Status | Critério | Cor / posição |
|---|---|---|
| **Falta girar** | Tem FB ganha, **não** tem queimador apontando pra ele. | 🔴 Topo da lista — "ação pendente". |
| **Queimando** | Tem queimador (`QUEIMAR_FB` referenciando este), mas o queimador ainda não tem resultado. | 🟡 Meio. |
| **Concluída** | Queimador definido + queimador com `lucro_prejuizo` preenchido. | 🟢 Base — "ciclo fechado". |

A ordenação prioriza ações pendentes no topo: `falta_girar > queimando > concluida`.

---

## 2. KPIs no topo

4 cards mostram contagem agregada:

1. **Total de FBs ganhas** (período selecionado)
2. **Aguardando crédito** (`freebet_creditada=AGUARDANDO`) — soma valor
3. **Creditadas** (`freebet_creditada=SIM`) — soma valor
4. **Não vieram** (`freebet_creditada=NAO`) — contagem

E um KPI principal: **Lucro líquido total** = soma de `etapa1.lucro_prejuizo + etapa2.lucro_prejuizo` apenas dos ciclos completos.

---

## 3. Filtros pills (período × status)

### Período (4 opções)

- Hoje (default)
- 7 dias
- Mês atual
- Tudo

Persistido em `localStorage` pra próxima visita reabrir igual.

### Status (3 abas)

- Todas (default)
- Falta girar
- Concluídas

---

## 4. Endpoint que alimenta a tela

```
GET /api/procedimentos-tarefas/freebets-ganhas?periodo=mes&status=todos
```

**Query params:**
- `periodo` — `hoje` | `semana` | `mes` | `todos`. Default `mes`. Filtra por `updated_at`.
- `status` — `AGUARDANDO` | `SIM` | `NAO` | `todos`. Default `todos`. Filtra `freebet_creditada`.

**Response:**

```json
{
  "items": [
    {
      "id": 35,
      "numero": 500,
      "casa_aposta": "Bet365",
      "partida_descricao": "Flamengo x Palmeiras",
      "freebet_valor": "50.00",
      "freebet_creditada": "SIM",
      "status_operacao": "FREEBET_PENDENTE",
      "data_partida": "2026-05-03",
      "kickoff_at": "2026-05-03T19:00:00.000Z",
      "updated_at": "2026-05-03T20:15:00.000Z",
      "fb_ganha_valor": "50.00",
      "etapa1_lp": "-5.00",
      "queimador_id": 36,
      "queimador_numero": 501,
      "queimador_resultado_lucro": "35.00",
      "queimador_lucro_prejuizo": "35.00",
      "queimador_status": "CONCLUIDO",
      "lucro_liquido_ciclo": "30.00",
      "ciclo_completo": true
    }
  ],
  "kpis": {
    "total_count": 12,
    "total_valor": 600.00,
    "aguardando_count": 3,
    "aguardando_valor": 150.00,
    "creditadas_count": 8,
    "creditadas_valor": 400.00,
    "nao_creditadas_count": 1,
    "ciclos_completos_count": 7,
    "lucro_liquido_total": 245.00
  },
  "periodo": "mes",
  "status": "todos"
}
```

### Lógica do `lucro_liquido_ciclo`

```
lucro_liquido_ciclo = etapa1_lp + COALESCE(queimador_resultado_lucro, queimador_lucro_prejuizo, 0)
```

Onde `etapa1_lp = resultado_lucro` do procedimento original (a perda que vocês registraram em `lucro_prejuizo_previsto` quando criaram o GANHAR_FB).

---

## 5. Replicando do lado do Shark

### 5.1 SQL equivalente (pseudo)

Se vocês usam Postgres também:

```sql
SELECT
  g.id, g.numero, g.casa_aposta, g.partida_descricao,
  g.freebet_valor, g.freebet_creditada, g.status_operacao,
  g.data_partida, g.kickoff_at, g.updated_at,

  -- Valor da FB ganha (preferir o resultado real, fallback no previsto)
  COALESCE(g.resultado_freebet_ganha, g.freebet_valor, 0) AS fb_ganha_valor,

  -- L/P da etapa 1 (cash do ganhar)
  COALESCE(g.resultado_lucro, 0) AS etapa1_lp,

  -- Queimador vinculado
  q.id   AS queimador_id,
  q.numero AS queimador_numero,
  q.resultado_lucro AS queimador_resultado_lucro,
  q.status_operacao AS queimador_status,

  -- Lucro líquido total
  (COALESCE(g.resultado_lucro, 0) + COALESCE(q.resultado_lucro, q.lucro_prejuizo, 0))
    AS lucro_liquido_ciclo,

  -- Flag ciclo completo
  (q.id IS NOT NULL AND (q.resultado_lucro IS NOT NULL OR q.lucro_prejuizo IS NOT NULL))
    AS ciclo_completo

FROM procedimentos g
LEFT JOIN procedimentos q
  ON q.procedimento_referencia_id = g.id
  AND q.arquivado IS NOT TRUE
WHERE g.arquivado IS NOT TRUE
  AND COALESCE(g.resultado_freebet_ganha, 0) > 0
ORDER BY g.updated_at DESC
LIMIT 500;
```

### 5.2 Filtros de período (Postgres com timezone Brasília)

```sql
-- hoje
AND g.updated_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')
                    AT TIME ZONE 'America/Sao_Paulo'
-- semana
AND g.updated_at >= NOW() - INTERVAL '7 days'
-- mes
AND g.updated_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
                    AT TIME ZONE 'America/Sao_Paulo'
```

### 5.3 Frontend (estrutura mínima)

```jsx
function FreebetsGanhasView() {
  const [periodo, setPeriodo] = useState('mes');
  const [statusFiltro, setStatusFiltro] = useState('todas');

  const { data } = useQuery(['freebets-ganhas', periodo], async () => {
    const r = await fetch(`/api/freebets-ganhas?periodo=${periodo}`);
    return r.json();
  });

  const items = (data?.items || []).filter(p => {
    if (statusFiltro === 'falta_girar') return !p.queimador_id;
    if (statusFiltro === 'concluida') return p.ciclo_completo;
    return true;
  });

  return (
    <div>
      <KpiBar kpis={data?.kpis} />
      <PeriodoPills periodo={periodo} onChange={setPeriodo} />
      <StatusTabs status={statusFiltro} onChange={setStatusFiltro} />
      {items.map(p => <FreebetRow key={p.id} item={p} />)}
    </div>
  );
}
```

---

## 6. Por que essa tela importa

Sem ela, o usuário **perde controle de quais FBs já foram giradas**. Acumula FBs vencidas (perdem a validade), gira a mesma duas vezes, ou esquece de marcar `freebet_creditada=SIM` quando a casa libera.

A tela é o "espelho" do estado interno: tudo o que o `cascade FB` (doc 03 §4) gerencia automaticamente fica visível e auditável aqui.

---

## 7. Checklist de implementação (Shark)

- [ ] Endpoint `GET /api/freebets-ganhas?periodo=...` no backend de vocês.
- [ ] LEFT JOIN entre procedimento original e queimador (via `procedimento_referencia_id`).
- [ ] Cálculo do `lucro_liquido_ciclo` somando etapa 1 + etapa 2.
- [ ] Flag `ciclo_completo` derivada (queimador existe + tem L/P).
- [ ] UI: 3ª aba no painel de envios com filtros pills (período × status).
- [ ] 4 cards de KPI no topo (total / aguardando / creditadas / não vieram) + lucro líquido total.
- [ ] Ordenação: `falta_girar` no topo, `queimando` no meio, `concluida` na base.
- [ ] Persistir filtro de período em localStorage (`shark_freebets_ganhas_periodo`).

---

## 8. Encerramento

Esses 4 documentos cobrem o gap funcional entre os dois modais. Quando essas 4 implementações estiverem prontas no Shark, o usuário não vai mais precisar abrir o Painel de Envios do FreeBet PRO pra checar nada — tudo está lá no lado de vocês também.

Fim do pacote. **[Voltar pro README](./README.md)**.
