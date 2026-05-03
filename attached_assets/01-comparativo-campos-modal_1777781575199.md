# 01 — Comparativo de campos do modal

> **Objetivo:** Listar todos os campos do modal "Novo Procedimento" do FreeBet PRO (`src/pages/PainelDeEnvios.jsx` → `ProcedimentoForm`) e comparar com o que o BetShark Pro **já envia hoje** no payload de teste, apontando os gaps. Esta versão inclui **comparação visual** dos modais (prints reais).

---

## 0. Comparação visual — lado a lado

### 0.1 Modo "Ganhar Freebet"

| BetShark Pro (hoje) | FreeBet PRO |
|---|---|
| ![Modal Shark Ganhar FB](./prints/modal-shark-ganhar-fb.png) | ![Modal FreeBet PRO Ganhar FB](./prints/modal-freebetpro-ganhar-fb.png) |

**3 diferenças visíveis:**
1. **Esporte:** Shark assume futebol implícito; nosso tem dropdown explícito (`Futebol / Basquete / Tênis / ...`).
2. **Data + Hora:** Shark usa 2 campos separados; nosso usa 1 campo único `dd/mm/aaaa --:--`.
3. **Evento/Partida:** Shark é texto livre; nosso tem **autocomplete real** (lupa que busca em `/api/partidas/sugestoes?q=...` — endpoint do nosso backend que proxia API-Football, captura `fixture_id` + `kickoff_at`). Vide doc 02.

### 0.2 Modo "Queimar Freebet" — gap mais crítico 🔥

| BetShark Pro (hoje) | FreeBet PRO |
|---|---|
| ![Modal Shark Queimar FB](./prints/modal-shark-queimar-fb.png) | ![Modal FreeBet PRO Queimar FB](./prints/modal-freebetpro-queimar-fb.png) |

**Gap gritante:** o campo "Referência Freebet" do Shark é **texto livre** ("Nº do procedimento que gerou a FB") — o usuário precisa decorar/colar o número da FB ganha. No nosso, o campo "Vincular Freebet Origem" é um **autocomplete real** que lista as FBs disponíveis pra queima:

```
🎁 #359 — BETANO — Sao Paulo x Bahia — R$ 20,00
       L/P origem: -R$ 3,00  •  1 disponível
```

**Por que isso é bloqueante:** sem essa lista visual, o usuário Shark corre 3 riscos concretos:

1. **Erra o número** e quebra o `external_referencia_id` → o backend FreeBet devolve `422 UNRESOLVED_REFERENCE` e o procedimento nem é criado.
2. **Tenta queimar uma FB que já foi queimada** (não tem visibilidade do estado).
3. **Não sabe quais FBs estão disponíveis** — depende de abrir outra aba/relatório pra consultar.

Vide doc 03 §3 pra spec do autocomplete.

---

## 1. Os 17 campos que o Shark já manda hoje

Visto no log do POST de homologação (`req_MOP7LMHC11KR4Z5Z69FK`, dia 03/05/2026):

```
external_id, titulo, casa_aposta, categoria, prioridade, tipo,
data_partida, horario_partida, partida_descricao,
lucro_prejuizo_previsto, freebet_valor_previsto,
dp, descricao_promocao, link_promocao, link_telegram,
external_referencia_id, arquivado
```

Esses 17 campos cobrem o **núcleo** do modal. Os 4 nomes em itálico (`lucro_prejuizo_previsto`, `freebet_valor_previsto`, `external_referencia_id`, `arquivado`) são aliases que o normalizador do FreeBet PRO já converte automaticamente — **nenhuma mudança necessária do lado do Shark** nesses 4.

---

## 2. Tabela completa — modal FreeBet PRO × payload Shark

