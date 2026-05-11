-- Tabela de logs do bot Telegram de procedimentos.
-- Erros que antes iam pro grupo agora são gravados aqui e visualizados no painel.
create table if not exists public.bot_logs (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  level         text        not null default 'error', -- 'error' | 'warning' | 'info'
  event         text        not null,                 -- ex: 'insert_error', 'parse_failed', 'lookup_error'
  message       text        not null,
  procedure_number text,
  update_id     bigint,
  message_id    bigint,
  raw_text      text,
  context       jsonb
);

-- Índice para listagem recente
create index if not exists bot_logs_created_at_idx on public.bot_logs (created_at desc);

-- RLS: service-role insere (bot), qualquer autenticado lê (painel)
alter table public.bot_logs enable row level security;

create policy "bot_logs_read_authenticated"
  on public.bot_logs for select
  using (auth.role() = 'authenticated');

-- service_role bypassa RLS automaticamente — sem necessidade de policy separada
