-- Atomic recall throttling + increment.
-- Returns the new recall_count if the lead was eligible (status='pending',
-- telegram_user_id present, and last_recall_at older than min_seconds OR null).
-- Returns NULL when throttled / not eligible — caller MUST treat NULL as "skip".

create or replace function public.try_record_trial_recall(
  p_lead_id uuid,
  p_min_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  update public.trial_leads
     set last_recall_at = now(),
         recall_count = coalesce(recall_count, 0) + 1
   where id = p_lead_id
     and status = 'pending'
     and telegram_user_id is not null
     and (last_recall_at is null
          or last_recall_at < now() - make_interval(secs => p_min_seconds))
  returning recall_count into v_new_count;

  return v_new_count;
end;
$$;

revoke all on function public.try_record_trial_recall(uuid, integer) from public;
grant execute on function public.try_record_trial_recall(uuid, integer) to service_role;
