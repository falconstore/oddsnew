
# Plano: Refatorar Sistema de Permissoes de Usuario

## Problemas do Sistema Atual

1. **Conflito de logica**: O Sidebar usa `adminOnly` que esconde paginas de nao-admins, mesmo que eles tenham permissao no banco
2. **Permissoes limitadas**: Apenas `can_access` (booleano) - nao diferencia visualizar de editar
3. **Interface confusa**: Modal de permissoes simples, dificil gerenciar
4. **Dependencia de admin**: Muitas funcoes so ativam se o usuario for admin

---

## Nova Arquitetura de Permissoes

### Estrutura da Tabela (Atualizada)

```text
user_permissions
├── id (uuid)
├── user_id (uuid FK)
├── page_key (text) 
├── can_view (boolean) -- NOVO: pode visualizar a aba
├── can_edit (boolean) -- NOVO: pode editar/criar/deletar na aba
└── created_at (timestamptz)
```

### Niveis de Acesso por Aba

| Nivel | can_view | can_edit | Descricao |
|-------|----------|----------|-----------|
| Nenhum | false | false | Aba nao aparece no menu |
| Visualizar | true | false | Pode ver dados, botoes de acao desativados |
| Completo | true | true | Pode ver e editar tudo |

---

## Mudancas no Banco de Dados

### Migration SQL

```sql
-- Adicionar coluna can_edit
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS can_view BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false NOT NULL;

-- Migrar dados existentes (can_access -> can_view)
UPDATE public.user_permissions 
SET can_view = can_access, can_edit = can_access;

-- Remover coluna antiga (opcional, manter por seguranca)
-- ALTER TABLE public.user_permissions DROP COLUMN can_access;

-- Atualizar funcao de verificacao
CREATE OR REPLACE FUNCTION public.can_view_page(_user_id UUID, _page_key TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT can_view FROM public.user_permissions 
     WHERE user_id = _user_id AND page_key = _page_key),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_page(_user_id UUID, _page_key TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT can_edit FROM public.user_permissions 
     WHERE user_id = _user_id AND page_key = _page_key),
    false
  )
$$;
```

---

## Mudancas nos Arquivos

### 1. src/types/auth.ts

Atualizar interface UserPermission:

```typescript
export interface UserPermission {
  id: string;
  user_id: string;
  page_key: string;
  can_view: boolean;  // Substituir can_access
  can_edit: boolean;  // NOVO
  created_at: string;
}
```

Remover `adminOnly` do PAGE_CONFIG:

```typescript
export const PAGE_CONFIG: Record<PageKey, { 
  label: string; 
  description: string; // NOVO: descricao da aba
  icon: string;        // NOVO: icone para referencia
}> = {
  [PAGE_KEYS.DASHBOARD]: { 
    label: 'Dashboard', 
    description: 'Visao geral do sistema',
    icon: 'LayoutDashboard'
  },
  // ... demais paginas
};
```

### 2. src/contexts/AuthContext.tsx

Atualizar funcoes de verificacao:

```typescript
interface AuthContextType {
  // ... existentes
  canViewPage: (pageKey: PageKey) => boolean;  // NOVO
  canEditPage: (pageKey: PageKey) => boolean;  // NOVO
  // Remover canAccessPage
}

// Implementacao
const canViewPage = (pageKey: PageKey): boolean => {
  if (isAdmin) return true;
  const permission = userPermissions.find(p => p.page_key === pageKey);
  return permission?.can_view ?? false;
};

const canEditPage = (pageKey: PageKey): boolean => {
  if (isAdmin) return true;
  const permission = userPermissions.find(p => p.page_key === pageKey);
  return permission?.can_edit ?? false;
};
```

### 3. src/components/Sidebar.tsx

Remover `adminOnly` e usar apenas `canViewPage`:

```typescript
const filteredNavigation = navigation.filter(item => {
  // Admin ve tudo
  if (isAdmin) return true;
  // Outros usuarios: verificar permissao de visualizacao
  return canViewPage(item.pageKey);
});
```

### 4. src/components/RequireAuth.tsx

Simplificar para usar apenas permissoes:

```typescript
// Remover requireAdmin prop
// Usar apenas pageKey para verificar acesso

if (pageKey && !canViewPage(pageKey)) {
  return <Navigate to="/" replace />;
}
```

### 5. src/hooks/useUserManagement.ts

Atualizar funcoes de permissao:

```typescript
const updatePermission = async (
  userId: string, 
  pageKey: string, 
  canView: boolean, 
  canEdit: boolean
) => {
  // Se nao pode ver, tambem nao pode editar
  const finalCanEdit = canView ? canEdit : false;
  
  await supabase
    .from('user_permissions')
    .upsert({
      user_id: userId,
      page_key: pageKey,
      can_view: canView,
      can_edit: finalCanEdit,
    }, { onConflict: 'user_id,page_key' });
};
```

