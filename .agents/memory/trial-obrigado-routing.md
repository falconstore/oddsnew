---
name: Trial obrigado routing
description: Como funciona o roteamento da página /obrigado e como visualizar sem sessão
---

## Regra

A rota `/obrigado` (TrialObrigado) só aparece quando `isTrialHost()` retorna `true` em `AnimatedRoutes.tsx`.

`isTrialHost()` retorna true quando:
- `window.location.hostname` começa com `"trial."` (produção: trial.sharkgreen.com.br)
- OU `?host=trial` está na query string (para testes locais)

## Como visualizar localmente (sem sessionStorage válido)

Usar ambos os params juntos:
```
http://localhost:5000/obrigado?host=trial&preview=1
```

O param `?preview=1` foi adicionado ao componente para injetar dados mock quando não há sessão.

**Why:** O admin app e o trial compartilham o mesmo bundle. A separação é feita por hostname em runtime, não por build separado.

**How to apply:** Sempre que precisar debugar ou fazer screenshot do /obrigado no preview do Replit.
