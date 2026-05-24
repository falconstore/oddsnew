create table if not exists public.telegram_support_chat (
  id               uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  username         text,
  first_name       text,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  created_at       timestamptz default now()
);

create index if not exists telegram_support_chat_chat_idx
  on public.telegram_support_chat (telegram_chat_id, created_at asc);

alter table public.telegram_support_chat enable row level security;

create policy "service role full access"
  on public.telegram_support_chat for all using (true);
