

# Criar Nova Tabela de Permissoes de Acesso

## Problema atual

A tabela `user_permissions` existente tem a coluna `user_id` como `integer` em vez de `UUID`, causando erro 400 em todas as queries. Como essa tabela ja foi migrada para outro sistema, vamos criar uma nova tabela separada.

## Solucao

Criar uma nova tabela `user_page_access` com o schema correto e atualizar todo o codigo para usa-la.

### 1. Criar tabela no Supabase (migration SQL)

```text
Tabela: user_page_access
Colunas:
  - id: UUID (PK, default gen_random_uuid())
  - user_id: UUID (FK -> auth.users, NOT NULL)
  - page_key: TEXT (NOT NULL)
  - can_view: BOOLEAN (default false)
  - can_edit: BOOLEAN (default false)
  - created_at: TIMESTAMPTZ (default now())
  - UNIQUE(user_id, page_key)

RLS:
  - Users can SELECT own rows
  - Admins can SELECT/INSERT/UPDATE/DELETE all rows
```

### 2. Atualizar codigo (4 arquivos)

| Arquivo | Mudanca |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Trocar query de `user_permissions` para `user_page_access` |
| `src/hooks/useUserManagement.ts` | Trocar todas as queries de `user_permissions` para `user_page_access` |
| `src/types/auth.ts` | Remover campo legacy `can_access` do tipo `UserPermission` |
| `docs/migration-user-page-access.sql` | Salvar o SQL da nova tabela como documentacao |

### 3. O que NAO muda

- Tabela `user_permissions` antiga permanece intocada
- Tabela `user_profiles` continua funcionando normalmente
- Tabela `user_roles` continua funcionando normalmente
- Toda a logica de `canViewPage`/`canEditPage` continua igual, so muda a fonte de dados

## Apos a implementacao

Voce precisara acessar a pagina de Usuarios (admin) e re-salvar as permissoes de cada usuario para popular a nova tabela.

