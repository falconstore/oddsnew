-- =====================================================
-- Procedure Status Auto-Update via pg_cron
--
-- Job que roda a cada 5 minutos e transiciona o status
-- dos procedimentos automaticamente com base no kickoff_at:
--
--   Enviado → Enviada Partida em Aberto (quando kickoff passou)
--
-- Quando o jogo encerra (kickoff_at + 150 min), nenhuma
-- transição adicional é necessária — a Fila de Conferência
-- e o NotificationPanel detectam via canCheckResult() no
-- frontend e exibem o botão "Conferir" para os gerentes.
--
-- Proteções:
--   • Só procs com kickoff_at preenchido
--   • Só archived = false e tachado = false
--   • Só status = 'Enviado' (não toca em outros estados)
--   • SECURITY DEFINER + search_path fixo
-- =====================================================

-- Função SQL chamada diretamente pelo pg_cron (sem edge function)
CREATE OR REPLACE FUNCTION public.auto_update_procedure_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Enviado → Enviada Partida em Aberto (kickoff já passou)
  UPDATE procedures
  SET status = 'Enviada Partida em Aberto'
  WHERE status = 'Enviado'
    AND kickoff_at IS NOT NULL
    AND kickoff_at <= now()
    AND archived = false
    AND tachado = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE LOG 'auto_update_procedure_statuses: % proc(s) → Enviada Partida em Aberto', updated_count;
  END IF;
END;
$$;

-- Garante que a função só pode ser executada pelo banco (não via anon/authenticated)
REVOKE ALL ON FUNCTION public.auto_update_procedure_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_update_procedure_statuses() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotente: remove schedule anterior antes de recriar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'procedure-status-auto-update') THEN
    PERFORM cron.unschedule('procedure-status-auto-update');
  END IF;
END
$$;

-- Roda a cada 5 minutos — pg_cron chama a SQL function diretamente (sem edge function)
SELECT cron.schedule(
  'procedure-status-auto-update',
  '*/5 * * * *',
  'SELECT public.auto_update_procedure_statuses()'
);
