-- Migration: Add NBA Teams
-- Run this AFTER running docs/migration-add-sport-type.sql which creates the NBA league

-- Insert all 30 NBA teams linked to the NBA league
INSERT INTO public.teams (standard_name, league_id)
SELECT team_name, nba_league.id
FROM (
  VALUES
    ('Atlanta Hawks'),
    ('Boston Celtics'),
    ('Brooklyn Nets'),
    ('Charlotte Hornets'),
    ('Chicago Bulls'),
    ('Cleveland Cavaliers'),
    ('Dallas Mavericks'),
    ('Denver Nuggets'),
    ('Detroit Pistons'),
    ('Golden State Warriors'),
    ('Houston Rockets'),
    ('Indiana Pacers'),
    ('Los Angeles Clippers'),
    ('Los Angeles Lakers'),
    ('Memphis Grizzlies'),
    ('Miami Heat'),
    ('Milwaukee Bucks'),
    ('Minnesota Timberwolves'),
    ('New Orleans Pelicans'),
    ('New York Knicks'),
    ('Oklahoma City Thunder'),
    ('Orlando Magic'),
    ('Philadelphia 76ers'),
    ('Phoenix Suns'),
    ('Portland Trail Blazers'),
    ('Sacramento Kings'),
    ('San Antonio Spurs'),
    ('Toronto Raptors'),
    ('Utah Jazz'),
    ('Washington Wizards')
) AS teams(team_name)
CROSS JOIN (
  SELECT id FROM public.leagues WHERE name = 'NBA' LIMIT 1
) AS nba_league
ON CONFLICT (standard_name, league_id) DO NOTHING;
