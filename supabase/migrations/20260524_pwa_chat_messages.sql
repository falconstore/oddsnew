-- Chat messages table for PWA AI support
create table if not exists public.pwa_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_email text not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz default now()
);

create index if not exists pwa_chat_messages_session_idx
  on public.pwa_chat_messages (session_id, created_at asc);

create index if not exists pwa_chat_messages_email_idx
  on public.pwa_chat_messages (user_email, created_at desc);

alter table public.pwa_chat_messages enable row level security;

-- Usuários autenticados leem/escrevem apenas suas próprias mensagens
create policy "users manage own chat messages"
  on public.pwa_chat_messages
  for all
  using (auth.jwt() ->> 'email' = user_email)
  with check (auth.jwt() ->> 'email' = user_email);

-- Service role tem acesso total (edge function usa service role)
