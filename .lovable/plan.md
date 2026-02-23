

# Corrigir Warnings de Ref em Componentes 3D

## Problema

React Three Fiber tenta passar refs para componentes funcionais que nao suportam refs, gerando warnings no console para: `FloatingOdd`, `GlowingParticles`, `GridFloor` e `CameraController`.

## Solucao

Envolver os componentes afetados com `React.forwardRef` para que aceitem refs corretamente.

## Arquivos a alterar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/login/FloatingOdds.tsx` | Envolver `FloatingOdd` com `forwardRef` |
| `src/components/login/GlowingParticles.tsx` | Envolver `GlowingParticles` com `forwardRef` |
| `src/components/login/GridFloor.tsx` | Envolver `GridFloor` com `forwardRef` |
| `src/components/login/LoginBackground3D.tsx` | Envolver `CameraController` com `forwardRef` |

## Detalhes tecnicos

Cada componente sera atualizado seguindo o padrao:

```text
// Antes
const MeuComponente = (props) => { ... };

// Depois
const MeuComponente = forwardRef<THREE.Group, Props>((props, ref) => { ... });
```

- Nenhuma mudanca de funcionalidade, apenas eliminacao dos warnings
- Os refs existentes dentro dos componentes continuam funcionando normalmente

