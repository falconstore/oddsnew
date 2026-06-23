-- Views/RPC de agregação pro Dashboard Lastlink.
-- Movem o trabalho pesado pro banco (em vez de somar 6k+ linhas no front).
-- Rodar no projeto wspsuempnswljkphatur (mesmo da lastlink_sales).

-- 1) Resumo geral (1 linha) — KPIs principais. Receita = só status 'Aprovada'.
create or replace view public.lastlink_overview as
select
  count(*)                                                          as total,
  count(*) filter (where status = 'Aprovada')                      as aprovadas,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Nova venda')  as novas,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Renovação')   as renovacoes,
  count(*) filter (where status = 'Expirada')                      as expiradas,
  count(*) filter (where status = 'Cancelada')                     as canceladas,
  count(*) filter (where status = 'Reembolsada')                   as reembolsadas,
  count(*) filter (where status = 'Chargeback')                    as chargebacks,
  count(*) filter (where status = 'Pendente')                      as pendentes,
  coalesce(sum(valor) filter (where status = 'Aprovada'), 0)       as receita,
  coalesce(sum(valor) filter (where status = 'Aprovada' and tipo_venda = 'Nova venda'), 0)  as receita_novas,
  coalesce(sum(valor) filter (where status = 'Aprovada' and tipo_venda = 'Renovação'), 0)   as receita_renov,
  count(distinct email) filter (where status = 'Aprovada')         as clientes_unicos,
  count(*) filter (where status = 'Aprovada' and forma_pagamento = 'Pix')                as pagas_pix,
  count(*) filter (where status = 'Aprovada' and forma_pagamento = 'Cartão de Crédito')  as pagas_cartao
from public.lastlink_sales;

-- 2) Série diária (só aprovadas) — alimenta o calendário e o gráfico.
create or replace view public.lastlink_daily as
select
  (data_venda at time zone 'America/Sao_Paulo')::date  as dia,
  count(*)                                               as vendas,
  count(*) filter (where tipo_venda = 'Nova venda')      as novas,
  count(*) filter (where tipo_venda = 'Renovação')       as renovacoes,
  coalesce(sum(valor), 0)                                as receita
from public.lastlink_sales
where status = 'Aprovada' and data_venda is not null
group by 1
order by 1;

-- 3) Por produto (só aprovadas).
create or replace view public.lastlink_by_product as
select
  coalesce(produto, '(sem produto)')                     as produto,
  count(*)                                               as vendas,
  count(*) filter (where tipo_venda = 'Nova venda')      as novas,
  count(*) filter (where tipo_venda = 'Renovação')       as renovacoes,
  coalesce(sum(valor), 0)                                as receita
from public.lastlink_sales
where status = 'Aprovada'
group by 1
order by receita desc;

-- 4) Relatório por usuário (Fase 3) — renovações, valor, LTV, expiração.
create or replace view public.lastlink_by_user as
select
  email,
  max(nome) filter (where nome is not null)              as nome,
  count(*) filter (where status = 'Aprovada')                                  as compras,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Renovação')     as renovacoes,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Nova venda')    as novas,
  coalesce(sum(valor) filter (where status = 'Aprovada'), 0)                   as valor_total,
  max(produto) filter (where status = 'Aprovada')                             as ultimo_produto,
  max(modalidade) filter (where status = 'Aprovada')                          as modalidade,
  min(data_venda) filter (where status = 'Aprovada')                          as primeira_compra,
  max(data_venda) filter (where status = 'Aprovada')                          as ultima_compra,
  max(data_expiracao) filter (where status = 'Aprovada')                      as expira_em
from public.lastlink_sales
where email is not null
group by email;

-- Views herdam a RLS da tabela base (security_invoker). Garantimos isso:
alter view public.lastlink_overview   set (security_invoker = true);
alter view public.lastlink_daily      set (security_invoker = true);
alter view public.lastlink_by_product set (security_invoker = true);
alter view public.lastlink_by_user    set (security_invoker = true);
