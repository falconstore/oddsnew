# 05 — Lista de Procedimentos (13 colunas)

> **Objetivo:** Documentar a tabela "Lista de Procedimentos" do FreeBet PRO (`src/pages/PainelDeEnvios.jsx`, modo "Lista") pra que o BetShark Pro espelhe a mesma estrutura visual no painel de envios. **13 colunas fixas + barra de ação por linha.**

---

## 0. Print de referência

![Lista de Procedimentos FreeBet PRO](./prints/lista-procedimentos-freebetpro.png)

Comparativo com o lado do Shark hoje:

![Lista de Procedimentos Shark](./prints/lista-procedimentos-shark.png)

**Diferenças principais:**

| Aspecto | Shark | FreeBet PRO |
|---|---|---|
| Total de colunas | (varia) | **13 fixas** |
| Coluna `STATUS` | Texto livre / não derivado | Derivado automaticamente do conjunto (`tipo`, `freebet_creditada`, `lucro_prejuizo`, `procedimento_referencia`) |
| Coluna `REF. FB` | Não existe | Mostra o link com a FB origem (ex: `#356 R$20`) ou `—` |
| Separação `GANHAR FREEBET` × `L/P` | Junto numa coluna só | **Duas colunas distintas** |
| Toggle Lista ↔ FreeBets Ganhas (topo) | Não tem | Sim — `📋 Lista` × `🎁 FreeBets Ganhas` |

---

## 1. As 13 colunas (esquerda → direita)

| # | Coluna | Conteúdo | Origem do dado |
|---|---|---|---|
| 1 | **DATA CRIAÇÃO** | `dd/mm/aa` (sem hora) | `created_at` (formatada client-side em BRT) |
| 2 | **Nº** | Número sequencial do procedimento | `numero` (gerado pelo backend) |
| 3 | **PLATAFORMA** | Casa de aposta — nome em maiúsculas, fonte mono | `casa_aposta` |
| 4 | **PROMOÇÃO** | Título da promoção — text-truncate em ~30 chars | `titulo` |
| 5 | **EVENTO** | Linha 1: nome da partida (`partida_descricao` ou nome do evento). Linha 2: badge "EM BREVE / AO VIVO / ENCERRADO" + data/hora `dd/mm HH:MM` | `partida_descricao` + `data_partida` + `horario_partida` + status derivado de `kickoff_at` |
| 6 | **CATEGORIA** | Pill colorida com label: `Promoção`, `Freebet`, `Cashback`, `SuperOdd`, `Extra`, `Giros Grátis`, `Duplo Green` | `categoria` (enum, vide doc 01) |
| 7 | **STATUS** | Pill colorida com status derivado (lista no §2 abaixo) **+ 2 botões inline à direita: ⏳ Tachar e ↻ Reenviar** (vide §2.5) | Calculado client-side a partir de vários campos |
| 8 | **REF. FB** | Se for QUEIMAR_FB com origem vinculada: `#N R$valor` clicável (badge purple). Senão: `—` | `procedimento_referencia` (id interno) → resolvido pro `numero` + `freebet_valor` da origem |
| 9 | **GANHAR FREEBET** | Valor monetário em verde (ex: `R$ 20,00`) ou `—` | `freebet_valor` (preenchido em GANHAR_FB e QUEIMAR_FB) |
| 10 | **L/P** | Valor com sinal e cor: positivo = verde com `+`, negativo = vermelho com `-`, zero = cinza (empate). Ícone de status à direita. | `resultado_lucro` (se definido) ou `lucro_prejuizo` (esperado) |
| 11 | **TAGS** | Pills de tags personalizadas + flag "Chance Duplo" + "DG" se confirmado. Truncado com `...` se passar do espaço. | `etiquetas[]` + `dp` + `duplo_green_confirmado` |
| 12 | **LINK** | Ícone de link externo clicável → abre `link_telegram` ou `link_promocao` em nova aba. Cinza se vazio. | `link_telegram` || `link_promocao` |
| 13 | **AÇÕES** | Botão "Definir resultado" (✓ verde) — só aparece se houver expectativa cadastrada e status não decidido. Menu kebab (⋮) com Editar / Duplicar / Arquivar / Excluir. Contador `0/273` indicando ranking interno (deslocamento da ordenação). | Lógica de exibição — vide doc 06 §6 (regra do "Definir resultado") |