| # | Seção (modal) | Label visível | Campo no payload Shark | Tipo / formato | Obrigatório? | Status |
|---|---|---|---|---|:---:|:---:|
| 1 | Identificação | Nº Procedimento | *(gerado pelo backend FreeBet)* | inteiro | — | ⚙ Backend |
| 2 | Identificação | Plataforma (casa) | `casa_aposta` | string 1..80 | **Sim** | ✅ Já manda |
| 3 | Promoção | Nome da Promoção | `titulo` | string 1..200 | **Sim** | ✅ Já manda |
| 4 | Promoção | Categoria | `categoria` | enum¹ | Recomendado | ✅ Já manda |
| 5 | Promoção | Status | `status_operacao` *(não exposto)* | enum² | — | ⚙ Sempre `ENVIADO` na criação |
| 6 | Jogo / Evento | Esporte | `esporte` | string, default `FUTEBOL` | Não | ⚠ **Não envia** (assume FUTEBOL) — vide §0.1 |
| 7 | Jogo / Evento | Data e Hora | `data_partida` + `horario_partida` | `YYYY-MM-DD` + `HH:MM` (BRT) | Não | ✅ Já manda (em 2 campos — nosso usa 1 campo unificado, vide §0.1) |
| 8 | Jogo / Evento | Data e Hora (precisão UTC) | `kickoff_at` | ISO 8601 com offset | Não | ❌ **Falta** — habilita ordenação por horário e alertas "começa em breve" / "ao vivo agora" |
| 9 | Jogo / Evento | Evento / Partida (texto livre) | `partida_descricao` | string até 200 | Não | ✅ Já manda como texto livre |
| 10 | Jogo / Evento | Evento / Partida (vinculado por autocomplete) | `fixture_id` | inteiro positivo | Não | ❌ **Falta** — habilita opt-in 🔔 (2 gols de vantagem), badge AO VIVO, filtro de jogo encerrado. **Vide doc 02** |
| 11 | Promoção | Banner / imagens | `imagens_banner` | array de URLs (até 5) | Não | ⚠ **Não envia** |
| 12 | Promoção | Descrição | `descricao_promocao` | text até 5000 | Não | ✅ Já manda |
| 13 | Promoção | Link da promoção | `link_promocao` | URL http/https | Não | ✅ Já manda |
| 14 | Resultado | Lucro/Prejuízo previsto | `lucro_prejuizo_previsto` (alias de `lucro_prejuizo`) | decimal string | Não | ✅ Já manda |
| 15 | Resultado | Cenário B (perda do hedge) | `cenario_b_cash` | decimal | Não | ❌ **Falta** — usado pra calcular lucro líquido do ciclo FB |
| 16 | Resultado | Link Telegram | `link_telegram` | URL | Não | ✅ Já manda |
| 17 | Freebet | Tipo (Normal / Ganhar FB / Queimar FB / Duplo) | `tipo` | enum³ | Não, default `NORMAL` | ✅ Já manda. ⚠ Backend pode sobrescrever via `deduzirTipoFB()` — **vide doc 03** |
| 18 | Freebet | FB esperada | `freebet_valor_previsto` (alias de `freebet_valor`) | decimal ≥ 0 | Só p/ GANHAR_FB / QUEIMAR_FB | ✅ Já manda |
| 19 | Freebet | Origem da FB (autocomplete) | `external_referencia_id` (alias de `procedimento_referencia_external_id`) | UUID | Só p/ QUEIMAR_FB | ✅ Já manda **mas sem UX de autocomplete** — vide §0.2 e doc 03 §3 |
| 20 | Freebet | Descrição (anotação livre) | `freebet_referencia` | string até 80 | Não | ⚠ **Não envia** — campo opcional pra notas tipo "código XYZ123, bônus boas-vindas" |
| 21 | Tags | Chance Duplo | `dp` | bool | Não | ✅ Já manda |
| 22 | Tags | Tachado | `tachado` | bool | Não | ⚠ **Provavelmente não envia** — se vocês não usam, ignorem |
| 23 | Tags | Etiquetas livres | `etiquetas` | array de strings | Não | ⚠ **Não envia** — opcional |
| 24 | Bandeira | Arquivar | `arquivado` (alias de `arquivar`) | bool | Não, default `false` | ✅ Já manda |
| 25 | Prioridade | Prioridade | `prioridade` | enum⁴, default `MEDIA` | Não | ✅ Já manda |

