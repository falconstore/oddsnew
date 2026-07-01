-- Histórico dos relatórios de vendas gerados por IA (Dashboard Lastlink).
-- Cada linha guarda o recorte (produto + intervalo), os dados agregados que
-- alimentaram a IA, o texto gerado e metadados de custo (modelo/tokens).
-- Rodar no projeto wspsuempnswljkphatur.
create table if not exists public.lastlink_ai_reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      text,                          -- email do admin que gerou
  produto         text,                          -- null = todos os produtos
  mes_inicio      date not null,
  mes_fim         date not null,
  dados           jsonb not null,                -- agregação mensal usada (auditoria)
  relatorio       jsonb not null,                -- saída estruturada da IA
  modelo          text,
  tokens_in       integer,
  tokens_out      integer
);

create index if not exists idx_lastlink_ai_reports_created
  on public.lastlink_ai_reports (created_at desc);
create index if not exists idx_lastlink_ai_reports_produto
  on public.lastlink_ai_reports (produto, mes_fim desc);

-- RLS: a Edge Function usa service_role (bypassa RLS). Habilitamos RLS e
-- deixamos leitura pra usuários autenticados (a aba já é gated por permissão).
alter table public.lastlink_ai_reports enable row level security;

drop policy if exists lastlink_ai_reports_read on public.lastlink_ai_reports;
create policy lastlink_ai_reports_read
  on public.lastlink_ai_reports
  for select
  to authenticated
  using (true);
