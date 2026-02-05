

# Plano: Correção de Rota 404 e Limite de Memória do Bot

## Problema 1: Rota `/teams` inexistente

A rota `/teams` foi removida quando as páginas de cadastro foram unificadas em uma única página com abas (`/cadastros`).

### Solução
Adicionar uma rota de redirecionamento para compatibilidade:
- `/teams` → `/cadastros?tab=teams`
- `/leagues` → `/cadastros?tab=leagues`
- `/bookmakers` → `/cadastros?tab=bookmakers`

### Alteração: `src/components/AnimatedRoutes.tsx`

```tsx
// Adicionar import
import { Navigate } from 'react-router-dom';

// Adicionar rotas de redirecionamento (antes da rota "*" de 404)
<Route path="/teams" element={<Navigate to="/cadastros?tab=teams" replace />} />
<Route path="/leagues" element={<Navigate to="/cadastros?tab=leagues" replace />} />
<Route path="/bookmakers" element={<Navigate to="/cadastros?tab=bookmakers" replace />} />
```

---

## Problema 2: Bot Telegram ultrapassando limite de memória

O log mostra:
```
current_memory=106102784 max_memory_limit=104857600
```

Ou seja: 101.2 MB usado vs 100 MB limite.

### Solução
Aumentar `max_memory_restart` de `100M` para `150M` no `ecosystem.config.js`.

### Alteração: `docs/scraper/ecosystem.config.js`

```javascript
{
  name: 'telegram-dg-bot',
  script: 'standalone/run_telegram.py',
  interpreter: 'python3',
  args: '--interval 60 --debug',
  cwd: __dirname,
  max_memory_restart: '150M',  // Era 100M
  // ...resto igual
}
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/AnimatedRoutes.tsx` | Adicionar 3 rotas de redirecionamento |
| `docs/scraper/ecosystem.config.js` | Aumentar `max_memory_restart` para 150M |

---

## Comandos pós-deploy

```bash
# Na VPS: Aplicar nova config de memória
pm2 restart telegram-dg-bot
pm2 save
```

