-- =====================================================
-- Betbra Scraper Cron — roda a cada 4 horas
-- =====================================================
-- Mantém os dados de afiliado Betbra (betbra_affiliate_data) frescos E
-- mantém a sessão do painel viva: o painel affiliates.betbra.bet.br expira o
-- cookie (BETBRA_COOKIE) após ~24h de inatividade. Rodar a cada 4h impede que
-- o token caia por ociosidade.
--
-- Equivale a apertar "Atualizar via Scraper" no mês atual: body {} faz a edge
-- function usar o primeiro/último dia do mês corrente (BRT).
--
-- Quando o cookie EXPIRAR de fato (logout no painel, troca de senha, etc.),
-- a chamada falha em background — basta atualizar o secret BETBRA_COOKIE no
-- Supabase, sem tocar no código nem neste cron.
-- =====================================================

-- Idempotente: remove o job se já existir antes de recriar
SELECT cron.unschedule('betbra-scraper-4h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'betbra-scraper-4h');

-- Roda no minuto 0 a cada 4 horas (00,04,08,12,16,20 UTC)
SELECT cron.schedule(
  'betbra-scraper-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/betbra-scraper',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) AS request_id;
  $$
);