### 6. src/pages/admin/Users.tsx

Redesenhar interface de permissoes com tabela visual:

```text
+--------------------------------------------------+
| Permissoes de [Nome do Usuario]                  |
+--------------------------------------------------+
| Pagina              | Visualizar | Editar        |
+--------------------------------------------------+
| Dashboard           |    [x]     |   [ ]         |
| Monitor Futebol     |    [x]     |   [ ]         |
| Monitor Basquete    |    [x]     |   [ ]         |
| Controle Proced.    |    [x]     |   [x]         |
| Betbra Affiliate    |    [ ]     |   [ ]         |
| Assinaturas         |    [x]     |   [x]         |
| Ligas               |    [ ]     |   [ ]         |
| Times               |    [ ]     |   [ ]         |
| Casas de Apostas    |    [ ]     |   [ ]         |
| Configuracoes       |    [x]     |   [x]         |
| Gerenciar Usuarios  |    [ ]     |   [ ]         |
| Logs / Diagnostico  |    [ ]     |   [ ]         |
+--------------------------------------------------+
| [ ] Conceder acesso total (Admin)                |
+--------------------------------------------------+
| [Cancelar]                        [Salvar]       |
+--------------------------------------------------+
```

### 7. Paginas com Edicao (Procedures, Betbra, Subscriptions, etc.)

Adicionar verificacao de `canEditPage` para botoes de acao:

```typescript
const { canEditPage } = useAuth();
const canEdit = canEditPage(PAGE_KEYS.PROCEDURE_CONTROL);

// Renderizar botoes condicionalmente
{canEdit && (
  <Button onClick={handleAdd}>
    <Plus className="h-4 w-4 mr-2" />
    Adicionar
  </Button>
)}

// Na tabela
{canEdit && (
  <TableCell>
    <Button size="icon" onClick={() => handleEdit(item)}>
      <Edit className="h-4 w-4" />
    </Button>
    <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  </TableCell>
)}
```

---

## Fluxo de Aprovacao Simplificado

1. **Usuario se cadastra** -> Status: `pending`
2. **Admin aprova** -> Status: `approved`, cria permissoes padrao:
   - Dashboard: view + edit
   - Monitor Futebol: view + edit
   - Monitor Basquete: view + edit
   - Configuracoes: view + edit
3. **Admin configura permissoes** -> Via modal com tabela de checkboxes
4. **Opcao "Tornar Admin"** -> Marca todas as permissoes como true + adiciona role admin

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/types/auth.ts` | Atualizar UserPermission, remover adminOnly |
| `src/contexts/AuthContext.tsx` | Adicionar canViewPage/canEditPage |
| `src/components/Sidebar.tsx` | Usar canViewPage, remover adminOnly |
| `src/components/RequireAuth.tsx` | Simplificar, remover requireAdmin |
| `src/hooks/useUserManagement.ts` | Atualizar funcoes de permissao |
| `src/pages/admin/Users.tsx` | Novo modal de permissoes com tabela |
| `src/pages/ProcedureControl.tsx` | Verificar canEditPage |
| `src/pages/BetbraAffiliate.tsx` | Verificar canEditPage |
| `src/pages/Subscriptions.tsx` | Verificar canEditPage |
| `src/pages/Teams.tsx` | Verificar canEditPage |
| `src/pages/Leagues.tsx` | Verificar canEditPage |
| `src/pages/Bookmakers.tsx` | Verificar canEditPage |
| `src/components/AnimatedRoutes.tsx` | Remover requireAdmin |
| `docs/migration-permissions-v2.sql` | NOVO: Migration do banco |

---

## Beneficios da Nova Arquitetura

1. **Simplicidade**: Um unico sistema de permissoes, sem conflito admin/permissoes
2. **Granularidade**: Controle fino de visualizar vs editar por aba
3. **Flexibilidade**: Qualquer combinacao de permissoes possivel
4. **Clareza visual**: Tabela mostra claramente o que cada usuario pode fazer
5. **Seguranca**: Admin ainda tem bypass total, mas qualquer usuario pode receber permissoes especificas
6. **Manutencao**: Adicionar nova aba = adicionar no PAGE_KEYS, permissoes funcionam automaticamente

---

## Ordem de Implementacao

1. Criar migration SQL para atualizar tabela
2. Atualizar tipos em `auth.ts`
3. Atualizar `AuthContext.tsx` com novas funcoes
4. Atualizar `Sidebar.tsx` para usar novas funcoes
5. Atualizar `RequireAuth.tsx` (simplificar)
6. Atualizar `useUserManagement.ts`
7. Redesenhar modal em `Users.tsx`
8. Atualizar `AnimatedRoutes.tsx` (remover requireAdmin)
9. Adicionar verificacao canEditPage nas paginas de edicao