> **Cabeçalho fixo da tabela:** todas as 13 colunas têm header sticky no topo, fonte 10px uppercase tracking-wide, cor `#596773`.

---

## 2. Os 8 status derivados (coluna 7)

A pill da coluna `STATUS` é **calculada client-side** combinando `tipo`, `status_operacao`, `freebet_creditada`, `lucro_prejuizo`, `procedimento_referencia`. Mesmo quando o backend devolve `status_operacao=ENVIADO`, o frontend deriva uma label mais descritiva:

| Status visível | Quando aparece | Cor da pill |
|---|---|---|
| **Enviado** | Default — `status_operacao=ENVIADO` e nada mais foi preenchido. | Cinza |
| **Partida Aberto** | `kickoff_at` no passado e ainda sem resultado definido. | Amarelo |
| **Aposta Sem Risco** | `tipo=NORMAL` ou `GANHAR_FB` com `lucro_prejuizo_previsto >= 0` (cobertura garantida). | Azul |
| **Falta Girar Freebet** | `tipo=GANHAR_FB` + `freebet_creditada=SIM` + nenhum queimador apontando pra ele ainda. | Laranja com chama 🔥 |
| **Freebet Pendente** | `tipo=GANHAR_FB` + `freebet_creditada=AGUARDANDO` ou ainda sem resultado. | Amarelo escuro |
| **Lucro Direto** | `tipo=QUEIMAR_FB` com `resultado_lucro > 0` (queima fechou no positivo). | Verde |
| **Concluído** | `status_operacao=CONCLUIDO` (cascade FB ou ação manual). | Verde escuro |
| **Referência Faltando** | `tipo=QUEIMAR_FB` sem `procedimento_referencia` (estado de erro). | Vermelho |

> **No print:** a linha `#359 BETANO` mostra `Falta Girar Freebet` (ganhou FB e ainda não usou); `#357 BET365 Freebet` mostra `Lucro Direto` (queimou e fechou positivo); `#356 BET365 APOSTE E GANHE` mostra `Falta Girar Freebet`.

---

## 2.5. Botões inline na coluna STATUS — **Tachar** + **Reenviar** 🔥

Cada linha tem **2 botões pequenos à direita do pill de status** (vide prints abaixo). São ações de admin que **propagam IMEDIATAMENTE pra todos os clientes PRO** que estão olhando a página `Procedimentos PRO`.

| Print da coluna inteira | Zoom nos 2 botões |
|---|---|
| ![Linha completa STATUS + botões](./prints/lista-status-acoes-linha.png) | ![Zoom Tachar + Reenviar](./prints/lista-status-acoes-zoom.png) |

### Botão 1 — ⏳ Tachar (`TachadoToggle` em `PainelDeEnvios.jsx:184-211`)

**Estado inativo:** ícone ampulheta cinza com borda fina, hover destaca.
**Estado ativo:** pill cinza preenchido `bg-zinc-700`, ícone + texto "Passou" com `line-through`.

**Persistência:** `tachado: true | false` (bool no procedimento).

**O que acontece quando o admin clica e marca:**

| Lugar | Efeito visual |
|---|---|
| **Painel do Shark (lista de envios)** | A linha ganha `opacity-50 grayscale` — fica visivelmente apagada/cinza, sem cor semântica. Continua na lista (não some). |
| **Procedimentos PRO (cliente PRO)** | O card do cliente também ganha `opacity-60 grayscale`, título com `line-through text-slate-400`, e ganha um badge cinza `⏳ Passou` (`ProcedimentosPRO.jsx:2541-2545`). Tarja superior do card vira `from-zinc-800/40 ...`. |
| **Filtros do PRO** | Por default os tachados ficam **visíveis** (mas apagados). O cliente pode esconder com filtro "Mostrar tachados: off". |

**Tooltip (admin):**
- Inativo: "Tachar — marca como passado. Quem pegou, pegou. Continua visível mas inativo no PRO."
- Ativo: "Tachado — marcado como passou da hora. Clique pra destachar."

**Quando usar (semântica):** o procedimento "passou da hora". Não é erro nem sucesso, é **timing perdido** — quem pegou pegou, quem não pegou já era. Cor neutra (cinza) reforça isso.

