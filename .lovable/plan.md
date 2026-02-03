

# Plano: Atualizar Nome do App para "BetShark Pro"

## Objetivo

Atualizar todas as referencias do nome do aplicativo para **"BetShark Pro"** em todo o projeto, garantindo consistencia da marca.

---

## Locais Encontrados para Atualizar

| Arquivo | Local | Texto Atual | Novo Texto |
|---------|-------|-------------|------------|
| `index.html` | Linha 7 | `<title>Shark odds</title>` | `<title>BetShark Pro</title>` |
| `index.html` | Linha 8 | `content="Shark Odds New"` | `content="BetShark Pro - Monitoramento de Odds"` |
| `index.html` | Linha 25 | `og:title - Shark odds` | `BetShark Pro` |
| `index.html` | Linha 26 | `twitter:title - Shark odds` | `BetShark Pro` |
| `index.html` | Linha 27 | `og:description` | `BetShark Pro - Monitoramento de Odds` |
| `index.html` | Linha 28 | `twitter:description` | `BetShark Pro - Monitoramento de Odds` |
| `src/pages/Login.tsx` | Linha 179 | `Shark Tracker` | `BetShark Pro` |
| `src/pages/Dashboard.tsx` | Linha 18 | `OddsCompare` | `BetShark Pro` |
| `src/components/Sidebar.tsx` | Linha 152 | `OddsCompare` | `BetShark Pro` |

---

## Mudancas por Arquivo

### 1. index.html (Meta tags SEO)
- Titulo da pagina: `BetShark Pro`
- Descricao: `BetShark Pro - Monitoramento de Odds em Tempo Real`
- Open Graph tags para compartilhamento social
- Twitter cards

### 2. src/pages/Login.tsx
- CardTitle do card de login: `BetShark Pro`

### 3. src/pages/Dashboard.tsx
- Titulo principal do dashboard: `BetShark Pro`

### 4. src/components/Sidebar.tsx
- Nome no header da sidebar: `BetShark Pro`

---

## Resultado

Apos as mudancas, o nome **"BetShark Pro"** aparecera em:

- Aba do navegador
- Compartilhamento em redes sociais
- Pagina de login
- Dashboard principal
- Menu lateral (sidebar)

