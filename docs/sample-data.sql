-- ============================================
-- DADOS DE EXEMPLO PARA TESTE DO DASHBOARD
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. TIMES (usando os IDs das leagues existentes)
-- ============================================

-- Premier League (Inglaterra)
INSERT INTO public.teams (id, league_id, standard_name, status) VALUES
('a1111111-1111-1111-1111-111111111111', '69886a27-dd41-44b5-91f8-60ad4666e864', 'Manchester United', 'active'),
('a2222222-2222-2222-2222-222222222222', '69886a27-dd41-44b5-91f8-60ad4666e864', 'Liverpool', 'active'),
('a3333333-3333-3333-3333-333333333333', '69886a27-dd41-44b5-91f8-60ad4666e864', 'Arsenal', 'active'),
('a4444444-4444-4444-4444-444444444444', '69886a27-dd41-44b5-91f8-60ad4666e864', 'Chelsea', 'active'),
('a5555555-5555-5555-5555-555555555555', '69886a27-dd41-44b5-91f8-60ad4666e864', 'Manchester City', 'active'),
('a6666666-6666-6666-6666-666666666666', '69886a27-dd41-44b5-91f8-60ad4666e864', 'Tottenham', 'active');

-- La Liga (Espanha)
INSERT INTO public.teams (id, league_id, standard_name, status) VALUES
('b1111111-1111-1111-1111-111111111111', '2c66edae-921d-41e8-90a8-ae8f8e9dbbcc', 'Real Madrid', 'active'),
('b2222222-2222-2222-2222-222222222222', '2c66edae-921d-41e8-90a8-ae8f8e9dbbcc', 'Barcelona', 'active'),
('b3333333-3333-3333-3333-333333333333', '2c66edae-921d-41e8-90a8-ae8f8e9dbbcc', 'Atlético Madrid', 'active'),
('b4444444-4444-4444-4444-444444444444', '2c66edae-921d-41e8-90a8-ae8f8e9dbbcc', 'Sevilla', 'active');

-- Brasileirão Série A
INSERT INTO public.teams (id, league_id, standard_name, status) VALUES
('c1111111-1111-1111-1111-111111111111', '1aa28dc5-8f51-4930-84d9-503eb42b4820', 'Flamengo', 'active'),
('c2222222-2222-2222-2222-222222222222', '1aa28dc5-8f51-4930-84d9-503eb42b4820', 'Palmeiras', 'active'),
('c3333333-3333-3333-3333-333333333333', '1aa28dc5-8f51-4930-84d9-503eb42b4820', 'Corinthians', 'active'),
('c4444444-4444-4444-4444-444444444444', '1aa28dc5-8f51-4930-84d9-503eb42b4820', 'São Paulo', 'active');

-- Serie A (Itália)
INSERT INTO public.teams (id, league_id, standard_name, status) VALUES
('d1111111-1111-1111-1111-111111111111', '88b4458f-f767-4acc-9c38-c6c05f7ecd09', 'Juventus', 'active'),
('d2222222-2222-2222-2222-222222222222', '88b4458f-f767-4acc-9c38-c6c05f7ecd09', 'AC Milan', 'active'),
('d3333333-3333-3333-3333-333333333333', '88b4458f-f767-4acc-9c38-c6c05f7ecd09', 'Inter Milan', 'active'),
('d4444444-4444-4444-4444-444444444444', '88b4458f-f767-4acc-9c38-c6c05f7ecd09', 'Napoli', 'active');

-- ============================================
-- 2. PARTIDAS (próximos dias)
-- ============================================

INSERT INTO public.matches (id, league_id, home_team_id, away_team_id, match_date, status) VALUES
-- Premier League
('e1111111-1111-1111-1111-111111111111', '69886a27-dd41-44b5-91f8-60ad4666e864', 'a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', NOW() + INTERVAL '1 day', 'scheduled'),
('e2222222-2222-2222-2222-222222222222', '69886a27-dd41-44b5-91f8-60ad4666e864', 'a3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', NOW() + INTERVAL '2 days', 'scheduled'),
('e3333333-3333-3333-3333-333333333333', '69886a27-dd41-44b5-91f8-60ad4666e864', 'a5555555-5555-5555-5555-555555555555', 'a6666666-6666-6666-6666-666666666666', NOW() + INTERVAL '3 days', 'scheduled'),

