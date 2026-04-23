-- Adds support for an optional "Área do Aluno" bonus Telegram group alongside
-- the main VIP group. All columns are nullable (additive only): when
-- TELEGRAM_TRIAL_BONUS_CHAT_ID is unset, the system silently skips bonus logic.
--
-- bonus_invite_link: invite link created in the bonus group at signup time.
-- bonus_entered_at:  timestamp of the JOIN event in the bonus group.
-- bonus_removed_at:  timestamp of LEFT/KICK in the bonus group, OR when the
--                    cron/admin kicks the lead from the bonus group on expiry.

ALTER TABLE public.trial_leads
  ADD COLUMN IF NOT EXISTS bonus_invite_link text,
  ADD COLUMN IF NOT EXISTS bonus_entered_at  timestamptz,
  ADD COLUMN IF NOT EXISTS bonus_removed_at  timestamptz;

CREATE INDEX IF NOT EXISTS trial_leads_bonus_invite_link_idx
  ON public.trial_leads (bonus_invite_link)
  WHERE bonus_invite_link IS NOT NULL;
