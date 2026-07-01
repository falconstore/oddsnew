-- RPC de agregação MENSAL da Lastlink pra alimentar o relatório de IA.
-- Recebe produto (opcional; null = todos) e um intervalo de meses [inicio, fim]
-- (primeiro dia de cada mês, em America/Sao_Paulo). Retorna uma linha por mês
-- com os KPIs — mesma lógica das views (receita = só 'Aprovada', split por
-- tipo_venda). Rodar no projeto wspsuempnswljkphatur (mesmo da lastlink_sales).
create or replace function public.lastlink_monthly_summary(
  p_produto    text default null,
  p_mes_inicio date default null,   -- primeiro dia do mês inicial (ex.: 2026-03-01)
  p_mes_fim    date default null    -- primeiro dia do mês final   (ex.: 2026-06-01)
)
returns table (
  mes              date,
  vendas           bigint,
  novas            bigint,
  renovacoes       bigint,
  receita          numeric,
  receita_novas    numeric,
  receita_renov    numeric,
  ticket_medio     numeric,
  clientes_unicos  bigint,
  expiradas        bigint,
  canceladas       bigint,
  reembolsadas     bigint,
  chargebacks      bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', s.data_venda at time zone 'America/Sao_Paulo')::date  as mes,
    count(*) filter (where s.status = 'Aprovada')                             as vendas,
    count(*) filter (where s.status = 'Aprovada' and s.tipo_venda = 'Nova venda')  as novas,
    count(*) filter (where s.status = 'Aprovada' and s.tipo_venda = 'Renovação')   as renovacoes,
    coalesce(sum(s.valor) filter (where s.status = 'Aprovada'), 0)            as receita,
    coalesce(sum(s.valor) filter (where s.status = 'Aprovada' and s.tipo_venda = 'Nova venda'), 0)  as receita_novas,
    coalesce(sum(s.valor) filter (where s.status = 'Aprovada' and s.tipo_venda = 'Renovação'), 0)   as receita_renov,
    round(
      coalesce(sum(s.valor) filter (where s.status = 'Aprovada'), 0)
      / nullif(count(*) filter (where s.status = 'Aprovada'), 0)
    , 2)                                                                      as ticket_medio,
    count(distinct s.email) filter (where s.status = 'Aprovada')             as clientes_unicos,
    count(*) filter (where s.status = 'Expirada')                            as expiradas,
    count(*) filter (where s.status = 'Cancelada')                           as canceladas,
    count(*) filter (where s.status = 'Reembolsada')                         as reembolsadas,
    count(*) filter (where s.status = 'Chargeback')                          as chargebacks
  from public.lastlink_sales s
  where s.data_venda is not null
    and (p_produto is null or s.produto = p_produto)
    and (
      p_mes_inicio is null
      or (s.data_venda at time zone 'America/Sao_Paulo')::date >= p_mes_inicio
    )
    and (
      p_mes_fim is null
      -- inclui o mês final inteiro: < primeiro dia do mês seguinte ao fim
      or (s.data_venda at time zone 'America/Sao_Paulo')::date < (p_mes_fim + interval '1 month')
    )
  group by 1
  order by 1;
$$;

-- Lista de produtos distintos (pra popular o seletor do relatório, se precisar).
create or replace function public.lastlink_produtos()
returns table (produto text, vendas bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(produto, '(sem produto)') as produto, count(*) as vendas
  from public.lastlink_sales
  where status = 'Aprovada'
  group by 1
  order by 2 desc;
$$;
