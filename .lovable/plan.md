

# Corrigir Sistema de Cadastro e Autenticacao - Alinhar com Banco Externo

## Problema

O `AuthContext` ainda faz queries para `user_roles` e `user_profiles` no banco externo, que retornam 404. Isso gera erros no console e requests desnecessarios. O sistema precisa ser simplificado para usar APENAS a tabela `user_permissions` que existe no banco externo.

## O que vai mudar

### 1. Simplificar AuthContext (`src/contexts/AuthContext.tsx`)

Remover completamente as queries para `user_roles` e `user_profiles`. A logica ficara:

```text
loadUserData(currentUser):
  1. Buscar user_permissions por email do usuario
  2. isAdmin = can_view_admin === true OU is_super_admin === true
  3. isApproved = registro existe em user_permissions
  4. FIM - sem mais queries
```

Remover tambem os estados `userProfile` e `userStatus` que nao sao mais necessarios (dependiam de tabelas inexistentes).

### 2. Simplificar interface AuthContextType

Remover campos que dependiam de tabelas inexistentes:
- `userStatus` -> remover (vinha de `user_profiles.status`)
- `userProfile` -> remover (vinha de `user_profiles`)

Manter:
- `userPermissions` -> continua (vem de `user_permissions`)
- `isAdmin`, `isApproved` -> continuam (derivados de `user_permissions`)

### 3. Atualizar pagina de Login (`src/pages/Login.tsx`)

Remover referencias a `userStatus` no componente de login (tela de "Aguardando Aprovacao" / "Acesso Negado" que usava `userStatus`). Simplificar: se nao esta aprovado, mostrar mensagem generica.

### 4. Atualizar signUp no AuthContext

O `signUp` atual salva `full_name` e `phone` nos metadados do Supabase Auth, mas nao cria registro em `user_permissions`. Novos usuarios precisam que um admin crie o registro em `user_permissions` para terem acesso. Manter esse fluxo (cadastro -> admin aprova adicionando na tabela).

### 5. Atualizar tipos (`src/types/auth.ts`)

Remover `UserProfile` do uso no contexto (manter a interface para compatibilidade, mas nao depender dela no AuthContext).

## Arquivos a Alterar

| Arquivo | Mudanca |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Remover queries de `user_roles` e `user_profiles`. Remover estados `userProfile` e `userStatus`. Simplificar `loadUserData` para usar apenas `user_permissions` |
| `src/pages/Login.tsx` | Remover referencia a `userStatus`. Simplificar tela de usuario nao aprovado |

## Resultado

- Zero erros 404 no console
- Login rapido (1 query em vez de 3)
- Codigo alinhado com a estrutura real do banco externo
- Fluxo claro: usuario so entra se tiver registro em `user_permissions`

