
# Plano: Unificar Ligas, Times e Casas de Apostas em uma unica pagina

## Objetivo

Consolidar as 3 paginas de administracao de entidades (Ligas, Times, Casas de Apostas) em uma unica pagina chamada **"Cadastros"** ou **"Entidades"**, usando abas internas para navegacao. Isso vai reduzir 3 itens na sidebar para apenas 1.

---

## Solucao Proposta

Criar uma nova pagina `/cadastros` com 3 abas internas usando o componente Tabs do shadcn/ui:

```text
+------------------------------------------+
|  Cadastros                               |
|  [Ligas] [Times] [Casas de Apostas]     |
+------------------------------------------+
|                                          |
|  (conteudo da aba selecionada)          |
|                                          |
+------------------------------------------+
```

---

## Mudancas Necessarias

### 1. Criar nova pagina unificada

**Novo arquivo:** `src/pages/EntityManagement.tsx`

Esta pagina vai:
- Usar o componente `Tabs` do shadcn
- Importar e reutilizar a logica existente de cada pagina (Ligas, Times, Bookmakers)
- Permitir navegacao por URL com query param (ex: `/cadastros?tab=times`)

### 2. Criar componentes separados para cada secao

Extrair a logica de cada pagina para componentes reutilizaveis:

| Arquivo Atual | Novo Componente |
|---------------|-----------------|
| `src/pages/Leagues.tsx` | `src/components/entities/LeaguesTab.tsx` |
| `src/pages/Teams.tsx` | `src/components/entities/TeamsTab.tsx` |
| `src/pages/Bookmakers.tsx` | `src/components/entities/BookmakersTab.tsx` |

### 3. Atualizar Sidebar

**Arquivo:** `src/components/Sidebar.tsx`

Remover:
```typescript
{ name: 'Ligas', href: '/leagues', ... },
{ name: 'Times', href: '/teams', ... },
{ name: 'Casas de Apostas', href: '/bookmakers', ... },
```

Adicionar:
```typescript
{ name: 'Cadastros', href: '/cadastros', icon: Database, pageKey: PAGE_KEYS.ENTITIES },
```

### 4. Atualizar rotas

**Arquivo:** `src/components/AnimatedRoutes.tsx`

Remover rotas individuais de `/leagues`, `/teams`, `/bookmakers`

Adicionar rota unificada:
```typescript
<Route path="/cadastros" element={
  <RequireAuth pageKey={PAGE_KEYS.ENTITIES}>
    <EntityManagement />
  </RequireAuth>
} />
```

### 5. Atualizar sistema de permissoes

**Arquivo:** `src/types/auth.ts`

Opcao A - Permissao unica:
```typescript
PAGE_KEYS = {
  ...
  ENTITIES: 'entities',  // Substitui LEAGUES, TEAMS, BOOKMAKERS
}
```

Opcao B - Manter permissoes granulares (recomendado):
```typescript
// Manter LEAGUES, TEAMS, BOOKMAKERS
// A pagina mostra apenas as abas que o usuario tem permissao
```

---

## Estrutura de Arquivos

```text
src/
  components/
    entities/
      LeaguesTab.tsx      <- Logica extraida de Leagues.tsx
      TeamsTab.tsx        <- Logica extraida de Teams.tsx  
      BookmakersTab.tsx   <- Logica extraida de Bookmakers.tsx
  pages/
    EntityManagement.tsx  <- Nova pagina com abas
    Leagues.tsx           <- Pode ser removido ou mantido como redirect
    Teams.tsx             <- Pode ser removido ou mantido como redirect
    Bookmakers.tsx        <- Pode ser removido ou mantido como redirect
```

---

## Implementacao da Pagina EntityManagement

```typescript
// Estrutura basica
const EntityManagement = () => {
  const [activeTab, setActiveTab] = useState('leagues');
  const { canViewPage } = useAuth();
  
  // Filtrar abas baseado em permissoes
  const availableTabs = [
    canViewPage(PAGE_KEYS.LEAGUES) && { id: 'leagues', label: 'Ligas', icon: Trophy },
    canViewPage(PAGE_KEYS.TEAMS) && { id: 'teams', label: 'Times', icon: Users },
    canViewPage(PAGE_KEYS.BOOKMAKERS) && { id: 'bookmakers', label: 'Casas', icon: Building2 },
  ].filter(Boolean);

  return (
    <Layout>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {availableTabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}>
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="leagues">
          <LeaguesTab />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsTab />
        </TabsContent>
        <TabsContent value="bookmakers">
          <BookmakersTab />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};
```

---

## Bonus: Persistencia da Aba na URL

Para facilitar compartilhamento de links e navegacao:

```typescript
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'leagues';

const handleTabChange = (tab: string) => {
  setSearchParams({ tab });
};
```

URLs resultantes:
- `/cadastros` ou `/cadastros?tab=leagues` -> Aba Ligas
- `/cadastros?tab=teams` -> Aba Times
- `/cadastros?tab=bookmakers` -> Aba Casas de Apostas

---

## Resumo das Mudancas

| Acao | Arquivos |
|------|----------|
| Criar | `src/pages/EntityManagement.tsx` |
| Criar | `src/components/entities/LeaguesTab.tsx` |
| Criar | `src/components/entities/TeamsTab.tsx` |
| Criar | `src/components/entities/BookmakersTab.tsx` |
| Modificar | `src/components/Sidebar.tsx` |
| Modificar | `src/components/AnimatedRoutes.tsx` |
| Modificar | `src/types/auth.ts` |
| Opcional | Remover paginas antigas ou manter como redirects |

---

## Beneficios

1. **Sidebar mais limpa** - Reduz 3 itens para 1
2. **Navegacao mais rapida** - Troca de aba sem reload de pagina
3. **Permissoes granulares mantidas** - Cada aba so aparece se usuario tiver permissao
4. **URLs compartilhaveis** - Cada aba tem sua propria URL
5. **Facil expansao** - Adicionar novas abas e simples
