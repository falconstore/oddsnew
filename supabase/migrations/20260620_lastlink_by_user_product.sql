-- Relatório por usuário × produto — habilita o filtro de SITUAÇÃO (ativo/
-- expirado/pendente) por produto no relatório de renovações.
-- Rodar no projeto wspsuempnswljkphatur.
create or replace view public.lastlink_by_user_product as
select
  email,
  coalesce(produto, '(sem produto)')                                           as produto,
  max(nome) filter (where nome is not null)                                    as nome,
  count(*) filter (where status = 'Aprovada')                                  as compras,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Renovação')     as renovacoes,
  count(*) filter (where status = 'Aprovada' and tipo_venda = 'Nova venda')    as novas,
  coalesce(sum(valor) filter (where status = 'Aprovada'), 0)                   as valor_total,
  max(modalidade) filter (where status = 'Aprovada')                          as modalidade,
  min(data_venda) filter (where status = 'Aprovada')                          as primeira_compra,
  max(data_venda) filter (where status = 'Aprovada')                          as ultima_compra,
  max(data_expiracao) filter (where status = 'Aprovada')                      as expira_em,
  -- tem alguma venda pendente nesse produto?
  bool_or(status = 'Pendente')                                                as tem_pendente
from public.lastlink_sales
where email is not null
group by email, coalesce(produto, '(sem produto)');

alter view public.lastlink_by_user_product set (security_invoker = true);
