

# Plano: Compactar Calendário e Aumentar Fontes

## Problema Atual

Analisando a imagem e o código:
- Células usam `aspect-square` que ocupa muito espaço vertical
- Fontes muito pequenas: 7-10px para informações, 14-20px para números
- Muito espaço vazio dentro das células
- Calendário ocupa quase a tela inteira desnecessariamente

---

## Solução

### Mudanças no Layout

| Elemento | Antes | Depois |
|----------|-------|--------|
| Célula | `aspect-square` | `aspect-[4/3]` (mais largo que alto) |
| Padding célula | `p-1 sm:p-1.5 md:p-2` | `p-1` fixo |
| Gap entre células | `gap-1 sm:gap-2` | `gap-1` fixo |
| Border | `border-2` | `border` (1px) |
| Rounded | `rounded-lg` | `rounded-md` |

### Aumento das Fontes Internas

| Elemento | Antes | Depois |
|----------|-------|--------|
| Número do dia | `text-sm sm:text-base md:text-lg lg:text-xl` | `text-lg sm:text-xl md:text-2xl` |
| "X proc." | `text-[7px] sm:text-[8px] md:text-[9px]` | `text-[9px] sm:text-[10px] md:text-xs` |
| "R$ valor" | `text-[8px] sm:text-[9px] md:text-[10px]` | `text-[10px] sm:text-xs md:text-sm` |
| "Sem dados" | `text-[6px] sm:text-[7px] md:text-[8px]` | `text-[8px] sm:text-[9px] md:text-[10px]` |
| Dias da semana | `text-[10px] sm:text-xs` | `text-xs sm:text-sm` |

### Compactação do Card

| Elemento | Antes | Depois |
|----------|-------|--------|
| CardHeader | `pb-2` | `pb-1` |
| Legenda margin | `mt-4` | `mt-2` |
| Legenda gap | `gap-4` | `gap-3` |
| Legenda ícones | `w-3 h-3 sm:w-4 sm:h-4` | `w-3 h-3` fixo |

---

## Resultado Visual Esperado

```text
Antes:
┌─────────────────────────────────────┐
│           Calendário                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │       │  <- Células quadradas, fontes minúsculas
│  │9p  │ │10p │ │16p │ │15p │       │
│  │R$53│ │R$119│ │R$43│ │R$25│       │
│  └────┘ └────┘ └────┘ └────┘       │
│         (muito espaço)              │
└─────────────────────────────────────┘

Depois:
┌─────────────────────────────────────┐
│ Calendário                          │
│ ┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐│
│ │ 1 ││ 2 ││ 3 ││ 4 ││ 5 ││ 6 ││ 7 ││  <- Células retangulares compactas
│ │9p ││10p││16p││15p││10p││10p││18p││     com fontes maiores e mais legíveis
│ │R$53││R$119││R$43││R$25││R$191││R$112││R$204│
│ └───┘└───┘└───┘└───┘└───┘└───┘└───┘│
└─────────────────────────────────────┘
```

---

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `src/components/procedures/CalendarChart.tsx` | Compactação de layout + aumento de fontes |