-- La Liga
('e4444444-4444-4444-4444-444444444444', '2c66edae-921d-41e8-90a8-ae8f8e9dbbcc', 'b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', NOW() + INTERVAL '1 day', 'scheduled'),
('e5555555-5555-5555-5555-555555555555', '2c66edae-921d-41e8-90a8-ae8f8e9dbbcc', 'b3333333-3333-3333-3333-333333333333', 'b4444444-4444-4444-4444-444444444444', NOW() + INTERVAL '4 days', 'scheduled'),

-- Brasileirão
('e6666666-6666-6666-6666-666666666666', '1aa28dc5-8f51-4930-84d9-503eb42b4820', 'c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', NOW() + INTERVAL '2 days', 'scheduled'),
('e7777777-7777-7777-7777-777777777777', '1aa28dc5-8f51-4930-84d9-503eb42b4820', 'c3333333-3333-3333-3333-333333333333', 'c4444444-4444-4444-4444-444444444444', NOW() + INTERVAL '5 days', 'scheduled'),

-- Serie A
('e8888888-8888-8888-8888-888888888888', '88b4458f-f767-4acc-9c38-c6c05f7ecd09', 'd1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', NOW() + INTERVAL '3 days', 'scheduled'),
('e9999999-9999-9999-9999-999999999999', '88b4458f-f767-4acc-9c38-c6c05f7ecd09', 'd3333333-3333-3333-3333-333333333333', 'd4444444-4444-4444-4444-444444444444', NOW() + INTERVAL '6 days', 'scheduled');

-- ============================================
-- 3. ODDS (várias casas de apostas por partida)
-- Usando os IDs dos bookmakers existentes:
-- Bet365: 6525c4f7-ac4f-40d2-8e33-dc7ed9afa905
-- Betano: 5c95f6c4-4073-4218-af84-4aace19b8e89
-- Sportingbet: f6c678ac-2ad4-454b-8391-5f428cad4f8e
-- Betfair: d26b5dbd-1bd6-4665-8764-d2dc5a91afc4
-- 1xBet: b43ddba0-017f-4281-b8cd-82a36bd9b303
-- ============================================

