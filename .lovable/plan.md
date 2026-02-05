
# Plano: Corrigir Navegação de Times e Problema de Teclado nas Abas

## Problemas Identificados

### 1. Botões "Buscar times" não funcionam
**Causa**: Os botões na página `MatchDetails.tsx` navegam para `/teams?search=...`, mas o redirect em `AnimatedRoutes.tsx` usa:
```tsx
<Route path="/teams" element={<Navigate to="/cadastros?tab=teams" replace />} />
```

Esse `Navigate` é estático e **perde o parâmetro `search`** da URL original.

**Solução**: Criar um componente de redirect dinâmico que preserva os query params.

---

### 2. Digitação muda abas sozinho
**Causa**: O Radix UI Tabs usa navegação por teclado por padrão. Quando o foco está em qualquer lugar dentro do TabsList (incluindo após clicar em uma aba), teclas como setas ou certas letras podem navegar entre abas.

Especificamente:
- Setas esquerda/direita navegam entre abas
- Se o foco não sair do TabsList após seleção, qualquer interação pode disparar mudanças

**Solução**: Adicionar `tabIndex={-1}` ao container ou usar `activationMode="manual"` nos Tabs para evitar navegação automática. Também garantir que o foco saia das abas após seleção.

---

## Alterações Necessárias

### Arquivo 1: `src/components/AnimatedRoutes.tsx`

Criar um componente de redirect que preserva query params:

```tsx
import { Navigate, useLocation } from 'react-router-dom';

// Componente para redirect que preserva query params
function RedirectWithParams({ 
  to, 
  params = {} 
}: { 
  to: string; 
  params?: Record<string, string> 
}) {
  const location = useLocation();
  const currentParams = new URLSearchParams(location.search);
  
  // Merge current params with new params
  Object.entries(params).forEach(([key, value]) => {
    currentParams.set(key, value);
  });
  
  const search = currentParams.toString();
  return <Navigate to={`${to}${search ? `?${search}` : ''}`} replace />;
}

// Atualizar as rotas para usar o novo componente:
<Route path="/teams" element={<RedirectWithParams to="/cadastros" params={{ tab: 'teams' }} />} />
<Route path="/leagues" element={<RedirectWithParams to="/cadastros" params={{ tab: 'leagues' }} />} />
<Route path="/bookmakers" element={<RedirectWithParams to="/cadastros" params={{ tab: 'bookmakers' }} />} />
```

**Resultado**: `/teams?search=Juventud` -> `/cadastros?tab=teams&search=Juventud`

---

### Arquivo 2: `src/pages/EntityManagement.tsx`

Adicionar `activationMode="manual"` ao componente Tabs para prevenir mudança automática por teclado:

```tsx
<Tabs 
  value={activeTab} 
  onValueChange={handleTabChange} 
  className="w-full"
  activationMode="manual"  // Adicionar esta prop
>
```

Isso significa que apenas cliques (não setas de teclado) irão trocar a aba.

---

### Verificação adicional: Preservar `search` param na TeamsTab

O componente `TeamsTab.tsx` já lê o parâmetro `search` na linha 34:
```tsx
const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
```

Então após o redirect correto, a busca será preenchida automaticamente.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `AnimatedRoutes.tsx` | Criar `RedirectWithParams` component que preserva query strings |
| `EntityManagement.tsx` | Adicionar `activationMode="manual"` ao Tabs |

---

## Fluxo Corrigido

```text
MatchDetails: Clicar "Buscar Juventud de Las Piedras"
       ↓
Navigate: /teams?search=Juventud%20de%20Las%20Piedras
       ↓
RedirectWithParams: /cadastros?tab=teams&search=Juventud%20de%20Las%20Piedras
       ↓
EntityManagement: Abre aba "Teams"
       ↓
TeamsTab: Lê ?search= e preenche campo de busca automaticamente
       ↓
Resultado: Time "Juventud de Las Piedras" filtrado e visível
```

---

## Benefícios

1. **Navegação restaurada**: Botões "Buscar times" voltam a funcionar corretamente
2. **Teclado seguro**: Digitar em inputs não irá mais trocar abas acidentalmente
3. **Compatibilidade**: URLs antigas com parâmetros continuam funcionando
