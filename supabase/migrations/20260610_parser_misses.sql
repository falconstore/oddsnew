-- Tabela de aprendizado do parser do bot Telegram.
--
-- Toda vez que o parser de regex (parser.ts) FALHA ou volta PARCIAL e a IA
-- (fallback) precisa entrar pra extrair os campos, registramos aqui o caso:
-- o texto original, o que a IA extraiu, e por quê o regex falhou.
--
-- Objetivo: revisar periodicamente esta tabela, identificar os padrões reais de
-- variação que estão escapando do regex e endurecer o parser.ts (com revisão
-- humana). Quanto mais o regex evolui, menos a IA é chamada → menos custo.
create table if not exists public.parser_misses (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  -- 'no_number' (regex não reconheceu) | 'partial' (regex achou número mas faltaram campos)
  miss_type        text        not null,
  -- número do procedimento, quando a IA conseguiu extrair
  procedure_number text,
  -- texto bruto da mensagem do Telegram que falhou no regex
  raw_text         text        not null,
  -- campos que o REGEX não conseguiu (vindos do parser: missingFields)
  regex_missing    text[],
  -- JSON com os campos que a IA extraiu (pra comparar com o que o regex pegou)
  ai_extracted     jsonb,
  -- explicação curta da IA sobre por que o formato fugiu do padrão (pra guiar o ajuste do regex)
  ai_reason        text,
  -- modelo usado (ex: 'claude-haiku-4-5') e tokens, pra acompanhar custo
  ai_model         text,
  ai_tokens_in     integer,
  ai_tokens_out    integer,
  -- se a IA resolveu (true) ou também falhou (false)
  resolved         boolean     not null default false,
  -- procedimento criado a partir do resgate da IA, quando houver
  procedure_id     uuid,
  -- marcado true quando você já tratou esse padrão no regex (controle de revisão)
  reviewed         boolean     not null default false,
  update_id        bigint,
  message_id       bigint
);

create index if not exists parser_misses_created_at_idx on public.parser_misses (created_at desc);
create index if not exists parser_misses_reviewed_idx on public.parser_misses (reviewed) where reviewed = false;

-- RLS: service-role (bot) insere; autenticado (painel) lê
alter table public.parser_misses enable row level security;

create policy "parser_misses_read_authenticated"
  on public.parser_misses for select
  using (auth.role() = 'authenticated');

-- service_role bypassa RLS — sem policy de insert necessária