-- Manchester United vs Liverpool (Clássico!)
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e1111111-1111-1111-1111-111111111111', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 2.45, 3.40, 2.90, true),
('e1111111-1111-1111-1111-111111111111', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 2.50, 3.35, 2.85, true),
('e1111111-1111-1111-1111-111111111111', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 2.40, 3.45, 2.95, true),
('e1111111-1111-1111-1111-111111111111', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', '1x2', 2.55, 3.30, 2.80, true),
('e1111111-1111-1111-1111-111111111111', 'b43ddba0-017f-4281-b8cd-82a36bd9b303', '1x2', 2.60, 3.50, 2.75, true);

-- Arsenal vs Chelsea
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e2222222-2222-2222-2222-222222222222', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 1.85, 3.60, 4.20, true),
('e2222222-2222-2222-2222-222222222222', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 1.90, 3.55, 4.10, true),
('e2222222-2222-2222-2222-222222222222', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 1.80, 3.65, 4.30, true),
('e2222222-2222-2222-2222-222222222222', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', '1x2', 1.88, 3.58, 4.15, true),
('e2222222-2222-2222-2222-222222222222', 'b43ddba0-017f-4281-b8cd-82a36bd9b303', '1x2', 1.95, 3.50, 4.00, true);

-- Manchester City vs Tottenham
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e3333333-3333-3333-3333-333333333333', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 1.35, 5.00, 8.50, true),
('e3333333-3333-3333-3333-333333333333', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 1.38, 4.80, 8.00, true),
('e3333333-3333-3333-3333-333333333333', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 1.33, 5.20, 9.00, true),
('e3333333-3333-3333-3333-333333333333', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', '1x2', 1.40, 4.75, 7.80, true);

-- Real Madrid vs Barcelona (El Clásico!)
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e4444444-4444-4444-4444-444444444444', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 2.20, 3.50, 3.10, true),
('e4444444-4444-4444-4444-444444444444', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 2.25, 3.45, 3.05, true),
('e4444444-4444-4444-4444-444444444444', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 2.15, 3.55, 3.20, true),
('e4444444-4444-4444-4444-444444444444', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', '1x2', 2.30, 3.40, 3.00, true),
('e4444444-4444-4444-4444-444444444444', 'b43ddba0-017f-4281-b8cd-82a36bd9b303', '1x2', 2.35, 3.60, 2.95, true);

-- Atlético Madrid vs Sevilla
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e5555555-5555-5555-5555-555555555555', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 1.70, 3.80, 4.80, true),
('e5555555-5555-5555-5555-555555555555', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 1.75, 3.70, 4.60, true),
('e5555555-5555-5555-5555-555555555555', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 1.68, 3.85, 5.00, true);

-- Flamengo vs Palmeiras (Clássico brasileiro!)
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e6666666-6666-6666-6666-666666666666', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 2.10, 3.30, 3.40, true),
('e6666666-6666-6666-6666-666666666666', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 2.15, 3.25, 3.35, true),
('e6666666-6666-6666-6666-666666666666', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 2.05, 3.35, 3.50, true),
('e6666666-6666-6666-6666-666666666666', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', '1x2', 2.20, 3.20, 3.30, true);

-- Corinthians vs São Paulo
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e7777777-7777-7777-7777-777777777777', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 2.50, 3.20, 2.80, true),
('e7777777-7777-7777-7777-777777777777', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 2.55, 3.15, 2.75, true),
('e7777777-7777-7777-7777-777777777777', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 2.45, 3.25, 2.85, true);

-- Juventus vs AC Milan
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e8888888-8888-8888-8888-888888888888', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 2.00, 3.40, 3.60, true),
('e8888888-8888-8888-8888-888888888888', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 2.05, 3.35, 3.55, true),
('e8888888-8888-8888-8888-888888888888', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 1.95, 3.45, 3.70, true),
('e8888888-8888-8888-8888-888888888888', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', '1x2', 2.10, 3.30, 3.50, true);

-- Inter Milan vs Napoli
INSERT INTO public.odds_history (match_id, bookmaker_id, market_type, odds_home, odds_draw, odds_away, is_latest) VALUES
('e9999999-9999-9999-9999-999999999999', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', '1x2', 1.90, 3.50, 4.00, true),
('e9999999-9999-9999-9999-999999999999', '5c95f6c4-4073-4218-af84-4aace19b8e89', '1x2', 1.95, 3.45, 3.90, true),
('e9999999-9999-9999-9999-999999999999', 'f6c678ac-2ad4-454b-8391-5f428cad4f8e', '1x2', 1.85, 3.55, 4.10, true),
('e9999999-9999-9999-9999-999999999999', 'b43ddba0-017f-4281-b8cd-82a36bd9b303', '1x2', 2.00, 3.40, 3.80, true);

-- ============================================
-- 4. ALERTAS DE EXEMPLO
-- ============================================

INSERT INTO public.alerts (match_id, bookmaker_id, alert_type, message, details, is_read) VALUES
('e1111111-1111-1111-1111-111111111111', 'b43ddba0-017f-4281-b8cd-82a36bd9b303', 'value_bet', 'Value Bet detectado: Manchester United @ 2.60', '{"expected_odds": 2.45, "actual_odds": 2.60, "edge": 6.1}', false),
('e4444444-4444-4444-4444-444444444444', '6525c4f7-ac4f-40d2-8e33-dc7ed9afa905', 'line_movement', 'Movimento de linha: Real Madrid caiu de 2.35 para 2.20', '{"old_odds": 2.35, "new_odds": 2.20, "change_percent": -6.4}', false),
('e6666666-6666-6666-6666-666666666666', 'd26b5dbd-1bd6-4665-8764-d2dc5a91afc4', 'value_bet', 'Value Bet: Flamengo @ 2.20 vs média 2.10', '{"expected_odds": 2.10, "actual_odds": 2.20, "edge": 4.8}', false);

-- ============================================
-- VERIFICAÇÃO: Contagem de registros criados
-- ============================================
SELECT 
    (SELECT COUNT(*) FROM public.teams) as total_times,
    (SELECT COUNT(*) FROM public.matches) as total_partidas,
    (SELECT COUNT(*) FROM public.odds_history) as total_odds,
    (SELECT COUNT(*) FROM public.alerts) as total_alertas;
