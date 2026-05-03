-- Colunas prometidas na §1.4, §1.5 e §3.5 da nossa resposta à spec aprovada
-- (2026-05-03). Aditivas, todas nullable, sem backfill, sem default destrutivo.
-- Implementação do cliente HTTP entra quando a FreeBet Pro entregar a chave
-- de homolog (Task #560 do lado deles).

-- Link UUID pro procedimento de origem da freebet (QUEIMAR_FB → GANHAR_FB).
-- O campo texto livre `freebet_reference` continua existindo pra retrocompat.
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS freebet_reference_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;

-- Numero do catálogo no lado da FreeBet Pro (devolvido em todas as respostas
-- de POST/PATCH). Vai ser exibido como "Catálogo FreeBet Pro #N".
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS freebetpro_numero int;

-- X-Request-Id da última chamada (sucesso ou erro) pra correlação de suporte
-- contra os logs deles (tabela `integracoes_log` no FreeBet Pro).
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS freebetpro_last_request_id text;