---

### Botão 2 — ↻ Reenviar (`ReenviadoToggle` em `PainelDeEnvios.jsx:225-310`)

**Estado inativo:** ícone refresh cinza com borda fina, hover laranja.
**Estado ativo:** pill laranja `bg-orange-500/20 text-orange-200` + (se `count > 1`) número "Nx".

**Persistência:**
- `reenviado_em: timestamp ISO` — quando foi marcado a 1ª vez (ou a última, se desmarcou e remarcou).
- `reenviado_count: integer` — quantas vezes foi reenviado (incrementa via menu lateral, não pelo clique simples).

**O que acontece quando o admin clica e marca:**

| Lugar | Efeito visual |
|---|---|
| **Painel do Shark (lista de envios)** | Pill laranja na coluna STATUS. Tooltip mostra "Reenviado em DD/MM HH:MM (Nx)". |
| **Procedimentos PRO — cliente que JÁ marcou "Feito"** | Badge laranja **piscante** (`animate-pulse`) `↻ Reenviado — revise` (`ProcedimentosPRO.jsx:2546-2551`). Tooltip: "Reenviado em DD/MM HH:MM depois que você fez". |
| **Procedimentos PRO — cliente que NÃO marcou Feito ainda** | Badge azul claro `↻ Reenviado DD/MM HH:MM` informativo, sem pulse (`ProcedimentosPRO.jsx:2552-2557`). |

**Tooltips (admin):**
- Inativo: "Marcar como reenviado — avisa no PRO quem já marcou Feito que houve atualização."
- Ativo: "Reenviado em DD/MM HH:MM (Nx). Click: desmarcar. Use o menu pra registrar nova atualização."

**Menu lateral (⋮ aparece só quando ativo):**
- "Marcar nova atualização" → incrementa `reenviado_count` e atualiza `reenviado_em` pro now (sem desmarcar).
- "Limpar reenvio" → seta `reenviado_em=null`, `reenviado_count=0`.

