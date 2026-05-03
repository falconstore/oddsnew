# 03 — Lógica Ganhar FreeBet / Queimar FreeBet

> **Objetivo:** Explicar pro time do Shark como o FreeBet PRO interpreta o `tipo` do procedimento, a cadeia de FB via `external_referencia_id`, e — **principal foco desta versão** — como o **autocomplete de Origem da FB** funciona no modo Queimar (gap visual mais crítico do pacote, vide doc 01 §0.2).

---

## 0. Comparação visual — modo Queimar 🔥

| BetShark Pro (hoje) | FreeBet PRO |
|---|---|
| ![Modal Shark Queimar FB](./prints/modal-shark-queimar-fb.png) | ![Modal FreeBet PRO Queimar FB](./prints/modal-freebetpro-queimar-fb.png) |

| Aspecto | Shark | FreeBet PRO |
|---|---|---|
| Campo | "Referência Freebet" | "Vincular Freebet Origem" |
| Tipo de input | Texto livre — "Nº do procedimento que gerou a FB" | **Autocomplete** — busca real em FBs disponíveis |
| O que aparece na lista | (nada — campo cego) | `🎁 #359 — BETANO — Sao Paulo x Bahia — R$ 20,00 — L/P origem: -R$ 3,00` (rodapé mostra contagem total) |
| Validação | Cliente confia no usuário | Bloqueia salvar sem origem selecionada |
| Erro mais comum | `422 UNRESOLVED_REFERENCE` (digitou nº errado) | Praticamente impossível — só seleciona FB que existe |

> Esse é o **gap mais bloqueante do pacote**. Sem ele, o ciclo da FB depende do usuário decorar o nº da FB ganha — o que quebra na prática quando o usuário tem 5+ FBs em aberto.

---

## 1. Os 3 estados básicos

O campo `tipo` do procedimento tem 3 valores principais (existe um quarto, `DUPLO`, equivalente a Normal mas com flag adicional):

| `tipo` | Quando usar | Comportamento no FreeBet PRO |
|---|---|---|
| `NORMAL` (ou alias `SEM_FB`) | Procedimento sem freebet envolvida — só cash, lucro/prejuízo direto. | Card normal, sem cadeia. |
| `GANHAR_FB` | Procedimento que **gera** uma freebet futura (ex: "aposte R$50 e ganhe FB R$50 em caso de empate"). | Card com selo "🎁 Ganhar Freebet". Origem da cadeia. Quando o resultado é definido como `freebet_creditada=SIM`, vira um item em **FreeBets Ganhas** disponível pra ser referenciado por uma queima. |
| `QUEIMAR_FB` | Procedimento que **gasta** uma FB já ganha (ex: "vou usar minha FB de R$50 da Bet365 nesse Real x Barça"). | Card com selo "🔥 Queimar FB" + badge clicável "🔗 Cadeia #N" apontando pra origem. Precisa apontar pra origem via `external_referencia_id`. Quando concluído com lucro, **fecha a origem automaticamente** (cascade FB — vide §4). |

---

## 2. A cadeia via `external_referencia_id`

Cada procedimento tem um `external_id` (UUID/string que identifica ele unicamente do lado de vocês). Quando vocês criam um `QUEIMAR_FB`, mandam o `external_id` do `GANHAR_FB` que originou aquela FB no campo `external_referencia_id`.

### Exemplo concreto

**Passo 1 — Criar o GANHAR_FB:**

```json
POST /api/integracoes/betshark/procedimentos
{
  "external_id": "bsk:ganhar-2026-05-03-001",
  "titulo": "SuperOdd Bet365 — empate FB R$50",
  "casa_aposta": "Bet365",
  "tipo": "GANHAR_FB",
  "freebet_valor_previsto": 50.00,
  "lucro_prejuizo_previsto": -5.00
}
```

→ FreeBet responde `201` com id interno (ex: `35`).

**Passo 2 — Definir resultado (vide doc 06):**

A freebet é creditada → `freebet_creditada=SIM` (no nosso lado, quando o admin marca "Ganhei FB" no modal Definir Resultados, isso é setado automaticamente). Agora o item aparece na aba "FreeBets Ganhas" como **falta_girar** e fica **listável no autocomplete da Origem**.

**Passo 3 — Criar o QUEIMAR_FB referenciando a origem (via autocomplete!):**

