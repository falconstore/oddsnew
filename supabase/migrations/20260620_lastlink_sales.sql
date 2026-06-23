-- Dashboard Lastlink — tabela de vendas importadas do relatório xlsx (sales_list).
--
-- Uma linha por venda. Chave única = id_venda ("Identificador da venda" do xlsx).
-- O upload faz UPSERT por id_venda: subir o arquivo de novo atualiza o status
-- (ex: Pendente→Aprovada) e adiciona novas, SEM duplicar.
--
-- Rodar no projeto de PROCEDIMENTOS (wspsuempnswljkphatur), o mesmo de
-- procedures / bot_logs / parser_misses.
create table if not exists public.lastlink_sales (
  id_venda          text        primary key,            -- "Identificador da venda" (UUID único)
  status            text,                                -- Aprovada | Expirada | Cancelada | Pendente | Reembolsada | Chargeback
  data_venda        timestamptz,                         -- "Data da Venda" convertida (DD/MM/YY HH:MM:SS → ts)
  email             text,
  nome              text,
  telefone          text,
  documento         text,
  endereco          text,
  tipo_venda        text,                                -- "Nova venda" | "Renovação"
  produto           text,                                -- "Produto principal"
  produtos_combo    text,
  produtos_bump     text,
  oferta            text,                                -- "Nome da oferta"
  modalidade        text,                                -- Assinatura Mensal/Trimestral/Semestral/Anual
  forma_pagamento   text,                                -- Pix | Cartão de Crédito
  parcelamento      text,
  cupom             text,
  valor             numeric(12,2),                       -- "Valor da venda"
  comissao_afiliado numeric(12,4),
  comissao_coprod   numeric(12,4),
  taxa_lastlink     numeric(12,4),
  comissao_produtor numeric(12,4),
  afiliado          text,
  coprodutores      text,
  data_pagamento    timestamptz,
  data_expiracao    timestamptz,
  data_reembolso    timestamptz,
  data_chargeback   timestamptz,
  data_cancelamento timestamptz,
  motivo_cancelamento text,
  motivo_falha      text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  -- Metadados do import
  imported_at       timestamptz not null default now(),
  source_file       text                                 -- nome do arquivo de origem (ex: sales_list_2026-06-20.xlsx)
);

-- Índices pros recortes do dashboard
create index if not exists lastlink_sales_data_venda_idx  on public.lastlink_sales (data_venda desc);
create index if not exists lastlink_sales_email_idx       on public.lastlink_sales (email);
create index if not exists lastlink_sales_status_idx      on public.lastlink_sales (status);
create index if not exists lastlink_sales_tipo_idx        on public.lastlink_sales (tipo_venda);
create index if not exists lastlink_sales_produto_idx     on public.lastlink_sales (produto);

-- RLS: autenticado lê; service_role bypassa. O upload usa a anon key autenticada,
-- então precisamos permitir insert/update pra usuários autenticados.
alter table public.lastlink_sales enable row level security;

create policy "lastlink_sales_read_authenticated"
  on public.lastlink_sales for select
  using (auth.role() = 'authenticated');

create policy "lastlink_sales_insert_authenticated"
  on public.lastlink_sales for insert
  with check (auth.role() = 'authenticated');

create policy "lastlink_sales_update_authenticated"
  on public.lastlink_sales for update
  using (auth.role() = 'authenticated');
