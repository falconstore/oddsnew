-- ============================================================================
-- Padronização de STATUS dos procedimentos (projeto wspsuempnswljkphatur)
--
-- Estado encontrado (archived = false):
--   Concluído                   3677  (ok)
--   Finalizado                  1403  → legado, mesma coisa que Concluído
--   Lucro Direto                 386  (ok)
--   Enviada Partida em Aberto     46  (forma canônica — maiúsc)
--   Enviada partida em Aberto      9  → variação de caixa, uniformizar
--   Aposta Sem Risco               6  → virou CATEGORIA; status deve ser Concluído
--   Falta Girar Freebet            5  (ok)
--   '' (vazio)                     3  → sem status; tratar como Concluído? (revisar)
--
-- SEGURANÇA: rode o BLOCO 1 (SELECT) e confira as contagens. Só então rode os
-- UPDATEs do BLOCO 2 (descomente). Cada UPDATE é independente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BLOCO 1 — DIAGNÓSTICO (só leitura)
-- ----------------------------------------------------------------------------
select status, count(*) as qtd
from public.procedures
group by status
order by qtd desc;

-- Os 3 vazios — ver o que são antes de decidir:
select procedure_number, tipo, category, date, profit_loss, resultado_lucro
from public.procedures
where coalesce(status, '') = ''
order by date desc;


-- ----------------------------------------------------------------------------
-- BLOCO 2 — UPDATES. Descomente e rode após conferir o BLOCO 1.
-- ----------------------------------------------------------------------------

-- 2.1 — 'Finalizado' (legado) → 'Concluído'
-- update public.procedures
--   set status = 'Concluído', updated_date = now()
--   where status = 'Finalizado';

-- 2.2 — uniformiza caixa: 'Enviada partida em Aberto' → 'Enviada Partida em Aberto'
-- update public.procedures
--   set status = 'Enviada Partida em Aberto', updated_date = now()
--   where status = 'Enviada partida em Aberto';

-- 2.3 — 'Aposta Sem Risco' deixou de ser status (virou categoria).
--   Seta a categoria e marca o status como Concluído (eram finalizados).
--   Só sobrescreve a categoria se ela ainda não estiver definida como tal.
-- update public.procedures
--   set category = 'Aposta Sem Risco',
--       status = 'Concluído',
--       updated_date = now()
--   where status = 'Aposta Sem Risco';

-- 2.4 — status vazio → Concluído (CONFIRA no BLOCO 1 se faz sentido p/ os 3).
-- update public.procedures
--   set status = 'Concluído', updated_date = now()
--   where coalesce(status, '') = '';