```json
POST /api/integracoes/betshark/procedimentos
{
  "external_id": "bsk:queimar-2026-05-04-001",
  "titulo": "Real x Barça — usando FB Bet365",
  "casa_aposta": "Bet365",
  "tipo": "QUEIMAR_FB",
  "freebet_valor_previsto": 50.00,
  "external_referencia_id": "bsk:ganhar-2026-05-03-001",  // ← ORIGEM (selecionada via autocomplete)
  "lucro_prejuizo_previsto": 35.00
}
```

→ FreeBet faz lookup: `procedimentos_tarefas WHERE external_id = 'bsk:ganhar-2026-05-03-001'`, pega o id interno (`35`), grava como `procedimento_referencia`.

→ Se o UUID não for encontrado, **retorna `422 UNRESOLVED_REFERENCE`**. É erro de integridade — vocês mandaram uma queima apontando pra origem que nunca foi enviada (ou foi excluída).

**Passo 4 — Definir resultado da queima (vide doc 06):**

Quando o queimador é fechado com `status_operacao=CONCLUIDO` ou `LUCRO_DIRETO` **e** `lucro_prejuizo` preenchido, o backend **fecha automaticamente a origem** (cascade FB — vide §4).

---

## 3. Spec do autocomplete "Vincular Freebet Origem" 🔥

> Implementação no FreeBet PRO: `FreebetReferenciaAutocomplete` em `src/pages/PainelDeEnvios.jsx:4113+`. Esta seção é a referência pra vocês replicarem.

### 3.1 Quando aparece

- O componente aparece **dentro do bloco laranja** assim que o usuário muda o modo do toggle pra **🔥 Queimar Freebet**.
- Foco automático no campo de busca.
- Lista os GANHAR_FB elegíveis sem precisar digitar nada (mostra todos disponíveis por padrão).

### 3.2 Endpoint que alimenta a lista (nosso lado, espelhado pro Shark)

```
GET /api/procedimentos-tarefas/freebets-pendentes
```

> Implementado em `server/routes/procedimentos.ts:404+`. Carregado via React Query com `staleTime: 60_000` no frontend (`PainelDeEnvios.jsx:4117-4124`). **Lista inteira é trazida de uma vez** (max 50 itens depois do filtro client-side).

Retorna os GANHAR_FB que cumprem **todos** os critérios:

1. `tipo = 'GANHAR_FB'`
2. `freebet_creditada = 'SIM'` (a FB foi efetivamente creditada na conta)
3. `freebet_valor > 0`
4. **Sem queimador concluído ainda** (`NOT EXISTS` outro proc com `procedimento_referencia = este.id` e status fechado)

**Resposta (array, cada item):**

```json
{
  "id": 359,
  "external_id": "bsk:ganhar-...",
  "numero": 359,
  "casa_aposta": "BETANO",
  "titulo": "Aposta sem risco",
  "partida_descricao": "Sao Paulo x Bahia",
  "data_partida": "2026-05-01",
  "horario_partida": "16:00",
  "freebet_valor": 20.00,
  "resultado_lucro": -3.00
}
```

### 3.3 UX da lista (renderização de cada item)

```
┌─────────────────────────────────────────────┐
│ 🎁 #359 — BETANO                            │
│    Sao Paulo x Bahia • 01/05 16:00          │
│    R$ 20,00     L/P origem: -R$ 3,00        │
└─────────────────────────────────────────────┘
```

- **Filtro client-side** por: número (`numero`), título, casa, partida (texto). Sem filtro por valor.
- **Sem debounce** — filtro é puramente em memória sobre o array já carregado, então é instantâneo.
- Rodapé mostra contagem total (ex: "Mostrando 5 de 12 disponíveis") quando há filtro aplicado.
- Ao selecionar: preenche `procedimento_referencia` (id interno) e copia o `freebet_valor` da origem pro campo "Valor da Freebet" (usuário pode editar).

### 3.4 Validação

> ⚠ **Status no FreeBet PRO hoje:** o backend (`integracoesBetshark.ts`) **não rejeita** QUEIMAR_FB sem `procedimento_referencia` — fica como QUEIMAR_FB órfão (status `REFERENCIA_FALTANDO` na coluna STATUS). O frontend também não trava o submit. **Recomendação pra paridade no Shark:** validar client-side e bloquear, evitando criar procedimentos órfãos.