**UX importante (Task #484):** clique simples = **toggle real** (marca/desmarca). Pra registrar uma 2ª/3ª atualização sem desmarcar, é OBRIGATÓRIO usar o menu lateral. Antes o clique simples sempre incrementava e a única forma de desmarcar era Shift+Clique — comportamento não-descobrível.

**Quando usar (semântica):** o admin atualizou o procedimento depois de já ter publicado (mudou odds, corrigiu link, ajustou valor). O badge piscante avisa **quem já marcou Feito** que precisa revisar — não altera métricas, o histórico de Operações fica intacto.

---

### Por que esses 2 botões ficam INLINE na coluna STATUS (e não no menu kebab AÇÕES)

São as 2 ações **mais frequentes** do admin — usadas várias vezes por dia em todos os procedimentos. Esconder no menu kebab adicionaria 1 click extra cada. Por isso ficam direto na coluna, em modo `iconOnly` (só ícone visível, texto vai pro tooltip pra economizar largura).

---

### Spec do payload (Shark → backend FreeBet)

Cada ação tem **endpoint dedicado** (não usa o PATCH geral `/:id`):

```http
# Tachar / destachar
PATCH /api/procedimentos-tarefas/:id/tachado
Body: { "tachado": true }   // ou false

# Reenviar (1ª vez ou retoggle)
PATCH /api/procedimentos-tarefas/:id/reenviado
Body: { "reenviado_em": "2026-05-03T14:32:18-03:00", "reenviado_count": 1 }

# Marcar nova atualização (incrementa contador via menu lateral ⋮)
PATCH /api/procedimentos-tarefas/:id/reenviado
Body: { "reenviado_em": "2026-05-03T18:05:00-03:00", "reenviado_count": 2 }

# Limpar reenvio (menu lateral ⋮ → "Limpar reenvio")
PATCH /api/procedimentos-tarefas/:id/reenviado
Body: { "reenviado_em": null, "reenviado_count": 0 }
```

> Implementação: `PainelDeEnvios.jsx:5443` (tachado) e `:5479` (reenviado).

---

## 3. Comportamentos da tabela

### 3.1 Ordenação

- Padrão: `created_at` decrescente (mais recente em cima).
- O **número do procedimento** (`numero`) também é decrescente — `#359` antes de `#357` antes de `#356`.
- Header das colunas é **clicável** pra reordenar (toggle asc/desc): `Nº`, `DATA CRIAÇÃO`, `EVENTO` (por `kickoff_at`), `L/P`.

### 3.2 Filtros (acima da tabela, não nas colunas)

- Pills de período (`Hoje`, `Esta semana`, `Este mês`, `Tudo`).
- Busca livre (busca em `casa_aposta`, `titulo`, `partida_descricao`).
- Filtro por status (multi-select dos 8 status).
- Filtro por categoria.
- Botão "Colunas" (canto direito) → permite ocultar colunas individualmente. **Configuração persiste em localStorage.**

### 3.3 Toggle Lista ↔ FreeBets Ganhas (canto superior direito)

- `📋 Lista` (ativo no print) — mostra todos os procedimentos.
- `🎁 FreeBets Ganhas` — abre a aba documentada no doc 04 (vista filtrada por ciclo da FB).

### 3.4 Linha clicável

- Click em qualquer célula (exceto o link externo e o menu de ações) **abre o modal de Editar** o procedimento.
- Hover destaca a linha com bg `#1D2125`.

### 3.5 Vazio / loading

- Loading: skeleton de 8 linhas.
- Vazio: ilustração + texto "Nenhum procedimento por aqui ainda. Cadastre o primeiro pra começar."

---

## 4. Regras de negócio embutidas na tabela

| Regra | Onde se manifesta |
|---|---|
| **Botão "Definir resultado" só aparece se há expectativa cadastrada** (`lucro_prejuizo_previsto`, `cenario_b_cash` ou `freebet_valor_previsto` ≥ 0) **e** o status não foi decidido por outra via. | Coluna AÇÕES, lógica em `temNumeroCadastrado()` em `PainelDeEnvios.jsx:698-702`. |
| **Pill `REF. FB` é clicável** — abre o modal do procedimento origem. | Coluna 8. |
| **GANHAR_FB que ainda não tem queimador** mostra `Falta Girar Freebet` mesmo se já tem L/P definido — é o estado "semente da cadeia FB". | Coluna 7. |
| **L/P é o realizado se existir, senão o esperado** — frontend mostra ambos com cores e símbolos diferentes. | Coluna 10. |

---

## 5. Checklist de implementação (Shark)

- [ ] Tabela com **13 colunas exatamente nessa ordem**.
- [ ] Header sticky no topo, fonte 10px uppercase tracking-wide.
- [ ] Coluna 7 (STATUS) **calculada client-side** segundo a tabela §2 — não confiar só em `status_operacao` do backend.
- [ ] **(Bloqueante §2.5)** Botão inline ⏳ **Tachar** ao lado do pill de status. Quando ativo: linha cinza/grayscale + propaga pro PRO do cliente como badge `Passou` + opacity-60 + line-through.
- [ ] **(Bloqueante §2.5)** Botão inline ↻ **Reenviar** ao lado do pill de status. Quando ativo: pill laranja + propaga pro PRO como badge piscante `↻ Reenviado — revise` (pra quem marcou Feito) ou badge azul informativo `↻ Reenviado DD/MM HH:MM` (pra quem não marcou ainda).
- [ ] Botão Reenviar tem menu lateral ⋮ (só quando ativo) com "Marcar nova atualização" (incrementa contador) e "Limpar reenvio".
- [ ] Persistir `tachado` (bool), `reenviado_em` (ISO timestamp) e `reenviado_count` (int) no procedimento.
- [ ] Coluna 8 (REF. FB) clicável → abre modal do procedimento origem.
- [ ] Colunas 9 (GANHAR FREEBET) e 10 (L/P) **separadas** — não juntar numa só.
- [ ] Coluna AÇÕES com botão "Definir resultado" condicional (vide regra do §4) + menu kebab.
- [ ] Toggle Lista ↔ FreeBets Ganhas no topo direito.
- [ ] Filtros pills + busca livre + filtro de colunas (persistência em localStorage).
- [ ] Linha clicável abre modal de Editar.
- [ ] Skeleton de loading e ilustração de vazio.

---

## 6. Próximo doc

**[06 — Modal "Definir Resultados"](./06-modal-definir-resultados.md)**
