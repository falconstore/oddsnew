

# Alinhar Permissoes com as Abas Reais do Sistema

## Problema

A coluna `can_view_shark_premium` nao existe na tabela `user_permissions` do banco externo, causando erro `PGRST204` ao salvar permissoes. O codigo referencia essa coluna que nunca foi criada.

## Abas reais do sistema (conforme sidebar)

| Aba | Coluna no banco |
|-----|----------------|
| Dashboard | can_view_dashboard |
| Controle Procedimentos | can_view_procedure_control |
| Betbra Affiliate | can_view_betbra |
| Assinaturas | can_view_payment_control |
| Bot Telegram | can_view_admin |
| Cadastros | can_view_sharkodds |
| Configuracoes | can_view_dashboard |
| Gerenciar Usuarios | can_view_admin |
| Logs / Diagnostico | can_view_admin |
| Status Scrapers | can_view_admin |

## Solucao

Remover `can_view_shark_premium` e `SHARK_PREMIUM` do codigo, pois nao existe no banco e nao corresponde a nenhuma aba do sistema.

## Arquivo a alterar

| Arquivo | Mudanca |
|---------|---------|
| `src/types/auth.ts` | Remover `can_view_shark_premium` de `UserPermissionRow`. Remover `SHARK_PREMIUM` de `PAGE_KEYS`. Remover entrada `shark_premium` de `PAGE_KEY_TO_COLUMN`. Remover entrada de `PERMISSION_COLUMNS`. Remover de `PAGE_CONFIG` |

## Detalhes

Todas as outras colunas (`can_view_dashboard`, `can_view_sharkodds`, `can_view_payment_control`, `can_view_procedure_control`, `can_view_freebet_calculator`, `can_view_admin`, `can_view_conta_corrente`, `can_view_plataformas`, `can_view_betbra`) existem no banco e serao mantidas. Isso corrige o erro 400 ao salvar permissoes.

