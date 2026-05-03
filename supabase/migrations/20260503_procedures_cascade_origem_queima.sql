-- Cascade de fechamento da origem GANHAR_FB quando o queimador (QUEIMAR_FB)
-- linkado via `freebet_reference_id` tem o resultado fechado/reaberto.
-- Paridade com fix do FreeBet PRO (handoff 03/05/2026).
--
-- Bug original: ao fechar uma QUEIMAR_FB, a origem ficava perpetuamente em
-- 'Falta Girar Freebet' na lista principal (a página /procedures/freebets-ganhas
-- já derivava o status correto, mas /procedure-control mostrava stale).
--
-- Caminhos cobertos pelo trigger (independente da origem do UPDATE — UI,
-- edge function freebetpro-sync action='result', SQL manual, etc):
--   FORWARD: NEW.tipo='QUEIMAR_FB' AND NEW.resultado_lucro IS NOT NULL AND
--            OLD.resultado_lucro IS NULL → origem vira 'Lucro Direto'.
--   REVERSE: NEW.tipo='QUEIMAR_FB' AND NEW.resultado_lucro IS NULL AND
--            OLD.resultado_lucro IS NOT NULL → origem volta pra
--            'Falta Girar Freebet' (somente se a FB ainda foi creditada
--            — robustez sugerida pelo time FreeBet PRO).

create or replace function public.tg_cascade_origem_queima_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem_id uuid;
  v_origem_creditada text;
  v_origem_freebet_valor numeric;
begin
  -- Só interessa QUEIMAR_FB com vínculo de origem.
  if coalesce(new.tipo, '') <> 'QUEIMAR_FB' then
    return new;
  end if;
  if new.freebet_reference_id is null then
    return new;
  end if;

  -- FORWARD: queima fechou agora.
  if new.resultado_lucro is not null and old.resultado_lucro is null then
    update public.procedures
       set status = 'Lucro Direto',
           updated_date = now()
     where id = new.freebet_reference_id
       and status in ('Falta Girar Freebet', 'Freebet Pendente');
    return new;
  end if;

  -- REVERSE: queima foi limpa. Só ressuscita origem que ainda tem FB creditada
  -- (robustez: se o admin marcou freebet_creditada='NAO' depois, deixa quieto).
  if new.resultado_lucro is null and old.resultado_lucro is not null then
    select freebet_creditada, coalesce(resultado_freebet_ganha, 0)
      into v_origem_creditada, v_origem_freebet_valor
      from public.procedures
     where id = new.freebet_reference_id;

    if v_origem_freebet_valor > 0
       and coalesce(v_origem_creditada, '') in ('SIM', 'AGUARDANDO') then
      update public.procedures
         set status = 'Falta Girar Freebet',
             updated_date = now()
       where id = new.freebet_reference_id
         and status = 'Lucro Direto';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cascade_origem_queima_status on public.procedures;

create trigger trg_cascade_origem_queima_status
after update of resultado_lucro on public.procedures
for each row
execute function public.tg_cascade_origem_queima_status();

comment on function public.tg_cascade_origem_queima_status is
  'Cascade origem GANHAR_FB ↔ queimador QUEIMAR_FB. Forward: fecha origem como Lucro Direto. Reverse: ressuscita origem pra Falta Girar (se FB ainda creditada).';
