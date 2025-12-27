-- =====================================================
-- SUPABASE REALTIME SETUP
-- Execute this SQL in your Supabase SQL Editor to enable realtime
-- =====================================================

-- Enable REPLICA IDENTITY FULL to capture complete row data during updates
ALTER TABLE odds_history REPLICA IDENTITY FULL;
ALTER TABLE alerts REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE odds_history;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- Verify the setup
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
