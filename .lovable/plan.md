
# Tornar falconstoregja@gmail.com Super Admin e Refatorar Gestao de Usuarios

## Problema Atual

A pagina "Gerenciar Usuarios" esta quebrando porque tenta buscar dados de `user_profiles` e `user_roles`, tabelas que nao existem no banco externo. Apenas `user_permissions` existe.

## Solucao em 3 Partes

### 1. Adicionar coluna `is_super_admin` na tabela `user_permissions` (externo)

Voce precisara executar este SQL no dashboard do seu Supabase externo (wspsuempnswljkphatur):

```text
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
UPDATE user_permissions SET is_super_admin = true WHERE user_email = 'falconstoregja@gmail.com';
```

Tambem garantir que todas as permissoes estao ativadas para esse usuario:

```text
UPDATE user_permissions 
SET can_view_dashboard = true, can_view_sharkodds = true, can_view_payment_control = true,
    can_view_procedure_control = true, can_view_freebet_calculator = true, can_view_admin = true,
    can_view_conta_corrente = true, can_view_shark_premium = true, can_view_plataformas = true,
    can_view_betbra = true, is_super_admin = true
WHERE user_email = 'falconstoregja@gmail.com';
```

### 2. Atualizar `AuthContext` para usar `is_super_admin`

| Arquivo | Mudanca |
|---------|---------|
| `src/types/auth.ts` | Adicionar `is_super_admin` ao tipo `UserPermissionRow` |
| `src/contexts/AuthContext.tsx` | Usar `is_super_admin` para definir `isAdmin` |

### 3. Refatorar pagina de Gerenciar Usuarios

A pagina admin/Users e o hook `useUserManagement` precisam funcionar apenas com a tabela `user_permissions`, sem depender de `user_profiles` ou `user_roles`.

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useUserManagement.ts` | Refatorar `fetchUsers` para buscar apenas de `user_permissions`. Listar usuarios por email. Remover dependencia de `user_profiles` e `user_roles` |
| `src/pages/admin/Users.tsx` | Adaptar a tabela para mostrar dados de `user_permissions` (email, permissoes, super_admin). Remover tabs de status (pending/approved/rejected). Adicionar toggle de super admin |

### Detalhes Tecnicos

**UserPermissionRow atualizado:**
```text
interface UserPermissionRow {
  ...campos existentes...
  is_super_admin: boolean;   // NOVO
}
```

**useUserManagement refatorado:**
- `fetchUsers`: busca apenas `user_permissions` -> lista usuarios por email
- `updatePermissionsByEmail`: ja funciona (mantido)
- `toggleSuperAdmin`: novo metodo para ativar/desativar super admin
- Remover `updateUserStatus`, `setUserRole`, `deleteUser` (dependiam de tabelas inexistentes)

**Admin Users page:**
- Tabela simples: Email | Permissoes | Super Admin | Acoes
- Botao para configurar permissoes (modal existente, mantido)
- Toggle para super admin
- Sem tabs de status (nao existe mais conceito de pending/approved/rejected)
