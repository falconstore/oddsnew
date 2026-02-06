
# Plano: Corrigir Persistência de Navegação e Estado de Autenticação

## Problemas Identificados

### 1. Refresh da página volta para Dashboard
**Causa**: O `AuthProvider` está **fora** do `BrowserRouter`, mas a lógica de redirecionamento em `RequireAuth` precisa do roteador para funcionar corretamente. Quando a página recarrega:

1. `AuthContext` começa com `loading: true`
2. Durante o loading, `RequireAuth` mostra "Carregando..."
3. Ao recuperar a sessão, às vezes há uma "corrida" entre o estado de loading e a navegação

Além disso, o **Login.tsx** tem um `useEffect` que redireciona para `/` por padrão:
```tsx
const from = (location.state as any)?.from?.pathname || '/';
// Se user está logado, vai para 'from' que pode ser '/'
```

Quando você recarrega qualquer página, o `location.state` é **perdido** (não persiste em refresh), então o redirect vai para `/`.

### 2. Trocar de aba/voltar reseta tudo
**Causa**: A estrutura atual não preserva o estado entre navegações porque:
- O `QueryClient` é recriado em cada render (atualmente está fora do componente, o que é correto)
- Mas o problema pode estar em como os dados são invalidados ou refetchados

---

## Análise Técnica Detalhada

### Problema Principal: Order dos Providers
Atualmente em `App.tsx`:
```tsx
<AuthProvider>           // ← Fora do BrowserRouter
  <BrowserRouter>        // ← Router aqui dentro
    <AnimatedRoutes />
  </BrowserRouter>
</AuthProvider>
```

O `AuthProvider` usa hooks como `setTimeout` para carregar dados do usuário, mas não tem acesso ao contexto de roteamento. Isso é OK, mas...

### O Verdadeiro Problema: Perda do `location.state`
Em `Login.tsx` linha 28:
```tsx
const from = (location.state as any)?.from?.pathname || '/';
```

Quando você:
1. Está em `/monitor-futebol`
2. Recarrega a página (F5)
3. `RequireAuth` verifica auth → `loading: true` → espera
4. Sessão recuperada → usuário existe
5. Mas o `location.state` foi **perdido** no refresh
6. `from` vira `/` → redireciona para Dashboard

---

## Solução Proposta

### Parte 1: Usar URL atual ao invés de `location.state`
Modificar o fluxo para que, ao recarregar uma página protegida, o usuário permaneça nela.

**Mudança em `RequireAuth.tsx`**: Quando redireciona para login, salvar a URL atual na própria URL (query param) ao invés de `state`:

```tsx
// Ao redirecionar para login, passar a URL como query param
if (!user) {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
}
```

**Mudança em `Login.tsx`**: Ler o `returnTo` da URL:

```tsx
const searchParams = new URLSearchParams(location.search);
const returnTo = searchParams.get('returnTo') || '/';
const from = decodeURIComponent(returnTo);
```

### Parte 2: Evitar redirect durante loading
Garantir que o `RequireAuth` não faça nada (nem mostra loading) até ter certeza do estado de autenticação.

---

## Alterações Necessárias

### Arquivo 1: `src/components/RequireAuth.tsx`

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageKey } from '@/types/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  pageKey?: PageKey;
}

export const RequireAuth = ({ children, pageKey }: RequireAuthProps) => {
  const { user, loading, isApproved, canViewPage } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    // Salvar URL atual como query param para sobreviver ao refresh
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  // Verificar se usuário está aprovado
  if (!isApproved) {
    return <Navigate to="/login" replace />;
  }

  // Verificar permissão de visualização da página
  if (pageKey && !canViewPage(pageKey)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Acesso negado</p>
          <p className="text-muted-foreground text-sm">
            Você não tem permissão para visualizar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
```

### Arquivo 2: `src/pages/Login.tsx`

Modificar a lógica de leitura do `from`:

```tsx
// Linha ~28 - ANTES:
const from = (location.state as any)?.from?.pathname || '/';

// DEPOIS:
const searchParams = new URLSearchParams(location.search);
const returnToParam = searchParams.get('returnTo');
const from = returnToParam 
  ? decodeURIComponent(returnToParam) 
  : (location.state as any)?.from?.pathname || '/';
```

---

## Fluxo Corrigido

```text
Usuário em /monitor-futebol?leagues=Libertadores
          ↓
Pressiona F5 (refresh)
          ↓
Página recarrega, AuthContext: loading=true
          ↓
RequireAuth: mostra "Carregando..."
          ↓
Sessão recuperada: user existe, isApproved=true
          ↓
RequireAuth: retorna children (MonitorFutebol)
          ↓
✅ Usuário permanece em /monitor-futebol?leagues=Libertadores
```

```text
Usuário NÃO logado tenta acessar /monitor-futebol?leagues=Libertadores
          ↓
RequireAuth: user=null
          ↓
Redirect: /login?returnTo=%2Fmonitor-futebol%3Fleagues%3DLibertadores
          ↓
Usuário faz login
          ↓
Login.tsx lê returnTo da URL
          ↓
Redirect para /monitor-futebol?leagues=Libertadores
          ↓
✅ Usuário vai para a página que tentou acessar
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `RequireAuth.tsx` | Usar query param `?returnTo=` ao invés de `location.state` |
| `Login.tsx` | Ler `returnTo` da URL antes de usar `location.state` |

---

## Benefícios

1. **Refresh preserva URL**: Usuário permanece na página após F5
2. **Deep links funcionam**: Links diretos para páginas protegidas funcionam corretamente
3. **Query params preservados**: Filtros como `?leagues=Libertadores` sobrevivem ao fluxo de login
4. **Retrocompatível**: Ainda suporta `location.state` como fallback
