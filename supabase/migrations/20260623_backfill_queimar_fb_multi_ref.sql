-- ============================================================================
-- Backfill: QUEIMAR_FB com MÚLTIPLAS origens (REF N° 469, 472) que ficaram
-- vinculadas a só UMA freebet por causa do bug do parser (capturava 1 nº só).
--
-- Rodar no projeto de PROCEDIMENTOS (wspsuempnswljkphatur).
--
-- Estratégia:
--   1. Extrai TODOS os números de "REF N° ..." do texto (promotion_name ou
--      bot_raw_message) de cada QUEIMAR_FB.
--   2. Resolve cada número no procedure_number de uma origem GANHAR_FB/ASR.
--   3. Onde achar MAIS origens do que o vínculo atual, atualiza
--      freebet_reference_ids com todas (o trigger normaliza singular = 1ª).
--
-- SEGURANÇA: rode primeiro o BLOCO 1 (SELECT) e confira a coluna would_link
-- antes de rodar o BLOCO 2 (UPDATE). O UPDATE só toca linhas onde há ganho real
-- (mais origens reconhecidas do que as já vinculadas).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BLOCO 1 — DIAGNÓSTICO (somente leitura). Rode e confira antes do UPDATE.
-- ----------------------------------------------------------------------------
with q as (
  select
    p.id,
    p.procedure_number,
    p.platform,
    coalesce(p.freebet_reference_ids, '{}')                                   as current_ids,
    -- texto onde os REF N° aparecem
    coalesce(p.promotion_name, '') || ' ' || coalesce(p.bot_raw_message, '')  as src
  from public.procedures p
  where p.tipo = 'QUEIMAR_FB'
    and p.archived = false
),
nums as (
  -- todos os grupos de dígitos que aparecem depois de "REF N" / "PROCEDIMENTO"
  select
    q.id,
    q.procedure_number,
    q.platform,
    q.current_ids,
    array(
      select distinct m[1]
      from regexp_matches(q.src, 'REF\s+N[°º]?\s*#?([\d\s,e+/]+)', 'gi') as r,
           regexp_matches(r[1], '(\d+)', 'g') as m
    ) as ref_numbers
  from q
),
resolved as (
  select
    n.id,
    n.procedure_number,
    n.platform,
    n.current_ids,
    n.ref_numbers,
    -- resolve cada nº -> id de origem elegível (GANHAR_FB/ASR), 1 por número
    array(
      select o.id
      from unnest(n.ref_numbers) as rn
      cross join lateral (
        select o.id
        from public.procedures o
        where o.procedure_number = rn
          and o.tipo in ('GANHAR_FB', 'ASR')
          and o.archived = false
        order by o.created_date desc
        limit 1
      ) o
    ) as would_link
  from nums n
  where array_length(n.ref_numbers, 1) > 1   -- só os que têm múltiplos nºs no texto
)
select
  procedure_number,
  platform,
  ref_numbers,
  current_ids,
  would_link,
  array_length(would_link, 1) as n_would_link,
  array_length(current_ids, 1) as n_current
from resolved
where array_length(would_link, 1) > coalesce(array_length(current_ids, 1), 0)
order by procedure_number;


-- ----------------------------------------------------------------------------
-- BLOCO 2 — UPDATE. Só rode DEPOIS de conferir o BLOCO 1.
-- Atualiza freebet_reference_ids onde reconhecemos mais origens que o atual.
-- ----------------------------------------------------------------------------
-- with q as (
--   select
--     p.id,
--     coalesce(p.freebet_reference_ids, '{}') as current_ids,
--     coalesce(p.promotion_name, '') || ' ' || coalesce(p.bot_raw_message, '') as src
--   from public.procedures p
--   where p.tipo = 'QUEIMAR_FB' and p.archived = false
-- ),
-- nums as (
--   select q.id, q.current_ids,
--     array(
--       select distinct m[1]
--       from regexp_matches(q.src, 'REF\s+N[°º]?\s*#?([\d\s,e+/]+)', 'gi') as r,
--            regexp_matches(r[1], '(\d+)', 'g') as m
--     ) as ref_numbers
--   from q
-- ),
-- resolved as (
--   select n.id, n.current_ids,
--     array(
--       select o.id
--       from unnest(n.ref_numbers) as rn
--       cross join lateral (
--         select o.id from public.procedures o
--         where o.procedure_number = rn and o.tipo in ('GANHAR_FB','ASR') and o.archived = false
--         order by o.created_date desc limit 1
--       ) o
--     ) as would_link
--   from nums n
--   where array_length(n.ref_numbers, 1) > 1
-- )
-- update public.procedures p
-- set freebet_reference_ids = r.would_link,
--     updated_date = now()
-- from resolved r
-- where p.id = r.id
--   and array_length(r.would_link, 1) > coalesce(array_length(p.freebet_reference_ids, 1), 0);