**Enums:**
1. `categoria`: `PROMOCAO` | `CASHBACK` | `FREEBET` | `SUPERODD` | `EXTRA` | `GIROS_GRATIS` | `DUPLO_GREEN`
2. `status_operacao` (gerenciado pelo backend FreeBet): `ENVIADO` | `PARTIDA_ABERTO` | `FREEBET_PENDENTE` | `REFERENCIA_FALTANDO` | `FALTA_GIRAR_FB` | `APOSTA_SEM_RISCO` | `CONCLUIDO` | `LUCRO_DIRETO`
3. `tipo`: `NORMAL` | `GANHAR_FB` | `QUEIMAR_FB` | `DUPLO`. Aceita também `SEM_FB` (alias → `NORMAL`).
4. `prioridade`: `ALTA` | `MEDIA` | `BAIXA`

---

## 3. Resumo dos gaps

### Gaps **bloqueantes de UX** (impacto direto no usuário do Shark)

| Gap | Impacto se não implementar |
|---|---|
| **Autocomplete "Origem da FB" no modo Queimar** (§0.2) | Risco alto de `422 UNRESOLVED_REFERENCE`. Usuário tem que decorar nº da FB e não vê quais estão disponíveis. **Mais crítico do pacote.** |
| **Autocomplete de Evento/Partida com `fixture_id`** (§0.1, doc 02) | Sem opt-in 🔔 (alerta de 2 gols de vantagem no Telegram). Sem badge "AO VIVO" no card. Sem filtro de jogo encerrado. Sem `kickoff_at` derivado. |

### Gaps **menores** (recomendados, mas não bloqueiam nada)

| Gap | Impacto |
|---|---|
| `kickoff_at` (se não vier do autocomplete) | Sem ordenação cronológica precisa. Sem alertas "começa em breve" e "ao vivo agora". |
| `esporte` | Default `FUTEBOL`. Se o Shark cobrir basquete/tênis, mandar evita exibir esporte errado no card. |
| `cenario_b_cash` | Sem ele, o "lucro líquido do ciclo FB" da aba FreeBets Ganhas conta só a etapa 1 (ganhar) — não soma a perda do hedge. **Vide doc 04.** |
| `freebet_referencia` | Anotação livre opcional ("código XYZ123") — só cosmético na lista. |
| `imagens_banner` | Card aparece sem banner visual; cosmético. |

### Gaps **opcionais**

- `tachado`, `etiquetas`: cosméticos. Mandar se já existir do lado de vocês; ignorar caso contrário.

---

## 4. Checklist de implementação (Shark)

Marquem conforme avançam:

- [ ] **(Bloqueante)** Substituir o campo texto "Referência Freebet" por autocomplete real listando GANHAR_FBs com FB creditada e ainda não queimadas. Vide doc 03 §3 pra spec do endpoint.
- [ ] **(Bloqueante)** Implementar autocomplete de eventos no modal usando API-Football (vide doc 02) e capturar `fixture_id` quando o usuário selecionar uma sugestão.
- [ ] Validar que os 17 campos atuais continuam sendo enviados sem regressão (smoke `POST /procedimentos` retorna 201).
- [ ] Adicionar `kickoff_at` (ISO 8601 UTC, ex: `"2026-05-10T19:00:00Z"`) sempre que `data_partida` + `horario_partida` estiverem preenchidos.
- [ ] Mandar `esporte` explicitamente (não confiar no default).
- [ ] Mandar `cenario_b_cash` quando o tipo for `GANHAR_FB`/`DUPLO` e existir hedge previsto.
- [ ] Mandar `freebet_referencia` (descrição livre) se vocês têm campo equivalente.
- [ ] (Opcional) Mandar `imagens_banner` se vocês têm CDN com banners.
- [ ] (Opcional) Mandar `tachado` / `etiquetas` se forem usar.

---

## 5. Referências cruzadas

- Spec completa do contrato: `docs/integracoes/betshark-pro/02-spec-endpoint-integracao.md`
- **Doc 02** — autocomplete de eventos: `02-guia-api-football.md`
- **Doc 03** — lógica e autocomplete da origem FB: `03-logica-ganhar-queimar-fb.md`
- **Doc 04** — aba FreeBets Ganhas: `04-aba-freebets-ganhas.md`
- **Doc 05** — lista de procedimentos (13 colunas): `05-lista-procedimentos.md`
- **Doc 06** — modal Definir Resultados: `06-modal-definir-resultados.md`
