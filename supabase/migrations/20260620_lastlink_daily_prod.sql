-- Série diária COM produto — habilita o filtro por produto no dashboard inteiro.
-- O front filtra/agrega por produto (são poucos: ~7 produtos × dias).
-- Rodar no projeto wspsuempnswljkphatur.
create or replace view public.lastlink_daily_prod as
select
  (data_venda at time zone 'America/Sao_Paulo')::date  as dia,
  coalesce(produto, '(sem produto)')                    as produto,
  count(*)                                               as vendas,
  count(*) filter (where tipo_venda = 'Nova venda')      as novas,
  count(*) filter (where tipo_venda = 'Renovação')       as renovacoes,
  coalesce(sum(valor), 0)                                as receita
from public.lastlink_sales
where status = 'Aprovada' and data_venda is not null
group by 1, 2
order by 1;

alter view public.lastlink_daily_prod set (security_invoker = true);

-- Overview por produto (KPIs gerais quando filtra um produto):
-- inclui contagem de status pra os cards de expiradas/canceladas/etc.
create or replace view public.lastlink_overview_prod as
select
  coalesce(produto, '(sem produto)')                                          as produto,
  count(*)                                                                     as total,
  count(*) filter (where status = 'Aprovada')                                 as aprovadas,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Nova venda')    as novas,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Renovação')     as renovacoes,
  count(*) filter (where status = 'Expirada')                                 as expiradas,
  count(*) filter (where status = 'Cancelada')                                as canceladas,
  count(*) filter (where status = 'Reembolsada')                              as reembolsadas,
  count(*) filter (where status = 'Chargeback')                               as chargebacks,
  count(*) filter (where status = 'Pendente')                                 as pendentes,
  coalesce(sum(valor) filter (where status = 'Aprovada'), 0)                  as receita,
  count(distinct email) filter (where status = 'Aprovada')                    as clientes_unicos,
  count(*) filter (where status = 'Aprovada' and forma_pagamento = 'Pix')                as pagas_pix,
  count(*) filter (where status = 'Aprovada' and forma_pagamento = 'Cartão de Crédito')  as pagas_cartao
from public.lastlink_sales
group by 1;

alter view public.lastlink_overview_prod set (security_invoker = true);
