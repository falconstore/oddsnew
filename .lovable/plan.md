

# Plano: Ajustes de UI - Calendário, Tabela e Ícones da Sidebar

## Visão Geral

Três ajustes para melhorar a experiência visual:

1. **CalendarChart**: Otimizar cores para modo escuro usando variáveis CSS
2. **Tabela**: Aumentar fonte mantendo colunas compactas
3. **Sidebar**: Padronizar ícones removendo emojis

---

## 1. CalendarChart - Modo Escuro Otimizado

### Problema Atual
As cores RGBA fixas (green 34,197,94 e red 239,68,68) não se adaptam bem ao tema, podendo ter contraste ruim no modo claro.

### Solução
Usar as variáveis CSS do design system (`--success` e `--destructive`) convertidas para RGBA dinâmico:

| Antes | Depois |
|-------|--------|
| `rgba(34, 197, 94, opacity)` | Usar classe Tailwind com opacity dinâmica |
| `rgba(239, 68, 68, opacity)` | Usar classe Tailwind com opacity dinâmica |
| Cores inline fixas | Classes CSS adaptáveis ao tema |

**Implementação técnica:**
- Criar classes CSS dinâmicas baseadas na intensidade
- Usar `hsl(var(--success))` e `hsl(var(--destructive))` 
- Manter o cálculo de intensidade proporcional ao max/min do mês
- Garantir texto legível com `text-white` para alta intensidade e `text-foreground` para baixa

### Escala de Opacidade
```text
Intensidade 0-20%:   opacidade 0.15
Intensidade 20-40%:  opacidade 0.30
Intensidade 40-60%:  opacidade 0.45
Intensidade 60-80%:  opacidade 0.60
Intensidade 80-100%: opacidade 0.75
```

---

## 2. Tabela - Aumentar Fonte e Manter Compacta

### Problema Atual
A fonte `text-[10px]` está muito pequena, dificultando a leitura.

### Ajustes de Tamanho

| Elemento | Antes | Depois |
|----------|-------|--------|
| TableHead (cabeçalho) | `text-[10px]` | `text-xs` (12px) |
| TableCell (dados) | `text-[10px]` | `text-xs` (12px) |
| Nº Procedimento | `text-xs` | `text-sm font-semibold` (14px) |
| Badges (categoria/status) | `text-[10px]` | `text-[11px]` |
| Tags | `text-[9px]` | `text-[10px]` |
| Valores monetários | `text-[10px]` | `text-xs` (12px) |

### Manter Compacto
- Padding das células: manter `py-1 px-2`
- Altura das linhas: manter `h-9`
- Truncar textos longos com `max-w` e `truncate`

---

## 3. Sidebar - Padronizar Ícones

### Problema Atual
Futebol e Basquete usam emojis (⚽🏀), enquanto os demais usam ícones Lucide. Isso quebra a consistência visual.

### Opções de Padronização

**Opção A: Usar apenas ícones Lucide (Recomendado)**
- Mais consistente com o design system
- Melhor para acessibilidade
- Cores seguem o tema automaticamente

| Item | Antes | Depois |
|------|-------|--------|
| Monitor Futebol | ⚽ | `<Circle />` ou ícone SVG personalizado |
| Monitor Basquete | 🏀 | `<Circle />` ou ícone SVG personalizado |

**Opção B: Usar emojis em todos**
- Menos consistente
- Emojis variam entre sistemas operacionais

### Implementação (Opção A)
Como o Lucide não tem ícones de futebol/basquete nativos, criaremos componentes SVG personalizados que seguem o estilo do design system:

```text
FootballIcon: Círculo com padrão de bola de futebol
BasketballIcon: Círculo com linhas de bola de basquete
```

Ambos usarão `currentColor` para herdar a cor do texto da sidebar.

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/procedures/CalendarChart.tsx` | Cores adaptáveis ao tema |
| `src/components/procedures/ProcedureTable.tsx` | Aumentar fontes |
| `src/components/Sidebar.tsx` | Substituir emojis por ícones SVG |

---

## Resumo Visual Esperado

### Tabela
- Fontes maiores e mais legíveis (12-14px ao invés de 10px)
- Linhas continuam compactas (altura h-9)
- Melhor hierarquia visual (número do procedimento em destaque)

### Calendário  
- Cores verde/vermelho que se adaptam ao tema claro e escuro
- Mesmo gradiente de intensidade proporcional ao lucro/prejuízo
- Texto sempre legível independente do tema

### Sidebar
- Ícones consistentes em todas as abas
- Futebol e Basquete com ícones SVG personalizados
- Cores seguem o tema automaticamente