- Recomendado bloquear o botão "Salvar" enquanto `procedimento_referencia` estiver vazio.
- Mensagem clara: "Selecione a Freebet origem que está sendo queimada."
- Estado vazio (sem nenhuma FB disponível): mostrar callout amigável — "Nenhuma freebet disponível pra queimar. Crie um procedimento Ganhar Freebet primeiro."

### 3.5 Edge cases

| Cenário | Comportamento esperado |
|---|---|
| Usuário deleta o GANHAR_FB origem **antes** de mandar o QUEIMAR_FB | A FB some da lista do autocomplete (filtro `NOT EXISTS` pega isso). |
| Usuário deleta o GANHAR_FB **depois** que o QUEIMAR_FB foi criado | O backend bloqueia o DELETE com `409 HAS_DEPENDENT_REFERENCES` — vocês devem espelhar isso na UI. |
| 2 queimadores apontando pra mesma origem | Permitido tecnicamente (só conta como "queimada" quando o primeiro fecha com lucro). UX: mostrar `disponiveis: 0` no badge depois da primeira queima. |

---

## 4. `deduzirTipoFB()` — o backend "corrige" o tipo

> ⚠ **Regra crítica:** o backend do FreeBet PRO **ignora o `tipo` mandado** se houver sinais cruzados. A lógica está em `server/routes/integracoesBetshark.ts:271-282`.

### 4.1 As regras

```
Se tem `external_referencia_id` (resolvido pra `procedimento_referencia`):
  → força tipo = QUEIMAR_FB
Senão se `freebet_valor > 0`:
  → força tipo = GANHAR_FB
Senão:
  → mantém o tipo enviado (default NORMAL)
```

### 4.2 Por quê?

Histórico: do lado do FreeBet PRO, o checkbox manual de "tipo" no modal era fonte de erro frequente. O usuário marcava NORMAL mas digitava `freebet_valor=50` — o card ficava como "normal com FB", quebrando a aba FreeBets Ganhas. A regra "nunca confiar só no checkbox" virou padrão.

### 4.3 Implicação pro Shark

**Vocês podem mandar `tipo=NORMAL` mesmo em procedimento com FB — o backend corrige.** Mas pra debugging ficar fácil, **mandem o tipo certo**. Se a regra do `deduzirTipoFB` divergir do que vocês esperam, o frontend de vocês vai mostrar uma coisa e o FreeBet outra.

### 4.4 Tabela de "como o backend interpreta"

| Você manda | + tem `freebet_valor>0`? | + tem `external_referencia_id`? | Resultado no FreeBet |
|---|:---:|:---:|---|
| `NORMAL` | Não | Não | `NORMAL` ✓ |
| `NORMAL` | Sim | Não | `GANHAR_FB` (sobrescrito) |
| `NORMAL` | (qualquer) | Sim | `QUEIMAR_FB` (sobrescrito) |
| `GANHAR_FB` | Sim | Não | `GANHAR_FB` ✓ |
| `GANHAR_FB` | Não | Não | `NORMAL` (sobrescrito) |
| `GANHAR_FB` | (qualquer) | Sim | `QUEIMAR_FB` (sobrescrito) |
| `QUEIMAR_FB` | Sim | Sim | `QUEIMAR_FB` ✓ |
| `QUEIMAR_FB` | Sim | Não | `GANHAR_FB` (sobrescrito — sem ref, não é queima!) |
| `SEM_FB` | (qualquer) | Não | `NORMAL` (alias) |

---

## 5. Cascade FB — o "auto-fechar origem"

Implementado em `server/routes/procedimentos.ts:1510-1542` — **dentro do handler de `PATCH /api/procedimentos-tarefas/:id`** (rota geral de update do procedimento, usada pelo modal de **Editar Procedimento**).

> ⚠ **Importante:** o cascade NÃO dispara via `PATCH /:id/resultado` (rota usada pelo modal Definir Resultados — vide doc 06). Ele dispara apenas no PATCH geral, quando o admin edita o procedimento via modal de Editar e muda manualmente o `status_operacao` para `CONCLUIDO`/`LUCRO_DIRETO`. Se vocês quiserem cascade também a partir de "Definir Resultados", precisam reproduzir a lógica nas duas rotas — ou consolidar tudo numa rota só.

**Disparo (no PATCH geral):** procedimento `QUEIMAR_FB` que muda de status pra `CONCLUIDO` ou `LUCRO_DIRETO`, **com `lucro_prejuizo` preenchido**.

**Ação:** o backend busca o procedimento de origem (via `procedimento_referencia` ID interno) e:

- Se a origem está em `FREEBET_PENDENTE`, atualiza pra `CONCLUIDO`.
- Salva o `status_operacao_anterior` pra permitir Undo.
- Retorna `cascadeUpdated: { id, oldStatus, newStatus, row }` no JSON da resposta — o frontend usa isso pra exibir um **toast** "Cadeia FB fechada: #N (FREEBET_PENDENTE → CONCLUIDO) — Desfazer" com 10s de duração.
- O Desfazer chama `POST /api/procedimentos-tarefas/:origemId/restaurar-status` (`server/routes/procedimentos.ts:1556+`) — reverte a origem pro `status_operacao_anterior`.

**Por que exigir `lucro_prejuizo` preenchido:** evita auto-fechar a origem antes do usuário registrar o resultado real da queima. Sem L/P, o ciclo fica em "queimando" — vide doc 04.

### Implicação pro Shark

Se vocês também sincronizam o status_operacao do queimador via `PATCH`, lembrem que **o FreeBet vai fechar a origem sozinho**. Não tentem fechar manualmente também — vai gerar conflito de updated_at e logs duplicados.

---

## 6. Erros comuns e como evitar

| Erro | Causa | Como prevenir |
|---|---|---|
| `422 UNRESOLVED_REFERENCE` | `external_referencia_id` aponta pra UUID que não existe na tabela. | **Usar autocomplete** (§3) — impede o usuário de digitar UUID errado. Garantir também que o GANHAR_FB foi enviado **antes** do QUEIMAR_FB. |
| Procedimento "ganha FB" mas não aparece em FreeBets Ganhas | Vocês esqueceram de definir `freebet_creditada=SIM` no resultado. | Implementar a tela de resultado (vide doc 06). |
| Origem nunca fecha | Queimador foi criado sem `external_referencia_id` (ficou solto) ou `lucro_prejuizo` ficou vazio. | Validar client-side antes de mandar: queima exige ambos. |
| `tipo` aparece diferente entre Shark e FreeBet | `deduzirTipoFB` sobrescreveu. | Conferir as regras do §4 acima. |
| Lista do autocomplete vazia mesmo tendo FB ganha | `freebet_creditada` ficou `NAO`/`AGUARDANDO`. | Verificar fluxo do Definir Resultados — só `SIM` libera. |

---

## 7. Checklist de implementação (Shark)

- [ ] Modal de Novo Procedimento tem 3 botões/radio claros: **Normal**, **Ganhar FB**, **Queimar FB**.
- [ ] **(Bloqueante §3)** Quando "Queimar FB" é selecionado, aparece **autocomplete obrigatório** "Vincular Freebet Origem" — busca entre os GANHAR_FB com `freebet_creditada=SIM` que ainda não foram queimados. Cada item mostra: `🎁 #N — Casa — Partida — R$ valor — L/P origem`.
- [ ] Endpoint backend equivalente ao nosso `GET /api/freebets/pendentes` no lado do Shark, com filtros `tipo=GANHAR_FB`, `freebet_creditada=SIM`, `NOT EXISTS queimador concluído`.
- [ ] Auto-preencher campo "Valor da Freebet" com o valor da origem ao selecionar (usuário pode editar).
- [ ] Validação client-side: queima sem ref **bloqueia o salvar**, mensagem clara.
- [ ] Estado vazio amigável: "Nenhuma freebet disponível pra queimar. Crie um procedimento Ganhar Freebet primeiro."
- [ ] No payload, `external_referencia_id` recebe o `external_id` do GANHAR_FB selecionado (não o id interno).
- [ ] Garantir ordem de envio: GANHAR_FB sempre antes do QUEIMAR_FB que o referencia.
- [ ] Tela de resultado permite marcar `freebet_creditada` como SIM/NAO/AGUARDANDO (vide doc 06).
- [ ] Tela de resultado do QUEIMAR_FB exige `lucro_prejuizo` preenchido pra auto-fechar a origem.
- [ ] Implementar `deduzirTipoFB` espelhada do lado de vocês também — pra não exibir "Normal" e mandar "GANHAR_FB" pro FreeBet.
- [ ] Bloquear DELETE de GANHAR_FB com queimador apontando pra ele (`409 HAS_DEPENDENT_REFERENCES`).

---

## 8. Próximo doc

**[04 — Aba "FreeBets Ganhas"](./04-aba-freebets-ganhas.md)**
