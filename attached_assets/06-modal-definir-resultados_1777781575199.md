# 06 — Modal "Definir Resultados"

> **Objetivo:** Documentar o modal `Definir Resultados` do FreeBet PRO (`DefinirResultadosModal` em `src/pages/PainelDeEnvios.jsx:488-692`) que aparece ao clicar no botão "Definir resultado" da coluna AÇÕES (vide doc 05 §1 col. 13). **3 blocos coexistentes** — o usuário pode preencher A + B juntos (caso clássico do GANHAR_FB que rende cash + FB).

---

## 0. Print de referência

![Modal Definir Resultados](./prints/modal-definir-resultados.png)

> Print do modal aberto sobre o procedimento `#357` (que é QUEIMAR_FB referenciando #356, mas o modal **não muda visualmente em função do tipo** — sempre os mesmos 3 blocos).

---

## 1. Estrutura geral

```
╔═══════════════════════════════════════════╗
║ ✓ Definir resultados — #357           [×] ║
║ Informe o lucro/prejuízo em cash e/ou se  ║
║ ganhou uma FreeBet. Os 2 podem coexistir. ║
╠═══════════════════════════════════════════╣
║ ┌───────────────────────────────────────┐ ║
║ │ Ⓐ  LUCRO / PREJUÍZO  esperado:+R$14.00│ ║
║ │ [ 14                                 ]│ ║
║ │ Positivo=lucro · negativo=prejuízo... │ ║
║ └───────────────────────────────────────┘ ║
║ ┌───────────────────────────────────────┐ ║
║ │ Ⓑ  GANHAR FREEBET     Ganhei FB ☑    │ ║
║ │ Valor da FB ganha (R$)                │ ║
║ │ [ 20                                 ]│ ║
║ │ A freebet será registrada como REF #357│ ║
║ │ para queima futura.                    │ ║
║ └───────────────────────────────────────┘ ║
║ ┌───────────────────────────────────────┐ ║
║ │ 🎯 DUPLO GREEN         Confirmado ☐   │ ║
║ │ Marque se houve Duplo Green nesta op. │ ║
║ └───────────────────────────────────────┘ ║
║ Observação (opcional)                     ║
║ [ Ex: jogo cancelado, cashout antecipado ]║
╠═══════════════════════════════════════════╣
║                  [Cancelar] [✓ Salvar res]║
╚═══════════════════════════════════════════╝
```

- **Largura máxima:** `max-w-md` (~448px).
- **Cor de fundo:** `#22272B` (slate dark) com borda `#333C43`.
- **Header:** ícone check verde + título com nº do procedimento + descrição em cinza claro.
- **Footer:** botão Cancelar (ghost) + Salvar resultado (verde, `bg-emerald-600`).

---

## 2. Bloco A — LUCRO / PREJUÍZO (sempre visível)

| Item | Detalhe |
|---|---|
| Cor / borda | Verde esmeralda (`emerald-500/25`) |
| Selo | Bolinha "A" verde |
| Header direito | `esperado: +R$ 14,00` (só aparece se `lucro_prejuizo` previsto ≠ 0) |
| Input | `type=number step=0.01`, placeholder `Ex: 30,00 (negativo = prejuízo)` |
| Help | "Positivo = lucro · negativo = prejuízo · 0 = empate · em branco = não se aplica." |
| Pré-preenchimento | Se `resultado_lucro` já existe → usa; senão se `cenario_realizado=A` → `lucro_prejuizo`; senão `cenario_b_cash` se `B`; senão vazio. |
| Persistência | `resultado_lucro` (decimal). |

> **Nota:** "em branco" significa "não se aplica" — diferente de zero. Útil quando o procedimento foi cancelado e não houve operação.

---

## 3. Bloco B — GANHAR FREEBET (com toggle)

| Item | Detalhe |
|---|---|
| Cor / borda | Roxo (`purple-500/25`) |
| Selo | Bolinha "B" roxa |
| Header direito | Checkbox **"Ganhei FB"** |
| Estado pré-marcado | Se já tem `resultado_freebet_ganha > 0`, ou `cenario_realizado=B`, ou expectativa `freebet_valor > 0`. |
| Quando marcado | Mostra Label + Input numérico **"Valor da FB ganha (R$)"** + help: "A freebet será registrada como REF #N para queima futura." |
| Quando desmarcado | Mostra só help: "Marque acima se a operação rendeu uma FreeBet (independente do cash)." |
| Persistência | `resultado_freebet_ganha` (decimal) + **`freebet_creditada` é setado automaticamente** pelo handler: `SIM` se `valor > 0`, `NAO` caso contrário. Esse `SIM` é o que dispara o status "Falta Girar Freebet" e libera o item pro autocomplete da queima (vide doc 03 §3). |

---

## 4. Bloco DUPLO GREEN (com toggle)

| Item | Detalhe |
|---|---|
| Cor / borda | Âmbar (`amber-500/25`) |
| Selo | Emoji 🎯 |
| Header direito | Checkbox **"Confirmado"** |
| Quando marcado | Mostra Label + Input numérico **"Valor do lucro DG (R$) — opcional"**, placeholder `Ex: 45,00` |
| Quando desmarcado | Mostra só help: "Marque se houve Duplo Green nesta operação." |
| Persistência | `duplo_green_confirmado` (bool) + `duplo_green_lucro` (decimal nullable) |

---

## 5. Campo "Observação (opcional)"

- Textarea fora dos blocos, depois do DG.
- 2 linhas, max 500 chars (truncado client-side).
- Placeholder: `Ex: jogo cancelado, cashout antecipado...`
- Persistência: `resultado_observacao` (text).

---

## 6. Validação e submit

### 6.1 Botão "Salvar resultado" — habilitado quando

```
(lucro preenchido OU (Ganhei FB marcado E valor FB > 0))
  E (valor FB null OU valor FB >= 0)
```

> Ou seja: **pelo menos um dos dois cenários precisa ter valor**, e nenhum valor pode ser negativo no campo da FB.

### 6.2 Loading

- Botão Salvar mostra spinner `Loader2` durante o `await onSave(...)`.
- Botão Cancelar fica disabled durante o save.

### 6.3 Payload do PATCH

> Endpoint **dedicado**: `PATCH /api/procedimentos-tarefas/:id/resultado` (não é o PATCH geral `/:id`). Implementado em `server/routes/procedimentos.ts:2010+`. Frontend: `PainelDeEnvios.jsx:5571`.

```http
PATCH /api/procedimentos-tarefas/:id/resultado
Content-Type: application/json

{
  "resultado_lucro": 14.00,
  "resultado_freebet_ganha": 20.00,
  "freebet_creditada": "SIM",       // automático: "SIM" se ganha > 0, "NAO" senão
  "observacao": "...",              // null se vazio
  "duplo_green_confirmado": false,
  "duplo_green_lucro": null
}
```

**Resposta:** o procedimento atualizado (`proc` direto, sem wrapper). **Não retorna `cascadeUpdated`** — vide §7.2 abaixo.

---

## 7. O que acontece DEPOIS do save (lado FreeBet)

### 7.1 Caso GANHAR_FB com `freebet_creditada=SIM`

- Status do procedimento muda pra `FALTA_GIRAR_FB`.
- O item passa a aparecer no autocomplete "Vincular Freebet Origem" da próxima queima (doc 03 §3).
- Aparece na aba "FreeBets Ganhas" como `falta_girar` (doc 04).

### 7.2 Caso QUEIMAR_FB com `lucro_prejuizo` preenchido — atenção: cascade NÃO dispara aqui

> ⚠ **Detalhe sutil que o Shark precisa saber:** no FreeBet PRO **hoje**, o cascade FB (auto-fechar origem) **só dispara via `PATCH /api/procedimentos-tarefas/:id`** (rota geral, usada pelo modal de Editar Procedimento). O endpoint `/resultado` deste modal **não dispara cascade** — porque a lógica do `/resultado` está numa rota separada e não inclui o bloco de cascade (vide `server/routes/procedimentos.ts:2010+` vs `:1510+`).
>
> **Consequência:** se o usuário define resultado de um QUEIMAR_FB pelo modal Definir Resultados, a origem **não fecha sozinha**. Pra forçar o cascade, ele precisa abrir o modal de **Editar Procedimento** e mudar manualmente o `status_operacao` para `CONCLUIDO`/`LUCRO_DIRETO`.

**Quando o cascade SIM dispara (modal de Editar Procedimento):**

- A response do PATCH inclui `cascadeUpdated: { id, oldStatus, newStatus, row }`.
- **Frontend exibe toast** (10 segundos) com botão "Desfazer":

```
Cadeia FB fechada: #356 (FREEBET_PENDENTE → CONCLUIDO)
                                              [Desfazer]
```

- O Desfazer chama `POST /api/procedimentos-tarefas/:origemId/restaurar-status` e reverte usando `status_operacao_anterior`.
- Implementado em `src/pages/PainelDeEnvios.jsx:5363-5378` (toast) e `:5676` (mutation Desfazer).

**Recomendação pro Shark:** consolidar a lógica de cascade FB num lugar só (recomendado: também no `/resultado`) pra evitar que o ciclo da FB fique em estado intermediário dependendo de qual modal o admin usou.

### 7.3 Quando o procedimento é QUEIMAR_FB com origem vinculada

> ⚠ **IMPORTANTE — alinhamento de expectativa:** o modal Definir Resultados **NÃO mostra um bloco específico exibindo a FB origem que está sendo queimada**. Ele tem sempre os mesmos 3 blocos (A + B + DG).
>
> O vínculo com a FB origem aparece em **outros 3 lugares** da UI:
>
> 1. **Card / linha do procedimento na lista** — badge clicável `🔗 Cadeia #356` ao lado do título (`PainelDeEnvios.jsx:2831-2840`).
> 2. **Coluna `REF. FB` da tabela** — pill `#356 R$20` (vide doc 05 §1 col. 8).
> 3. **Modal de EDITAR procedimento** (não confundir com Definir Resultados!) — no modo QUEIMAR, o autocomplete "Vincular Freebet Origem" mostra a FB já vinculada (vide doc 03 §3).
>
> Se o lado do Shark quiser **adicionar** um 4º bloco no modal Definir Resultados mostrando a FB origem (ex: card laranja "🔥 Você está queimando a FB #356 R$20.00 — BET365 — Sao Paulo x Bahia"), é uma melhoria de UX legítima e não conflita com o backend — mas hoje **isso não existe nem do nosso lado**. Espelhem como está se quiserem paridade visual; adicionem se quiserem ir além.

---

## 8. Regra de exibição do botão "Definir resultado" (gatilho)

> Implementação: `temNumeroCadastrado()` em `PainelDeEnvios.jsx:698-702`.

O botão **só aparece** na linha (coluna AÇÕES) se:

- Pelo menos um dos campos `lucro_prejuizo`, `cenario_b_cash`, `freebet_valor` foi de fato cadastrado (não null/undefined/whitespace).
- E o `status_operacao` ainda não está em estado terminal (`CONCLUIDO`, `LUCRO_DIRETO`).

**Por quê:** sem expectativa cadastrada, não dá pra calcular o "esperado vs realizado". O botão sumiria em procedimentos puramente informativos.

---

## 9. Edge cases e detalhes finos

| Cenário | Comportamento |
|---|---|
| Usuário abre modal de procedimento já com resultado salvo | Pré-preenche tudo (`resultado_lucro`, `resultado_freebet_ganha`, observação, DG) — modo edição. |
| Usuário marca "Ganhei FB" e digita 0 | Botão salvar fica disabled. Valor da FB tem que ser > 0. |
| Usuário desmarca "Ganhei FB" depois de digitar valor | Estado limpa: `setFbStr('')`. |
| Usuário desmarca "Confirmado" do DG depois de digitar lucro | Estado limpa: `setDgLucroStr('')`. |
| Backend retorna erro no save | Toast vermelho, modal fica aberto, valores preservados. |
| `lucro_prejuizo` esperado é exatamente 0 | Header direito do bloco A não mostra nada (esconder o "esperado" pra não confundir). |

---

## 10. Checklist de implementação (Shark)

- [ ] Modal com **título "Definir resultados — #N"** + descrição "Informe o lucro/prejuízo em cash e/ou se ganhou uma FreeBet. Os 2 podem coexistir."
- [ ] **Bloco A** Lucro/Prejuízo sempre visível, com `esperado:` no header se houver.
- [ ] **Bloco B** Ganhar Freebet com toggle "Ganhei FB" → mostra/esconde input de valor.
- [ ] **Bloco DG** Duplo Green com toggle "Confirmado" → mostra/esconde input de valor opcional.
- [ ] Campo Observação (textarea, max 500 chars).
- [ ] Validação: pelo menos A ou B preenchido, FB sempre ≥ 0.
- [ ] Pré-preenchimento ao reabrir procedimento já com resultado.
- [ ] Setar `freebet_creditada` automaticamente baseado no valor da FB (`SIM` se > 0, `NAO` senão).
- [ ] Decidir onde implementar o cascade FB (Definir Resultados, Editar Procedimento, ou ambos). Hoje no FreeBet PRO só dispara via Editar — vide §7.2.
- [ ] Mostrar toast "Cadeia FB fechada — Desfazer" (10 segundos) quando o backend retornar `cascadeUpdated`.
- [ ] Implementar Undo via `POST /api/procedimentos-tarefas/:origemId/restaurar-status` que reverte a origem pro `status_operacao_anterior`.
- [ ] Botão "Definir resultado" da lista só aparece se há expectativa cadastrada (regra §8).
- [ ] (Opcional) Adicionar 4º bloco "FB origem sendo queimada" no modal quando proc for QUEIMAR_FB vinculado — não existe hoje nem do nosso lado, é melhoria livre de UX.

---

## 11. Referências cruzadas

- **Doc 03 §3** — autocomplete "Vincular Freebet Origem" (alimenta a queima).
- **Doc 03 §5** — cascade FB (auto-fechar origem).
- **Doc 04** — aba "FreeBets Ganhas" (estado pós-resultado).
- **Doc 05 §2** — status derivados que mudam após salvar resultado.
- Código de referência: `src/pages/PainelDeEnvios.jsx:488-692` (componente completo).
