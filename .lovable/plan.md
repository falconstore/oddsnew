
# Plano: Rebranding da Pagina de Controle de Procedimentos

## Visao Geral

Atualizar a pagina de Controle de Procedimentos para seguir o design system atual do OddsCompare, deixando as linhas mais compactas e corrigindo o CalendarChart com a logica de degradee do arquivo original.

---

## Mudancas Principais

### 1. CalendarChart - Correcao Completa

O calendario atual esta simplificado. Sera substituido pela versao completa do arquivo `CalendarChart.jsx` enviado, adaptada para TypeScript e usando as variaveis CSS do design system:

| Atual | Corrigido |
|-------|-----------|
| Cores fixas por faixa de lucro | Degradee dinamico baseado no max/min lucro do mes |
| Sem indicador de "hoje" | Anel azul para o dia atual |
| Tooltip simples | Informacoes detalhadas (quantidade de procedimentos + valor) |
| Celulas pequenas | Celulas proporcionais com mais informacao visivel |

**Alteracoes tecnicas:**
- Usar `eachDayOfInterval` para gerar dias
- Implementar `getColorIntensity()` com calculo dinamico de opacidade
- Adicionar anel de destaque para o dia atual (`isSameDay`)
- Estilos inline para cores RGBA dinamicas (compativel com dark/light mode)
- Manter responsividade com tamanhos de fonte adaptativos

---

### 2. Tabela - Linhas Mais Compactas

Reduzir padding das celulas da tabela para tornar a visualizacao mais densa:

| Componente | Antes | Depois |
|------------|-------|--------|
| TableCell | `p-4` | `py-2 px-3` |
| TableHead | `h-12` | `h-10` |
| Botoes de acao | `size="sm"` | `size="icon" h-7 w-7` |
| Badges | `text-xs` | `text-[10px]` |
| Star button | padding normal | `p-0.5` |

---

### 3. StatCards - Alinhamento com Design System

Os StatCards ja estao bons, mas farei pequenos ajustes para consistencia:

| Ajuste | Descricao |
|--------|-----------|
| Padding | Reduzir de `p-6` para `p-4` |
| Altura icone | Reduzir de `w-12 h-12` para `w-10 h-10` |
| Tamanho titulo | Manter `text-xs` |

---

### 4. ProcedureFilters - Layout Mais Compacto

| Ajuste | Descricao |
|--------|-----------|
| CardContent padding | Reduzir de `pt-6` para `pt-4 pb-4` |
| Gap entre filtros | Manter `gap-4` |
| Labels | Manter `text-xs` |

---

### 5. MountainChart - Pequenos Ajustes

| Ajuste | Descricao |
|--------|-----------|
| Altura | Manter `h-64` |
| Usar cores HSL do sistema | Ja implementado corretamente |

---

### 6. NotificationPanel - Compactacao

| Ajuste | Descricao |
|--------|-----------|
| Padding itens | Reduzir de `p-4` para `p-3` |
| Max-height | Reduzir de `max-h-96` para `max-h-72` |
| Icone alerta | Reduzir de `w-8 h-8` para `w-6 h-6` |

---

### 7. ProcedureMobileCards - Alinhamento

| Ajuste | Descricao |
|--------|-----------|
| Padding card | Reduzir de `p-4` para `p-3` |
| Espacamento | Reduzir `space-y-4` para `space-y-3` |

---

## Arquivos Modificados

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/components/procedures/CalendarChart.tsx` | Reescrita completa com logica de degradee |
| `src/components/procedures/ProcedureTable.tsx` | Compactacao de linhas |
| `src/components/procedures/ProcedureStats.tsx` | Ajustes de padding |
| `src/components/procedures/ProcedureFilters.tsx` | Compactacao |
| `src/components/procedures/NotificationPanel.tsx` | Compactacao |
| `src/components/procedures/ProcedureMobileCards.tsx` | Compactacao |
| `src/pages/ProcedureControl.tsx` | Ajustes de spacing |

---

## Detalhes Tecnicos

### CalendarChart - Nova Implementacao

```text
Logica de cores dinamicas:

1. Calcular maxProfit e maxLoss do mes
2. Para cada dia:
   - Se lucro > 0: intensidade = (lucro / maxProfit) * 100
   - Se lucro < 0: intensidade = (|prejuizo| / |maxLoss|) * 100
   - Se lucro = 0: cor neutra
3. Aplicar opacidade baseada na intensidade (0.1 a 0.8)
4. Verde para lucro, vermelho para prejuizo
5. Highlight azul para dia atual
```

### Tabela Compacta - Exemplo de Estrutura

```text
Antes:
- TableHead: h-12 px-4
- TableCell: p-4
- Botoes: h-8 w-8

Depois:
- TableHead: h-10 px-3
- TableCell: py-2 px-3
- Botoes: h-7 w-7
```

---

## Resultado Esperado

- Calendario com degradee dinamico mostrando intensidade do lucro/prejuizo
- Tabela com linhas 40% mais compactas
- UI consistente com o resto do sistema (OddsMonitor, Dashboard)
- Melhor aproveitamento do espaco vertical
- Indicador visual do dia atual no calendario
